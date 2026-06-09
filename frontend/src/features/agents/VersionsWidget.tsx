import { useState } from 'react';
import type { AgentDto, AgentVersionDto } from '../../api/models';
import { agentColor } from '../../lib/colors';
import { fmtDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Button } from '../../components/ui/Button';
import { Widget } from './widgets/Widget';
import { MoveVersionDialog } from './widgets/MoveVersionDialog';
import { useAgentVersions } from './hooks/useAgentVersions';

interface Props {
  agent: AgentDto;
  selectedVersion?: number;
  onSelect?: (versionNumber: number) => void;
  className?: string;
}

export function VersionsWidget({ agent, selectedVersion, onSelect, className }: Props) {
  const { versions, latestVersion, isLoading } = useAgentVersions(agent.id);
  const [moving, setMoving] = useState<AgentVersionDto | null>(null);
  const c = agentColor(agent.id);

  const ordered = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <Widget
      title="Version history"
      right={versions.length > 0 && <span className="text-body-sm text-muted">{versions.length}</span>}
      className={className}
      bodyClassName="p-4"
    >
      {isLoading && <p className="text-body-sm text-muted">Loading…</p>}
      {!isLoading && versions.length === 0 && <p className="text-body-sm text-muted">No versions yet.</p>}
      {!isLoading && ordered.length > 0 && (
        <ul
          className="flex flex-col gap-0.5 max-h-[17rem] overflow-y-auto pr-1.5"
          data-testid="agent-versions-list"
        >
          {ordered.map((v, i) => {
            const isCurrent = v.versionNumber === latestVersion;
            const isSelected = v.versionNumber === selectedVersion;
            const isLast = i === ordered.length - 1;
            return (
              <li
                key={v.id}
                data-testid={`agent-version-row-${v.versionNumber}`}
                className="relative pl-6"
              >
                {!isLast && <span className="absolute left-[5px] top-[21px] -bottom-0.5 border-l border-hairline" />}
                <span
                  className="absolute left-0 top-[10px] w-[11px] h-[11px] rounded-full border-2 bg-card"
                  style={isCurrent ? { background: c, borderColor: c } : { borderColor: 'var(--border)' }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => onSelect?.(v.versionNumber)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(v.versionNumber);
                    }
                  }}
                  data-testid={`agent-version-select-${v.versionNumber}`}
                  className={cn(
                    'px-2.5 py-2 rounded-md cursor-pointer transition-colors duration-100',
                    !isSelected && 'hover:bg-[var(--bg-wash-hover)]',
                  )}
                  style={
                    isSelected
                      ? { background: `color-mix(in srgb, ${c} 13%, transparent)`, boxShadow: `inset 2px 0 0 ${c}` }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="font-mono text-title font-bold shrink-0"
                      style={isCurrent || isSelected ? { color: c } : undefined}
                    >
                      v{v.versionNumber}
                    </span>
                    {isCurrent && (
                      <span
                        className="px-1.5 py-px rounded-sm text-caption font-bold shrink-0"
                        style={{ background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c }}
                      >
                        current
                      </span>
                    )}
                    {isSelected && !isCurrent && (
                      <span
                        className="px-1.5 py-px rounded-sm text-caption font-bold shrink-0"
                        style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
                      >
                        viewing
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-caption text-muted">{fmtDate(v.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-caption text-muted">
                    <span>{v.tools.length} tool{v.tools.length === 1 ? '' : 's'}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-muted"
                      onClick={e => {
                        e.stopPropagation();
                        setMoving(v);
                      }}
                      data-testid={`agent-version-move-btn-${v.versionNumber}`}
                    >
                      Move…
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {moving && <MoveVersionDialog version={moving} sourceAgent={agent} onClose={() => setMoving(null)} />}
    </Widget>
  );
}
