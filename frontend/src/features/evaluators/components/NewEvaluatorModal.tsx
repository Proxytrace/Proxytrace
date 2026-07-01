import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { Button, IconButton } from '../../../components/ui/Button';
import { XIcon } from '../../../components/icons';
import { Modal } from '../../../components/overlays/Modal';
import { useFeature } from '../../../api/license';
import { EvaluatorKind, type AgenticEvaluatorPresetDto } from '../../../api/models';
import { EvaluatorForm } from '../EvaluatorForm';
import { KIND_ORDER, META, KIND_CATEGORY, type EvaluatorFormState } from '../evaluatorMeta';
import { categoryText, categoryTint18 } from '../categoryClasses';
import { KindPickerCard } from './KindPickerCard';

interface Props {
  pickedKind: EvaluatorKind | null;
  setPickedKind: (k: EvaluatorKind | null) => void;
  form: EvaluatorFormState;
  setForm: (f: EvaluatorFormState) => void;
  presets: AgenticEvaluatorPresetDto[];
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}

/** Create-evaluator overlay: kind picker first, then the kind-specific form. */
export function NewEvaluatorModal({ pickedKind, setPickedKind, form, setForm, presets, onClose, onSubmit, loading }: Props) {
  const { t, i18n } = useLingui();
  const agenticEnabled = useFeature('AgenticEvaluators');
  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="evaluator-new-modal">
        <div className="flex items-start justify-between gap-2 mb-5">
          <div>
            <div className="text-h2 font-semibold tracking-[-0.01em]"><Trans>New evaluator</Trans></div>
            <div className="text-body text-muted mt-0.5">
              {pickedKind ? <Trans>Configure your evaluator.</Trans> : <Trans>Choose how this evaluator scores agent responses.</Trans>}
            </div>
          </div>
          <IconButton onClick={onClose} aria-label={t`Close`}><XIcon size={16} /></IconButton>
        </div>

        {!pickedKind ? (
          <div className="grid grid-cols-2 gap-2.5">
            {KIND_ORDER.map(k => (
              <KindPickerCard
                key={k}
                kind={k}
                onPick={setPickedKind}
                locked={k === EvaluatorKind.Agentic && !agenticEnabled}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-body font-semibold',
                categoryTint18[KIND_CATEGORY[pickedKind]],
                categoryText[KIND_CATEGORY[pickedKind]],
              )}>
                {i18n._(META[pickedKind].label)}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setPickedKind(null)}><Trans>← Change</Trans></Button>
            </div>
            <EvaluatorForm form={form} setForm={setForm} kind={pickedKind} presets={presets} />
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-body-sm text-muted"><Trans>You can change the configuration later from the evaluator's settings.</Trans></span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}><Trans>Cancel</Trans></Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSubmit}
              data-testid="evaluator-form-submit"
              disabled={!pickedKind}
              loading={loading}
            >
              <Trans>Create</Trans>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
