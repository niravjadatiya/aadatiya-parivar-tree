import type { Metadata, Viewport } from "next";
import { site } from "@/config/site";
import "./globals.css";

const url = "https://adatiya-parivar-tree.vercel.app";
const title = `${site.familyName.en} | ${site.familyName.gu}`;
const description = "Adatiya Parivar family tree: explore generations, relations and photos of the Adatiya family. આડતીયા પરિવારનું વંશવૃક્ષ.";
export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: { default: title, template: `%s | ${site.familyName.en}` },
  description,
  applicationName: site.familyName.en,
  keywords: ["Adatiya", "Adatiya Parivar", "family tree", "વંશવૃક્ષ", "આડતીયા પરિવાર", "Gujarati family tree"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", url, siteName: site.familyName.en, title, description, locale: "en_IN", alternateLocale: ["gu_IN"] },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F5F2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ ["--accent" as string]: site.accent }}>
      <body>{children}</body>
    </html>
  );
}
