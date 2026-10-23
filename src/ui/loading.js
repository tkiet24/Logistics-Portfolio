import "../styles/loading.css";

/** Keep the document covered until every scene is assembled, with a text fallback. */
export function createOpeningLoader() {
  const overlay = document.createElement("div");
  overlay.id = "opening-loader";
  overlay.setAttribute("tabindex", "-1");
  overlay.setAttribute("aria-label", "Loading Bui Thi Kieu Nga portfolio");
  overlay.innerHTML = `
    <div class="opening-content">
      <span class="opening-name">Bui Thi Kieu Nga</span>
      <div class="opening-runway">
        <div class="opening-track" role="progressbar" aria-label="Loading portfolio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        <div class="opening-cat" aria-hidden="true">
          <svg viewBox="0 0 80 50" fill="none">
            <g class="cat-stride">
              <path d="M21 28C5 29 7 10 3 13" stroke="#cb682b" stroke-width="5" stroke-linecap="round"/>
              <path class="cat-leg cat-leg-back" d="M26 32l-8 11m18-11 7 11" stroke="#cc6728" stroke-width="5" stroke-linecap="round"/>
              <ellipse cx="36" cy="28" rx="20" ry="11" fill="#ed963f"/>
              <path class="cat-leg cat-leg-front" d="M29 33l7 10m14-12-7 12" stroke="#ef9d48" stroke-width="5" stroke-linecap="round"/>
              <path d="M49 22 48 6l9 7 9-6 1 15c8 15-22 21-23 8z" fill="#ee9a44"/>
              <path d="m51 11 4 5-4 1m12-5-4 5 5-1" stroke="#c46638" stroke-width="2"/>
              <circle cx="62" cy="23" r="1.7" fill="#3d3027"/>
              <path d="m69 27 3 1-3 2" fill="#8e4e39"/>
              <path d="m30 19 2 6m7-7 2 6m-18-3 2 5" stroke="#c96a2a" stroke-width="2.5" stroke-linecap="round"/>
            </g>
          </svg>
        </div>
      </div>
      <p class="opening-status" role="status" aria-live="polite">Loading portfolio</p>
      <span class="opening-percent" aria-hidden="true">0%</span>
      <button type="button" class="opening-skip">View text version</button>
    </div>`;
  const previousFocus = document.activeElement;
  const siblings = [...document.body.children].filter((item) => item.tagName !== "SCRIPT");
  const previousInert = siblings.map((item) => item.inert);
  const regions = siblings.filter((item) => item.tagName === "SECTION");
  const previousBusy = regions.map((item) => item.getAttribute("aria-busy"));
  siblings.forEach((item) => { item.inert = true; });
  regions.forEach((item) => item.setAttribute("aria-busy", "true"));
  document.body.append(overlay);
  document.body.classList.add("is-loading");
  const track = overlay.querySelector(".opening-track"),
    fill = track.firstElementChild,
    percent = overlay.querySelector(".opening-percent"),
    status = overlay.querySelector(".opening-status");
  let value = 0, finished = false, cancelled = false, fallback = () => {};
  const listeners = new Set();
  const timeout = setTimeout(() => cancel(), 90000);

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    listeners.forEach((dispose) => dispose());
    siblings.forEach((item, index) => { item.inert = previousInert[index]; });
    regions.forEach((item, index) => {
      if (previousBusy[index] === null) item.removeAttribute("aria-busy");
      else item.setAttribute("aria-busy", previousBusy[index]);
    });
    document.body.classList.remove("is-loading");
    const hadFocus = overlay.contains(document.activeElement);
    overlay.remove();
    if (hadFocus) (previousFocus?.tagName === "BODY" ? document.querySelector("#theme-toggle") : previousFocus)?.focus();
  }
  function cancel() {
    if (finished) return;
    cancelled = true;
    fallback();
    finish();
  }
  overlay.querySelector("button").addEventListener("click", cancel);
  overlay.focus({ preventScroll: true });
  return {
    get cancelled() { return cancelled; },
    get finished() { return finished; },
    onFallback(callback) { fallback = callback; },
    onFinish(dispose) { listeners.add(dispose); },
    progress(amount, message) {
      if (finished) return;
      value = Math.max(value, Math.min(100, Math.floor(amount)));
      track.setAttribute("aria-valuenow", String(value));
      fill.style.transform = `scaleX(${value / 100})`;
      overlay.querySelector(".opening-cat").style.left = `${value}%`;
      percent.textContent = `${value}%`;
      if (message && status.textContent !== message) status.textContent = message;
    },
    finish,
    cancel,
  };
}
