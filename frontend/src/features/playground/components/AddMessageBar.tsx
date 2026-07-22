import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { PlusIcon, SearchIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { Menu } from '../../../components/ui/Menu';
import { cn } from '../../../lib/cn';
import type { PlaygroundRole } from '../state/types';

interface Props {
  onAdd: (role: PlaygroundRole) => void;
  onLoadFromTrace?: () => void;
}

/* eslint-disable lingui/no-unlocalized-strings -- Tailwind class recipes, not user-facing copy */
const ROLE_OPTIONS: { value: PlaygroundRole; label: MessageDescriptor; accentClass: string; description: MessageDescriptor }[] = [
  { value: 'user', label: msg`User`, accentClass: 'text-teal border-[color-mix(in_srgb,var(--teal)_22%,transparent)]', description: msg`Message from the human` },
  { value: 'assistant', label: msg`Assistant`, accentClass: 'text-accent-hover border-[color-mix(in_srgb,var(--accent-hover)_22%,transparent)]', description: msg`Reply from the model` },
  { value: 'system', label: msg`System`, accentClass: 'text-secondary border-[color-mix(in_srgb,var(--text-secondary)_22%,transparent)]', description: msg`System instruction` },
];

export function AddMessageBar({ onAdd, onLoadFromTrace }: Props) {
  const { i18n } = useLingui();

  return (
    <div className="mt-0.5">
      <Menu
        side="top"
        align="center"
        trigger={
          <Button
            variant="ghost"
            fullWidth
            data-testid="add-message-bar"
            className={cn(
              'group py-2.5 rounded-md border border-dashed border-border text-muted',
              'data-[state=open]:bg-accent-subtle data-[state=open]:border-[color-mix(in_srgb,var(--accent-primary)_32%,transparent)] data-[state=open]:text-accent-hover',
            )}
            leftIcon={<PlusIcon size={13} strokeWidth={2.4} />}
          >
            <span className="text-body-sm font-semibold uppercase tracking-[0.08em]"><Trans>Add message</Trans></span>
          </Button>
        }
      >
        <Menu.Label><Trans>New message role</Trans></Menu.Label>
        {ROLE_OPTIONS.map(opt => {
          const label = i18n._(opt.label);
          return (
            <Menu.Item
              key={opt.value}
              onSelect={() => onAdd(opt.value)}
              data-testid={`add-message-role-${opt.value}`}
              icon={
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex items-center justify-center size-[24px] rounded-none text-body-sm font-bold shrink-0 border bg-[var(--bg-wash-hover)]',
                    opt.accentClass,
                  )}
                >
                  {label[0]}
                </span>
              }
            >
              <span className="flex flex-col min-w-0">
                <span className="text-body text-primary font-semibold">{label}</span>
                <span className="text-caption text-muted">{i18n._(opt.description)}</span>
              </span>
            </Menu.Item>
          );
        })}
        {onLoadFromTrace && (
          <>
            <Menu.Separator />
            <Menu.Item
              onSelect={onLoadFromTrace}
              icon={
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center size-[24px] rounded-none shrink-0 bg-[var(--bg-wash-hover)] text-secondary border border-border"
                >
                  <SearchIcon size={12} strokeWidth={2.2} />
                </span>
              }
            >
              <span className="flex flex-col min-w-0">
                <span className="text-body text-primary font-semibold"><Trans>Load from trace</Trans></span>
                <span className="text-caption text-muted"><Trans>Seed conversation from past trace or test case</Trans></span>
              </span>
            </Menu.Item>
          </>
        )}
      </Menu>
    </div>
  );
}
