import { Trans, useLingui } from '@lingui/react/macro';
import { tint, evaluatorColor } from '../../../lib/colors';
import type { EvaluatorListItemDto } from '../../../api/models';
import type { EvaluatorTestBenchPayloadDto } from '../../../api/evaluator-testbench';
import { BeakerIcon } from '../../../components/icons';
import { KIND_LABEL } from '../testBenchMeta';

/** Center-pane header: the case being replayed + the active judge it runs through. */
export function CaseHeader({ payload, evaluator }: {
  payload: EvaluatorTestBenchPayloadDto;
  evaluator: EvaluatorListItemDto;
}) {
  const { t, i18n } = useLingui();
  const color = evaluatorColor(evaluator.kind);
  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h2 data-testid="bench-case-title" className="text-h1 font-semibold leading-tight tracking-[-0.01em] m-0">
          {payload.testCaseSummary || t`Test case`}
        </h2>
        <span
          className="px-2.5 py-0.5 rounded-none text-caption font-semibold whitespace-nowrap"
          style={{ background: tint(color, 16), color }}
        >
          {evaluator.name} · {i18n._(KIND_LABEL[evaluator.kind])}
        </span>
      </div>
      <p className="text-body-sm text-muted m-0 inline-flex items-center gap-1.5">
        <BeakerIcon size={12} />
        <Trans>Replaying a logged test result</Trans>
      </p>
    </div>
  );
}
