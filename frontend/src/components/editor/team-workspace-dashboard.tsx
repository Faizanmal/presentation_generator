'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  UserPlus,
  Settings,
  MoreHorizontal,
  Crown,
  Shield,
  User,
  Mail,
  Calendar,
  Clock,
  Presentation,
  Eye,
  Edit3,
  Trash2,
  Search,
  Filter,
  SortAsc,
  Grid3X3,
  List,
  FolderOpen,
  Star,
  StarOff,
  Share2,
  Download,
  BarChart2,
  Activity,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  RefreshCw,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: string;
  lastActive: string;
  presentationsCount: number;
}

interface SharedPresentation {
  id: string;
  title: string;
  thumbnail?: string;
  owner: {
    id: string;
    name: string;
    avatar?: string;
  };
  sharedWith: TeamMember[];
  permission: 'view' | 'edit' | 'admin';
  lastModified: string;
  status: 'draft' | 'published' | 'archived';
  views: number;
  starred: boolean;
}

interface TeamActivity {
  id: string;
  type: 'created' | 'edited' | 'shared' | 'commented' | 'published' | 'deleted';
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  target: string;
  targetType: 'presentation' | 'folder' | 'team';
  timestamp: string;
}

interface TeamStats {
  totalMembers: number;
  totalPresentations: number;
  totalViews: number;
  activeEditors: number;
  storageUsed: number;
  storageLimit: number;
}

const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@company.com',
    role: 'owner',
    status: 'active',
    joinedAt: '2024-01-15',
    lastActive: '2 hours ago',
    presentationsCount: 45,
  },
  {
    id: '2',
    name: 'Sarah Wilson',
    email: 'sarah@company.com',
    role: 'admin',
    status: 'active',
    joinedAt: '2024-02-20',
    lastActive: '1 hour ago',
    presentationsCount: 32,
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@company.com',
    role: 'editor',
    status: 'active',
    joinedAt: '2024-03-10',
    lastActive: '3 hours ago',
    presentationsCount: 18,
  },
  {
    id: '4',
    name: 'Emily Brown',
    email: 'emily@company.com',
    role: 'editor',
    status: 'pending',
    joinedAt: '2024-06-01',
    lastActive: 'Never',
    presentationsCount: 0,
  },
  {
    id: '5',
    name: 'David Lee',
    email: 'david@company.com',
    role: 'viewer',
    status: 'active',
    joinedAt: '2024-04-15',
    lastActive: '1 day ago',
    presentationsCount: 0,
  },
];

const MOCK_PRESENTATIONS: SharedPresentation[] = [
  {
    id: '1',
    title: 'Q4 Sales Strategy',
    owner: { id: '1', name: 'John Doe' },
    sharedWith: MOCK_TEAM_MEMBERS.slice(0, 3),
    permission: 'edit',
    lastModified: '2 hours ago',
    status: 'published',
    views: 234,
    starred: true,
  },
  {
    id: '2',
    title: 'Product Roadmap 2025',
    owner: { id: '2', name: 'Sarah Wilson' },
    sharedWith: MOCK_TEAM_MEMBERS.slice(1, 4),
    permission: 'view',
    lastModified: '1 day ago',
    status: 'draft',
    views: 89,
    starred: false,
  },
  {
    id: '3',
    title: 'Team Onboarding',
    owner: { id: '3', name: 'Mike Johnson' },
    sharedWith: MOCK_TEAM_MEMBERS,
    permission: 'admin',
    lastModified: '3 days ago',
    status: 'published',
    views: 567,
    starred: true,
  },
];

const MOCK_ACTIVITIES: TeamActivity[] = [
  {
    id: '1',
    type: 'edited',
    user: { id: '1', name: 'John Doe' },
    target: 'Q4 Sales Strategy',
    targetType: 'presentation',
    timestamp: '2 hours ago',
  },
  {
    id: '2',
    type: 'shared',
    user: { id: '2', name: 'Sarah Wilson' },
    target: 'Product Roadmap 2025',
    targetType: 'presentation',
    timestamp: '4 hours ago',
  },
  {
    id: '3',
    type: 'created',
    user: { id: '3', name: 'Mike Johnson' },
    target: 'Marketing Campaign',
    targetType: 'presentation',
    timestamp: '1 day ago',
  },
  {
    id: '4',
    type: 'commented',
    user: { id: '5', name: 'David Lee' },
    target: 'Team Onboarding',
    targetType: 'presentation',
    timestamp: '2 days ago',
  },
  {
    id: '5',
    type: 'published',
    user: { id: '1', name: 'John Doe' },
    target: 'Annual Report',
    targetType: 'presentation',
    timestamp: '3 days ago',
  },
];

const MOCK_STATS: TeamStats = {
  totalMembers: 5,
  totalPresentations: 95,
  totalViews: 12890,
  activeEditors: 3,
  storageUsed: 2.4,
  storageLimit: 10,
};

export function TeamWorkspaceDashboard() {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>(MOCK_TEAM_MEMBERS);
  const [presentations, setPresentations] = useState<SharedPresentation[]>(MOCK_PRESENTATIONS);
  const [activities] = useState<TeamActivity[]>(MOCK_ACTIVITIES);
  const [stats] = useState<TeamStats>(MOCK_STATS);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');

  const getRoleIcon = (role: TeamMember['role']) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'editor':
        return <Edit3 className="h-4 w-4 text-green-500" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: TeamMember['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>;
    }
  };

  const getActivityIcon = (type: TeamActivity['type']) => {
    switch (type) {
      case 'created':
        return <FilePresentation className="h-4 w-4 text-green-500" />;
      case 'edited':
        return <Edit3 className="h-4 w-4 text-blue-500" />;
      case 'shared':
        return <Share2 className="h-4 w-4 text-purple-500" />;
      case 'commented':
        return <Activity className="h-4 w-4 text-orange-500" />;
      case 'published':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
    }
  };

  const toggleStar = (presentationId: string) => {
    setPresentations((prev) =>
      prev.map((p) =>
        p.id === presentationId ? { ...p, starred: !p.starred } : p
      )
    );
  };

  const updateMemberRole = (memberId: string, role: TeamMember['role']) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role } : m))
    );
  };

  const removeMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleInvite = () => {
    if (!inviteEmail) return;
    
    const newMember: TeamMember = {
      id: `new_${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'pending',
      joinedAt: new Date().toISOString().split('T')[0],
      lastActive: 'Never',
      presentationsCount: 0,
    };
    
    setMembers((prev) => [...prev, newMember]);
    setInviteEmail('');
    setShowInviteDialog(false);
  };

  const filteredPresentations = presentations.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Team Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Workspace
          </DialogTitle>
          <DialogDescription>
            Manage your team, shared presentations, and collaboration settings
          </DialogDescription>
        </DialogHeader>

        {/* Stats Overview */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <FilePresentation className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalPresentations}</p>
                  <p className="text-xs text-muted-foreground">Presentations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Eye className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{(stats.totalViews / 1000).toFixed(1)}k</p>
                  <p className="text-xs text-muted-foreground">Total Views</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Edit3 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeEditors}</p>
                  <p className="text-xs text-muted-foreground">Active Editors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <FolderOpen className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.storageUsed}/{stats.storageLimit}
                  </p>
                  <p className="text-xs text-muted-foreground">Storage (GB)</p>
                </div>
              </div>
              <Progress
                value={(stats.storageUsed / stats.storageLimit) * 100}
                className="mt-2 h-1"
              />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="presentations" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="presentations">Shared Presentations</TabsTrigger>
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="activity">Activity Feed</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="presentations" className="mt-4">
            {/* Search and filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search presentations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <SortAsc className="h-4 w-4" />
              </Button>
              <div className="border-l pl-3 flex gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-3 gap-4">
                  {filteredPresentations.map((presentation) => (
                    <Card key={presentation.id} className="group cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        {/* Thumbnail */}
                        <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-lg relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FilePresentation className="h-12 w-12 text-primary/40" />
                          </div>
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(presentation.id);
                              }}
                            >
                              {presentation.starred ? (
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Badge
                            className={`absolute bottom-2 left-2 ${
                              presentation.status === 'published'
                                ? 'bg-green-100 text-green-700'
                                : presentation.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {presentation.status}
                          </Badge>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                          <h3 className="font-medium truncate">{presentation.title}</h3>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[10px]">
                                {presentation.owner.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{presentation.owner.name}</span>
                          </div>
                          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {presentation.lastModified}
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {presentation.views}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPresentations.map((presentation) => (
                    <Card key={presentation.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-24 aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded flex items-center justify-center">
                          <FilePresentation className="h-8 w-8 text-primary/40" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{presentation.title}</h3>
                            <Badge
                              className={`${
                                presentation.status === 'published'
                                  ? 'bg-green-100 text-green-700'
                                  : presentation.status === 'draft'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {presentation.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            by {presentation.owner.name} • {presentation.lastModified}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="flex items-center gap-1 text-sm">
                            <Eye className="h-4 w-4" />
                            {presentation.views}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleStar(presentation.id)}
                          >
                            {presentation.starred ? (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <StarOff className="h-4 w-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search members..." className="pl-9" />
              </div>
              <Button onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          {getRoleIcon(member.role)}
                          {getStatusBadge(member.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Joined {member.joinedAt}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Active {member.lastActive}
                          </span>
                          <span className="flex items-center gap-1">
                            <FilePresentation className="h-3 w-3" />
                            {member.presentationsCount} presentations
                          </span>
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            onValueChange={(value: TeamMember['role']) =>
                              updateMemberRole(member.id, value)
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Invite Dialog */}
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your team workspace
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value: 'admin' | 'editor' | 'viewer') =>
                        setInviteRole(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            Admin - Full access
                          </div>
                        </SelectItem>
                        <SelectItem value="editor">
                          <div className="flex items-center gap-2">
                            <Edit3 className="h-4 w-4 text-green-500" />
                            Editor - Can edit presentations
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-gray-500" />
                            Viewer - View only
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={!inviteEmail}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activity.user.avatar} />
                      <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user.name}</span>{' '}
                        <span className="text-muted-foreground">{activity.type}</span>{' '}
                        <span className="font-medium">{activity.target}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.timestamp}
                      </p>
                    </div>
                    {getActivityIcon(activity.type)}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-6 pr-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Workspace Settings</CardTitle>
                    <CardDescription>
                      Configure your team workspace preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Workspace Name</Label>
                      <Input defaultValue="Acme Corporation" />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Permission for New Presentations</Label>
                      <Select defaultValue="edit">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">View Only</SelectItem>
                          <SelectItem value="comment">Can Comment</SelectItem>
                          <SelectItem value="edit">Can Edit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notification Settings</CardTitle>
                    <CardDescription>
                      Choose what updates you want to receive
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>New member joins</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when someone joins the team
                        </p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Presentation shared</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when a presentation is shared with you
                        </p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Comments & mentions</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when someone mentions you
                        </p>
                      </div>
                      <input type="checkbox" defaultChecked className="toggle" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Danger Zone</CardTitle>
                    <CardDescription>
                      Irreversible actions for your workspace
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                      <div>
                        <p className="font-medium text-red-700">Delete Workspace</p>
                        <p className="text-sm text-red-600">
                          This will permanently delete all presentations and data
                        </p>
                      </div>
                      <Button variant="destructive">Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
