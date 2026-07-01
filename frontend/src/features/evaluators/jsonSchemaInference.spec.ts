import { beforeAll, describe, it, expect } from "vitest";
import { i18n } from "../../i18n";
import { inferJsonSchema, generateSchemaFromExample } from "./jsonSchemaInference";

// Activate an empty catalog so i18n._() resolves MessageDescriptors to their source strings.
beforeAll(() => i18n.loadAndActivate({ locale: "en", messages: {} }));

describe("inferJsonSchema", () => {
  it("maps primitives to their schema types", () => {
    expect(inferJsonSchema(null)).toEqual({ type: "null" });
    expect(inferJsonSchema(true)).toEqual({ type: "boolean" });
    expect(inferJsonSchema("hi")).toEqual({ type: "string" });
  });

  it("distinguishes integers from floats", () => {
    expect(inferJsonSchema(3)).toEqual({ type: "integer" });
    expect(inferJsonSchema(3.5)).toEqual({ type: "number" });
  });

  it("infers object properties and requires every observed key", () => {
    expect(inferJsonSchema({ name: "Ada", age: 36 })).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
      required: ["name", "age"],
    });
  });

  it("omits properties/required for an empty object", () => {
    expect(inferJsonSchema({})).toEqual({ type: "object" });
  });

  it("infers homogeneous array items", () => {
    expect(inferJsonSchema(["a", "b"])).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("uses anyOf for mixed array element types", () => {
    expect(inferJsonSchema(["a", 1])).toEqual({
      type: "array",
      items: { anyOf: [{ type: "string" }, { type: "integer" }] },
    });
  });

  it("leaves items unconstrained for an empty array", () => {
    expect(inferJsonSchema([])).toEqual({ type: "array" });
  });

  it("recurses through nested structures", () => {
    expect(inferJsonSchema({ tags: [{ id: 1 }] })).toEqual({
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "integer" } },
            required: ["id"],
          },
        },
      },
      required: ["tags"],
    });
  });
});

describe("generateSchemaFromExample", () => {
  it("returns a pretty-printed schema for valid JSON", () => {
    const res = generateSchemaFromExample('{"ok": true}');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(JSON.parse(res.schema)).toEqual({
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      });
      expect(res.schema).toContain("\n");
    }
  });

  it("rejects empty input", () => {
    const res = generateSchemaFromExample("  ");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(i18n._(res.error)).toBe("Paste an example JSON value first.");
  });

  it("reports invalid JSON with the parser detail", () => {
    const res = generateSchemaFromExample("{nope");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(i18n._(res.error)).toMatch(/^Not valid JSON — /);
  });
});
