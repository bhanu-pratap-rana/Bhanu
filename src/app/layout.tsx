import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Anek_Latin } from "next/font/google";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { CopilotHost } from "@/components/chat/CopilotHost";
import { AskBar } from "@/components/chat/AskBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { MemoryCore } from "@/components/scene/MemoryCore";
import { education, experience, profile } from "@/lib/knowledge";
import { siteName, siteUrl } from "@/lib/site";
import "./globals.css";

// One design drawn for both scripts, so English and Hindi sit together
// without a change of voice. The width axis gives the condensed display cut.
const anekLatin = Anek_Latin({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-anek-latin",
  display: "swap",
});

const anekDevanagari = Anek_Devanagari({
  subsets: ["devanagari"],
  axes: ["wdth"],
  variable: "--font-anek-deva",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android shrinks the layout when the keyboard opens, keeping the composer
  // in view. iOS ignores this and scrolls the focused field into view itself.
  interactiveWidget: "resizes-content",
  colorScheme: "dark light",
  themeColor: "#0a1024",
};

const title = `${profile.name} — ${profile.title}`;
const description =
  "Applied AI Engineer in Agra building retrieval, agent and vision systems, with a focus on Hindi and other Indian languages. Ask the site's copilot and watch which notes it retrieves.";

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
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title,
    description,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
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
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"){document.documentElement.setAttribute("data-theme",t);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content","#eef1f8")})}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anekLatin.variable} ${anekDevanagari.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-[15px] focus:text-ground"
        >
          Skip to content
        </a>
        <a
          href="#copilot"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-16 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-[15px] focus:text-ground max-lg:hidden"
        >
          Skip to the copilot
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
          <MemoryCore />
          <div className="shell">
            <div className="page" id="page">
              <SiteHeader />
              {children}
              <SiteFooter />
            </div>
            <CopilotHost />
          </div>
          <AskBar />
        </ChatProvider>
      </body>
    </html>
  );
}
