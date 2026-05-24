import { describe, it, expect } from "vitest";
import { decode } from "./LocalAuthContext";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

const base = { sub: "u1", email: "a@b.c" };

describe("decode", () => {
  it("decodes a valid, unexpired token", () => {
    const user = decode(jwt({ ...base, exp: Date.now() / 1000 + 3600, role: "Admin" }));
    expect(user).toEqual({ id: "u1", email: "a@b.c", role: "Admin" });
  });

  it("defaults role to Viewer when absent", () => {
    expect(decode(jwt(base))?.role).toBe("Viewer");
  });

  it("rejects an expired token", () => {
    expect(decode(jwt({ ...base, exp: Date.now() / 1000 - 1 }))).toBeNull();
  });

  it("rejects a token missing sub/email", () => {
    expect(decode(jwt({ exp: Date.now() / 1000 + 3600 }))).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(decode("not-a-jwt")).toBeNull();
    expect(decode("")).toBeNull();
  });
});
