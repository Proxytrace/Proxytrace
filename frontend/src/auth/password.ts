export const rules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  {
    label: "Contains a lowercase letter",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    label: "Contains an uppercase letter",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    label: "Contains a special character",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

export function passwordIsValid(p: string) {
  return rules.every((r) => r.test(p));
}
