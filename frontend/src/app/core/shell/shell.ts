import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styles: `
    :host {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background-color: var(--bg-primary);
    }
  `,
})
export class Shell {
  readonly sidebarCollapsed = signal(false);

  readonly navSections: NavSection[] = [
    {
      label: 'Observe',
      items: [
        { label: 'Dashboard', icon: 'grid', route: '/dashboard' },
        { label: 'Traces', icon: 'activity', route: '/traces' },
        { label: 'Agents', icon: 'agents', route: '/agents' },
      ],
    },
    {
      label: 'Evaluate',
      items: [
        { label: 'Test Suites', icon: 'clipboard', route: '/test-suites' },
        { label: 'Test Runs', icon: 'play', route: '/test-runs' },
      ],
    },
    {
      label: 'Improve',
      items: [
        { label: 'Optimization', icon: 'sparkles', route: '/optimization' },
      ],
    },
  ];

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
}
