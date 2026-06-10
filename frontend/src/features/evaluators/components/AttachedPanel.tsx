import { CheckboxIcon, ExternalLinkIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';

export interface AttachedSuite {
  id: string;
  name: string;
  agentId: string;
  agentName: string;
}

export interface AttachedAgent {
  id: string;
  name: string;
}

interface Props {
  suites: AttachedSuite[];
  agents: AttachedAgent[];
  onOpenSuite: (id: string) => void;
  onOpenAgent: (id: string) => void;
}

/** Two-column card listing the suites and agents this evaluator is attached to. Each row links out. */
export function AttachedPanel({ suites, agents, onOpenSuite, onOpenAgent }: Props) {
  return (
    <section data-testid="evaluator-attached-panel" className="bg-card rounded-lg shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Attached to</span>
        <span className="text-[11px] text-muted">
          {suites.length} suite{suites.length !== 1 ? 's' : ''} · {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-[18px] px-4 py-3.5">
        <div>
          <div className="text-[10px] text-muted uppercase tracking-[0.07em] font-semibold mb-2">Test suites</div>
          {suites.length ? (
            <div className="flex flex-col gap-[5px]">
              {suites.map(s => (
                <RowButton
                  key={s.id}
                  onClick={() => onOpenSuite(s.id)}
                  data-testid={`evaluator-attached-suite-${s.id}`}
                  title={`Open suite "${s.name}"`}
                  className="group flex items-center gap-2 px-2.5 py-[7px] bg-card-2 rounded-md text-[12px] text-secondary transition-colors hover:bg-card-2 hover:text-primary"
                >
                  <CheckboxIcon size={11} />
                  <span className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">{s.name}</span>
                  <ExternalLinkIcon size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </RowButton>
              ))}
            </div>
          ) : <span className="text-[11px] text-muted">Not attached to any suite yet.</span>}
        </div>
        <div>
          <div className="text-[10px] text-muted uppercase tracking-[0.07em] font-semibold mb-2">Agents</div>
          {agents.length ? (
            <div className="flex flex-col gap-[5px]">
              {agents.map(a => (
                <RowButton
                  key={a.id}
                  onClick={() => onOpenAgent(a.id)}
                  data-testid={`evaluator-attached-agent-${a.id}`}
                  title={`Open agent "${a.name}"`}
                  className="group flex items-center gap-2 px-2.5 py-[7px] bg-card-2 rounded-md text-[12px] text-secondary transition-colors hover:bg-card-2 hover:text-primary"
                >
                  <span className="w-[18px] h-[18px] rounded-[5px] bg-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)] text-accent text-[10px] font-bold inline-flex items-center justify-center font-mono">
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">{a.name}</span>
                  <ExternalLinkIcon size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </RowButton>
              ))}
            </div>
          ) : <span className="text-[11px] text-muted">Not used by any agent yet.</span>}
        </div>
      </div>
    </section>
  );
}
