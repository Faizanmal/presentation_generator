import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sooner";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ErrorBoundary } from "@/components/providers/error-boundary";
import { NotificationProvider } from "@/components/ui/enhanced-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupErrorTracking } from "@/lib/sentry";
import { GoogleAnalytics, GoogleTagManager, GoogleTagManagerNoScript } from "@/components/analytics";
import "./globals.css";

// Initialize error tracking
if (typeof window !== 'undefined') {
  setupErrorTracking();
}

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Presentation Designer - AI-Powered Presentations",
  description: "Create stunning presentations in minutes with AI. Transform your ideas into beautifully designed slides.",
  keywords: ["presentation", "AI", "design", "slides", "powerpoint", "pitch deck"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GoogleTagManager />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        <GoogleTagManagerNoScript />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme
          disableTransitionOnChange={false}
          storageKey="presentation-theme"
        >
          <QueryProvider>
            <AuthProvider>
              <ErrorBoundary>
                <NotificationProvider>
                  <TooltipProvider>
                    {children}
                    <Toaster position="top-right" richColors />
                  </TooltipProvider>
                </NotificationProvider>
              </ErrorBoundary>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
