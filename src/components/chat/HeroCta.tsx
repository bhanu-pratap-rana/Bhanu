"use client";

import { useMemo } from "react";
import { useChatStore } from "@/components/chat/ChatProvider";
import { HexGlyph } from "@/components/chat/HexGlyph";
import { DEMO } from "@/components/scene/MemoryCore";
import { useSceneBus } from "@/components/scene/scene-bus";
import { glyphFromGlow } from "@/lib/hex-glyph";

/**
 * The hero's way into the copilot, on every width. The glyph is the copilot's
 * mark, lit like the core's current demo frame; once this row scrolls away the
 * floating launcher takes the same glyph to the corner (it watches
 * `[data-launcher-sentinel]`). `#hero-ask` stays the return-focus fallback:
 * its first button is the primary action. One action only: the header's
 * Resume button is the download, a few pixels above.
 */
export function HeroCta() {
  const store = useChatStore();
  const demo = useSceneBus((s) => s.demo);
  const lit = useMemo(() => glyphFromGlow(DEMO[demo % DEMO.length].glow), [demo]);

  return (
    <div id="hero-ask" className="hero-cta" data-launcher-sentinel="">
      <button
        type="button"
        onClick={() => store.open({ focus: true })}
        className="hero-cta-primary"
      >
        <HexGlyph lit={lit} size={26} className="hero-cta-glyph" />
        Ask my copilot
      </button>
    </div>
  );
}
