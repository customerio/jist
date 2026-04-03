// @ts-check
import { test, expect } from "@playwright/test";

// ── Shared Fixtures (inlined to avoid fetch/path issues) ──

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
      type: "layout",
      direction: "vertical",
      children: [
        {
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
      ],
    },
  },
};

const data = {
  basic: {
    title: "Welcome to Notifications",
    body: "This is your notification inbox. Important updates and action items will appear here.",
    timestamp: "2026-04-01T14:00:00Z",
  },
  image: {
    title: "New Dashboard Design",
    body: "Check out the redesigned analytics dashboard with improved charts and faster load times.",
    media: "https://placehold.co/600x400/e2e8f0/475569.png?text=Dashboard+Preview",
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
    avatar: "https://placehold.co/96x96/c7d2fe/4338ca.png?text=SC",
    timestamp: "2026-04-02T10:00:00Z",
    open: { url: "/team/sarah-chen" },
  },
};

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

// ── Test Matrix ───────────────────────────────

const templateNames = ["basic", "image", "cta", "action"];
const modes = ["light", "dark"];

// Templates that contain images — we need to wait for them to load
const templatesWithImages = new Set(["image", "action"]);

for (const templateName of templateNames) {
  for (const mode of modes) {
    test(`${templateName} — ${mode}`, async ({ page }) => {
      // Navigate to the test harness
      await page.goto("http://localhost:3847/web/tests/test-harness.html");

      // Wait for the custom element to be defined
      await page.waitForFunction(() =>
        customElements.get("jist-template") !== undefined
      );

      // Set dark mode on body if needed
      if (mode === "dark") {
        await page.evaluate(() => {
          document.body.classList.add("dark");
        });
      }

      // Mount the template with data, theme, mode, and a deterministic formatDate
      await page.evaluate(
        ({ tmpl, d, th, m }) => {
          const el = document.getElementById("target");
          // Set a deterministic formatDate before other properties trigger render
          el.formatDate = () => "Apr 1, 2026";
          el.template = tmpl;
          el.data = d;
          el.theme = th;
          el.mode = m;
        },
        {
          tmpl: templates[templateName],
          d: data[templateName],
          th: theme,
          m: mode,
        }
      );

      // Wait for images to fully load if this template uses them
      if (templatesWithImages.has(templateName)) {
        await page.waitForFunction(() => {
          const images = document.querySelectorAll("jist-template img");
          return (
            images.length > 0 &&
            Array.from(images).every((img) => img.complete && img.naturalWidth > 0)
          );
        }, { timeout: 10000 });
      }

      // Small settle time for any CSS transitions
      await page.waitForTimeout(200);

      // Screenshot comparison
      await expect(page.locator("jist-template")).toHaveScreenshot(
        `${templateName}-${mode}.png`,
        { maxDiffPixelRatio: 0.01 }
      );
    });
  }
}
