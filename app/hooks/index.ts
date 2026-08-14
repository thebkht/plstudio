/**
 * Barrel for the designer's context hooks, mirroring drawdb's `src/hooks/index.js`
 * so consumers write `import { useDesignerSettings } from "@/app/hooks"` rather
 * than reaching into `components/designer/context/` directly.
 */
export { useDesignerSettings } from "./use-designer-settings";
