'use client';

import Link from 'next/link';
import {
  Search as SearchIcon, Layers, FlaskConical, Glasses, Link2, Bot,
  MessageSquareMore, MonitorSmartphone, TrendingUp, SmilePlus,
  GraduationCap, Leaf, HeartPulse, TreePine, ChevronRight,
  Library, FileSpreadsheet, ImageIcon, Palette,
  Key, Wifi, Accessibility, Globe,
  Hand, BrainCircuit, ScanEye, Boxes,
  BrainCog, UsersRound, Target,
} from 'lucide-react';

const featureCategories = [
  {
    title: 'AI & Creativity',
    features: [
      { name: 'AI Research', href: '/dashboard/ai-research', icon: SearchIcon, color: 'text-blue-500' },
      { name: 'AI Thinking', href: '/dashboard/ai-thinking', icon: BrainCog, color: 'text-rose-500' },
      { name: 'Storyboarding', href: '/dashboard/storyboarding', icon: Layers, color: 'text-indigo-500' },
      { name: 'A/B Testing', href: '/dashboard/ab-testing', icon: FlaskConical, color: 'text-purple-500' },
      { name: 'Presentation Coach', href: '#', icon: Target, color: 'text-emerald-500', badge: 'Editor' },
      { name: 'AI Co-Pilot', href: '#', icon: Bot, color: 'text-violet-500', badge: 'Editor' },
    ],
  },
  {
    title: 'Content & Import',
    features: [
      { name: 'Content Library', href: '/dashboard/content-library', icon: Library, color: 'text-indigo-500' },
      { name: 'Data Import', href: '/dashboard/data-import', icon: FileSpreadsheet, color: 'text-emerald-500' },
      { name: 'Image Gallery', href: '/dashboard/image-gallery', icon: ImageIcon, color: 'text-pink-500' },
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
      { name: 'Live Q&A', href: '/dashboard/live-qa', icon: MessageSquareMore, color: 'text-emerald-500' },
      { name: 'Cross-Platform Sync', href: '/dashboard/cross-sync', icon: MonitorSmartphone, color: 'text-sky-500' },
    ],
  },
  {
    title: 'Analytics',
    features: [
      { name: 'Predictive Analytics', href: '/dashboard/predictive-analytics', icon: TrendingUp, color: 'text-rose-500' },
      { name: 'Sentiment Analysis', href: '/dashboard/sentiment', icon: SmilePlus, color: 'text-amber-500' },
      { name: 'Team Analytics', href: '/dashboard/analytics/team', icon: UsersRound, color: 'text-blue-500' },
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
  {
    title: 'Settings',
    features: [
      { name: 'Brand Kit', href: '/settings/branding', icon: Palette, color: 'text-fuchsia-500' },
      { name: 'Accessibility', href: '/settings/accessibility', icon: Accessibility, color: 'text-blue-500' },
      { name: 'API Keys', href: '/settings/api-keys', icon: Key, color: 'text-amber-500' },
      { name: 'IoT Devices', href: '/settings/iot-devices', icon: Wifi, color: 'text-cyan-500' },
      { name: 'Integrations', href: '/settings/integrations', icon: Globe, color: 'text-violet-500' },
      { name: 'Sign Language', href: '/settings/sign-language', icon: Hand, color: 'text-pink-500' },
      { name: 'Cognitive Access', href: '/settings/cognitive-accessibility', icon: BrainCircuit, color: 'text-indigo-500' },
      { name: 'Universal Design', href: '/settings/universal-design', icon: ScanEye, color: 'text-teal-500' },
      { name: 'White-Label SDK', href: '/settings/white-label', icon: Boxes, color: 'text-orange-500' },
    ],
  },
];

export function FeaturesHub() {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Explore Features</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {featureCategories.map((cat) => (
          <div key={cat.title} className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              {cat.title}
            </h3>
            <div className="space-y-2">
              {cat.features.map((f) => {
                const Icon = f.icon;
                return (
                  <Link
                    key={f.name}
                    href={f.href}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                      <Icon className={`w-4 h-4 ${f.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {f.name}
                        </span>
                        {'badge' in f && f.badge && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium ml-2 shrink-0">
                            {f.badge}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

