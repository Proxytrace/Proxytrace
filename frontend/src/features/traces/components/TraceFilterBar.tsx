import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Popover } from '../../../components/ui/Popover';
import { RowButton } from '../../../components/ui/RowButton';
import { PlusIcon } from '../../../components/icons';
import { agentColor } from '../../../lib/colors';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AgentListItemDto } from '../../../api/models';
import type { TraceAdvancedFilters } from '../tracesMeta';
import {
  ANOMALY_OPTION_LABELS, TRACE_FILTER_FIELDS, clearFieldPatch, isFieldActive, rangeChipValue,
  type TraceFilterFieldKey,
} from '../traceFilterFields';
import { useTraceToolNames } from '../hooks/useTraceToolNames';
import { FilterValueEditor, type EditorSpec } from './FilterValueEditor';

interface Props {
  agents: AgentListItemDto[];
  filters: TraceAdvancedFilters;
  onChange: (patch: Partial<TraceAdvancedFilters>) => void;
  onClearAll: () => void;
}

/**
 * The composable filter row under the traces toolbar: a "+ Filter" picker plus one removable,
 * click-to-edit chip per active filter. Value editors live in {@link FilterValueEditor}; the
 * field registry in `traceFilterFields.ts`.
 */
export function TraceFilterBar({ agents, filters, onChange, onClearAll }: Props) {
  const { t, i18n } = useLingui();
  const toolNames = useTraceToolNames();
  // One popover open at a time: the "+ Filter" picker (with an optional field drilled into) or
  // an active chip's editor.
  const [open, setOpen] = useState<'picker' | TraceFilterFieldKey | null>(null);
  const [pickerField, setPickerField] = useState<TraceFilterFieldKey | null>(null);

  const apply = (patch: Partial<TraceAdvancedFilters>) => {
    onChange(patch);
    setOpen(null);
    setPickerField(null);
  };

  const editorSpec = (field: TraceFilterFieldKey): EditorSpec => {
    switch (field) {
      case 'agent': return {
        kind: 'options',
        value: filters.agent,
        emptyText: t`No agents yet`,
        options: agents.map(a => ({ key: a.id, label: a.name, accent: agentColor(a.id) })),
        onApply: key => apply({ agent: key }),
      };
      case 'anomaly': return {
        kind: 'options',
        value: filters.anomaly,
        emptyText: '',
        options: (Object.keys(ANOMALY_OPTION_LABELS) as (keyof typeof ANOMALY_OPTION_LABELS)[])
          .map(key => ({ key, label: i18n._(ANOMALY_OPTION_LABELS[key]) })),
        onApply: key => apply({ anomaly: key as TraceAdvancedFilters['anomaly'] }),
      };
      case 'tool': return {
        kind: 'options',
        value: filters.tool,
        emptyText: t`No tool calls recorded`,
        options: toolNames.map(name => ({ key: name, label: name })),
        onApply: key => apply({ tool: key }),
      };
      case 'model': return {
        kind: 'text',
        value: filters.model,
        placeholder: t`Model name contains…`,
        onApply: value => apply({ model: value }),
      };
      case 'status': return {
        kind: 'options',
        value: filters.statusClass,
        emptyText: '',
        options: [{ key: '2', label: '2xx' }, { key: '4', label: '4xx' }, { key: '5', label: '5xx' }],
        onApply: key => apply({ statusClass: key as TraceAdvancedFilters['statusClass'] }),
      };
      case 'tokens': return {
        kind: 'range',
        min: filters.minTokens,
        max: filters.maxTokens,
        onApply: (min, max) => apply({ minTokens: min, maxTokens: max }),
      };
      case 'latency': return {
        kind: 'range',
        min: filters.minLatencyMs,
        max: filters.maxLatencyMs,
        // eslint-disable-next-line lingui/no-unlocalized-strings -- unit, not UI copy
        unit: 'ms',
        onApply: (min, max) => apply({ minLatencyMs: min, maxLatencyMs: max }),
      };
    }
  };

  const chipValue = (field: TraceFilterFieldKey): string => {
    switch (field) {
      case 'agent': return agents.find(a => a.id === filters.agent)?.name ?? filters.agent;
      case 'anomaly': return filters.anomaly === '' ? '' : i18n._(ANOMALY_OPTION_LABELS[filters.anomaly]);
      case 'tool': return filters.tool;
      case 'model': return filters.model;
      // eslint-disable-next-line lingui/no-unlocalized-strings -- status-class suffix, not UI copy
      case 'status': return `${filters.statusClass}xx`;
      case 'tokens': return rangeChipValue(filters.minTokens, filters.maxTokens);
      // eslint-disable-next-line lingui/no-unlocalized-strings -- unit, not UI copy
      case 'latency': return rangeChipValue(filters.minLatencyMs, filters.maxLatencyMs, ' ms');
    }
  };

  const activeFields = TRACE_FILTER_FIELDS.filter(f => isFieldActive(f.key, filters));

  const editorPanel = (field: TraceFilterFieldKey) => (
    <div className="w-64">
      <FilterValueEditor key={field} spec={editorSpec(field)} />
      <div className="border-t border-hairline px-2 py-1.5">
        <Button variant="link" size="sm" data-testid="traces-filter-remove" onClick={() => apply(clearFieldPatch(field))}>
          <Trans>Remove filter</Trans>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover
        open={open === 'picker'}
        onOpenChange={o => {
          // eslint-disable-next-line lingui/no-unlocalized-strings -- state token, not UI copy
          setOpen(o ? 'picker' : null);
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
          </div>
        ) : (
          <div className="w-64">
            <FilterValueEditor key={pickerField} spec={editorSpec(pickerField)} />
          </div>
        )}
      </Popover>

      {activeFields.map(f => (
        <Popover
          key={f.key}
          open={open === f.key}
          onOpenChange={o => setOpen(o ? f.key : null)}
          trigger={
            <span data-testid={`traces-filter-chip-${f.key}`}>
              <FilterChip
                label={`${i18n._(f.label)}:`}
                value={chipValue(f.key)}
                active
                accent={f.key === 'agent' && filters.agent ? agentColor(filters.agent) : undefined}
              />
            </span>
          }
        >
          {editorPanel(f.key)}
        </Popover>
      ))}

      {activeFields.length > 0 && (
        <Button variant="link" size="sm" data-testid="traces-clear-filters" onClick={onClearAll}>
          <Trans>Clear all</Trans>
        </Button>
      )}
    </div>
  );
}
