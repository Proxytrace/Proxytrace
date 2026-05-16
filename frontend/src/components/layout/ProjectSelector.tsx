import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import useCurrentProject from '../../hooks/useCurrentProject';
import type { ProjectDto } from '../../api/models';

function projectInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '··';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const COLORS = ['#6b9eaa', '#c9944a', '#8e7cc3', '#5fa37b', '#d97a6c', '#7aa3c9'];

function projectColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
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
  const color = currentProject ? projectColor(currentProject.id) : '#6b9eaa';

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
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-muted shrink-0"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
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
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className="text-accent shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
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
