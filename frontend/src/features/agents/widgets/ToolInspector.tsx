import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import type { ToolSpecDto } from '../../../api/models';
import { ChevronRightIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';

// Syntax-highlight palette for JSON-Schema type tags (intentional, not brand colors).
const TYPE_COLORS: Record<string, string> = {
  string: 'var(--teal)', integer: 'var(--warn)', number: 'var(--warn)',
  boolean: 'var(--danger)', enum: 'var(--success)', object: 'var(--accent-hover)', array: 'var(--success)',
};

function requiredParams(tool: ToolSpecDto): string {
  const req = tool.arguments.filter(a => a.isRequired).map(a => a.name);
  return req.length ? `(${req.join(', ')})` : '()';
}

interface Props {
  tool: ToolSpecDto;
  defaultOpen?: boolean;
  last?: boolean;
}

export function ToolInspector({ tool, defaultOpen = false, last = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={last ? '' : 'border-b border-hairline'} data-testid={`tool-row-${tool.name}`}>
      <RowButton
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--bg-wash-hover)] transition-colors duration-100"
      >
        <ChevronRightIcon
          size={12}
          className={`text-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="font-mono text-title font-bold text-success shrink-0">{tool.name}</span>
        <span className="font-mono text-body-sm text-muted shrink-0">{requiredParams(tool)}</span>
        {tool.description && (
          <span className="ml-auto text-body-sm text-muted truncate max-w-[320px]">{tool.description}</span>
        )}
      </RowButton>

      {open && (
        <div className="px-4 pb-3.5 pl-9.5 flex flex-col gap-3">
          {tool.description && (
            <div className="text-body text-secondary leading-relaxed px-3 py-2 rounded-md bg-success-subtle border-l-2 border-success/40">
              {tool.description}
            </div>
          )}
          {tool.arguments.length > 0 ? (
            <>
              <div className="text-caption font-semibold text-secondary tracking-[0.07em] uppercase"><Trans>Parameters</Trans></div>
              <div className="rounded-md bg-surface overflow-hidden">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.4fr_2.5fr] px-3 py-1.5 text-caption font-bold text-secondary tracking-[0.07em] uppercase border-b border-hairline">
                  <span><Trans>Name</Trans></span><span><Trans>Type</Trans></span><span><Trans>Req</Trans></span><span><Trans>Description</Trans></span>
                </div>
                {tool.arguments.map((p, i) => (
                  <div
                    key={p.name}
                    className={`grid grid-cols-[1.2fr_0.8fr_0.4fr_2.5fr] px-3 py-2 items-start ${i < tool.arguments.length - 1 ? 'border-b border-hairline' : ''}`}
                  >
                    <span className="font-mono text-body font-semibold text-teal">{p.name}</span>
                    <div>
                      <span
                        className="font-mono text-caption font-semibold px-1.5 py-0.5 rounded-sm"
                        style={{
                          background: `color-mix(in srgb, ${TYPE_COLORS[p.type] ?? 'var(--text-muted)'} 13%, transparent)`,
                          color: TYPE_COLORS[p.type] ?? 'var(--text-muted)',
                        }}
                      >
                        {p.type}
                      </span>
                      {p.enumValues?.length ? (
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {p.enumValues.map(v => (
                            <span key={v} className="font-mono text-caption px-1.5 py-0.5 rounded-sm bg-success-subtle text-success">{v}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className={`text-body font-bold ${p.isRequired ? 'text-danger' : 'text-muted'}`}>{p.isRequired ? '✓' : '—'}</span>
                    <span className="text-body text-secondary leading-snug">{p.description ?? '—'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-body text-muted italic"><Trans>No parameters</Trans></div>
          )}
        </div>
      )}
    </div>
  );
}
