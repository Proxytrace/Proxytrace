import { Trans, useLingui } from '@lingui/react/macro';
import type { ToolRequestInputDto, ToolSpecDto } from '../../../api/models';
import { Textarea } from '../../../components/ui/Textarea';
import { Button, IconButton } from '../../../components/ui/Button';
import { FilterTabs } from '../../../components/ui/FilterTabs';
import { PlusIcon, TrashIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { ToolNameCombobox } from './ToolNameCombobox';
import { type ExpectedOutput, argsValid, argsSkeleton, isArgsEmpty } from './expectedOutput';

interface Props {
  value: ExpectedOutput;
  tools: ToolSpecDto[];
  onChange: (value: ExpectedOutput) => void;
  /** When true, the editor stretches to fill its flex parent instead of sizing to content. */
  fill?: boolean;
}

export function ExpectedOutputEditor({ value, tools, onChange, fill }: Props) {
  const { t } = useLingui();
  const mode = value.toolRequests === null ? 'text' : 'tool';
  const rows = value.toolRequests ?? [];

  const setMode = (next: string) => {
    if (next === 'text') onChange({ content: value.content, toolRequests: null });
    else onChange({ content: value.content, toolRequests: value.toolRequests ?? [] });
  };

  const setRow = (i: number, patch: Partial<ToolRequestInputDto>) =>
    onChange({ ...value, toolRequests: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  // Picking a declared tool fills its name and seeds the JSON skeleton, but never clobbers
  // arguments the user has already started editing.
  const pickTool = (i: number, tool: ToolSpecDto) =>
    setRow(i, {
      name: tool.name,
      ...(isArgsEmpty(rows[i].arguments) ? { arguments: argsSkeleton(tool) } : {}),
    });

  const addRow = () =>
    onChange({ ...value, toolRequests: [...rows, { name: '', arguments: '{\n  \n}' }] });

  const removeRow = (i: number) =>
    onChange({ ...value, toolRequests: rows.filter((_, j) => j !== i) });

  return (
    <div className={cn('flex flex-col gap-3', fill && 'flex-1 min-h-0')}>
      <FilterTabs
        options={[
          // eslint-disable-next-line lingui/no-unlocalized-strings -- mode token, not UI copy
          { label: t`Text response`, value: 'text' },
          // eslint-disable-next-line lingui/no-unlocalized-strings -- mode token, not UI copy
          { label: t`Tool request`, value: 'tool' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'text' ? (
        <Textarea
          data-testid="expected-output-text"
          aria-label={t`Expected text response`}
          placeholder={t`What the agent should respond with…`}
          className={cn(fill && 'flex-1 min-h-0 resize-none')}
          value={value.content}
          onChange={e => onChange({ ...value, content: e.target.value })}
        />
      ) : (
        <div className={cn('flex flex-col gap-2', fill && 'flex-1 min-h-0 overflow-y-auto')}>
          {rows.length === 0 && (
            <div className="px-3 py-4 bg-card-2 rounded-md text-body text-muted text-center">
              <Trans>No tool requests yet.</Trans>
            </div>
          )}

          {rows.map((row, i) => {
            const invalidArgs = row.arguments.trim().length > 0 && !argsValid(row.arguments);
            return (
              <div
                key={i}
                data-testid={`expected-tool-row-${i}`}
                className={cn(
                  'bg-card-2 rounded-md p-3 flex flex-col gap-2 shadow-[inset_0_0_0_1px_var(--border-color)]',
                  fill && 'flex-1 min-h-[140px]',
                )}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <ToolNameCombobox
                    value={row.name}
                    tools={tools}
                    onChange={name => setRow(i, { name })}
                    onPickTool={tool => pickTool(i, tool)}
                  />
                  <IconButton aria-label={t`Remove tool request`} onClick={() => removeRow(i)} className="shrink-0">
                    <TrashIcon size={14} />
                  </IconButton>
                </div>
                <Textarea
                  className={cn('mono text-body', fill && 'flex-1 min-h-0 resize-none')}
                  aria-label={t`Tool arguments (JSON)`}
                  rows={3}
                  invalid={invalidArgs}
                  value={row.arguments}
                  onChange={e => setRow(i, { arguments: e.target.value })}
                />
                {invalidArgs && (
                  <span className="text-body-sm text-danger shrink-0"><Trans>Arguments must be valid JSON.</Trans></span>
                )}
              </div>
            );
          })}

          <Button
            variant="ghost"
            fullWidth
            className="shrink-0 text-accent border border-dashed border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] hover:bg-accent-subtle"
            leftIcon={<PlusIcon size={13} strokeWidth={2.5} />}
            onClick={addRow}
          >
            <Trans>Add tool request</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
