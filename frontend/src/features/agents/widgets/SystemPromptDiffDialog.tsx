import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AgentVersionDto } from '../../../api/models';
import { Modal } from '../../../components/overlays/Modal';
import { Select } from '../../../components/ui/Select';
import { ChevronRightIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { diffLines, type DiffKind } from '../diffLines';

interface Props {
  versions: AgentVersionDto[];
  initialBase: number;
  initialCompare: number;
  onClose: () => void;
}

const ROW_CLS: Record<DiffKind, string> = {
  same: cn('text-secondary'),
  add: cn('bg-success-subtle text-success'),
  del: cn('bg-danger-subtle text-danger'),
};

const SIGN: Record<DiffKind, string> = { same: ' ', add: '+', del: '-' };

export function SystemPromptDiffDialog({ versions, initialBase, initialCompare, onClose }: Props) {
  const { t } = useLingui();
  const ordered = useMemo(
    () => [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  );

  const [base, setBase] = useState(initialBase);
  const [compare, setCompare] = useState(initialCompare);

  const baseMsg = ordered.find(v => v.versionNumber === base)?.systemMessage ?? '';
  const compareMsg = ordered.find(v => v.versionNumber === compare)?.systemMessage ?? '';

  const rows = useMemo(() => diffLines(baseMsg, compareMsg), [baseMsg, compareMsg]);
  const added = rows.filter(r => r.kind === 'add').length;
  const removed = rows.filter(r => r.kind === 'del').length;

  return (
    <Modal title={t`System Prompt diff`} onClose={onClose} maxWidth={860}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* eslint-disable-next-line lingui/no-unlocalized-strings -- test id, not UI copy */}
        <VersionSelect label={t`Base`} value={base} onChange={setBase} options={ordered} testid="diff-base-select" />
        <ChevronRightIcon size={16} className="text-muted shrink-0 mt-5" />
        {/* eslint-disable-next-line lingui/no-unlocalized-strings -- test id, not UI copy */}
        <VersionSelect label={t`Compare`} value={compare} onChange={setCompare} options={ordered} testid="diff-compare-select" />
        <div className="ml-auto flex items-center gap-3 text-body-sm shrink-0 self-end pb-1.5">
          <span className="text-success font-semibold"><Trans>+{added} added</Trans></span>
          <span className="text-danger font-semibold"><Trans>−{removed} removed</Trans></span>
        </div>
      </div>
      <div
        className="rounded-md bg-surface overflow-auto max-h-[60vh] font-mono text-body leading-[1.6]"
        data-testid="system-prompt-diff"
      >
        {base === compare ? (
          <div className="px-3 py-4 text-muted italic"><Trans>Same version on both sides — nothing to compare.</Trans></div>
        ) : (
          rows.map((row, i) => (
            <div key={i} className={`flex gap-2 px-3 py-0.5 whitespace-pre-wrap ${ROW_CLS[row.kind]}`}>
              <span className="select-none shrink-0 w-3 text-center opacity-70">{SIGN[row.kind]}</span>
              <span className="min-w-0 break-words">{row.text || ' '}</span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

interface SelectProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  options: AgentVersionDto[];
  testid: string;
}

function VersionSelect({ label, value, onChange, options, testid }: SelectProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption font-medium uppercase tracking-wide text-secondary">{label}</span>
      <Select
        inputSize="sm"
        value={String(value)}
        onValueChange={v => onChange(Number(v))}
        data-testid={testid}
        className="font-mono font-medium min-w-[5rem]"
      >
        {options.map(v => (
          <option key={v.id} value={v.versionNumber}>
            v{v.versionNumber}
          </option>
        ))}
      </Select>
    </label>
  );
}
