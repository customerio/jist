import "../dist/jist-element.js";

// ── Load Shared Fixtures ────────────────────

const [templates, data, theme] = await Promise.all([
  fetch("shared/templates.json").then((r) => r.json()),
  fetch("shared/data.json").then((r) => r.json()),
  fetch("shared/theme.json").then((r) => r.json()),
]);

// ── Date Formatter ──────────────────────────

function formatDate(isoString, name) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const locale = navigator.language;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffSec < 60) return rtf.format(-diffSec, "second");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

// ── Action Logger ───────────────────────────

const logEl = document.getElementById("log");

function onAction({ component, name, data, meta }) {
  const entry = document.createElement("div");
  const parts = [`${component} "${name}"`];
  if (data) parts.push(JSON.stringify(data));
  if (meta) parts.push(`meta: ${JSON.stringify(meta)}`);
  entry.textContent = parts.join(" — ");
  logEl.prepend(entry);
}

// ── Mount Templates ─────────────────────────

function mount(id, templateKey, dataKey) {
  const el = document.getElementById(id);
  el.templates = templates;
  el.template = templateKey;
  el.data = data[dataKey];
  el.theme = theme;
  el.formatDate = formatDate;
  el.onAction = onAction;
}

mount("t-basic", "basic", "basic");
mount("t-image", "image", "image");
mount("t-cta", "cta", "cta");
mount("t-action", "action", "action");
mount("t-hero", "hero", "hero");
mount("t-inbox", "inbox", "inbox");
mount("t-profile", "profile", "profile");
mount("t-stats", "stats", "stats");
mount("t-card", "card", "card");
mount("t-announcement", "announcement", "announcement");

// ── Dark Mode Toggle ────────────────────────

const toggleBtn = document.getElementById("toggle-mode");

// Sync with system preference on load
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
let currentMode = prefersDark ? "dark" : "light";

if (prefersDark) {
  document.body.classList.add("dark");
  toggleBtn.textContent = "Light Mode";
  document.querySelectorAll("jist-template").forEach((el) => {
    el.mode = "dark";
  });
}

toggleBtn.addEventListener("click", () => {
  currentMode = currentMode === "light" ? "dark" : "light";
  document.body.classList.toggle("dark", currentMode === "dark");
  toggleBtn.textContent = currentMode === "light" ? "Dark Mode" : "Light Mode";

  document.querySelectorAll("jist-template").forEach((el) => {
    el.mode = currentMode;
  });
});
