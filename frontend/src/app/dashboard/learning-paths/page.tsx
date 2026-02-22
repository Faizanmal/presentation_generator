'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  GraduationCap, ArrowLeft, Plus, Loader2, BookOpen, CheckCircle2,
  Clock, Award, Download, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useLearningPaths } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function LearningPathsPage() {
  const { paths, createPath, getCertificate } = useLearningPaths();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) {return;}
    try {
      await createPath.mutateAsync({ title, description, modules: [] });
      setOpen(false);
      setTitle('');
      setDescription('');
      toast.success('Learning path created');
    } catch {
      toast.error('Failed to create learning path');
    }
  };

  const handleCertificate = async (pathId: string) => {
    try {
      const result = await getCertificate.mutateAsync(pathId);
      if (result.url) {
        window.open(result.url, '_blank');
      }
      toast.success('Certificate generated!');
    } catch {
      toast.error('Not eligible for certificate yet');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <GraduationCap className="w-8 h-8 text-primary" />
                Learning Paths
              </h1>
              <p className="text-muted-foreground mt-1">
                Structured presentation skill development
              </p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Path</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Learning Path</DialogTitle>
                <DialogDescription>Define a new learning journey</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Executive Presentations" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will learners achieve?" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={createPath.isPending || !title.trim()}>
                  {createPath.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {paths.isLoading && (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
          {paths.data?.map((path: {
            id: string; title: string; description: string; progress: number;
            modules: { id: string; title: string; completed: boolean; duration: string }[];
            completedAt?: string;
          }) => (
            <Card key={path.id} className={path.completedAt ? 'border-green-500/50' : ''}>
              <CardContent className="p-5">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedPath(expandedPath === path.id ? null : path.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{path.title}</p>
                      <p className="text-sm text-muted-foreground">{path.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {path.completedAt && (
                      <Badge className="bg-green-500/10 text-green-600">
                        <Award className="w-3 h-3 mr-1" /> Completed
                      </Badge>
                    )}
                    <div className="text-right">
                      <span className="text-sm font-medium">{path.progress}%</span>
                      <Progress value={path.progress} className="w-24 h-2 mt-1" />
                    </div>
                    <ChevronRight className={`w-5 h-5 transition-transform ${expandedPath === path.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {expandedPath === path.id && path.modules && (
                  <div className="mt-4 ml-12 space-y-2">
                    {path.modules.map((mod) => (
                      <div key={mod.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        {mod.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <span className={`text-sm flex-1 ${mod.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {mod.title}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" /> {mod.duration}
                        </div>
                      </div>
                    ))}
                    {path.completedAt && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={() => handleCertificate(path.id)}>
                        <Download className="w-3 h-3 mr-1" /> Download Certificate
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!paths.isLoading && (!paths.data || paths.data.length === 0) && (
            <Card className="p-12 text-center">
              <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No learning paths yet. Create one to get started!</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
