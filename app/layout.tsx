import type { Metadata, Viewport } from "next";
import { site } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = { title: site.familyName.en, description: `${site.familyName.en} family tree` };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F5F2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ ["--accent" as string]: site.accent }}>
      <body>{children}</body>
    </html>
  );
}
