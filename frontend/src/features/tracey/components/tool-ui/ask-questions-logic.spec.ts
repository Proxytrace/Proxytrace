import { describe, it, expect } from 'vitest';
import {
  type Answer,
  type QuestionSpec,
  answerDisplay,
  answerValue,
  buildAnswersResult,
  isAnswered,
  pickOption,
  selectFreeText,
} from './ask-questions-logic';

const single: QuestionSpec = {
  id: 'q1',
  question: 'Which agent?',
  options: [
    { label: 'Support bot', value: 'support' },
    { label: 'Sales bot', value: 'sales' },
  ],
};
const multi: QuestionSpec = {
  id: 'q2',
  question: 'Which metrics?',
  multiple: true,
  options: [
    { label: 'Cost', value: 'cost' },
    { label: 'Latency', value: 'latency' },
  ],
};

describe('ask-questions answer model', () => {
  it('single-select replaces the previous pick', () => {
    const first = pickOption(single, undefined, 'support');
    expect(first).toEqual({ mode: 'options', values: ['support'] });

    const second = pickOption(single, first, 'sales');
    expect(second).toEqual({ mode: 'options', values: ['sales'] });
  });

  it('multi-select toggles options on and off', () => {
    let a = pickOption(multi, undefined, 'cost');
    a = pickOption(multi, a, 'latency');
    expect(a).toEqual({ mode: 'options', values: ['cost', 'latency'] });

    a = pickOption(multi, a, 'cost');
    expect(a).toEqual({ mode: 'options', values: ['latency'] });
  });

  it('selecting free text is exclusive with option picks', () => {
    const picked = pickOption(single, undefined, 'support');
    const free = selectFreeText(picked);
    expect(free).toEqual({ mode: 'free', text: '' });
  });

  it('switching back to an option clears any free text', () => {
    const free: Answer = { mode: 'free', text: 'something custom' };
    const back = pickOption(single, free, 'sales');
    expect(back).toEqual({ mode: 'options', values: ['sales'] });
  });

  it('selectFreeText preserves text already typed', () => {
    const free: Answer = { mode: 'free', text: 'keep me' };
    expect(selectFreeText(free)).toEqual({ mode: 'free', text: 'keep me' });
  });
});

describe('ask-questions validity', () => {
  it('is unanswered until an option is picked or non-blank text typed', () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered({ mode: 'options', values: [] })).toBe(false);
    expect(isAnswered({ mode: 'free', text: '   ' })).toBe(false);
    expect(isAnswered({ mode: 'options', values: ['support'] })).toBe(true);
    expect(isAnswered({ mode: 'free', text: 'hi' })).toBe(true);
  });
});

describe('ask-questions rendering of answers', () => {
  it('shows option labels in the summary but sends values back', () => {
    const a: Answer = { mode: 'options', values: ['cost', 'latency'] };
    expect(answerDisplay(multi, a)).toBe('Cost, Latency');
    expect(answerValue(a)).toBe('cost, latency');
  });

  it('trims free text for both display and value', () => {
    const a: Answer = { mode: 'free', text: '  custom answer  ' };
    expect(answerDisplay(single, a)).toBe('custom answer');
    expect(answerValue(a)).toBe('custom answer');
  });

  it('builds a structured result carrying every question, its value and its label', () => {
    const answers: Record<string, Answer> = {
      q1: { mode: 'options', values: ['support'] },
      q2: { mode: 'options', values: ['cost', 'latency'] },
    };
    expect(buildAnswersResult([single, multi], answers)).toEqual({
      answers: [
        { id: 'q1', question: 'Which agent?', answer: 'support', answerLabel: 'Support bot' },
        { id: 'q2', question: 'Which metrics?', answer: 'cost, latency', answerLabel: 'Cost, Latency' },
      ],
    });
  });
});
