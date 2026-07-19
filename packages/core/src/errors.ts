/** Provides validator-independent details for one payload failure. */
export interface ValidationIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey>;
}

/** Normalizes payload failures across supported validator styles. */
export class PayloadValidationError extends Error {
  readonly issues: ReadonlyArray<ValidationIssue>;
  constructor(
    issues: ReadonlyArray<ValidationIssue>,
    options?: { cause?: unknown },
  ) {
    super(issues[0]?.message ?? "Payload validation failed", options);
    this.name = "PayloadValidationError";
    this.issues = issues;
  }
}

/**
 * Narrows an unknown rejection to {@link PayloadValidationError}.
 *
 * @example
 * ```ts
 * import { isPayloadValidationError } from "@stainless-code/layers";
 *
 * function validationMessages(error: unknown) {
 *   return isPayloadValidationError(error)
 *     ? error.issues.map((issue) => issue.message)
 *     : [];
 * }
 * ```
 */
export function isPayloadValidationError(
  value: unknown,
): value is PayloadValidationError {
  return value instanceof PayloadValidationError;
}

/** Thrown when a layer key is not JSON-safe (see {@link assertLayerKey}). */
export class LayerKeyError extends Error {
  readonly path: ReadonlyArray<PropertyKey>;
  constructor(message: string, path: ReadonlyArray<PropertyKey> = []) {
    super(message);
    this.name = "LayerKeyError";
    this.path = path;
  }
}

/**
 * Narrows an unknown throw/rejection to {@link LayerKeyError}.
 *
 * @example
 * ```ts
 * import { isLayerKeyError } from "@stainless-code/layers";
 *
 * try {
 *   client.open({ key: [maybeId], payload });
 * } catch (error) {
 *   if (isLayerKeyError(error)) {
 *     console.error(error.path, error.message);
 *   }
 * }
 * ```
 */
export function isLayerKeyError(value: unknown): value is LayerKeyError {
  return value instanceof LayerKeyError;
}
