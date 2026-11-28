import type { CoreStatus } from "@/components/scene/scene-bus";

/**
 * Whether the hero's stage shows the 2D note lattice (HeroStageFallback)
 * instead of the 3D core: whenever the core is not drawn there. That is
 * before it has drawn its first frame (pending, ready), when it never will
 * or its GPU context is gone (off, lost), and while it is away in the laptop
 * copilot window's dock. Otherwise the right half of the hero is empty.
 */
export function heroFallbackShown({
  core,
  docked,
}: Readonly<{ core: CoreStatus; docked: boolean }>): boolean {
  return core !== "on" || docked;
}
