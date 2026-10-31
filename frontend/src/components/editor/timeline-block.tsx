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

  return raw.map((entry, index) => {
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
    <div className="w-full py-6 my-auto relative">
      {/* Background Line */}
      <div
        className="absolute top-1/2 left-4 right-4 h-1 -translate-y-1/2 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}99)`,
        }}
      />
      
      <div className="flex items-stretch justify-between relative z-10 w-full gap-2">
        {items.map((item, index) => {
          const isCompleted = item.status === 'completed';
          const isCurrent = item.status === 'current';
          
          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, type: 'spring' }}
              className="flex flex-col items-center relative flex-1 min-w-0 px-2 group opacity-100"
            >
              <div 
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10 shadow-sm shrink-0",
                  isCurrent ? "bg-white scale-110 shadow-md" : "bg-white",
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
              
              <div className="mt-4 text-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-800 w-full group-hover:shadow-md transition-shadow flex flex-col justify-start min-h-[5.5rem]">
                <div 
                  className="font-bold text-sm mb-1 outline-none break-words empty:after:content-['Phase'] text-slate-900 dark:text-white"
                  contentEditable={isEditing}
                  onBlur={(e) => handleTextChange(item.id, 'title', e.currentTarget.innerText)}
                >
                  {item.title}
                </div>
                <div 
                  className="text-xs outline-none leading-relaxed break-words empty:after:content-['Description'] line-clamp-4"
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
