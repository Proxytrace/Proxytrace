import { Trans } from '@lingui/react/macro';
import { tint } from '../../../../lib/colors';
import type { OutputValueDto } from '../../../../api/models';

function outputStr(val: OutputValueDto): string {
  if (val.kind === 'message') return val.content ?? '';
  if (val.kind === 'tool_call') return JSON.stringify({ tool: val.name, arguments: val.arguments }, null, 2);
  return JSON.stringify(val, null, 2);
}

export function OutputBlock({ label, color, value }: { label: string; color: string; value: OutputValueDto }) {
  const text = outputStr(value);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
        <span className="text-body-sm font-semibold text-secondary">{label}</span>
        {value.kind === 'tool_call' && (
          <span className="mono px-[5px] py-px rounded-sm text-caption bg-accent-subtle text-accent">tool_call</span>
        )}
      </div>
      <div
        className="rounded-lg px-3 py-2.5 max-h-[160px] overflow-y-auto mono text-body-sm leading-relaxed text-primary whitespace-pre-wrap break-words bg-black/[0.18] border"
        style={{ borderColor: tint(color, 14) }}
      >
        {text || <span className="text-muted italic"><Trans>(empty)</Trans></span>}
      </div>
    </div>
  );
}
