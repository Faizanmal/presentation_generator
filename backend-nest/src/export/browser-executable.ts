import { existsSync } from 'fs';

/**
 * Prefer an installed Chrome/Edge over Puppeteer's bundled browser.
 * Local Windows/Linux/macOS installs often have Chrome while the
 * Puppeteer cache (chrome/win64-152...) was never downloaded.
 */
export function resolveBrowserExecutable(): string | undefined {
  const fromEnv =
    process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    localAppData
      ? `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`
      : '',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];

  return candidates.find((path) => Boolean(path) && existsSync(path));
}
