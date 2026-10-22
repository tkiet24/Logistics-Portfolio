import { SKILLS } from "../config/content.js";
import { createScroll } from "./scroll.js";
import { createTheme } from "./theme.js";

export function createUI(config) {
  let invalidate = () => {},
    onSkill = () => {},
    onTheme = () => {};
  let selected = 0,
    workIndex = -1,
    lastRaw = -1,
    lastBits = -1,
    lastScene = -1,
    counted = false;
  const panels = [...document.querySelectorAll(".panel")],
    links = [...document.querySelectorAll("nav a")];
  const work = [...document.querySelectorAll(".wl li")],
    steps = [...document.querySelectorAll(".wstep i")];
  const atmosphere = document.querySelector("#atmosphere"),
    bar = document.querySelector("#bar");
  const chips = document.querySelector("#chips"),
    caption = document.querySelector("#cap"),
    accordion = document.querySelector("#acc");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scroll = createScroll(config, () => invalidate());
  const theme = createTheme(() => {
    onTheme();
    invalidate();
  });

  function select(index) {
    selected = index;
    [...chips.children].forEach((chip, i) => {
      chip.classList.toggle("on", i === index);
      chip.setAttribute("aria-pressed", String(i === index));
    });
    caption.textContent = SKILLS[index][1];
    const fragment = document.createDocumentFragment();
    SKILLS[index][3].forEach(([title, label, description], i) => {
      const button = document.createElement("button"),
        body = document.createElement("div"),
        inner = document.createElement("div"),
        paragraph = document.createElement("p"),
        bold = document.createElement("b");
      button.type = "button";
      button.className = "ah";
      button.textContent = title;
      button.setAttribute("aria-expanded", String(i === 0));
      body.id = `skill-${index}-${i}`;
      body.className = i === 0 ? "ab o" : "ab";
      button.setAttribute("aria-controls", body.id);
      bold.textContent = label;
      paragraph.append(bold, document.createElement("br"), description);
      inner.append(paragraph);
      body.append(inner);
      button.addEventListener("click", () => {
        const wasOpen = button.getAttribute("aria-expanded") === "true";
        accordion
          .querySelectorAll(".ah")
          .forEach((item) => item.setAttribute("aria-expanded", "false"));
        accordion
          .querySelectorAll(".ab")
          .forEach((item) => item.classList.remove("o"));
        if (!wasOpen) {
          button.setAttribute("aria-expanded", "true");
          body.classList.add("o");
        }
      });
      fragment.append(button, body);
    });
    accordion.replaceChildren(fragment);
    onSkill(index);
    invalidate();
  }
  SKILLS.forEach(([label], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = label;
    button.addEventListener("click", () => select(index));
    chips.append(button);
  });
  function setWork(index) {
    if (index === workIndex) return;
    workIndex = index;
    work.forEach((item, i) => item.classList.toggle("on", i === index));
    steps.forEach((item, i) => item.classList.toggle("on", i <= index));
    document.querySelector("#wnum").textContent =
      `${index + 1} / ${work.length}`;
  }
  function count() {
    if (counted) return;
    counted = true;
    const stats = [...document.querySelectorAll(".stats b")],
      start = performance.now();
    function step(now) {
      const u = reducedMotion.matches ? 1 : Math.min(1, (now - start) / 1400),
        progress = 1 - (1 - u) ** 3;
      for (const stat of stats)
        stat.textContent =
          Math.round(+stat.dataset.n * progress) +
          (u === 1 ? stat.dataset.s : "");
      if (u < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function update(progress = scroll.read().progress) {
    const state = scroll.read(),
      scene = Math.max(0, Math.min(4, Math.round(progress)));
    // Write DOM state only when a threshold changes, not on every render frame.
    if (state.rawProgress !== lastRaw) {
      bar.style.transform = `scaleX(${state.rawProgress / 4})`;
      lastRaw = state.rawProgress;
    }
    if (scene !== lastScene) {
      atmosphere.dataset.scene = String(scene);
      links.forEach((link, i) => {
        link.classList.toggle("on", i === scene);
        if (i === scene) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      lastScene = scene;
    }
    const visible = panels.map((_, i) =>
      i === 3
        ? progress > 2.55 && progress < 3.6
        : Math.abs(progress - i) < 0.45,
    );
    const bits = visible.reduce((mask, value, i) => mask | (+value << i), 0);
    if (bits !== lastBits) {
      panels.forEach((panel, i) => panel.classList.toggle("in", visible[i]));
      lastBits = bits;
    }
    if (scene === 1) count();
  }
  select(0);
  setWork(0);
  update();
  let fallbackFrame = 0;
  return {
    scroll,
    theme,
    reducedMotion,
    get activeSkill() {
      return selected;
    },
    select,
    setWork,
    update,
    connect(callbacks) {
      invalidate = callbacks.invalidate;
      onSkill = callbacks.onSkill;
      onTheme = callbacks.onTheme;
      invalidate();
    },
    fallback() {
      document.body.classList.add("nogl");
      scroll.fallback();
      invalidate = () => {
        if (!fallbackFrame)
          fallbackFrame = requestAnimationFrame(() => {
            fallbackFrame = 0;
            update();
          });
      };
      invalidate();
    },
  };
}
