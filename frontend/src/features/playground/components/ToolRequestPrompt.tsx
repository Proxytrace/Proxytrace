import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import { Button, IconButton } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { XIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { FOCUS_RING } from '../../../lib/constants';
import type { PlaygroundToolRequest } from '../state/types';

interface Props {
  request: PlaygroundToolRequest;
  onSubmit: (result: { content: string; success: boolean; error?: string }) => void;
  onCancel: () => void;
}

export function ToolRequestPrompt({ request, onSubmit, onCancel }: Props) {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- tab state token, not UI copy
  const [tab, setTab] = useState<'result' | 'error'>('result');
  const [resultText, setResultText] = useState('{}');
  const [errorText, setErrorText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = () => {
    if (tab === 'result') {
      try {
        JSON.parse(resultText);
      } catch (e) {
        setValidationError(t`Invalid JSON: ${(e as Error).message}`);
        return;
      }
      onSubmit({ content: resultText, success: true });
    } else {
      if (!errorText.trim()) { setValidationError(t`Error message required`); return; }
      onSubmit({ content: '', success: false, error: errorText });
    }
  };

  let parsedArgs: unknown = request.arguments;
  try { parsedArgs = JSON.parse(request.arguments); } catch { /* ignore */ }

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2.5 bg-success-subtle border border-[color-mix(in_srgb,var(--success)_28%,transparent)]"
    >
      <div className="flex items-center gap-2 text-body font-mono">
        <span className="font-bold text-success"><Trans>Tool requested:</Trans></span>
        <span>{request.name}</span>
        <span className="text-muted text-caption">{request.id}</span>
        <IconButton className="ml-auto" onClick={onCancel} title={t`Cancel turn`} aria-label={t`Cancel turn`}><XIcon size={13} /></IconButton>
      </div>

      <div>
        <div className="text-caption font-semibold text-secondary uppercase tracking-[0.05em] mb-1"><Trans>Arguments</Trans></div>
        <JsonBlock value={parsedArgs} hideCopy transparent maxHeight={180} className="!px-0 !py-0" />
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {/* eslint-disable-next-line no-restricted-syntax -- semantic result/error tabs (success/danger underline by state) */}
        <button
          className={cn('px-3 py-1.5 text-body-sm font-semibold border-b-2 cursor-pointer', FOCUS_RING, tab === 'result' ? 'border-success text-primary' : 'border-transparent text-muted')}
          onClick={() => { setTab('result'); setValidationError(null); }}
        >
          <Trans>Provide result</Trans>
        </button>
        {/* eslint-disable-next-line no-restricted-syntax -- semantic result/error tabs (success/danger underline by state) */}
        <button
          className={cn('px-3 py-1.5 text-body-sm font-semibold border-b-2 cursor-pointer', FOCUS_RING, tab === 'error' ? 'border-danger text-primary' : 'border-transparent text-muted')}
          onClick={() => { setTab('error'); setValidationError(null); }}
        >
          <Trans>Reject (error)</Trans>
        </button>
      </div>

      {tab === 'result' ? (
        <Textarea
          className="font-mono text-body"
          rows={6}
          value={resultText}
          onChange={e => { setResultText(e.target.value); setValidationError(null); }}
          // eslint-disable-next-line lingui/no-unlocalized-strings -- sample JSON placeholder, not UI copy
          placeholder='{"result": "..."}'
        />
      ) : (
        <Textarea
          rows={4}
          value={errorText}
          onChange={e => { setErrorText(e.target.value); setValidationError(null); }}
          placeholder={t`Tool execution failed: …`}
        />
      )}

      {validationError && (
        <div className="text-body-sm text-danger">{validationError}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}><Trans>Cancel</Trans></Button>
        <Button variant={tab === 'error' ? 'danger' : 'primary'} onClick={submit}>
          {tab === 'error' ? <Trans>Send error</Trans> : <Trans>Send result</Trans>}
        </Button>
      </div>
    </div>
  );
}
