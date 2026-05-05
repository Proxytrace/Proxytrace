import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavItem } from './NavItem';
import { checkHealth } from '../../api/health';

const navItems = [
  { label: 'Dashboard', icon: 'grid', to: '/dashboard' },
  { label: 'Traces', icon: 'activity', to: '/traces', badge: '60' },
  { label: 'Agents', icon: 'users', to: '/agents' },
  { label: 'Test Suites', icon: 'checkbox', to: '/suites' },
  { label: 'Evaluators', icon: 'scale', to: '/evaluators' },
  { label: 'Test Runs', icon: 'play', to: '/runs' },
  { label: 'Proposals', icon: 'sparkles', to: '/proposals', badge: '2', badgeAccent: true },
  { label: 'Providers', icon: 'server', to: '/providers' },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  checkbox: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  scale: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 9l9-6 9 6M5 10v6a7 7 0 0 0 14 0v-6"/>
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  sparkles: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
    </svg>
  ),
  server: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
};

export function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const ok = await checkHealth();
      if (!cancelled) setOnline(ok);
    };
    poll();
    const timer = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  const pageLabel = navItems.find(n => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';

  return (
    <div style={{
      display: 'flex', width: '100%', height: '100vh', overflow: 'hidden',
      background: 'var(--bg-primary)', position: 'relative', zIndex: 1,
    }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? '64px' : '232px',
        background: 'var(--bg-sidebar)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        transition: 'width 0.2s ease',
        position: 'relative', zIndex: 2,
        boxShadow: 'var(--shadow-sidebar)',
        margin: '10px 0 10px 10px',
        borderRadius: '18px',
        height: 'calc(100vh - 20px)',
        overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{
          height: '60px', display: 'flex', alignItems: 'center',
          borderBottom: '1px solid var(--hairline)', flexShrink: 0,
          padding: collapsed ? '0' : '0 18px',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
            background: 'linear-gradient(135deg, #c9944a, #a57038)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '13px',
            boxShadow: '0 4px 16px -4px rgba(201, 148, 74, 0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}>T</div>
          {!collapsed && (
            <div style={{ marginLeft: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em' }}>Trsr</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-1px' }}>v0.1 · alpha</div>
            </div>
          )}
        </div>

        {/* Section label */}
        {!collapsed && (
          <div style={{
            padding: '18px 18px 6px',
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            Workspace
          </div>
        )}

        {/* Nav */}
        <nav style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto',
          padding: collapsed ? '12px 8px' : '6px 12px',
        }}>
          {navItems.map(item => (
            <NavItem
              key={item.to}
              label={item.label}
              icon={ICONS[item.icon]}
              to={item.to}
              badge={'badge' in item ? item.badge : undefined}
              badgeAccent={'badgeAccent' in item ? item.badgeAccent : undefined}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Project footer */}
        <div style={{ borderTop: '1px solid var(--hairline)', padding: collapsed ? '12px 8px' : '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            cursor: 'pointer', borderRadius: '8px', padding: '4px',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
              background: 'linear-gradient(135deg, #6b9eaa, #4a7a88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 600, fontSize: '12px',
            }}>DP</div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Default Project</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>3 members</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: '56px', flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: '12px',
          background: 'rgba(30, 30, 34, 0.75)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          position: 'relative', zIndex: 1,
          margin: '10px 10px 0 10px',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-topbar)',
        }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ color: 'var(--text-muted)', padding: '6px', borderRadius: '6px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Default Project</span>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontWeight: 600 }}>{pageLabel}</span>
          </div>

          <div style={{
            flex: 1, maxWidth: '460px', margin: '0 auto',
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '10px',
            fontSize: '13px', color: 'var(--text-muted)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <span>Search traces, agents, suites…</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '3px' }}>
              <kbd style={{ padding: '1px 6px', background: 'var(--bg-card-2)', borderRadius: '4px', fontSize: '10px', fontFamily: "'JetBrains Mono',monospace" }}>⌘</kbd>
              <kbd style={{ padding: '1px 6px', background: 'var(--bg-card-2)', borderRadius: '4px', fontSize: '10px', fontFamily: "'JetBrains Mono',monospace" }}>K</kbd>
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 10px',
            background: online === false ? 'rgba(217,85,85,0.12)' : online === true ? 'rgba(61,170,111,0.12)' : 'var(--warn-subtle)',
            border: `1px solid ${online === false ? 'rgba(217,85,85,0.25)' : online === true ? 'rgba(61,170,111,0.25)' : 'rgba(245,158,11,0.25)'}`,
            borderRadius: '100px',
            fontSize: '12px', fontWeight: 600,
            color: online === false ? '#d95555' : online === true ? '#3daa6f' : 'var(--warn)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <span className={online === true ? 'pulse-dot' : ''} style={{ width: '6px', height: '6px', borderRadius: '50%', background: online === false ? '#d95555' : online === true ? '#3daa6f' : 'var(--warn)', display: 'inline-block' }} />
            {online === false ? 'Offline' : online === true ? 'Online' : 'Connecting…'}
          </div>

          <button style={{ color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            <span style={{ position: 'absolute', top: '6px', right: '6px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 0 2px var(--bg-primary)' }} />
          </button>

          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
            background: 'linear-gradient(135deg, #c9944a, #a57038)', borderRadius: 8,
            fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 14px -4px rgba(201, 148, 74, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Test Suite
          </button>

          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #c9944a, #d4915c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 600, color: '#fff',
          }}>JK</div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1, overflow: 'hidden', padding: '16px 10px',
          background: 'transparent', position: 'relative', zIndex: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
