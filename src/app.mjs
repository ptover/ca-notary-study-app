import { handbookSource, examTips, topicSummaries, flashcards, quizQuestions } from './data/studyData.mjs';
import {
  scoreQuiz,
  buildFlashcardProgress,
  generateDailyStudySet,
  buildTimedExamSummary,
  getAnswerFeedback,
} from './lib/studyEngine.mjs';

const STORAGE_KEYS = {
  mastered: 'ca-notary-mastered-flashcards',
  quizHistory: 'ca-notary-quiz-history',
};

const DAILY_COUNTS = {
  flashcards: 6,
  questions: 8,
};

const state = {
  activeTab: 'guide',
  guideCategory: 'All',
  masteredCards: loadSet(STORAGE_KEYS.mastered),
  quizHistory: loadJson(STORAGE_KEYS.quizHistory, []),
  dailyStudy: generateDailyStudySet(flashcards, quizQuestions, new Date(), {
    flashcardCount: DAILY_COUNTS.flashcards,
    questionCount: DAILY_COUNTS.questions,
  }),
  flashcards: {
    scope: 'all',
    category: 'All',
    index: 0,
    showingBack: false,
  },
  quiz: {
    scope: 'category',
    mode: 'practice',
    category: 'All',
    questionCount: '8',
    durationSeconds: 600,
    pool: [],
    currentIndex: 0,
    answers: {},
    revealed: false,
    active: false,
    startedAtMs: null,
    timerId: null,
    timeRemainingSeconds: null,
  },
};

const elements = {
  officialHandbookLink: document.querySelector('#official-handbook-link'),
  installButton: document.querySelector('#install-app'),
  heroStats: document.querySelector('#hero-stats'),
  sourceCard: document.querySelector('#source-card'),
  examTips: document.querySelector('#exam-tips'),
  dailyStudyBadgeRow: document.querySelector('#daily-study-badge-row'),
  dailyStudyCard: document.querySelector('#daily-study-card'),
  topicFilterChips: document.querySelector('#topic-filter-chips'),
  topicGuideGrid: document.querySelector('#topic-guide-grid'),
  flashcardCategory: document.querySelector('#flashcard-category'),
  flashcardScopeAll: document.querySelector('#flashcard-scope-all'),
  flashcardScopeDaily: document.querySelector('#flashcard-scope-daily'),
  flashcardMeta: document.querySelector('#flashcard-meta'),
  flashcardCard: document.querySelector('#flashcard-card'),
  flashcardPrev: document.querySelector('#flashcard-prev'),
  flashcardFlip: document.querySelector('#flashcard-flip'),
  flashcardNext: document.querySelector('#flashcard-next'),
  flashcardMastered: document.querySelector('#flashcard-mastered'),
  flashcardReset: document.querySelector('#flashcard-reset'),
  quizMode: document.querySelector('#quiz-mode'),
  quizCategory: document.querySelector('#quiz-category'),
  quizQuestionCount: document.querySelector('#quiz-question-count'),
  quizDuration: document.querySelector('#quiz-duration'),
  quizDurationGroup: document.querySelector('#quiz-duration-group'),
  quizScopeCategory: document.querySelector('#quiz-scope-category'),
  quizScopeDaily: document.querySelector('#quiz-scope-daily'),
  quizStart: document.querySelector('#quiz-start'),
  quizRestart: document.querySelector('#quiz-restart'),
  quizEmpty: document.querySelector('#quiz-empty'),
  quizStage: document.querySelector('#quiz-stage'),
  quizProgress: document.querySelector('#quiz-progress'),
  quizPrompt: document.querySelector('#quiz-prompt'),
  quizOptions: document.querySelector('#quiz-options'),
  quizExplanation: document.querySelector('#quiz-explanation'),
  quizSubmit: document.querySelector('#quiz-submit'),
  quizNext: document.querySelector('#quiz-next'),
  quizResults: document.querySelector('#quiz-results'),
  progressStats: document.querySelector('#progress-stats'),
  flashcardProgressList: document.querySelector('#flashcard-progress-list'),
  quizFocusList: document.querySelector('#quiz-focus-list'),
  dailyProgressList: document.querySelector('#daily-progress-list'),
  timedExamHistory: document.querySelector('#timed-exam-history'),
  tabButtons: [...document.querySelectorAll('.tab-button')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
};

let deferredInstallPrompt = null;

function loadJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function loadSet(key) {
  return new Set(loadJson(key, []));
}

function saveSet(key, valueSet) {
  window.localStorage.setItem(key, JSON.stringify([...valueSet]));
}

function saveJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uniqueCategories(items) {
  return ['All', ...new Set(items.map((item) => item.category))];
}

function percent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function currentFlashcardPool() {
  if (state.flashcards.scope === 'daily') {
    return state.dailyStudy.flashcards;
  }

  return state.flashcards.category === 'All'
    ? flashcards
    : flashcards.filter((card) => card.category === state.flashcards.category);
}

function buildQuestionPool() {
  const basePool = state.quiz.scope === 'daily'
    ? state.dailyStudy.questions
    : state.quiz.category === 'All'
      ? quizQuestions
      : quizQuestions.filter((question) => question.category === state.quiz.category);

  if (!basePool.length) return [];
  if (state.quiz.scope === 'daily' || state.quiz.questionCount === 'all') return [...basePool];

  const requestedCount = Number(state.quiz.questionCount);
  const count = Math.min(requestedCount, basePool.length);
  const offset = state.quizHistory.length % basePool.length;

  return Array.from({ length: count }, (_, index) => basePool[(offset + index) % basePool.length]);
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
  elements.tabPanels.forEach((panel) => {
    const isActive = panel.id === `tab-${tabName}`;
    panel.hidden = !isActive;
    panel.classList.toggle('active', isActive);
  });
}

function setFlashcardScope(scope) {
  state.flashcards.scope = scope;
  state.flashcards.index = 0;
  state.flashcards.showingBack = false;
  renderFlashcardControls();
  renderFlashcard();
}

function setQuizScope(scope) {
  state.quiz.scope = scope;
  renderQuizControls();
}

function renderHeroStats() {
  const latestQuiz = state.quizHistory.at(-1);
  const timedExamCount = state.quizHistory.filter((entry) => entry.mode === 'timed').length;
  const stats = [
    { label: 'Current handbook', value: handbookSource.edition },
    { label: 'Today’s flashcards', value: String(state.dailyStudy.flashcards.length) },
    { label: 'Today’s quiz', value: String(state.dailyStudy.questions.length) },
    { label: 'Mastered cards', value: `${state.masteredCards.size}/${flashcards.length}` },
    { label: 'Timed exams', value: String(timedExamCount) },
    { label: 'Last quiz score', value: latestQuiz ? `${latestQuiz.result.percentage}%` : '—' },
  ];

  elements.heroStats.innerHTML = stats
    .map(
      (stat) => `
        <div class="stat-pill">
          <span class="stat-value">${stat.value}</span>
          <span class="stat-label">${stat.label}</span>
        </div>
      `
    )
    .join('');
}

function renderSourceCard() {
  elements.officialHandbookLink.href = handbookSource.pdfUrl;
  elements.sourceCard.innerHTML = `
    <div class="source-panel">
      <p class="source-title">${handbookSource.title}</p>
      <p class="muted">${handbookSource.currentStatus}</p>
      <p class="muted">${handbookSource.note}</p>
      <div class="chip-row">
        <span class="chip static">Edition ${handbookSource.edition}</span>
        <span class="chip static">${handbookSource.pages} pages</span>
      </div>
      <div class="stack-sm">
        <a class="text-link" href="${handbookSource.officialPageUrl}" target="_blank" rel="noreferrer">Official handbook page</a>
        <a class="text-link" href="${handbookSource.pdfUrl}" target="_blank" rel="noreferrer">Direct handbook PDF</a>
        <a class="text-link" href="${handbookSource.workbookUrl}" target="_blank" rel="noreferrer">Sample workbook PDF</a>
      </div>
    </div>
  `;
}

function renderExamTips() {
  elements.examTips.innerHTML = examTips.map((tip) => `<li>${tip}</li>`).join('');
}

function renderDailyStudy() {
  const masteredToday = state.dailyStudy.flashcards.filter((card) => state.masteredCards.has(card.id)).length;
  const todayDailyQuizCount = state.quizHistory.filter(
    (entry) => entry.dateKey === state.dailyStudy.dateKey && entry.scope === 'daily'
  ).length;

  elements.dailyStudyBadgeRow.innerHTML = `
    <span class="chip static">${state.dailyStudy.dateKey}</span>
    <span class="chip static">${state.dailyStudy.flashcards.length} flashcards</span>
    <span class="chip static">${state.dailyStudy.questions.length} questions</span>
    <span class="chip static">${masteredToday}/${state.dailyStudy.flashcards.length} mastered</span>
    <span class="chip static">${todayDailyQuizCount} daily quizzes logged</span>
  `;

  elements.dailyStudyCard.innerHTML = `
    <div class="grid two-up">
      <div class="subcard">
        <h3>Today’s focus areas</h3>
        <div class="chip-row">
          ${state.dailyStudy.focusCategories.map((category) => `<span class="mini-chip">${category}</span>`).join('')}
        </div>
        <p class="muted">Use this mini set for a fast phone study session. The set rotates by date so you keep seeing new combinations over time.</p>
        <div class="button-row compact mobile-wrap">
          <button class="button button-dark" type="button" data-daily-action="flashcards">Start today’s flashcards</button>
          <button class="button button-light" type="button" data-daily-action="quiz">Start today’s mini quiz</button>
          <button class="button button-light" type="button" data-daily-action="timed">Start timed exam</button>
        </div>
      </div>
      <div class="subcard">
        <h3>What’s in today’s set</h3>
        <div class="stack-sm">
          <div>
            <p class="field-label">Flashcards</p>
            <div class="bullet-list compact plain-list">
              ${state.dailyStudy.flashcards.map((card) => `<div>• ${card.category}: ${card.front}</div>`).join('')}
            </div>
          </div>
          <div>
            <p class="field-label">Quiz topics</p>
            <div class="bullet-list compact plain-list">
              ${state.dailyStudy.questions.map((question) => `<div>• ${question.category}: ${question.prompt}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTopicGuide() {
  const categories = uniqueCategories(topicSummaries);
  elements.topicFilterChips.innerHTML = categories
    .map(
      (category) => `
        <button type="button" class="chip ${state.guideCategory === category ? 'active' : ''}" data-guide-category="${category}">${category}</button>
      `
    )
    .join('');

  const filteredTopics = state.guideCategory === 'All'
    ? topicSummaries
    : topicSummaries.filter((topic) => topic.category === state.guideCategory);

  elements.topicGuideGrid.innerHTML = filteredTopics
    .map(
      (topic) => `
        <article class="topic-card">
          <div class="topic-card-head">
            <span class="mini-chip">${topic.category}</span>
            <span class="source-ref">${topic.sourceRef}</span>
          </div>
          <h3>${topic.title}</h3>
          <p class="topic-quicktake">${topic.quickTake}</p>
          <ul class="bullet-list compact">
            ${topic.bullets.map((bullet) => `<li>${bullet}</li>`).join('')}
          </ul>
        </article>
      `
    )
    .join('');
}

function renderCategorySelectors() {
  const flashcardCategories = uniqueCategories(flashcards);
  const quizCategories = uniqueCategories(quizQuestions);

  elements.flashcardCategory.innerHTML = flashcardCategories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join('');
  elements.flashcardCategory.value = state.flashcards.category;

  elements.quizCategory.innerHTML = quizCategories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join('');
  elements.quizCategory.value = state.quiz.category;
}

function renderFlashcardControls() {
  const dailyActive = state.flashcards.scope === 'daily';
  elements.flashcardScopeAll.classList.toggle('active', !dailyActive);
  elements.flashcardScopeDaily.classList.toggle('active', dailyActive);
  elements.flashcardCategory.disabled = dailyActive;
}

function renderFlashcard() {
  const pool = currentFlashcardPool();
  if (!pool.length) {
    elements.flashcardMeta.textContent = 'No flashcards available for this selection.';
    elements.flashcardCard.innerHTML = '<div class="flashcard-face"><p>No flashcards found.</p></div>';
    return;
  }

  if (state.flashcards.index >= pool.length) {
    state.flashcards.index = 0;
  }

  const card = pool[state.flashcards.index];
  const isMastered = state.masteredCards.has(card.id);
  const masteredInPool = pool.filter((item) => state.masteredCards.has(item.id)).length;
  const scopeLabel = state.flashcards.scope === 'daily' ? 'Today’s set' : 'Custom set';

  elements.flashcardMeta.innerHTML = `
    <span class="mini-chip">${scopeLabel}</span>
    <span class="mini-chip">${card.category}</span>
    <span>Card ${state.flashcards.index + 1} of ${pool.length}</span>
    <span>${masteredInPool}/${pool.length} mastered</span>
  `;

  elements.flashcardCard.innerHTML = `
    <div class="flashcard-face ${state.flashcards.showingBack ? 'back' : 'front'}">
      <span class="face-label">${state.flashcards.showingBack ? 'Back' : 'Front'}</span>
      <p>${state.flashcards.showingBack ? card.back : card.front}</p>
      <span class="tap-hint">Tap the card or use Flip card</span>
    </div>
  `;

  elements.flashcardMastered.textContent = isMastered ? 'Remove mastered' : 'Mark mastered';
}

function stopQuizTimer() {
  if (state.quiz.timerId) {
    window.clearInterval(state.quiz.timerId);
    state.quiz.timerId = null;
  }
}

function renderQuizControls() {
  const timedMode = state.quiz.mode === 'timed';
  const dailyScope = state.quiz.scope === 'daily';

  elements.quizMode.value = state.quiz.mode;
  elements.quizCategory.value = state.quiz.category;
  elements.quizQuestionCount.value = state.quiz.questionCount;
  elements.quizDuration.value = String(state.quiz.durationSeconds);

  elements.quizDurationGroup.classList.toggle('hidden', !timedMode);
  elements.quizScopeCategory.classList.toggle('active', !dailyScope);
  elements.quizScopeDaily.classList.toggle('active', dailyScope);
  elements.quizCategory.disabled = dailyScope;
  elements.quizQuestionCount.disabled = dailyScope;
}

function resetQuizUi() {
  stopQuizTimer();
  elements.quizEmpty.classList.remove('hidden');
  elements.quizStage.classList.add('hidden');
  elements.quizResults.classList.add('hidden');
  elements.quizResults.innerHTML = '';
}

function renderQuizProgress(question) {
  const progressBits = [
    `<span class="mini-chip">${state.quiz.mode === 'timed' ? 'Timed exam' : 'Practice mode'}</span>`,
    `<span class="mini-chip">${state.quiz.scope === 'daily' ? 'Today’s mini quiz' : question.category}</span>`,
    `<span>Question ${state.quiz.currentIndex + 1} of ${state.quiz.pool.length}</span>`,
  ];

  if (state.quiz.mode === 'timed') {
    progressBits.push(`<span class="timer-chip">Time left ${formatSeconds(Math.max(0, state.quiz.timeRemainingSeconds ?? 0))}</span>`);
  }

  elements.quizProgress.innerHTML = progressBits.join('');
}

function renderQuizQuestion() {
  const question = state.quiz.pool[state.quiz.currentIndex];
  if (!question) {
    finishQuiz('submitted');
    return;
  }

  elements.quizEmpty.classList.add('hidden');
  elements.quizStage.classList.remove('hidden');
  elements.quizResults.classList.add('hidden');

  renderQuizProgress(question);
  elements.quizPrompt.textContent = question.prompt;

  const selectedAnswer = state.quiz.answers[question.id];
  elements.quizOptions.innerHTML = question.options
    .map((option, index) => {
      const isSelected = selectedAnswer === index;
      const revealClass = state.quiz.revealed
        ? index === question.correctAnswer
          ? 'correct'
          : isSelected
            ? 'incorrect'
            : ''
        : '';

      return `
        <label class="option-card ${isSelected ? 'selected' : ''} ${revealClass}">
          <input type="radio" name="quiz-option" value="${index}" ${isSelected ? 'checked' : ''} ${state.quiz.revealed ? 'disabled' : ''} />
          <span>${option}</span>
        </label>
      `;
    })
    .join('');

  const showExplanation = state.quiz.revealed;
  const feedback = state.quiz.revealed && selectedAnswer !== undefined
    ? getAnswerFeedback(question, selectedAnswer)
    : null;

  elements.quizExplanation.innerHTML = feedback
    ? `
      <div class="quiz-feedback-status ${feedback.status}">${feedback.label}</div>
      <div>${feedback.detail}</div>
      <div>${question.explanation}</div>
    `
    : question.explanation;
  elements.quizExplanation.classList.toggle('hidden', !showExplanation);
  elements.quizSubmit.classList.toggle('hidden', state.quiz.revealed);
  elements.quizNext.classList.toggle('hidden', !state.quiz.revealed);
  elements.quizNext.textContent = state.quiz.currentIndex === state.quiz.pool.length - 1 ? 'Finish quiz' : 'Next question';
}

function renderQuizResults(entry, summary) {
  const missedItems = entry.questions.filter((question) => summary.result.missedQuestionIds.includes(question.id));
  const timingBlock = entry.mode === 'timed'
    ? `
      <div class="metric-grid compact">
        <div class="metric-card"><span class="metric-value">${formatSeconds(summary.elapsedSeconds)}</span><span class="metric-label">Time used</span></div>
        <div class="metric-card"><span class="metric-value">${formatSeconds(summary.timeRemainingSeconds)}</span><span class="metric-label">Time left</span></div>
        <div class="metric-card"><span class="metric-value">${summary.expired ? 'Expired' : 'Submitted'}</span><span class="metric-label">Finish type</span></div>
      </div>
    `
    : '';

  elements.quizResults.innerHTML = `
    <div class="results-panel">
      <div class="metric-grid compact">
        <div class="metric-card"><span class="metric-value">${summary.result.percentage}%</span><span class="metric-label">Score</span></div>
        <div class="metric-card"><span class="metric-value">${summary.result.correctCount}/${summary.result.totalQuestions}</span><span class="metric-label">Correct</span></div>
        <div class="metric-card"><span class="metric-value">${summary.result.unansweredCount}</span><span class="metric-label">Unanswered</span></div>
      </div>
      ${timingBlock}
      <div class="results-block">
        <h3>Category breakdown</h3>
        <div class="stack-sm">
          ${summary.result.byCategory
            .map(
              (item) => `
                <div class="result-row">
                  <span>${item.category}</span>
                  <span>${item.correct}/${item.total} correct • ${item.percentage}%</span>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
      <div class="results-block">
        <h3>Review missed questions</h3>
        ${missedItems.length
          ? `<div class="stack-sm">${missedItems
              .map(
                (item) => `
                  <div class="review-card">
                    <strong>${item.prompt}</strong>
                    <p>Correct answer: ${item.options[item.correctAnswer]}</p>
                    <p class="muted">${item.explanation}</p>
                  </div>
                `
              )
              .join('')}</div>`
          : '<p class="muted">Perfect round. No missed questions to review.</p>'}
      </div>
    </div>
  `;
}

function finishQuiz(completionReason = 'submitted') {
  if (!state.quiz.active && !state.quiz.pool.length) return;

  stopQuizTimer();
  const elapsedSeconds = state.quiz.startedAtMs
    ? Math.floor((Date.now() - state.quiz.startedAtMs) / 1000)
    : 0;

  const summary = state.quiz.mode === 'timed'
    ? buildTimedExamSummary(state.quiz.pool, state.quiz.answers, {
        allottedSeconds: state.quiz.durationSeconds,
        elapsedSeconds,
        completionReason,
      })
    : {
        mode: 'practice',
        completionReason,
        result: scoreQuiz(state.quiz.pool, state.quiz.answers),
      };

  const entry = {
    timestamp: new Date().toISOString(),
    dateKey: state.dailyStudy.dateKey,
    scope: state.quiz.scope,
    mode: state.quiz.mode,
    category: state.quiz.scope === 'daily' ? 'Today’s mini quiz' : state.quiz.category,
    questions: state.quiz.pool,
    result: summary.result,
    summary,
  };

  state.quizHistory.push(entry);
  saveJson(STORAGE_KEYS.quizHistory, state.quizHistory);

  elements.quizStage.classList.add('hidden');
  elements.quizResults.classList.remove('hidden');
  renderQuizResults(entry, summary);

  state.quiz.active = false;
  state.quiz.pool = [];
  state.quiz.currentIndex = 0;
  state.quiz.answers = {};
  state.quiz.revealed = false;
  state.quiz.startedAtMs = null;
  state.quiz.timeRemainingSeconds = null;

  renderHeroStats();
  renderDailyStudy();
  renderProgress();
}

function startQuizTimer() {
  stopQuizTimer();
  state.quiz.timeRemainingSeconds = state.quiz.durationSeconds;

  state.quiz.timerId = window.setInterval(() => {
    if (!state.quiz.active || state.quiz.mode !== 'timed') {
      stopQuizTimer();
      return;
    }

    const elapsedSeconds = Math.floor((Date.now() - state.quiz.startedAtMs) / 1000);
    const remaining = Math.max(0, state.quiz.durationSeconds - elapsedSeconds);
    state.quiz.timeRemainingSeconds = remaining;

    const question = state.quiz.pool[state.quiz.currentIndex];
    if (question) {
      renderQuizProgress(question);
    }

    if (remaining <= 0) {
      finishQuiz('time-expired');
    }
  }, 1000);
}

function startQuiz() {
  const pool = buildQuestionPool();
  if (!pool.length) {
    window.alert('No questions are available for this selection.');
    return;
  }

  state.quiz.pool = pool;
  state.quiz.currentIndex = 0;
  state.quiz.answers = {};
  state.quiz.revealed = false;
  state.quiz.active = true;
  state.quiz.startedAtMs = Date.now();
  state.quiz.timeRemainingSeconds = state.quiz.mode === 'timed' ? state.quiz.durationSeconds : null;

  if (state.quiz.mode === 'timed') {
    startQuizTimer();
  }

  renderQuizQuestion();
}

function renderProgress() {
  const flashcardProgress = buildFlashcardProgress(flashcards, state.masteredCards);
  const lastQuiz = state.quizHistory.at(-1);
  const averageScore = state.quizHistory.length
    ? Math.round(state.quizHistory.reduce((sum, item) => sum + item.result.percentage, 0) / state.quizHistory.length)
    : 0;
  const bestScore = state.quizHistory.length
    ? Math.max(...state.quizHistory.map((item) => item.result.percentage))
    : 0;
  const timedExams = state.quizHistory.filter((entry) => entry.mode === 'timed');
  const dailyMasteredCount = state.dailyStudy.flashcards.filter((card) => state.masteredCards.has(card.id)).length;
  const todayDailyQuizzes = state.quizHistory.filter(
    (entry) => entry.dateKey === state.dailyStudy.dateKey && entry.scope === 'daily'
  );

  const stats = [
    { label: 'Mastered flashcards', value: `${state.masteredCards.size}/${flashcards.length}` },
    { label: 'Flashcard completion', value: `${percent(state.masteredCards.size, flashcards.length)}%` },
    { label: 'Quizzes taken', value: String(state.quizHistory.length) },
    { label: 'Average quiz score', value: state.quizHistory.length ? `${averageScore}%` : '—' },
    { label: 'Best quiz score', value: state.quizHistory.length ? `${bestScore}%` : '—' },
    { label: 'Timed exams taken', value: String(timedExams.length) },
  ];

  elements.progressStats.innerHTML = stats
    .map(
      (stat) => `
        <div class="metric-card">
          <span class="metric-value">${stat.value}</span>
          <span class="metric-label">${stat.label}</span>
        </div>
      `
    )
    .join('');

  elements.flashcardProgressList.innerHTML = flashcardProgress
    .map(
      (item) => `
        <div class="result-row">
          <span>${item.category}</span>
          <span>${item.completed}/${item.total} • ${item.percentage}%</span>
        </div>
      `
    )
    .join('');

  if (!state.quizHistory.length) {
    elements.quizFocusList.innerHTML = '<p class="muted">Take your first quiz to see weak spots.</p>';
  } else {
    const categoryTotals = new Map();
    for (const entry of state.quizHistory) {
      for (const bucket of entry.result.byCategory) {
        if (!categoryTotals.has(bucket.category)) {
          categoryTotals.set(bucket.category, { category: bucket.category, percentageSum: 0, count: 0 });
        }
        const aggregate = categoryTotals.get(bucket.category);
        aggregate.percentageSum += bucket.percentage;
        aggregate.count += 1;
      }
    }

    const weakest = [...categoryTotals.values()]
      .map((item) => ({
        category: item.category,
        averagePercentage: Math.round(item.percentageSum / item.count),
      }))
      .sort((left, right) => left.averagePercentage - right.averagePercentage)
      .slice(0, 4);

    elements.quizFocusList.innerHTML = weakest
      .map(
        (item) => `
          <div class="result-row">
            <span>${item.category}</span>
            <span>${item.averagePercentage}% average</span>
          </div>
        `
      )
      .join('');
  }

  elements.dailyProgressList.innerHTML = `
    <div class="result-row">
      <span>Today’s mastered cards</span>
      <span>${dailyMasteredCount}/${state.dailyStudy.flashcards.length}</span>
    </div>
    <div class="result-row">
      <span>Today’s daily quizzes</span>
      <span>${todayDailyQuizzes.length}</span>
    </div>
    <div class="result-row">
      <span>Last quiz score</span>
      <span>${lastQuiz ? `${lastQuiz.result.percentage}%` : '—'}</span>
    </div>
  `;

  if (!timedExams.length) {
    elements.timedExamHistory.innerHTML = '<p class="muted">No timed exams yet. Start one from the Quiz tab.</p>';
  } else {
    elements.timedExamHistory.innerHTML = timedExams
      .slice(-4)
      .reverse()
      .map(
        (entry) => `
          <div class="result-row">
            <span>${new Date(entry.timestamp).toLocaleDateString()}</span>
            <span>${entry.result.percentage}% • ${formatSeconds(entry.summary.allottedSeconds)}</span>
          </div>
        `
      )
      .join('');
  }
}

function wireEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  elements.topicFilterChips.addEventListener('click', (event) => {
    const button = event.target.closest('[data-guide-category]');
    if (!button) return;
    state.guideCategory = button.dataset.guideCategory;
    renderTopicGuide();
  });

  elements.dailyStudyCard.addEventListener('click', (event) => {
    const button = event.target.closest('[data-daily-action]');
    if (!button) return;

    const action = button.dataset.dailyAction;
    if (action === 'flashcards') {
      setFlashcardScope('daily');
      setActiveTab('flashcards');
    } else if (action === 'quiz') {
      state.quiz.mode = 'practice';
      setQuizScope('daily');
      renderQuizControls();
      setActiveTab('quiz');
      startQuiz();
    } else if (action === 'timed') {
      state.quiz.mode = 'timed';
      setQuizScope('category');
      renderQuizControls();
      setActiveTab('quiz');
    }
  });

  elements.flashcardCategory.addEventListener('change', (event) => {
    state.flashcards.category = event.target.value;
    state.flashcards.index = 0;
    state.flashcards.showingBack = false;
    renderFlashcard();
  });

  elements.flashcardScopeAll.addEventListener('click', () => setFlashcardScope('all'));
  elements.flashcardScopeDaily.addEventListener('click', () => setFlashcardScope('daily'));

  elements.flashcardCard.addEventListener('click', () => {
    state.flashcards.showingBack = !state.flashcards.showingBack;
    renderFlashcard();
  });

  elements.flashcardFlip.addEventListener('click', () => {
    state.flashcards.showingBack = !state.flashcards.showingBack;
    renderFlashcard();
  });

  elements.flashcardPrev.addEventListener('click', () => {
    const pool = currentFlashcardPool();
    state.flashcards.index = (state.flashcards.index - 1 + pool.length) % pool.length;
    state.flashcards.showingBack = false;
    renderFlashcard();
  });

  elements.flashcardNext.addEventListener('click', () => {
    const pool = currentFlashcardPool();
    state.flashcards.index = (state.flashcards.index + 1) % pool.length;
    state.flashcards.showingBack = false;
    renderFlashcard();
  });

  elements.flashcardMastered.addEventListener('click', () => {
    const pool = currentFlashcardPool();
    const card = pool[state.flashcards.index];
    if (!card) return;

    if (state.masteredCards.has(card.id)) {
      state.masteredCards.delete(card.id);
    } else {
      state.masteredCards.add(card.id);
    }

    saveSet(STORAGE_KEYS.mastered, state.masteredCards);
    renderFlashcard();
    renderHeroStats();
    renderDailyStudy();
    renderProgress();
  });

  elements.flashcardReset.addEventListener('click', () => {
    state.masteredCards = new Set();
    saveSet(STORAGE_KEYS.mastered, state.masteredCards);
    renderFlashcard();
    renderHeroStats();
    renderDailyStudy();
    renderProgress();
  });

  elements.quizMode.addEventListener('change', (event) => {
    state.quiz.mode = event.target.value;
    renderQuizControls();
  });

  elements.quizCategory.addEventListener('change', (event) => {
    state.quiz.category = event.target.value;
  });

  elements.quizQuestionCount.addEventListener('change', (event) => {
    state.quiz.questionCount = event.target.value;
  });

  elements.quizDuration.addEventListener('change', (event) => {
    state.quiz.durationSeconds = Number(event.target.value);
  });

  elements.quizScopeCategory.addEventListener('click', () => setQuizScope('category'));
  elements.quizScopeDaily.addEventListener('click', () => setQuizScope('daily'));

  elements.quizStart.addEventListener('click', () => {
    if (state.quiz.active) {
      finishQuiz('submitted');
      return;
    }
    startQuiz();
  });

  elements.quizRestart.addEventListener('click', () => {
    stopQuizTimer();
    state.quiz.pool = [];
    state.quiz.currentIndex = 0;
    state.quiz.answers = {};
    state.quiz.revealed = false;
    state.quiz.active = false;
    state.quiz.startedAtMs = null;
    state.quiz.timeRemainingSeconds = null;
    resetQuizUi();
  });

  elements.quizOptions.addEventListener('change', (event) => {
    if (event.target.name !== 'quiz-option') return;
    const question = state.quiz.pool[state.quiz.currentIndex];
    if (!question) return;
    state.quiz.answers[question.id] = Number(event.target.value);
  });

  elements.quizSubmit.addEventListener('click', () => {
    const question = state.quiz.pool[state.quiz.currentIndex];
    if (!question) return;
    if (state.quiz.answers[question.id] === undefined) {
      window.alert('Choose an answer before submitting.');
      return;
    }

    state.quiz.revealed = true;
    renderQuizQuestion();
  });

  elements.quizNext.addEventListener('click', () => {
    state.quiz.currentIndex += 1;
    state.quiz.revealed = false;
    if (state.quiz.currentIndex >= state.quiz.pool.length) {
      finishQuiz('submitted');
      return;
    }
    renderQuizQuestion();
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.classList.remove('hidden');
  });

  elements.installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    elements.installButton.classList.add('hidden');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function init() {
  renderHeroStats();
  renderSourceCard();
  renderExamTips();
  renderDailyStudy();
  renderCategorySelectors();
  renderFlashcardControls();
  renderTopicGuide();
  renderFlashcard();
  renderQuizControls();
  renderProgress();
  resetQuizUi();
  setActiveTab(state.activeTab);
  wireEvents();
  registerServiceWorker();
}

init();
