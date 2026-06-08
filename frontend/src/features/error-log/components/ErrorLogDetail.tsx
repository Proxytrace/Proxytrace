import { Drawer } from '../../../components/overlays/Drawer';
import { Pill } from '../../../components/ui/Pill';
import { CodeBlock } from '../../../components/ui/CodeBlock';
import { fmtDate } from '../../../lib/format';
import type { ApplicationErrorDto } from '../../../api/models';
import { LEVEL_COLOR } from '../errorLogMeta';

interface ErrorLogDetailProps {
  error: ApplicationErrorDto;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="text-[13px] text-primary font-mono break-words">{value}</div>
    </div>
  );
}

export function ErrorLogDetail({ error, onClose }: ErrorLogDetailProps) {
  return (
    <Drawer title={error.message} subtitle={fmtDate(error.createdAt)} onClose={onClose}>
      <div data-testid="error-log-detail" className="flex items-center gap-2">
        <Pill label={error.level} color={LEVEL_COLOR[error.level]} size="md" />
        {error.exceptionType && (
          <span className="text-xs text-muted font-mono">{error.exceptionType}</span>
        )}
      </div>

      <Field label="Source" value={error.category} />

      {error.stackTrace ? (
        <div data-testid="error-log-stacktrace">
          <CodeBlock heading="Stacktrace" content={error.stackTrace} maxLines={20} />
        </div>
      ) : (
        <div className="text-[13px] text-muted">No stacktrace captured for this entry.</div>
      )}
    </Drawer>
  );
}
