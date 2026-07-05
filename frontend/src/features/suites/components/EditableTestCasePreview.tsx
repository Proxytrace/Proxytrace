import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TestCaseDto, ToolSpecDto } from '../../../api/models';
import { useUpdateTestCaseExpected } from '../hooks/useSuiteMutations';
import { Button } from '../../../components/ui/Button';
import { EditPencilIcon } from '../../../components/icons';
import useToast from '../../../hooks/useToast';
import { TestCasePreview } from './TestCasePreview';
import { ExpectedOutputEditor } from '../../../components/expected-output/ExpectedOutputEditor';
import { expectedFromDto, toMessage, validateExpected } from '../../../components/expected-output/expectedOutput';

interface Props {
  testCase: TestCaseDto;
  tools: ToolSpecDto[];
}

export function EditableTestCasePreview({ testCase, tools }: Props) {
  const { t } = useLingui();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => expectedFromDto(testCase.expectedOutput));
  const { show: toast } = useToast();

  const save = useUpdateTestCaseExpected(testCase.id, () => {
    // eslint-disable-next-line lingui/no-unlocalized-strings -- toast tone token, not UI copy
    toast(t`Expected output updated`, 'success');
    setEditing(false);
  });

  if (!editing) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <div className="px-4 pt-3 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<EditPencilIcon size={13} />}
            onClick={() => { setDraft(expectedFromDto(testCase.expectedOutput)); setEditing(true); }}
          >
            <Trans>Edit expected output</Trans>
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <TestCasePreview testCase={testCase} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 px-4 py-4 flex flex-col gap-3">
      <div className="text-caption font-semibold text-muted uppercase tracking-[0.08em] shrink-0">
        <Trans>Edit expected output</Trans>
      </div>
      <ExpectedOutputEditor value={draft} tools={tools} onChange={setDraft} fill />
      {save.isError && (
        <span className="text-body text-danger shrink-0">
          {(save.error as Error).message || t`Failed to save`}
        </span>
      )}
      <div className="flex gap-2 justify-end shrink-0">
        <Button variant="secondary" size="sm" onClick={() => setEditing(false)}><Trans>Cancel</Trans></Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => save.mutate(toMessage(draft))}
          disabled={!validateExpected(draft) || save.isPending}
          loading={save.isPending}
        >
          <Trans>Save</Trans>
        </Button>
      </div>
    </div>
  );
}
