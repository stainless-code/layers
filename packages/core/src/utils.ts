import type { LayerKey } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedObject(value: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(value).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = value[k];
  }
  return out;
}

/** Serializes a key deterministically by sorting object properties recursively. */
export function hashKey(key: LayerKey): string {
  return JSON.stringify(key, (_unused, val) =>
    isPlainObject(val) ? sortedObject(val) : val,
  );
}

/** Produces the canonical identity used to compare layer keys. */
export function keySignature(key: LayerKey): string {
  return hashKey(key);
}
