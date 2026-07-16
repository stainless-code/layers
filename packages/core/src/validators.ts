import { PayloadValidationError } from "./errors";
import type { StandardSchemaV1 } from "./standardSchema";

/** Unifies schema libraries and parser functions behind one validation contract. */
export type Validator<Output> =
  | StandardSchemaV1<unknown, Output>
  | ((input: unknown) => Output);

/** Preserves a validator's pre-transform payload type in generic APIs. */
export type InferValidatorInput<V> =
  V extends StandardSchemaV1<infer I, unknown>
    ? I
    : V extends (input: infer I) => unknown
      ? I
      : never;

/** Preserves a validator's post-transform payload type in generic APIs. */
export type InferValidatorOutput<V> =
  V extends StandardSchemaV1<unknown, infer O>
    ? O
    : V extends (input: never) => infer O
      ? O
      : never;

/** Schema/parser **input** for validated `open` / {@link ValidatedLayerHandle}. */
export type OpenValidatePayload<V extends Validator<unknown>> =
  V extends StandardSchemaV1
    ? StandardSchemaV1.InferInput<V>
    : InferValidatorInput<V>;

function isStandardSchema(v: unknown): v is StandardSchemaV1 {
  return typeof v === "object" && v !== null && "~standard" in v;
}

/**
 * Runs synchronous validation and returns output that may differ from the input.
 * Async Standard Schema validators are unsupported.
 * Invalid input is reported as {@link PayloadValidationError}.
 *
 * @internal
 */
export function validatePayload<Output>(
  validate: Validator<Output>,
  input: unknown,
): Output {
  if (isStandardSchema(validate)) {
    const result = (validate as StandardSchemaV1<unknown, Output>)[
      "~standard"
    ].validate(input);
    if (result instanceof Promise) {
      throw new Error(
        "[layers] Async payload validation is not supported — use a synchronous schema.",
      );
    }
    if (result.issues) {
      throw new PayloadValidationError(
        result.issues.map((i) => ({
          message: i.message,
          path: i.path?.map((p) => (typeof p === "object" ? p.key : p)),
        })),
      );
    }
    return result.value;
  }
  try {
    return (validate as (input: unknown) => Output)(input);
  } catch (cause) {
    if (cause instanceof PayloadValidationError) throw cause;
    throw new PayloadValidationError(
      [{ message: cause instanceof Error ? cause.message : String(cause) }],
      { cause },
    );
  }
}
