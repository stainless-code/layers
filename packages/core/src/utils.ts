import { LayerKeyError } from "./errors";
import type { LayerKey } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sortedObject(value: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(value).sort();
  // null prototype — own `__proto__` must not mutate [[Prototype]] / drop from hash
  const out: Record<string, unknown> = Object.create(null);
  for (const k of keys) {
    out[k] = value[k];
  }
  return out;
}

function formatKeyPath(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) {
    return "key";
  }
  let out = "key";
  for (const segment of path) {
    if (typeof segment === "number") {
      out += `[${segment}]`;
    } else {
      out += `.${String(segment)}`;
    }
  }
  return out;
}

function walkLayerKey(
  value: unknown,
  path: PropertyKey[],
  seen: WeakSet<object>,
): void {
  if (value === undefined) {
    throw new LayerKeyError(
      `${formatKeyPath(path)}: undefined is not JSON-safe`,
      path,
    );
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new LayerKeyError(
        `${formatKeyPath(path)}: non-finite number is not JSON-safe`,
        path,
      );
    }
    return;
  }
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return;
  }
  if (typeof value === "bigint") {
    throw new LayerKeyError(
      `${formatKeyPath(path)}: bigint is not JSON-safe`,
      path,
    );
  }
  if (typeof value === "symbol" || typeof value === "function") {
    throw new LayerKeyError(
      `${formatKeyPath(path)}: ${typeof value} is not JSON-safe`,
      path,
    );
  }
  if (typeof value !== "object") {
    throw new LayerKeyError(
      `${formatKeyPath(path)}: unsupported key segment`,
      path,
    );
  }
  if (seen.has(value)) {
    throw new LayerKeyError(
      `${formatKeyPath(path)}: cyclic structure is not JSON-safe`,
      path,
    );
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkLayerKey(value[i], [...path, i], seen);
    }
    seen.delete(value);
    return;
  }
  if (!isPlainObject(value)) {
    throw new LayerKeyError(
      `${formatKeyPath(path)}: only plain objects are JSON-safe`,
      path,
    );
  }
  for (const k of Object.keys(value)) {
    walkLayerKey(value[k], [...path, k], seen);
  }
  seen.delete(value);
}

/**
 * Ensures a layer key is JSON-safe for {@link hashKey}.
 * Allowed: `string` | `boolean` | `null` | finite `number` | plain objects | arrays of those.
 * Throws {@link LayerKeyError} when a segment is outside that domain.
 *
 * @example
 * ```ts
 * import { assertLayerKey } from "@stainless-code/layers";
 *
 * assertLayerKey(["confirm", filterId ?? "none"]);
 * ```
 */
export function assertLayerKey(key: unknown): asserts key is LayerKey {
  if (!Array.isArray(key)) {
    throw new LayerKeyError("key: must be an array", []);
  }
  walkLayerKey(key, [], new WeakSet());
}

/**
 * Serializes a key deterministically by sorting object properties recursively.
 * Throws {@link LayerKeyError} when the key is not JSON-safe.
 */
export function hashKey(key: LayerKey): string {
  assertLayerKey(key);
  return JSON.stringify(key, (_unused, val) =>
    isPlainObject(val) ? sortedObject(val) : val,
  );
}

/**
 * Produces the canonical identity used to compare layer keys.
 * Throws {@link LayerKeyError} when the key is not JSON-safe (via {@link hashKey}).
 */
export function keySignature(key: LayerKey): string {
  return hashKey(key);
}

/**
 * Element-wise `Object.is` for arrays.
 * Keeps key-filtered snapshot selections stable when `filter()` reallocates
 * but the matched element refs are unchanged.
 */
export function shallowArrayEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}
