'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  CreditCard,
  Link2,
  Palette,
  Building2,
  Settings,
  Eye,
  Layers,
  Bell,
  Hand,
  BrainCircuit,
  ScanEye,
  KeyRound,
  Boxes,
  Router,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsNav = [
  {
    title: 'Profile',
    href: '/settings',
    icon: User,
  },
  {
    title: 'Billing',
    href: '/settings/billing',
    icon: CreditCard,
  },
  {
    title: 'Integrations',
    href: '/settings/integrations',
    icon: Link2,
  },
  {
    title: 'Branding',
    href: '/settings/branding',
    icon: Palette,
  },
  {
    title: 'Organization',
    href: '/settings/organization',
    icon: Building2,
  },
  {
    title: 'Design System',
    href: '/settings/design-system',
    icon: Layers,
  },
  {
    title: 'Accessibility',
    href: '/settings/accessibility',
    icon: Eye,
  },
  {
    title: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
  },
  {
    title: 'Sign Language',
    href: '/settings/sign-language',
    icon: Hand,
  },
  {
    title: 'Cognitive Access',
    href: '/settings/cognitive-accessibility',
    icon: BrainCircuit,
  },
  {
    title: 'Universal Design',
    href: '/settings/universal-design',
    icon: ScanEye,
  },
  {
    title: 'API Keys',
    href: '/settings/api-keys',
    icon: KeyRound,
  },
  {
    title: 'White-Label SDK',
    href: '/settings/white-label',
    icon: Boxes,
  },
  {
    title: 'IoT Devices',
    href: '/settings/iot-devices',
    icon: Router,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 p-6">
        <div className="flex items-center gap-2 mb-8">
          <Settings className="w-5 h-5" />
          <h1 className="font-semibold text-lg">Settings</h1>
        </div>

        <nav className="space-y-1">
          {settingsNav.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/settings' && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
