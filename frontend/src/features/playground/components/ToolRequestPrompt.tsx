import { useState } from 'react';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import { Button, IconButton } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { XIcon } from '../../../components/icons';
import type { PlaygroundToolRequest } from '../state/types';

interface Props {
  request: PlaygroundToolRequest;
  onSubmit: (result: { content: string; success: boolean; error?: string }) => void;
  onCancel: () => void;
}

export function ToolRequestPrompt({ request, onSubmit, onCancel }: Props) {
  const [tab, setTab] = useState<'result' | 'error'>('result');
  const [resultText, setResultText] = useState('{}');
  const [errorText, setErrorText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = () => {
    if (tab === 'result') {
      try {
        JSON.parse(resultText);
      } catch (e) {
        setValidationError(`Invalid JSON: ${(e as Error).message}`);
        return;
      }
      onSubmit({ content: resultText, success: true });
    } else {
      if (!errorText.trim()) { setValidationError('Error message required'); return; }
      onSubmit({ content: '', success: false, error: errorText });
    }
  };

  let parsedArgs: unknown = request.arguments;
  try { parsedArgs = JSON.parse(request.arguments); } catch { /* ignore */ }

  return (
    <div
      className="rounded-[12px] p-[12px] flex flex-col gap-[10px]"
      style={{
        background: 'var(--success-subtle)',
        border: '1px solid color-mix(in srgb, var(--success) 28%, transparent)',
      }}
    >
      <div className="flex items-center gap-2 text-[12px] font-mono">
        <span className="font-bold text-success">Tool requested:</span>
        <span>{request.name}</span>
        <span className="text-muted text-[10px]">{request.id}</span>
        <IconButton className="ml-auto" onClick={onCancel} title="Cancel turn" aria-label="Cancel turn"><XIcon size={13} /></IconButton>
      </div>

      <div>
        <div className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.05em] mb-[4px]">Arguments</div>
        <JsonBlock value={parsedArgs} hideCopy transparent maxHeight={180} className="!px-0 !py-0" />
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {/* eslint-disable-next-line no-restricted-syntax -- semantic result/error tabs (success/danger underline by state) */}
        <button
          className={`px-3 py-[6px] text-[11.5px] font-semibold border-b-2 ${tab === 'result' ? 'border-success text-primary' : 'border-transparent text-muted'}`}
          onClick={() => { setTab('result'); setValidationError(null); }}
        >
          Provide result
        </button>
        {/* eslint-disable-next-line no-restricted-syntax -- semantic result/error tabs (success/danger underline by state) */}
        <button
          className={`px-3 py-[6px] text-[11.5px] font-semibold border-b-2 ${tab === 'error' ? 'border-danger text-primary' : 'border-transparent text-muted'}`}
          onClick={() => { setTab('error'); setValidationError(null); }}
        >
          Reject (error)
        </button>
      </div>

      {tab === 'result' ? (
        <Textarea
          className="font-mono text-[12px]"
          rows={6}
          value={resultText}
          onChange={e => { setResultText(e.target.value); setValidationError(null); }}
          placeholder='{"result": "..."}'
        />
      ) : (
        <Textarea
          rows={4}
          value={errorText}
          onChange={e => { setErrorText(e.target.value); setValidationError(null); }}
          placeholder="Tool execution failed: …"
        />
      )}

      {validationError && (
        <div className="text-[11px] text-danger">{validationError}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={tab === 'error' ? 'danger' : 'primary'} onClick={submit}>
          {tab === 'error' ? 'Send error' : 'Send result'}
        </Button>
      </div>
    </div>
  );
}
