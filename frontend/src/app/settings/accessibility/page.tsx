"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ChevronLeft,
    Eye,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    Image,
    Loader2,
    Wand2,
    RefreshCw,
    FileText,
    Sparkles,
    Target,
    Contrast,
    Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/lib/api";

interface AccessibilityIssue {
    id: string;
    type: string;
    severity: "critical" | "warning" | "info";
    message: string;
    slideId?: string;
    blockId?: string;
    suggestion?: string;
}

interface ContrastResult {
    ratio: number;
    passesAA: boolean;
    passesAAA: boolean;
}

export default function AccessibilitySettingsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("checker");
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [foregroundColor, setForegroundColor] = useState("#FFFFFF");
    const [backgroundColor, setBackgroundColor] = useState("#000000");
    const [contrastResult, setContrastResult] = useState<ContrastResult | null>(null);
    const [imageUrl, setImageUrl] = useState("");
    const [generatedAltText, setGeneratedAltText] = useState("");
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

    // Fetch WCAG guidelines
    const { data: guidelines } = useQuery({
        queryKey: ["wcag-guidelines"],
        queryFn: () => api.getWCAGGuidelines(),
    });

    // Check accessibility mutation
    const checkAccessibilityMutation = useMutation({
        mutationFn: (projectId: string) => api.checkProjectAccessibility(projectId),
        onSuccess: () => {
            toast.success("Accessibility check complete!");
        },
        onError: () => {
            toast.error("Failed to check accessibility");
        },
    });

    // Check contrast mutation  
    const checkContrastMutation = useMutation({
        mutationFn: ({ foreground, background }: { foreground: string; background: string }) =>
            api.checkContrast(foreground, background),
        onSuccess: (result) => {
            setContrastResult(result);
        },
        onError: () => {
            toast.error("Failed to check contrast");
        },
    });

    // Suggest colors mutation
    const suggestColorsMutation = useMutation({
        mutationFn: ({ foreground, background }: { foreground: string; background: string }) =>
            api.suggestAccessibleColors(foreground, background),
        onSuccess: () => {
            toast.success("Color suggestions ready!");
        },
        onError: () => {
            toast.error("Failed to suggest colors");
        },
    });

    // Generate alt text mutation
    const generateAltTextMutation = useMutation({
        mutationFn: (url: string) => api.generateAltText(url),
        onSuccess: (result) => {
            setGeneratedAltText(result.altText);
            toast.success("Alt text generated!");
        },
        onError: () => {
            toast.error("Failed to generate alt text");
        },
    });

    // Auto-fix issues mutation
    const autoFixMutation = useMutation({
        mutationFn: ({ projectId, issueIds }: { projectId: string; issueIds: string[] }) =>
            api.autoFixAccessibilityIssues(projectId, issueIds),
        onSuccess: (result) => {
            toast.success(`Fixed ${result.fixed} issues!`);
            setSelectedIssues([]);
            queryClient.invalidateQueries({ queryKey: ["accessibility-check"] });
        },
        onError: () => {
            toast.error("Failed to auto-fix issues");
        },
    });

    // Mock data for demonstration
    const mockIssues: AccessibilityIssue[] = [
        {
            id: "1",
            type: "contrast",
            severity: "critical",
            message: "Text color #gray on #lightgray background has insufficient contrast ratio (2.1:1)",
            slideId: "slide-1",
            suggestion: "Use darker text color or lighter background",
        },
        {
            id: "2",
            type: "alt-text",
            severity: "warning",
            message: "Image is missing alternative text",
            slideId: "slide-2",
            blockId: "block-1",
            suggestion: "Add descriptive alt text for screen readers",
        },
        {
            id: "3",
            type: "heading-order",
            severity: "info",
            message: "Heading levels should be sequential (H1 -> H3 skips H2)",
            slideId: "slide-3",
            suggestion: "Use H2 before H3 for proper document structure",
        },
        {
            id: "4",
            type: "font-size",
            severity: "warning",
            message: "Text size is too small (10px) for comfortable reading",
            slideId: "slide-1",
            blockId: "block-3",
            suggestion: "Use a minimum font size of 14px for body text",
        },
    ];

    const mockGuidelines = guidelines || [
        { id: "1.1.1", title: "Non-text Content", level: "A", description: "Provide text alternatives for non-text content" },
        { id: "1.4.3", title: "Contrast (Minimum)", level: "AA", description: "4.5:1 contrast ratio for text" },
        { id: "1.4.6", title: "Contrast (Enhanced)", level: "AAA", description: "7:1 contrast ratio for text" },
        { id: "2.4.6", title: "Headings and Labels", level: "AA", description: "Headings and labels describe topic or purpose" },
    ];

    const accessibilityScore = checkAccessibilityMutation.data?.score || 75;
    const issues = checkAccessibilityMutation.data?.issues || mockIssues;

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "critical":
                return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
            case "warning":
                return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
            case "info":
                return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
            default:
                return "bg-slate-100 text-slate-700 border-slate-200";
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "critical":
                return <XCircle className="h-5 w-5 text-red-500" />;
            case "warning":
                return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case "info":
                return <Info className="h-5 w-5 text-blue-500" />;
            default:
                return <Info className="h-5 w-5" />;
        }
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-green-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard">
                                <Button variant="ghost" size="sm">
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Back
                                </Button>
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                    <Eye className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">
                                    Accessibility
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-white dark:bg-slate-900 p-1 rounded-lg shadow-sm">
                        <TabsTrigger value="checker" className="rounded-md">
                            <Target className="h-4 w-4 mr-2" />
                            Accessibility Checker
                        </TabsTrigger>
                        <TabsTrigger value="contrast" className="rounded-md">
                            <Contrast className="h-4 w-4 mr-2" />
                            Contrast Checker
                        </TabsTrigger>
                        <TabsTrigger value="alt-text" className="rounded-md">
                            <Image className="h-4 w-4 mr-2" aria-label="Alt Text Generator" />
                            Alt Text Generator
                        </TabsTrigger>
                        <TabsTrigger value="guidelines" className="rounded-md">
                            <FileText className="h-4 w-4 mr-2" />
                            WCAG Guidelines
                        </TabsTrigger>
                    </TabsList>

                    {/* Accessibility Checker Tab */}
                    <TabsContent value="checker" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Score Card */}
                            <Card className="lg:col-span-1">
                                <CardHeader>
                                    <CardTitle>Accessibility Score</CardTitle>
                                    <CardDescription>Based on WCAG 2.1 guidelines</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="relative flex items-center justify-center">
                                        <div className="text-5xl font-bold text-slate-900 dark:text-white">
                                            {accessibilityScore}
                                        </div>
                                        <span className="text-2xl text-slate-500 ml-1">/100</span>
                                    </div>
                                    <Progress value={accessibilityScore} className="h-3" />
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                            <p className="text-2xl font-bold text-red-600">
                                                {issues.filter(i => i.severity === "critical").length}
                                            </p>
                                            <p className="text-xs text-red-600">Critical</p>
                                        </div>
                                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                            <p className="text-2xl font-bold text-yellow-600">
                                                {issues.filter(i => i.severity === "warning").length}
                                            </p>
                                            <p className="text-xs text-yellow-600">Warnings</p>
                                        </div>
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                            <p className="text-2xl font-bold text-blue-600">
                                                {issues.filter(i => i.severity === "info").length}
                                            </p>
                                            <p className="text-xs text-blue-600">Info</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 space-y-2">
                                        <Input
                                            placeholder="Enter project ID"
                                            value={selectedProjectId}
                                            onChange={(e) => setSelectedProjectId(e.target.value)}
                                        />
                                        <Button
                                            className="w-full"
                                            onClick={() => selectedProjectId && checkAccessibilityMutation.mutate(selectedProjectId)}
                                            disabled={!selectedProjectId || checkAccessibilityMutation.isPending}
                                        >
                                            {checkAccessibilityMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                            )}
                                            Run Check
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Issues List */}
                            <Card className="lg:col-span-2">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Issues Found</CardTitle>
                                        <CardDescription>{issues.length} issues detected</CardDescription>
                                    </div>
                                    {selectedIssues.length > 0 && (
                                        <Button
                                            size="sm"
                                            onClick={() => autoFixMutation.mutate({
                                                projectId: selectedProjectId,
                                                issueIds: selectedIssues,
                                            })}
                                            disabled={autoFixMutation.isPending}
                                        >
                                            {autoFixMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Wand2 className="h-4 w-4 mr-2" />
                                            )}
                                            Auto-Fix ({selectedIssues.length})
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {issues.map((issue) => (
                                            <div
                                                key={issue.id}
                                                className={`p-4 rounded-lg border flex items-start gap-4 ${getSeverityColor(issue.severity)}`}
                                            >
                                                <Checkbox
                                                    checked={selectedIssues.includes(issue.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedIssues([...selectedIssues, issue.id]);
                                                        } else {
                                                            setSelectedIssues(selectedIssues.filter(id => id !== issue.id));
                                                        }
                                                    }}
                                                />
                                                {getSeverityIcon(issue.severity)}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="capitalize">{issue.type}</Badge>
                                                        {issue.slideId && (
                                                            <Badge variant="secondary">Slide: {issue.slideId}</Badge>
                                                        )}
                                                    </div>
                                                    <p className="font-medium">{issue.message}</p>
                                                    {issue.suggestion && (
                                                        <p className="text-sm mt-1 opacity-80">
                                                            💡 {issue.suggestion}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Contrast Checker Tab */}
                    <TabsContent value="contrast" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Contrast className="h-5 w-5 text-green-500" />
                                        Color Contrast Checker
                                    </CardTitle>
                                    <CardDescription>Check if your color combinations meet WCAG standards</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Foreground (Text)</Label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={foregroundColor}
                                                    onChange={(e) => setForegroundColor(e.target.value)}
                                                    className="h-10 w-14 rounded cursor-pointer"
                                                />
                                                <Input
                                                    value={foregroundColor}
                                                    onChange={(e) => setForegroundColor(e.target.value)}
                                                    className="font-mono uppercase"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Background</Label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={backgroundColor}
                                                    onChange={(e) => setBackgroundColor(e.target.value)}
                                                    className="h-10 w-14 rounded cursor-pointer"
                                                />
                                                <Input
                                                    value={backgroundColor}
                                                    onChange={(e) => setBackgroundColor(e.target.value)}
                                                    className="font-mono uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full"
                                        onClick={() => checkContrastMutation.mutate({ foreground: foregroundColor, background: backgroundColor })}
                                        disabled={checkContrastMutation.isPending}
                                    >
                                        {checkContrastMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Eye className="h-4 w-4 mr-2" />
                                        )}
                                        Check Contrast
                                    </Button>

                                    {contrastResult && (
                                        <div className="space-y-4">
                                            <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <p className="text-4xl font-bold">{contrastResult.ratio.toFixed(2)}:1</p>
                                                <p className="text-slate-500">Contrast Ratio</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className={`p-4 rounded-lg border-2 ${contrastResult.passesAA ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {contrastResult.passesAA ? (
                                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        ) : (
                                                            <XCircle className="h-5 w-5 text-red-500" />
                                                        )}
                                                        <span className="font-medium">WCAG AA</span>
                                                    </div>
                                                    <p className="text-sm text-slate-500 mt-1">4.5:1 minimum</p>
                                                </div>
                                                <div className={`p-4 rounded-lg border-2 ${contrastResult.passesAAA ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {contrastResult.passesAAA ? (
                                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        ) : (
                                                            <XCircle className="h-5 w-5 text-red-500" />
                                                        )}
                                                        <span className="font-medium">WCAG AAA</span>
                                                    </div>
                                                    <p className="text-sm text-slate-500 mt-1">7:1 minimum</p>
                                                </div>
                                            </div>

                                            {!contrastResult.passesAA && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => suggestColorsMutation.mutate({ foreground: foregroundColor, background: backgroundColor })}
                                                >
                                                    <Sparkles className="h-4 w-4 mr-2" />
                                                    Get Accessible Color Suggestions
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Preview Card */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Live Preview</CardTitle>
                                    <CardDescription>See how your colors look together</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        className="rounded-lg p-8 min-h-75 flex flex-col justify-center"
                                        style={{ backgroundColor }}
                                    >
                                        <h2
                                            className="text-3xl font-bold mb-4"
                                            style={{ color: foregroundColor }}
                                        >
                                            Large Text (24px+)
                                        </h2>
                                        <p
                                            className="text-lg mb-4"
                                            style={{ color: foregroundColor }}
                                        >
                                            Regular text should be readable. This is an example of body text that might appear in your presentation.
                                        </p>
                                        <p
                                            className="text-sm"
                                            style={{ color: foregroundColor }}
                                        >
                                            Small text requires higher contrast ratios to be accessible.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Alt Text Generator Tab */}
                    <TabsContent value="alt-text" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Image className="h-5 w-5 text-blue-500" aria-label="AI Alt Text Generator" />
                                    AI Alt Text Generator
                                </CardTitle>
                                <CardDescription>Generate descriptive alternative text for images using AI</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="image-url">Image URL</Label>
                                        <Input
                                            id="image-url"
                                            placeholder="https://example.com/image.jpg"
                                            value={imageUrl}
                                            onChange={(e) => setImageUrl(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        onClick={() => generateAltTextMutation.mutate(imageUrl)}
                                        disabled={!imageUrl || generateAltTextMutation.isPending}
                                    >
                                        {generateAltTextMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Wand2 className="h-4 w-4 mr-2" />
                                        )}
                                        Generate Alt Text
                                    </Button>
                                </div>

                                {generatedAltText && (
                                    <Alert>
                                        <Sparkles className="h-4 w-4" />
                                        <AlertTitle>Generated Alt Text</AlertTitle>
                                        <AlertDescription className="mt-2">
                                            <p className="font-medium">{generatedAltText}</p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-3"
                                                onClick={() => navigator.clipboard.writeText(generatedAltText)}
                                            >
                                                Copy to Clipboard
                                            </Button>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6">
                                    <h3 className="font-semibold mb-3">Alt Text Best Practices</h3>
                                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                        <li className="flex items-start gap-2">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                            Be specific and concise - describe the image content, not just what it is
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                            Include relevant context - mention text, colors, or actions shown
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                            Avoid phrases like &ldquo;image of&rdquo; or &ldquo;picture of&rdquo; - screen readers already announce it as an image
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                            For decorative images, use empty alt text (alt=&ldquo;&rdquo;) to skip them
                                        </li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* WCAG Guidelines Tab */}
                    <TabsContent value="guidelines" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>WCAG 2.1 Guidelines Reference</CardTitle>
                                <CardDescription>Web Content Accessibility Guidelines for presentations</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {mockGuidelines.map((guideline) => (
                                        <div
                                            key={guideline.id}
                                            className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-mono text-sm text-slate-500">{guideline.id}</span>
                                                <h3 className="font-medium text-slate-900 dark:text-white">{guideline.title}</h3>
                                                <Badge
                                                    variant={guideline.level === "A" ? "default" : guideline.level === "AA" ? "secondary" : "outline"}
                                                >
                                                    Level {guideline.level}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                {guideline.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
