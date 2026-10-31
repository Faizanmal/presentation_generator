'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Theme } from '@/types';
import { CheckCircle2, Circle } from 'lucide-react';

interface TimelineItem {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface TimelineBlockProps {
  content: Record<string, unknown>;
  theme?: Theme;
  onChange?: (content: Record<string, unknown>) => void;
  isEditing?: boolean;
}

const DEFAULT_TIMELINE: TimelineItem[] = [
  { id: '1', title: 'Q1: Foundation', description: 'Core product development and beta launch.', status: 'completed' },
  { id: '2', title: 'Q2: Marketing', description: 'Expand user base through targeted campaigns.', status: 'current' },
  { id: '3', title: 'Q3: Scaling', description: 'Scale infrastructure and enter new markets.', status: 'upcoming' },
];

function normalizeTimelineItems(raw: unknown): TimelineItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_TIMELINE;
  }

  const statuses: TimelineItem['status'][] = ['completed', 'current', 'upcoming'];
  const seen = new Set<string>();

  const filtered = raw.filter((entry) => {
    if (typeof entry === 'string') {
      return entry.trim().length > 0;
    }
    if (entry && typeof entry === 'object') {
      const rec = entry as Record<string, unknown>;
      return Boolean(rec.title || rec.label || rec.content || rec.description || rec.text);
    }
    return false;
  });

  if (filtered.length === 0) {
    return DEFAULT_TIMELINE;
  }

  return filtered.map((entry, index) => {
    const fallbackId = `timeline-${index}`;
    if (typeof entry === 'string') {
      const sepMatch = entry.match(/[:\u2013\u2014\-]/);
      const sepIdx = sepMatch ? entry.indexOf(sepMatch[0]) : -1;
      const title = sepIdx > 0 ? entry.slice(0, sepIdx).trim() : entry.trim();
      const description = sepIdx > 0 ? entry.slice(sepIdx + 1).trim() : '';
      return {
        id: fallbackId,
        title: title || `Phase ${index + 1}`,
        description,
        status: statuses[Math.min(index, statuses.length - 1)],
      };
    }

    const rec =
      entry && typeof entry === 'object'
        ? (entry as Record<string, unknown>)
        : {};
    const baseId =
      typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : fallbackId;
    let id = baseId;
    if (seen.has(id)) {
      id = `${baseId}-${index}`;
    }
    seen.add(id);

    const status =
      rec.status === 'completed' || rec.status === 'current' || rec.status === 'upcoming'
        ? rec.status
        : statuses[Math.min(index, statuses.length - 1)];

    return {
      id,
      title: String(rec.title ?? rec.label ?? rec.content ?? `Phase ${index + 1}`),
      description: String(rec.description ?? rec.text ?? ''),
      status,
    };
  });
}

export function TimelineBlock({ content, theme, onChange, isEditing = false }: TimelineBlockProps) {
  const items = normalizeTimelineItems(content?.items);
  const primaryColor = theme?.colors?.primary || "#3b82f6";
  const textBodyColor = theme?.colors?.text || "#334155";

  const handleTextChange = (id: string, field: 'title' | 'description', value: string) => {
    if (!onChange) {return;}
    const newItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    onChange({ ...content, items: newItems });
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col justify-center py-2 relative">
      <div className="flex items-stretch justify-between relative z-10 w-full flex-1 h-full gap-3">
        {/* Background Line aligned with step circles */}
        <div
          className="absolute top-[22px] left-6 right-6 h-1 rounded-full z-0"
          style={{
            background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}99)`,
          }}
        />
        {items.map((item, index) => {
          const isCompleted = item.status === 'completed';
          const isCurrent = item.status === 'current';
          
          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center relative flex-1 min-w-0 h-full px-1 group opacity-100 z-10"
            >
              <div 
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10 shadow-sm shrink-0 bg-white dark:bg-slate-900",
                  isCurrent ? "scale-105 shadow-md" : "",
                )}
                style={{
                  borderColor: primaryColor,
                  color: primaryColor,
                }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-current" />
                ) : (
                  <span className="text-xs font-bold leading-none">{index + 1}</span>
                )}
              </div>
              
              <div className="mt-3 text-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 w-full group-hover:shadow-md transition-shadow flex flex-col justify-start gap-2 flex-1 h-full min-h-[11rem] sm:min-h-[13rem]">
                <div 
                  className="font-bold text-sm sm:text-base outline-none [word-break:normal] [overflow-wrap:normal] [hyphens:none] empty:after:content-['Phase'] text-slate-900 dark:text-white"
                  contentEditable={isEditing}
                  onBlur={(e) => handleTextChange(item.id, 'title', e.currentTarget.innerText)}
                >
                  {item.title}
                </div>
                <div 
                  className="text-xs sm:text-sm outline-none leading-relaxed [word-break:normal] [overflow-wrap:normal] [hyphens:none] empty:after:content-['Description']"
                  style={{ color: textBodyColor }}
                  contentEditable={isEditing}
                  onBlur={(e) => handleTextChange(item.id, 'description', e.currentTarget.innerText)}
                >
                  {item.description}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
