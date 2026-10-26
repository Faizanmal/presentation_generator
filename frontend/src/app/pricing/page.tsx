"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND, PRODUCT_NAME } from "@/lib/brand";
import { PLANS_LIST, type PlanId } from "@/lib/plans";
import { ScaleOnHover } from "@/components/ui/animations";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { useAuthStore } from "@/stores/auth-store";

const PLAN_DESCRIPTIONS: Record<string, string> = {
  FREE: "Perfect for trying out",
  PRO: "For power users — includes Thinking credits",
  ENTERPRISE: "For teams and organizations",
};

function planCta(planId: PlanId, currentPlan: PlanId | null, loggedIn: boolean) {
  if (!loggedIn) {
    return {
      href: "/register",
      label: planId === "ENTERPRISE" ? "Get started" : "Sign up free",
      disabled: false,
    };
  }

  if (currentPlan === planId) {
    return { href: "/settings/billing", label: "Current plan", disabled: true };
  }

  if (planId === "FREE") {
    return { href: "/dashboard", label: "Go to dashboard", disabled: false };
  }

  return { href: "/settings/billing", label: "Upgrade", disabled: false };
}

export default function PricingPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initialized = useAuthStore((s) => s.initialized);
  const subscription = useAuthStore((s) => s.subscription);
  const loggedIn = initialized && isAuthenticated;
  const currentPlan = (
    (subscription?.plan || "FREE").toUpperCase() as PlanId
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-blue-900/20 via-slate-50 dark:via-slate-950 to-slate-50 dark:to-slate-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <MarketingHeader active="pricing" />

        <main className="container mx-auto px-6 py-16 pb-24">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-blue-400 text-sm font-medium uppercase tracking-wider">Pricing</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">Simple, transparent pricing</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Start free with {PRODUCT_NAME}. Upgrade when you need more AI generations, exports, and team features.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {PLANS_LIST.map((plan) => {
              const cta = planCta(plan.id, loggedIn ? currentPlan : null, loggedIn);
              return (
                <ScaleOnHover key={plan.id} scale={1.02}>
                  <div
                    className={`relative h-full p-8 rounded-2xl border backdrop-blur-sm transition-all ${
                      plan.popular
                        ? "bg-linear-to-b from-blue-100 to-purple-100 border-blue-300 dark:from-blue-950/50 dark:to-purple-950/50 dark:border-blue-500/50 shadow-2xl shadow-blue-500/10"
                        : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-linear-to-r from-blue-600 to-purple-600 rounded-full text-sm font-medium text-white">
                        Most Popular
                      </div>
                    )}

                    <div className="text-center mb-8">
                      <h2 className="text-lg font-semibold mb-2">{plan.name}</h2>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-5xl font-bold">${plan.priceMonthly}</span>
                        {plan.priceMonthly > 0 && (
                          <span className="text-slate-600 dark:text-slate-400">/month</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        {PLAN_DESCRIPTIONS[plan.id] ?? BRAND.tagline}
                      </p>
                    </div>

                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                      {plan.id === "FREE" && (
                        <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          Community support
                        </li>
                      )}
                    </ul>

                    {cta.disabled ? (
                      <Button variant="outline" className="w-full" disabled>
                        {cta.label}
                      </Button>
                    ) : (
                      <Link href={cta.href} className="block">
                        <Button
                          variant={plan.popular ? "default" : "outline"}
                          className={`w-full ${
                            plan.popular
                              ? "bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0"
                              : ""
                          }`}
                        >
                          {cta.label}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {!loggedIn && (
                      <p className="text-center text-xs text-slate-500 mt-3">
                        Already have an account?{" "}
                        <Link href="/login" className="text-blue-600 hover:underline">
                          Log in
                        </Link>
                      </p>
                    )}
                  </div>
                </ScaleOnHover>
              );
            })}
          </div>
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
          <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>© {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
              <Link href="/features" className="hover:text-slate-900 dark:hover:text-white">Features</Link>
              <Link href="/marketplace" className="hover:text-slate-900 dark:hover:text-white">Marketplace</Link>
              <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
