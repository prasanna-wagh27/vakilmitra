import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "VakilMitra",
  description: "Marathi-first practice platform for Maharashtra advocates",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f4fb8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mr">
      <body className="min-h-dvh antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
