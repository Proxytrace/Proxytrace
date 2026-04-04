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
    ],
  },
];
