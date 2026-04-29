function toPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function normalizeDateKey(dateInput = new Date()) {
  if (typeof dateInput === 'string') {
    return dateInput;
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toISOString().slice(0, 10);
}

function buildSeed(dateKey) {
  return [...dateKey].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function rotateTake(items, count, startIndex) {
  if (!items.length || count <= 0) return [];

  const limit = Math.min(count, items.length);
  const selected = [];
  for (let offset = 0; offset < limit; offset += 1) {
    selected.push(items[(startIndex + offset) % items.length]);
  }
  return selected;
}

function averagePercent(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function readinessLabelFor(percentage) {
  if (percentage >= 85) return 'Exam ready';
  if (percentage >= 70) return 'Almost ready';
  if (percentage >= 40) return 'Building';
  return 'Starter';
}

export function buildQuizSessionRules(mode, options = {}) {
  if (mode === 'exam') {
    return {
      mode,
      label: 'State-style mock exam',
      questionLimit: 45,
      allottedSeconds: 3600,
      hidesImmediateFeedback: true,
      hasCountdown: true,
    };
  }

  if (mode === 'timed') {
    const allottedSeconds = Math.max(1, Number(options.durationSeconds ?? 600));
    return {
      mode,
      label: 'Timed exam',
      questionLimit: null,
      allottedSeconds,
      hidesImmediateFeedback: false,
      hasCountdown: true,
    };
  }

  return {
    mode: 'practice',
    label: 'Practice mode',
    questionLimit: null,
    allottedSeconds: 0,
    hidesImmediateFeedback: false,
    hasCountdown: false,
  };
}

export function buildStudyCoachPlan({
  quizHistory = [],
  flashcards = [],
  masteredCardIds = new Set(),
  dailyStudy = { flashcards: [], questions: [] },
  missedQuestions = [],
  passingPercentage = 80,
} = {}) {
  const latestQuiz = quizHistory.at(-1);
  const latestScore = latestQuiz?.result?.percentage ?? 0;
  const averageScore = averagePercent(quizHistory.map((entry) => entry.result?.percentage ?? 0));
  const flashcardCompletion = toPercent(masteredCardIds.size ?? 0, flashcards.length);
  const readinessPercentage = Math.round((latestScore * 0.4) + (averageScore * 0.4) + (flashcardCompletion * 0.2));

  const categoryMap = new Map();
  for (const entry of quizHistory) {
    for (const bucket of entry.result?.byCategory ?? []) {
      const current = categoryMap.get(bucket.category) ?? {
        category: bucket.category,
        percentageSum: 0,
        attempts: 0,
        missed: 0,
      };
      current.percentageSum += bucket.percentage;
      current.attempts += 1;
      current.missed += bucket.incorrect ?? 0;
      categoryMap.set(bucket.category, current);
    }
  }

  const weakCategories = [...categoryMap.values()]
    .map((item) => ({
      category: item.category,
      averagePercentage: Math.round(item.percentageSum / item.attempts),
      attempts: item.attempts,
      missed: item.missed,
    }))
    .sort((left, right) => {
      if (left.averagePercentage !== right.averagePercentage) return left.averagePercentage - right.averagePercentage;
      if (right.missed !== left.missed) return right.missed - left.missed;
      return left.category.localeCompare(right.category);
    })
    .slice(0, 3);

  const dailyFlashcards = dailyStudy.flashcards ?? [];
  const dailyMasteredCount = dailyFlashcards.filter((card) => masteredCardIds.has(card.id)).length;
  const nextActions = [];

  if (missedQuestions.length) {
    nextActions.push({
      title: 'Review missed questions',
      detail: `${missedQuestions.length} question${missedQuestions.length === 1 ? '' : 's'} waiting from prior misses.`,
      action: 'review',
    });
  }

  if (dailyFlashcards.length && dailyMasteredCount < dailyFlashcards.length) {
    nextActions.push({
      title: 'Finish today’s flashcards',
      detail: `${dailyFlashcards.length - dailyMasteredCount} card${dailyFlashcards.length - dailyMasteredCount === 1 ? '' : 's'} left in today’s set.`,
      action: 'flashcards',
    });
  }

  nextActions.push({
    title: 'Take today’s mini quiz',
    detail: `${dailyStudy.questions?.length ?? 0} quick questions to keep the rules fresh.`,
    action: 'quiz',
  });

  if (!latestQuiz || latestScore < passingPercentage) {
    nextActions.push({
      title: 'Run a 45-question mock exam',
      detail: `State-style practice: 45 items, 1 hour, ${passingPercentage}% target.`,
      action: 'exam',
    });
  }

  return {
    readinessPercentage,
    readinessLabel: readinessLabelFor(readinessPercentage),
    latestScore,
    averageScore,
    flashcardCompletion,
    weakCategories,
    nextActions: nextActions.slice(0, 4),
  };
}

export function getAnswerFeedback(question, selectedAnswer) {
  const isCorrect = selectedAnswer === question.correctAnswer;
  return {
    isCorrect,
    status: isCorrect ? 'correct' : 'incorrect',
    label: isCorrect ? 'Correct' : 'Incorrect',
    detail: isCorrect
      ? `Correct — ${question.options[question.correctAnswer]}`
      : `Incorrect — Correct answer: ${question.options[question.correctAnswer]}`,
  };
}

export function scoreQuiz(questions, answers = {}) {
  const categoryMap = new Map();
  let correctCount = 0;
  let answeredCount = 0;
  const missedQuestionIds = [];

  for (const question of questions) {
    const category = question.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { category, total: 0, correct: 0, incorrect: 0 });
    }

    const bucket = categoryMap.get(category);
    bucket.total += 1;

    const answer = answers[question.id];
    if (answer === undefined || answer === null) {
      continue;
    }

    answeredCount += 1;

    if (answer === question.correctAnswer) {
      correctCount += 1;
      bucket.correct += 1;
    } else {
      bucket.incorrect += 1;
      missedQuestionIds.push(question.id);
    }
  }

  const totalQuestions = questions.length;
  const incorrectCount = missedQuestionIds.length;
  const unansweredCount = totalQuestions - answeredCount;

  const byCategory = [...categoryMap.values()]
    .map((item) => ({
      ...item,
      percentage: toPercent(item.correct, item.total),
    }))
    .sort((left, right) => left.category.localeCompare(right.category));

  return {
    totalQuestions,
    answeredCount,
    unansweredCount,
    correctCount,
    incorrectCount,
    percentage: toPercent(correctCount, totalQuestions),
    missedQuestionIds,
    byCategory,
  };
}

export function buildFlashcardProgress(flashcards, completedIds = new Set()) {
  const categoryMap = new Map();

  for (const card of flashcards) {
    const category = card.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { category, total: 0, completed: 0 });
    }

    const bucket = categoryMap.get(category);
    bucket.total += 1;

    if (completedIds.has(card.id)) {
      bucket.completed += 1;
    }
  }

  return [...categoryMap.values()]
    .map((item) => ({
      category: item.category,
      total: item.total,
      completed: item.completed,
      remaining: item.total - item.completed,
      percentage: toPercent(item.completed, item.total),
    }))
    .sort((left, right) => left.category.localeCompare(right.category));
}

export function generateDailyStudySet(flashcards, questions, dateInput = new Date(), config = {}) {
  const dateKey = normalizeDateKey(dateInput);
  const seed = buildSeed(dateKey);
  const flashcardCount = config.flashcardCount ?? 6;
  const questionCount = config.questionCount ?? 8;

  const selectedFlashcards = rotateTake(flashcards, flashcardCount, seed % Math.max(flashcards.length, 1));
  const selectedQuestions = rotateTake(questions, questionCount, seed % Math.max(questions.length, 1));

  const categoryCounts = new Map();
  for (const item of [...selectedFlashcards, ...selectedQuestions]) {
    const category = item.category;
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  const focusCategories = [...categoryCounts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .map(([category]) => category);

  return {
    dateKey,
    flashcards: selectedFlashcards,
    flashcardIds: selectedFlashcards.map((item) => item.id),
    questions: selectedQuestions,
    questionIds: selectedQuestions.map((item) => item.id),
    focusCategories,
  };
}

export function buildExamOutcome(result, options = {}) {
  const passingPercentage = options.passingPercentage ?? 80;
  const label = options.label ?? 'Exam';
  const passed = result.percentage >= passingPercentage;
  return {
    label,
    passingPercentage,
    passed,
    status: passed ? 'pass' : 'fail',
    headline: passed ? 'Pass' : 'Needs work',
    shortfall: passed ? 0 : Math.max(0, passingPercentage - result.percentage),
    result,
  };
}

export function selectMissedQuestionsForReview(allQuestions, quizHistory = [], options = {}) {
  const limit = options.limit ?? 10;
  const scoreMap = new Map();

  for (const entry of quizHistory) {
    const missedIds = entry?.result?.missedQuestionIds ?? [];
    const timestamp = new Date(entry?.timestamp ?? 0).getTime() || 0;
    for (const questionId of missedIds) {
      const current = scoreMap.get(questionId) ?? { count: 0, lastMissedAt: 0 };
      current.count += 1;
      current.lastMissedAt = Math.max(current.lastMissedAt, timestamp);
      scoreMap.set(questionId, current);
    }
  }

  return [...allQuestions]
    .filter((question) => scoreMap.has(question.id))
    .sort((left, right) => {
      const leftScore = scoreMap.get(left.id);
      const rightScore = scoreMap.get(right.id);
      if (rightScore.count !== leftScore.count) return rightScore.count - leftScore.count;
      if (rightScore.lastMissedAt !== leftScore.lastMissedAt) return rightScore.lastMissedAt - leftScore.lastMissedAt;
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

export function buildTimedExamSummary(questions, answers = {}, options = {}) {
  const allottedSeconds = Math.max(0, options.allottedSeconds ?? 0);
  const rawElapsedSeconds = Math.max(0, options.elapsedSeconds ?? 0);
  const elapsedSeconds = allottedSeconds ? Math.min(rawElapsedSeconds, allottedSeconds) : rawElapsedSeconds;
  const timeRemainingSeconds = Math.max(0, allottedSeconds - elapsedSeconds);
  const completionReason = options.completionReason ?? 'submitted';
  const expired = completionReason === 'time-expired' || (allottedSeconds > 0 && rawElapsedSeconds >= allottedSeconds);

  return {
    mode: 'timed-exam',
    allottedSeconds,
    elapsedSeconds,
    rawElapsedSeconds,
    timeRemainingSeconds,
    expired,
    finishedEarly: !expired && timeRemainingSeconds > 0,
    completionReason,
    result: scoreQuiz(questions, answers),
  };
}
