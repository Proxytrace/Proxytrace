import type { ProviderDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { providerColor } from '../../../lib/colors';
import { Avatar } from '../../../components/ui/Avatar';
import { Card } from '../../../components/ui/Card';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { kindColor, kindLabel } from '../providerMeta';

interface ProviderListProps {
  providers: ProviderDto[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (provider: ProviderDto) => void;
}

export function ProviderList({ providers, loading, selectedId, onSelect }: ProviderListProps) {
  return (
    <Card elevation="raised" padding="sm" className="overflow-y-auto flex flex-col gap-1" data-testid="provider-list">
      {loading && <SkeletonList rows={5} height={52} gap={6} />}
      {!loading && providers.length === 0 && (
        <div data-testid="provider-empty-state">
          <EmptyState title="No providers yet" description="Add a provider to route traffic through Proxytrace." />
        </div>
      )}
      {providers.map(p => {
        const active = selectedId === p.id;
        return (
          <button
            key={p.id}
            data-testid={`provider-row-${p.id}`}
            onClick={() => onSelect(p)}
            className={cn(
              'group relative w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 border-none cursor-pointer',
              'transition-[background,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-standard)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]',
              active ? 'bg-accent-subtle' : 'bg-transparent hover:bg-card-2',
            )}
          >
            {active && (
              <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-accent rounded-r-sm" />
            )}
            <Avatar initials={p.name[0]} color={providerColor(p.name)} className="w-8 h-8 rounded-md text-title" />
            <div className="min-w-0 flex-1">
              <div className="text-title font-semibold text-primary overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</div>
              <div className="mt-0.5">
                <ColoredBadge color={kindColor(p.kind)} label={kindLabel(p.kind)} />
              </div>
            </div>
          </button>
        );
      })}
    </Card>
  );
}
