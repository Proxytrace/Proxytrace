import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ProvidersService,
  ProviderDto,
  ApiKeyDto,
  ProjectDto,
  OrganizationDto,
  CreateProviderRequest,
} from '../../core/api/providers.service';

type LoadState = 'loading' | 'loaded' | 'error';

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: '#10b981',
  OpenAI: '#8b5cf6',
  Google: '#06b6d4',
  Azure: '#3b82f6',
  Mistral: '#f59e0b',
};

@Component({
  selector: 'app-providers',
  imports: [FormsModule],
  templateUrl: './providers.html',
})
export class Providers implements OnInit {
  private readonly svc = inject(ProvidersService);

  readonly loadState = signal<LoadState>('loading');
  readonly providers = signal<ProviderDto[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly keys = signal<ApiKeyDto[]>([]);
  readonly keysState = signal<LoadState>('loaded');
  readonly projects = signal<ProjectDto[]>([]);
  readonly organizations = signal<OrganizationDto[]>([]);

  // New provider form
  readonly showNewProvider = signal(false);
  readonly newProvider = signal<CreateProviderRequest>({ name: '', endpoint: '', upstreamApiKey: '', organizationId: '' });
  readonly savingProvider = signal(false);

  // New key form
  readonly showNewKey = signal(false);
  readonly newKeyName = signal('');
  readonly newKeyProjectId = signal('');
  readonly savingKey = signal(false);
  readonly newlyCreatedKey = signal<ApiKeyDto | null>(null);

  // Delete provider dialog
  readonly showDeleteProviderDialog = signal(false);
  readonly deleteProviderNameInput = signal('');
  readonly deletingProvider = signal(false);

  // Delete key dialog
  readonly deleteKeyTarget = signal<ApiKeyDto | null>(null);
  readonly deleteKeyNameInput = signal('');
  readonly deletingKey = signal(false);

  // Reveal upstream key
  readonly upstreamKeyRevealed = signal(false);

  // Snackbar
  readonly snackbarMessage = signal<string | null>(null);
  private snackbarTimer: ReturnType<typeof setTimeout> | null = null;

  readonly selected = computed(() => this.providers().find(p => p.id === this.selectedId()) ?? null);
  readonly deleteProviderNameMatches = computed(() =>
    this.deleteProviderNameInput() === (this.selected()?.name ?? ''));
  readonly deleteKeyNameMatches = computed(() =>
    this.deleteKeyNameInput() === (this.deleteKeyTarget()?.name ?? ''));

  ngOnInit() {
    this.loadProviders();
    this.svc.getProjects().subscribe({ next: r => this.projects.set(r.items) });
    this.svc.getOrganizations().subscribe({ next: r => this.organizations.set(r.items) });
  }

  private loadProviders() {
    this.loadState.set('loading');
    this.svc.getProviders().subscribe({
      next: r => {
        this.providers.set(r.items);
        this.loadState.set('loaded');
        if (r.items.length > 0 && !this.selectedId()) {
          this.selectProvider(r.items[0].id);
        }
      },
      error: () => this.loadState.set('error'),
    });
  }

  selectProvider(id: string) {
    this.selectedId.set(id);
    this.showNewKey.set(false);
    this.newlyCreatedKey.set(null);
    this.upstreamKeyRevealed.set(false);
    this.loadKeys(id);
  }

  private loadKeys(providerId: string) {
    this.keysState.set('loading');
    this.svc.getKeys(providerId).subscribe({
      next: ks => { this.keys.set(ks); this.keysState.set('loaded'); },
      error: () => this.keysState.set('error'),
    });
  }

  // ── Add provider ────────────────────────────────────────────────────────────

  openNewProvider() {
    this.showNewProvider.set(true);
    this.newProvider.set({ name: '', endpoint: '', upstreamApiKey: '', organizationId: this.organizations()[0]?.id ?? '' });
  }

  cancelNewProvider() { this.showNewProvider.set(false); }

  submitNewProvider() {
    const req = this.newProvider();
    if (!req.name || !req.endpoint || !req.upstreamApiKey || !req.organizationId) return;
    this.savingProvider.set(true);
    this.svc.createProvider(req).subscribe({
      next: p => {
        this.providers.update(list => [...list, p]);
        this.showNewProvider.set(false);
        this.savingProvider.set(false);
        this.selectProvider(p.id);
      },
      error: () => this.savingProvider.set(false),
    });
  }

  // ── Delete provider ─────────────────────────────────────────────────────────

  openDeleteProviderDialog() {
    this.deleteProviderNameInput.set('');
    this.showDeleteProviderDialog.set(true);
  }

  cancelDeleteProvider() { this.showDeleteProviderDialog.set(false); }

  confirmDeleteProvider() {
    const p = this.selected();
    if (!p || !this.deleteProviderNameMatches()) return;
    this.deletingProvider.set(true);
    this.svc.deleteProvider(p.id).subscribe({
      next: () => {
        const remaining = this.providers().filter(x => x.id !== p.id);
        this.providers.set(remaining);
        this.selectedId.set(remaining[0]?.id ?? null);
        this.keys.set([]);
        this.showDeleteProviderDialog.set(false);
        this.deletingProvider.set(false);
        if (remaining.length > 0) this.loadKeys(remaining[0].id);
      },
      error: () => this.deletingProvider.set(false),
    });
  }

  // ── Generate key ────────────────────────────────────────────────────────────

  openNewKey() {
    this.showNewKey.set(true);
    this.newKeyName.set('');
    this.newKeyProjectId.set(this.projects()[0]?.id ?? '');
    this.newlyCreatedKey.set(null);
  }

  cancelNewKey() { this.showNewKey.set(false); }

  submitNewKey() {
    const providerId = this.selectedId();
    if (!providerId || !this.newKeyName() || !this.newKeyProjectId()) return;
    this.savingKey.set(true);
    this.svc.createKey(providerId, { name: this.newKeyName(), projectId: this.newKeyProjectId() }).subscribe({
      next: key => {
        this.keys.update(list => [...list, key]);
        this.showNewKey.set(false);
        this.savingKey.set(false);
        this.newlyCreatedKey.set(key);
      },
      error: () => this.savingKey.set(false),
    });
  }

  dismissCreatedKey() { this.newlyCreatedKey.set(null); }

  // ── Delete key ──────────────────────────────────────────────────────────────

  openDeleteKeyDialog(key: ApiKeyDto) {
    this.deleteKeyTarget.set(key);
    this.deleteKeyNameInput.set('');
  }

  cancelDeleteKey() { this.deleteKeyTarget.set(null); }

  confirmDeleteKey() {
    const key = this.deleteKeyTarget();
    const providerId = this.selectedId();
    if (!key || !providerId || !this.deleteKeyNameMatches()) return;
    this.deletingKey.set(true);
    this.svc.deleteKey(providerId, key.id).subscribe({
      next: () => {
        this.keys.update(list => list.filter(k => k.id !== key.id));
        if (this.newlyCreatedKey()?.id === key.id) this.newlyCreatedKey.set(null);
        this.deleteKeyTarget.set(null);
        this.deletingKey.set(false);
      },
      error: () => this.deletingKey.set(false),
    });
  }

  // ── Snackbar ────────────────────────────────────────────────────────────────

  copyToClipboard(text: string, label = 'Copied to clipboard') {
    navigator.clipboard.writeText(text).then(() => this.showSnackbar(label));
  }

  private showSnackbar(message: string) {
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    this.snackbarMessage.set(message);
    this.snackbarTimer = setTimeout(() => this.snackbarMessage.set(null), 2200);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  providerColor(name: string): string {
    return PROVIDER_COLORS[name] ?? '#8b5cf6';
  }

  maskKey(key: string): string {
    return key.length <= 8 ? '••••••••' : key.slice(0, 7) + '••••••••••••' + key.slice(-4);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
