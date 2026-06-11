import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { profileSnapshot } from "@/lib/knowledge";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#f4f3ef",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bhanu-copilot.vercel.app";
const title = "Bhanu Copilot — Applied AI Engineer";
const description =
  "Ask an AI copilot about Bhanu Pratap Rana — RAG systems, computer vision, FastAPI backends, and production AI products. A RAG-powered portfolio assistant.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Bhanu Copilot",
  },
  description,
  applicationName: "Bhanu Copilot",
  authors: [{ name: profileSnapshot.name, url: profileSnapshot.linkedin }],
  creator: profileSnapshot.name,
  keywords: [
    "Bhanu Pratap Rana",
    "Applied AI Engineer",
    "Generative AI",
    "RAG",
    "Computer Vision",
    "FastAPI",
    "AI Automation",
    "AI portfolio",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Bhanu Copilot",
    title,
    description,
    locale: "en_US",
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
  name: profileSnapshot.name,
  jobTitle: "Applied AI Engineer",
  email: `mailto:${profileSnapshot.email}`,
  url: siteUrl,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Agra",
    addressRegion: "Uttar Pradesh",
    addressCountry: "IN",
  },
  sameAs: [
    profileSnapshot.linkedin,
    profileSnapshot.github,
    profileSnapshot.leetcode,
  ],
  knowsAbout: [
    "Generative AI",
    "Retrieval-Augmented Generation",
    "Computer Vision",
    "FastAPI",
    "AI Automation",
    "Full-stack AI",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Bhanu Copilot",
  url: siteUrl,
  description,
  author: { "@type": "Person", name: profileSnapshot.name },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-stone-950 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
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
        {children}
      </body>
    </html>
  );
}
