import { Trans, useLingui } from '@lingui/react/macro';
import type { EvaluatorDetailDto } from '../../../api/models';
import { cn } from '../../../lib/cn';
import { EVALUATOR_KIND_COLOR, EVALUATOR_KIND_CATEGORY } from '../../../lib/colors';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Props {
  evaluator: EvaluatorDetailDto | null;
  attached: boolean;
}

export function EvaluatorPreview({ evaluator, attached }: Props) {
  const { t } = useLingui();
  if (!evaluator) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState title={t`Select an evaluator`} description={t`Click a row to inspect its config.`} />
      </div>
    );
  }
  const c = EVALUATOR_KIND_COLOR[evaluator.kind];
  const cat = EVALUATOR_KIND_CATEGORY[evaluator.kind];
  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 32%, transparent)` }}>
          <span className="text-h2 font-bold" style={{ color: c }}>{evaluator.kind.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-h2 font-bold text-primary truncate">{evaluator.name}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <ColoredBadge color={c} label={evaluator.kind} />
            <span className="text-caption font-mono text-secondary uppercase tracking-[0.06em]"><Trans>{cat}-based</Trans></span>
            <span className={cn('text-caption font-semibold uppercase tracking-[0.08em]', attached ? 'text-accent' : 'text-secondary')}>
              {attached ? <Trans>● Attached</Trans> : <Trans>○ Not attached</Trans>}
            </span>
          </div>
        </div>
      </div>

      {evaluator.systemMessage && (
        <Field label={t`System prompt`}>
          <div className="text-body leading-[1.6] text-secondary whitespace-pre-wrap bg-card-2 border border-border rounded-md px-3 py-2.5 max-h-[200px] overflow-y-auto">
            {evaluator.systemMessage}
          </div>
        </Field>
      )}

      {evaluator.endpointName && (
        <Field label={t`Judge model`}>
          <div className="text-body text-primary font-mono">{evaluator.endpointName}</div>
        </Field>
      )}

      {evaluator.extractionPattern && (
        <Field label={t`Extraction pattern`}>
          <div className="text-body font-mono text-primary bg-card-2 border border-border rounded-md px-3 py-2 break-all">
            {evaluator.extractionPattern}
          </div>
        </Field>
      )}

      {evaluator.tolerance != null && (
        <Field label={t`Tolerance`}>
          <div className="text-body text-primary font-mono">{evaluator.tolerance}</div>
        </Field>
      )}

      {evaluator.jsonSchema && (
        <Field label={t`JSON schema`}>
          <CodeBlock content={evaluator.jsonSchema} language="json" />
        </Field>
      )}

      {!evaluator.systemMessage && !evaluator.extractionPattern && !evaluator.jsonSchema && evaluator.tolerance == null && (
        <div className="text-body text-muted italic"><Trans>No additional configuration.</Trans></div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-semibold text-secondary uppercase tracking-[0.08em]">{label}</span>
      {children}
    </div>
  );
}
