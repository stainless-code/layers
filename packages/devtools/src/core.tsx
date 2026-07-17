import { constructCoreClass } from "@tanstack/devtools-utils/solid";
import type { ClassType } from "@tanstack/devtools-utils/solid";

export interface LayersDevtoolsInit {}

const coreClasses = constructCoreClass(() => import("./components"));

export const LayersDevtoolsCore: ClassType = coreClasses[0];
export const LayersDevtoolsCoreNoOp: ClassType = coreClasses[1];
