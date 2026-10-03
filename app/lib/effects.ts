/**
 * How much the interface spends on looking like glass. Blurred materials and
 * soft shadows are the single largest GPU cost on integrated graphics, and they
 * are decoration: the reduced mode draws the same layout on opaque surfaces.
 *
 * `system` asks the device. The attribute this resolves to, `data-effects` on
 * `<html>`, is stamped before first paint by the script in `app/layout.tsx` --
 * the same arrangement as `data-theme`.
 */
export const EFFECTS = ["system", "reduced", "full"] as const;
export type EffectsPreference = (typeof EFFECTS)[number];
export type EffectsHints = { cores?: number; memoryGb?: number; reducedTransparency?: boolean };

export const EFFECTS_KEY = "plstudio-effects";

/**
 * Self-contained on purpose -- no module-scope references -- because the
 * pre-paint script is built from this function's own source, so the stamp and
 * the setting can never disagree. A hint the browser does not report (Safari
 * and Firefox have no `deviceMemory`) counts as unknown, not as low.
 */
export function resolveEffects(preference: string | null | undefined, hints: EffectsHints): "reduced" | "full" {
  if (preference === "reduced" || preference === "full") return preference;
  const lowCores = typeof hints.cores === "number" && hints.cores <= 4;
  const lowMemory = typeof hints.memoryGb === "number" && hints.memoryGb <= 4;
  return lowCores || lowMemory || hints.reducedTransparency === true ? "reduced" : "full";
}

const readHints = (): EffectsHints => ({
  cores: navigator.hardwareConcurrency,
  memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  reducedTransparency: window.matchMedia("(prefers-reduced-transparency: reduce)").matches,
});

export const readEffectsPreference = (): EffectsPreference => {
  try {
    const saved = window.localStorage.getItem(EFFECTS_KEY);
    return EFFECTS.includes(saved as EffectsPreference) ? (saved as EffectsPreference) : "system";
  } catch { return "system"; }
};

/** Persist the choice and restamp, so the change shows without a reload. */
export const applyEffectsPreference = (preference: EffectsPreference) => {
  try { window.localStorage.setItem(EFFECTS_KEY, preference); } catch { /* Private mode: the stamp below still holds for this page. */ }
  document.documentElement.dataset.effects = resolveEffects(preference, readHints());
};

/** The pre-paint stamp. Runs as the browser parses `<body>`, before anything is drawn. */
export const effectsScript = `(function(){try{var r=${resolveEffects.toString()};var p=null;try{p=localStorage.getItem(${JSON.stringify(EFFECTS_KEY)})}catch(e){}document.documentElement.dataset.effects=r(p,{cores:navigator.hardwareConcurrency,memoryGb:navigator.deviceMemory,reducedTransparency:matchMedia("(prefers-reduced-transparency: reduce)").matches})}catch(e){}})()`;
