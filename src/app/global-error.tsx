"use client";

import { useEffect } from "react";

// Replaces the root layout when it fails (the copilot, the 3D core), so none
// of globals.css, the fonts or the theme script is loaded. Styles are inline
// and use the night palette, the site's default, so it reads the same in
// either OS theme.
const page: React.CSSProperties = {
  margin: 0,
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  background: "#060a1c",
  color: "#eef2ff",
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.5,
};

const content: React.CSSProperties = {
  maxWidth: "36rem",
  padding: "0 16px",
  margin: "0 auto",
};

const button: React.CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  border: 0,
  borderRadius: 6,
  background: "#eef2ff",
  color: "#060a1c",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
};

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body style={page}>
        <title>Something went wrong</title>
        <main style={content}>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "0 0 12px" }}>
            The site failed to load
          </h1>
          <p style={{ margin: "0 0 20px", color: "#a9b3d9" }}>
            Something broke while drawing it. Try again to load it afresh. Any
            conversation with the copilot is saved in this browser.
          </p>
          <button type="button" onClick={() => unstable_retry()} style={button}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
