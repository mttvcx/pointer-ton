import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Editorial serif for captions/eyebrow. Load both upright and italic so the
// QOVES-style italic subtitle has real glyphs (not a faux-slant).
const playfair = loadPlayfair("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
loadPlayfair("italic", {
  weights: ["500", "600"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export const fonts = {
  serif: playfair.fontFamily, // "Playfair Display"
  sans: inter.fontFamily, // "Inter"
};

// Muted slate palette — editorial, no neon, no glow.
export const colors = {
  bg: "#15171c",
  bgDeep: "#101216",
  bgElev: "#1c1f26",
  panel: "#1a1d24",
  ink: "#e9e6df", // warm off-white
  inkDim: "#9aa1ab",
  inkFaint: "#5a626d",
  line: "rgba(233, 230, 223, 0.08)",
  lineStrong: "rgba(233, 230, 223, 0.16)",
  accent: "#c9a44c", // restrained brushed gold — "smart money"
  accentDim: "#7d6a35",
  pos: "#5fa97f", // muted green (buy)
  neg: "#c2615a", // muted red (sell)
  grid: "rgba(233, 230, 223, 0.05)",
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
