import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

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
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-[60px] text-center">
          <div className="text-[28px] text-muted">⚠</div>
          <div className="text-[15px] font-semibold text-primary">Something went wrong</div>
          <div className="text-[13px] text-muted max-w-[400px] leading-relaxed">{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-card rounded-[8px] text-[13px] font-medium text-secondary shadow-[var(--shadow-card)]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
