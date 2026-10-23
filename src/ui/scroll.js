import { scrollState } from "../core/math.js";

export function createScroll(config, invalidate) {
  const sections = [...document.querySelectorAll("section")];
  let tops = [],
    dirty = true,
    state,
    webgl = true;
  function measure() {
    tops = sections.map(
      (section) => section.getBoundingClientRect().top + scrollY,
    );
    dirty = true;
    invalidate();
  }
  function onScroll() {
    dirty = true;
    invalidate();
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", measure, { passive: true });
  addEventListener("load", measure, { once: true });
  const observer = new ResizeObserver(measure);
  sections.forEach((section) => observer.observe(section));
  document.fonts?.ready.then(measure);
  measure();
  return {
    measure,
    fallback() {
      webgl = false;
      measure();
    },
    read() {
      if (dirty) {
        state = scrollState(
          scrollY,
          tops,
          config.layout.workTravelFraction,
          webgl,
        );
        dirty = false;
      }
      return state;
    },
    destroy() {
      observer.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", measure);
    },
  };
}
