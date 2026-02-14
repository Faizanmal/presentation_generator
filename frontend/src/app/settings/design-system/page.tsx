"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ChevronLeft,
    Palette,
    Type,
    Layers,
    Copy,
    Plus,
    Trash2,
    Download,
    Loader2,
    Sparkles,
    Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

interface ColorToken {
    name: string;
    value: string;
}

interface TypographyToken {
    name: string;
    fontFamily: string;
    fontSize: string;
    fontWeight?: string;
    lineHeight?: string;
}

interface SpacingToken {
    name: string;
    value: string;
}

interface DesignSystem {
    id: string;
    name: string;
    description?: string;
    colors?: ColorToken[];
    typography?: TypographyToken[];
    spacing?: SpacingToken[];
}

export default function DesignSystemPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("colors");
    const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newSystemName, setNewSystemName] = useState("");
    const [newSystemDescription, setNewSystemDescription] = useState("");
    const [newColorName, setNewColorName] = useState("");
    const [newColorValue, setNewColorValue] = useState("#3B82F6");
    const [generatingPalette, setGeneratingPalette] = useState(false);

    // Fetch user's design systems
    const { data: designSystems, isLoading: _systemsLoading } = useQuery({
        queryKey: ["design-systems"],
        queryFn: () => api.getUserDesignSystems(),
    });

    // Fetch selected design system
    const { data: currentSystem, isLoading: _systemLoading } = useQuery({
        queryKey: ["design-system", selectedSystem],
        queryFn: () => api.getDesignSystem(selectedSystem as string),
        enabled: !!selectedSystem,
    });

    // Fetch presets
    const { data: presets } = useQuery({
        queryKey: ["design-system-presets"],
        queryFn: () => api.getDesignSystemPresets(),
    });

    // Create design system mutation
    const createSystemMutation = useMutation({
        mutationFn: (data: { name: string; description?: string; presetId?: string }) =>
            api.createDesignSystem(data),
        onSuccess: (system) => {
            queryClient.invalidateQueries({ queryKey: ["design-systems"] });
            setSelectedSystem(system.id);
            setIsCreateOpen(false);
            setNewSystemName("");
            setNewSystemDescription("");
            toast.success("Design system created!");
        },
        onError: () => {
            toast.error("Failed to create design system");
        },
    });

    // Update tokens mutation
    const updateTokensMutation = useMutation({
        mutationFn: ({ systemId, tokens }: { systemId: string; tokens: Record<string, unknown> }) =>
            api.updateDesignSystemTokens(systemId, tokens as Parameters<typeof api.updateDesignSystemTokens>[1]),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["design-system", selectedSystem] });
            toast.success("Design system updated!");
        },
        onError: () => {
            toast.error("Failed to update design system");
        },
    });

    // Generate palette mutation
    const generatePaletteMutation = useMutation({
        mutationFn: ({ baseColor, name }: { baseColor: string; name: string }) =>
            api.generateColorPalette(baseColor, name),
        onSuccess: (result) => {
            if (currentSystem && selectedSystem) {
                const existingColors = (currentSystem as DesignSystem).colors || [];
                updateTokensMutation.mutate({
                    systemId: selectedSystem,
                    tokens: {
                        colors: [...existingColors, ...result.colors],
                    },
                });
            }
            setGeneratingPalette(false);
            toast.success("Color palette generated!");
        },
        onError: () => {
            toast.error("Failed to generate palette");
            setGeneratingPalette(false);
        },
    });

    // Export CSS mutation
    const exportCSSMutation = useMutation({
        mutationFn: (systemId: string) => api.exportDesignSystemCSS(systemId),
        onSuccess: (result) => {
            navigator.clipboard.writeText(result.css);
            toast.success("CSS copied to clipboard!");
        },
        onError: () => {
            toast.error("Failed to export CSS");
        },
    });

    const handleAddColor = () => {
        if (!selectedSystem || !newColorName || !newColorValue) { return; }

        const existingColors = (currentSystem as DesignSystem)?.colors || [];
        updateTokensMutation.mutate({
            systemId: selectedSystem,
            tokens: {
                colors: [...existingColors, { name: newColorName, value: newColorValue }],
            },
        });
        setNewColorName("");
        setNewColorValue("#3B82F6");
    };

    const handleDeleteColor = (colorName: string) => {
        if (!selectedSystem || !currentSystem) { return; }

        const updatedColors = ((currentSystem as DesignSystem).colors || []).filter(c => c.name !== colorName);
        updateTokensMutation.mutate({
            systemId: selectedSystem,
            tokens: { colors: updatedColors },
        });
    };

    const handleGeneratePalette = (baseColor: string) => {
        setGeneratingPalette(true);
        generatePaletteMutation.mutate({
            baseColor,
            name: "Generated",
        });
    };

    // Default mock data for display
    const mockSystem: DesignSystem = {
        id: "mock",
        name: "Default Design System",
        colors: [
            { name: "primary", value: "#3B82F6" },
            { name: "secondary", value: "#6366F1" },
            { name: "accent", value: "#8B5CF6" },
            { name: "success", value: "#10B981" },
            { name: "warning", value: "#F59E0B" },
            { name: "error", value: "#EF4444" },
            { name: "background", value: "#FFFFFF" },
            { name: "foreground", value: "#1F2937" },
        ],
        typography: [
            { name: "heading-1", fontFamily: "Inter", fontSize: "3rem", fontWeight: "700" },
            { name: "heading-2", fontFamily: "Inter", fontSize: "2.25rem", fontWeight: "600" },
            { name: "heading-3", fontFamily: "Inter", fontSize: "1.5rem", fontWeight: "600" },
            { name: "body", fontFamily: "Inter", fontSize: "1rem", fontWeight: "400" },
            { name: "small", fontFamily: "Inter", fontSize: "0.875rem", fontWeight: "400" },
        ],
        spacing: [
            { name: "xs", value: "0.25rem" },
            { name: "sm", value: "0.5rem" },
            { name: "md", value: "1rem" },
            { name: "lg", value: "1.5rem" },
            { name: "xl", value: "2rem" },
            { name: "2xl", value: "3rem" },
        ],
    };

    const displaySystem = (currentSystem as DesignSystem) || mockSystem;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/settings/branding">
                                <Button variant="ghost" size="sm">
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Back
                                </Button>
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                                    <Palette className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">
                                    Design System
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Select
                                value={selectedSystem || ""}
                                onValueChange={setSelectedSystem}
                            >
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select design system" />
                                </SelectTrigger>
                                <SelectContent>
                                    {designSystems?.map((sys) => (
                                        <SelectItem key={sys.id} value={sys.id}>
                                            {sys.name}
                                        </SelectItem>
                                    )) || (
                                            <SelectItem value="default">Default System</SelectItem>
                                        )}
                                </SelectContent>
                            </Select>

                            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                New System
                            </Button>

                            {selectedSystem && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportCSSMutation.mutate(selectedSystem)}
                                    disabled={exportCSSMutation.isPending}
                                >
                                    {exportCSSMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4 mr-2" />
                                    )}
                                    Export CSS
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm">
                        <TabsTrigger value="colors" className="rounded-md">
                            <Palette className="h-4 w-4 mr-2" />
                            Colors
                        </TabsTrigger>
                        <TabsTrigger value="typography" className="rounded-md">
                            <Type className="h-4 w-4 mr-2" />
                            Typography
                        </TabsTrigger>
                        <TabsTrigger value="spacing" className="rounded-md">
                            <Layers className="h-4 w-4 mr-2" />
                            Spacing
                        </TabsTrigger>
                        <TabsTrigger value="preview" className="rounded-md">
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                        </TabsTrigger>
                    </TabsList>

                    {/* Colors Tab */}
                    <TabsContent value="colors" className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Color Tokens</h2>
                                <p className="text-slate-500">Define your brand colors and theme palette</p>
                            </div>
                            <Button
                                onClick={() => displaySystem.colors?.[0] && handleGeneratePalette(displaySystem.colors[0].value)}
                                disabled={generatingPalette}
                            >
                                {generatingPalette ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                )}
                                Generate Palette
                            </Button>
                        </div>

                        {/* Color Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {displaySystem.colors?.map((color) => (
                                <Card key={color.name} className="group overflow-hidden">
                                    <div
                                        className="h-24 transition-transform group-hover:scale-105"
                                        style={{ backgroundColor: color.value }}
                                    />
                                    <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-sm text-slate-900 dark:text-white capitalize">
                                                    {color.name}
                                                </p>
                                                <p className="text-xs text-slate-500 font-mono uppercase">
                                                    {color.value}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => navigator.clipboard.writeText(color.value)}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-red-500 hover:text-red-600"
                                                    onClick={() => handleDeleteColor(color.name)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {/* Add New Color Card */}
                            <Card className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-pink-500 transition-colors">
                                <CardContent className="p-4 h-full flex flex-col justify-center">
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Color name"
                                            value={newColorName}
                                            onChange={(e) => setNewColorName(e.target.value)}
                                            className="text-sm"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={newColorValue}
                                                onChange={(e) => setNewColorValue(e.target.value)}
                                                className="h-10 w-14 rounded cursor-pointer"
                                            />
                                            <Input
                                                value={newColorValue}
                                                onChange={(e) => setNewColorValue(e.target.value)}
                                                className="font-mono text-sm uppercase"
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            className="w-full"
                                            onClick={handleAddColor}
                                            disabled={!newColorName || updateTokensMutation.isPending}
                                        >
                                            {updateTokensMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Add Color
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Typography Tab */}
                    <TabsContent value="typography" className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Typography Tokens</h2>
                            <p className="text-slate-500">Define your typography styles and font scales</p>
                        </div>

                        <div className="space-y-4">
                            {displaySystem.typography?.map((token) => (
                                <Card key={token.name}>
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <Badge variant="outline" className="mb-2 capitalize">{token.name}</Badge>
                                                <p
                                                    className="text-slate-900 dark:text-white"
                                                    style={{
                                                        fontFamily: token.fontFamily,
                                                        fontSize: token.fontSize,
                                                        fontWeight: token.fontWeight as React.CSSProperties["fontWeight"] || 400,
                                                    }}
                                                >
                                                    The quick brown fox jumps over the lazy dog
                                                </p>
                                            </div>
                                            <div className="text-right text-sm text-slate-500 space-y-1">
                                                <p>Font: {token.fontFamily}</p>
                                                <p>Size: {token.fontSize}</p>
                                                {token.fontWeight && <p>Weight: {token.fontWeight}</p>}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* Spacing Tab */}
                    <TabsContent value="spacing" className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Spacing Tokens</h2>
                            <p className="text-slate-500">Define consistent spacing values for your designs</p>
                        </div>

                        <Card>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {displaySystem.spacing?.map((token) => (
                                        <div key={token.name} className="flex items-center gap-4">
                                            <Badge variant="outline" className="w-16 justify-center">{token.name}</Badge>
                                            <div
                                                className="bg-gradient-to-r from-pink-500 to-rose-500 rounded"
                                                style={{ width: token.value, height: "24px" }}
                                            />
                                            <span className="text-sm text-slate-500 font-mono">{token.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Preview Tab */}
                    <TabsContent value="preview" className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Design Preview</h2>
                            <p className="text-slate-500">See how your design system looks in practice</p>
                        </div>

                        <Card>
                            <CardContent className="p-8">
                                <div className="space-y-8">
                                    {/* Color Palette Preview */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Color Palette</h3>
                                        <div className="flex gap-2 flex-wrap">
                                            {displaySystem.colors?.map((color) => (
                                                <div
                                                    key={color.name}
                                                    className="w-12 h-12 rounded-lg shadow-sm"
                                                    style={{ backgroundColor: color.value }}
                                                    title={`${color.name}: ${color.value}`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Typography Preview */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Typography Scale</h3>
                                        <div className="space-y-2">
                                            {displaySystem.typography?.map((token) => (
                                                <p
                                                    key={token.name}
                                                    style={{
                                                        fontFamily: token.fontFamily,
                                                        fontSize: token.fontSize,
                                                        fontWeight: token.fontWeight as React.CSSProperties["fontWeight"] || 400,
                                                    }}
                                                >
                                                    {token.name} - {token.fontSize}
                                                </p>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Button Preview */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Buttons</h3>
                                        <div className="flex gap-3 flex-wrap">
                                            <button
                                                className="px-4 py-2 rounded-lg text-white font-medium transition-transform hover:scale-105"
                                                style={{ backgroundColor: displaySystem.colors?.[0]?.value || "#3B82F6" }}
                                            >
                                                Primary Button
                                            </button>
                                            <button
                                                className="px-4 py-2 rounded-lg text-white font-medium transition-transform hover:scale-105"
                                                style={{ backgroundColor: displaySystem.colors?.[1]?.value || "#6366F1" }}
                                            >
                                                Secondary Button
                                            </button>
                                            <button
                                                className="px-4 py-2 rounded-lg border-2 font-medium transition-transform hover:scale-105"
                                                style={{ borderColor: displaySystem.colors?.[0]?.value || "#3B82F6", color: displaySystem.colors?.[0]?.value || "#3B82F6" }}
                                            >
                                                Outline Button
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Create Design System Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Design System</DialogTitle>
                        <DialogDescription>
                            Create a new design system from scratch or start from a preset
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                placeholder="My Brand Design System"
                                value={newSystemName}
                                onChange={(e) => setNewSystemName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Describe your design system..."
                                value={newSystemDescription}
                                onChange={(e) => setNewSystemDescription(e.target.value)}
                            />
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label>Start from Preset (Optional)</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {presets?.map((preset) => (
                                    <button
                                        key={preset.id}
                                        className="p-3 border rounded-lg text-left hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
                                        onClick={() => {
                                            createSystemMutation.mutate({
                                                name: newSystemName || preset.name,
                                                description: newSystemDescription || preset.description,
                                                presetId: preset.id,
                                            });
                                        }}
                                    >
                                        <p className="font-medium">{preset.name}</p>
                                        <p className="text-sm text-slate-500">{preset.description}</p>
                                    </button>
                                )) || (
                                        <>
                                            <button className="p-3 border rounded-lg text-left hover:border-pink-500 transition-colors">
                                                <p className="font-medium">Modern</p>
                                                <p className="text-sm text-slate-500">Clean and contemporary</p>
                                            </button>
                                            <button className="p-3 border rounded-lg text-left hover:border-pink-500 transition-colors">
                                                <p className="font-medium">Corporate</p>
                                                <p className="text-sm text-slate-500">Professional business</p>
                                            </button>
                                        </>
                                    )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createSystemMutation.mutate({
                                name: newSystemName,
                                description: newSystemDescription,
                            })}
                            disabled={!newSystemName || createSystemMutation.isPending}
                        >
                            {createSystemMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Create"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
