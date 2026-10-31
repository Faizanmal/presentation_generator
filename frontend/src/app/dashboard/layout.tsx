"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggleSimple } from "@/components/ui/enhanced-ui";
import { PRODUCT_NAME } from "@/lib/brand";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">

            {/* Desktop Sidebar (collapsed into drawer below lg 1024px so 640px viewports have full width) */}
            <aside
                className={cn(
                    "hidden lg:flex flex-col border-r h-full transition-all duration-300 ease-in-out shrink-0",
                    isCollapsed ? "w-17.5" : "w-64"
                )}
            >
                <Sidebar
                    isCollapsed={isCollapsed}
                    onCollapse={setIsCollapsed}
                    className="h-full border-none"
                />
            </aside>

            {/* Mobile / Tablet Sidebar Drawer */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetContent side="left" className="p-0 w-72">
                    <Sidebar
                        className="h-full border-none"
                        onLinkClick={() => setIsMobileOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">

                {/* Mobile / Tablet Header */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-2 font-bold text-lg truncate">
                        <span className="text-xl truncate">{PRODUCT_NAME}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <ThemeToggleSimple />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileOpen(true)}
                            aria-label="Open navigation menu"
                        >
                            <Menu className="h-6 w-6" />
                        </Button>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto w-full h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
