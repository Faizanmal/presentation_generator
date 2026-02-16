"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Upload,
    FileSpreadsheet,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    BarChart3,
    FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface DataImportProps {
    onSuccess?: (projectId: string) => void;
    trigger?: React.ReactNode;
}

interface ParsedData {
    headers: string[];
    sampleRows: Record<string, unknown>[];
    metadata: {
        totalRows: number;
        totalColumns: number;
        fileName: string;
        sheetName?: string;
    };
    analysis: {
        summary: {
            rowCount: number;
            columnCount: number;
            numericColumns: string[];
            categoricalColumns: string[];
            dateColumns: string[];
        };
        insights: Array<{
            type: string;
            description: string;
            significance: "high" | "medium" | "low";
        }>;
        recommendedCharts: Array<{
            type: string;
            columns: string[];
            reason: string;
        }>;
    };
}

export function DataImporter({ onSuccess, trigger }: DataImportProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>("");

    // Import options
    const [topic, setTopic] = useState("");
    const [tone, setTone] = useState("professional");
    const [audience, setAudience] = useState("general");
    const [generateCharts, setGenerateCharts] = useState(true);
    const [autoDetectHeaders] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (selectedFile: File) => {
        setFile(selectedFile);
        setError(null);
        setParsedData(null);
        setSheets([]);
        setSelectedSheet("");

        // If Excel file, fetch available sheets
        if (
            selectedFile.name.endsWith(".xlsx") ||
            selectedFile.name.endsWith(".xls")
        ) {
            await fetchExcelSheets(selectedFile);
        } else {
            // Auto-analyze CSV files
            await analyzeFile(selectedFile);
        }
    };

    const fetchExcelSheets = async (file: File) => {
        setAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/ai/data-import/preview-sheets`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: formData,
                }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch Excel sheets");
            }

            const data = await response.json();
            setSheets(data.data.sheets);
            if (data.data.sheets.length > 0) {
                setSelectedSheet(data.data.sheets[0]);
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to read Excel file"
            );
        } finally {
            setAnalyzing(false);
        }
    };

    const analyzeFile = async (fileToAnalyze?: File, sheetName?: string) => {
        const targetFile = fileToAnalyze || file;
        if (!targetFile) { return; }

        setAnalyzing(true);
        setError(null);
        setProgress(20);

        try {
            const formData = new FormData();
            formData.append("file", targetFile);

            const url = new URL(
                `${process.env.NEXT_PUBLIC_API_URL}/ai/data-import/analyze`
            );
            if (sheetName) { url.searchParams.append("sheetName", sheetName); }
            if (!autoDetectHeaders) { url.searchParams.append("autoDetectHeaders", "false"); }

            const response = await fetch(url.toString(), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to analyze file");
            }

            const data = await response.json();
            setParsedData(data.data);
            setProgress(100);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to analyze file");
            setProgress(0);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSheetChange = (sheet: string) => {
        setSelectedSheet(sheet);
        analyzeFile(undefined, sheet);
    };

    const generatePresentation = async () => {
        if (!file) { return; }

        setGenerating(true);
        setError(null);
        setProgress(0);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append(
                "userId",
                localStorage.getItem("userId") || ""
            );
            formData.append("source", file.name.endsWith(".csv") ? "csv" : "excel");
            formData.append("topic", topic || `Analysis: ${file.name}`);
            formData.append("tone", tone);
            formData.append("audience", audience);
            formData.append("generateCharts", generateCharts.toString());
            formData.append("autoDetectHeaders", autoDetectHeaders.toString());
            if (selectedSheet) { formData.append("sheetName", selectedSheet); }

            // Simulate progress
            const progressInterval = setInterval(() => {
                setProgress((prev) => Math.min(prev + 10, 90));
            }, 500);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/ai/data-import/generate-presentation`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: formData,
                }
            );

            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.message || "Failed to generate presentation"
                );
            }

            const data = await response.json();
            setProgress(100);

            // Success!
            setTimeout(() => {
                if (onSuccess && data.data.project) {
                    onSuccess(data.data.project.id);
                }
                setOpen(false);
                resetState();
            }, 1000);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to generate presentation"
            );
            setProgress(0);
        } finally {
            setGenerating(false);
        }
    };

    const resetState = () => {
        setFile(null);
        setParsedData(null);
        setError(null);
        setProgress(0);
        setSheets([]);
        setSelectedSheet("");
        setTopic("");
        setGenerating(false);
        setAnalyzing(false);
        setUploading(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Import Data
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Import Excel/CSV Data
                    </DialogTitle>
                    <DialogDescription>
                        Upload your data file and we'll transform it into a beautiful
                        presentation with charts and insights.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* File Upload Area */}
                    {!file && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className={cn(
                                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                                "hover:border-primary hover:bg-accent/50",
                                uploading && "opacity-50 pointer-events-none"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => {
                                    const selectedFile = e.target.files?.[0];
                                    if (selectedFile) { handleFileSelect(selectedFile); }
                                }}
                                className="hidden"
                            />

                            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">
                                Drop your file here or click to browse
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Supports CSV, XLSX, and XLS files
                            </p>
                            <Badge variant="secondary">Max file size: 10MB</Badge>
                        </div>
                    )}

                    {/* File Selected */}
                    {file && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-8 w-8 text-primary" />
                                    <div>
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {(file.size / 1024).toFixed(2)} KB
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setFile(null);
                                        setParsedData(null);
                                        setSheets([]);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Sheet Selection (for Excel files) */}
                            {sheets.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Select Sheet</Label>
                                    <Select value={selectedSheet} onValueChange={handleSheetChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a sheet" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sheets.map((sheet) => (
                                                <SelectItem key={sheet} value={sheet}>
                                                    {sheet}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Analysis Results */}
                            {parsedData && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="border rounded-lg p-4">
                                            <p className="text-sm text-muted-foreground mb-1">Rows</p>
                                            <p className="text-2xl font-bold">
                                                {parsedData.metadata.totalRows}
                                            </p>
                                        </div>
                                        <div className="border rounded-lg p-4">
                                            <p className="text-sm text-muted-foreground mb-1">Columns</p>
                                            <p className="text-2xl font-bold">
                                                {parsedData.metadata.totalColumns}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Insights */}
                                    {parsedData.analysis.insights.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-2">Insights</h4>
                                            <div className="space-y-2">
                                                {parsedData.analysis.insights.map((insight) => (
                                                    <Alert key={`insight-${insight.type}-${insight.description.substring(0, 15).replace(/\s+/g, '')}`}>
                                                        <AlertCircle className="h-4 w-4" />
                                                        <AlertDescription>
                                                            {insight.description}
                                                        </AlertDescription>
                                                    </Alert>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Recommended Charts */}
                                    {parsedData.analysis.recommendedCharts.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                                                <BarChart3 className="h-4 w-4" />
                                                Recommended Charts
                                            </h4>
                                            <div className="space-y-2">
                                                {parsedData.analysis.recommendedCharts
                                                    .slice(0, 3)
                                                    .map((chart) => (
                                                        <div
                                                            key={`chart-${chart.type}-${chart.columns.join("-").replace(/\s+/g, '')}`}
                                                            className="p-3 border rounded-lg bg-accent/30"
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <Badge variant="secondary">{chart.type}</Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {chart.columns.join(" × ")}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm">{chart.reason}</p>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Import Options */}
                                    <div className="space-y-4 border-t pt-4">
                                        <h4 className="font-semibold">Presentation Options</h4>

                                        <div className="space-y-2">
                                            <Label htmlFor="topic">Presentation Topic (Optional)</Label>
                                            <Input
                                                id="topic"
                                                value={topic}
                                                onChange={(e) => setTopic(e.target.value)}
                                                placeholder={`Analysis: ${file.name}`}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="tone">Tone</Label>
                                                <Select value={tone} onValueChange={setTone}>
                                                    <SelectTrigger id="tone">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="professional">Professional</SelectItem>
                                                        <SelectItem value="casual">Casual</SelectItem>
                                                        <SelectItem value="formal">Formal</SelectItem>
                                                        <SelectItem value="creative">Creative</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="audience">Audience</Label>
                                                <Select value={audience} onValueChange={setAudience}>
                                                    <SelectTrigger id="audience">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="general">General</SelectItem>
                                                        <SelectItem value="executives">Executives</SelectItem>
                                                        <SelectItem value="technical">Technical Team</SelectItem>
                                                        <SelectItem value="students">Students</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="generateCharts"
                                                checked={generateCharts}
                                                onCheckedChange={(checked) =>
                                                    setGenerateCharts(checked as boolean)
                                                }
                                            />
                                            <Label htmlFor="generateCharts" className="cursor-pointer">
                                                Generate charts automatically
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Progress */}
                    {(analyzing || generating) && progress > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {analyzing ? "Analyzing data..." : "Generating presentation..."}
                                </span>
                                <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>

                        {!parsedData && file && !analyzing && (
                            <Button onClick={() => analyzeFile()} disabled={analyzing}>
                                {analyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Analyze File
                            </Button>
                        )}

                        {parsedData && (
                            <Button
                                onClick={generatePresentation}
                                disabled={generating}
                                className="gap-2"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Create Presentation
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
