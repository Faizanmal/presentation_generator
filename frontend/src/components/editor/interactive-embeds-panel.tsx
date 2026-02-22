"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    BarChart3,
    MessageSquare,
    ClipboardList,
    HelpCircle,
    Cloud,
    Plus,
    Trash2,
    Settings,
    Eye,
    Loader2,
    Check,
    X,
    GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

interface InteractiveEmbed {
    id: string;
    type: "poll" | "qa" | "form" | "quiz" | "wordcloud";
    data: unknown;
}

interface InteractiveEmbedsProps {
    projectId: string;
    slideId: string;
    onEmbedCreated?: (embed: InteractiveEmbed) => void;
    onEmbedDeleted?: (embedId: string) => void;
}

export function InteractiveEmbedsPanel({
    projectId,
    slideId,
    onEmbedCreated,
    // onEmbedDeleted,
}: InteractiveEmbedsProps) {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [embedType, setEmbedType] = useState<InteractiveEmbed["type"]>("poll");

    // Poll state
    const [pollQuestion, setPollQuestion] = useState("");
    const [pollOptions, setPollOptions] = useState(["", ""]);
    const [pollAllowMultiple, setPollAllowMultiple] = useState(false);

    // Q&A state
    const [qaTitle, setQaTitle] = useState("");
    const [qaAllowAnonymous, setQaAllowAnonymous] = useState(true);
    const [qaModeration, setQaModeration] = useState(false);

    // Form state
    const [formTitle, setFormTitle] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formFields, setFormFields] = useState<Array<{
        id: string;
        type: string;
        label: string;
        required: boolean;
        options?: string[];
    }>>([
        { id: "field-1", type: "text", label: "", required: false },
    ]);

    // Quiz state
    const [quizTitle, setQuizTitle] = useState("");
    const [quizQuestions, setQuizQuestions] = useState<Array<{
        question: string;
        options: string[];
        correctAnswer: number;
    }>>([
        { question: "", options: ["", "", "", ""], correctAnswer: 0 },
    ]);
    const [quizTimeLimit, setQuizTimeLimit] = useState<number | undefined>();

    // Word cloud state
    const [wordCloudPrompt, setWordCloudPrompt] = useState("");
    const [wordCloudMaxResponses, setWordCloudMaxResponses] = useState(100);

    // Fetch existing embeds
    const { data: embeds = [], isLoading } = useQuery<InteractiveEmbed[]>({
        queryKey: ["slide-embeds", slideId],
        queryFn: () => api.getSlideEmbeds(slideId) as Promise<InteractiveEmbed[]>,
    });

    // Create poll mutation
    const createPollMutation = useMutation<InteractiveEmbed, Error>({
        mutationFn: () => api.createPollEmbed(projectId, slideId, {
            question: pollQuestion,
            options: pollOptions.filter(o => o.trim()),
            allowMultiple: pollAllowMultiple,
            showResults: true,
        }) as Promise<InteractiveEmbed>,
        onSuccess: (embed) => {
            queryClient.invalidateQueries({ queryKey: ["slide-embeds", slideId] });
            setIsCreateOpen(false);
            resetForm();
            toast.success("Poll created!");
            onEmbedCreated?.(embed);
        },
        onError: () => toast.error("Failed to create poll"),
    });

    // Create Q&A mutation
    const createQAMutation = useMutation<InteractiveEmbed, Error>({
        mutationFn: () => api.createQASession(projectId, slideId, {
            title: qaTitle,
            allowAnonymous: qaAllowAnonymous,
            moderationEnabled: qaModeration,
        }) as Promise<InteractiveEmbed>,
        onSuccess: (embed) => {
            queryClient.invalidateQueries({ queryKey: ["slide-embeds", slideId] });
            setIsCreateOpen(false);
            resetForm();
            toast.success("Q&A session created!");
            onEmbedCreated?.(embed);
        },
        onError: () => toast.error("Failed to create Q&A session"),
    });

    // Create form mutation
    const createFormMutation = useMutation<InteractiveEmbed, Error>({
        mutationFn: () => api.createFormEmbed(projectId, slideId, {
            title: formTitle,
            description: formDescription,
            fields: formFields.filter(f => f.label.trim()),
        }) as Promise<InteractiveEmbed>,
        onSuccess: (embed) => {
            queryClient.invalidateQueries({ queryKey: ["slide-embeds", slideId] });
            setIsCreateOpen(false);
            resetForm();
            toast.success("Form created!");
            onEmbedCreated?.(embed);
        },
        onError: () => toast.error("Failed to create form"),
    });

    // Create quiz mutation
    const createQuizMutation = useMutation<InteractiveEmbed, Error>({
        mutationFn: () => api.createQuizEmbed(projectId, slideId, {
            title: quizTitle,
            questions: quizQuestions.filter(q => q.question.trim()),
            showCorrectAfterSubmit: true,
            timeLimit: quizTimeLimit,
        }) as Promise<InteractiveEmbed>,
        onSuccess: (embed) => {
            queryClient.invalidateQueries({ queryKey: ["slide-embeds", slideId] });
            setIsCreateOpen(false);
            resetForm();
            toast.success("Quiz created!");
            onEmbedCreated?.(embed);
        },
        onError: () => toast.error("Failed to create quiz"),
    });

    // Create word cloud mutation
    const createWordCloudMutation = useMutation<InteractiveEmbed, Error>({
        mutationFn: () => api.createWordCloud(projectId, slideId, {
            prompt: wordCloudPrompt,
            maxResponses: wordCloudMaxResponses,
        }) as Promise<InteractiveEmbed>,
        onSuccess: (embed) => {
            queryClient.invalidateQueries({ queryKey: ["slide-embeds", slideId] });
            setIsCreateOpen(false);
            resetForm();
            toast.success("Word cloud created!");
            onEmbedCreated?.(embed);
        },
        onError: () => toast.error("Failed to create word cloud"),
    });

    const resetForm = () => {
        setPollQuestion("");
        setPollOptions(["", ""]);
        setPollAllowMultiple(false);
        setQaTitle("");
        setQaAllowAnonymous(true);
        setQaModeration(false);
        setFormTitle("");
        setFormDescription("");
        setFormFields([{ id: "field-1", type: "text", label: "", required: false }]);
        setQuizTitle("");
        setQuizQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
        setQuizTimeLimit(undefined);
        setWordCloudPrompt("");
        setWordCloudMaxResponses(100);
    };

    const handleCreate = () => {
        switch (embedType) {
            case "poll":
                createPollMutation.mutate();
                break;
            case "qa":
                createQAMutation.mutate();
                break;
            case "form":
                createFormMutation.mutate();
                break;
            case "quiz":
                createQuizMutation.mutate();
                break;
            case "wordcloud":
                createWordCloudMutation.mutate();
                break;
        }
    };

    const isCreating = createPollMutation.isPending || createQAMutation.isPending ||
        createFormMutation.isPending || createQuizMutation.isPending || createWordCloudMutation.isPending;

    const embedTypeInfo = {
        poll: {
            title: "Poll",
            description: "Let your audience vote on options",
            icon: BarChart3,
            color: "text-blue-500",
        },
        qa: {
            title: "Q&A",
            description: "Collect and answer audience questions",
            icon: MessageSquare,
            color: "text-green-500",
        },
        form: {
            title: "Form",
            description: "Collect structured feedback",
            icon: ClipboardList,
            color: "text-orange-500",
        },
        quiz: {
            title: "Quiz",
            description: "Test your audience's knowledge",
            icon: HelpCircle,
            color: "text-purple-500",
        },
        wordcloud: {
            title: "Word Cloud",
            description: "Visualize audience responses",
            icon: Cloud,
            color: "text-pink-500",
        },
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">Interactive Elements</h3>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Add Interactive Element</DialogTitle>
                            <DialogDescription>
                                Engage your audience with interactive content
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs value={embedType} onValueChange={(v) => setEmbedType(v as InteractiveEmbed["type"])}>
                            <TabsList className="grid grid-cols-5 w-full">
                                {Object.entries(embedTypeInfo).map(([key, info]) => {
                                    const Icon = info.icon;
                                    return (
                                        <TabsTrigger key={key} value={key} className="flex flex-col gap-1 h-auto py-2">
                                            <Icon className={`h-5 w-5 ${info.color}`} />
                                            <span className="text-xs">{info.title}</span>
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>

                            {/* Poll Form */}
                            <TabsContent value="poll" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Question</Label>
                                    <Input
                                        placeholder="What do you think about...?"
                                        value={pollQuestion}
                                        onChange={(e) => setPollQuestion(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Options</Label>
                                    {pollOptions.map((option, index) => (

                                        <div
                                            // eslint-disable-next-line react/no-array-index-key
                                            key={`poll-opt-${index}`}
                                            className="flex gap-2"
                                        >
                                            <Input
                                                placeholder={`Option ${index + 1}`}
                                                value={option}
                                                onChange={(e) => {
                                                    const newOptions = [...pollOptions];
                                                    newOptions[index] = e.target.value;
                                                    setPollOptions(newOptions);
                                                }}
                                            />
                                            {pollOptions.length > 2 && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPollOptions([...pollOptions, ""])}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Option
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={pollAllowMultiple}
                                        onCheckedChange={setPollAllowMultiple}
                                    />
                                    <Label>Allow multiple selections</Label>
                                </div>
                            </TabsContent>

                            {/* Q&A Form */}
                            <TabsContent value="qa" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Session Title</Label>
                                    <Input
                                        placeholder="Q&A Session"
                                        value={qaTitle}
                                        onChange={(e) => setQaTitle(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={qaAllowAnonymous}
                                        onCheckedChange={setQaAllowAnonymous}
                                    />
                                    <Label>Allow anonymous questions</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={qaModeration}
                                        onCheckedChange={setQaModeration}
                                    />
                                    <Label>Enable moderation</Label>
                                </div>
                            </TabsContent>

                            {/* Form Form */}
                            <TabsContent value="form" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Form Title</Label>
                                    <Input
                                        placeholder="Feedback Form"
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        placeholder="Help us improve by sharing your thoughts..."
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fields</Label>
                                    {formFields.map((field, index) => (
                                        <div key={field.id} className="flex gap-2 items-center">
                                            <GripVertical className="h-4 w-4 text-slate-400" />
                                            <Select
                                                value={field.type}
                                                onValueChange={(v) => {
                                                    const newFields = [...formFields];
                                                    newFields[index].type = v;
                                                    setFormFields(newFields);
                                                }}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="text">Text</SelectItem>
                                                    <SelectItem value="textarea">Long Text</SelectItem>
                                                    <SelectItem value="email">Email</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="select">Dropdown</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                placeholder="Field label"
                                                value={field.label}
                                                onChange={(e) => {
                                                    const newFields = [...formFields];
                                                    newFields[index].label = e.target.value;
                                                    setFormFields(newFields);
                                                }}
                                                className="flex-1"
                                            />
                                            <Switch
                                                checked={field.required}
                                                onCheckedChange={(v) => {
                                                    const newFields = [...formFields];
                                                    newFields[index].required = v;
                                                    setFormFields(newFields);
                                                }}
                                            />
                                            {formFields.length > 1 && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => setFormFields(formFields.filter((_, i) => i !== index))}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setFormFields([...formFields, {
                                            id: `field-${formFields.length + 1}`,
                                            type: "text",
                                            label: "",
                                            required: false,
                                        }])}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Field
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* Quiz Form */}
                            <TabsContent value="quiz" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Quiz Title</Label>
                                    <Input
                                        placeholder="Knowledge Check"
                                        value={quizTitle}
                                        onChange={(e) => setQuizTitle(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Time Limit (seconds, optional)</Label>
                                    <Input
                                        type="number"
                                        placeholder="60"
                                        value={quizTimeLimit || ""}
                                        onChange={(e) => setQuizTimeLimit(e.target.value ? parseInt(e.target.value) : undefined)}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Label>Questions</Label>
                                    {quizQuestions.map((q, qIndex) => (

                                        <Card
                                            // eslint-disable-next-line react/no-array-index-key
                                            key={`quiz-q-${qIndex}`}
                                        >
                                            <CardContent className="pt-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">Question {qIndex + 1}</span>
                                                    {quizQuestions.length > 1 && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== qIndex))}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input
                                                    placeholder="Enter your question"
                                                    value={q.question}
                                                    onChange={(e) => {
                                                        const newQuestions = [...quizQuestions];
                                                        newQuestions[qIndex].question = e.target.value;
                                                        setQuizQuestions(newQuestions);
                                                    }}
                                                />
                                                <div className="space-y-2">
                                                    {q.options.map((opt, optIndex) => (

                                                        <div
                                                            // eslint-disable-next-line react/no-array-index-key
                                                            key={`quiz-q-${qIndex}-opt-${optIndex}`}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    const newQuestions = [...quizQuestions];
                                                                    newQuestions[qIndex].correctAnswer = optIndex;
                                                                    setQuizQuestions(newQuestions);
                                                                }}
                                                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${q.correctAnswer === optIndex
                                                                    ? "border-green-500 bg-green-500 text-white"
                                                                    : "border-slate-300"
                                                                    }`}
                                                            >
                                                                {q.correctAnswer === optIndex && <Check className="h-4 w-4" />}
                                                            </button>
                                                            <Input
                                                                placeholder={`Option ${optIndex + 1}`}
                                                                value={opt}
                                                                onChange={(e) => {
                                                                    const newQuestions = [...quizQuestions];
                                                                    newQuestions[qIndex].options[optIndex] = e.target.value;
                                                                    setQuizQuestions(newQuestions);
                                                                }}
                                                                className="flex-1"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setQuizQuestions([...quizQuestions, {
                                            question: "",
                                            options: ["", "", "", ""],
                                            correctAnswer: 0,
                                        }])}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Question
                                    </Button>
                                </div>
                            </TabsContent>

                            {/* Word Cloud Form */}
                            <TabsContent value="wordcloud" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Prompt</Label>
                                    <Input
                                        placeholder="In one word, describe..."
                                        value={wordCloudPrompt}
                                        onChange={(e) => setWordCloudPrompt(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max Responses</Label>
                                    <Input
                                        type="number"
                                        value={wordCloudMaxResponses}
                                        onChange={(e) => setWordCloudMaxResponses(parseInt(e.target.value) || 100)}
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={isCreating}>
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create {embedTypeInfo[embedType].title}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Existing Embeds */}
            {
                isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : embeds && embeds.length > 0 ? (
                    <div className="space-y-2">
                        {embeds.map((embed) => {
                            const info = embedTypeInfo[embed.type as keyof typeof embedTypeInfo];
                            const Icon = info?.icon || BarChart3;

                            return (
                                <Card key={embed.id} className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 ${info?.color || ""}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{info?.title || embed.type}</p>
                                            <p className="text-xs text-slate-500">{info?.description || ""}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8">
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500">
                        <Cloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No interactive elements yet</p>
                        <p className="text-xs">Add polls, Q&A, quizzes and more!</p>
                    </div>
                )
            }

            {/* Quick Add Buttons */}
            <div className="grid grid-cols-5 gap-2">
                {Object.entries(embedTypeInfo).map(([key, info]) => {
                    const Icon = info.icon;
                    return (
                        <button
                            key={key}
                            onClick={() => {
                                setEmbedType(key as InteractiveEmbed["type"]);
                                setIsCreateOpen(true);
                            }}
                            className="p-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex flex-col items-center gap-1"
                        >
                            <Icon className={`h-4 w-4 ${info.color}`} />
                            <span className="text-[10px] text-slate-500">{info.title}</span>
                        </button>
                    );
                })}
            </div>
        </div >
    );
}
