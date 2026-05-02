import test from 'node:test';
import assert from 'node:assert/strict';
import { handbookSource, quizQuestions } from '../src/data/studyData.mjs';

test('study source points to the current 2026 California notary handbook', () => {
  assert.equal(handbookSource.edition, '2026');
  assert.match(handbookSource.title, /2026 California Notary Public Handbook/);
  assert.match(handbookSource.note, /2026 handbook/);
});

test('quiz question bank is deep enough for repeated state-test practice', () => {
  assert.ok(
    quizQuestions.length >= 90,
    `Expected at least 90 quiz questions, found ${quizQuestions.length}`
  );
});

test('quiz question bank keeps unique ids and four answer choices per question', () => {
  const ids = quizQuestions.map((question) => question.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const question of quizQuestions) {
    assert.equal(question.options.length, 4, `${question.id} should have four answer choices`);
    assert.ok(Number.isInteger(question.correctAnswer), `${question.id} should have a numeric correct answer`);
    assert.ok(question.correctAnswer >= 0 && question.correctAnswer < question.options.length, `${question.id} correct answer is out of range`);
    assert.ok(question.explanation.length >= 40, `${question.id} should explain the rule being tested`);
  }
});

test('quiz question bank covers real-exam pressure areas beyond the first mock exam', () => {
  const promptsAndExplanations = quizQuestions
    .map((question) => `${question.prompt} ${question.explanation}`.toLowerCase())
    .join('\n');

  for (const requiredRule of [
    'civil penalty',
    'photograph',
    'county clerk',
    'surrender',
    'willful failure',
    'sequential journal',
    'personally appeared',
  ]) {
    assert.match(promptsAndExplanations, new RegExp(requiredRule), `Missing rule coverage for ${requiredRule}`);
  }
});
