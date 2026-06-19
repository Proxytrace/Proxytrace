import { Trans } from '@lingui/react/macro';
import { XIcon, CheckIcon } from '../../../../components/icons';

export function PassFailTag({ pass, size = 'sm' }: { pass: boolean; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'px-2.5 py-[3px] text-body-sm' : 'px-2 py-[2px] text-body-sm';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-bold shrink-0 ${cls} ${pass ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
      {pass ? <CheckIcon size={11} strokeWidth={2.5} /> : <XIcon size={11} strokeWidth={2.5} />}
      {pass ? <Trans>Pass</Trans> : <Trans>Fail</Trans>}
    </span>
  );
}
