import { Select } from '../../../components/ui/Select';
import type { UserRole } from '../../../api/models';
import { USER_ROLES } from '../users';

interface UserRoleSelectProps {
  value: UserRole;
  disabled?: boolean;
  onChange: (role: UserRole) => void;
  'data-testid'?: string;
}

/** Inline role picker used per row to promote/demote a user. */
export function UserRoleSelect({ value, disabled, onChange, 'data-testid': testId }: UserRoleSelectProps) {
  return (
    <Select
      inputSize="sm"
      value={value}
      disabled={disabled}
      onValueChange={(v) => onChange(v as UserRole)}
      data-testid={testId}
    >
      {USER_ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </Select>
  );
}
