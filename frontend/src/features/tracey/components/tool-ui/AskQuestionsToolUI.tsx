import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { EditIcon } from '../../../../components/icons';
import { Button } from '../../../../components/ui/Button';
import { RowButton } from '../../../../components/ui/RowButton';
import { Textarea } from '../../../../components/ui/Textarea';
import { cn } from '../../../../lib/cn';
import { ToolUIFrame } from './ToolUIFrame';
import {
  FREE_TEXT_LABEL,
  type Answer,
  type AskQuestionsResult,
  type QuestionSpec,
  answerDisplay,
  buildAnswersResult,
  isAnswered,
  pickOption,
} from './ask-questions-logic';

interface AskQuestionsArgs {
  questions?: QuestionSpec[];
}

const DIGIT = /^[1-9]$/;

interface OptionRowProps {
  badge: ReactNode;
  label: string;
  muted?: boolean;
  selected: boolean;
  multiple: boolean;
  last: boolean;
  onSelect: () => void;
  testId: string;
}

/**
 * One option in the list: a leading numbered (or pencil) badge, the label, a hairline divider,
 * and a full-row highlight + ↵ hint when selected. Reads as a sectioned picker, not buttons.
 */
function OptionRow({ badge, label, muted, selected, multiple, last, onSelect, testId }: OptionRowProps) {
  return (
    <RowButton
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onSelect}
      data-testid={testId}
      className={cn(
        'flex items-center gap-3 rounded-md px-2.5 py-2.5',
        'transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
        !last && 'rounded-b-none',
        selected ? 'bg-card-2' : 'hover:bg-[var(--bg-wash-hover)]',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-body-sm font-medium',
          selected ? 'bg-surface text-primary' : 'bg-card-2 text-muted',
        )}
      >
        {badge}
      </span>
      <span
        className={cn(
          'flex-1 truncate text-title',
          selected ? 'text-primary' : muted ? 'text-muted' : 'text-secondary',
        )}
      >
        {label}
      </span>
      {selected && <span aria-hidden className="shrink-0 pr-1 text-body-sm text-muted">↵</span>}
    </RowButton>
  );
}

/**
 * Inline renderer for the `ask_questions` tool: a sectioned picker that walks the user through
 * one question at a time (numbered options plus a static free-text row, single- or multi-select).
 * It is a human-in-the-loop tool with no `execute`: the answers are handed back via `addResult`,
 * which resolves the paused tool call so the model continues the same turn (no extra user
 * message). Once resolved it collapses into a read-only Q&A summary driven by the tool result.
 */
export const AskQuestionsToolUI: ToolCallMessagePartComponent = ({ args, result, addResult }) => {
  const { t, i18n } = useLingui();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const { questions } = args as AskQuestionsArgs;
  const submitted = result as AskQuestionsResult | undefined;
  const done = submitted != null;

  if (!questions || questions.length === 0) {
    return <ToolUIFrame state="pending" pendingLabel={t`Preparing questions…`} testId="tracey-questions" />;
  }

  const total = questions.length;
  const current = questions[step];
  const currentAnswer = answers[current.id];
  const isLast = step === total - 1;
  // Single-select picks commit immediately; multi-select and free text need an explicit confirm.
  const needsConfirm = (current.multiple ?? false) || currentAnswer?.mode === 'free';

  const goNext = (updated: Record<string, Answer>) => {
    setAnswers(updated);
    if (!isAnswered(updated[current.id])) return;
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    // Resolve the paused tool call with the answers; the runtime continues the assistant turn.
    addResult(buildAnswersResult(questions, updated));
  };

  const choose = (value: string) => {
    if (current.multiple) {
      setAnswers((prev) => ({ ...prev, [current.id]: pickOption(current, prev[current.id], value) }));
      return;
    }
    goNext({ ...answers, [current.id]: { mode: 'options', values: [value] } });
  };

  const selectFreeTextRow = () => {
    setAnswers((prev) => {
      const existing = prev[current.id];
      const text = existing?.mode === 'free' ? existing.text : '';
      return { ...prev, [current.id]: { mode: 'free', text } };
    });
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!DIGIT.test(e.key)) return;
    const index = Number(e.key) - 1;
    const option = current.options?.[index];
    if (!option) return;
    e.preventDefault();
    choose(option.value);
  };

  // Answered questions above the active step, or every question once the result is in.
  const summary = submitted
    ? submitted.answers.map((a) => ({ key: a.id, question: a.question, answer: a.answerLabel }))
    : questions.slice(0, step).map((q) => ({
        key: q.id,
        question: q.question,
        answer: answerDisplay(q, answers[q.id]),
      }));

  return (
    <ToolUIFrame state="ready" testId="tracey-questions">
      <div className="flex flex-col gap-3">
        {summary.map((item) => (
          <div key={item.key} className="border-l-2 border-border pl-2.5" data-testid={`tracey-answer-${item.key}`}>
            <div className="text-body-sm text-muted">{item.question}</div>
            <div className="text-body-sm font-medium text-primary">{item.answer}</div>
          </div>
        ))}

        {!done && (
          <div className={cn('flex flex-col gap-3', step > 0 && 'border-t border-border-subtle pt-3')}>
            <div className="flex flex-col gap-0.5">
              {total > 1 && (
                <div className="text-caption font-medium uppercase tracking-wide text-muted">
                  <Trans>Step {step + 1} of {total}</Trans>
                </div>
              )}
              <div className="text-h2 font-semibold text-primary">{current.question}</div>
              {current.multiple && <div className="text-body-sm text-muted"><Trans>Select all that apply.</Trans></div>}
            </div>

            <div
              role={current.multiple ? 'group' : 'radiogroup'}
              aria-label={current.question}
              onKeyDown={onListKeyDown}
              className="flex flex-col divide-y divide-border-subtle"
            >
              {current.options?.map((option, i) => {
                const selected =
                  currentAnswer?.mode === 'options' && currentAnswer.values.includes(option.value);
                return (
                  <OptionRow
                    key={option.value}
                    badge={i + 1}
                    label={option.label}
                    selected={selected}
                    multiple={current.multiple ?? false}
                    last={false}
                    onSelect={() => choose(option.value)}
                    testId={`tracey-question-option-${option.value}`}
                  />
                );
              })}

              <OptionRow
                badge={<EditIcon size={13} />}
                label={i18n._(FREE_TEXT_LABEL)}
                muted
                selected={currentAnswer?.mode === 'free'}
                multiple={current.multiple ?? false}
                last
                onSelect={selectFreeTextRow}
                testId="tracey-question-freetext-toggle"
              />
            </div>

            {currentAnswer?.mode === 'free' && (
              <Textarea
                rows={3}
                autoFocus
                value={currentAnswer.text}
                placeholder={t`Type your answer…`}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [current.id]: { mode: 'free', text: e.target.value } }))
                }
                data-testid="tracey-question-freetext-input"
              />
            )}

            {needsConfirm && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!isAnswered(currentAnswer)}
                  onClick={() => goNext(answers)}
                  data-testid="tracey-question-next"
                >
                  {isLast ? t`Submit` : t`Next`}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolUIFrame>
  );
};
