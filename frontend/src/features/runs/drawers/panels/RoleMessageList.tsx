import type { TestCaseMessageFixtureDto } from '../../../../api/models';
import { ROLE_COLOR } from './constants';

/** Renders fixture input messages (shared by both drawers). */
export function RoleMessageList({ messages }: { messages: TestCaseMessageFixtureDto[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {messages.map((m, i) => {
        const roleColor = ROLE_COLOR[m.role.toLowerCase()] ?? 'var(--text-muted)';
        return (
          <div
            key={`${m.role}-${i}`}
            className="grid grid-cols-[72px_1fr] gap-2.5 px-3 py-2.5 rounded-lg bg-card-2 border-l-[3px]"
            style={{ borderLeftColor: roleColor }}
          >
            <span className="text-body-sm font-semibold pt-px" style={{ color: roleColor }}>{m.role}</span>
            <span className="mono text-body-sm leading-relaxed text-primary whitespace-pre-wrap break-words">{m.content}</span>
          </div>
        );
      })}
    </div>
  );
}
