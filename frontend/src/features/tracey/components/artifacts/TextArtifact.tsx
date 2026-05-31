import { CodeBlock } from '../../../../components/ui/CodeBlock';
import type { TextArtifact as TextArtifactData } from '../../tracey-artifacts';
import { Markdown } from '../Markdown';

/**
 * Renders a text artifact. Markdown is rendered through the shared, DESIGN-themed renderer
 * (never via dangerouslySetInnerHTML — DESIGN §9); JSON/code go through CodeBlock with copy +
 * expand affordances and a language tag.
 */
export function TextArtifact({ artifact }: { artifact: TextArtifactData }) {
  if (artifact.format === 'markdown') {
    return <Markdown content={artifact.content} />;
  }
  return (
    <CodeBlock
      content={artifact.content}
      language={artifact.format === 'json' ? 'json' : 'code'}
      maxLines={20}
    />
  );
}
