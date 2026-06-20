import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from '../../../components/ui/Button';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { Tabs } from '../../../components/ui/Tabs';
import { ZapIcon } from '../../../components/icons';
import { useIngestionBase } from '../../../hooks/useIngestionBase';
import { ingestionUrl } from '../../../lib/ingestion';
import { buildQuickStartSnippets, type SnippetLanguage } from '../../../lib/ingestionSnippets';

interface GetStartedStepProps {
  projectName: string;
  modelName: string;
  error: string | null;
  loading: boolean;
  onGetStarted: () => void;
}

export function GetStartedStep({ projectName, modelName, error, loading, onGetStarted }: GetStartedStepProps) {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- code snippet language id, not UI copy
  const [lang, setLang] = useState<SnippetLanguage>('python');

  const proxyBase = useIngestionBase();
  const baseUrl = ingestionUrl(projectName, proxyBase);
  const snippets = buildQuickStartSnippets(baseUrl, modelName);
  const active = snippets.find(s => s.id === lang) ?? snippets[0];

  return (
    <div className="flex flex-col gap-5" data-testid="setup-get-started">
      <CodeBlock heading={t`Your project's OpenAI-compatible endpoint`} content={baseUrl} maxLines={1} />

      <div className="flex flex-col gap-2">
        <Tabs
          value={active.id}
          onChange={v => setLang(v as SnippetLanguage)}
          items={snippets.map(s => ({ value: s.id, label: s.label, 'data-testid': `setup-snippet-tab-${s.id}` }))}
        />
        <CodeBlock content={active.code} language={active.language} maxLines={14} />
      </div>

      <p className="text-body-sm text-muted leading-relaxed">
        <Trans>
          No new credentials needed — your upstream provider key keeps working. You can still
          issue dedicated Proxytrace keys later from the Providers page.
        </Trans>
      </p>

      {error && <p className="text-body text-danger">{error}</p>}

      <Button
        data-testid="setup-get-started-btn"
        variant="primary"
        size="lg"
        fullWidth
        loading={loading}
        leftIcon={<ZapIcon size={16} />}
        className="btn-sheen"
        onClick={onGetStarted}
      >
        <Trans>Get started</Trans>
      </Button>
    </div>
  );
}
