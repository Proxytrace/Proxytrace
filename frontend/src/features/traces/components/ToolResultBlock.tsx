import { Collapsible } from '../../../components/ui/Collapsible';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import type { MessageDto } from '../../../api/models';

interface Props {
  msg: MessageDto;
}

export function ToolResultBlock({ msg }: Props) {
  let parsed: unknown = msg.content;
  try { parsed = JSON.parse(msg.content); } catch { /* leave as string */ }
  const sizeB = msg.content?.length ?? 0;

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        background: 'color-mix(in srgb, var(--teal) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--teal) 28%, transparent)',
      }}
    >
      <Collapsible
        defaultOpen
        headerClassName="px-3 py-[9px] text-body-sm font-mono"
        contentClassName="px-[14px] pt-[10px] pb-3 pl-[34px] font-mono text-body-sm leading-[1.55]"
        title={
          <span className="flex items-center gap-2 flex-1 text-secondary">
            <span className="font-bold tracking-[0.04em]" style={{ color: 'var(--teal)' }}>RESULT</span>
            <span className="font-semibold text-primary">{msg.toolCallId?.slice(0, 12) ?? '—'}</span>
            <span className="ml-auto text-caption font-mono text-muted">{sizeB} B</span>
          </span>
        }
      >
        <div style={{ borderTop: '1px dashed color-mix(in srgb, var(--teal) 22%, transparent)' }}>
          <div className="mt-[10px]">
            <JsonBlock value={parsed} hideCopy transparent className="!px-0 !py-0" />
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
