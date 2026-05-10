import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import type { AgentDto } from '../../../api/models';
import { formInputCls } from '../../../components/ui/FormField';

interface Props {
  projectId: string;
  selectedAgentId: string | null;
  onPick: (agent: AgentDto) => void;
}

export function AgentPicker({ projectId, selectedAgentId, onPick }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['agents', projectId],
    queryFn: () => agentsApi.list({ projectId, pageSize: 200 }),
  });

  const agents = data?.items ?? [];

  return (
    <div className="flex flex-col gap-[5px]">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">Agent</label>
      <select
        className={formInputCls}
        value={selectedAgentId ?? ''}
        disabled={isLoading}
        onChange={e => {
          const next = agents.find(a => a.id === e.target.value);
          if (next) onPick(next);
        }}
      >
        <option value="" disabled>{isLoading ? 'Loading…' : 'Pick an agent'}</option>
        {agents.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  );
}
