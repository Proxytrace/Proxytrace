import { CheckboxIcon, ArrowUpRightIcon } from '../../../components/icons';

export interface AttachedSuite {
  id: string;
  name: string;
  agentName: string;
}

interface Props {
  suites: AttachedSuite[];
  agentNames: string[];
}

/** Two-column card listing the suites and agents this evaluator is attached to. */
export function AttachedPanel({ suites, agentNames }: Props) {
  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Attached to</span>
        <span className="text-[11px] text-muted">
          {suites.length} suite{suites.length !== 1 ? 's' : ''} · {agentNames.length} agent{agentNames.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-[18px] px-4 py-3.5">
        <div>
          <div className="text-[10px] text-muted uppercase tracking-[0.07em] font-semibold mb-2">Test suites</div>
          {suites.length ? (
            <div className="flex flex-col gap-[5px]">
              {suites.map(s => (
                <div key={s.id} className="flex items-center gap-2 px-2.5 py-[7px] bg-card-2 rounded-md text-[12px] text-secondary">
                  <CheckboxIcon size={11} />
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{s.name}</span>
                  <ArrowUpRightIcon size={10} />
                </div>
              ))}
            </div>
          ) : <span className="text-[11px] text-muted">Not attached to any suite yet.</span>}
        </div>
        <div>
          <div className="text-[10px] text-muted uppercase tracking-[0.07em] font-semibold mb-2">Agents</div>
          {agentNames.length ? (
            <div className="flex flex-col gap-[5px]">
              {agentNames.map(a => (
                <div key={a} className="flex items-center gap-2 px-2.5 py-[7px] bg-card-2 rounded-md text-[12px] text-secondary">
                  <span className="w-[18px] h-[18px] rounded-[5px] bg-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)] text-accent text-[10px] font-bold inline-flex items-center justify-center font-mono">
                    {a.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{a}</span>
                  <ArrowUpRightIcon size={10} />
                </div>
              ))}
            </div>
          ) : <span className="text-[11px] text-muted">Not used by any agent yet.</span>}
        </div>
      </div>
    </section>
  );
}
