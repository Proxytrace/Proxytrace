import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Tabs } from '../../components/ui/Tabs';
import { RequiresFeature } from '../../components/license/RequiresFeature';
import { AnomalyOverview } from './components/AnomalyOverview';
import { DetectorsTab } from './detectors/components/DetectorsTab';

// eslint-disable-next-line lingui/no-unlocalized-strings -- tab value tokens, not UI copy
const TABS = { overview: 'overview', detectors: 'detectors' } as const;
type TabValue = (typeof TABS)[keyof typeof TABS];

/**
 * Anomaly dashboard page: an **Overview** tab (timeline + recent list) and a **Detectors** CRUD tab
 * gated behind the Enterprise `CustomAnomalyDetectors` feature (the panel renders the upgrade
 * placeholder when unlicensed, so the tab is always visible).
 */
export default function AnomalyDashboard() {
  const { t } = useLingui();
  const [tab, setTab] = useState<TabValue>(TABS.overview);

  return (
    <div className="w-full min-w-0 flex flex-col gap-4" data-testid="anomaly-dashboard">
      <header>
        <h1 className="text-h1 font-semibold text-primary"><Trans>Anomalies</Trans></h1>
        <p className="text-body-sm text-muted mt-1">
          <Trans>Flagged agent calls over time, and the agents that need the most attention.</Trans>
        </p>
      </header>

      <Tabs
        value={tab}
        onChange={v => setTab(v as TabValue)}
        items={[
          { value: TABS.overview, label: t`Overview`, 'data-testid': 'anomaly-tab-overview' },
          { value: TABS.detectors, label: t`Detectors`, 'data-testid': 'anomaly-tab-detectors' },
        ]}
      />

      {tab === TABS.overview && <AnomalyOverview />}
      {tab === TABS.detectors && (
        <RequiresFeature feature="CustomAnomalyDetectors"><DetectorsTab /></RequiresFeature>
      )}
    </div>
  );
}
