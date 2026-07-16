/**
 * Core type-level inference tests. Compiled by `tsc --noEmit` (tsconfig
 * includes `src/**`); never executed — bun's `*.test.ts` glob skips
 * `*.test-d.ts`. Registered as a knip entry so its exports are not flagged.
 */
import { LayerClient, createLayer, layerKey, layerOptions } from "./index";
import type {
  DataTag,
  DefaultLayerError,
  InferDataTagError,
  InferDataTagResponse,
  LayerKey,
  OmitKeyof,
  StandardSchemaV1,
} from "./index";

/** Invariant mutual-assignability check. */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
export type Expect<T extends true> = T;

declare const client: LayerClient;

// A DataTag-branded key carries its response type: `open` infers `boolean`
// with no explicit generic anywhere.
const removeKey = layerKey<boolean>()(["confirm", "remove"]);
function openTagged() {
  return client.open({ key: removeKey, payload: { title: "Remove?" } });
}
export type _TaggedKeyInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openTagged>>, boolean>
>;

// Sanity (negative): the tagged response is NOT `string`.
export type _TaggedKeyNotString = Expect<
  // @ts-expect-error boolean is not assignable to string
  Equal<Awaited<ReturnType<typeof openTagged>>, string>
>;

// The existing `layerOptions<P, R>` generic path still infers end-to-end.
const confirmOpts = layerOptions<{ title: string }, number>({
  key: ["confirm", "count"],
});
function openViaOptions() {
  return client.open({ ...confirmOpts, payload: { title: "n" } });
}
export type _LayerOptionsInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openViaOptions>>, number>
>;

// `layerOptions` auto-tags `key` with `DataTag` so spread-into-`open` infers
// `R` without an explicit generic on `open`.
const autoTagged = layerOptions<{ title: string }, boolean>({
  key: ["confirm", "x"],
  component: undefined,
});
export type _AutoTaggedKeyIsDataTag = Expect<
  (typeof autoTagged)["key"] extends DataTag<LayerKey, boolean, Error>
    ? true
    : false
>;
export type _AutoTaggedKeyCarriesResponse = Expect<
  Equal<InferDataTagResponse<(typeof autoTagged)["key"]>, boolean>
>;
function openViaAutoTagged() {
  return client.open({ ...autoTagged, payload: { title: "Remove?" } });
}
export type _AutoTaggedSpreadInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openViaAutoTagged>>, boolean>
>;

// A custom error type rides along on the tag.
const errKey = layerKey<string, TypeError>()(["confirm", "err"]);
export type _TaggedKeyErrorType = Expect<
  Equal<InferDataTagError<typeof errKey>, TypeError>
>;

// A1 — `DataTag` is idempotent: re-branding an already-tagged key keeps the
// first tag (no `never`-collapse from intersecting conflicting responses).
export type _DataTagIdempotent = Expect<
  Equal<
    DataTag<DataTag<["x"], boolean, Error>, string, TypeError>,
    DataTag<["x"], boolean, Error>
  >
>;
export type _DataTagIdempotentResponse = Expect<
  Equal<
    InferDataTagResponse<DataTag<DataTag<["x"], boolean, Error>, string>>,
    boolean
  >
>;

// A3 — `OmitKeyof` is key-checked: a real key omits, a typo'd key is an error.
export type _OmitKeyofRemovesKey = Expect<
  Equal<keyof OmitKeyof<{ a: 1; b: 2 }, "a">, "b">
>;
// @ts-expect-error "c" is not a key of the target
export type _OmitKeyofRejectsTypo = OmitKeyof<{ a: 1; b: 2 }, "c">;

// Unaugmented, DefaultLayerError resolves to Error (do NOT augment Register here — augmentation is global and would flip every other assertion).
export type _DefaultErrorIsError = Expect<Equal<DefaultLayerError, Error>>;

// `validate` at `open`: payload arg is the schema INPUT; layer stores OUTPUT (`P`).
const idSchema = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (v: unknown) => ({
      value: { id: Number((v as { id: string }).id) },
    }),
    types: undefined as unknown as {
      input: { id: string };
      output: { id: number };
    },
  },
} as StandardSchemaV1<{ id: string }, { id: number }>;

function openValidated() {
  return client.open({
    key: ["v"],
    validate: idSchema,
    payload: { id: "1" },
  });
}
export type _ValidateOpenAcceptsInput = Expect<
  Equal<Awaited<ReturnType<typeof openValidated>>, void>
>;

function openValidatedWrongPayload() {
  // @ts-expect-error output shape is not the schema input
  return client.open({
    key: ["v"],
    validate: idSchema,
    payload: { id: 1 },
  });
}
void openValidatedWrongPayload;

// No `validate`: `open` still takes `payload: P` (unchanged).
const plainOpts = layerOptions<{ title: string }>({ key: ["plain"] });
function openNoValidate() {
  return client.open({ ...plainOpts, payload: { title: "hi" } });
}
export type _NoValidateOpenAcceptsP = Expect<
  Equal<Awaited<ReturnType<typeof openNoValidate>>, void>
>;
function openNoValidateWrongPayload() {
  // @ts-expect-error title must be string
  return client.open({
    ...plainOpts,
    payload: { title: 1 },
  });
}
void openNoValidateWrongPayload;

// Optional payload — `payload` is omittable exactly when `P` admits `undefined`.

// (a) void payload → omittable.
const voidOpts = layerOptions<void>({ key: ["void"] });
function openVoidOmitted() {
  return client.open(voidOpts);
}
function openVoidSpread() {
  return client.open({ ...voidOpts });
}
void openVoidOmitted;
void openVoidSpread;

// (b) no generic → P = unknown → omittable.
const unknownOpts = layerOptions({ key: ["unknown"] });
function openUnknownOmitted() {
  return client.open(unknownOpts);
}
void openUnknownOmitted;

// (c) `T | undefined` payload → omittable, or pass a value.
const maybeOpts = layerOptions<{ color?: string } | undefined>({
  key: ["maybe"],
});
function openMaybeOmitted() {
  return client.open(maybeOpts);
}
function openMaybeProvided() {
  return client.open({ ...maybeOpts, payload: { color: "red" } });
}
void openMaybeOmitted;
void openMaybeProvided;

// (d) required-field object → payload REQUIRED (omitting is an error).
const reqOpts = layerOptions<{ title: string }>({ key: ["req"] });
function openReqOmitted() {
  // @ts-expect-error payload is required for a payload with required fields
  return client.open(reqOpts);
}
void openReqOmitted;

// (e) all-optional-fields object WITHOUT `| undefined` → still REQUIRED
// (the "unless you type it that way" rule — opt in via `| undefined`).
const optFieldsOpts = layerOptions<{ color?: string }>({ key: ["optf"] });
function openOptFieldsOmitted() {
  // @ts-expect-error payload required unless the type admits `undefined`
  return client.open(optFieldsOpts);
}
void openOptFieldsOmitted;

declare const confirmClient: LayerClient;

// createLayer — plain handle infers response from layerOptions.
const confirmOptsForHandle = layerOptions<{ title: string }, number>({
  key: ["confirm", "count"],
});
const confirmHandle = createLayer(confirmOptsForHandle, confirmClient);
function openViaHandle() {
  return confirmHandle.open({ title: "n" });
}
export type _CreateLayerInfersResponse = Expect<
  Equal<Awaited<ReturnType<typeof openViaHandle>>, number>
>;

// createLayer — validated handle: open accepts INPUT, not OUTPUT.
const validatedHandle = createLayer(
  {
    key: ["v"],
    validate: idSchema,
  },
  confirmClient,
);
function openViaValidatedHandle() {
  return validatedHandle.open({ id: "1" });
}
void openViaValidatedHandle;
export type _ValidatedHandleOpenAcceptsInput = Expect<
  Equal<Parameters<(typeof validatedHandle)["open"]>[0], { id: string }>
>;
function openViaValidatedHandleWrongPayload() {
  // @ts-expect-error output shape is not the schema input
  return validatedHandle.open({ id: 1 });
}
void openViaValidatedHandleWrongPayload;

// createLayer — PayloadArg optionality on the handle.
const voidHandle = createLayer(
  layerOptions<void, boolean>({ key: ["void"] }),
  confirmClient,
);
function openVoidHandleOmitted() {
  return voidHandle.open();
}
void openVoidHandleOmitted;

const reqHandle = createLayer(
  layerOptions<{ title: string }>({ key: ["req"] }),
  confirmClient,
);
function openReqHandleOmitted() {
  // @ts-expect-error payload is required for a payload with required fields
  return reqHandle.open();
}
void openReqHandleOmitted;

// createLayer — current is typed from options payload.
export type _CreateLayerCurrentPayload = Expect<
  Equal<
    NonNullable<(typeof confirmHandle)["current"]>["state"]["payload"],
    { title: string }
  >
>;
