import "@fontsource/inter-tight/latin-400.css";
import "@fontsource/inter-tight/latin-500.css";
import "@fontsource/inter-tight/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/site.css";
import { CONFIG } from "./config/site.js";
import { createUI } from "./ui/interface.js";

const ui = createUI(CONFIG);
document.documentElement.classList.remove("no-js");
ui.scroll.measure();
// Navigation and readable content are ready before the WebGL bundle is requested.
requestAnimationFrame(() => {
  import("./three/engine.js")
    .then(({ startEngine }) => startEngine(CONFIG, ui))
    .catch((error) => {
      console.warn(
        "3D is unavailable; using the accessible document view.",
        error,
      );
      ui.fallback();
    });
});
