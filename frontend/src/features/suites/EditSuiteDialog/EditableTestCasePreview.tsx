import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TestCaseDto, ToolSpecDto } from '../../../api/models';
import { testCasesApi } from '../../../api/test-cases';
import { Button } from '../../../components/ui/Button';
import { EditPencilIcon } from '../../../components/icons';
import useToast from '../../../hooks/useToast';
import { TestCasePreview } from './TestCasePreview';
import { ExpectedOutputEditor } from '../components/ExpectedOutputEditor';
import { expectedFromDto, toMessage, validateExpected } from '../components/expectedOutput';

interface Props {
  testCase: TestCaseDto;
  tools: ToolSpecDto[];
}

export function EditableTestCasePreview({ testCase, tools }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => expectedFromDto(testCase.expectedOutput));
  const qc = useQueryClient();
  const { show: toast } = useToast();

  const save = useMutation({
    mutationFn: () => testCasesApi.update(testCase.id, toMessage(draft)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['test-suites'] });
      toast('Expected output updated', 'success');
      setEditing(false);
    },
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
            Edit expected output
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
      <div className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em] shrink-0">
        Edit expected output
      </div>
      <ExpectedOutputEditor value={draft} tools={tools} onChange={setDraft} fill />
      {save.isError && (
        <span className="text-[12px] text-danger shrink-0">
          {(save.error as Error).message || 'Failed to save'}
        </span>
      )}
      <div className="flex gap-2 justify-end shrink-0">
        <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => save.mutate()}
          disabled={!validateExpected(draft) || save.isPending}
          loading={save.isPending}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
