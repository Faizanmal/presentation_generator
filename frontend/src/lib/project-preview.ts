/** Client-side deck card placeholder when no thumbnail URL exists */

const GRADIENT_PAIRS: [string, string][] = [
  ["#2563eb", "#7c3aed"],
  ["#0d9488", "#0891b2"],
  ["#dc2626", "#ea580c"],
  ["#4f46e5", "#db2777"],
  ["#059669", "#0284c7"],
  ["#7c2d12", "#b45309"],
];

export function hashString(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getProjectInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {return "PD";}
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function projectPlaceholderGradient(
  seed: string,
  themeColors?: { primary?: string; accent?: string; secondary?: string } | null,
): string {
  const primary = themeColors?.primary;
  const accent = themeColors?.accent || themeColors?.secondary;
  if (primary && accent) {
    return `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`;
  }
  if (primary) {
    return `linear-gradient(135deg, ${primary} 0%, ${primary}99 100%)`;
  }
  const pair = GRADIENT_PAIRS[hashString(seed) % GRADIENT_PAIRS.length];
  return `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`;
}

export function stripHtmlText(raw: string): string {
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
