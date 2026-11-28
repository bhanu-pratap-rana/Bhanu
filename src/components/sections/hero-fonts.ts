import { Eczar } from "next/font/google";

// Eczar's Devanagari file, for the Hindi name beside the hero h1 and nowhere
// else. Called here, not in the root layout, so only the home route (the one
// page that imports the hero) preloads it; the layout keeps Eczar Latin-only.
export const eczarDeva = Eczar({
  subsets: ["devanagari"],
  variable: "--font-eczar-deva",
  display: "swap",
});
