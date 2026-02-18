'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
    FileSpreadsheet, ArrowLeft, Loader2, Upload, Table, BarChart3,
    Sparkles, FileText, ChevronRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDataImport } from '@/hooks/use-new-features';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DataImportPage() {
    const router = useRouter();
    const { upload, generatePresentation, previewSheets, analyzeData } = useDataImport();
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<{
        metadata: Record<string, unknown>;
        analysis: Record<string, unknown>;
        preview: { headers: string[]; sampleRows: unknown[][] };
    } | null>(null);
    const [sheets, setSheets] = useState<Array<{ name: string; rowCount: number }> | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<string | undefined>(undefined);
    const [step, setStep] = useState<'upload' | 'preview' | 'generate'>('upload');

    const handleFile = useCallback(async (f: File) => {
        setFile(f);
        const formData = new FormData();
        formData.append('file', f);

        const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');

        // If Excel, preview sheets first
        if (isExcel) {
            try {
                const result = await previewSheets.mutateAsync(formData);
                setSheets(result.data.sheets);
                if (result.data.sheets.length === 1) {
                    setSelectedSheet(result.data.sheets[0].name);
                }
            } catch {
                toast.error('Failed to read Excel sheets');
            }
        }

        // Analyze the file
        try {
            const analyzeForm = new FormData();
            analyzeForm.append('file', f);
            const result = await analyzeData.mutateAsync({ formData: analyzeForm, sheetName: selectedSheet });
            setAnalysisResult(result.data as typeof analysisResult);
            setStep('preview');
        } catch {
            toast.error('Failed to analyse data file');
        }
    }, [previewSheets, analyzeData, selectedSheet]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const handleGenerate = async () => {
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (selectedSheet) formData.append('sheetName', selectedSheet);
            const result = await generatePresentation.mutateAsync(formData);
            toast.success('Presentation generated from data!');
            const project = result.data.project as { id?: string };
            if (project?.id) {
                router.push(`/editor/${project.id}`);
            }
        } catch {
            toast.error('Failed to generate presentation');
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-5xl mx-auto p-6 space-y-8">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                            Data Import
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Upload CSV or Excel data and generate a presentation automatically
                        </p>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 text-sm">
                    {['Upload', 'Preview', 'Generate'].map((label, i) => {
                        const stepNames = ['upload', 'preview', 'generate'] as const;
                        const current = stepNames.indexOf(step);
                        const pastOrCurrent = i <= current;
                        return (
                            <div key={label} className="flex items-center gap-2">
                                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                                <div className={`flex items-center gap-1.5 ${pastOrCurrent ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                                    <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${i < current ? 'bg-primary text-primary-foreground' : i === current ? 'border-2 border-primary text-primary' : 'border border-muted-foreground/30 text-muted-foreground'}`}>
                                        {i < current ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                                    </div>
                                    {label}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Step 1 – Upload */}
                {step === 'upload' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload Data File</CardTitle>
                            <CardDescription>Drag and drop or browse for a CSV or Excel file</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/40'
                                    }`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = '.csv,.xlsx,.xls';
                                    input.onchange = (e) => {
                                        const f = (e.target as HTMLInputElement).files?.[0];
                                        if (f) handleFile(f);
                                    };
                                    input.click();
                                }}
                            >
                                <Upload className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                                <p className="font-medium mb-1">Drop your file here or click to browse</p>
                                <p className="text-sm text-muted-foreground">
                                    Supports CSV (.csv) and Excel (.xlsx, .xls) files
                                </p>
                            </div>
                            {(previewSheets.isPending || analyzeData.isPending) && (
                                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analysing your data...
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Step 2 – Preview */}
                {step === 'preview' && analysisResult && (
                    <div className="space-y-6">
                        {/* Sheet selector (if Excel with multiple sheets) */}
                        {sheets && sheets.length > 1 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Select Sheet</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-wrap gap-2">
                                    {sheets.map((s) => (
                                        <Button
                                            key={s.name}
                                            variant={selectedSheet === s.name ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setSelectedSheet(s.name)}
                                        >
                                            <Table className="w-3 h-3 mr-1" />
                                            {s.name}
                                            <Badge variant="secondary" className="ml-2 text-[10px]">{s.rowCount} rows</Badge>
                                        </Button>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* File info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    {file?.name}
                                </CardTitle>
                                <CardDescription>
                                    {analysisResult.preview.headers.length} columns &bull; preview of first 5 rows
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-muted/50">
                                                {analysisResult.preview.headers.map((h) => (
                                                    <th key={h} className="px-3 py-2 text-left font-medium text-xs text-muted-foreground whitespace-nowrap">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {analysisResult.preview.sampleRows.map((row, ri) => (
                                                <tr key={ri} className="border-t">
                                                    {(row as unknown[]).map((cell, ci) => (
                                                        <td key={ci} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                                                            {String(cell ?? '')}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setAnalysisResult(null); setSheets(null); }}>
                                Upload Different File
                            </Button>
                            <Button onClick={() => setStep('generate')} className="flex-1">
                                <Sparkles className="w-4 h-4 mr-2" />
                                Generate Presentation from Data
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3 – Generate */}
                {step === 'generate' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-primary" />
                                Generate Presentation
                            </CardTitle>
                            <CardDescription>
                                AI will analyse your data and create charts, insights, and slides automatically.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
                                <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{file?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {analysisResult?.preview.headers.length} columns
                                        {selectedSheet ? ` • Sheet: ${selectedSheet}` : ''}
                                    </p>
                                </div>
                            </div>

                            <Button
                                className="w-full"
                                size="lg"
                                onClick={handleGenerate}
                                disabled={generatePresentation.isPending}
                            >
                                {generatePresentation.isPending ? (
                                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                                ) : (
                                    <><BarChart3 className="w-4 h-4 mr-2" /> Create Presentation</>
                                )}
                            </Button>

                            <Button variant="ghost" className="w-full" onClick={() => setStep('preview')}>
                                Back to Preview
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
