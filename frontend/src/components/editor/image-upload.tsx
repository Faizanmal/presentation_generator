"use client";

import { useState, useRef, useCallback } from "react";
// import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    File
} from "lucide-react";
import {
    Upload,
    Image as ImageIcon,
    X,
    Loader2,
    CheckCircle,
    AlertCircle,
    Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ImageUploadProps {
    onUpload: (url: string, metadata?: ImageMetadata) => void;
    projectId: string;
    accept?: string;
    maxSize?: number; // in MB
}

interface ImageMetadata {
    width?: number;
    height?: number;
    alt?: string;
    name?: string;
}

interface UploadingFile {
    id: string;
    file: File;
    progress: number;
    status: "uploading" | "success" | "error";
    url?: string;
    error?: string;
}

export function ImageUploadZone({
    onUpload,
    projectId,
    accept = "image/*",
    maxSize = 10,
}: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const uploadFile = useCallback(async (file: File) => {
        const id = crypto.randomUUID();

        // Validate file size
        if (file.size > maxSize * 1024 * 1024) {
            toast.error(`File "${file.name}" is too large. Max size is ${maxSize}MB`);
            return;
        }

        setUploadingFiles((prev) => [
            ...prev,
            { id, file, progress: 0, status: "uploading" },
        ]);

        try {
            // Create form data
            const formData = new FormData();
            formData.append("file", file);
            formData.append("projectId", projectId);

            // Simulate progress (real implementation would use XMLHttpRequest with progress events)
            const progressInterval = setInterval(() => {
                setUploadingFiles((prev) =>
                    prev.map((f) =>
                        f.id === id && f.progress < 90
                            ? { ...f, progress: f.progress + 10 }
                            : f
                    )
                );
            }, 100);

            // Upload
            const response = await api.uploadAsset(formData);

            clearInterval(progressInterval);

            // Get image dimensions if it's an image
            let metadata: ImageMetadata = { name: file.name };
            if (file.type.startsWith("image/")) {
                const dimensions = await getImageDimensions(file);
                metadata = { ...metadata, ...dimensions };
            }

            setUploadingFiles((prev) =>
                prev.map((f) =>
                    f.id === id
                        ? { ...f, progress: 100, status: "success", url: response.url }
                        : f
                )
            );

            onUpload(response.url, metadata);
            toast.success(`"${file.name}" uploaded successfully`);

            // Remove from list after delay
            setTimeout(() => {
                setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
            }, 2000);
        } catch (error) {
            console.error(error)
            setUploadingFiles((prev) =>
                prev.map((f) =>
                    f.id === id ? { ...f, status: "error", error: "Upload failed" } : f
                )
            );
            toast.error(`Failed to upload "${file.name}"`);
        }
    }, [maxSize, projectId, onUpload]);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const files = Array.from(e.dataTransfer.files);
            files.forEach(uploadFile);
        },
        [uploadFile]
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach(uploadFile);
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveFile = (id: string) => {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                    isDragging
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        : "border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                />

                <div className="flex flex-col items-center gap-3">
                    <div
                        className={cn(
                            "p-4 rounded-full transition-colors",
                            isDragging
                                ? "bg-blue-100 dark:bg-blue-900/50"
                                : "bg-slate-100 dark:bg-slate-800"
                        )}
                    >
                        <Upload
                            className={cn(
                                "h-8 w-8",
                                isDragging ? "text-blue-600" : "text-slate-400"
                            )}
                        />
                    </div>
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                            {isDragging ? "Drop files here" : "Drag & drop images here"}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            or click to browse • Max {maxSize}MB per file
                        </p>
                    </div>
                </div>
            </div>

            {/* Upload Progress */}
            {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                    {uploadingFiles.map((file) => (
                        <div
                            key={file.id}
                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                            <div className="h-10 w-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                {file.status === "uploading" ? (
                                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                ) : file.status === "success" ? (
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {file.file.name}
                                </p>
                                {file.status === "uploading" && (
                                    <Progress value={file.progress} className="h-1 mt-1" />
                                )}
                                {file.status === "error" && (
                                    <p className="text-xs text-red-600 mt-0.5">{file.error}</p>
                                )}
                            </div>

                            <button
                                onClick={() => handleRemoveFile(file.id)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                            >
                                <X className="h-4 w-4 text-slate-400" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Helper to get image dimensions
function getImageDimensions(
    file: File
): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = URL.createObjectURL(file);
    });
}

// Image Insert Dialog with multiple sources
interface ImageInsertDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (url: string, metadata?: ImageMetadata) => void;
    projectId: string;
}

export function ImageInsertDialog({
    open,
    onOpenChange,
    onInsert,
    projectId,
}: ImageInsertDialogProps) {
    const [urlInput, setUrlInput] = useState("");
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);

    const handleUrlInsert = async () => {
        if (!urlInput.trim()) {
            toast.error("Please enter an image URL");
            return;
        }

        setIsLoadingUrl(true);
        try {
            // Validate URL is an image
            const response = await fetch(urlInput, { method: "HEAD" });
            const contentType = response.headers.get("content-type");

            if (!contentType?.startsWith("image/")) {
                toast.error("URL does not point to a valid image");
                return;
            }

            onInsert(urlInput);
            setUrlInput("");
            onOpenChange(false);
        } catch {
            toast.error("Failed to load image from URL");
        } finally {
            setIsLoadingUrl(false);
        }
    };

    const handleUpload = (url: string, metadata?: ImageMetadata) => {
        onInsert(url, metadata);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        Insert Image
                    </DialogTitle>
                    <DialogDescription>
                        Upload an image or paste a URL
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="upload" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload" className="gap-2">
                            <Upload className="h-4 w-4" />
                            Upload
                        </TabsTrigger>
                        <TabsTrigger value="url" className="gap-2">
                            <LinkIcon className="h-4 w-4" />
                            From URL
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="mt-4">
                        <ImageUploadZone
                            projectId={projectId}
                            onUpload={handleUpload}
                            accept="image/*"
                            maxSize={10}
                        />
                    </TabsContent>

                    <TabsContent value="url" className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Image URL</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://example.com/image.jpg"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleUrlInsert()}
                                />
                                <Button onClick={handleUrlInsert} disabled={isLoadingUrl}>
                                    {isLoadingUrl ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Insert"
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Paste the URL of any image on the web
                            </p>
                        </div>

                        {/* URL Preview */}
                        {urlInput && (
                            <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                                <Image
                                    src={urlInput}
                                    alt="Preview"
                                    className="max-w-full max-h-full object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// Paste handler for clipboard images
export function usePasteImage(
    onPaste: (file: File) => void
) {
    const handlePaste = useCallback(
        (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) { return; }

            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        onPaste(file);
                        return;
                    }
                }
            }
        },
        [onPaste]
    );

    return { handlePaste };
}
