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
      const colon = entry.indexOf(':');
      const title = colon > 0 ? entry.slice(0, colon).trim() : entry.trim();
      const description = colon > 0 ? entry.slice(colon + 1).trim() : '';
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
    <div className="w-full py-8 my-4 relative">
      {/* Background Line */}
      <div className="absolute top-1/2 left-0 w-full h-1 -translate-y-1/2 bg-slate-200 rounded-full" />
      
      <div className="flex justify-between relative z-10 w-full">
        {items.map((item, index) => {
          const isCompleted = item.status === 'completed';
          const isCurrent = item.status === 'current';
          
          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15, type: 'spring' }}
              className="flex flex-col items-center relative w-1/3 px-4 group"
            >
              <div 
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10 shadow-sm",
                  isCompleted ? "bg-white" : isCurrent ? "bg-white scale-110 shadow-md" : "bg-white",
                )}
                style={{
                  borderColor: isCompleted || isCurrent ? primaryColor : '#cbd5e1',
                  color: isCompleted || isCurrent ? primaryColor : '#94a3b8'
                }}
              >
                {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-4 h-4 fill-current" />}
              </div>
              
              <div className="mt-6 text-center bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-slate-100 group-hover:shadow-md transition-shadow">
                <div 
                  className="font-bold text-lg mb-2 outline-none empty:after:content-['Phase']"
                  contentEditable={isEditing}
                  onBlur={(e) => handleTextChange(item.id, 'title', e.currentTarget.innerText)}
                >
                  {item.title}
                </div>
                <div 
                  className="text-sm outline-none empty:after:content-['Description']"
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
