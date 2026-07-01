import { useLingui } from '@lingui/react/macro';
import type { ProviderDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { providerColor } from '../../../lib/colors';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../../lib/selectionRow';
import { Avatar } from '../../../components/ui/Avatar';
import { ListRail } from '../../../components/ui/ListRail';
import { RowButton } from '../../../components/ui/RowButton';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { kindColor, kindLabel } from '../providerMeta';

interface ProviderListProps {
  providers: ProviderDto[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (provider: ProviderDto) => void;
}

export function ProviderList({ providers, loading, selectedId, onSelect }: ProviderListProps) {
  const { t, i18n } = useLingui();
  return (
    <ListRail
      title={t`Providers`}
      count={providers.length}
      listTestId="provider-list"
      loading={loading}
      skeletonRows={5}
      skeletonHeight={52}
      isEmpty={providers.length === 0}
      empty={
        <div data-testid="provider-empty-state">
          <EmptyState title={t`No providers yet`} description={t`Add a provider to route traffic through Proxytrace.`} />
        </div>
      }
    >
      <div className="flex flex-col gap-1">
        {providers.map(p => {
          const active = selectedId === p.id;
          const c = providerColor(p.name);
          return (
            <RowButton
              key={p.id}
              data-testid={`provider-row-${p.id}`}
              onClick={() => onSelect(p)}
              className={cn(
                'rounded-lg relative overflow-hidden transition-[box-shadow,background-color] duration-150 px-3 py-2.5 flex items-center gap-3',
                !active && SELECTION_ROW_INACTIVE,
              )}
              style={active ? selectionRowStyle(c) : undefined}
            >
              {active && (
                <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={selectionBarStyle(c)} />
              )}
              <Avatar initials={p.name[0]} color={c} className="w-8 h-8 rounded-md text-title" />
              <div className="min-w-0 flex-1">
                <div className="text-title font-semibold text-primary overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</div>
                <div className="mt-0.5">
                  <ColoredBadge color={kindColor(p.kind)} label={i18n._(kindLabel(p.kind))} />
                </div>
              </div>
            </RowButton>
          );
        })}
      </div>
    </ListRail>
  );
}
