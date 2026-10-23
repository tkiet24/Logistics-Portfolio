export function createTheme(onChange = () => {}) {
  const root = document.documentElement,
    button = document.querySelector("#theme-toggle");
  const media = matchMedia("(prefers-color-scheme: dark)");
  const saved = () => {
    try {
      return localStorage.getItem("theme");
    } catch {
      return null;
    }
  };
  function current() {
    return saved() ?? (media.matches ? "dark" : "light");
  }
  function apply(theme, persist = true) {
    root.dataset.theme = theme;
    if (persist) {
      try {
        localStorage.setItem("theme", theme);
      } catch {
        /* Storage can be disabled. */
      }
    }
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
    onChange();
  }
  button.addEventListener("click", () =>
    apply(root.dataset.theme === "dark" ? "light" : "dark"),
  );
  media.addEventListener("change", () => {
    if (!saved()) apply(current(), false);
  });
  apply(current(), false);
  return {
    tokens() {
      const style = getComputedStyle(root),
        read = (name) => style.getPropertyValue(name).trim();
      return {
        background: read("--bg"),
        ground: read("--ball"),
        dot: read("--dot"),
      };
    },
  };
}
