"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
    id: number;
    x: number;
    y: number;
    rotation: number;
    color: string;
    size: number;
    shape: "square" | "circle" | "triangle";
    delay: number;
    transitionDuration: number;
}

interface ConfettiProps {
    isActive: boolean;
    duration?: number;
    pieceCount?: number;
    colors?: string[];
    onComplete?: () => void;
}

const defaultColors = [
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // emerald
    "#06b6d4", // cyan
    "#f43f5e", // rose
];

export function Confetti({
    isActive,
    duration = 3000,
    pieceCount = 150,
    colors = defaultColors,
    onComplete,
}: ConfettiProps) {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

    const [prevActive, setPrevActive] = useState(isActive);

    if (isActive !== prevActive) {
        setPrevActive(isActive);
        if (!isActive && pieces.length > 0) {
            setPieces([]);
        }
    }

    useEffect(() => {
        if (!isActive) {
            return;
        }

        if (pieces.length === 0) {
            const newPieces: ConfettiPiece[] = Array.from({ length: pieceCount }, (_, i) => ({
                id: Date.now() + i,
                x: Math.random() * 100,
                y: -10 - Math.random() * 20,
                rotation: Math.random() * 360,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 8 + Math.random() * 8,
                shape: ["square", "circle", "triangle"][
                    Math.floor(Math.random() * 3)
                ] as ConfettiPiece["shape"],
                delay: Math.random() * 0.5,
                transitionDuration: 2 + Math.random(),
            }));

            // Use animation frame or timeout to avoid synchronous setState in effect
            const piecesTimer = setTimeout(() => {
                setPieces(newPieces);
            }, 0);

            const timer = setTimeout(() => {
                setPieces([]);
                onComplete?.();
            }, duration);

            return () => {
                clearTimeout(piecesTimer);
                clearTimeout(timer);
            };
        }
    }, [isActive, pieceCount, colors, duration, onComplete, pieces.length]);

    if (!isActive || pieces.length === 0) { return null; }

    return (
        <div className="fixed inset-0 pointer-events-none z-200 overflow-hidden">
            {pieces.map((piece) => (
                <motion.div
                    key={piece.id}
                    initial={{
                        left: `${piece.x}%`,
                        top: `${piece.y}%`,
                        rotate: piece.rotation,
                        opacity: 1,
                    }}
                    animate={{
                        top: "110%",
                        rotate: piece.rotation + 720,
                        opacity: [1, 1, 0],
                    }}
                    transition={{
                        duration: piece.transitionDuration,
                        delay: piece.delay,
                        ease: [0.37, 0, 0.63, 1],
                    }}
                    className="absolute"
                    style={{
                        width: piece.size,
                        height: piece.size,
                        backgroundColor:
                            piece.shape !== "triangle" ? piece.color : "transparent",
                        borderRadius: piece.shape === "circle" ? "50%" : "0",
                        borderLeft:
                            piece.shape === "triangle"
                                ? `${piece.size / 2}px solid transparent`
                                : undefined,
                        borderRight:
                            piece.shape === "triangle"
                                ? `${piece.size / 2}px solid transparent`
                                : undefined,
                        borderBottom:
                            piece.shape === "triangle"
                                ? `${piece.size}px solid ${piece.color}`
                                : undefined,
                    }}
                />
            ))}
        </div>
    );
}

// Hook to trigger confetti
export function useConfetti() {
    const [isActive, setIsActive] = useState(false);

    const trigger = useCallback(() => {
        setIsActive(true);
    }, []);

    const reset = useCallback(() => {
        setIsActive(false);
    }, []);

    return { isActive, trigger, reset };
}

// Celebration modal
interface CelebrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    emoji?: string;
    primaryAction?: {
        label: string;
        onClick: () => void;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
}

export function CelebrationModal({
    isOpen,
    onClose,
    title,
    description,
    emoji = "🎉",
    primaryAction,
    secondaryAction,
}: CelebrationModalProps) {
    return (
        <>
            <Confetti isActive={isOpen} />
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-150"
                            onClick={onClose}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-151 w-full max-w-md"
                        >
                            <div className="mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
                                {/* Header with gradient */}
                                <div className="h-32 bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            rotate: [0, 10, -10, 0],
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            repeat: 2,
                                        }}
                                        className="text-6xl"
                                    >
                                        {emoji}
                                    </motion.div>
                                </div>

                                {/* Content */}
                                <div className="p-6 text-center">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                        {title}
                                    </h2>
                                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                                        {description}
                                    </p>

                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        {primaryAction && (
                                            <button
                                                onClick={primaryAction.onClick}
                                                className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                                            >
                                                {primaryAction.label}
                                            </button>
                                        )}
                                        {secondaryAction && (
                                            <button
                                                onClick={secondaryAction.onClick}
                                                className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                            >
                                                {secondaryAction.label}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

// Achievement badge component
interface AchievementBadgeProps {
    name: string;
    description: string;
    icon: string;
    unlocked?: boolean;
    unlockedAt?: Date;
    progress?: number;
    total?: number;
    onClick?: () => void;
}

export function AchievementBadge({
    name,
    description,
    icon,
    unlocked = false,
    unlockedAt,
    progress,
    total,
    onClick,
}: AchievementBadgeProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`relative p-4 rounded-xl border text-left transition-all ${unlocked
                ? "bg-linear-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800"
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 grayscale"
                }`}
        >
            <div className="flex items-start gap-3">
                <div
                    className={`text-3xl ${unlocked ? "" : "opacity-50"
                        }`}
                >
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h3
                        className={`font-semibold ${unlocked
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-500 dark:text-slate-400"
                            }`}
                    >
                        {name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {description}
                    </p>

                    {/* Progress bar */}
                    {!unlocked && progress !== undefined && total !== undefined && (
                        <div className="mt-2">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Progress</span>
                                <span>
                                    {progress}/{total}
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${(progress / total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Unlocked date */}
                    {unlocked && unlockedAt && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                            Unlocked {unlockedAt.toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>

            {/* Unlocked badge */}
            {unlocked && (
                <div className="absolute -top-2 -right-2 h-6 w-6 bg-linear-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-xs">✓</span>
                </div>
            )}
        </motion.button>
    );
}

// Points animation
export function PointsAnimation({
    points,
    position = { x: 50, y: 50 },
}: {
    points: number;
    position?: { x: number; y: number };
}) {
    return (
        <motion.div
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -50, scale: 1.2 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="fixed pointer-events-none z-200 font-bold text-2xl text-yellow-500"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
        >
            +{points}
        </motion.div>
    );
}
