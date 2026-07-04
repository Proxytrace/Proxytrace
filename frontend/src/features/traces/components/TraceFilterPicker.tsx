import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Popover } from '../../../components/ui/Popover';
import { RowButton } from '../../../components/ui/RowButton';
import { PlusIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AgentListItemDto } from '../../../api/models';
import type { TraceAdvancedFilters } from '../tracesMeta';
import { TRACE_FILTER_FIELDS, type TraceFilterFieldKey } from '../traceFilterFields';
import { useTraceFilterEditors } from '../hooks/useTraceFilterEditors';
import { FilterValueEditor } from './FilterValueEditor';

interface Props {
  agents: AgentListItemDto[];
  filters: TraceAdvancedFilters;
  onChange: (patch: Partial<TraceAdvancedFilters>) => void;
  showSystem: boolean;
  onShowSystemChange: (value: boolean) => void;
}

/**
 * The "+ Filter" picker that sits inline on the traces toolbar (beside search + time). Two panels:
 * the field list (each value filter drills into an editor from {@link FilterValueEditor}) and,
 * separated by a hairline, the **System traces** view-scope toggle — a boolean, so it flips
 * directly instead of opening an editor. Active filters surface as chips in {@link TraceFilterBar}.
 */
export function TraceFilterPicker({ agents, filters, onChange, showSystem, onShowSystemChange }: Props) {
  const { i18n } = useLingui();
  const { editorSpec } = useTraceFilterEditors(agents, filters);
  const [open, setOpen] = useState(false);
  const [pickerField, setPickerField] = useState<TraceFilterFieldKey | null>(null);

  const close = () => {
    setOpen(false);
    setPickerField(null);
  };

  const apply = (patch: Partial<TraceAdvancedFilters>) => {
    onChange(patch);
    close();
  };

  const toggleSystem = () => {
    onShowSystemChange(!showSystem);
    close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (!o) setPickerField(null);
      }}
      trigger={
        <Button variant="ghost" size="sm" leftIcon={<PlusIcon size={13} />} data-testid="traces-add-filter">
          <Trans>Filter</Trans>
        </Button>
      }
    >
      {pickerField === null ? (
        <div className="py-1 w-44">
          {TRACE_FILTER_FIELDS.map(f => (
            <RowButton
              key={f.key}
              data-testid={`traces-filter-field-${f.key}`}
              onClick={() => setPickerField(f.key)}
              className="px-3.5 py-2 text-body text-secondary hover:bg-[var(--bg-wash-hover)] hover:text-primary"
            >
              {i18n._(f.label)}
            </RowButton>
          ))}
          {/* System traces broadens the result set rather than narrowing it, so it's a boolean
              view toggle set apart from the value filters — click flips it, no value to pick. */}
          <div className="mt-1 border-t border-hairline pt-1">
            <RowButton
              data-testid="traces-filter-field-system"
              onClick={toggleSystem}
              className={cn(
                'px-3.5 py-2 text-body hover:bg-[var(--bg-wash-hover)] hover:text-primary',
                showSystem ? 'text-accent-text' : 'text-secondary',
              )}
            >
              <Trans>System traces</Trans>
            </RowButton>
          </div>
        </div>
      ) : (
        <div className="w-64">
          <FilterValueEditor key={pickerField} spec={editorSpec(pickerField, apply)} />
        </div>
      )}
    </Popover>
  );
}
