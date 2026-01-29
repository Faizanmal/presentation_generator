import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Zap, 
  Palette, 
  Share2, 
  ArrowRight,
  CheckCircle2,
  Play
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              Presentation Designer
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            AI-Powered Presentation Creation
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white leading-tight mb-6">
            Turn your ideas into{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              stunning presentations
            </span>{" "}
            in seconds
          </h1>
          
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
            Just describe your topic. Our AI generates beautiful, professionally designed 
            presentations with structured content, ready to present or customize.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8 h-14">
                Start Creating Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="text-lg px-8 h-14">
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-4">
            No credit card required • 3 free presentations
          </p>
        </div>
        
        {/* Preview Image */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
            <div className="aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Interactive demo preview
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white dark:bg-slate-900 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Create presentations the smart way
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Our AI understands your content and designs beautiful slides automatically
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="AI-Powered Generation"
              description="Describe your topic and get a complete, structured presentation in seconds. Our AI creates compelling content and organizes it logically."
            />
            <FeatureCard
              icon={<Palette className="h-6 w-6" />}
              title="Beautiful Themes"
              description="Choose from professionally designed themes that automatically adapt to your content. No design skills needed."
            />
            <FeatureCard
              icon={<Share2 className="h-6 w-6" />}
              title="Present & Share"
              description="Present directly from your browser or share a link. Export to PDF when you need it."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Start free, upgrade when you need more
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              name="Free"
              price="$0"
              description="Perfect for trying out"
              features={[
                "3 presentations",
                "10 AI generations",
                "Basic themes",
                "Share links",
              ]}
              buttonText="Get Started"
              buttonVariant="outline"
            />
            <PricingCard
              name="Pro"
              price="$12"
              period="/month"
              description="For professionals"
              features={[
                "50 presentations",
                "500 AI generations",
                "All themes",
                "PDF export",
                "Custom branding",
                "Priority support",
              ]}
              buttonText="Start Pro Trial"
              buttonVariant="default"
              highlighted
            />
            <PricingCard
              name="Enterprise"
              price="$49"
              period="/month"
              description="For teams"
              features={[
                "Unlimited presentations",
                "Unlimited AI generations",
                "Team collaboration",
                "API access",
                "SSO",
                "Dedicated support",
              ]}
              buttonText="Contact Sales"
              buttonVariant="outline"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to create your first presentation?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of professionals who save hours on presentation design
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-lg px-8 h-14">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Presentation Designer
              </span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-sm">
            © {new Date().getFullYear()} Presentation Designer. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
        {title}
      </h3>
      <p className="text-slate-600 dark:text-slate-400">
        {description}
      </p>
    </div>
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
    <div className={`p-8 rounded-2xl border ${
      highlighted 
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500' 
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
    }`}>
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          {name}
        </h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">
            {price}
          </span>
          {period && (
            <span className="text-slate-500 dark:text-slate-400">{period}</span>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {description}
        </p>
      </div>
      
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      
      <Link href="/register">
        <Button variant={buttonVariant} className="w-full">
          {buttonText}
        </Button>
      </Link>
    </div>
  );
}
