"use client";

import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Loader2, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ImpersonationBanner() {
    const { user, unimpersonate } = useAuthStore();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    if (!user?.impersonatorId) {
        return null;
    }

    const handleRevert = async () => {
        setIsLoading(true);
        try {
            await unimpersonate();
            toast.success("Stopped impersonating");
            router.push('/admin');
        } catch (error) {
            console.error("Failed to revert impersonation", error);
            toast.error("Failed to revert impersonation");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between z-50 fixed top-0 w-full shadow-md">
            <div className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                <span className="text-sm font-medium">
                    You are currently impersonating <strong>{user.name || user.email}</strong>.
                </span>
            </div>
            <Button
                variant="secondary"
                size="sm"
                onClick={handleRevert}
                disabled={isLoading}
                className="h-7 text-xs font-semibold"
            >
                {isLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Revert to Admin
            </Button>
        </div>
    );
}
