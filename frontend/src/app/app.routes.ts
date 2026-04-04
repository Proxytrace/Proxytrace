import { Routes } from '@angular/router';
import { Shell } from './core/shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'traces',
        loadComponent: () =>
          import('./features/traces/traces').then((m) => m.Traces),
      },
      {
        path: 'agents',
        loadComponent: () =>
          import('./features/agents/agents').then((m) => m.Agents),
      },
      {
        path: 'test-suites',
        loadComponent: () =>
          import('./features/test-suites/test-suites').then((m) => m.TestSuites),
      },
      {
        path: 'test-runs',
        loadComponent: () =>
          import('./features/test-runs/test-runs').then((m) => m.TestRuns),
      },
      {
        path: 'optimization',
        loadComponent: () =>
          import('./features/optimization/optimization').then((m) => m.Optimization),
      },
    ],
  },
];
