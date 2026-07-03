import { useLingui } from '@lingui/react/macro';
import { PlusIcon, TrashIcon } from '../../../../components/icons';
import { Button, IconButton } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { TriggerKind, type AnomalyTriggerDto } from '../../../../api/models';
import { MAX_TRIGGERS, TRIGGER_KIND_LABEL } from '../detectors';

interface Props {
  triggers: AnomalyTriggerDto[];
  onChange: (triggers: AnomalyTriggerDto[]) => void;
}

/** Edits a detector's trigger list: each row picks a kind (Phrase / Regex) and a pattern; triggers
 * gate whether a call is sent to the LLM review, so at least one is required (max {@link MAX_TRIGGERS}). */
export function TriggerEditor({ triggers, onChange }: Props) {
  const { t, i18n } = useLingui();

  const patch = (i: number, next: Partial<AnomalyTriggerDto>) =>
    onChange(triggers.map((tr, idx) => (idx === i ? { ...tr, ...next } : tr)));
  const remove = (i: number) => onChange(triggers.filter((_, idx) => idx !== i));
  const add = () => onChange([...triggers, { kind: TriggerKind.Phrase, pattern: '' }]);

  return (
    <div className="flex flex-col gap-2" data-testid="detector-triggers">
      {triggers.map((trigger, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-28 shrink-0">
            <Select
              value={trigger.kind}
              onValueChange={value => patch(i, { kind: value as TriggerKind })}
              aria-label={t`Trigger type`}
            >
              {Object.values(TriggerKind).map(kind => (
                <option key={kind} value={kind}>{i18n._(TRIGGER_KIND_LABEL[kind])}</option>
              ))}
            </Select>
          </div>
          <Input
            value={trigger.pattern}
            onChange={e => patch(i, { pattern: e.target.value })}
            placeholder={trigger.kind === TriggerKind.Regex ? t`Regular expression…` : t`Phrase to match…`}
            aria-label={t`Trigger pattern`}
            className="flex-1 font-mono"
            data-testid={`detector-trigger-pattern-${i}`}
          />
          <IconButton
            onClick={() => remove(i)}
            title={t`Remove trigger`}
            aria-label={t`Remove trigger`}
            disabled={triggers.length <= 1}
            data-testid={`detector-trigger-remove-${i}`}
            data-write
          >
            <TrashIcon size={14} />
          </IconButton>
        </div>
      ))}
      <div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<PlusIcon size={14} />}
          onClick={add}
          disabled={triggers.length >= MAX_TRIGGERS}
          data-testid="detector-trigger-add"
          data-write
        >
          {t`Add trigger`}
        </Button>
      </div>
    </div>
  );
}
