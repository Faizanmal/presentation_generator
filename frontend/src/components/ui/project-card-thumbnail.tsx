"use client";

import Image from "next/image";
import {
  getProjectInitials,
  projectPlaceholderGradient,
} from "@/lib/project-preview";

interface ProjectCardThumbnailProps {
  title: string;
  seed: string;
  thumbnail?: string | null;
  themeColors?: { primary?: string; accent?: string; secondary?: string } | null;
  className?: string;
  initialsClassName?: string;
}

export function ProjectCardThumbnail({
  title,
  seed,
  thumbnail,
  themeColors,
  className = "h-full w-full",
  initialsClassName = "text-3xl font-bold text-white/95 tracking-tight drop-shadow-sm",
}: ProjectCardThumbnailProps) {
  if (thumbnail) {
    return (
      <div className={`relative ${className}`}>
        <Image
          src={thumbnail}
          alt={title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      </div>
    );
  }

  const gradient = projectPlaceholderGradient(seed, themeColors);
  const initials = getProjectInitials(title);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ background: gradient }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_55%)]" />
      <span className={initialsClassName}>{initials}</span>
    </div>
  );
}
