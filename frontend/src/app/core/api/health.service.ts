import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const POLL_INTERVAL_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  readonly isOnline = signal<boolean>(false);

  constructor() {
    this.check();
    setInterval(() => this.check(), POLL_INTERVAL_MS);
  }

  private check() {
    this.http.get('/api/health').subscribe({
      next: () => this.isOnline.set(true),
      error: () => this.isOnline.set(false),
    });
  }
}
