import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { ListRail } from '../../../../components/ui/ListRail';
import { EmptyState } from '../../../../components/ui/EmptyState';
import type { CustomAnomalyDetectorDto } from '../../../../api/models';
import { DetectorRow } from './DetectorRow';

interface Props {
  detectors: CustomAnomalyDetectorDto[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/** Left rail of the Detectors tab: searchable detector list with the create action. */
export function DetectorRail({ detectors, isLoading, selectedId, onSelect, onNew }: Props) {
  const { t } = useLingui();
  const [q, setQ] = useState('');

  const filtered = detectors.filter(d => !q || d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ListRail
      railTestId="detector-rail"
      listTestId="detector-list"
      title={t`Detectors`}
      count={detectors.length}
      create={{ onClick: onNew, label: t`New detector`, testId: 'detector-create-btn' }}
      search={{ value: q, onChange: setQ }}
      loading={isLoading}
      skeletonHeight={48}
      isEmpty={filtered.length === 0}
      empty={
        <EmptyState
          title={detectors.length === 0 ? t`No detectors yet` : t`No matches`}
          description={detectors.length === 0
            ? t`Create one to review calls with an LLM judge.`
            : t`Clear the search to see all detectors.`}
        />
      }
    >
      <div className="flex flex-col gap-0.5">
        {filtered.map(d => (
          <DetectorRow key={d.id} detector={d} isSelected={d.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </ListRail>
  );
}
