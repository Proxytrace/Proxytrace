import { useState } from 'react';
import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CheckIcon, TargetIcon } from '../../../../components/icons';
import { Button } from '../../../../components/ui/Button';
import { useTraceyActions } from '../../tracey-actions';
import { ToolUIFrame } from './ToolUIFrame';

interface ChoiceOption {
  label: string;
  value: string;
}
interface ActionPromptArgs {
  question?: string;
  options?: ChoiceOption[];
}

/** Inline renderer for the `present_choices` tool: buttons whose pick becomes the next turn. */
export const ActionPromptToolUI: ToolCallMessagePartComponent = ({ args }) => {
  const { sendUserMessage } = useTraceyActions();
  const [picked, setPicked] = useState<string | null>(null);
  const { question, options } = args as ActionPromptArgs;

  if (!question || !options || options.length === 0) {
    return <ToolUIFrame state="pending" pendingLabel="Preparing options…" testId="tracey-choices" />;
  }

  const choose = (option: ChoiceOption) => {
    if (picked) return;
    setPicked(option.label);
    sendUserMessage(option.value);
  };

  return (
    <ToolUIFrame state="ready" title={question} icon={<TargetIcon size={14} />} testId="tracey-choices">
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isPicked = picked === option.label;
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={isPicked ? 'primary' : 'secondary'}
              disabled={picked !== null}
              onClick={() => choose(option)}
              data-testid={`tracey-choice-${option.value}`}
            >
              {isPicked && <CheckIcon size={13} className="-ml-0.5 mr-1" />}
              {option.label}
            </Button>
          );
        })}
      </div>
    </ToolUIFrame>
  );
};
