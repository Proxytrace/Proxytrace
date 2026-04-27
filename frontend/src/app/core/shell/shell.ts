import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs/operators';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
  badgeAccent?: boolean;
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
  private readonly router = inject(Router);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'grid', route: '/dashboard' },
    { label: 'Traces', icon: 'activity', route: '/traces', badge: '60' },
    { label: 'Agents', icon: 'users', route: '/agents' },
    { label: 'Test Suites', icon: 'checkbox', route: '/suites' },
    { label: 'Test Runs', icon: 'play', route: '/runs' },
    { label: 'Proposals', icon: 'sparkles', route: '/proposals', badge: '2', badgeAccent: true },
    { label: 'Providers', icon: 'server', route: '/providers' },
  ];

  readonly currentPageLabel = toSignal(
    this.router.events.pipe(
      startWith(null),
      map(() => this.navItems.find(n => this.router.url.includes(n.route.replace('/', '')))?.label ?? 'Dashboard')
    ),
    { initialValue: 'Dashboard' }
  );

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
}
