'use client';

import { PRODUCT_NAME } from '@/lib/brand';

interface BrandedMediaPlaceholderProps {
  primary?: string;
  secondary?: string;
  label?: string;
  className?: string;
}

/** Full-bleed branded fill when a slide expects media but none loaded. */
export function BrandedMediaPlaceholder({
  primary = '#0F172A',
  secondary = '#334155',
  label = PRODUCT_NAME,
  className = '',
}: BrandedMediaPlaceholderProps) {
  const monogram = label.slice(0, 1).toUpperCase();
  return (
    <div
      className={`w-full h-full min-h-0 flex flex-col items-center justify-center gap-3 ${className}`}
      style={{
        background: `linear-gradient(145deg, ${primary} 0%, ${secondary} 55%, #0B1220 100%)`,
      }}
      aria-hidden
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold text-white/95 shadow-lg"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      >
        {monogram}
      </div>
      <p className="text-sm font-medium tracking-wide text-white/70">{label}</p>
    </div>
  );
}

export default BrandedMediaPlaceholder;
