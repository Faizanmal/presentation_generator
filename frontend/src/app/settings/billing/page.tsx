"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowLeft,
  Check,
  Loader2,
  CreditCard,
  Crown,
  Zap,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const PLANS = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    icon: Zap,
    description: "Get started with basic features",
    features: [
      "3 presentations",
      "10 AI generations per month",
      "Basic themes",
      "Export to HTML/JSON",
      "Share with link",
    ],
    limitations: [
      "No PDF export",
      "No premium themes",
      "Limited AI generations",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 29,
    icon: Crown,
    description: "For power users — covers heavier AI usage",
    popular: true,
    features: [
      "100 presentations",
      "1,000 standard AI generations per month",
      "5 Thinking (high‑quality) generations per month",
      "All themes including premium",
      "Export to PDF/HTML/JSON",
      "Priority support",
      "Custom branding (coming soon)",
    ],
    priceId: "price_pro_monthly", // Replace with actual Stripe price ID
    thinkingCreditsIncluded: 5,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 199,
    icon: Building2,
    description: "For teams and large organizations — optimized for AI workloads",
    features: [
      "1,000 presentations (expandable)",
      "50,000 standard AI generations per month",
      "250 Thinking (high‑quality) generations per month",
      "All Pro features",
      "Team collaboration",
      "SSO & advanced security",
      "Dedicated support & onboarding",
      "Custom integrations",
    ],
    priceId: "price_enterprise_monthly", // Replace with actual Stripe price ID
    thinkingCreditsIncluded: 250,
  }
];

export default function BillingPage() {
  const router = useRouter();
  const { subscription, isAuthenticated, isLoading: authLoading, initialized } = useAuthStore();

  // Compute renewal date to avoid calling Date.now() during render
  const renewalDate = useMemo(() => {
    if (!subscription?.currentPeriodEnd) { return null; }
    return new Date(subscription.currentPeriodEnd).toLocaleDateString();
  }, [subscription]);

  // Redirect if not authenticated
  useEffect(() => {
    if (initialized && !authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, initialized, router]);

  // Create checkout session mutation
  const checkoutMutation = useMutation({
    mutationFn: (priceId: string) => api.subscription.createCheckout(priceId),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error("Failed to start checkout");
    },
  });

  // Open customer portal mutation
  const portalMutation = useMutation({
    mutationFn: () => api.subscription.createPortal(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error("Failed to open billing portal");
    },
  });

  const handleUpgrade = (planId: string, priceId?: string) => {
    if (!priceId) { return; }
    checkoutMutation.mutate(priceId);
  };

  const handleManageBilling = () => {
    portalMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "FREE";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <Link href="/" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Presentation Designer
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Plans & Billing
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose the plan that&apos;s right for you. Upgrade anytime to unlock more features.
          </p>
        </div>

        {/* Current subscription info */}
        {subscription && subscription.plan !== "FREE" && (
          <div className="mb-12 max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Current Plan: {subscription.plan}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {subscription.status === "ACTIVE"
                      ? `Renews on ${renewalDate}`
                      : `Status: ${subscription.status}`}
                  </p>
                </div>
                <Button variant="outline" onClick={handleManageBilling} disabled={portalMutation.isPending}>
                  {portalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Manage Billing
                </Button>
              </div>

              {/* Usage */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Projects</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {subscription.projectsUsed} / {subscription.projectsLimit}
                    </p>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(
                            (subscription.projectsUsed / subscription.projectsLimit) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">AI Generations</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {subscription.aiGenerationsUsed} / {subscription.aiGenerationsLimit}
                    </p>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width: `${Math.min(
                            (subscription.aiGenerationsUsed / subscription.aiGenerationsLimit) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const Icon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-slate-950 rounded-xl border-2 overflow-hidden transition-all ${plan.popular
                  ? "border-blue-500 shadow-lg shadow-blue-500/10"
                  : "border-slate-200 dark:border-slate-800"
                  } ${isCurrentPlan ? "ring-2 ring-green-500 ring-offset-2" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-center text-sm py-1">
                    Most Popular
                  </div>
                )}

                <div className={`p-6 ${plan.popular ? "pt-10" : ""}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${plan.id === "FREE"
                        ? "bg-slate-100 dark:bg-slate-800"
                        : plan.id === "PRO"
                          ? "bg-blue-100 dark:bg-blue-900"
                          : "bg-purple-100 dark:bg-purple-900"
                        }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${plan.id === "FREE"
                          ? "text-slate-600"
                          : plan.id === "PRO"
                            ? "text-blue-600"
                            : "text-purple-600"
                          }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                      ${plan.price}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">/month</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-500 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : plan.id === "FREE" ? (
                    <Button className="w-full" variant="outline" disabled>
                      Free Forever
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.id, plan.priceId)}
                      disabled={checkoutMutation.isPending}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {currentPlan === "FREE" ? "Upgrade" : "Switch Plan"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Questions about pricing?{" "}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
