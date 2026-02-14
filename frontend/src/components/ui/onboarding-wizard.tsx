"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles,
    ArrowRight,
    ArrowLeft,
    Palette,
    Users,
    Mic,
    BarChart3,
    CheckCircle2,
} from "lucide-react";
import { Button } from "./button";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    content: React.ReactNode;
}

interface OnboardingWizardProps {
    onComplete: (data: OnboardingData) => void;
    onSkip?: () => void;
}

export interface OnboardingData {
    useCase: string;
    teamSize: string;
    experience: string;
    interests: string[];
}

const useCases = [
    { id: "business", label: "Business Presentations", icon: "💼" },
    { id: "education", label: "Education & Training", icon: "📚" },
    { id: "sales", label: "Sales & Marketing", icon: "📈" },
    { id: "personal", label: "Personal Projects", icon: "✨" },
];

const teamSizes = [
    { id: "individual", label: "Just me" },
    { id: "small", label: "2-10 people" },
    { id: "medium", label: "11-50 people" },
    { id: "large", label: "50+ people" },
];

const experienceLevels = [
    { id: "beginner", label: "New to presentations", description: "I rarely create presentations" },
    { id: "intermediate", label: "Occasional creator", description: "I create a few presentations per month" },
    { id: "advanced", label: "Power user", description: "I create presentations regularly" },
];

const interests = [
    { id: "ai", label: "AI Generation", icon: <Sparkles className="h-5 w-5" /> },
    { id: "themes", label: "Beautiful Themes", icon: <Palette className="h-5 w-5" /> },
    { id: "collaboration", label: "Team Collaboration", icon: <Users className="h-5 w-5" /> },
    { id: "voice", label: "Voice-to-Slides", icon: <Mic className="h-5 w-5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" /> },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState<OnboardingData>({
        useCase: "",
        teamSize: "",
        experience: "",
        interests: [],
    });

    const steps: OnboardingStep[] = [
        {
            id: "welcome",
            title: "Welcome to Presentation Designer! 🎉",
            description: "Let's personalize your experience in just a few steps.",
            icon: <Sparkles className="h-8 w-8" />,
            content: (
                <div className="text-center py-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6"
                    >
                        <Sparkles className="h-12 w-12 text-white" />
                    </motion.div>
                    <h2 className="text-2xl font-bold mb-4">Welcome to Presentation Designer!</h2>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        Create stunning AI-powered presentations in seconds. Let&apos;s personalize your experience.
                    </p>
                </div>
            ),
        },
        {
            id: "use-case",
            title: "What will you primarily use presentations for?",
            description: "This helps us recommend the best templates and features.",
            icon: <span className="text-2xl">🎯</span>,
            content: (
                <div className="grid grid-cols-2 gap-4 py-4">
                    {useCases.map((useCase) => (
                        <button
                            key={useCase.id}
                            onClick={() => setData((prev) => ({ ...prev, useCase: useCase.id }))}
                            className={`p-6 rounded-xl border-2 text-left transition-all ${data.useCase === useCase.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                        >
                            <span className="text-3xl mb-3 block">{useCase.icon}</span>
                            <p className="font-medium">{useCase.label}</p>
                        </button>
                    ))}
                </div>
            ),
        },
        {
            id: "team-size",
            title: "How big is your team?",
            description: "We'll tailor collaboration features to your needs.",
            icon: <Users className="h-8 w-8" />,
            content: (
                <div className="space-y-3 py-4">
                    {teamSizes.map((size) => (
                        <button
                            key={size.id}
                            onClick={() => setData((prev) => ({ ...prev, teamSize: size.id }))}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${data.teamSize === size.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                        >
                            <p className="font-medium">{size.label}</p>
                        </button>
                    ))}
                </div>
            ),
        },
        {
            id: "experience",
            title: "What's your presentation experience level?",
            description: "We'll adjust the interface complexity accordingly.",
            icon: <span className="text-2xl">📊</span>,
            content: (
                <div className="space-y-3 py-4">
                    {experienceLevels.map((level) => (
                        <button
                            key={level.id}
                            onClick={() => setData((prev) => ({ ...prev, experience: level.id }))}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${data.experience === level.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                        >
                            <p className="font-medium">{level.label}</p>
                            <p className="text-sm text-slate-500 mt-1">{level.description}</p>
                        </button>
                    ))}
                </div>
            ),
        },
        {
            id: "interests",
            title: "What features interest you most?",
            description: "Select all that apply. We'll highlight these in your dashboard.",
            icon: <span className="text-2xl">✨</span>,
            content: (
                <div className="grid grid-cols-2 gap-4 py-4">
                    {interests.map((interest) => {
                        const isSelected = data.interests.includes(interest.id);
                        return (
                            <button
                                key={interest.id}
                                onClick={() =>
                                    setData((prev) => ({
                                        ...prev,
                                        interests: isSelected
                                            ? prev.interests.filter((i) => i !== interest.id)
                                            : [...prev.interests, interest.id],
                                    }))
                                }
                                className={`p-4 rounded-xl border-2 text-left transition-all ${isSelected
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`h-10 w-10 rounded-lg flex items-center justify-center ${isSelected
                                            ? "bg-blue-500 text-white"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                            }`}
                                    >
                                        {interest.icon}
                                    </div>
                                    <span className="font-medium">{interest.label}</span>
                                    {isSelected && <CheckCircle2 className="h-5 w-5 text-blue-500 ml-auto" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            ),
        },
        {
            id: "complete",
            title: "You're all set! 🚀",
            description: "Your personalized experience is ready.",
            icon: <CheckCircle2 className="h-8 w-8" />,
            content: (
                <div className="text-center py-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="h-24 w-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6"
                    >
                        <CheckCircle2 className="h-12 w-12 text-white" />
                    </motion.div>
                    <h2 className="text-2xl font-bold mb-4">You&apos;re all set!</h2>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        We&apos;ve personalized your experience based on your preferences. Let&apos;s create your first presentation!
                    </p>
                </div>
            ),
        },
    ];

    const canProceed = () => {
        switch (steps[currentStep].id) {
            case "use-case":
                return !!data.useCase;
            case "team-size":
                return !!data.teamSize;
            case "experience":
                return !!data.experience;
            default:
                return true;
        }
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete(data);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-slate-950 z-50 flex items-center justify-center">
            <div className="max-w-xl w-full mx-auto p-8">
                {/* Progress bar */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-slate-500">
                            Step {currentStep + 1} of {steps.length}
                        </span>
                        {onSkip && (
                            <button
                                onClick={onSkip}
                                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                                Skip setup
                            </button>
                        )}
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                {steps[currentStep].title}
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400">
                                {steps[currentStep].description}
                            </p>
                        </div>

                        {steps[currentStep].content}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex justify-between mt-8">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={currentStep === 0}
                        className={currentStep === 0 ? "invisible" : ""}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>

                    <Button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        {currentStep === steps.length - 1 ? (
                            <>
                                Get Started
                                <Sparkles className="h-4 w-4 ml-2" />
                            </>
                        ) : (
                            <>
                                Next
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Hook to manage onboarding state
export function useOnboarding() {
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(true);

    useEffect(() => {
        const completed = localStorage.getItem("onboarding_completed");
        if (!completed) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowOnboarding(true);

             
            setHasCompleted(false);
        }
    }, []);

    const completeOnboarding = (data: OnboardingData) => {
        localStorage.setItem("onboarding_completed", "true");
        localStorage.setItem("onboarding_data", JSON.stringify(data));
        setShowOnboarding(false);
        setHasCompleted(true);
    };

    const skipOnboarding = () => {
        localStorage.setItem("onboarding_completed", "true");
        setShowOnboarding(false);
        setHasCompleted(true);
    };

    const resetOnboarding = () => {
        localStorage.removeItem("onboarding_completed");
        localStorage.removeItem("onboarding_data");
        setShowOnboarding(true);
        setHasCompleted(false);
    };

    return {
        showOnboarding,
        hasCompleted,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding,
    };
}
