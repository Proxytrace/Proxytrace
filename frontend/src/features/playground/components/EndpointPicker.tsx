import useModelEndpoints from '../../../hooks/useModelEndpoints';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';

interface Props {
  value: string;
  onChange: (endpointId: string) => void;
  defaultEndpointId?: string;
}

export function EndpointPicker({ value, onChange, defaultEndpointId }: Props) {
  const { data: endpoints = [], isLoading } = useModelEndpoints();

  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-[0.05em]">Endpoint</label>
        {defaultEndpointId && value !== defaultEndpointId && (
          <Button variant="link" className="text-[10.5px]" onClick={() => onChange(defaultEndpointId)}>
            Reset
          </Button>
        )}
      </div>
      <Select value={value} disabled={isLoading} onValueChange={onChange}>
        {endpoints.map(ep => (
          <option key={ep.id} value={ep.id}>
            {ep.providerName} · {ep.modelName}
          </option>
        ))}
      </Select>
    </div>
  );
}
