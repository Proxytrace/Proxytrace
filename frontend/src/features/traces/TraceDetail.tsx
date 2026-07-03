// The trace-detail drawer's public entry point: Traces renders it in place, and other features
// (the anomaly dashboard) import it from here instead of reaching into this feature's internals.
// All logic and rendering live in components/TraceDetailPanel.tsx; the ?trace= selection hook is
// shared app-wide as hooks/useSelectedTrace.
export { TraceDetailPanel as TraceDetail } from './components/TraceDetailPanel';
