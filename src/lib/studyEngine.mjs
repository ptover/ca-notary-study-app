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
