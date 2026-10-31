"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import {
  Sparkles,
  Zap,
  Palette,
  ArrowRight,
  CheckCircle2,
  Play,
  Users,
  Mic,
  BarChart3,
  Globe,
  Shield,
  Layers,
  MousePointerClick,
  Bot,
  Loader2,
  Menu,
  X,
  Layout,
  Share2,
} from "lucide-react";
import { BRAND, PRODUCT_NAME } from "@/lib/brand";
import { FEATURES } from "@/lib/features";
import { PLAN_LIMITS, PLANS_LIST } from "@/lib/plans";
import { motion } from "framer-motion";
import {
  FadeInUp,
  StaggerContainer,
  StaggerItem,
  ScaleOnHover,
  FloatingElement,
  AnimatedCounter,
  GlowOnHover,
} from "@/components/ui/animations";
import { ThemeToggleButton } from "@/components/ui/enhanced-ui";
import { warmupServerInBackground } from "@/lib/server-wakeup";

const FOOTER_COMING_SOON_BADGE = (
  <span className="ml-2 inline-flex items-center rounded-full bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
    Coming soon
  </span>
);

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, initialized } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    warmupServerInBackground();
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Redirect authenticated users straight to the dashboard
  useEffect(() => {
    if (mounted && initialized && !isAuthLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isAuthLoading, initialized, router, mounted]);

  if (mounted && initialized && !isAuthLoading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-6 scale-110">
          <Sparkles className="h-10 w-10 text-slate-900 dark:text-white animate-pulse" />
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse text-lg">
          Opening dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-900/20 via-slate-50 dark:via-slate-950 to-slate-50 dark:to-slate-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Responsive Navigation with Mobile Hamburger Menu */}
        <header className="container mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                {PRODUCT_NAME}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Create
              </Link>
              <Link
                href="/features"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Features
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/marketplace"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Templates
              </Link>
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="hidden md:block">
                <ThemeToggleButton />
              </div>
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm px-2.5 sm:px-3.5 h-9"
                >
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md shadow-blue-500/20 text-xs sm:text-sm px-2.5 sm:px-4 h-9 whitespace-nowrap"
                >
                  Get Started Free
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Hamburger Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 shadow-xl flex flex-col gap-1.5">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Create
              </Link>
              <Link
                href="/features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Features
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Pricing
              </Link>
              <Link
                href="/marketplace"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Templates
              </Link>
              <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-slate-200 dark:border-slate-800 px-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Appearance
                </span>
                <ThemeToggleButton />
              </div>
            </div>
          )}
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 pt-10 pb-16">
          <div className="max-w-5xl mx-auto text-center">
            <FadeInUp>
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-medium mb-6 cursor-default"
              >
                <Sparkles className="h-4 w-4" />
                <span>AI-Powered Presentation Creation</span>
                <span className="px-2 py-0.5 bg-blue-500/20 rounded-full text-xs">New</span>
              </motion.div>
            </FadeInUp>

            <FadeInUp>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
                Turn your ideas into{" "}
                <span className="bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  stunning presentations
                </span>{" "}
                in seconds
              </h1>
            </FadeInUp>

            <FadeInUp>
              <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto leading-relaxed">
                Just describe your topic. Our AI generates beautiful, professionally designed
                presentations with structured content, animations, and themes—ready to present or customize.
              </p>
            </FadeInUp>

            <FadeInUp>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link href="/register">
                  <GlowOnHover glowColor="rgba(59, 130, 246, 0.4)">
                    <Button
                      size="lg"
                      className="text-base sm:text-lg px-7 h-13 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl shadow-blue-500/20"
                    >
                      Start Creating Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </GlowOnHover>
                </Link>
                <Link href="/features">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-base sm:text-lg px-7 h-13 border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800 backdrop-blur-sm"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Explore Features
                  </Button>
                </Link>
              </div>
            </FadeInUp>

            <FadeInUp>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-4">
                No credit card required • {PLAN_LIMITS.FREE.presentations} free presentations • Cancel anytime
              </p>
            </FadeInUp>
          </div>

          {/* Illustrated Interactive Product Preview (Replaces placehold.co placeholder) */}
          <FadeInUp>
            <div className="mt-12 max-w-6xl mx-auto">
              <div className="relative">
                <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-2xl blur-2xl opacity-20" />

                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
                  {/* Browser Bar */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-4 py-1 bg-white dark:bg-slate-900 rounded-md text-xs text-slate-600 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700">
                        app.presentpitch.com
                      </div>
                    </div>
                  </div>

                  {/* Illustrated PresentPitch Studio & Slide Editor */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 sm:p-5">
                    {/* Top App Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-linear-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Specialty Coffee Roastery Expansion Pitch
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Saved
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <Layout className="h-3.5 w-3.5 text-blue-500" />
                          Smart Layouts
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <Share2 className="h-3.5 w-3.5 text-purple-500" />
                          Share
                        </span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-sm">
                          <Play className="h-3 w-3" />
                          Present
                        </span>
                      </div>
                    </div>

                    {/* Studio Workspace Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                      {/* Left Slide Filmstrip */}
                      <div className="hidden md:flex md:col-span-3 flex-col gap-2">
                        {[
                          { num: 1, title: "The Vision & Craft", tag: "Hero Split", active: true },
                          { num: 2, title: "Three Pillars of Quality", tag: "3-Column Cards", active: false },
                          { num: 3, title: "Unit Economics & Margin", tag: "Stats + A/B/C", active: false },
                          { num: 4, title: "6-Month Launch Roadmap", tag: "Timeline", active: false },
                        ].map((s) => (
                          <div
                            key={s.num}
                            className={`rounded-xl p-2.5 border transition-all ${
                              s.active
                                ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 shadow-sm"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                              <span className="text-slate-900 dark:text-white">
                                {s.num}. {s.title}
                              </span>
                              <span className="text-[10px] text-blue-600 dark:text-blue-400">{s.tag}</span>
                            </div>
                            <div className="h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center px-2 gap-1.5">
                              <div className="w-5 h-5 rounded bg-blue-500/20 shrink-0" />
                              <div className="flex-1 space-y-1">
                                <div className="h-1.5 w-3/4 rounded bg-slate-300 dark:bg-slate-700" />
                                <div className="h-1.5 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Center Live Slide Canvas */}
                      <div className="md:col-span-9 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-inner flex flex-col justify-between gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                          <div className="sm:col-span-7 flex flex-col gap-2.5 text-left">
                            <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              THE VISION • SERIES A DECK
                            </span>
                            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
                              Scaling Third-Wave Specialty Coffee With Predictive Micro-Roasting
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                              Direct-trade sourcing paired with AI roast telemetry delivers fresher single-origin subscriptions within 24 hours of roasting.
                            </p>
                            <div className="grid grid-cols-3 gap-2.5 pt-2">
                              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 p-2.5">
                                <div className="text-lg sm:text-xl font-extrabold text-blue-600 dark:text-blue-400">
                                  95%
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                                  Subscriber Retention
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 p-2.5">
                                <div className="text-lg sm:text-xl font-extrabold text-purple-600 dark:text-purple-400">
                                  3×
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                                  Roastery Throughput
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 p-2.5">
                                <div className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                  68%
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                                  Gross Margin
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Topic-Matched Visual Panel */}
                          <div className="sm:col-span-5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-linear-to-br from-amber-900 via-stone-900 to-slate-900 p-4 text-white flex flex-col justify-between min-h-[190px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/15 backdrop-blur-sm">
                                Topic-Matched Visual
                              </span>
                              <span className="text-[10px] text-amber-300 font-medium">
                                Auto-Fit Layout
                              </span>
                            </div>
                            <div className="my-auto py-3">
                              <div className="text-sm font-bold text-amber-200 mb-1">
                                Reserve Espresso &amp; Pour-Over Bar
                              </div>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                Curated imagery matched to deck topic + slide keywords automatically.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-[11px] text-slate-300">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              <span>Zero clipping • Balanced card heights</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Badges */}
                <FloatingElement duration={4} distance={10} className="absolute -right-8 top-16 hidden lg:block">
                  <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-linear-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">AI Generated</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">12 slides in 8 seconds</p>
                      </div>
                    </div>
                  </div>
                </FloatingElement>

                <FloatingElement duration={5} distance={8} className="absolute -left-6 bottom-12 hidden lg:block">
                  <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-linear-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">Real-time Collaboration</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">3 teammates editing</p>
                      </div>
                    </div>
                  </div>
                </FloatingElement>
              </div>
            </div>
          </FadeInUp>

          {FEATURES.homepageStats && (
            <FadeInUp>
              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                {[
                  { value: 50000, label: "Presentations Created", suffix: "+" },
                  { value: 10000, label: "Happy Users", suffix: "+" },
                  { value: 99, label: "Uptime", suffix: "%" },
                  { value: 4.9, label: "User Rating", suffix: "/5" },
                ].map((stat, index) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-1">
                      <AnimatedCounter value={stat.value} duration={2 + index * 0.3} />
                      {stat.suffix}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </FadeInUp>
          )}
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 relative">
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-blue-950/5 to-transparent pointer-events-none" />

          <div className="container mx-auto px-4 sm:px-6 relative">
            <FadeInUp>
              <div className="text-center mb-12">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase tracking-wider">
                  Features
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-4">
                  Everything you need to create{" "}
                  <span className="bg-linear-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    stunning presentations
                  </span>
                </h2>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                  Powered by advanced AI, our platform helps you create professional presentations in minutes, not hours.
                </p>
              </div>
            </FadeInUp>

            <StaggerContainer staggerDelay={0.08} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StaggerItem>
                <FeatureCard
                  icon={<Bot className="h-6 w-6" />}
                  title="AI-Powered Generation"
                  description="Describe your topic and watch as AI creates complete, structured presentations with compelling content."
                  gradient="from-blue-500 to-cyan-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<Palette className="h-6 w-6" />}
                  title="Beautiful Themes"
                  description="Choose from dozens of professionally designed themes that automatically adapt to your content."
                  gradient="from-purple-500 to-pink-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<Users className="h-6 w-6" />}
                  title="Real-time Collaboration"
                  description="Work together with your team in real-time. See cursors, edits, and comments instantly."
                  gradient="from-green-500 to-emerald-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<Mic className="h-6 w-6" />}
                  title="Voice-to-Slides"
                  description="Speak your ideas and let AI convert your speech into beautiful slide content automatically."
                  gradient="from-orange-500 to-red-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<BarChart3 className="h-6 w-6" />}
                  title="Analytics & Insights"
                  description="Track views, engagement, and get AI-powered insights on how to improve your presentations."
                  gradient="from-yellow-500 to-orange-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<Globe className="h-6 w-6" />}
                  title="18+ Languages"
                  description="Create and translate presentations in multiple languages with automatic RTL support."
                  gradient="from-indigo-500 to-purple-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<MousePointerClick className="h-6 w-6" />}
                  title="Interactive Embeds"
                  description="Add live polls, Q&A sessions, quizzes, and forms to engage your audience in real-time."
                  gradient="from-pink-500 to-rose-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<Layers className="h-6 w-6" />}
                  title="Template Marketplace"
                  description="Browse and use professional slide templates tailored for pitch decks, roadmaps, and reports."
                  gradient="from-teal-500 to-cyan-500"
                />
              </StaggerItem>
              <StaggerItem>
                <FeatureCard
                  icon={<Shield className="h-6 w-6" />}
                  title="Enterprise Security"
                  description="SSO, SAML, audit logs, and compliance features for enterprise teams."
                  gradient="from-slate-500 to-zinc-500"
                />
              </StaggerItem>
            </StaggerContainer>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16">
          <div className="container mx-auto px-4 sm:px-6">
            <FadeInUp>
              <div className="text-center mb-12">
                <span className="text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase tracking-wider">
                  Pricing
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-4">
                  Simple, transparent pricing
                </h2>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
                  Start free, upgrade when you need more power
                </p>
              </div>
            </FadeInUp>

            <StaggerContainer staggerDelay={0.1} className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {PLANS_LIST.map((plan) => (
                <StaggerItem key={plan.id}>
                  <PricingCard
                    name={plan.name}
                    price={`$${plan.priceMonthly}`}
                    period={plan.priceMonthly > 0 ? "/month" : undefined}
                    description={
                      plan.id === "FREE"
                        ? "Perfect for trying out"
                        : plan.id === "PRO"
                          ? "For power users — includes Thinking credits"
                          : "For teams and organizations"
                    }
                    features={[...plan.features, ...(plan.id === "FREE" ? ["Community support"] : [])]}
                    buttonText={
                      plan.id === "FREE"
                        ? "Get Started"
                        : plan.id === "PRO"
                          ? "Start Pro Trial"
                          : "Contact Sales"
                    }
                    buttonVariant={plan.popular ? "default" : "outline"}
                    highlighted={plan.popular}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 relative">
          <div className="absolute inset-0 bg-linear-to-r from-blue-600/15 to-purple-600/15 pointer-events-none" />
          <FadeInUp>
            <div className="container mx-auto px-4 sm:px-6 text-center relative">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                  Ready to create your first{" "}
                  <span className="bg-linear-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                    AI presentation
                  </span>
                  ?
                </h2>
                <p className="text-base sm:text-xl text-slate-600 dark:text-slate-400 mb-8">
                  Join thousands of professionals who save hours on presentation design every week.
                </p>
                <Link href="/register">
                  <GlowOnHover glowColor="rgba(59, 130, 246, 0.5)">
                    <Button
                      size="lg"
                      className="text-base sm:text-lg px-8 h-13 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl"
                    >
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </GlowOnHover>
                </Link>
              </div>
            </div>
          </FadeInUp>
        </section>

        {/* Footer — Real routes or disabled "Coming soon" items (no "#" links) */}
        <footer className="border-t border-slate-200 dark:border-slate-800 py-12 bg-white/40 dark:bg-slate-950/40">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-lg font-bold">{PRODUCT_NAME}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {BRAND.description}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                  <li>
                    <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Create Presentation
                    </Link>
                  </li>
                  <li>
                    <Link href="/features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/marketplace" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Templates
                    </Link>
                  </li>
                  <li>
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                    >
                      Integrations
                      {FOOTER_COMING_SOON_BADGE}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                  <li>
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                    >
                      About
                      {FOOTER_COMING_SOON_BADGE}
                    </span>
                  </li>
                  <li>
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                    >
                      Blog
                      {FOOTER_COMING_SOON_BADGE}
                    </span>
                  </li>
                  <li>
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                    >
                      Careers
                      {FOOTER_COMING_SOON_BADGE}
                    </span>
                  </li>
                  <li>
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                    >
                      Contact
                      {FOOTER_COMING_SOON_BADGE}
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                  <li>
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                    >
                      Privacy
                      {FOOTER_COMING_SOON_BADGE}
                    </span>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                      Terms
                    </Link>
                  </li>
                  <li>
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center text-slate-400 dark:text-slate-500 cursor-not-allowed select-none"
                    >
                      Security
                      {FOOTER_COMING_SOON_BADGE}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-500 dark:text-slate-500">
                © {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <Link href="/features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Features
                </Link>
                <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <ScaleOnHover scale={1.02}>
      <div className="h-full rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all backdrop-blur-sm group overflow-hidden p-6">
        <div
          className={`h-12 w-12 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform shadow-sm`}
        >
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2.5">{title}</h3>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>
    </ScaleOnHover>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  buttonText,
  buttonVariant,
  highlighted,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant: "default" | "outline";
  highlighted?: boolean;
}) {
  return (
    <ScaleOnHover scale={1.02}>
      <div
        className={`relative h-full p-8 rounded-2xl border backdrop-blur-sm transition-all ${
          highlighted
            ? "bg-linear-to-b from-blue-100 to-purple-100 border-blue-300 dark:from-blue-950/50 dark:to-purple-950/50 dark:border-blue-500/50 shadow-2xl shadow-blue-500/10"
            : "bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        }`}
      >
        {highlighted && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm font-medium">
            Most Popular
          </div>
        )}

        <div className="text-center mb-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{name}</h3>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-slate-900 dark:text-white">{price}</span>
            {period && <span className="text-slate-600 dark:text-slate-400">{period}</span>}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{description}</p>
        </div>

        <ul className="space-y-4 mb-8">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        <Link href="/register" className="block">
          <Button
            variant={buttonVariant}
            className={`w-full ${
              highlighted
                ? "bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0"
                : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {buttonText}
          </Button>
        </Link>
      </div>
    </ScaleOnHover>
  );
}
