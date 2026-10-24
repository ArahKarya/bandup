import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Reading passages are set in a serif, like the paper test booklet.
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "BandUp — Open-source IELTS preparation", template: "%s · BandUp" },
  description: "Lessons, full mock tests, vocabulary and a progress tracker for IELTS Academic and General Training.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
