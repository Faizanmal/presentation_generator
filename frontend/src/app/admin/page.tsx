"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, FolderKanban, Activity } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/types";

interface AdminStats {
    totalUsers: number;
    totalProjects: number;
    usersByTier: { tier: string; count: number }[];
}

export default function AdminPage() {
    const { user, impersonate, isAuthenticated, initialized } = useAuthStore();
    const router = useRouter();

    const [stats, setStats] = useState<AdminStats | null>(null);
    const [usersList, setUsersList] = useState<(User & { role: string; createdAt: string; subscriptionTier: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isImpersonatingLoad, setIsImpersonatingLoad] = useState<string | null>(null);

    useEffect(() => {
        if (!initialized) {return;}

        if (!isAuthenticated || user?.role !== 'ADMIN') {
            router.push('/dashboard');
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [statsRes, usersRes] = await Promise.all([
                    api.adminGetStats(),
                    api.adminGetUsers(page, 10, search)
                ]);
                setStats(statsRes);
                setUsersList(usersRes.data);
                setTotalPages(usersRes.meta.totalPages);
            } catch (error) {
                console.error("Failed to fetch admin data", error);
                toast.error("Failed to load admin data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [initialized, isAuthenticated, user, page, search, router]);

    const handleImpersonate = async (targetUserId: string) => {
        try {
            setIsImpersonatingLoad(targetUserId);
            await impersonate(targetUserId);
            toast.success("Impersonation started");
            router.push('/dashboard');
        } catch (error) {
            console.error("Impersonation failed", error);
            toast.error("Failed to impersonate user");
        } finally {
            setIsImpersonatingLoad(null);
        }
    };

    if (!initialized || (isLoading && !stats)) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Stats Row */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                        <FolderKanban className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Active Subs (PRO)</CardTitle>
                        <Activity className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats?.usersByTier.find(t => t.tier === 'PRO')?.count || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Users</CardTitle>
                    <div className="flex items-center space-x-2 pt-2">
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usersList.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    usersList.map((u) => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-medium">{u.name || "N/A"}</TableCell>
                                            <TableCell>{u.email}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                                                    {u.role || 'USER'}
                                                </span>
                                            </TableCell>
                                            <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isImpersonatingLoad === u.id || u.id === user?.id || u.role === 'ADMIN'}
                                                    onClick={() => handleImpersonate(u.id)}
                                                >
                                                    {isImpersonatingLoad === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Impersonate'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {/* Pagination */}
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            Previous
                        </Button>
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {totalPages || 1}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
