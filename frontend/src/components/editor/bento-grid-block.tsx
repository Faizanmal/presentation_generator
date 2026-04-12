'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Theme } from '@/types';
import { LayoutGrid, TrendingUp, Users, Zap, Sparkles } from 'lucide-react';

type BentoGridItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  span: string;
};

interface BentoGridBlockProps {
  content: Record<string, unknown>;
  theme?: Theme;
  onChange?: (content: Record<string, unknown>) => void;
  isEditing?: boolean;
}

const DEFAULT_ITEMS = [
  { id: '1', title: 'Revenue Growth', subtitle: '+124% YOY', icon: 'TrendingUp', color: 'accent', span: 'col-span-2 row-span-1' },
  { id: '2', title: 'Active Users', subtitle: '45.2K', icon: 'Users', color: 'primary', span: 'col-span-1 row-span-2' },
  { id: '3', title: 'Global Reach', subtitle: '12 Countries', icon: 'Zap', color: 'secondary', span: 'col-span-1 row-span-1' },
  { id: '4', title: 'New Features', subtitle: 'Automated AI workflows', icon: 'Sparkles', color: 'primary', span: 'col-span-2 row-span-1' },
];

export function BentoGridBlock({ content, theme, onChange, isEditing = false }: BentoGridBlockProps) {
  const items: BentoGridItem[] = Array.isArray(content?.items)
    ? (content.items as BentoGridItem[])
    : DEFAULT_ITEMS;
  const primaryColor = theme?.colors?.primary || "#3b82f6";
  const accentColor = theme?.colors?.accent || "#10b981";
  const secondaryColor = theme?.colors?.secondary || "#8b5cf6";

  const getColor = (colorType: string) => {
    switch (colorType) {
      case 'primary': return primaryColor;
      case 'accent': return accentColor;
      case 'secondary': return secondaryColor;
      default: return '#cbd5e1';
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'TrendingUp': return <TrendingUp className="w-6 h-6" />;
      case 'Users': return <Users className="w-6 h-6" />;
      case 'Zap': return <Zap className="w-6 h-6" />;
      case 'Sparkles': return <Sparkles className="w-6 h-6" />;
      default: return <LayoutGrid className="w-6 h-6" />;
    }
  };

  const handleTextChange = (id: string, field: 'title' | 'subtitle', value: string) => {
    if (!onChange) {return;}
    const newItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    onChange({ ...content, items: newItems });
  };

  return (
    <div className="grid grid-cols-3 gap-4 auto-rows-[120px] w-full p-2 my-6">
      {items.map((item, index) => {
        const itemColor = getColor(item.color);
        
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between group",
              "border border-white/20 shadow-xl backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
              item.span
            )}
            style={{
              background: `linear-gradient(135deg, ${itemColor}15 0%, ${itemColor}05 100%)`,
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            {/* Background glow decoration */}
            <div 
              className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
              style={{ backgroundColor: itemColor }}
            />

            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-white"
                 style={{ backgroundColor: `${itemColor}20`, color: itemColor }}>
              {getIcon(item.icon)}
            </div>

            <div className="mt-auto z-10">
              <div 
                className="font-bold text-lg mb-1 outline-none empty:after:content-['Title']"
                contentEditable={isEditing}
                onBlur={(e) => handleTextChange(item.id, 'title', e.currentTarget.innerText)}
              >
                {item.title}
              </div>
              <div 
                className="text-sm opacity-80 font-medium outline-none empty:after:content-['Subtitle']"
                contentEditable={isEditing}
                onBlur={(e) => handleTextChange(item.id, 'subtitle', e.currentTarget.innerText)}
                style={{ color: itemColor }}
              >
                {item.subtitle}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
