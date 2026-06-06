import { useState } from 'react';
import { Modal } from '../../../../components/overlays/Modal';
import { Button } from '../../../../components/ui/Button';
import { JsonBlock } from '../../../../components/ui/JsonBlock';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { ServerIcon } from '../../../../components/icons';
import { useRequestPreview } from '../../hooks/useRequestPreview';

/**
 * Per-run "View request" control: opens the exact model request (model + messages + tools)
 * that this run sends for the case, so tool definitions can be verified directly.
 */
export function RequestPreviewButton({ runId, caseId, model }: { runId: string; caseId: string; model: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useRequestPreview(runId, caseId, open);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ServerIcon size={13} />}
        onClick={() => setOpen(true)}
        data-testid={`request-preview-btn-${runId}`}
      >
        Request
      </Button>

      {open && (
        <Modal title={`Request · ${model}`} size="lg" onClose={() => setOpen(false)}>
          {isLoading && <Skeleton height={240} className="rounded-lg" />}
          {isError && <div className="text-body-sm text-danger">Could not load the request for this case.</div>}
          {data && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-body-sm text-secondary">
                <span className="mono">{data.messages.length} messages</span>
                <span className="text-muted">·</span>
                <span className={`mono font-semibold ${data.tools.length > 0 ? 'text-success' : 'text-danger'}`}>
                  {data.tools.length} tools
                </span>
                {data.tools.length > 0 && (
                  <span className="mono text-muted truncate">{data.tools.map(t => t.name).join(', ')}</span>
                )}
              </div>
              <JsonBlock value={data} maxHeight={480} />
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
