"use client";

import { useEffect, useRef } from "react";

interface AnimatedGradientProps {
    className?: string;
    colors?: string[];
}

export function AnimatedGradient({
    className = "",
    colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#ec4899"],
}: AnimatedGradientProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {return;}

        const ctx = canvas.getContext("2d");
        if (!ctx) {return;}

        let animationId: number;
        let time = 0;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        const animate = () => {
            time += 0.003;

            const gradient = ctx.createLinearGradient(
                0,
                0,
                canvas.width,
                canvas.height
            );

            // Create animated color stops
            colors.forEach((color, index) => {
                const offset =
                    (index / (colors.length - 1) +
                        Math.sin(time + index * 0.5) * 0.1) %
                    1;
                gradient.addColorStop(Math.max(0, Math.min(1, offset)), color);
            });

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            animationId = requestAnimationFrame(animate);
        };

        resize();
        window.addEventListener("resize", resize);
        animate();

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animationId);
        };
    }, [colors]);

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 opacity-30 ${className}`}
            style={{ filter: "blur(100px)" }}
        />
    );
}
