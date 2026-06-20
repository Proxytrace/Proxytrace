import { Trans, useLingui } from '@lingui/react/macro';
import { Collapsible } from '../ui/Collapsible';
import { JsonBlock } from '../ui/JsonBlock';
import { CopyButton } from '../ui/CopyButton';
import { hoverRevealOverlayCls } from '../ui/classes';
import { cn } from '../../lib/cn';

interface Props {
  /** Raw tool-result payload (JSON or plain text) and the call id it answers. */
  content: string;
  toolCallId?: string | null;
}

export function ToolResultBlock({ content, toolCallId }: Props) {
  const { t } = useLingui();
  let parsed: unknown = content;
  try { parsed = JSON.parse(content); } catch { /* leave as string */ }
  const sizeB = content?.length ?? 0;

  return (
    <div className="relative group rounded-md overflow-hidden bg-[color-mix(in_srgb,var(--teal)_8%,transparent)] border border-[color-mix(in_srgb,var(--teal)_28%,transparent)]">
      <CopyButton text={content} label={t`Copy result`} className={hoverRevealOverlayCls} />
      <Collapsible
        headerClassName={cn('pl-3 pr-9 py-[9px] text-body-sm font-mono')}
        contentClassName={cn('px-[14px] pt-[10px] pb-3 pl-[34px] font-mono text-body-sm leading-[1.55]')}
        title={
          <span className="flex items-center gap-2 flex-1 text-secondary">
            <span className="font-bold tracking-[0.04em] text-teal"><Trans>RESULT</Trans></span>
            <span className="font-semibold text-primary">{toolCallId?.slice(0, 12) ?? '—'}</span>
            <span className="ml-auto text-caption font-mono text-muted"><Trans>{sizeB} B</Trans></span>
          </span>
        }
      >
        <div className="border-t border-dashed border-t-[color-mix(in_srgb,var(--teal)_22%,transparent)]">
          <div className="mt-[10px]">
            <JsonBlock value={parsed} hideCopy transparent className="!px-0 !py-0" />
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
