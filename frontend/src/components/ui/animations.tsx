"use client";

import { useEffect, useRef, useState } from "react";
import type { Variants } from "framer-motion";
import { motion, useInView, useAnimation } from "framer-motion";

// Fade in from bottom animation
export function FadeInUp({
    children,
    delay = 0,
    duration = 0.5,
    className = "",
}: {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    className?: string;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });
    const controls = useAnimation();

    useEffect(() => {
        if (isInView) {
            controls.start("visible");
        }
    }, [isInView, controls]);

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={controls}
            variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { delay, duration } },
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

// Stagger children animation
export function StaggerContainer({
    children,
    staggerDelay = 0.1,
    className = "",
}: {
    children: React.ReactNode;
    staggerDelay?: number;
    className?: string;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: staggerDelay,
            },
        },
    };

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
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
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
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
    direction = "left",
    delay = 0,
    duration = 0.5,
    className = "",
}: {
    children: React.ReactNode;
    direction?: "left" | "right" | "top" | "bottom";
    delay?: number;
    duration?: number;
    className?: string;
}) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });

    const directionOffset = {
        left: { x: -100, y: 0 },
        right: { x: 100, y: 0 },
        top: { x: 0, y: -100 },
        bottom: { x: 0, y: 100 },
    };

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, ...directionOffset[direction] }}
            animate={
                isInView
                    ? { opacity: 1, x: 0, y: 0 }
                    : { opacity: 0, ...directionOffset[direction] }
            }
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
    duration = 2,
    className = "",
}: {
    value: number;
    duration?: number;
    className?: string;
}) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });

    useEffect(() => {
        if (!isInView) {return;}

        let startTime: number;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) {startTime = timestamp;}
            const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
            setCount(Math.floor(progress * value));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [isInView, value, duration]);

    return (
        <span ref={ref} className={className}>
            {count.toLocaleString()}
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
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
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
