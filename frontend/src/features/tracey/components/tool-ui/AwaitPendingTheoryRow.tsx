import { useLingui } from '@lingui/react/macro';
import { CheckIcon, XIcon } from '../../../../components/icons';
import { Badge } from '../../../../components/ui/Badge';
import { Spinner } from '../../../../components/ui/Spinner';
import { TheoryStatus } from '../../../../api/models';
import { isTheoryTerminal } from '../../tools/await';
import { THEORY_STATUS_LABEL, THEORY_STATUS_VARIANT } from './badge-variants';
import { useAwaitTheorySnapshot } from './useAwaitLiveStatus';

/**
 * One in-flight theory row of the await card. Mirrors the SSE-patched cache the theory's live
 * card maintains (agent, A/B phase); the indeterminate bar runs only while the validation is
 * genuinely in flight, and a settled theory shows its outcome icon even while sibling handles
 * keep the wait open.
 */
export function AwaitPendingTheoryRow({ id }: { id: string }) {
  const { t, i18n } = useLingui();
  const theory = useAwaitTheorySnapshot(id);
  const terminal = theory != null && isTheoryTerminal(theory.status);
  return (
    <div className="flex items-center gap-2 text-body-sm" data-testid={`tracey-await-row-${id}`}>
      <span className="shrink-0">
        {terminal && theory ? (
          theory.status === TheoryStatus.Validated ? (
            <span className="text-success"><CheckIcon size={13} /></span>
          ) : (
            <span className="text-muted"><XIcon size={13} /></span>
          )
        ) : (
          <Spinner size={12} className="text-teal" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-secondary">
        {theory?.agentName ? t`Theory · ${theory.agentName}` : <span className="font-mono text-muted">{id}</span>}
      </span>
      {!terminal && (
        <span aria-hidden className="indeterminate-bar h-1 w-32 shrink-0 overflow-hidden rounded-none bg-card-2" />
      )}
      <Badge
        label={theory ? i18n._(THEORY_STATUS_LABEL[theory.status]) : t`Waiting…`}
        variant={theory ? THEORY_STATUS_VARIANT[theory.status] : 'neutral'}
        size="sm"
      />
    </div>
  );
}
