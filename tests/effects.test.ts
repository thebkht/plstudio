import { describe, expect, it } from "vitest";
import { effectsScript, resolveEffects } from "@/app/lib/effects";

describe("resolveEffects", () => {
  it("lets an explicit choice win over the device", () => {
    expect(resolveEffects("full", { cores: 2, memoryGb: 2, reducedTransparency: true })).toBe("full");
    expect(resolveEffects("reduced", { cores: 16, memoryGb: 8 })).toBe("reduced");
  });

  it("reduces on few cores, little memory or a system transparency preference", () => {
    expect(resolveEffects("system", { cores: 4, memoryGb: 8 })).toBe("reduced");
    expect(resolveEffects(null, { cores: 8, memoryGb: 4 })).toBe("reduced");
    expect(resolveEffects(null, { cores: 8, memoryGb: 8, reducedTransparency: true })).toBe("reduced");
  });

  it("keeps full effects on a capable device, and when the browser reports nothing", () => {
    expect(resolveEffects("system", { cores: 8, memoryGb: 8 })).toBe("full");
    expect(resolveEffects(null, {})).toBe("full");
    expect(resolveEffects("nonsense", { cores: 8 })).toBe("full");
  });
});

describe("effectsScript", () => {
  const run = (stored: string | null, cores: number) => {
    const dataset: Record<string, string> = {};
    new Function("localStorage", "navigator", "matchMedia", "document", effectsScript)(
      { getItem: () => stored }, { hardwareConcurrency: cores, deviceMemory: 8 }, () => ({ matches: false }), { documentElement: { dataset } },
    );
    return dataset.effects;
  };

  it("stamps what resolveEffects would, from its own inlined copy", () => {
    expect(run(null, 2)).toBe("reduced");
    expect(run(null, 12)).toBe("full");
    expect(run("full", 2)).toBe("full");
  });
});
