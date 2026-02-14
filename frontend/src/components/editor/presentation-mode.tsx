"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Play,
    Pause,
    ChevronLeft,
    ChevronRight,
    Maximize,
    Minimize,
    Grid3X3,
    Crosshair,
    Pencil,
    Highlighter,
    Eraser,
    MousePointer2,
    MessageSquare,
    Timer,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
// import { Slider } from "@/components/ui/slider";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
// import {
//     Dialog,
//     DialogContent,
//     DialogDescription,
//     DialogHeader,
//     DialogTitle,
// } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Slide {
    id: string;
    order: number;
    title?: string;
    speakerNotes?: string;
    content?: Record<string, unknown>;
}

interface PresentationModeProps {
    slides: Slide[];
    startSlide?: number;
    onExit: () => void;
    onSlideChange?: (index: number) => void;
}

export function PresentationMode({
    slides,
    startSlide = 0,
    onExit,
    onSlideChange,
}: PresentationModeProps) {
    const [currentSlide, setCurrentSlide] = useState(startSlide);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showNotes, setShowNotes] = useState(false);
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [autoPlayInterval,] = useState(5000); // 5 seconds
    const [elapsedTime, setElapsedTime] = useState(0);
    const [pointerMode, setPointerMode] = useState<"pointer" | "laser" | "pen" | "highlighter">("pointer");

    interface Drawing {
        path: { x: number; y: number }[];
        color: string;
        width: number;
        mode: "pen" | "highlighter" | "laser";
    }
    const [drawings, setDrawings] = useState<Map<number, Drawing[]>>(new Map());

    const containerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

    const goToSlide = useCallback((index: number) => {
        const newIndex = Math.max(0, Math.min(index, slides.length - 1));
        setCurrentSlide(newIndex);
        onSlideChange?.(newIndex);
    }, [slides.length, onSlideChange]);

    const goToNextSlide = useCallback(() => {
        if (currentSlide < slides.length - 1) {
            goToSlide(currentSlide + 1);
        } else if (isPlaying) {
            setIsPlaying(false); // Stop at end
        }
    }, [currentSlide, slides.length, isPlaying, goToSlide]);

    const goToPrevSlide = useCallback(() => {
        goToSlide(currentSlide - 1);
    }, [currentSlide, goToSlide]);

    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await containerRef.current?.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error("Fullscreen error:", err);
        }
    }, []);

    // Start presentation timer
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setElapsedTime((prev) => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) {clearInterval(timerRef.current);}
        };
    }, []);

    // Auto-play slides
    useEffect(() => {
        if (isPlaying) {
            autoPlayRef.current = setInterval(() => {
                goToNextSlide();
            }, autoPlayInterval);
        } else if (autoPlayRef.current) {
            clearInterval(autoPlayRef.current);
        }

        return () => {
            if (autoPlayRef.current) {clearInterval(autoPlayRef.current);}
        };
    }, [isPlaying, autoPlayInterval, goToNextSlide]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowRight":
                case " ":
                case "PageDown":
                    e.preventDefault();
                    goToNextSlide();
                    break;
                case "ArrowLeft":
                case "PageUp":
                    e.preventDefault();
                    goToPrevSlide();
                    break;
                case "Home":
                    e.preventDefault();
                    goToSlide(0);
                    break;
                case "End":
                    e.preventDefault();
                    goToSlide(slides.length - 1);
                    break;
                case "Escape":
                    onExit();
                    break;
                case "f":
                case "F":
                    toggleFullscreen();
                    break;
                case "n":
                case "N":
                    setShowNotes(!showNotes);
                    break;
                case "g":
                case "G":
                    setShowThumbnails(!showThumbnails);
                    break;
                case "b":
                case "B":
                    // Blank screen toggle (could implement)
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showNotes, showThumbnails, goToNextSlide, goToPrevSlide, goToSlide, onExit, toggleFullscreen, slides.length]);

    // Hide controls after inactivity
    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true);

            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }

            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            if (controlsTimeoutRef.current) {clearTimeout(controlsTimeoutRef.current);}
        };
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const slide = slides[currentSlide];

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black z-50 flex flex-col"
            onClick={() => goToNextSlide()}
        >
            {/* Main Slide Area */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                {/* Slide Content */}
                <div
                    className="w-full h-full max-w-[1920px] max-h-[1080px] bg-white shadow-2xl relative"
                    style={{ aspectRatio: "16/9" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Render slide content here */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-12">
                            <h1 className="text-5xl font-bold text-slate-900 mb-4">
                                {slide?.title || `Slide ${currentSlide + 1}`}
                            </h1>
                            {/* Slide content would be rendered here */}
                        </div>
                    </div>

                    {/* Drawing overlay */}
                    {pointerMode !== "pointer" && (
                        <DrawingCanvas
                            mode={pointerMode}
                            drawings={drawings.get(currentSlide) || []}
                            onDraw={(newDrawing) => {
                                const slideDrawings = drawings.get(currentSlide) || [];
                                setDrawings(new Map(drawings.set(currentSlide, [...slideDrawings, newDrawing])));
                            }}
                        />
                    )}
                </div>

                {/* Laser pointer effect */}
                {pointerMode === "laser" && <LaserPointer />}
            </div>

            {/* Bottom Controls */}
            <div
                className={cn(
                    "absolute bottom-0 left-0 right-0 transition-transform duration-300",
                    showControls ? "translate-y-0" : "translate-y-full"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress bar */}
                <div className="h-1 bg-white/20">
                    <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
                    />
                </div>

                <div className="bg-black/80 backdrop-blur-sm px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left: Navigation */}
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10"
                                            onClick={goToPrevSlide}
                                            disabled={currentSlide === 0}
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Previous (←)</TooltipContent>
                                </Tooltip>

                                <span className="text-white text-sm font-medium min-w-[80px] text-center">
                                    {currentSlide + 1} / {slides.length}
                                </span>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10"
                                            onClick={goToNextSlide}
                                            disabled={currentSlide === slides.length - 1}
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Next (→)</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {/* Center: Pointer tools */}
                        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                            {[
                                { mode: "pointer", icon: MousePointer2, label: "Pointer" },
                                { mode: "laser", icon: Crosshair, label: "Laser" },
                                { mode: "pen", icon: Pencil, label: "Pen" },
                                { mode: "highlighter", icon: Highlighter, label: "Highlighter" },
                            ].map(({ mode, icon: Icon, label }) => (
                                <TooltipProvider key={mode}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={pointerMode === mode ? "secondary" : "ghost"}
                                                size="icon"
                                                className={cn(
                                                    "h-8 w-8",
                                                    pointerMode === mode
                                                        ? "bg-white/20"
                                                        : "text-white hover:bg-white/10"
                                                )}
                                                onClick={() => setPointerMode(mode as "pointer" | "laser" | "pen" | "highlighter")}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{label}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}

                            {pointerMode !== "pointer" && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-white hover:bg-white/10"
                                                onClick={() => {
                                                    setDrawings(new Map(drawings.set(currentSlide, [])));
                                                }}
                                            >
                                                <Eraser className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Clear</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>

                        {/* Right: Controls */}
                        <div className="flex items-center gap-2">
                            {/* Timer */}
                            <div className="flex items-center gap-2 text-white/60 text-sm">
                                <Timer className="h-4 w-4" />
                                {formatTime(elapsedTime)}
                            </div>

                            <div className="h-4 w-px bg-white/20" />

                            <TooltipProvider>
                                {/* Auto-play */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "text-white hover:bg-white/10",
                                                isPlaying && "bg-white/20"
                                            )}
                                            onClick={() => setIsPlaying(!isPlaying)}
                                        >
                                            {isPlaying ? (
                                                <Pause className="h-4 w-4" />
                                            ) : (
                                                <Play className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {isPlaying ? "Pause" : "Auto-play"}
                                    </TooltipContent>
                                </Tooltip>

                                {/* Speaker notes */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "text-white hover:bg-white/10",
                                                showNotes && "bg-white/20"
                                            )}
                                            onClick={() => setShowNotes(!showNotes)}
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Notes (N)</TooltipContent>
                                </Tooltip>

                                {/* Slide grid */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "text-white hover:bg-white/10",
                                                showThumbnails && "bg-white/20"
                                            )}
                                            onClick={() => setShowThumbnails(!showThumbnails)}
                                        >
                                            <Grid3X3 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>All slides (G)</TooltipContent>
                                </Tooltip>

                                {/* Fullscreen */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10"
                                            onClick={toggleFullscreen}
                                        >
                                            {isFullscreen ? (
                                                <Minimize className="h-4 w-4" />
                                            ) : (
                                                <Maximize className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                                    </TooltipContent>
                                </Tooltip>

                                {/* Exit */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white hover:bg-white/10"
                                            onClick={onExit}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Exit (Esc)</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </div>
            </div>

            {/* Speaker Notes Panel */}
            {showNotes && (
                <div
                    className="absolute bottom-20 right-4 w-80 bg-black/90 rounded-lg p-4 text-white"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Speaker Notes
                    </h4>
                    <ScrollArea className="h-32">
                        <p className="text-sm text-white/80 whitespace-pre-wrap">
                            {slide?.speakerNotes || "No notes for this slide"}
                        </p>
                    </ScrollArea>
                </div>
            )}

            {/* Thumbnail Grid */}
            {showThumbnails && (
                <div
                    className="absolute inset-0 bg-black/95 z-10 p-8"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowThumbnails(false);
                    }}
                >
                    <div className="grid grid-cols-4 gap-4 max-w-5xl mx-auto">
                        {slides.map((s, i) => (
                            <button
                                key={s.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goToSlide(i);
                                    setShowThumbnails(false);
                                }}
                                className={cn(
                                    "aspect-video bg-white rounded-lg p-4 text-left hover:ring-2 hover:ring-blue-500 transition-all",
                                    i === currentSlide && "ring-2 ring-blue-500"
                                )}
                            >
                                <span className="text-xs text-slate-500 font-medium">
                                    {i + 1}
                                </span>
                                <p className="text-sm font-medium truncate mt-1">
                                    {s.title || `Slide ${i + 1}`}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Laser pointer effect
function LaserPointer() {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
            setVisible(true);
        };

        const handleMouseLeave = () => setVisible(false);

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, []);

    if (!visible) {return null;}

    return (
        <div
            className="fixed pointer-events-none z-50"
            style={{
                left: position.x - 8,
                top: position.y - 8,
            }}
        >
            <div className="w-4 h-4 rounded-full bg-red-500 opacity-80 animate-pulse shadow-lg shadow-red-500/50" />
        </div>
    );
}

interface Drawing {
    path: { x: number; y: number }[];
    color: string;
    width: number;
    mode: "pen" | "highlighter" | "laser";
}

// Drawing canvas for annotations
function DrawingCanvas({
    mode,
    drawings,
    onDraw,
}: {
    mode: "pen" | "highlighter" | "laser";
    drawings: Drawing[];
    onDraw: (drawing: Drawing) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {return;}

        const ctx = canvas.getContext("2d");
        if (!ctx) {return;}

        // Clear and redraw all drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const drawing of drawings) {
            ctx.beginPath();
            ctx.strokeStyle = drawing.color;
            ctx.lineWidth = drawing.width;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            if (drawing.mode === "highlighter") {
                ctx.globalAlpha = 0.3;
            }

            for (let i = 0; i < drawing.path.length; i++) {
                const point = drawing.path[i];
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }

            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }, [drawings]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDrawing(true);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setCurrentPath([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing) {return;}
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setCurrentPath((prev) => [
                ...prev,
                { x: e.clientX - rect.left, y: e.clientY - rect.top },
            ]);
        }
    };

    const handleMouseUp = () => {
        if (isDrawing && currentPath.length > 0) {
            onDraw({
                path: currentPath,
                color: mode === "pen" ? "#EF4444" : "#FBBF24",
                width: mode === "pen" ? 3 : 20,
                mode,
            });
        }
        setIsDrawing(false);
        setCurrentPath([]);
    };

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 cursor-crosshair"
            width={1920}
            height={1080}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
    );
}

// Presenter View (separate window/screen)
export function PresenterView({
    slides,
    currentSlide,
    elapsedTime,
    onSlideChange,
}: {
    slides: Slide[];
    currentSlide: number;
    elapsedTime: number;
    onSlideChange: (index: number) => void;
}) {
    const slide = slides[currentSlide];
    const nextSlide = slides[currentSlide + 1];

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="h-screen bg-slate-900 text-white flex flex-col p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">
                        Slide {currentSlide + 1} of {slides.length}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-2xl">
                    <Timer className="h-6 w-6" />
                    {formatTime(elapsedTime)}
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 grid grid-cols-2 gap-6">
                {/* Current slide */}
                <div className="space-y-3">
                    <h3 className="font-medium text-lg text-slate-400">Current Slide</h3>
                    <div className="aspect-video bg-white rounded-lg shadow-xl" />
                </div>

                {/* Next slide */}
                <div className="space-y-3">
                    <h3 className="font-medium text-lg text-slate-400">Next Slide</h3>
                    {nextSlide ? (
                        <div className="aspect-video bg-white/80 rounded-lg shadow-xl" />
                    ) : (
                        <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                            End of presentation
                        </div>
                    )}
                </div>
            </div>

            {/* Speaker notes */}
            <div className="mt-6 p-4 bg-slate-800 rounded-lg">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Speaker Notes
                </h3>
                <ScrollArea className="h-32">
                    <p className="text-slate-300 whitespace-pre-wrap">
                        {slide?.speakerNotes || "No notes for this slide"}
                    </p>
                </ScrollArea>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex justify-center gap-4">
                <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onSlideChange(currentSlide - 1)}
                    disabled={currentSlide === 0}
                >
                    <ChevronLeft className="h-5 w-5 mr-2" />
                    Previous
                </Button>
                <Button
                    size="lg"
                    onClick={() => onSlideChange(currentSlide + 1)}
                    disabled={currentSlide === slides.length - 1}
                >
                    Next
                    <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
            </div>
        </div>
    );
}
