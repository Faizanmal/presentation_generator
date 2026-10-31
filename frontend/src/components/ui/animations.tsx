"use client";

import { useEffect, useState } from "react";
import type { Variants } from "framer-motion";
import { motion } from "framer-motion";

// Fade in from bottom animation (visible immediately so sections below the fold are never blank)
export function FadeInUp({
    children,
    delay = 0,
    duration = 0.35,
    className = "",
}: {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Stagger children animation
export function StaggerContainer({
    children,
    staggerDelay = 0.08,
    className = "",
}: {
    children: React.ReactNode;
    staggerDelay?: number;
    className?: string;
}) {
    const containerVariants: Variants = {
        hidden: { opacity: 1 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: staggerDelay,
            },
        },
    };

    return (
        <motion.div
            initial="visible"
            animate="visible"
            variants={containerVariants}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function StaggerItem({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const itemVariants: Variants = {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    };

    return (
        <motion.div variants={itemVariants} className={className}>
            {children}
        </motion.div>
    );
}

// Scale on hover
export function ScaleOnHover({
    children,
    scale = 1.05,
    className = "",
}: {
    children: React.ReactNode;
    scale?: number;
    className?: string;
}) {
    return (
        <motion.div
            whileHover={{ scale }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Floating animation
export function FloatingElement({
    children,
    duration = 3,
    distance = 10,
    className = "",
}: {
    children: React.ReactNode;
    duration?: number;
    distance?: number;
    className?: string;
}) {
    return (
        <motion.div
            animate={{
                y: [-distance, distance, -distance],
            }}
            transition={{
                duration,
                repeat: Infinity,
                ease: "easeInOut",
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Typing animation for text
export function TypewriterText({
    text,
    speed = 50,
    className = "",
    onComplete,
}: {
    text: string;
    speed?: number;
    className?: string;
    onComplete?: () => void;
}) {
    const [displayedText, setDisplayedText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText((prev) => prev + text[currentIndex]);
                setCurrentIndex((prev) => prev + 1);
            }, speed);
            return () => clearTimeout(timeout);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, text, speed, onComplete]);

    return (
        <span className={className}>
            {displayedText}
            <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
            >
                |
            </motion.span>
        </span>
    );
}

// Slide in animation
export function SlideIn({
    children,
    delay = 0,
    duration = 0.35,
    className = "",
}: {
    children: React.ReactNode;
    direction?: "left" | "right" | "top" | "bottom";
    delay?: number;
    duration?: number;
    className?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 1, x: 0, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ delay, duration, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Pulse animation
export function PulseAnimation({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <motion.div
            animate={{
                scale: [1, 1.05, 1],
                opacity: [1, 0.8, 1],
            }}
            transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Counter animation
export function AnimatedCounter({
    value,
    className = "",
}: {
    value: number;
    duration?: number;
    className?: string;
}) {
    return (
        <span className={className}>
            {value.toLocaleString()}
        </span>
    );
}

// Shimmer loading effect
export function ShimmerEffect({
    className = "",
    width = "100%",
    height = "20px",
}: {
    className?: string;
    width?: string;
    height?: string;
}) {
    return (
        <div
            className={`relative overflow-hidden bg-slate-200 dark:bg-slate-700 rounded ${className}`}
            style={{ width, height }}
        >
            <motion.div
                className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
        </div>
    );
}

// Glow effect on hover
export function GlowOnHover({
    children,
    glowColor = "rgba(59, 130, 246, 0.5)",
    className = "",
}: {
    children: React.ReactNode;
    glowColor?: string;
    className?: string;
}) {
    return (
        <motion.div
            whileHover={{
                boxShadow: `0 0 30px ${glowColor}`,
            }}
            transition={{ duration: 0.3 }}
            className={className}
        >
            {children}
        </motion.div>
    );
}
