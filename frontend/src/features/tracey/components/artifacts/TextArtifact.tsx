import { CodeBlock } from '../../../../components/ui/CodeBlock';
import type { TextArtifact as TextArtifactData } from '../../tracey-artifacts';

/**
 * Renders a text artifact. JSON/code go through CodeBlock; markdown is rendered as plain prose
 * (never via dangerouslySetInnerHTML — DESIGN §9).
 */
export function TextArtifact({ artifact }: { artifact: TextArtifactData }) {
  if (artifact.format === 'markdown') {
    return (
      <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-primary">
        {artifact.content}
      </div>
    );
  }
  return (
    <CodeBlock
      content={artifact.content}
      language={artifact.format === 'json' ? 'json' : undefined}
      maxLines={1000}
    />
  );
}
