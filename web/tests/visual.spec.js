// @ts-check
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Load Shared Fixtures ──────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(__dirname, "../../shared");

const allTemplates = JSON.parse(readFileSync(resolve(sharedDir, "templates.json"), "utf-8"));
const data = JSON.parse(readFileSync(resolve(sharedDir, "data.json"), "utf-8"));
const theme = JSON.parse(readFileSync(resolve(sharedDir, "theme.json"), "utf-8"));

// Filter out $schema and platform-specific templates (e.g. liveActivity)
const templateNames = ["basic", "image", "cta", "action", "hero", "inbox", "profile", "announcement"];
const templates = Object.fromEntries(templateNames.map((k) => [k, allTemplates[k]]));

// ── Test Matrix ───────────────────────────────

const modes = ["light", "dark"];

// Templates that contain images — we need to wait for them to load
const templatesWithImages = new Set(["image", "action", "hero", "inbox", "profile", "announcement"]);

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
        ({ name, tmpls, d, th, m }) => {
          const el = document.getElementById("target");
          // Set a deterministic formatDate before other properties trigger render
          el.formatDate = () => "Apr 1, 2026";
          el.templates = tmpls;
          el.template = name;
          el.data = d;
          el.theme = th;
          el.mode = m;
        },
        {
          name: templateName,
          tmpls: templates,
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
