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
        path: 'suites',
        loadComponent: () =>
          import('./features/suites/suites').then((m) => m.Suites),
      },
      {
        path: 'runs',
        loadComponent: () =>
          import('./features/runs/runs').then((m) => m.Runs),
      },
      {
        path: 'providers',
        loadComponent: () =>
          import('./features/providers/providers').then((m) => m.Providers),
      },
    ],
  },
];
