export function lastUserSnippet(msgs: { role: string; content: string }[]): string {
  const last = [...msgs].reverse().find(m => m.role === 'user');
  return (last?.content ?? msgs[msgs.length - 1]?.content ?? '').replace(/\s+/g, ' ').trim();
}
