import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { queryClient } from './app/queryClient';
import { ModeShell } from './app/ModeShell';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ModeShell />
      </ToastProvider>
    </QueryClientProvider>
  );
}
