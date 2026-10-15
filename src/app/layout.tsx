import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gr8 Hook Dashboard", template: "%s | Gr8 Hook Dashboard" },
  description: "See how your ad spend turns into leads, appointments and sales.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0A1320" };

// Applies saved theme + layout before first paint, so there's no flash of the wrong theme.
const prefsScript = `try{var d=document.documentElement;var t=localStorage.getItem('g8-theme');if(t==='light')d.dataset.theme='light';var l=localStorage.getItem('g8-layout');if(l==='focus')d.dataset.layout='focus';}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
