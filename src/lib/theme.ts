/** Colour maths for the admin-configurable brand palette. */

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelToLinear(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

const INK = "#14121F";
const WHITE = "#FFFFFF";

/** Text colour that stays readable on top of the given background. */
export function readableOn(background: string) {
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK) ? WHITE : INK;
}

const RADII = {
  sharp: "0.375rem",
  soft: "0.75rem",
  round: "1.125rem",
} as const;

export type ThemeInput = {
  brandColor: string;
  accentColor: string;
  radius: keyof typeof RADII;
};

/**
 * CSS custom properties injected into <head>. Every brand-coloured surface in the app is
 * derived from these, so changing a colour in the admin panel re-themes the whole portal.
 */
export function themeCss({ brandColor, accentColor, radius }: ThemeInput) {
  const brand = hexToRgb(brandColor) ? brandColor : "#5B4BF5";
  const accent = hexToRgb(accentColor) ? accentColor : "#FFC93C";
  return [
    // "html:root" outranks the stylesheet defaults regardless of where the tag lands in <head>.
    "html:root{",
    `--brand:${brand};`,
    `--brand-fg:${readableOn(brand)};`,
    `--spark:${accent};`,
    `--spark-fg:${readableOn(accent)};`,
    `--radius:${RADII[radius] ?? RADII.soft};`,
    "}",
  ].join("");
}

export type ThemeChoice = "light" | "dark" | "system";

/**
 * Inline script that applies the saved theme before first paint, so it never flashes.
 * The visitor's own choice (localStorage) wins over the site default from the admin panel.
 */
export function themeScript(defaultTheme: ThemeChoice) {
  return `(function(){try{var c=localStorage.getItem("theme")||"${defaultTheme}";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
}
