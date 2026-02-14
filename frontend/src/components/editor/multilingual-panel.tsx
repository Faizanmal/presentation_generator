"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Globe,
    Languages,
    Plus,
    Check,
    Loader2,
    ChevronDown,
    ChevronRight,

    Wand2,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";

interface Translation {
    languageCode: string;
    languageName: string;
    progress: number;
    status: "complete" | "partial" | "pending";
}

interface MultilingualPanelProps {
    projectId: string;
    currentLanguage?: string;
    onLanguageChange?: (languageCode: string) => void;
}

const POPULAR_LANGUAGES = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
    { code: "pt", name: "Portuguese", flag: "🇧🇷" },
    { code: "zh", name: "Chinese", flag: "🇨🇳" },
    { code: "ja", name: "Japanese", flag: "🇯🇵" },
    { code: "ko", name: "Korean", flag: "🇰🇷" },
    { code: "ar", name: "Arabic", flag: "🇸🇦" },
    { code: "hi", name: "Hindi", flag: "🇮🇳" },
    { code: "ru", name: "Russian", flag: "🇷🇺" },
];

export function MultilingualPanel({
    projectId,
    currentLanguage = "en",
    onLanguageChange,
}: MultilingualPanelProps) {
    const queryClient = useQueryClient();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
    const [textToDetect, setTextToDetect] = useState("");
    const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
    const [isLanguagesExpanded, setIsLanguagesExpanded] = useState(true);

    // Fetch supported languages
    const { data: supportedLanguages } = useQuery({
        queryKey: ["supported-languages"],
        queryFn: () => api.getSupportedLanguages(),
    });

    // Fetch project translations
    const { data: translations = [], isLoading } = useQuery<Translation[]>({
        queryKey: ["project-translations", projectId],
        queryFn: () => api.getProjectLanguages(projectId) as Promise<Translation[]>,
    });

    // Translate project mutation
    const translateProjectMutation = useMutation<{ jobId: string }, Error, string>({
        mutationFn: (targetLanguage: string) => api.translateProject(projectId, targetLanguage),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-translations", projectId] });
            toast.success("Translation complete!");
        },
        onError: () => toast.error("Translation failed"),
        onMutate: () => {
            toast.info("Translating project... This may take a moment.");
        },
    });

    // Add languages mutation
    const addLanguagesMutation = useMutation({
        mutationFn: (languages: string[]) =>
            Promise.all(languages.map(lang => api.translateProject(projectId, lang))),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-translations", projectId] });
            setIsAddOpen(false);
            setSelectedLanguages([]);
            toast.success("Languages added and translation started!");
        },
        onError: () => toast.error("Failed to add languages"),
    });

    // Detect language mutation
    const detectLanguageMutation = useMutation({
        mutationFn: (text: string) => api.detectContentLanguage(text),
        onSuccess: (result) => {
            setDetectedLanguage(result.detectedLanguage);
        },
        onError: () => toast.error("Failed to detect language"),
    });

    // Mock translations for demo
    const mockTranslations: Translation[] = [
        { languageCode: "en", languageName: "English", progress: 100, status: "complete" },
        { languageCode: "es", languageName: "Spanish", progress: 85, status: "partial" },
        { languageCode: "fr", languageName: "French", progress: 100, status: "complete" },
    ];

    const displayTranslations = translations || mockTranslations;
    const displayLanguages = supportedLanguages || POPULAR_LANGUAGES;

    const toggleLanguage = (code: string) => {
        if (selectedLanguages.includes(code)) {
            setSelectedLanguages(selectedLanguages.filter(c => c !== code));
        } else {
            setSelectedLanguages([...selectedLanguages, code]);
        }
    };



    const getStatusIcon = (status: Translation["status"]) => {
        switch (status) {
            case "complete":
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case "partial":
                return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            case "pending":
                return <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />;
            default:
                return null;
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Multilingual
                </h3>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Language
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Languages</DialogTitle>
                            <DialogDescription>
                                Select languages to translate your presentation into
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                                {displayLanguages.map((lang) => {
                                    const isSelected = selectedLanguages.includes(lang.code);
                                    const isExisting = displayTranslations.some(t => t.languageCode === lang.code);

                                    return (
                                        <button
                                            key={lang.code}
                                            onClick={() => !isExisting && toggleLanguage(lang.code)}
                                            disabled={isExisting}
                                            className={`p-3 rounded-lg border-2 transition-all text-left flex items-center gap-2 ${isSelected
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : isExisting
                                                    ? "border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                                                }`}
                                        >
                                            <span className="text-xl">{lang.flag}</span>
                                            <span className="text-sm font-medium">{lang.name}</span>
                                            {isSelected && <Check className="h-4 w-4 text-blue-500 ml-auto" />}
                                            {isExisting && <Badge variant="secondary" className="ml-auto text-xs">Added</Badge>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => addLanguagesMutation.mutate(selectedLanguages)}
                                disabled={selectedLanguages.length === 0 || addLanguagesMutation.isPending}
                            >
                                {addLanguagesMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Translating...
                                    </>
                                ) : (
                                    <>
                                        <Languages className="h-4 w-4 mr-2" />
                                        Translate to {selectedLanguages.length} language{selectedLanguages.length !== 1 ? "s" : ""}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Current Language */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">
                                {POPULAR_LANGUAGES.find(l => l.code === currentLanguage)?.flag || "🌐"}
                            </span>
                            <div>
                                <p className="font-medium text-sm">
                                    {POPULAR_LANGUAGES.find(l => l.code === currentLanguage)?.name || "Primary"}
                                </p>
                                <p className="text-xs text-slate-500">Primary language</p>
                            </div>
                        </div>
                        <Badge className="bg-blue-500">Active</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Translations List */}
            <Collapsible open={isLanguagesExpanded} onOpenChange={setIsLanguagesExpanded}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <span className="text-sm font-medium">Translations</span>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">{displayTranslations.length}</Badge>
                        {isLanguagesExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        displayTranslations.map((translation) => (
                            <Card
                                key={translation.languageCode}
                                className={`cursor-pointer transition-all hover:shadow-md ${currentLanguage === translation.languageCode
                                    ? "ring-2 ring-blue-500"
                                    : ""
                                    }`}
                                onClick={() => onLanguageChange?.(translation.languageCode)}
                            >
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">
                                                {POPULAR_LANGUAGES.find(l => l.code === translation.languageCode)?.flag || "🌐"}
                                            </span>
                                            <span className="font-medium text-sm">{translation.languageName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(translation.status)}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    translateProjectMutation.mutate(translation.languageCode);
                                                }}
                                                disabled={translateProjectMutation.isPending}
                                            >
                                                <RefreshCw className={`h-3 w-3 ${translateProjectMutation.isPending ? "animate-spin" : ""}`} />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>Translation progress</span>
                                            <span>{translation.progress}%</span>
                                        </div>
                                        <Progress value={translation.progress} className="h-1.5" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </CollapsibleContent>
            </Collapsible>

            {/* Language Detection */}
            <div className="space-y-2">
                <Label className="text-xs text-slate-500">Language Detection</Label>
                <div className="flex gap-2">
                    <Input
                        placeholder="Enter text to detect language..."
                        value={textToDetect}
                        onChange={(e) => setTextToDetect(e.target.value)}
                        className="text-sm"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => detectLanguageMutation.mutate(textToDetect)}
                        disabled={!textToDetect || detectLanguageMutation.isPending}
                    >
                        {detectLanguageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Wand2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>
                {detectedLanguage && (
                    <Badge variant="secondary" className="text-xs">
                        Detected: {POPULAR_LANGUAGES.find(l => l.code === detectedLanguage)?.name || detectedLanguage}
                    </Badge>
                )}
            </div>

            {/* Quick Add Popular Languages */}
            <div className="space-y-2">
                <Label className="text-xs text-slate-500">Quick Add</Label>
                <div className="flex flex-wrap gap-1">
                    {POPULAR_LANGUAGES.slice(0, 6).map((lang) => {
                        const isAdded = displayTranslations.some(t => t.languageCode === lang.code);
                        return (
                            <button
                                key={lang.code}
                                onClick={() => !isAdded && translateProjectMutation.mutate(lang.code)}
                                disabled={isAdded || translateProjectMutation.isPending}
                                className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${isAdded
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    }`}
                            >
                                <span>{lang.flag}</span>
                                <span>{lang.code.toUpperCase()}</span>
                                {isAdded && <Check className="h-3 w-3 text-green-500" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
