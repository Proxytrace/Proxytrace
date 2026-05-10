import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../../../api/providers';
import { formInputCls } from '../../../components/ui/FormField';

interface Props {
  value: string;
  onChange: (endpointId: string) => void;
  defaultEndpointId?: string;
}

export function EndpointPicker({ value, onChange, defaultEndpointId }: Props) {
  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ['model-endpoints'],
    queryFn: () => providersApi.getAllModels(),
  });

  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">Endpoint</label>
        {defaultEndpointId && value !== defaultEndpointId && (
          <button
            type="button"
            onClick={() => onChange(defaultEndpointId)}
            className="text-[10.5px] font-semibold text-accent uppercase tracking-[0.05em] cursor-pointer bg-transparent border-0 p-0"
          >
            Reset
          </button>
        )}
      </div>
      <select
        className={formInputCls}
        value={value}
        disabled={isLoading}
        onChange={e => onChange(e.target.value)}
      >
        {endpoints.map(ep => (
          <option key={ep.id} value={ep.id}>
            {ep.providerName} · {ep.modelName}
          </option>
        ))}
      </select>
    </div>
  );
}
