import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { TooltipProvider } from './components/ui/Tooltip';
import { ModeShell } from './app/ModeShell';
import { queryClient } from './app/queryClient';

// App root: just the provider stack. Auth strategy + routing live in app/ModeShell and
// app/AppRoutes; the QueryClient is in app/queryClient.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TooltipProvider>
          <ModeShell />
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
