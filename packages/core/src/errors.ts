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

/** Thrown when a layer key is not JSON-safe (from `assertLayerKey` / `hashKey`). */
export class LayerKeyError extends Error {
  readonly path: ReadonlyArray<PropertyKey>;
  constructor(message: string, path: ReadonlyArray<PropertyKey> = []) {
    super(message);
    this.name = "LayerKeyError";
    this.path = path;
  }
}

/**
 * Narrows an unknown synchronous throw to {@link LayerKeyError}.
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

/** Why {@link LayerCancelledError} rejected an `open()` promise. */
export type LayerCancelReason =
  | "parentDismiss"
  | "groupDispose"
  | "cancelAll"
  | "stackDisconnect";

/**
 * Rejects `open()` when a stack is torn down without a completion response
 * (`cancelAll`, parent dismiss drain, group dispose, host disconnect).
 */
export class LayerCancelledError extends Error {
  readonly reason: LayerCancelReason;
  constructor(reason: LayerCancelReason = "cancelAll") {
    super(`LayerCancelledError: ${reason}`);
    this.name = "LayerCancelledError";
    this.reason = reason;
  }
}

/**
 * Narrows an unknown rejection to {@link LayerCancelledError}.
 *
 * @example
 * ```ts
 * import { isLayerCancelledError } from "@stainless-code/layers";
 *
 * try {
 *   await confirm.open(payload);
 * } catch (error) {
 *   if (isLayerCancelledError(error)) return;
 *   throw error;
 * }
 * ```
 */
export function isLayerCancelledError(
  value: unknown,
): value is LayerCancelledError {
  return value instanceof LayerCancelledError;
}
