import { useLingui } from '@lingui/react/macro';
import type { MessageDescriptor } from '@lingui/core';
import { ActivityIcon, CheckIcon, ClockIcon, XIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { type FlowState, FLOW_STATE_TONE } from '../decisionFlow';
import { TONE_SUBTLE_BG, TONE_TEXT } from '../shared';

interface Props {
  title: string;
  statusLabel: MessageDescriptor;
  state: FlowState;
  isLast: boolean;
  children: React.ReactNode;
}

const STATE_ICON: Record<FlowState, React.ReactNode> = {
  complete: <CheckIcon size={12} />,
  current: <ActivityIcon size={12} />,
  pending: <ClockIcon size={12} />,
  rejected: <XIcon size={12} />,
};

/** One node of the decision-flow timeline: a status dot + connector rail, a header, and a body. */
export function FlowStep({ title, statusLabel, state, isLast, children }: Props) {
  const { i18n } = useLingui();
  const tone = FLOW_STATE_TONE[state];
  const dimmed = state === 'pending';

  return (
    <li className={cn('flex gap-3', dimmed && 'opacity-55')} data-testid={`flow-step-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex flex-col items-center">
        <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full', TONE_SUBTLE_BG[tone], TONE_TEXT[tone], state === 'current' && 'pulse-dot')}>
          {STATE_ICON[state]}
        </span>
        {!isLast && <span className="w-px flex-1 my-1 bg-border" />}
      </div>

      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-h2 font-semibold leading-tight text-primary m-0">{title}</h3>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold', TONE_SUBTLE_BG[tone], TONE_TEXT[tone])}>
            {i18n._(statusLabel)}
          </span>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );
}
