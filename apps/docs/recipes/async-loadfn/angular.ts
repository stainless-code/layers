import { Component, inject, signal, ViewContainerRef } from "@angular/core";
import {
  LayerClient,
  layerOptions,
  provideLayerClient,
  renderStack,
} from "@stainless-code/angular-layers";
import type { LayerComponentProps } from "@stainless-code/angular-layers";

interface Profile {
  name: string;
  role: string;
  initials: string;
}

interface ProfilePayload {
  userId: string;
}
type ProfileResponse = void;

const layerClient = new LayerClient();

@Component({
  selector: "profile-dialog",
  template: `
    <div
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'Profile ' + payload.userId"
    >
      @if (phase === "pending") {
        <p>Loading profile…</p>
      } @else {
        <div>
          <h2>{{ data?.name }}</h2>
          <p>{{ data?.role }}</p>
          <span>{{ data?.initials }}</span>
        </div>
      }
      <button type="button" (click)="call.dismiss()">Close</button>
    </div>
  `,
})
class ProfileDialogComponent {
  call!: LayerComponentProps<
    ProfilePayload,
    ProfileResponse,
    never,
    Profile
  >["call"];
  payload!: ProfilePayload;
  data!: Profile | undefined;
  phase!: LayerComponentProps<
    ProfilePayload,
    ProfileResponse,
    Profile
  >["phase"];
}

const profile = layerOptions<ProfilePayload, ProfileResponse, never, Profile>({
  stack: "example-async-loadfn",
  key: ["example-async-loadfn"],
  component: ProfileDialogComponent,
  loadFn: async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      name: "Ada Lovelace",
      role: "Founding Engineer",
      initials: "AL",
    };
  },
});

@Component({
  selector: "app-root",
  standalone: true,
  providers: [provideLayerClient(layerClient)],
  template: `
    <div>
      <button type="button" (click)="openProfile()">Open async dialog</button>
      @if (phase() !== "idle") {
        <span>{{ phase() === "loading" ? "Loading…" : "Closed" }}</span>
      }
    </div>
    <ng-container />
  `,
})
export class AppComponent {
  private vcr = inject(ViewContainerRef);
  phase = signal<"idle" | "loading" | "done">("idle");

  constructor() {
    renderStack(this.vcr, "example-async-loadfn");
  }

  async openProfile() {
    this.phase.set("loading");
    await layerClient.open({ ...profile, payload: { userId: "ada" } });
    this.phase.set("done");
  }
}
