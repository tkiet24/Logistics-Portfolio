import "@fontsource/inter-tight/latin-400.css";
import "@fontsource/inter-tight/latin-500.css";
import "@fontsource/inter-tight/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/site.css";
import { CONFIG } from "./config/site.js";
import { createUI } from "./ui/interface.js";
import { createOpeningLoader } from "./ui/loading.js";

const opening = createOpeningLoader();
const ui = createUI(CONFIG);
ui.opening = opening;
opening.onFallback(() => ui.fallback());
document.documentElement.classList.remove("no-js");
ui.scroll.measure();
// Keep the first visit covered until all 3D scenes are ready.
requestAnimationFrame(() => {
  import("./three/engine.js")
    .then(({ startEngine }) => startEngine(CONFIG, ui))
    .catch((error) => {
      console.warn(
        "3D is unavailable; using the accessible document view.",
        error,
      );
      opening.cancel();
    });
});
