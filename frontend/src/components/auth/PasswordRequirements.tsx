import { rules } from "../../auth/password";

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted">
      {rules.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.label} className={ok ? "text-success" : ""}>
            <span aria-hidden>{ok ? "✓ " : "· "}</span>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
