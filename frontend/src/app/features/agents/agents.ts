import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AgentDto, ToolSpecDto } from '../../core/api/models';
import { AgentsService } from '../../core/api/agents.service';

const PALETTE = ['#c9944a', '#6b9eaa', '#3daa6f', '#d4915c', '#d95555', '#a87ab5', '#5b82b0', '#7aaa9a'];

const TYPE_COLORS: Record<string, string> = {
  string: '#8dbecb',
  integer: '#d4915c',
  number: '#d4915c',
  boolean: '#c4b5fd',
  enum: '#6b9eaa',
  object: '#f9a8d4',
  array: '#86efac',
};

@Component({
  selector: 'app-agents',
  templateUrl: './agents.html',
  styles: `:host { display: block; flex: 1; min-height: 0; overflow-y: auto; }`,
})
export class Agents implements OnInit {
  private readonly agentsService = inject(AgentsService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly agents = signal<AgentDto[]>([]);
  readonly selectedAgentId = signal<string | null>(null);
  readonly activeTab = signal<'prompt' | 'tools'>('prompt');
  readonly openTools = signal<Set<string>>(new Set());
  readonly copied = signal(false);
  readonly deleteDialogOpen = signal(false);
  readonly deleteConfirmName = signal('');
  readonly deleting = signal(false);

  readonly selectedAgent = computed(() => {
    const id = this.selectedAgentId();
    return this.agents().find(a => a.id === id) ?? null;
  });

  ngOnInit() {
    const preselect = this.route.snapshot.queryParamMap.get('id');
    this.agentsService.getAll().subscribe({
      next: (result) => {
        this.agents.set(result.items);
        const target = preselect
          ? result.items.find(a => a.id === preselect)
          : null;
        this.selectedAgentId.set((target ?? result.items[0])?.id ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectAgent(id: string) {
    this.selectedAgentId.set(id);
    this.activeTab.set('prompt');
    this.openTools.set(new Set());
  }

  openDeleteDialog() {
    this.deleteConfirmName.set('');
    this.deleteDialogOpen.set(true);
  }

  closeDeleteDialog() {
    this.deleteDialogOpen.set(false);
    this.deleteConfirmName.set('');
  }

  confirmDelete() {
    const agent = this.selectedAgent();
    if (!agent || this.deleteConfirmName() !== agent.name || this.deleting()) return;
    this.deleting.set(true);
    this.agentsService.delete(agent.id).subscribe({
      next: () => {
        this.agents.update(list => list.filter(a => a.id !== agent.id));
        const remaining = this.agents();
        this.selectedAgentId.set(remaining[0]?.id ?? null);
        this.closeDeleteDialog();
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }

  toggleTool(name: string) {
    this.openTools.update(set => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  isToolOpen(name: string) {
    return this.openTools().has(name);
  }

  agentColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
    return PALETTE[hash % PALETTE.length];
  }

  agentColorBg(name: string): string { return this.agentColor(name) + '1e'; }
  agentColorBorder(name: string): string { return this.agentColor(name) + '33'; }
  agentColorGlow(name: string): string { return `0 0 24px ${this.agentColor(name)}33`; }

  typeColor(type: string): string { return TYPE_COLORS[type] ?? '#888'; }
  typeBg(type: string): string { return this.typeColor(type) + '20'; }

  requiredParams(tool: ToolSpecDto): string {
    const req = tool.arguments.filter(a => a.isRequired).map(a => a.name);
    return req.length ? `(${req.join(', ')})` : '()';
  }

  async copyPrompt(text: string) {
    await navigator.clipboard.writeText(text);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatRelative(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)  return `${d}d ago`;
    return this.formatDate(dateStr);
  }

  promptPreview(prompt: string): string {
    return prompt.slice(0, 80).replace(/\n/g, ' ') + (prompt.length > 80 ? '…' : '');
  }
}
