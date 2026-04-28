import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { AgentCallDto } from '../../../core/api/models';

@Component({
  selector: 'app-trace-detail',
  imports: [],
  templateUrl: './trace-detail.html',
  styles: `
    @keyframes slide-in {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .backdrop { animation: fade-in 0.18s ease-out; }
    .panel    { animation: slide-in 0.24s cubic-bezier(0.16, 1, 0.3, 1); }
  `,
})
export class TraceDetail {
  @Input({ required: true }) trace!: AgentCallDto;
  @Output() closeDialog = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  close() { this.closeDialog.emit(); }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      system: 'System', user: 'User', assistant: 'Assistant', tool: 'Tool',
    };
    return labels[role] ?? role;
  }

  roleColor(role: string): string {
    const c: Record<string, string> = {
      system: '#8b5cf6', user: '#06b6d4', assistant: '#10b981', tool: '#f59e0b',
    };
    return c[role] ?? '#a1a1aa';
  }

  statusColor(s: number): string {
    return s === 200 ? 'var(--success)' : s >= 400 && s < 500 ? 'var(--warn)' : 'var(--danger)';
  }

  formatLatency(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  formatCost(eur: number): string {
    if (eur < 0.0001) return `€${eur.toExponential(2)}`;
    if (eur < 0.01) return `€${eur.toFixed(5)}`;
    return `€${eur.toFixed(4)}`;
  }
}
