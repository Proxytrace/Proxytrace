import { cn } from '../../../lib/cn';
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
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[rgba(0,0,0,0.7)] backdrop-blur-[8px]"
    >
      <div
        onClick={ev => ev.stopPropagation()}
        className="w-[min(720px,100%)] max-h-[88vh] overflow-auto bg-card rounded-xl border border-subtle shadow-[var(--shadow-float)]"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline">
          <div>
            <div className="text-[16px] font-bold tracking-[-0.01em]">New evaluator</div>
            <div className="text-[12px] text-muted mt-[3px]">
              {pickedKind ? 'Configure your evaluator.' : 'Choose how this evaluator scores agent responses.'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted p-1.5 rounded-md text-[18px] bg-transparent border-0 cursor-pointer">×</button>
        </div>

        <div className="p-5">
          {!pickedKind ? (
            <div className="grid grid-cols-2 gap-2.5">
              {KIND_ORDER.map(k => <KindPickerCard key={k} kind={k} onPick={setPickedKind} />)}
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
                <button
                  onClick={() => setPickedKind(null)}
                  className="text-[11px] text-muted px-2 py-[3px] rounded-md border border-border bg-transparent cursor-pointer"
                >← Change</button>
              </div>
              <EvaluatorForm form={form} setForm={setForm} kind={pickedKind} presets={presets} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-hairline">
          <span className="text-[11.5px] text-muted">You can change the configuration later from the evaluator's settings.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-2 rounded-md text-[12px] text-secondary bg-transparent border-0 cursor-pointer">Cancel</button>
            <button
              onClick={onSubmit}
              data-write
              disabled={!pickedKind || loading}
              className={cn(
                'px-4 py-2 rounded-md text-[12px] font-semibold border-0',
                pickedKind
                  ? 'text-white bg-[image:var(--grad-accent)] shadow-[var(--shadow-btn)] cursor-pointer'
                  : 'text-muted bg-card-2 cursor-not-allowed',
                loading && 'opacity-60',
              )}
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
