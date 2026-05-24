import { useQueryClient } from '@tanstack/react-query';
import { useAuthMode } from '../../auth/authMode';
import { FirstAdminStep } from './components/FirstAdminStep';
import { SetupWizard } from './components/SetupWizard';

export default function Setup() {
  const { data: authMode } = useAuthMode();
  const qc = useQueryClient();

  if (authMode?.mode === 'local' && authMode.setupRequired) {
    return (
      <FirstAdminStep
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['auth-mode'] });
        }}
      />
    );
  }

  return <SetupWizard />;
}
