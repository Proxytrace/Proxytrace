import { Button } from '../ui/Button';
import { LockIcon } from '../icons';

/**
 * Full-page placeholder shown when a route or area requires an Enterprise
 * feature the current license does not grant. Communicates the gate without
 * dead-ending the user.
 */
export function UpgradePlaceholder({ title, description }: { title?: string; description?: string }) {
  return (
    <div
      data-testid="upgrade-placeholder"
      className="flex flex-1 flex-col items-center justify-center gap-4 p-[60px_20px] text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card text-accent shadow-[var(--shadow-card)]">
        <LockIcon size={24} />
      </div>
      <div className="max-w-md">
        <h1 className="text-h1 font-semibold text-primary">{title ?? 'Upgrade to Enterprise'}</h1>
        <p className="mt-2 text-body text-secondary">
          {description ??
            'This feature is part of the Proxytrace Enterprise tier. Upgrade your license to unlock optimization proposals, LLM-judge evaluators, and more.'}
        </p>
      </div>
      <a href="https://proxytrace.dev/pricing" target="_blank" rel="noopener noreferrer">
        <Button variant="primary" data-testid="upgrade-cta">
          View Enterprise plans
        </Button>
      </a>
    </div>
  );
}
