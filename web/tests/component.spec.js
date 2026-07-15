// @ts-check
import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// ── Load Shared Fixtures ──────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedTestsDir = resolve(__dirname, "../../shared/tests");

const fixtureFiles = readdirSync(sharedTestsDir).filter((f) => f.endsWith(".json"));

// ── Test Matrix ───────────────────────────────

for (const file of fixtureFiles) {
  const component = basename(file, ".json");
  const cases = JSON.parse(readFileSync(resolve(sharedTestsDir, file), "utf-8"));

  for (const caseName of Object.keys(cases)) {
    const modes = ["light", "dark"];

    for (const mode of modes) {
      test(`${component} — ${caseName} — ${mode}`, async ({ page }) => {
        const { node, data, theme } = cases[caseName];

        // Wrap the node into a full template
        const wrappedTemplate = {
          version: "1",
          root: {
            type: "layout",
            direction: "vertical",
            children: [node],
          },
        };

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
          ({ tmpls, d, th, m, isDate }) => {
            const el = document.getElementById("target");
            // Set a deterministic formatDate for date components
            if (isDate) {
              el.formatDate = () => "Apr 1, 2026";
            }
            el.templates = tmpls;
            el.template = "test";
            el.data = d;
            el.theme = th;
            el.mode = m;
          },
          {
            tmpls: { test: [wrappedTemplate] },
            d: data,
            th: theme,
            m: mode,
            isDate: node.type === "date",
          }
        );

        // Wait for images to fully load if this is an image component
        if (node.type === "image") {
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
          `${component}-${caseName}-${mode}.png`,
          { maxDiffPixelRatio: 0.01 }
        );
      });
    }
  }
}
