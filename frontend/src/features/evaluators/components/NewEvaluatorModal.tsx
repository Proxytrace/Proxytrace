import { cn } from '../../../lib/cn';
import { Button, IconButton } from '../../../components/ui/Button';
import { XIcon } from '../../../components/icons';
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
  const agenticEnabled = useFeature('AgenticEvaluators');
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[rgba(0,0,0,0.7)] backdrop-blur-[8px]"
    >
      <div
        onClick={ev => ev.stopPropagation()}
        data-testid="evaluator-new-modal"
        className="w-[min(720px,100%)] max-h-[88vh] overflow-auto bg-card rounded-xl border border-subtle shadow-[var(--shadow-float)]"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline">
          <div>
            <div className="text-[16px] font-bold tracking-[-0.01em]">New evaluator</div>
            <div className="text-[12px] text-muted mt-[3px]">
              {pickedKind ? 'Configure your evaluator.' : 'Choose how this evaluator scores agent responses.'}
            </div>
          </div>
          <IconButton onClick={onClose} aria-label="Close"><XIcon size={16} /></IconButton>
        </div>

        <div className="p-5">
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
                  'inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-md text-[12px] font-semibold',
                  categoryTint18[KIND_CATEGORY[pickedKind]],
                  categoryText[KIND_CATEGORY[pickedKind]],
                )}>
                  {META[pickedKind].label}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setPickedKind(null)}>← Change</Button>
              </div>
              <EvaluatorForm form={form} setForm={setForm} kind={pickedKind} presets={presets} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-hairline">
          <span className="text-[11.5px] text-muted">You can change the configuration later from the evaluator's settings.</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onSubmit}
              data-testid="evaluator-form-submit"
              disabled={!pickedKind}
              loading={loading}
            >
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
