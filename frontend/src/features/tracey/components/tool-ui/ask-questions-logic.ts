/**
 * Pure logic for the `ask_questions` tool UI, kept out of the component so it can be unit
 * tested without a DOM. Covers the per-question answer model, validity, the read-only summary
 * text, and the combined message sent back to the model.
 */

export interface QuestionOption {
  label: string;
  value: string;
}
export interface QuestionSpec {
  id: string;
  question: string;
  multiple?: boolean;
  options?: QuestionOption[];
}

/** A single question's answer: a set of picked option values, or a free-text reply (exclusive). */
export type Answer =
  | { mode: 'options'; values: string[] }
  | { mode: 'free'; text: string };

export const FREE_TEXT_LABEL = 'Something else…';

/** Whether the answer is complete enough to advance (≥1 option, or non-blank free text). */
export function isAnswered(answer: Answer | undefined): boolean {
  if (!answer) return false;
  return answer.mode === 'free' ? answer.text.trim().length > 0 : answer.values.length > 0;
}

/** Toggle (multi-select) or replace (single-select) the picked option for a question. */
export function pickOption(question: QuestionSpec, existing: Answer | undefined, value: string): Answer {
  if (!question.multiple) return { mode: 'options', values: [value] };
  const picked = existing?.mode === 'options' ? existing.values : [];
  const next = picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value];
  return { mode: 'options', values: next };
}

/** Switch the question to free-text mode, preserving any text already typed. */
export function selectFreeText(existing: Answer | undefined): Answer {
  return { mode: 'free', text: existing?.mode === 'free' ? existing.text : '' };
}

/** Human-readable answer for the in-place summary (option labels, or the typed text). */
export function answerDisplay(question: QuestionSpec, answer: Answer): string {
  if (answer.mode === 'free') return answer.text.trim();
  const labelOf = (value: string) =>
    question.options?.find((o) => o.value === value)?.label ?? value;
  return answer.values.map(labelOf).join(', ');
}

/** Machine-facing answer sent back to the model (option values, or the typed text). */
export function answerValue(answer: Answer): string {
  return answer.mode === 'free' ? answer.text.trim() : answer.values.join(', ');
}

/** One answered question, as carried in the tool result fed back to the model. */
export interface AnsweredQuestion {
  id: string;
  question: string;
  /** Machine value(s) for the model: option values joined by ", ", or the typed text. */
  answer: string;
  /** Human-readable answer for the read-only summary: option labels, or the typed text. */
  answerLabel: string;
}

/** Structured result for the `ask_questions` tool call (every question + its answer). */
export interface AskQuestionsResult {
  answers: AnsweredQuestion[];
}

/** Build the tool result the widget hands back via `addResult`, resolving the paused tool call. */
export function buildAnswersResult(
  questions: QuestionSpec[],
  answers: Record<string, Answer>,
): AskQuestionsResult {
  return {
    answers: questions.map((q) => ({
      id: q.id,
      question: q.question,
      answer: answerValue(answers[q.id]),
      answerLabel: answerDisplay(q, answers[q.id]),
    })),
  };
}
