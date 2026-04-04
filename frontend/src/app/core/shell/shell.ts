import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
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

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'grid', route: '/dashboard' },
    { label: 'Traces', icon: 'activity', route: '/traces' },
  ];

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
}
