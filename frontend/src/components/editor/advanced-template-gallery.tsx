"use client";

import { useState } from "react";
import {
  Download,
  Eye,
  Filter,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TemplateSlide {
  id: string;
  type: string;
  title: string;
  layout: string;
  content: Record<string, unknown>;
}

interface AdvancedTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  industry: string[];
  slides: TemplateSlide[];
  colorScheme: string[];
  typography: {
    heading: string;
    body: string;
  };
  features: string[];
  isPremium: boolean;
  rating: number;
  preview: string;
}

const ADVANCED_TEMPLATES: AdvancedTemplate[] = [
  {
    id: "startup-pitch",
    name: "Startup Pitch Deck",
    description: "Complete pitch deck template for fundraising",
    category: "Business",
    industry: ["Startups", "Tech", "SaaS"],
    slides: [
      { id: "1", type: "title", title: "Title Slide", layout: "hero", content: {} },
      { id: "2", type: "content", title: "Problem", layout: "title-content", content: {} },
      { id: "3", type: "content", title: "Solution", layout: "title-content", content: {} },
      { id: "4", type: "content", title: "Market", layout: "three-column", content: {} },
      { id: "5", type: "content", title: "Business Model", layout: "two-column", content: {} },
      { id: "6", type: "content", title: "Traction", layout: "metrics", content: {} },
      { id: "7", type: "content", title: "Team", layout: "team-grid", content: {} },
      { id: "8", type: "content", title: "Ask", layout: "central-focus", content: {} },
    ],
    colorScheme: ["#007AFF", "#34C759", "#FF9500"],
    typography: { heading: "Montserrat", body: "Inter" },
    features: ["Financial Metrics", "Team Showcase", "Customer Testimonials"],
    isPremium: false,
    rating: 4.8,
    preview: "Ideal for tech startups seeking investment",
  },
  {
    id: "corporate-annual",
    name: "Corporate Annual Report",
    description: "Professional annual report presentation",
    category: "Corporate",
    industry: ["Enterprise", "Finance", "Corporate"],
    slides: [
      { id: "1", type: "title", title: "Cover", layout: "title-hero", content: {} },
      { id: "2", type: "content", title: "Executive Summary", layout: "full-width", content: {} },
      { id: "3", type: "content", title: "Key Metrics", layout: "metrics-grid", content: {} },
      { id: "4", type: "content", title: "Financial Performance", layout: "charts", content: {} },
      { id: "5", type: "content", title: "Strategic Initiatives", layout: "timeline", content: {} },
      { id: "6", type: "content", title: "Outlook", layout: "forward-focused", content: {} },
    ],
    colorScheme: ["#003366", "#0052CC", "#F5F5F5"],
    typography: { heading: "Playfair Display", body: "Inter" },
    features: ["Financial Charts", "Timeline", "Data Visualization"],
    isPremium: false,
    rating: 4.6,
    preview: "Professional corporate reporting",
  },
  {
    id: "product-launch",
    name: "Product Launch Event",
    description: "Modern product launch presentation",
    category: "Marketing",
    industry: ["Tech", "Consumer", "SaaS"],
    slides: [
      { id: "1", type: "title", title: "Opening", layout: "dramatic-hero", content: {} },
      { id: "2", type: "content", title: "The Problem", layout: "problem-statement", content: {} },
      { id: "3", type: "content", title: "The Solution", layout: "solution-showcase", content: {} },
      { id: "4", type: "content", title: "Features", layout: "feature-carousel", content: {} },
      { id: "5", type: "content", title: "Pricing", layout: "pricing-table", content: {} },
      { id: "6", type: "content", title: "Call to Action", layout: "cta-focused", content: {} },
    ],
    colorScheme: ["#FF006E", "#8338EC", "#3A86FF"],
    typography: { heading: "Poppins", body: "Poppins" },
    features: ["Feature Showcase", "Pricing Table", "Video Integration"],
    isPremium: true,
    rating: 4.9,
    preview: "Eye-catching product launches",
  },
  {
    id: "conference-talk",
    name: "Conference Talk",
    description: "Engaging conference presentation",
    category: "Education",
    industry: ["Tech", "Academia", "Science"],
    slides: [
      { id: "1", type: "title", title: "Title Slide", layout: "speaker-intro", content: {} },
      { id: "2", type: "content", title: "Overview", layout: "outline", content: {} },
      { id: "3", type: "content", title: "Key Points", layout: "key-takeaways", content: {} },
      { id: "4", type: "content", title: "Deep Dive", layout: "two-column-detail", content: {} },
      { id: "5", type: "content", title: "Results", layout: "results-showcase", content: {} },
      { id: "6", type: "content", title: "Q&A", layout: "discussion", content: {} },
    ],
    colorScheme: ["#2D5016", "#52B788", "#80B0A0"],
    typography: { heading: "Lora", body: "Inter" },
    features: ["Speaker Notes", "Code Blocks", "Citation Support"],
    isPremium: false,
    rating: 4.7,
    preview: "Academic and technical presentations",
  },
  {
    id: "training-module",
    name: "Training Module",
    description: "Comprehensive training presentation",
    category: "Education",
    industry: ["Corporate", "Academia", "Tech"],
    slides: [
      { id: "1", type: "title", title: "Welcome", layout: "training-intro", content: {} },
      { id: "2", type: "content", title: "Learning Objectives", layout: "objectives", content: {} },
      { id: "3", type: "content", title: "Concept 1", layout: "lesson", content: {} },
      { id: "4", type: "content", title: "Practice", layout: "interactive", content: {} },
      { id: "5", type: "content", title: "Concept 2", layout: "lesson", content: {} },
      { id: "6", type: "content", title: "Assessment", layout: "quiz", content: {} },
      { id: "7", type: "content", title: "Summary", layout: "recap", content: {} },
    ],
    colorScheme: ["#0F4C81", "#3282B8", "#A4D0E6"],
    typography: { heading: "Montserrat", body: "Inter" },
    features: ["Interactive Quizzes", "Progress Tracking", "Assessment Tools"],
    isPremium: false,
    rating: 4.5,
    preview: "Structured learning experiences",
  },
  {
    id: "minimal-modern",
    name: "Minimal Modern",
    description: "Clean and contemporary design",
    category: "Modern",
    industry: ["Design", "Creative", "Tech"],
    slides: [
      { id: "1", type: "title", title: "Title", layout: "minimal-title", content: {} },
      { id: "2", type: "content", title: "Content", layout: "minimal-content", content: {} },
      { id: "3", type: "content", title: "Focus", layout: "single-focus", content: {} },
      { id: "4", type: "content", title: "Comparison", layout: "minimal-compare", content: {} },
    ],
    colorScheme: ["#FFFFFF", "#000000", "#F0F0F0"],
    typography: { heading: "Inter", body: "Inter" },
    features: ["Custom Animations", "Smooth Transitions", "Modern Typography"],
    isPremium: false,
    rating: 4.6,
    preview: "Minimalist and elegant designs",
  },
];

interface AdvancedTemplateGalleryProps {
  onSelectTemplate?: (template: AdvancedTemplate) => void;
  onPreviewTemplate?: (template: AdvancedTemplate) => void;
}

export function AdvancedTemplateGallery({
  onSelectTemplate,
  onPreviewTemplate,
}: AdvancedTemplateGalleryProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterIndustry, setFilterIndustry] = useState<string>("all");

  const categories = [
    "all",
    ...Array.from(new Set(ADVANCED_TEMPLATES.map((t) => t.category))),
  ];
  const industries = [
    "all",
    ...Array.from(new Set(ADVANCED_TEMPLATES.flatMap((t) => t.industry))),
  ];

  let filteredTemplates = ADVANCED_TEMPLATES;

  if (filterCategory !== "all") {
    filteredTemplates = filteredTemplates.filter(
      (t) => t.category === filterCategory
    );
  }

  if (filterIndustry !== "all") {
    filteredTemplates = filteredTemplates.filter((t) =>
      t.industry.includes(filterIndustry)
    );
  }

  const handleSelectTemplate = (template: AdvancedTemplate) => {
    setSelectedTemplate(template.id);
    onSelectTemplate?.(template);
    toast.success(`Selected "${template.name}" template`);
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Filters */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filter Templates
        </h3>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
            Category
          </label>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setFilterCategory(category)}
                className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                  filterCategory === category
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 hover:border-blue-400"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
            Industry
          </label>
          <div className="flex gap-2 flex-wrap">
            {industries.map((industry) => (
              <button
                key={industry}
                onClick={() => setFilterIndustry(industry)}
                className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-all ${
                  filterIndustry === industry
                    ? "bg-purple-500 text-white"
                    : "bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 hover:border-purple-400"
                }`}
              >
                {industry}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleSelectTemplate(template)}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              selectedTemplate === template.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                : "border-slate-300 dark:border-slate-600 hover:border-blue-400 bg-white dark:bg-slate-950"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {template.name}
                  </h4>
                  {template.isPremium && (
                    <span className="text-[10px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded font-bold">
                      PREMIUM
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {template.description}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                  {template.rating}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {template.slides.length} Slides
                </span>
              </div>
              <div>
                <div className="text-slate-600 dark:text-slate-400">
                  {template.category}
                </div>
              </div>
              <div className="text-right">
                <div className="text-slate-600 dark:text-slate-400">
                  {template.industry.slice(0, 2).join(", ")}
                </div>
              </div>
            </div>

            {/* Color Scheme */}
            <div className="flex gap-1 mb-3">
              {template.colorScheme.map((color) => (
                <div
                  key={color}
                  className="w-6 h-6 rounded border border-slate-300 dark:border-slate-600"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1">
              {template.features.slice(0, 2).map((feature) => (
                <span
                  key={feature}
                  className="text-[10px] px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  {feature}
                </span>
              ))}
              {template.features.length > 2 && (
                <span className="text-[10px] px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  +{template.features.length - 2} more
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Template Actions */}
      {selectedTemplate && (
        <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Button
            onClick={() => {
              const template = ADVANCED_TEMPLATES.find(
                (t) => t.id === selectedTemplate
              );
              if (template) {onPreviewTemplate?.(template);}
            }}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button size="sm" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Use Template
          </Button>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          📚 Professional templates for every industry and use case, with pre-designed layouts and color schemes.
        </p>
      </div>
    </div>
  );
}
