'use client';

import React, { useState, useId } from 'react';
// import { useMutation } from '@tanstack/react-query';
import {
  HelpCircle,
  BarChart3,
  ListChecks,
  MessageSquare,
  Plus,
  Trash2,
  GripVertical,
  Check,
  X,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
// import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'rating' | 'ranking';
  question: string;
  options?: string[];
  correctAnswer?: string | string[];
  points?: number;
  timeLimit?: number;
  imageUrl?: string;
  explanation?: string;
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  allowMultiple: boolean;
  showResults: 'immediately' | 'after-close' | 'never';
  anonymous: boolean;
  timeLimit?: number;
}

interface QuizPollBuilderProps {
  slideId: string;
  onInsertQuiz: (quiz: { questions: QuizQuestion[]; settings: unknown }) => void;
  onInsertPoll: (poll: Poll) => void;
}

export function QuizPollBuilder({
  onInsertQuiz,
  onInsertPoll,
}: QuizPollBuilderProps) {
  const [activeTab, setActiveTab] = useState<'quiz' | 'poll'>('quiz');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const pollId = useId();
  const [currentPoll, setCurrentPoll] = useState<Poll>({
    id: `poll-${pollId}`,
    question: '',
    options: ['', ''],
    allowMultiple: false,
    showResults: 'immediately',
    anonymous: false,
  });
  const [quizSettings, setQuizSettings] = useState({
    shuffleQuestions: false,
    shuffleAnswers: false,
    showCorrectAnswers: true,
    passingScore: 70,
    timeLimitPerQuestion: 30,
  });
  const [showPreview, setShowPreview] = useState(false);

  const addQuestion = (type: QuizQuestion['type']) => {
    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}`,
      type,
      question: '',
      options: type === 'multiple-choice' ? ['', '', '', ''] : type === 'true-false' ? ['True', 'False'] : undefined,
      correctAnswer: type === 'true-false' ? 'True' : undefined,
      points: 10,
      timeLimit: 30,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < questions.length) {
      [newQuestions[index], newQuestions[targetIndex]] = [
        newQuestions[targetIndex],
        newQuestions[index],
      ];
      setQuestions(newQuestions);
    }
  };

  const addPollOption = () => {
    setCurrentPoll({
      ...currentPoll,
      options: [...currentPoll.options, ''],
    });
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...currentPoll.options];
    newOptions[index] = value;
    setCurrentPoll({ ...currentPoll, options: newOptions });
  };

  const removePollOption = (index: number) => {
    if (currentPoll.options.length > 2) {
      setCurrentPoll({
        ...currentPoll,
        options: currentPoll.options.filter((_, i) => i !== index),
      });
    }
  };

  const handleInsertQuiz = () => {
    if (questions.length > 0) {
      onInsertQuiz({ questions, settings: quizSettings });
    }
  };

  const handleInsertPoll = () => {
    if (currentPoll.question && currentPoll.options.every((o) => o.trim())) {
      onInsertPoll(currentPoll);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'quiz' | 'poll')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quiz">
            <HelpCircle className="mr-2 h-4 w-4" />
            Quiz
          </TabsTrigger>
          <TabsTrigger value="poll">
            <BarChart3 className="mr-2 h-4 w-4" />
            Poll
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quiz" className="space-y-4">
          {/* Add Question Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuestion('multiple-choice')}
            >
              <ListChecks className="mr-2 h-4 w-4" />
              Multiple Choice
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuestion('true-false')}
            >
              <Check className="mr-2 h-4 w-4" />
              True/False
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuestion('short-answer')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Short Answer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addQuestion('rating')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Rating
            </Button>
          </div>

          {/* Questions List */}
          <ScrollArea className="h-[400px]">
            {questions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <HelpCircle className="mx-auto h-12 w-12 opacity-50" />
                <p className="mt-2">No questions yet</p>
                <p className="text-sm">Add a question type to get started</p>
              </div>
            ) : (
              <div className="space-y-4 pr-4">
                {questions.map((question, index) => (
                  <Card key={question.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className="capitalize">
                            {question.type.replace('-', ' ')}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Q{index + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveQuestion(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveQuestion(index, 'down')}
                            disabled={index === questions.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQuestion(question.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Question Text */}
                      <div>
                        <Label>Question</Label>
                        <Textarea
                          value={question.question}
                          onChange={(e) =>
                            updateQuestion(question.id, { question: e.target.value })
                          }
                          placeholder="Enter your question..."
                          className="mt-1"
                        />
                      </div>

                      {/* Options for Multiple Choice */}
                      {question.type === 'multiple-choice' && (
                        <div className="space-y-2">
                          <Label>Answer Options</Label>
                          {question.options?.map((option, optIndex) => (

                            <div key={`${question.id}-${option}`} className="flex items-center gap-2">
                              <RadioGroup
                                value={question.correctAnswer as string}
                                onValueChange={(v) =>
                                  updateQuestion(question.id, { correctAnswer: v })
                                }
                              >
                                <RadioGroupItem value={option} />
                              </RadioGroup>
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(question.options || [])];
                                  newOptions[optIndex] = e.target.value;
                                  updateQuestion(question.id, { options: newOptions });
                                }}
                                placeholder={`Option ${optIndex + 1}`}
                              />
                              {(question.options?.length || 0) > 2 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const newOptions = question.options?.filter(
                                      (_, i) => i !== optIndex
                                    );
                                    updateQuestion(question.id, { options: newOptions });
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newOptions = [...(question.options || []), ''];
                              updateQuestion(question.id, { options: newOptions });
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Option
                          </Button>
                        </div>
                      )}

                      {/* True/False Options */}
                      {question.type === 'true-false' && (
                        <div>
                          <Label>Correct Answer</Label>
                          <RadioGroup
                            value={question.correctAnswer as string}
                            onValueChange={(v) =>
                              updateQuestion(question.id, { correctAnswer: v })
                            }
                            className="mt-2 flex gap-4"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="True" />
                              <Label>True</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="False" />
                              <Label>False</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      )}

                      {/* Settings Row */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Points:</Label>
                          <Input
                            type="number"
                            value={question.points}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                points: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <Input
                            type="number"
                            value={question.timeLimit}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                timeLimit: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">sec</span>
                        </div>
                      </div>

                      {/* Explanation */}
                      <div>
                        <Label>Explanation (shown after answering)</Label>
                        <Textarea
                          value={question.explanation || ''}
                          onChange={(e) =>
                            updateQuestion(question.id, { explanation: e.target.value })
                          }
                          placeholder="Explain why this is the correct answer..."
                          className="mt-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Quiz Settings */}
          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Settings className="h-4 w-4" />
                  Quiz Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <Label>Shuffle Questions</Label>
                  <Switch
                    checked={quizSettings.shuffleQuestions}
                    onCheckedChange={(v) =>
                      setQuizSettings({ ...quizSettings, shuffleQuestions: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Shuffle Answers</Label>
                  <Switch
                    checked={quizSettings.shuffleAnswers}
                    onCheckedChange={(v) =>
                      setQuizSettings({ ...quizSettings, shuffleAnswers: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Show Correct Answers</Label>
                  <Switch
                    checked={quizSettings.showCorrectAnswers}
                    onCheckedChange={(v) =>
                      setQuizSettings({ ...quizSettings, showCorrectAnswers: v })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>Passing Score:</Label>
                  <Input
                    type="number"
                    value={quizSettings.passingScore}
                    onChange={(e) =>
                      setQuizSettings({
                        ...quizSettings,
                        passingScore: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-20"
                  />
                  <span>%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              Preview Quiz
            </Button>
            <Button onClick={handleInsertQuiz} disabled={questions.length === 0}>
              Insert Quiz
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="poll" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              {/* Poll Question */}
              <div>
                <Label>Poll Question</Label>
                <Textarea
                  value={currentPoll.question}
                  onChange={(e) =>
                    setCurrentPoll({ ...currentPoll, question: e.target.value })
                  }
                  placeholder="What would you like to ask?"
                  className="mt-1"
                />
              </div>

              {/* Poll Options */}
              <div className="space-y-2">
                <Label>Options</Label>
                {currentPoll.options.map((option, index) => (

                  <div key={option} className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <Input
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    {currentPoll.options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePollOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addPollOption}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Option
                </Button>
              </div>

              {/* Poll Settings */}
              <div className="space-y-4 rounded-lg border p-4">
                <h4 className="font-medium">Settings</h4>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Multiple Answers</Label>
                    <p className="text-xs text-muted-foreground">
                      Participants can select more than one option
                    </p>
                  </div>
                  <Switch
                    checked={currentPoll.allowMultiple}
                    onCheckedChange={(v) =>
                      setCurrentPoll({ ...currentPoll, allowMultiple: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Anonymous Responses</Label>
                    <p className="text-xs text-muted-foreground">
                      Hide participant identities
                    </p>
                  </div>
                  <Switch
                    checked={currentPoll.anonymous}
                    onCheckedChange={(v) =>
                      setCurrentPoll({ ...currentPoll, anonymous: v })
                    }
                  />
                </div>

                <div>
                  <Label>Show Results</Label>
                  <Select
                    value={currentPoll.showResults}
                    onValueChange={(v: 'immediately' | 'after-close' | 'never') =>
                      setCurrentPoll({ ...currentPoll, showResults: v })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediately">Immediately</SelectItem>
                      <SelectItem value="after-close">After Poll Closes</SelectItem>
                      <SelectItem value="never">Never (Presenter Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label>Time Limit:</Label>
                  <Input
                    type="number"
                    value={currentPoll.timeLimit || ''}
                    onChange={(e) =>
                      setCurrentPoll({
                        ...currentPoll,
                        timeLimit: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="No limit"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end">
            <Button
              onClick={handleInsertPoll}
              disabled={
                !currentPoll.question ||
                !currentPoll.options.every((o) => o.trim())
              }
            >
              Insert Poll
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quiz Preview</DialogTitle>
            <DialogDescription>
              This is how your quiz will appear to participants
            </DialogDescription>
          </DialogHeader>
          <QuizPreview questions={questions} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quiz Preview Component
function QuizPreview({ questions }: { questions: QuizQuestion[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = questions[currentIndex];

  if (!currentQuestion) {
    return <div className="py-8 text-center">No questions to preview</div>;
  }

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    setShowResult(true);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-4">
        <Progress value={((currentIndex + 1) / questions.length) * 100} />
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Question */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-medium">{currentQuestion.question || 'Question preview'}</h3>

        {/* Options */}
        {currentQuestion.type === 'multiple-choice' && (
          <div className="mt-4 space-y-2">
            {currentQuestion.options?.map((option, index) => (
              <button

                key={option}
                onClick={() => handleAnswer(option)}
                disabled={showResult}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  selectedAnswer === option && isCorrect && 'border-green-500 bg-green-50',
                  selectedAnswer === option && !isCorrect && 'border-red-500 bg-red-50',
                  showResult && option === currentQuestion.correctAnswer && 'border-green-500 bg-green-50',
                  !showResult && 'hover:bg-muted'
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {String.fromCharCode(65 + index)}
                </div>
                <span>{option}</span>
                {showResult && option === currentQuestion.correctAnswer && (
                  <Check className="ml-auto h-5 w-5 text-green-500" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* True/False */}
        {currentQuestion.type === 'true-false' && (
          <div className="mt-4 flex gap-4">
            {['True', 'False'].map((option) => (
              <Button
                key={option}
                variant={selectedAnswer === option ? 'default' : 'outline'}
                onClick={() => handleAnswer(option)}
                disabled={showResult}
                className="flex-1"
              >
                {option}
              </Button>
            ))}
          </div>
        )}

        {/* Result */}
        {showResult && currentQuestion.explanation && (
          <div className="mt-4 rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-800">{currentQuestion.explanation}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      {showResult && currentIndex < questions.length - 1 && (
        <Button onClick={nextQuestion} className="w-full">
          Next Question
        </Button>
      )}
    </div>
  );
}

// Live Poll Display Component
export function LivePollDisplay({
  poll,
  results,
  isActive,
  onVote,
}: {
  poll: Poll;
  results?: { option: string; votes: number; percentage: number }[];
  isActive: boolean;
  onVote?: (option: string) => void;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = (option: string) => {
    if (!hasVoted && onVote) {
      setSelectedOption(option);
      setHasVoted(true);
      onVote(option);
    }
  };

  const showResults = hasVoted || poll.showResults === 'immediately';

  return (
    <div className="space-y-4 rounded-xl border bg-background p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? 'Live' : 'Closed'}
        </Badge>
        {results && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {results.reduce((sum, r) => sum + r.votes, 0)} responses
          </span>
        )}
      </div>

      <h3 className="text-xl font-semibold">{poll.question}</h3>

      <div className="space-y-3">
        {poll.options.map((option, _index) => {
          const result = results?.find((r) => r.option === option);
          return (
            <button

              key={option}
              onClick={() => handleVote(option)}
              disabled={hasVoted || !isActive}
              className={cn(
                'relative w-full overflow-hidden rounded-lg border p-4 text-left transition-all',
                selectedOption === option && 'border-primary bg-primary/5',
                !hasVoted && isActive && 'hover:border-primary/50'
              )}
            >
              {showResults && result && (
                <div
                  className="absolute inset-0 bg-primary/10"
                  style={{ width: `${result.percentage}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="font-medium">{option}</span>
                {showResults && result && (
                  <span className="text-sm font-semibold">
                    {result.percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
