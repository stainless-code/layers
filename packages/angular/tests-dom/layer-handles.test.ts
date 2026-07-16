import {
  Component,
  inject,
  Injector,
  runInInjectionContext,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { StandardSchemaV1 } from "@stainless-code/layers";
import { LayerClient, layerOptions } from "@stainless-code/layers";
import { describe, expect, it } from "vitest";

import type { WiredLayerHandle, WiredValidatedLayerHandle } from "../src/index";
import {
  injectLayer,
  injectLayerQueuedState,
  injectLayerState,
  injectQueuedStack,
  injectStack,
  LAYER_CLIENT,
  provideLayerClient,
} from "../src/index";

const toastOptions = layerOptions<{ msg: string }, void>({
  stack: "default",
  key: ["toast"],
  component: undefined,
  exitingDelay: 0,
});

const dupOptions = layerOptions<{ n: number }, boolean>({
  stack: "default",
  key: ["dup"],
  component: undefined,
  exitingDelay: 0,
});

const voidOptions = layerOptions<void, boolean>({
  stack: "default",
  key: ["void"],
  component: undefined,
  exitingDelay: 0,
});

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

const validatedOptions = {
  stack: "default",
  key: ["v"],
  validate: idSchema,
  component: undefined,
  exitingDelay: 0,
};

function setupCtx(client: LayerClient): Injector {
  TestBed.configureTestingModule({
    providers: [provideLayerClient(client)],
  });
  return TestBed.inject(Injector);
}

/** Flush Angular effects so stack subscription signals reflect mutations. */
function flushEffects(): void {
  TestBed.flushEffects();
}

describe("Angular adapter — layer handles", () => {
  it("injectLayer open/dismiss/update/state/queued/top/current", async () => {
    const client = new LayerClient();
    const injector = setupCtx(client);
    const handle = runInInjectionContext(injector, () =>
      injectLayer(toastOptions, client),
    );

    expect(handle.state()).toHaveLength(0);
    expect(handle.top()).toBeNull();
    expect(handle.current).toBeNull();

    runInInjectionContext(injector, () => void handle.open({ msg: "hello" }));
    flushEffects();

    expect(handle.state()).toHaveLength(1);
    expect(handle.top()?.payload.msg).toBe("hello");
    expect(handle.current).not.toBeNull();
    expect(handle.client).toBe(client);
    expect(handle.stack).toBe(client.getStack("default"));

    runInInjectionContext(injector, () => handle.update({ msg: "updated" }));
    flushEffects();
    expect(handle.top()?.payload.msg).toBe("updated");

    await runInInjectionContext(injector, () =>
      handle.dismiss(undefined as void),
    );
    flushEffects();
    expect(handle.state()).toHaveLength(0);
    expect(handle.current).toBeNull();
  });

  it("injectLayer open without spread and void payload optionality", async () => {
    const client = new LayerClient();
    const injector = setupCtx(client);
    const { pending } = runInInjectionContext(injector, () => {
      const handle = injectLayer(voidOptions, client);
      const pending = handle.open();
      void handle.dismiss(true);
      return { pending };
    });
    flushEffects();
    expect(await pending).toBe(true);
  });

  it("injectLayer client escape via trailing client arg", () => {
    const client = new LayerClient();
    const injector = setupCtx(client);
    const handle = runInInjectionContext(injector, () =>
      injectLayer(toastOptions, client),
    );
    expect(handle.client).toBe(client);

    void client.open({ ...toastOptions, payload: { msg: "escape" } });
    flushEffects();
    expect(handle.state()).toHaveLength(1);
  });

  it("injectLayerState and injectLayerQueuedState return arrays with select", () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const injector = setupCtx(client);
    const mounted = runInInjectionContext(injector, () =>
      injectLayerState({
        key: dupOptions.key,
        select: (states) => states.map((s) => s.payload.n),
      }),
    );
    const queued = runInInjectionContext(injector, () =>
      injectLayerQueuedState({
        key: dupOptions.key,
        select: (states) => states.length,
      }),
    );

    void client.open({ ...dupOptions, payload: { n: 1 } });
    void client.open({ ...dupOptions, payload: { n: 2 } });
    flushEffects();

    expect(mounted()).toEqual([1]);
    expect(queued()).toBe(1);
  });

  it("injectStack and injectQueuedStack options bag with trailing client", () => {
    const client = new LayerClient();
    const injector = setupCtx(client);
    const mounted = runInInjectionContext(injector, () =>
      injectStack({ stack: "default", select: (s) => s.length }, client),
    );
    const queued = runInInjectionContext(injector, () =>
      injectQueuedStack({ stack: "default", select: (s) => s.length }, client),
    );

    expect(mounted()).toBe(0);
    expect(queued()).toBe(0);

    void client.open({ ...toastOptions, payload: { msg: "a" } });
    flushEffects();
    expect(mounted()).toBe(1);
  });

  it("two injectLayer same-key — dismiss with { id: c.current?.id }", async () => {
    const client = new LayerClient();
    const injector = setupCtx(client);
    const { a, firstPending } = runInInjectionContext(injector, () => {
      const a = injectLayer(dupOptions, client);
      const b = injectLayer(dupOptions, client);
      const firstPending = a.open({ n: 1 });
      void b.open({ n: 2 });
      return { a, firstPending };
    });
    flushEffects();

    expect(a.state()).toHaveLength(2);
    const firstId = a.current?.id;
    expect(firstId).toBeTruthy();

    await runInInjectionContext(injector, () =>
      a.dismiss(true, { id: firstId }),
    );
    flushEffects();

    expect(await firstPending).toBe(true);
    expect(a.state()).toHaveLength(1);
    expect(a.state()[0]?.payload.n).toBe(2);
  });

  it("injectLayer cancelQueued resolves queued layer", async () => {
    const client = new LayerClient({
      defaultStackOptions: {
        default: { scope: { strategy: "serial" } },
      },
    });
    const optsA = layerOptions<{ n: number }, boolean>({ key: ["a"] });
    const optsB = layerOptions<{ n: number }, boolean>({ key: ["b"] });
    const injector = setupCtx(client);

    const { handleA, pending } = runInInjectionContext(injector, () => {
      const handleA = injectLayer(optsA, client);
      const handleB = injectLayer(optsB, client);
      void handleA.open({ n: 1 });
      const pending = handleB.open({ n: 2 });
      expect(handleB.cancelQueued(false)).toBe(true);
      return { handleA, pending };
    });
    flushEffects();

    expect(await pending).toBe(false);
    await runInInjectionContext(injector, () => handleA.dismiss(true));
    flushEffects();
  });

  it("validated handle stores parsed output in state", async () => {
    const client = new LayerClient();
    const injector = setupCtx(client);
    const handle = runInInjectionContext(
      injector,
      () =>
        injectLayer(validatedOptions, client) as WiredValidatedLayerHandle<
          typeof idSchema,
          unknown
        >,
    );

    runInInjectionContext(injector, () => void handle.open({ id: "42" }));
    flushEffects();
    expect(handle.state()[0]?.payload).toEqual({ id: 42 });

    await runInInjectionContext(injector, () =>
      handle.dismiss(undefined as void),
    );
    flushEffects();
  });
});

@Component({
  selector: "handle-probe",
  standalone: true,
  template: `
    <span data-testid="state-len">{{ handle.state().length }}</span>
    <span data-testid="top-msg">{{ handle.top()?.payload.msg ?? "none" }}</span>
  `,
})
class HandleProbeComponent {
  readonly handle!: WiredLayerHandle<{ msg: string }, void>;
  private readonly injector = inject(Injector);

  constructor() {
    runInInjectionContext(this.injector, () => {
      const client = inject(LAYER_CLIENT);
      this.handle = injectLayer(toastOptions, client);
    });
  }
}

describe("Angular adapter — layer handles (component)", () => {
  it("injectLayer reactive signals update in component context", async () => {
    const client = new LayerClient();
    TestBed.configureTestingModule({
      providers: [provideLayerClient(client)],
    });

    const fixture = TestBed.createComponent(HandleProbeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("0");

    void client.open({ ...toastOptions, payload: { msg: "hello" } });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("1");
    expect(fixture.nativeElement.textContent).toContain("hello");
  });
});
