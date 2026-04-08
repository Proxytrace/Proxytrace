import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatisticsService } from '../../core/api/statistics.service';
import { AgentCallsService } from '../../core/api/agent-calls.service';
import { SummaryDto, AgentCallDto } from '../../core/api/models';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styles: ``,
})
export class Dashboard implements OnInit {
  readonly Math = Math;
  private readonly statisticsService = inject(StatisticsService);
  private readonly agentCallsService = inject(AgentCallsService);

  readonly summaryState = signal<LoadState>('loading');
  readonly summary = signal<SummaryDto | null>(null);

  readonly recentTracesState = signal<LoadState>('loading');
  readonly recentTraces = signal<AgentCallDto[]>([]);

  ngOnInit() {
    this.statisticsService.getSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.summaryState.set('loaded');
      },
      error: () => this.summaryState.set('error'),
    });

    this.agentCallsService.getAll({ page: 1, pageSize: 5 }).subscribe({
      next: (result) => {
        this.recentTraces.set(result.items);
        this.recentTracesState.set('loaded');
      },
      error: () => this.recentTracesState.set('error'),
    });
  }

  formatLatency(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  truncateId(id: string): string {
    return id.substring(0, 8) + '…';
  }
}
