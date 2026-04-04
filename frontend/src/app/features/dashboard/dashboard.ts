import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface StatCard {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styles: ``,
})
export class Dashboard {
  readonly stats: StatCard[] = [
    { label: 'Total Traces', value: '—', delta: 'No data yet', positive: true },
    { label: 'Agents Detected', value: '—', delta: 'No data yet', positive: true },
    { label: 'Test Suites', value: '—', delta: 'No data yet', positive: true },
    { label: 'Avg Latency', value: '—', delta: 'No data yet', positive: true },
  ];
}
