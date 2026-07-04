import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { cn } from '../../lib/cn';
import { Tabs } from '../../components/ui/Tabs';
import { RequiresFeature } from '../../components/license/RequiresFeature';
import { AnomalyOverview } from './components/AnomalyOverview';
import { DetectorsTab } from './detectors/components/DetectorsTab';
import { AskTraceyButton } from '../../components/tracey/AskTraceyButton';
import { anomaliesOverviewPrompt } from '../../components/tracey/askTraceyPrompts';

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
    // The detectors tab is a master/detail split with an internally-scrolling rail, so it needs the
    // full viewport height; the overview keeps the natural page scroll.
    <div
      className={cn('w-full min-w-0 flex flex-col gap-4', tab === TABS.detectors && 'h-full min-h-0')}
      data-testid="anomaly-dashboard"
    >
      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={v => setTab(v as TabValue)}
          items={[
            { value: TABS.overview, label: t`Overview`, 'data-testid': 'anomaly-tab-overview' },
            { value: TABS.detectors, label: t`Detectors`, 'data-testid': 'anomaly-tab-detectors' },
          ]}
        />
        <AskTraceyButton data-testid="ask-tracey-btn-anomalies" prompt={anomaliesOverviewPrompt()} />
      </div>

      {tab === TABS.overview && <AnomalyOverview />}
      {tab === TABS.detectors && (
        <RequiresFeature feature="CustomAnomalyDetectors"><DetectorsTab /></RequiresFeature>
      )}
    </div>
  );
}
