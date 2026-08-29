import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { ActivityIcon, BeakerIcon, SparklesIcon } from '../../../components/icons';

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

  return (
    <div className="flex flex-col gap-6" data-testid="setup-welcome">
      <div>
        <h1 className="text-display-sm font-bold text-primary leading-snug tracking-[-0.01em]">
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

      <p className="text-body text-secondary leading-relaxed">
        <Trans>Every feature is included, with no limits — nothing to unlock.</Trans>
      </p>
    </div>
  );
}
