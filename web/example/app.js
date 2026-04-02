import "../src/jist-element.js";

// ── Templates ───────────────────────────────

const templates = {
  basic: {
    version: "1",
    root: {
      type: "layout",
      direction: "vertical",
      gap: 6,
      children: [
        { type: "heading", name: "title" },
        { type: "text", name: "body" },
        { type: "date", name: "timestamp" },
      ],
    },
  },
  image: {
    version: "1",
    root: {
      type: "layout",
      direction: "vertical",
      gap: 8,
      children: [
        { type: "heading", name: "title" },
        {
          type: "layout",
          direction: "vertical",
          margin: { top: 4, bottom: 4 },
          children: [
            {
              type: "image",
              name: "media",
              width: "fill",
              height: 180,
              objectFit: "cover",
              borderRadius: 8,
            },
          ],
        },
        { type: "text", name: "body" },
        { type: "date", name: "timestamp" },
      ],
    },
  },
  cta: {
    version: "1",
    root: {
      type: "layout",
      direction: "vertical",
      gap: 6,
      children: [
        { type: "heading", name: "title" },
        { type: "text", name: "body" },
        {
          type: "layout",
          direction: "horizontal",
          align: "center",
          justify: "space-between",
          margin: { top: 4 },
          children: [
            { type: "date", name: "timestamp" },
            { type: "button", name: "cta", variant: "secondary" },
          ],
        },
      ],
    },
  },
  action: {
    version: "1",
    root: {
      type: "action",
      name: "open",
      meta: { trackEvent: "card_click" },
      children: [
        {
          type: "layout",
          direction: "horizontal",
          gap: 12,
          align: "center",
          children: [
            {
              type: "image",
              name: "avatar",
              width: 48,
              height: 48,
              objectFit: "cover",
              borderRadius: 24,
            },
            {
              type: "layout",
              direction: "vertical",
              gap: 4,
              children: [
                { type: "heading", name: "title", variant: "h4" },
                { type: "text", name: "body" },
                { type: "date", name: "timestamp" },
              ],
            },
          ],
        },
      ],
    },
  },
};

// ── Data ────────────────────────────────────

const data = {
  basic: {
    title: "Welcome to Notifications",
    body: "This is your notification inbox. Important updates and action items will appear here.",
    timestamp: "2026-04-01T14:00:00Z",
  },
  image: {
    title: "New Dashboard Design",
    body: "Check out the redesigned analytics dashboard with improved charts and faster load times.",
    media: "https://placehold.co/600x400/e2e8f0/475569?text=Dashboard+Preview",
    timestamp: "2026-04-01T08:30:00Z",
  },
  cta: {
    title: "Action Required: Verify Email",
    body: "Please verify your email address to unlock all features and secure your account.",
    timestamp: "2026-03-31T09:15:00Z",
    cta: { label: "Verify now", url: "#verify" },
  },
  action: {
    title: "Sarah Chen joined the team",
    body: "Give her a warm welcome!",
    avatar: "https://placehold.co/96x96/c7d2fe/4338ca?text=SC",
    timestamp: "2026-04-02T10:00:00Z",
    open: { url: "/team/sarah-chen" },
  },
};

// ── Theme ───────────────────────────────────

const theme = {
  heading: {
    text: { fontSize: 15, fontWeight: 600, color: "#1A1A2E" },
    h4: {
      text: { fontSize: 14, fontWeight: 600 },
    },
  },
  text: {
    text: { fontSize: 13, color: "#4A4A68", maxLines: 3 },
  },
  date: {
    text: { fontSize: 12, color: "#8E8EA0" },
  },
  button: {
    text: { color: "#FFFFFF", fontSize: 13, fontWeight: 500 },
    background: { color: "#4F46E5" },
    border: { radius: 6 },
    padding: { top: 7, right: 14, bottom: 7, left: 14 },
    states: {
      hover: { background: { color: "#4338CA" } },
      active: { background: { color: "#3730A3" } },
    },
    secondary: {
      text: { color: "#4A4A68" },
      background: { color: "#F4F4F6" },
      border: { width: 1, color: "#E2E2E8", radius: 6 },
      states: {
        hover: { background: { color: "#E8E8EE" } },
        active: { background: { color: "#DDDDE5" } },
      },
    },
  },
  modes: {
    dark: {
      heading: {
        text: { color: "#F0F0F5" },
      },
      text: {
        text: { color: "#B0B0C0" },
      },
      date: {
        text: { color: "#707088" },
      },
      button: {
        background: { color: "#6366F1" },
        states: {
          hover: { background: { color: "#5558E8" } },
          active: { background: { color: "#4F46E5" } },
        },
        secondary: {
          text: { color: "#C0C0D0" },
          background: { color: "#2A2A3C" },
          border: { color: "#3A3A4C" },
          states: {
            hover: { background: { color: "#333346" } },
            active: { background: { color: "#3A3A50" } },
          },
        },
      },
    },
  },
};

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
  el.template = templates[templateKey];
  el.data = data[dataKey];
  el.theme = theme;
  el.formatDate = formatDate;
  el.onAction = onAction;
}

mount("t-basic", "basic", "basic");
mount("t-image", "image", "image");
mount("t-cta", "cta", "cta");
mount("t-action", "action", "action");

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

  // Update all jist-template elements
  document.querySelectorAll("jist-template").forEach((el) => {
    el.mode = currentMode;
  });
});
