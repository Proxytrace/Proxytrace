import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { useLicense } from '../../../api/license';
import { Skeleton } from '../../../components/ui/Skeleton';
import {
  ActivityIcon,
  BeakerIcon,
  SparklesIcon,
  CheckIcon,
  LockIcon,
  CrownIcon,
  ExternalLinkIcon,
} from '../../../components/icons';
import { buildTierSummary, UPGRADE_URL } from '../setupMeta';
import { WelcomeLicenseEntry } from './WelcomeLicenseEntry';

const PILLARS: { icon: typeof ActivityIcon; title: MessageDescriptor; text: MessageDescriptor }[] = [
  {
    icon: ActivityIcon,
    title: msg`Capture everything`,
    text: msg`Point your agent at the proxy — one base-URL change — and every request, response, tool call, token and cost is recorded.`,
  },
  {
    icon: BeakerIcon,
    title: msg`Benchmark what matters`,
    text: msg`Curate real traces into test suites and score them with evaluators on every agent version.`,
  },
  {
    icon: SparklesIcon,
    title: msg`Optimize with evidence`,
    text: msg`Get data-driven improvement proposals, validated with A/B runs before you ship them.`,
  },
];

export function WelcomeStep() {
  const { i18n } = useLingui();
  const { data: license } = useLicense();
  const tier = buildTierSummary(license);

  return (
    <div className="flex flex-col gap-6" data-testid="setup-welcome">
      <div>
        {/* display-tier: intentional, outside type scale */}
        <h1 className="text-[22px] font-bold text-primary leading-snug tracking-[-0.01em]">
          <Trans>Welcome to <span className="text-accent-text">Proxytrace</span></Trans>
        </h1>
        <p className="text-title text-secondary mt-1.5 leading-relaxed">
          <Trans>See what your AI agents actually do — and make them better. Setup takes about two minutes.</Trans>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {PILLARS.map(({ icon: Icon, title, text }) => (
          <div key={title.id} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0">
              <Icon size={16} />
            </div>
            <div>
              <div className="text-title font-semibold text-primary">{i18n._(title)}</div>
              <p className="text-body text-secondary leading-relaxed mt-0.5">{i18n._(text)}</p>
            </div>
          </div>
        ))}
      </div>

      {license === undefined ? (
        <Skeleton height={120} />
      ) : (
        <>
          <TierPanel tier={tier} />
          <WelcomeLicenseEntry />
        </>
      )}
    </div>
  );
}

function TierPanel({ tier }: { tier: ReturnType<typeof buildTierSummary> }) {
  const { i18n } = useLingui();
  const TierIcon = tier.isFree ? SparklesIcon : CrownIcon;
  return (
    <div
      className="rounded-lg border border-border bg-card-2 p-4 flex flex-col gap-3"
      data-testid="setup-welcome-tier"
    >
      <div className="flex items-center gap-2">
        <TierIcon size={14} className="text-accent" />
        <span className="text-title font-semibold text-primary">
          <Trans>This installation: {i18n._(tier.tierLabel)}</Trans>
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {tier.included.map(line => (
          <li key={line.id} className="flex items-start gap-2 text-body text-secondary">
            <CheckIcon size={13} strokeWidth={2.5} className="text-success mt-0.5 shrink-0" />
            <span>{i18n._(line)}</span>
          </li>
        ))}
        {tier.locked.map(line => (
          <li key={line.id} className="flex items-start gap-2 text-body text-muted">
            <LockIcon size={13} className="mt-0.5 shrink-0" />
            <span>
              {i18n._(line)}
              <span className="text-caption text-muted ml-1.5 uppercase"><Trans>Enterprise</Trans></span>
            </span>
          </li>
        ))}
      </ul>

      {tier.isFree && (
        <a
          href={UPGRADE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-text hover:text-accent-hover transition-colors self-start"
          data-testid="setup-welcome-upgrade-link"
        >
          <Trans>Unlock everything with Enterprise — proxytrace.dev</Trans>
          <ExternalLinkIcon size={12} />
        </a>
      )}
    </div>
  );
}
