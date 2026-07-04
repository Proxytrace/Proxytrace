import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { ActivityIcon, CheckIcon, ChevronRightIcon, FlaskIcon, ScaleIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import type { DisplayTone } from '../shared';
import { TONE_SUBTLE_BG, TONE_TEXT } from '../shared';
import type { LoopStats, QueueGroupKey } from '../theoryQueue';

interface Props {
  stats: LoopStats;
  /** Jump the queue rail to a group (History also expands it). */
  onJump: (group: QueueGroupKey) => void;
}

interface Segment {
  group: QueueGroupKey;
  count: number;
  icon: React.ReactNode;
  tone: DisplayTone;
  /** Whether the testing node should pulse (an A/B run is live). */
  pulse?: boolean;
}

/**
 * The optimization loop as a left-to-right lifeline: how many theories are being tested, how
 * many proven changes wait for a decision, how many are being watched for adoption, and what
 * the loop has already decided — closing with the total proven gain. Each node jumps the rail
 * to its group.
 */
export function LoopStrip({ stats, onJump }: Props) {
  const { i18n } = useLingui();
  const segments: Segment[] = [
    { group: 'inflight', count: stats.testing, icon: <FlaskIcon size={11} />, tone: 'teal', pulse: stats.testing > 0 },
    { group: 'decision', count: stats.decision, icon: <ScaleIcon size={11} />, tone: 'accent' },
    { group: 'adoption', count: stats.adoption, icon: <ActivityIcon size={11} />, tone: 'success' },
    { group: 'history', count: stats.decided, icon: <CheckIcon size={11} />, tone: 'muted' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5" data-testid="loop-strip">
      {segments.map((segment, i) => (
        <span key={segment.group} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRightIcon size={11} className="text-muted opacity-60" />}
          <LoopNode segment={segment} label={SEGMENT_LABEL[segment.group]} onJump={onJump} />
        </span>
      ))}
      {stats.provenGainPt > 0 && (
        <span className="mono ml-auto inline-flex items-center gap-1.5 pl-2 text-body-sm font-semibold text-success" data-testid="loop-proven-gain">
          +{stats.provenGainPt}<Trans>pt</Trans>
          <span className="font-normal text-muted">
            <Trans>proven</Trans>
            {stats.winRate != null && ` · ${i18n._(SEGMENT_WIN_RATE)} ${stats.winRate}%`}
          </span>
        </span>
      )}
    </div>
  );
}

const SEGMENT_LABEL: Record<QueueGroupKey, MessageDescriptor> = {
  inflight: msg`testing`,
  decision: msg`need decision`,
  adoption: msg`awaiting adoption`,
  history: msg`decided`,
};

const SEGMENT_WIN_RATE = msg`win rate`;

function LoopNode({ segment, label, onJump }: { segment: Segment; label: MessageDescriptor; onJump: (g: QueueGroupKey) => void }) {
  const { i18n } = useLingui();
  const dimmed = segment.count === 0;
  return (
    // eslint-disable-next-line no-restricted-syntax -- bespoke pipeline node; Button variants don't cover the tinted-pill treatment
    <button
      type="button"
      onClick={() => onJump(segment.group)}
      data-testid={`loop-node-${segment.group}`}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-body-sm font-medium transition-colors duration-[var(--motion-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
        dimmed ? 'text-muted hover:bg-card-2' : cn(TONE_SUBTLE_BG[segment.tone], TONE_TEXT[segment.tone], 'hover:brightness-110'),
      )}
    >
      <span className={cn('inline-flex items-center', segment.pulse && !dimmed && 'pulse-dot')}>{segment.icon}</span>
      <span className="mono font-semibold">{segment.count}</span>
      {i18n._(label)}
    </button>
  );
}
