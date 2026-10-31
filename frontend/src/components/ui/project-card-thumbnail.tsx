"use client";

import Image from "next/image";
import {
  projectPlaceholderGradient,
  stripHtmlText,
} from "@/lib/project-preview";

interface SlideBlockLike {
  id?: string;
  type?: string;
  blockType?: string;
  kind?: string;
  content?: Record<string, unknown>;
  style?: Record<string, unknown>;
  order?: number;
}

interface FirstSlideLike {
  id?: string;
  title?: string;
  layout?: string;
  blocks?: SlideBlockLike[];
}

interface ProjectCardThumbnailProps {
  title: string;
  seed: string;
  thumbnail?: string | null;
  themeColors?: { primary?: string; accent?: string; secondary?: string } | null;
  firstSlide?: FirstSlideLike | null;
  className?: string;
  initialsClassName?: string;
}

export function ProjectCardThumbnail({
  title,
  seed,
  thumbnail,
  themeColors,
  firstSlide,
  className = "h-full w-full",
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

  const primaryColor = themeColors?.primary || '#3b82f6';
  const accentColor = themeColors?.accent || '#10b981';
  const gradient = projectPlaceholderGradient(seed, themeColors);

  // Extract blocks from the first slide if available
  const blocks = firstSlide?.blocks || [];
  const imageBlock = blocks.find((b) => {
    const t = (b.type || b.blockType || b.kind || '').toUpperCase();
    return t === 'IMAGE' && typeof b.content?.url === 'string' && b.content.url.trim().length > 0;
  });
  const imageUrl = imageBlock ? String(imageBlock.content?.url) : null;

  const headingBlock = blocks.find((b) => {
    const t = (b.type || b.blockType || b.kind || '').toUpperCase();
    return t === 'HEADING' || t === 'TITLE';
  });
  const headingText = headingBlock?.content?.text
    ? stripHtmlText(String(headingBlock.content.text))
    : firstSlide?.title || title;

  const kickerBlock = blocks.find((b) => {
    const t = (b.type || b.blockType || b.kind || '').toUpperCase();
    return t === 'SUBHEADING' || b.style?.variant === 'kicker';
  });
  const kickerText = kickerBlock?.content?.text
    ? stripHtmlText(String(kickerBlock.content.text))
    : null;

  const bodyBlock = blocks.find((b) => {
    const t = (b.type || b.blockType || b.kind || '').toUpperCase();
    return t === 'PARAGRAPH' || t === 'TEXT';
  });
  const bodyText = bodyBlock?.content?.text
    ? stripHtmlText(String(bodyBlock.content.text))
    : null;

  // Real slide preview with image
  if (imageUrl) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={{ background: gradient }}>
        <Image
          src={imageUrl}
          alt={headingText || title}
          fill
          className="object-cover opacity-75 transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col justify-end p-3 sm:p-4 z-10">
          {kickerText && (
            <span
              className="inline-block w-fit px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase mb-1"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}
            >
              {kickerText}
            </span>
          )}
          <p className="font-bold text-white text-xs sm:text-sm line-clamp-2 leading-tight drop-shadow-sm">
            {headingText}
          </p>
        </div>
      </div>
    );
  }

  // Real slide preview with typography and cards/theme layout
  return (
    <div
      className={`relative flex flex-col justify-between p-3 sm:p-4 overflow-hidden ${className}`}
      style={{ background: gradient }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)] pointer-events-none" />
      <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-30" style={{ background: accentColor }} />

      {/* Top kicker tag */}
      <div className="relative z-10">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase backdrop-blur-sm"
          style={{
            background: 'rgba(255,255,255,0.22)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          {kickerText || 'PRESENTATION'}
        </span>
      </div>

      {/* Center/Bottom title and snippet */}
      <div className="relative z-10 mt-auto">
        <p className="font-extrabold text-white text-xs sm:text-sm line-clamp-2 leading-snug drop-shadow-sm tracking-tight">
          {headingText}
        </p>
        {bodyText && (
          <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5 leading-tight">
            {bodyText}
          </p>
        )}
      </div>

      {/* Miniature 16:9 slide bottom accent */}
      <div className="relative z-10 flex items-center gap-1 mt-1 pt-1 border-t border-white/15">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: primaryColor }} />
        <div className="h-0.5 w-12 rounded-full bg-white/30" />
      </div>
    </div>
  );
}
