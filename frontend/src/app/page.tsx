"use client";

import { useEffect } from "react";
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
} from "lucide-react";
import Image from "next/image";
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

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  // Redirect authenticated users straight to the dashboard
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="container mx-auto px-6 py-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                Presentation Designer
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link href="/editor" className="text-slate-400 hover:text-white transition-colors">
                Create
              </Link>
              <Link href="#features" className="text-slate-400 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-slate-400 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/marketplace" className="text-slate-400 hover:text-white transition-colors">
                Templates
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-20 pb-32">
          <div className="max-w-5xl mx-auto text-center">
            <FadeInUp delay={0.2}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8 cursor-default"
              >
                <Sparkles className="h-4 w-4" />
                <span>AI-Powered Presentation Creation</span>
                <span className="px-2 py-0.5 bg-blue-500/20 rounded-full text-xs">New</span>
              </motion.div>
            </FadeInUp>

            <FadeInUp delay={0.3}>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-8">
                Turn your ideas into{" "}
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  stunning presentations
                </span>{" "}
                in seconds
              </h1>
            </FadeInUp>

            <FadeInUp delay={0.4}>
              <p className="text-xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
                Just describe your topic. Our AI generates beautiful, professionally designed
                presentations with structured content, animations, and themes—ready to present or customize.
              </p>
            </FadeInUp>

            <FadeInUp delay={0.5}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <GlowOnHover glowColor="rgba(59, 130, 246, 0.4)">
                    <Button size="lg" className="text-lg px-8 h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl shadow-blue-500/20">
                      Start Creating Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </GlowOnHover>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 h-14 border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600 backdrop-blur-sm"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </div>
            </FadeInUp>

            <FadeInUp delay={0.6}>
              <p className="text-sm text-slate-500 mt-6">
                No credit card required • 3 free presentations • Cancel anytime
              </p>
            </FadeInUp>
          </div>

          {/* Hero Visual */}
          <FadeInUp delay={0.7}>
            <div className="mt-20 max-w-6xl mx-auto">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-2xl opacity-20" />

                {/* Main preview container */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
                  {/* Browser bar */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-4 py-1 bg-slate-700/50 rounded-lg text-xs text-slate-400">
                        app.presentationdesigner.ai
                      </div>
                    </div>
                  </div>

                  {/* Preview content */}
                  <div className="aspect-[16/9] bg-slate-900 border-t border-slate-800 relative group overflow-hidden">
                    <Image
                      src="https://placehold.co/1200x675/1e293b/ffffff?text=Presentation+Designer+Dashboard"
                      alt="Presentation Designer Dashboard"
                      fill
                      className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
                      priority
                    />

                    {/* Overlay Grid (simulating slides) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60" />
                  </div>
                </div>

                {/* Floating elements */}
                <FloatingElement duration={4} distance={15} className="absolute -right-12 top-20 hidden lg:block">
                  <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">AI Generated</p>
                        <p className="text-xs text-slate-400">12 slides in 8 seconds</p>
                      </div>
                    </div>
                  </div>
                </FloatingElement>

                <FloatingElement duration={5} distance={10} className="absolute -left-8 bottom-32 hidden lg:block">
                  <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Real-time Collaboration</p>
                        <p className="text-xs text-slate-400">3 users editing</p>
                      </div>
                    </div>
                  </div>
                </FloatingElement>
              </div>
            </div>
          </FadeInUp>

          {/* Stats */}
          <FadeInUp delay={0.9}>
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {[
                { value: 50000, label: "Presentations Created", suffix: "+" },
                { value: 10000, label: "Happy Users", suffix: "+" },
                { value: 99, label: "Uptime", suffix: "%" },
                { value: 4.9, label: "User Rating", suffix: "/5" },
              ].map((stat, index) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                    <AnimatedCounter value={stat.value} duration={2 + index * 0.3} />
                    {stat.suffix}
                  </div>
                  <p className="text-slate-400 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </FadeInUp>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent" />

          <div className="container mx-auto px-6 relative">
            <FadeInUp>
              <div className="text-center mb-20">
                <span className="text-blue-400 text-sm font-medium uppercase tracking-wider">Features</span>
                <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
                  Everything you need to create{" "}
                  <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    stunning presentations
                  </span>
                </h2>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  Powered by advanced AI, our platform helps you create professional presentations in minutes, not hours.
                </p>
              </div>
            </FadeInUp>

            <StaggerContainer staggerDelay={0.1} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StaggerItem>
                <FeatureCard
                  icon={<Bot className="h-6 w-6" />}
                  title="AI-Powered Generation"
                  description="Describe your topic and watch as AI creates complete, structured presentations with compelling content."
                  gradient="from-blue-500 to-cyan-500"
                  image="https://placehold.co/600x400/1e293b/3b82f6?text=AI+Generation"
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
                  image="https://placehold.co/600x400/1e293b/10b981?text=Collaboration"
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
                  description="Browse and use thousands of professional templates, or sell your own to the community."
                  gradient="from-teal-500 to-cyan-500"
                  image="https://placehold.co/600x400/1e293b/0ea5e9?text=Templates"
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
        <section id="pricing" className="py-32">
          <div className="container mx-auto px-6">
            <FadeInUp>
              <div className="text-center mb-16">
                <span className="text-blue-400 text-sm font-medium uppercase tracking-wider">Pricing</span>
                <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
                  Simple, transparent pricing
                </h2>
                <p className="text-lg text-slate-400">
                  Start free, upgrade when you need more power
                </p>
              </div>
            </FadeInUp>

            <StaggerContainer staggerDelay={0.15} className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <StaggerItem>
                <PricingCard
                  name="Free"
                  price="$0"
                  description="Perfect for trying out"
                  features={[
                    "3 presentations",
                    "10 AI generations/month",
                    "Basic themes",
                    "Share links",
                    "Community support",
                  ]}
                  buttonText="Get Started"
                  buttonVariant="outline"
                />
              </StaggerItem>
              <StaggerItem>
                <PricingCard
                  name="Pro"
                  price="$29"
                  period="/month"
                  description="For power users — includes Thinking credits"
                  features={[
                    "100 presentations",
                    "1,000 standard AI generations/month",
                    "5 Thinking (high‑quality) generations/month",
                    "All premium themes",
                    "PDF/PPTX export",
                    "Custom branding",
                    "Analytics dashboard",
                    "Priority support",
                  ]}
                  buttonText="Start Pro Trial"
                  buttonVariant="default"
                  highlighted
                />
              </StaggerItem>
              <StaggerItem>
                <PricingCard
                  name="Enterprise"
                  price="$49"
                  period="/month"
                  description="For teams"
                  features={[
                    "Unlimited presentations",
                    "Unlimited AI generations",
                    "Team collaboration",
                    "SSO / SAML",
                    "API access",
                    "Audit logs",
                    "Dedicated support",
                    "Custom integrations",
                  ]}
                  buttonText="Contact Sales"
                  buttonVariant="outline"
                />
              </StaggerItem>
            </StaggerContainer>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent" />

          <FadeInUp>
            <div className="container mx-auto px-6 text-center relative">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Ready to create your first{" "}
                  <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    AI presentation
                  </span>
                  ?
                </h2>
                <p className="text-xl text-slate-400 mb-10">
                  Join thousands of professionals who save hours on presentation design every week.
                </p>
                <Link href="/register">
                  <GlowOnHover glowColor="rgba(59, 130, 246, 0.5)">
                    <Button size="lg" className="text-lg px-8 h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl">
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </GlowOnHover>
                </Link>
              </div>
            </div>
          </FadeInUp>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800 py-12">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-lg font-bold">Presentation Designer</span>
                </div>
                <p className="text-slate-400 text-sm">
                  Create stunning AI-powered presentations in seconds.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                  <li><Link href="/editor" className="hover:text-white transition-colors">Create Presentation</Link></li>
                  <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/marketplace" className="hover:text-white transition-colors">Templates</Link></li>
                  <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                © {new Date().getFullYear()} Presentation Designer. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </a>
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
  image,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  image?: string;
}) {
  return (
    <ScaleOnHover scale={1.02}>
      <div className="h-full rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all backdrop-blur-sm group overflow-hidden">
        {image && (
          <div className="relative h-48 w-full border-b border-slate-800">
            <Image
              src={image}
              alt={title}
              fill
              className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />
          </div>
        )}
        <div className="p-6">
          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
          <p className="text-slate-400 leading-relaxed">{description}</p>
        </div>
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
        className={`relative h-full p-8 rounded-2xl border backdrop-blur-sm transition-all ${highlighted
          ? "bg-gradient-to-b from-blue-950/50 to-purple-950/50 border-blue-500/50 shadow-2xl shadow-blue-500/10"
          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
          }`}
      >
        {highlighted && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-sm font-medium">
            Most Popular
          </div>
        )}

        <div className="text-center mb-8">
          <h3 className="text-lg font-semibold text-white mb-2">{name}</h3>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-white">{price}</span>
            {period && <span className="text-slate-400">{period}</span>}
          </div>
          <p className="text-sm text-slate-400 mt-2">{description}</p>
        </div>

        <ul className="space-y-4 mb-8">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        <Link href="/register" className="block">
          <Button
            variant={buttonVariant}
            className={`w-full ${highlighted
              ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0"
              : "border-slate-700 hover:bg-slate-800"
              }`}
          >
            {buttonText}
          </Button>
        </Link>
      </div>
    </ScaleOnHover>
  );
}
