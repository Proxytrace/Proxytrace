import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { CheckIcon, ChevronUpIcon } from '../icons';
import useCurrentProject from '../../hooks/useCurrentProject';
import type { ProjectDto } from '../../api/models';
import { projectColor } from '../../lib/colors';

function projectInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '··';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProjectSelector({ collapsed }: { collapsed: boolean }) {
  const { projects, currentProject, setCurrentProjectId } = useCurrentProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = currentProject?.name ?? 'No project';
  const memberCount = currentProject?.members.length ?? 0;
  const color = currentProject ? projectColor(currentProject.id) : 'var(--teal)';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-[10px] cursor-pointer rounded-lg p-1 hover:bg-white/[.04] transition-colors ${collapsed ? 'justify-center' : 'justify-start'}`}
      >
        <Avatar
          initials={currentProject ? projectInitials(name) : 'DP'}
          color={color}
          className="w-7 h-7 rounded-md text-xs font-semibold"
        />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-semibold truncate">{name}</div>
              <div className="text-[11px] text-muted">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </div>
            </div>
            <ChevronUpIcon size={12} className="text-muted shrink-0" />
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 bottom-[calc(100%+6px)] z-50 rounded-[12px] border border-subtle bg-card shadow-[var(--shadow-float)] overflow-hidden"
          style={{ minWidth: collapsed ? 220 : undefined }}
        >
          <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
            Switch project
          </div>
          <ul className="max-h-[260px] overflow-y-auto py-1">
            {projects.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-muted">No projects</li>
            )}
            {projects.map((p) => {
              const active = p.id === currentProject?.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentProjectId(p.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-[10px] px-3 py-2 text-left text-[12.5px] hover:bg-white/[.04] transition-colors ${active ? 'bg-white/[.03]' : ''}`}
                  >
                    <Avatar
                      initials={projectInitials(p.name)}
                      color={projectColor(p.id)}
                      className="w-6 h-6 rounded-md text-[10px] font-semibold"
                    />
                    <span className="flex-1 min-w-0 truncate">{p.name}</span>
                    {active && (
                      <CheckIcon size={14} strokeWidth={2.5} className="text-accent shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-hairline">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/settings');
              }}
              className="w-full text-left px-3 py-2 text-[12px] font-medium text-secondary hover:bg-white/[.04] transition-colors"
            >
              Manage projects…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ProjectDto };
