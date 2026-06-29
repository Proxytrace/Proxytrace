import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { CopyIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import type { EvaluatorDetailDto } from '../../../api/models';
import { KIND_CATEGORY, extractTemplateVars } from '../evaluatorMeta';
import { categoryText, categoryTint14, categoryTint18 } from '../categoryClasses';
import { NumberedCode } from './NumberedCode';

interface Props {
  evaluator: EvaluatorDetailDto;
}

/** Renders the kind-specific definition body (rubric / schema / regex+tolerance / preset). */
function definitionBody(e: EvaluatorDetailDto): { body: ReactNode; vars: string[] } {
  const cat = KIND_CATEGORY[e.kind];
  if (e.systemMessage) {
    return {
      vars: extractTemplateVars(e.systemMessage),
      body: <NumberedCode text={e.systemMessage} category={cat} highlightVars />,
    };
  }
  if (e.jsonSchema) {
    return { vars: [], body: <NumberedCode text={e.jsonSchema} category={cat} /> };
  }
  if (e.extractionPattern || e.tolerance != null) {
    return {
      vars: [],
      body: (
        <div className="grid grid-cols-2 gap-2.5">
          {e.extractionPattern && (
            <div className="px-3.5 py-3 bg-card-2 rounded-md col-span-2">
              <div className="text-caption text-muted uppercase tracking-[0.07em] mb-1"><Trans>extract pattern</Trans></div>
              <code className="font-mono text-body text-teal">/{e.extractionPattern}/</code>
            </div>
          )}
          {e.tolerance != null && (
            <div className="px-3.5 py-3 bg-card-2 rounded-md">
              <div className="text-caption text-muted uppercase tracking-[0.07em] mb-1"><Trans>tolerance</Trans></div>
              <div className="text-body font-mono text-primary">± {e.tolerance}</div>
            </div>
          )}
        </div>
      ),
    };
  }
  return {
    vars: [],
    body: (
      <div className="py-6 text-center text-muted text-body">
        <Trans>Preset configuration — no user-defined settings.</Trans>
      </div>
    ),
  };
}

/** Card showing the evaluator's definition with a copy action and a variable footer. */
export function DefinitionPanel({ evaluator: e }: Props) {
  const cat = KIND_CATEGORY[e.kind];
  const { body, vars } = definitionBody(e);
  const systemMessage = e.systemMessage;

  return (
    <section data-testid="evaluator-definition-panel" className="flex flex-col min-w-0 bg-card rounded-lg shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-caption text-muted uppercase tracking-[0.09em] font-semibold"><Trans>Definition</Trans></span>
        <span className={cn('px-2 py-0.5 rounded-sm text-caption font-semibold', categoryTint14[cat], categoryText[cat])}>
          {e.kind}
        </span>
        {e.endpointName && (
          <span className="text-caption text-muted font-mono">· {e.endpointName}</span>
        )}
        {systemMessage && (
          <Button variant="ghost" size="sm" className="ml-auto" leftIcon={<CopyIcon size={11} />} onClick={() => navigator.clipboard.writeText(systemMessage)}>
            <Trans>Copy</Trans>
          </Button>
        )}
      </header>
      <div className="px-4.5 py-3.5 max-h-[460px] overflow-auto flex-1">{body}</div>
      {vars.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-hairline text-caption text-muted">
          <span className="uppercase tracking-[0.07em] font-semibold"><Trans>variables</Trans></span>
          <div className="flex flex-wrap gap-1.5">
            {vars.map(v => (
              <span key={v} className={cn('px-1.5 py-0.5 rounded-sm font-mono text-caption', categoryTint18[cat], categoryText[cat])}>
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
