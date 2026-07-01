import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import type { ToolSpecDto } from '../../../api/models';
import { Input } from '../../../components/ui/Input';
import { RowButton } from '../../../components/ui/RowButton';
import { ChevronDownIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';

interface Props {
  value: string;
  tools: ToolSpecDto[];
  invalid?: boolean;
  /** Free-text typing. */
  onChange: (name: string) => void;
  /** Picking a declared tool from the list (used to also seed its argument skeleton). */
  onPickTool: (tool: ToolSpecDto) => void;
}

/**
 * Tool-name field: a free-text input fronting a dropdown of the agent's declared tools.
 * Picking one fills the name and lets the caller seed its argument skeleton.
 *
 * The dropdown is a Radix Popover anchored to the input (portalled, collision-aware, Esc-close)
 * — a free-text typeahead, so focus stays on the input while typing rather than the primitive
 * `Combobox`'s select-from-list model.
 */
export function ToolNameCombobox({ value, tools, invalid, onChange, onPickTool }: Props) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const close = () => setOpen(false);

  const q = value.trim().toLowerCase();
  const matches = q ? tools.filter(tool => tool.name.toLowerCase().includes(q)) : tools;

  // Only surface the popover when the agent actually declares tools; the input still works as a
  // plain free-text field otherwise.
  const listOpen = open && tools.length > 0;

  return (
    <Popover.Root open={listOpen} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div ref={anchorRef} className="relative flex-1 min-w-0">
          <Input
            // eslint-disable-next-line lingui/no-unlocalized-strings -- size variant token, not UI copy
            inputSize="sm"
            aria-label={t`Tool name`}
            role="combobox"
            aria-expanded={listOpen}
            placeholder={t`Choose a tool or type a name…`}
            className="pr-7"
            invalid={value.trim().length === 0 || invalid}
            value={value}
            onChange={e => { onChange(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {/* eslint-disable-next-line no-restricted-syntax -- inline chevron affordance positioned inside the field (tabIndex -1) */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? t`Hide tools` : t`Show available tools`}
            onClick={() => setOpen(o => !o)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-primary cursor-pointer transition-colors"
          >
            <ChevronDownIcon
              size={13}
              strokeWidth={2.5}
              className={cn('transition-transform duration-150', open && 'rotate-180')}
            />
          </button>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          // Keep focus on the input so the user can keep typing to filter.
          onOpenAutoFocus={e => e.preventDefault()}
          // Clicking within the field (input or chevron) must not dismiss the list.
          onInteractOutside={e => {
            const target = e.detail.originalEvent.target as Node | null;
            if (target && anchorRef.current?.contains(target)) e.preventDefault();
          }}
          className={cn(
            'z-[120] w-[var(--radix-popover-trigger-width)] bg-card-2 rounded-md py-1',
            'shadow-[var(--shadow-float)] focus:outline-none',
          )}
        >
          <div role="listbox" className="max-h-[240px] overflow-y-auto">
            {matches.length === 0 ? (
              <div className="px-2.5 py-2 text-body text-muted"><Trans>No matching tools — keep typing for a custom name.</Trans></div>
            ) : (
              matches.map(tool => (
                <RowButton
                  key={tool.name}
                  role="option"
                  aria-selected={tool.name === value}
                  onClick={() => { onPickTool(tool); close(); }}
                  className="flex flex-col items-start gap-px px-2.5 py-1.5 transition-colors duration-100 hover:bg-[var(--bg-wash-hover)]"
                >
                  <span className="mono text-body text-primary truncate max-w-full">{tool.name}</span>
                  <span className="text-caption text-muted truncate max-w-full">
                    <Plural value={tool.arguments.length} one="# param" other="# params" />
                    {tool.description ? ` · ${tool.description}` : ''}
                  </span>
                </RowButton>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
