import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | PostCrisp",
    default: "PostCrisp — Your AI Social Media Copilot",
  },
  description:
    "Generate viral captions, find trending hashtags, and discover the best times to post. Your AI-powered social media copilot.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "PostCrisp — Your AI Social Media Copilot",
    description:
      "Generate viral captions, find trending hashtags, and discover the best times to post.",
    type: "website",
    siteName: "PostCrisp",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      {/* suppressHydrationWarning on <body> because browser extensions
          (Grammarly, password managers, etc.) inject attributes onto it
          after SSR but before hydration. The mismatch is a false positive
          and React's recommended fix is to suppress only on this one node. */}
      <body className="antialiased font-sans" suppressHydrationWarning>
        <ToastProvider>
          <ErrorBoundary>
            <OfflineBanner />
            {children}
          </ErrorBoundary>
        </ToastProvider>
      </body>
    </html>
  );
}
