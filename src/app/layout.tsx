import type { Metadata, Viewport } from "next";
import { Eczar, Hind, Schibsted_Grotesk } from "next/font/google";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { CopilotHost } from "@/components/chat/CopilotHost";
import { SkipToCopilot } from "@/components/chat/SkipToCopilot";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { PORTRAIT_JPG } from "@/components/site/HexPortrait";
import { MemoryCore } from "@/components/scene/MemoryCore";
import { education, experience, profile } from "@/lib/knowledge";
import { baseOpenGraph, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

// Display: Eczar, one design drawn for Latin and Devanagari, so the name and
// its Hindi twin read as one mark. Variable weight (one file per script).
// Latin only here: a root-layout font is preloaded on every route, and the
// Devanagari name (a line beside the hero h1, not inside it) is shown only on
// the home page, which loads that file itself (sections/hero-fonts.ts).
const eczar = Eczar({
  subsets: ["latin"],
  variable: "--font-eczar",
  display: "swap",
});

// Body, UI and chat. Latin only: the font has no Devanagari.
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

// Hindi inside body text (the hero's starter, chat answers, the ticker):
// a text Devanagari after Schibsted in the stack. Static weights, so only
// the ones used: 400 text, 500 medium, 600 for bold in answers (markdown
// sets <strong> semibold; with font-synthesis off it would drop to 500).
// Not preloaded: unicode-range fetches it only on pages that show Hindi.
const hind = Hind({
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  variable: "--font-hind",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android shrinks the layout when the keyboard opens, keeping the composer
  // in view. iOS ignores this and scrolls the focused field into view itself.
  interactiveWidget: "resizes-content",
  colorScheme: "dark light",
  themeColor: "#060a1c",
};

const title = `${profile.name} — ${profile.title}`;
const description =
  "Applied AI Engineer in Agra building AI for Indian languages: semantic search over 1,633 Hindi books, a learning app piloted with 570+ students. Ask his copilot.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s — ${profile.name}`,
  },
  description,
  applicationName: siteName,
  authors: [{ name: profile.name, url: profile.linkedin }],
  creator: profile.name,
  keywords: [
    profile.name,
    "Applied AI Engineer",
    "Generative AI",
    "RAG",
    "AI Agents",
    "Computer Vision",
    "FastAPI",
    "Indic AI",
    "Hindi NLP",
  ],
  // No canonical or robots here: every child inherits them, so the 404 page
  // would claim the home page as its canonical and emit a second robots tag
  // beside its own noindex. The home page sets its canonical; index/follow is
  // the default.
  openGraph: {
    ...baseOpenGraph,
    url: siteUrl,
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  alternateName: profile.nameHindi,
  jobTitle: profile.title,
  email: `mailto:${profile.email}`,
  url: siteUrl,
  image: new URL(PORTRAIT_JPG, siteUrl).toString(),
  address: {
    "@type": "PostalAddress",
    addressLocality: "Agra",
    addressRegion: "Uttar Pradesh",
    addressCountry: "IN",
  },
  worksFor: experience
    .filter((role) => role.period.endsWith("Present"))
    .map((role) => ({ "@type": "Organization", name: role.org })),
  alumniOf: [...new Set(education.map((entry) => entry.org))].map((name) => ({
    "@type": "EducationalOrganization",
    name,
  })),
  knowsLanguage: ["en", "hi"],
  sameAs: [profile.linkedin, profile.github],
  knowsAbout: [
    "Generative AI",
    "Retrieval-Augmented Generation",
    "AI Agents",
    "Computer Vision",
    "FastAPI",
    "Multilingual and Indic AI",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
  description,
  author: { "@type": "Person", name: profile.name },
};

// Runs before first paint so a stored theme choice never flashes. Night is
// the default; light is only ever the visitor's own choice.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"){document.documentElement.setAttribute("data-theme",t);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content","#eef1fb")})}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${eczar.variable} ${schibsted.variable} ${hind.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Without JS the 3D stage never draws and the live line never runs,
            so hide both rather than leave a blank band and a dead button.
            The CSP allows inline styles ('unsafe-inline' in style-src). */}
        <noscript>
          <style>
            {
              ".hero-stage{display:none}.hero-live button{display:none}.hero-live-mark{animation:none}"
            }
          </style>
        </noscript>
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-[15px] focus:text-ground"
        >
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ChatProvider>
          {/* Inside the provider: it opens the closed window. Still the
              second stop in the tab order, right after "Skip to content". */}
          <SkipToCopilot />
          <MemoryCore />
          <div className="shell">
            <div className="page" id="page">
              <SiteHeader />
              {children}
              <SiteFooter />
            </div>
          </div>
          {/* After the page, outside the shell's stacking context: the
              floating window and its launcher sit above everything but the
              modal dialog (which is in the top layer anyway). */}
          <CopilotHost />
        </ChatProvider>
      </body>
    </html>
  );
}
