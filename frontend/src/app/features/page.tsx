"use client";

import Link from "next/link";
import {
  Sparkles,
  Bot,
  Palette,
  FileOutput,
  BarChart3,
  Layers,
  ArrowRight,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND, PRODUCT_NAME } from "@/lib/brand";
import { ThemeToggleButton } from "@/components/ui/enhanced-ui";

const CAPABILITIES = [
  {
    icon: Bot,
    title: "AI generation",
    description:
      "Describe your topic and get a full deck with structured slides, speaker notes, and on-brand styling in seconds.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: PenLine,
    title: "Visual editor",
    description:
      "Refine every slide with drag-and-drop layouts, rich text, images, and real-time preview—no design skills required.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: FileOutput,
    title: "Export & share",
    description:
      "Share live links, export to HTML and JSON on every plan, and unlock PDF and PowerPoint on Pro and Enterprise.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: Palette,
    title: "Themes & branding",
    description:
      "Apply professional themes instantly and keep colors, fonts, and logos consistent across your organization.",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "See who viewed your deck, which slides held attention, and how engagement trends over time.",
    gradient: "from-yellow-500 to-orange-500",
  },
  {
    icon: Layers,
    title: "Template marketplace",
    description:
      "Start from community templates or publish your own—speed up creation without sacrificing quality.",
    gradient: "from-indigo-500 to-purple-500",
  },
] as const;

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-900/20 via-slate-50 dark:via-slate-950 to-slate-50 dark:to-slate-950" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <nav className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">{PRODUCT_NAME}</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/features" className="text-blue-600 dark:text-blue-400 font-medium">
                Features
              </Link>
              <Link href="/pricing" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/marketplace" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Templates
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggleButton />
              <Link href="/login">
                <Button variant="ghost" className="text-slate-700 dark:text-slate-300">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-6 py-16 pb-24">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-blue-400 text-sm font-medium uppercase tracking-wider">Features</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              Everything you need to ship presentations faster
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">{BRAND.description}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {CAPABILITIES.map(({ icon: Icon, title, description, gradient }) => (
              <div
                key={title}
                className="rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 backdrop-blur-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div
                  className={`h-12 w-12 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center text-white mb-5`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold mb-3">{title}</h2>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <Link href="/register">
              <Button size="lg" className="bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Start creating with {PRODUCT_NAME}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-slate-500">
              Compare plans on{" "}
              <Link href="/pricing" className="text-blue-600 hover:underline">
                pricing
              </Link>
            </p>
          </div>
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
          <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>© {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
              <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">Pricing</Link>
              <Link href="/marketplace" className="hover:text-slate-900 dark:hover:text-white">Marketplace</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
