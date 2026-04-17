import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreQuiz,
  buildFlashcardProgress,
  generateDailyStudySet,
  buildTimedExamSummary,
  getAnswerFeedback,
  buildExamOutcome,
  selectMissedQuestionsForReview,
} from '../src/lib/studyEngine.mjs';

const sampleQuestions = [
  {
    id: 'q1',
    category: 'Identification',
    prompt: 'What is required for a jurat?',
    correctAnswer: 1,
    options: ['No personal appearance', 'Personal appearance and oath', 'No journal entry'],
    explanation: 'A jurat requires personal appearance and an oath or affirmation.',
  },
  {
    id: 'q2',
    category: 'Fees',
    prompt: 'What is the max fee for an acknowledgment?',
    correctAnswer: 2,
    options: ['$10', '$20', '$15'],
    explanation: 'California allows up to $15 for each acknowledgment signature.',
  },
  {
    id: 'q3',
    category: 'Identification',
    prompt: 'How many credible witnesses may be used if the notary does not personally know them?',
    correctAnswer: 0,
    options: ['Two', 'One', 'Three'],
    explanation: 'Two credible witnesses may be used when they are not personally known to the notary.',
  },
];

const sampleFlashcards = [
  { id: 'f1', category: 'Commission Basics' },
  { id: 'f2', category: 'Journal' },
  { id: 'f3', category: 'Fees' },
  { id: 'f4', category: 'Core Acts' },
  { id: 'f5', category: 'Identification' },
];

const dailyQuestions = [
  { id: 'q1', category: 'Identification' },
  { id: 'q2', category: 'Fees' },
  { id: 'q3', category: 'Identification' },
  { id: 'q4', category: 'Commission Basics' },
  { id: 'q5', category: 'Journal' },
  { id: 'q6', category: 'Core Acts' },
];

test('scoreQuiz calculates totals, percentage, missed ids, and category breakdown', () => {
  const answers = {
    q1: 1,
    q2: 0,
    q3: 0,
  };

  const result = scoreQuiz(sampleQuestions, answers);

  assert.equal(result.totalQuestions, 3);
  assert.equal(result.answeredCount, 3);
  assert.equal(result.correctCount, 2);
  assert.equal(result.incorrectCount, 1);
  assert.equal(result.percentage, 67);
  assert.deepEqual(result.missedQuestionIds, ['q2']);
  assert.deepEqual(result.byCategory, [
    { category: 'Fees', total: 1, correct: 0, incorrect: 1, percentage: 0 },
    { category: 'Identification', total: 2, correct: 2, incorrect: 0, percentage: 100 },
  ]);
});

test('scoreQuiz treats unanswered questions as unanswered, not incorrect', () => {
  const result = scoreQuiz(sampleQuestions, { q1: 1 });

  assert.equal(result.answeredCount, 1);
  assert.equal(result.correctCount, 1);
  assert.equal(result.incorrectCount, 0);
  assert.equal(result.unansweredCount, 2);
  assert.equal(result.percentage, 33);
  assert.deepEqual(result.missedQuestionIds, []);
});

test('buildFlashcardProgress summarizes studied cards by category', () => {
  const flashcards = [
    { id: 'f1', category: 'Identification' },
    { id: 'f2', category: 'Identification' },
    { id: 'f3', category: 'Journal' },
  ];

  const progress = buildFlashcardProgress(flashcards, new Set(['f1', 'f3']));

  assert.deepEqual(progress, [
    { category: 'Identification', total: 2, completed: 1, remaining: 1, percentage: 50 },
    { category: 'Journal', total: 1, completed: 1, remaining: 0, percentage: 100 },
  ]);
});

test('generateDailyStudySet deterministically rotates through flashcards and questions for a date', () => {
  const result = generateDailyStudySet(sampleFlashcards, dailyQuestions, '2026-04-17', {
    flashcardCount: 2,
    questionCount: 3,
  });

  assert.deepEqual(result.flashcardIds, ['f2', 'f3']);
  assert.deepEqual(result.questionIds, ['q5', 'q6', 'q1']);
  assert.deepEqual(result.focusCategories, ['Journal', 'Core Acts', 'Fees', 'Identification']);
  assert.equal(result.dateKey, '2026-04-17');
});

test('buildTimedExamSummary combines quiz scoring with timer metadata', () => {
  const summary = buildTimedExamSummary(sampleQuestions, { q1: 1, q2: 2 }, {
    allottedSeconds: 600,
    elapsedSeconds: 125,
    completionReason: 'submitted',
  });

  assert.equal(summary.result.correctCount, 2);
  assert.equal(summary.result.unansweredCount, 1);
  assert.equal(summary.elapsedSeconds, 125);
  assert.equal(summary.timeRemainingSeconds, 475);
  assert.equal(summary.expired, false);
  assert.equal(summary.finishedEarly, true);
  assert.equal(summary.completionReason, 'submitted');
});

test('buildTimedExamSummary caps used time at the limit when time expires', () => {
  const summary = buildTimedExamSummary(sampleQuestions, { q1: 0 }, {
    allottedSeconds: 60,
    elapsedSeconds: 83,
    completionReason: 'time-expired',
  });

  assert.equal(summary.elapsedSeconds, 60);
  assert.equal(summary.timeRemainingSeconds, 0);
  assert.equal(summary.expired, true);
  assert.equal(summary.finishedEarly, false);
  assert.equal(summary.completionReason, 'time-expired');
});

test('getAnswerFeedback returns an explicit correct status for right answers', () => {
  const feedback = getAnswerFeedback(sampleQuestions[0], 1);

  assert.deepEqual(feedback, {
    isCorrect: true,
    status: 'correct',
    label: 'Correct',
    detail: 'Correct — Personal appearance and oath',
  });
});

test('getAnswerFeedback returns an explicit incorrect status and the correct option', () => {
  const feedback = getAnswerFeedback(sampleQuestions[1], 0);

  assert.deepEqual(feedback, {
    isCorrect: false,
    status: 'incorrect',
    label: 'Incorrect',
    detail: 'Incorrect — Correct answer: $15',
  });
});

test('buildExamOutcome marks a result as pass when it meets the configured target', () => {
  const quizResult = scoreQuiz(sampleQuestions, { q1: 1, q2: 2, q3: 0 });
  const outcome = buildExamOutcome(quizResult, { passingPercentage: 70, label: 'Mock Exam' });

  assert.deepEqual(outcome, {
    label: 'Mock Exam',
    passingPercentage: 70,
    passed: true,
    status: 'pass',
    headline: 'Pass',
    shortfall: 0,
    result: quizResult,
  });
});

test('buildExamOutcome marks a result as fail and reports the shortfall when under target', () => {
  const quizResult = scoreQuiz(sampleQuestions, { q1: 1 });
  const outcome = buildExamOutcome(quizResult, { passingPercentage: 80, label: 'Mock Exam' });

  assert.equal(outcome.passed, false);
  assert.equal(outcome.status, 'fail');
  assert.equal(outcome.headline, 'Needs work');
  assert.equal(outcome.shortfall, 47);
  assert.equal(outcome.passingPercentage, 80);
});

test('selectMissedQuestionsForReview prioritizes repeated misses, then newer misses', () => {
  const history = [
    {
      timestamp: '2026-04-17T01:00:00.000Z',
      result: { missedQuestionIds: ['q2', 'q3'] },
    },
    {
      timestamp: '2026-04-17T02:00:00.000Z',
      result: { missedQuestionIds: ['q2'] },
    },
    {
      timestamp: '2026-04-17T03:00:00.000Z',
      result: { missedQuestionIds: ['q1'] },
    },
  ];

  const reviewSet = selectMissedQuestionsForReview(sampleQuestions, history, { limit: 2 });

  assert.deepEqual(reviewSet.map((item) => item.id), ['q2', 'q1']);
});
