import { existsSync, readdirSync } from "fs";
import path from "path";

/**
 * Resolves a local Chromium binary to hand to Remotion so it doesn't try to
 * download one. Checks REMOTION_BROWSER_EXECUTABLE first, then falls back to
 * a Playwright-installed Chromium (common in sandboxed/CI environments).
 * Returns undefined to let Remotion manage/download its own browser.
 */
export function resolveBrowserExecutable(): string | undefined {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) {
    return process.env.REMOTION_BROWSER_EXECUTABLE;
  }

  const playwrightBase = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  let entries: string[] = [];
  try {
    entries = readdirSync(playwrightBase);
  } catch {
    return undefined;
  }

  // Prefer chrome-headless-shell: modern Chrome removed legacy `--headless`
  // mode, which is what Remotion's renderer relies on.
  const headlessShellDir = entries.find((entry) => entry.startsWith("chromium_headless_shell-"));
  if (headlessShellDir) {
    const candidate = path.join(playwrightBase, headlessShellDir, "chrome-linux", "headless_shell");
    if (existsSync(candidate)) return candidate;
  }

  const chromiumDir = entries.find((entry) => entry.startsWith("chromium-"));
  if (!chromiumDir) return undefined;

  const candidate = path.join(playwrightBase, chromiumDir, "chrome-linux", "chrome");
  return existsSync(candidate) ? candidate : undefined;
}
