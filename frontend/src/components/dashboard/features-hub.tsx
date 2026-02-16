'use client';

import Link from 'next/link';
import {
  Search as SearchIcon, Layers, FlaskConical, Glasses, Link2, Bot,
  MessageSquareMore, MonitorSmartphone, TrendingUp, SmilePlus,
  GraduationCap, Leaf, HeartPulse, TreePine, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const featureCategories = [
  {
    title: 'AI & Creativity',
    features: [
      { name: 'AI Research', href: '/dashboard/ai-research', icon: SearchIcon, color: 'text-blue-500' },
      { name: 'Storyboarding', href: '/dashboard/storyboarding', icon: Layers, color: 'text-indigo-500' },
      { name: 'A/B Testing', href: '/dashboard/ab-testing', icon: FlaskConical, color: 'text-purple-500' },
    ],
  },
  {
    title: 'Immersive Tech',
    features: [
      { name: 'VR / AR / Holographic', href: '/dashboard/immersive', icon: Glasses, color: 'text-cyan-500' },
      { name: 'Blockchain / NFT', href: '/dashboard/blockchain', icon: Link2, color: 'text-orange-500' },
    ],
  },
  {
    title: 'Collaboration',
    features: [
      { name: 'AI Co-Pilot', href: '#', icon: Bot, color: 'text-violet-500', badge: 'Editor Panel' },
      { name: 'Live Q&A', href: '/dashboard/live-qa', icon: MessageSquareMore, color: 'text-emerald-500' },
      { name: 'Cross-Platform Sync', href: '/dashboard/cross-sync', icon: MonitorSmartphone, color: 'text-sky-500' },
    ],
  },
  {
    title: 'Analytics',
    features: [
      { name: 'Predictive Analytics', href: '/dashboard/predictive-analytics', icon: TrendingUp, color: 'text-rose-500' },
      { name: 'Sentiment Analysis', href: '/dashboard/sentiment', icon: SmilePlus, color: 'text-amber-500' },
      { name: 'Learning Paths', href: '/dashboard/learning-paths', icon: GraduationCap, color: 'text-teal-500' },
    ],
  },
  {
    title: 'Sustainability',
    features: [
      { name: 'Eco-Friendly', href: '/dashboard/sustainability', icon: Leaf, color: 'text-green-500' },
      { name: 'Presenter Wellness', href: '/dashboard/wellness', icon: HeartPulse, color: 'text-red-500' },
      { name: 'Carbon Footprint', href: '/dashboard/carbon-footprint', icon: TreePine, color: 'text-green-600' },
    ],
  },
];

export function FeaturesHub() {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Features</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {featureCategories.map((cat) => (
          <Card key={cat.title} className="overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {cat.title}
              </p>
              <div className="space-y-1">
                {cat.features.map((f) => {
                  const Icon = f.icon;
                  return (
                    <Link
                      key={f.name}
                      href={f.href}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors group text-sm"
                    >
                      <Icon className={`w-4 h-4 ${f.color}`} />
                      <span className="flex-1 text-slate-700 dark:text-slate-300">{f.name}</span>
                      {'badge' in f && f.badge && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {f.badge}
                        </span>
                      )}
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
