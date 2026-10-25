import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { getLocale } from "@/lib/i18n/server";
import { getTheme, readFlash } from "@/lib/server/ui-prefs";
import { FlashToasts, ToastProvider } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Reading passages are set in a serif, like the paper test booklet.
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "BandUp — Open-source IELTS preparation", template: "%s · BandUp" },
  description: "Lessons, full mock tests, vocabulary and a progress tracker for IELTS Academic and General Training.",
  applicationName: "BandUp",
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111314" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme, flash] = await Promise.all([getLocale(), getTheme(), readFlash()]);
  return (
    <html
      lang={locale}
      data-theme={theme === "system" ? undefined : theme}
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ToastProvider>
          {children}
          <FlashToasts messages={flash} />
          <ServiceWorkerRegister />
        </ToastProvider>
      </body>
    </html>
  );
}
