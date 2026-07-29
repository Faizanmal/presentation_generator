import type { Metadata } from "next";
import { 
  Inter, 
  Playfair_Display, 
  Sora, 
  Space_Grotesk, 
  Outfit, 
  Bebas_Neue,
  DM_Serif_Display,
  DM_Sans
} from "next/font/google";
import { Toaster } from "@/components/ui/sooner";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ColdStartProvider } from "@/components/providers/cold-start-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ErrorBoundary } from "@/components/providers/error-boundary";
import { NotificationProvider } from "@/components/ui/enhanced-ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupErrorTracking } from "@/lib/sentry";
import { GoogleAnalytics, GoogleTagManager, GoogleTagManagerNoScript } from "@/components/analytics";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import "./globals.css";

// Initialize error tracking
if (typeof window !== 'undefined') {
  setupErrorTracking();
}

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const bebasNeue = Bebas_Neue({ variable: "--font-bebas-neue", weight: "400", subsets: ["latin"] });
const dmSerifDisplay = DM_Serif_Display({ variable: "--font-dm-serif", weight: "400", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

const fontClasses = `${inter.variable} ${playfair.variable} ${sora.variable} ${spaceGrotesk.variable} ${outfit.variable} ${bebasNeue.variable} ${dmSerifDisplay.variable} ${dmSans.variable}`;


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
    <html lang="en" data-theme="light" style={{ colorScheme: 'light' }}>
      <head>
        <GoogleTagManager />
      </head>
      <body className={`${fontClasses} font-sans antialiased`}>
        <GoogleTagManagerNoScript />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="presentation-theme"
        >
          <QueryProvider>
            <ColdStartProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <NotificationProvider>
                    <TooltipProvider>
                      <ImpersonationBanner />
                      {children}
                      <Toaster position="top-right" richColors />
                    </TooltipProvider>
                  </NotificationProvider>
                </ErrorBoundary>
              </AuthProvider>
            </ColdStartProvider>
          </QueryProvider>
        </ThemeProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
