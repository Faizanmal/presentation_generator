"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">

            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    "hidden md:flex flex-col border-r h-full transition-all duration-300 ease-in-out",
                    isCollapsed ? "w-[70px]" : "w-64"
                )}
            >
                <Sidebar
                    isCollapsed={isCollapsed}
                    onCollapse={setIsCollapsed}
                    className="h-full border-none"
                />
            </aside>

            {/* Mobile Sidebar */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetContent side="left" className="p-0 w-72">
                    <Sidebar
                        className="h-full border-none"
                        onLinkClick={() => setIsMobileOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">

                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between p-4 border-b bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <span className="text-xl">Present.AI</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(true)}>
                        <Menu className="h-6 w-6" />
                    </Button>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto w-full h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
