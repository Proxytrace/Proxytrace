import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from './ui/Button';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-15 text-center">
          <div className="text-display text-muted">⚠</div>
          <div className="text-h1 font-semibold text-primary"><Trans>Something went wrong</Trans></div>
          <div className="text-title text-muted max-w-[400px] leading-relaxed">{this.state.error.message}</div>
          <Button variant="secondary" size="sm" onClick={() => this.setState({ error: null })}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
