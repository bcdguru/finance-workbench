/**
 * Dependency-free JSON Schema validator (subset) and sample generator.
 *
 * Why not zod here: artifact schemas live in each skill's `skill.json` as data,
 * not code (architecture FR-11 — skills are versioned data, not TypeScript). The
 * same JSON Schema object is handed to an LLM provider as the structured-output
 * spec, so keeping it as plain JSON keeps the gateway provider-agnostic.
 *
 * Supported keywords: type, enum, const, properties, required, items.
 * Unknown keywords are ignored leniently.
 */

export type JsonSchema = Record<string, any>;

export interface ValidationError {
  path: string;
  message: string;
}

export function validate(value: unknown, schema: JsonSchema, path = "$"): ValidationError[] {
  const errors: ValidationError[] = [];

  if (schema.const !== undefined) {
    if (!deepEqual(value, schema.const)) {
      errors.push({ path, message: `expected const ${JSON.stringify(schema.const)}` });
    }
    return errors;
  }

  if (schema.enum) {
    if (!schema.enum.some((e: unknown) => deepEqual(e, value))) {
      errors.push({ path, message: `value ${JSON.stringify(value)} not in enum [${schema.enum.join(", ")}]` });
    }
    return errors;
  }

  const t: string | undefined = schema.type;
  if (t && !checkType(value, t)) {
    errors.push({ path, message: `expected type ${t}, got ${describe(value)}` });
    return errors;
  }

  if (t === "object" || schema.properties || schema.required) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push({ path, message: "expected object" });
      return errors;
    }
    const obj = value as Record<string, unknown>;
    for (const req of schema.required ?? []) {
      if (!(req in obj)) errors.push({ path: `${path}.${req}`, message: "missing required property" });
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in obj) errors.push(...validate(obj[k], sub as JsonSchema, `${path}.${k}`));
    }
  }

  if (t === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validate(item, schema.items, `${path}[${i}]`)));
  }

  return errors;
}

/**
 * Produce a minimal valid instance from a schema. Used by the scripted provider
 * so it can always return a schema-conformant artifact even with no canned
 * fixture for a given skill.
 */
export function sampleFromSchema(schema: JsonSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case "object": {
      const out: Record<string, unknown> = {};
      const required = new Set<string>(schema.required ?? []);
      for (const [k, sub] of Object.entries(schema.properties ?? {})) {
        if (required.has(k)) out[k] = sampleFromSchema(sub as JsonSchema);
      }
      return out;
    }
    case "array":
      return schema.items ? [sampleFromSchema(schema.items)] : [];
    case "string":
      return "";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    default:
      return null;
  }
}

function checkType(v: unknown, t: string): boolean {
  switch (t) {
    case "object":
      return typeof v === "object" && v !== null && !Array.isArray(v);
    case "array":
      return Array.isArray(v);
    case "string":
      return typeof v === "string";
    case "number":
      return typeof v === "number";
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "boolean":
      return typeof v === "boolean";
    case "null":
      return v === null;
    default:
      return true;
  }
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
