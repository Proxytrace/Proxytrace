export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal });
    return res.ok;
  } catch {
    return false;
  }
}
