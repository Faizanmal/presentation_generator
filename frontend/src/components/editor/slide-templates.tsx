"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
    Layout,
    LayoutGrid,
    LayoutList,
    Image,
    BarChart3,
    Quote,
    Users,
    Target,
    Lightbulb,
    TrendingUp,
    Calendar,
    CheckCircle,
    Search,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Slide Layout Templates
export interface SlideTemplate {
    id: string;
    name: string;
    description: string;
    category: "layout" | "content" | "data" | "creative";
    icon: React.ReactNode;
    preview: string; // CSS gradient or color for preview
    blocks: {
        type: string;
        content: Record<string, unknown>;
        style?: Record<string, unknown>;
    }[];
}

const slideTemplates: SlideTemplate[] = [
    // Layout Templates
    {
        id: "title-slide",
        name: "Title Slide",
        description: "Perfect for opening your presentation",
        category: "layout",
        icon: <Layout className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Your Presentation Title" },
                style: { fontSize: "48px", textAlign: "center" },
            },
            {
                type: "SUBHEADING",
                content: { text: "Add your subtitle or tagline here" },
                style: { fontSize: "24px", textAlign: "center", opacity: 0.8 },
            },
        ],
    },
    {
        id: "section-header",
        name: "Section Header",
        description: "Introduce a new section or topic",
        category: "layout",
        icon: <LayoutGrid className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Section Title" },
                style: { fontSize: "40px", textAlign: "left" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Brief description of what this section covers" },
                style: { fontSize: "18px", opacity: 0.7 },
            },
        ],
    },
    {
        id: "two-column",
        name: "Two Column",
        description: "Compare or present parallel ideas",
        category: "layout",
        icon: <LayoutList className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Two Column Layout" },
                style: { fontSize: "32px" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Left column content goes here. Add your key points or information." },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Right column content goes here. Perfect for comparisons or related ideas." },
            },
        ],
    },

    // Content Templates
    {
        id: "bullet-points",
        name: "Bullet Points",
        description: "List your key points clearly",
        category: "content",
        icon: <CheckCircle className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Key Points" },
                style: { fontSize: "32px" },
            },
            {
                type: "BULLET_LIST",
                content: {
                    items: [
                        "First important point to highlight",
                        "Second key takeaway for your audience",
                        "Third compelling argument or fact",
                        "Fourth point to reinforce your message",
                    ],
                },
            },
        ],
    },
    {
        id: "image-left",
        name: "Image + Text",
        description: "Visual content with description",
        category: "content",
        icon: <Image className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
        blocks: [
            {
                type: "IMAGE",
                content: { url: "", alt: "Add your image" },
                style: { width: "50%" },
            },
            {
                type: "HEADING",
                content: { text: "Image Title" },
                style: { fontSize: "28px" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Describe what the image represents and why it's important to your message." },
            },
        ],
    },
    {
        id: "quote",
        name: "Quote",
        description: "Highlight an impactful quote",
        category: "content",
        icon: <Quote className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)",
        blocks: [
            {
                type: "QUOTE",
                content: { text: "The only way to do great work is to love what you do." },
                style: { fontSize: "28px", fontStyle: "italic", textAlign: "center" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "— Steve Jobs" },
                style: { textAlign: "center", opacity: 0.7 },
            },
        ],
    },

    // Data Templates
    {
        id: "statistics",
        name: "Statistics",
        description: "Present key metrics and numbers",
        category: "data",
        icon: <BarChart3 className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Key Metrics" },
                style: { fontSize: "32px", textAlign: "center" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "98%" },
                style: { fontSize: "64px", fontWeight: "bold", textAlign: "center" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Customer satisfaction rating" },
                style: { textAlign: "center", opacity: 0.7 },
            },
        ],
    },
    {
        id: "comparison",
        name: "Comparison",
        description: "Before/After or Pro/Con analysis",
        category: "data",
        icon: <TrendingUp className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Before vs After" },
                style: { fontSize: "32px", textAlign: "center" },
            },
            {
                type: "TABLE",
                content: {
                    headers: ["Aspect", "Before", "After"],
                    rows: [
                        ["Efficiency", "45%", "92%"],
                        ["Cost", "$500k", "$250k"],
                        ["Time", "6 months", "2 months"],
                    ],
                },
            },
        ],
    },
    {
        id: "timeline",
        name: "Timeline",
        description: "Show progression or schedule",
        category: "data",
        icon: <Calendar className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Project Timeline" },
                style: { fontSize: "32px" },
            },
            {
                type: "NUMBERED_LIST",
                content: {
                    items: [
                        "Phase 1: Research & Planning (Q1)",
                        "Phase 2: Design & Development (Q2)",
                        "Phase 3: Testing & Refinement (Q3)",
                        "Phase 4: Launch & Review (Q4)",
                    ],
                },
            },
        ],
    },

    // Creative Templates
    {
        id: "team",
        name: "Team Intro",
        description: "Introduce your team members",
        category: "creative",
        icon: <Users className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "Meet the Team" },
                style: { fontSize: "32px", textAlign: "center" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Our talented team brings together diverse expertise to deliver exceptional results." },
                style: { textAlign: "center", opacity: 0.8 },
            },
        ],
    },
    {
        id: "problem-solution",
        name: "Problem / Solution",
        description: "Present a challenge and your solution",
        category: "creative",
        icon: <Target className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
        blocks: [
            {
                type: "HEADING",
                content: { text: "The Problem" },
                style: { fontSize: "28px" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Describe the challenge your audience faces." },
            },
            {
                type: "HEADING",
                content: { text: "Our Solution" },
                style: { fontSize: "28px" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Explain how your approach solves this problem effectively." },
            },
        ],
    },
    {
        id: "big-idea",
        name: "Big Idea",
        description: "Highlight a central concept",
        category: "creative",
        icon: <Lightbulb className="h-5 w-5" />,
        preview: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
        blocks: [
            {
                type: "PARAGRAPH",
                content: { text: "💡" },
                style: { fontSize: "64px", textAlign: "center" },
            },
            {
                type: "HEADING",
                content: { text: "The Big Idea" },
                style: { fontSize: "36px", textAlign: "center" },
            },
            {
                type: "PARAGRAPH",
                content: { text: "Your transformative insight or key message that changes everything." },
                style: { fontSize: "18px", textAlign: "center", opacity: 0.8 },
            },
        ],
    },
];

// Starter Templates (full presentations)
export interface StarterTemplate {
    id: string;
    name: string;
    description: string;
    category: "business" | "sales" | "education" | "creative";
    slides: number;
    preview: string;
    icon: React.ReactNode;
}

const starterTemplates: StarterTemplate[] = [
    {
        id: "pitch-deck",
        name: "Pitch Deck",
        description: "Perfect for startup pitches and investor presentations",
        category: "business",
        slides: 12,
        preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        icon: <TrendingUp className="h-6 w-6" />,
    },
    {
        id: "sales-proposal",
        name: "Sales Proposal",
        description: "Win clients with compelling proposals",
        category: "sales",
        slides: 10,
        preview: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        icon: <Target className="h-6 w-6" />,
    },
    {
        id: "product-launch",
        name: "Product Launch",
        description: "Showcase your new product features",
        category: "business",
        slides: 8,
        preview: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        icon: <Sparkles className="h-6 w-6" />,
    },
    {
        id: "team-meeting",
        name: "Team Update",
        description: "Weekly or monthly team status updates",
        category: "business",
        slides: 6,
        preview: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        icon: <Users className="h-6 w-6" />,
    },
    {
        id: "training",
        name: "Training Materials",
        description: "Educational content for onboarding or courses",
        category: "education",
        slides: 15,
        preview: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
        icon: <Lightbulb className="h-6 w-6" />,
    },
    {
        id: "portfolio",
        name: "Portfolio",
        description: "Showcase your work and achievements",
        category: "creative",
        slides: 8,
        preview: "linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)",
        icon: <Image className="h-6 w-6" />,
    },
];

interface SlideTemplatesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectTemplate: (template: SlideTemplate) => void;
    onSelectStarterTemplate?: (template: StarterTemplate) => void;
}

export function SlideTemplatesDialog({
    open,
    onOpenChange,
    onSelectTemplate,
    onSelectStarterTemplate,
}: SlideTemplatesDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    const filteredSlideTemplates = slideTemplates.filter((template) => {
        const matchesSearch =
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory =
            selectedCategory === "all" || template.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const filteredStarterTemplates = starterTemplates.filter((template) =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layout className="h-5 w-5" />
                        Choose a Template
                    </DialogTitle>
                    <DialogDescription>
                        Select a slide layout or start with a complete presentation template
                    </DialogDescription>
                </DialogHeader>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <Tabs defaultValue="slides" className="flex-1">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="slides">Slide Layouts</TabsTrigger>
                        <TabsTrigger value="starters">Starter Templates</TabsTrigger>
                    </TabsList>

                    <TabsContent value="slides" className="mt-4">
                        {/* Category Filter */}
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                            {["all", "layout", "content", "data", "creative"].map((cat) => (
                                <Button
                                    key={cat}
                                    variant={selectedCategory === cat ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedCategory(cat)}
                                    className="capitalize whitespace-nowrap"
                                >
                                    {cat === "all" ? "All Templates" : cat}
                                </Button>
                            ))}
                        </div>

                        {/* Slide Templates Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[45vh] overflow-y-auto pr-2">
                            {filteredSlideTemplates.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        onSelectTemplate(template);
                                        onOpenChange(false);
                                    }}
                                    className="group text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all duration-200"
                                >
                                    {/* Preview */}
                                    <div
                                        className="aspect-video rounded-lg mb-3 flex items-center justify-center text-white"
                                        style={{ background: template.preview }}
                                    >
                                        {template.icon}
                                    </div>

                                    {/* Info */}
                                    <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {template.name}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                        {template.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="starters" className="mt-4">
                        {/* Starter Templates Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto pr-2">
                            {filteredStarterTemplates.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        onSelectStarterTemplate?.(template);
                                        onOpenChange(false);
                                    }}
                                    className="group text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg transition-all duration-200"
                                >
                                    {/* Preview */}
                                    <div
                                        className="aspect-video rounded-lg mb-3 flex flex-col items-center justify-center text-white"
                                        style={{ background: template.preview }}
                                    >
                                        {template.icon}
                                        <span className="text-xs mt-2 opacity-80">
                                            {template.slides} slides
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                        {template.name}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                        {template.description}
                                    </p>
                                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                                        {template.category}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// Export templates for API usage
export { slideTemplates, starterTemplates };
