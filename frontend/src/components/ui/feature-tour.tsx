"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "./button";
import { createPortal } from "react-dom";

export interface TourStep {
    target: string; // CSS selector for the target element
    title: string;
    content: string;
    placement?: "top" | "bottom" | "left" | "right";
    spotlightPadding?: number;
}

interface FeatureTourProps {
    steps: TourStep[];
    isOpen: boolean;
    onComplete: () => void;
    onSkip?: () => void;
}

export function FeatureTour({
    steps,
    isOpen,
    onComplete,
    onSkip,
}: FeatureTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    // Update target element position
    useEffect(() => {
        if (!isOpen || !steps[currentStep]) { return; }

        const updatePosition = () => {
            const target = document.querySelector(steps[currentStep].target);
            if (target) {
                setTargetRect(target.getBoundingClientRect());
            }
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition);
        };
    }, [isOpen, currentStep, steps]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
            setCurrentStep(0);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSkip = () => {
        onSkip?.();
        setCurrentStep(0);
    };

    if (!mounted || !isOpen) { return null; }

    const step = steps[currentStep];
    const padding = step?.spotlightPadding ?? 8;

    // Calculate tooltip position
    const getTooltipPosition = () => {
        if (!targetRect) { return { top: "50%", left: "50%" }; }

        const placement = step?.placement ?? "bottom";
        const tooltipWidth = 320;
        const tooltipHeight = 180;
        const offset = 16;

        switch (placement) {
            case "top":
                return {
                    top: targetRect.top - tooltipHeight - offset,
                    left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
                };
            case "bottom":
                return {
                    top: targetRect.bottom + offset,
                    left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
                };
            case "left":
                return {
                    top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
                    left: targetRect.left - tooltipWidth - offset,
                };
            case "right":
                return {
                    top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
                    left: targetRect.right + offset,
                };
            default:
                return {
                    top: targetRect.bottom + offset,
                    left: targetRect.left,
                };
        }
    };

    const tooltipPosition = getTooltipPosition();

    return createPortal(
        <div className="fixed inset-0 z-[9999]">
            {/* Backdrop with spotlight cutout */}
            <div className="absolute inset-0">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <mask id="spotlight-mask">
                            <rect width="100%" height="100%" fill="white" />
                            {targetRect && (
                                <rect
                                    x={targetRect.left - padding}
                                    y={targetRect.top - padding}
                                    width={targetRect.width + padding * 2}
                                    height={targetRect.height + padding * 2}
                                    rx="8"
                                    fill="black"
                                />
                            )}
                        </mask>
                    </defs>
                    <rect
                        width="100%"
                        height="100%"
                        fill="rgba(0, 0, 0, 0.75)"
                        mask="url(#spotlight-mask)"
                    />
                </svg>
            </div>

            {/* Spotlight ring */}
            {targetRect && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute pointer-events-none"
                    style={{
                        top: targetRect.top - padding,
                        left: targetRect.left - padding,
                        width: targetRect.width + padding * 2,
                        height: targetRect.height + padding * 2,
                    }}
                >
                    <div className="absolute inset-0 rounded-lg ring-2 ring-blue-500 ring-offset-2" />
                    <motion.div
                        animate={{
                            boxShadow: [
                                "0 0 0 0 rgba(59, 130, 246, 0.4)",
                                "0 0 0 8px rgba(59, 130, 246, 0)",
                            ],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-lg"
                    />
                </motion.div>
            )}

            {/* Tooltip */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                    style={{
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                        maxWidth: "calc(100vw - 32px)",
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            <span className="font-medium">Feature Tour</span>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            {step?.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {step?.content}
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1">
                            {steps.map((step, index) => (
                                <div
                                    key={`tour-dot-${index}-${step.title.substring(0, 10)}`}
                                    className={`h-2 w-2 rounded-full transition-colors ${index === currentStep
                                        ? "bg-blue-500"
                                        : "bg-slate-300 dark:bg-slate-600"
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePrev}
                                disabled={currentStep === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleNext}
                                className="bg-blue-500 hover:bg-blue-600"
                            >
                                {currentStep === steps.length - 1 ? "Finish" : "Next"}
                                {currentStep < steps.length - 1 && (
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>,
        document.body
    );
}

// Hook to manage feature tour
export function useFeatureTour(tourId: string) {
    const [isOpen, setIsOpen] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(true);

    useEffect(() => {
        const completed = localStorage.getItem(`tour_${tourId}_completed`);
        if (!completed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHasCompleted(false);
        }
    }, [tourId]);

    const startTour = useCallback(() => {
        setIsOpen(true);
    }, []);

    const completeTour = useCallback(() => {
        localStorage.setItem(`tour_${tourId}_completed`, "true");
        setIsOpen(false);
        setHasCompleted(true);
    }, [tourId]);

    const skipTour = useCallback(() => {
        localStorage.setItem(`tour_${tourId}_completed`, "true");
        setIsOpen(false);
        setHasCompleted(true);
    }, [tourId]);

    const resetTour = useCallback(() => {
        localStorage.removeItem(`tour_${tourId}_completed`);
        setHasCompleted(false);
    }, [tourId]);

    return {
        isOpen,
        hasCompleted,
        startTour,
        completeTour,
        skipTour,
        resetTour,
    };
}

// Pre-defined tour steps for common features
export const dashboardTourSteps: TourStep[] = [
    {
        target: "[data-tour='create-button']",
        title: "Create New Presentation",
        content: "Click here to create a new presentation from scratch or use AI to generate one for you.",
        placement: "bottom",
    },
    {
        target: "[data-tour='search-input']",
        title: "Search Your Work",
        content: "Quickly find any presentation by typing its name here.",
        placement: "bottom",
    },
    {
        target: "[data-tour='view-toggle']",
        title: "Switch Views",
        content: "Toggle between grid and list views to organize your presentations how you like.",
        placement: "bottom",
    },
    {
        target: "[data-tour='user-menu']",
        title: "Account Settings",
        content: "Access your profile, billing, and settings from this menu.",
        placement: "left",
    },
];

export const editorTourSteps: TourStep[] = [
    {
        target: "[data-tour='slide-panel']",
        title: "Slide Navigation",
        content: "View and reorder all your slides here. Drag to rearrange or click to select.",
        placement: "right",
    },
    {
        target: "[data-tour='toolbar']",
        title: "Editing Toolbar",
        content: "Use these tools to format text, add images, and style your content.",
        placement: "bottom",
    },
    {
        target: "[data-tour='ai-tools']",
        title: "AI Features",
        content: "Access powerful AI tools to generate content, improve text, or suggest improvements.",
        placement: "left",
    },
    {
        target: "[data-tour='theme-selector']",
        title: "Themes",
        content: "Choose from beautiful themes to instantly change the look of your presentation.",
        placement: "left",
    },
    {
        target: "[data-tour='export-button']",
        title: "Export & Share",
        content: "Export your presentation as PDF, PPTX, or share it with a link.",
        placement: "bottom",
    },
];
