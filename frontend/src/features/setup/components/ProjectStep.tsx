import type { KeyboardEvent } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { formInputCls } from '../../../components/ui/classes';

interface ProjectStepProps {
  projectName: string;
  error: string | null;
  onProjectNameChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function ProjectStep({ projectName, error, onProjectNameChange, onKeyDown }: ProjectStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Project name" error={error ?? undefined}>
        <input
          className={formInputCls}
          placeholder="e.g. Customer Support Bot"
          value={projectName}
          onChange={e => onProjectNameChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
      </FormField>
    </div>
  );
}
