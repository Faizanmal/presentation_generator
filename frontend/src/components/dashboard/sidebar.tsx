"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Sparkles,
    Library,
    BarChart3,
    Settings,
    LifeBuoy,
    LogOut,
    ChevronsUpDown,
    Search,
    PanelLeftClose,
    PanelLeftOpen,
    Zap,
    FlaskConical,
    Glasses,
    MessageSquareMore,
    MonitorSmartphone,
    TrendingUp,
    SmilePlus,
    GraduationCap,
    Leaf,
    HeartPulse,
    TreePine,
    FileSpreadsheet,
    ImageIcon,
    Palette,
    Boxes,
    BrainCog,
    Layers
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth-store";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Progress } from "@/components/ui/progress";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    isCollapsed?: boolean;
    onCollapse?: (collapsed: boolean) => void;
    onLinkClick?: () => void;
}

export function Sidebar({ className, isCollapsed = false, onCollapse, onLinkClick }: SidebarProps) {
    const pathname = usePathname();
    const { user, logout, subscription } = useAuthStore();
    const [, setOpenGroups] = useState<string[]>(["creative"]);

    const _toggleGroup = (group: string) => {
        setOpenGroups(prev =>
            prev.includes(group)
                ? prev.filter(g => g !== group)
                : [...prev, group]
        );
    };

    const menuItems = [
        {
            title: "Platform",
            items: [
                { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
                { title: "My Presentations", icon: FileText, href: "/dashboard?view=presentations" },
            ]
        },
        {
            id: "creative",
            title: "Creative Suite",
            items: [
                { title: "AI Thinking", icon: BrainCog, href: "/dashboard/ai-thinking" },
                { title: "AI Research", icon: Search, href: "/dashboard/ai-research" },
                { title: "Storyboarding", icon: Layers, href: "/dashboard/storyboarding" },
                { title: "Image Gallery", icon: ImageIcon, href: "/dashboard/image-gallery" },
            ]
        },
        {
            id: "analytics",
            title: "Analytics & Data",
            items: [
                { title: "Analytics", icon: BarChart3, href: "/dashboard/analytics/team" },
                { title: "Sentiment", icon: SmilePlus, href: "/dashboard/sentiment" },
                { title: "A/B Testing", icon: FlaskConical, href: "/dashboard/ab-testing" },
                { title: "Predictive", icon: TrendingUp, href: "/dashboard/predictive-analytics" },
            ]
        },
        {
            id: "content",
            title: "Content Hub",
            items: [
                { title: "Content Library", icon: Library, href: "/dashboard/content-library" },
                { title: "Data Import", icon: FileSpreadsheet, href: "/dashboard/data-import" },
                { title: "Brand Kit", icon: Palette, href: "/settings/branding" },
                { title: "Blockchain Assets", icon: Boxes, href: "/dashboard/blockchain" },
            ]
        },
        {
            id: "engagement",
            title: "Engagement",
            collapsed: true,
            items: [
                { title: "Live Q&A", icon: MessageSquareMore, href: "/dashboard/live-qa" },
                { title: "Learning Paths", icon: GraduationCap, href: "/dashboard/learning-paths" },
                { title: "Immersive View", icon: Glasses, href: "/dashboard/immersive" },
                { title: "Cross-Sync", icon: MonitorSmartphone, href: "/dashboard/cross-sync" },
            ]
        },
        {
            id: "impact",
            title: "Impact & Wellness",
            collapsed: true,
            items: [
                { title: "Sustainability", icon: Leaf, href: "/dashboard/sustainability" },
                { title: "Wellness", icon: HeartPulse, href: "/dashboard/wellness" },
                { title: "Carbon Footprint", icon: TreePine, href: "/dashboard/carbon-footprint" },
            ]
        }
    ];

    return (
        <div className={cn("relative flex flex-col h-screen border-r bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl", className)}>

            {/* Header */}
            <div className={cn("flex items-center h-16 px-4 border-b", isCollapsed ? "justify-center" : "justify-between")}>
                {!isCollapsed && (
                    <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-indigo-600 shadow-sm">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span>Present.AI</span>
                    </Link>
                )}
                {isCollapsed && (
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-blue-600 to-indigo-600 shadow-sm">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                )}
            </div>

            <ScrollArea className="flex-1 px-3 py-4">
                <div className="space-y-6">
                    {menuItems.map((group, i) => (
                        <div key={group.title || i} className="space-y-1">
                            {group.title && !isCollapsed && (
                                <h4 className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    {group.title}
                                </h4>
                            )}

                            {group.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <TooltipProvider key={item.href} delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Link href={item.href} onClick={onLinkClick}>
                                                    <Button
                                                        variant={isActive ? "secondary" : "ghost"}
                                                        className={cn(
                                                            "w-full justify-start",
                                                            isActive && "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
                                                            isCollapsed ? "px-2 justify-center" : "px-3"
                                                        )}
                                                    >
                                                        <item.icon className={cn("h-4 w-4", isCollapsed ? "mr-0" : "mr-3", isActive && "text-blue-600 dark:text-blue-400")} />
                                                        {!isCollapsed && <span>{item.title}</span>}
                                                    </Button>
                                                </Link>
                                            </TooltipTrigger>
                                            {isCollapsed && (
                                                <TooltipContent side="right" className="font-medium">
                                                    {item.title}
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Collapse Toggle (Desktop only) */}
            <div className="hidden md:flex justify-end p-2 border-t border-b">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCollapse?.(!isCollapsed)}
                    className="h-8 w-8"
                >
                    {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
            </div>

            {/* Subscription / Usage */}
            {!isCollapsed && subscription && (
                <div className="px-4 py-2 mt-auto">
                    <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                                AI Credits
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {subscription.aiGenerationsUsed}/{subscription.aiGenerationsLimit}
                            </span>
                        </div>
                        <Progress value={(subscription.aiGenerationsUsed / subscription.aiGenerationsLimit) * 100} className="h-1.5" />

                        {subscription.plan === "FREE" && (
                            <Link href="/settings/billing">
                                <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs">
                                    Upgrade Plan
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* User Footer */}
            <div className="p-4 border-t mt-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className={cn("w-full", isCollapsed ? "px-0 justify-center" : "justify-start px-2")}>
                            <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-linear-to-br from-purple-500 to-pink-500 text-white">
                                    {user?.name?.charAt(0).toUpperCase() || "U"}
                                </AvatarFallback>
                            </Avatar>
                            {!isCollapsed && (
                                <div className="flex flex-col items-start ml-3 text-left">
                                    <span className="text-sm font-medium leading-none">{user?.name || "User"}</span>
                                    <span className="text-xs text-muted-foreground mt-1 truncate max-w-30">
                                        {user?.email || "user@example.com"}
                                    </span>
                                </div>
                            )}
                            {!isCollapsed && <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56" side={isCollapsed ? "right" : "top"}>
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/settings/profile">
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/settings/billing">
                                <FileText className="mr-2 h-4 w-4" />
                                Billing
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <LifeBuoy className="mr-2 h-4 w-4" />
                            Support
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => logout()} className="text-red-600 focus:text-red-600">
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
