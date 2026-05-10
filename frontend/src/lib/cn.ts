export function cn(...classes: (string | false | undefined | null | 0)[]): string {
  return classes.filter(Boolean).join(' ');
}
