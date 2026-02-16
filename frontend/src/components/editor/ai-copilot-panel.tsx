'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Bot, Send, Loader2, Sparkles, FileText, Lightbulb, MessageSquare,
  Mic, StickyNote, Mail, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAICopilot } from '@/hooks/use-new-features';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const quickActions = [
  { id: 'summarize-slide', label: 'Summarize Slide', icon: FileText },
  { id: 'suggest-title', label: 'Suggest Title', icon: Lightbulb },
  { id: 'speaker-notes', label: 'Speaker Notes', icon: StickyNote },
  { id: 'meeting-agenda', label: 'Meeting Agenda', icon: Users },
  { id: 'follow-up-email', label: 'Follow-up Email', icon: Mail },
];

export default function AICopilotPanel({ projectId, onClose }: { projectId: string; onClose?: () => void }) {
  const { createSession, sendMessage, executeAction } = useAICopilot(projectId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initSession = async () => {
    try {
      const session = await createSession.mutateAsync();
      setSessionId(session.id);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hi! I'm your AI co-pilot. I can help you improve slides, generate content, create speaker notes, and more. What would you like to work on?",
        timestamp: new Date().toISOString(),
      }]);
    } catch {
      toast.error('Failed to start AI session');
    }
  };

  useEffect(() => { initSession(); }, [projectId]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await sendMessage.mutateAsync({ sessionId, message: input });
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response || response.content || 'I processed your request.',
        timestamp: new Date().toISOString(),
      }]);
    } catch {
      toast.error('Failed to get response');
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = async (actionId: string) => {
    if (!sessionId) return;
    setIsTyping(true);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: `Quick action: ${quickActions.find(a => a.id === actionId)?.label}`,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const response = await executeAction.mutateAsync({ sessionId, action: actionId });
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.result || response.content || 'Action completed!',
        timestamp: new Date().toISOString(),
      }]);
    } catch {
      toast.error('Action failed');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px] w-full max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-semibold">AI Co-Pilot</span>
          <Badge variant="secondary" className="text-xs">Beta</Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 text-sm flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {quickActions.map(action => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => handleQuickAction(action.id)}
              disabled={isTyping || !sessionId}
            >
              <action.icon className="w-3 h-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Ask your AI co-pilot..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isTyping || !sessionId}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isTyping || !input.trim() || !sessionId}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
