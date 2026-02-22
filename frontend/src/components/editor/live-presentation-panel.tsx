'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Users,
  MessageSquare,
  BarChart3,
  ThumbsUp,
  X,
  Copy,
  CheckCircle,
  Clock,
  PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface LiveSession {
  sessionId: string;
  joinCode: string;
  joinUrl: string;
  attendeeCount: number;
  startedAt: string;
}

interface Question {
  id: string;
  question: string;
  author: string;
  votes: number;
  answered: boolean;
  timestamp: string;
}

interface Poll {
  id: string;
  question: string;
  options: Array<{ id: string; text: string; votes: number }>;
  isOpen: boolean;
  totalVotes: number;
}

interface LivePresentationPanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartPresentation?: () => void;
}

export function LivePresentationPanel({
  projectId,
  isOpen,
  onClose,
  onStartPresentation,
}: LivePresentationPanelProps) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Poll creation
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const startSession = async () => {
    setIsStarting(true);
    try {
      const data = await api.startLiveSession(projectId);
      setSession({
        ...data,
        attendeeCount: 0,
        startedAt: new Date().toISOString(),
      });
      toast.success('Live session started!');
      onStartPresentation?.();
    } catch (error) {
      console.error(error);
      toast.error('Failed to start live session');
    } finally {
      setIsStarting(false);
    }
  };

  const endSession = async () => {
    if (!session) { return; }
    try {
      await api.endLiveSession(projectId, session.sessionId);
      setSession(null);
      setQuestions([]);
      setPolls([]);
      toast.success('Live session ended');
    } catch (error) {
      console.error(error)
      toast.error('Failed to end session');
    }
  };

  const copyJoinLink = () => {
    if (session?.joinUrl) {
      navigator.clipboard.writeText(session.joinUrl);
      toast.success('Join link copied to clipboard');
    }
  };

  const markQuestionAnswered = (questionId: string) => {
    setQuestions(prev =>
      prev.map(q =>
        q.id === questionId ? { ...q, answered: true } : q
      )
    );
  };

  const createPoll = async () => {
    if (!session || !pollQuestion.trim()) { return; }

    const validOptions = pollOptions.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast.error('Please add at least 2 options');
      return;
    }

    try {
      const newPoll = await api.createPoll(session.sessionId, pollQuestion, validOptions);
      setPolls(prev => [...prev, {
        id: String((newPoll as Record<string, unknown>).id || (newPoll as Record<string, unknown>).pollId || `poll-${Date.now()}`),
        question: pollQuestion,
        options: validOptions.map((text, idx) => ({ id: `opt-${idx}`, text, votes: 0 })),
        isOpen: true,
        totalVotes: 0
      }]);
      setShowPollDialog(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      toast.success('Poll created!');
    } catch (error) {
      console.error(error)
      toast.error('Failed to create poll');
    }
  };

  const closePoll = async (pollId: string) => {
    if (!session) { return; }
    try {
      // const results = await api.closePoll(session.sessionId, pollId);
      setPolls(prev =>
        prev.map(p =>
          p.id === pollId ? { ...p, isOpen: false } : p
        )
      );
      toast.success('Poll closed');
    } catch (error) {
      console.error(error)
      toast.error('Failed to close poll');
    }
  };

  // Simulate real-time updates (in production, use WebSocket)
  useEffect(() => {
    if (!session) { return; }

    const interval = setInterval(async () => {
      try {
        const newQuestions = await api.getLiveSessionQuestions(session.sessionId);
        setQuestions(newQuestions);
      } catch (error) {
        console.error(error)
        // Silently fail for polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session]);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getElapsedTime = () => {
    if (!session?.startedAt) { return '0:00'; }
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-175 max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-red-500" />
            Live Presentation
          </DialogTitle>
        </DialogHeader>

        {!session ? (
          // Start session view
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Play className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Start Live Session</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Present live to your audience with real-time Q&A, polls, and engagement tracking.
            </p>
            <Button onClick={startSession} disabled={isStarting} size="lg">
              {isStarting ? (
                <>Starting...</>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Go Live
                </>
              )}
            </Button>
          </div>
        ) : (
          // Active session view
          <div className="space-y-4">
            {/* Session info bar */}
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-4">
                <Badge variant="destructive" className="animate-pulse">
                  ● LIVE
                </Badge>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {getElapsedTime()}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  {session.attendeeCount} viewers
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyJoinLink}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Link
                </Button>
                <Button variant="destructive" size="sm" onClick={endSession}>
                  End Session
                </Button>
              </div>
            </div>

            {/* Join code */}
            <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <span className="text-sm text-slate-500">Join Code:</span>
              <code className="font-mono font-bold text-lg">{session.joinCode}</code>
              <Button variant="ghost" size="icon" onClick={copyJoinLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="questions" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Q&A ({questions.filter(q => !q.answered).length})
                </TabsTrigger>
                <TabsTrigger value="polls" className="flex-1">
                  <PieChart className="h-4 w-4 mr-1" />
                  Polls ({polls.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Viewers</CardDescription>
                      <CardTitle className="text-2xl">{session.attendeeCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Questions</CardDescription>
                      <CardTitle className="text-2xl">{questions.length}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Engagement</CardDescription>
                      <CardTitle className="text-2xl">
                        {session.attendeeCount > 0
                          ? Math.round((questions.length / session.attendeeCount) * 100)
                          : 0}%
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="questions" className="mt-4">
                <ScrollArea className="h-75">
                  {questions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No questions yet</p>
                      <p className="text-sm">Questions from viewers will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {questions
                        .sort((a, b) => b.votes - a.votes)
                        .map((question) => (
                          <div
                            key={question.id}
                            className={cn(
                              'p-3 rounded-lg border',
                              question.answered
                                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-medium">{question.question}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {question.author} • {formatTime(question.timestamp)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                  <ThumbsUp className="h-3 w-3 mr-1" />
                                  {question.votes}
                                </Badge>
                                {!question.answered && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => markQuestionAnswered(question.id)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="polls" className="mt-4">
                <div className="space-y-4">
                  <Button onClick={() => setShowPollDialog(true)} className="w-full">
                    <PieChart className="h-4 w-4 mr-2" />
                    Create Poll
                  </Button>

                  <ScrollArea className="h-62.5">
                    {polls.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No polls yet</p>
                        <p className="text-sm">Create a poll to engage your audience</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {polls.map((poll) => (
                          <Card key={poll.id}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{poll.question}</CardTitle>
                                <Badge variant={poll.isOpen ? 'default' : 'secondary'}>
                                  {poll.isOpen ? 'Open' : 'Closed'}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {poll.options.map((option) => {
                                  const percentage = poll.totalVotes > 0
                                    ? Math.round((option.votes / poll.totalVotes) * 100)
                                    : 0;
                                  return (
                                    <div key={option.id} className="space-y-1">
                                      <div className="flex justify-between text-sm">
                                        <span>{option.text}</span>
                                        <span>{percentage}% ({option.votes})</span>
                                      </div>
                                      <Progress value={percentage} className="h-2" />
                                    </div>
                                  );
                                })}
                              </div>
                              {poll.isOpen && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-3"
                                  onClick={() => closePoll(poll.id)}
                                >
                                  Close Poll
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>

      {/* Create Poll Dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Poll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Question</Label>
              <Input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="What would you like to ask?"
              />
            </div>
            <div>
              <Label>Options</Label>
              <div className="space-y-2 mt-2">
                {pollOptions.map((option, index) => (

                  <div key={option} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[index] = e.target.value;
                        setPollOptions(newOptions);
                      }}
                      placeholder={`Option ${index + 1}`}
                    />
                    {pollOptions.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setPollOptions(pollOptions.filter((_, i) => i !== index));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                  >
                    Add Option
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPollDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createPoll}>Create Poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
