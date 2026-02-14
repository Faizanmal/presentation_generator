'use client';

import { useState } from 'react';
import {
  Building2,
  Users,
  Mail,
  Shield,
  Palette,
  Globe,
  Settings,
  Loader2,
  MoreHorizontal,
  UserPlus,
  Crown,
  Eye,
  Trash2,
  Send,
  X,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  useOrganization,
  useOrganizationMembers,
  useTeamInvitations,
  useSSOConfig,
  useWhiteLabel,
} from '@/hooks/use-organization';
import type { Organization } from '@/types';
import Image from 'next/image';
// import { cn } from '@/lib/utils';

interface OrganizationSettingsProps {
  orgId: string;
}

export function OrganizationSettings({ orgId }: OrganizationSettingsProps) {
  const { organization, isLoading } = useOrganization(orgId);

  if (isLoading || !organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            {(organization as Organization).name}
          </h2>
          <p className="text-muted-foreground">
            Manage your organization settings and team
          </p>
        </div>
        <Badge variant={(organization as Organization).plan === 'ENTERPRISE' ? 'default' : 'secondary'}>
          {(organization as Organization).plan} Plan
        </Badge>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="w-4 h-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="w-4 h-4" />
            Invitations
          </TabsTrigger>
          {(organization as Organization).plan === 'ENTERPRISE' && (
            <>
              <TabsTrigger value="sso" className="gap-2">
                <Shield className="w-4 h-4" />
                SSO
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-2">
                <Palette className="w-4 h-4" />
                White Label
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <MembersTab orgId={orgId} />
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          <InvitationsTab orgId={orgId} />
        </TabsContent>

        <TabsContent value="sso" className="mt-6">
          <SSOTab orgId={orgId} />
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <WhiteLabelTab orgId={orgId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <GeneralSettingsTab organization={organization} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MembersTab({ orgId }: { orgId: string }) {
  const { members, isLoading, updateRole, removeMember } = useOrganizationMembers(orgId);

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin" />;
  }

  const roleIcons: Record<string, React.ElementType> = {
    OWNER: Crown,
    ADMIN: Shield,
    MEMBER: Users,
    VIEWER: Eye,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>
          Manage your organization&apos;s team members and their roles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member) => {
              const RoleIcon = roleIcons[member.role] || Users;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.user.image || undefined} />
                        <AvatarFallback>
                          {member.user.name?.[0] || member.user.email[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user.name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <RoleIcon className="w-3 h-3" />
                      {member.role.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.lastActiveAt
                      ? new Date(member.lastActiveAt).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {member.role !== 'OWNER' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              updateRole({
                                memberId: member.id,
                                role: member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                              })
                            }
                          >
                            {member.role === 'ADMIN' ? 'Demote to Member' : 'Promote to Admin'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => removeMember(member.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvitationsTab({ orgId }: { orgId: string }) {
  const [isInviting, setIsInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');

  const {
    invitations,
    isLoading,
    invite,
    isInviting: isPending,
    resendInvitation,
    cancelInvitation,
  } = useTeamInvitations(orgId);

  const handleInvite = () => {
    if (!email) {return;}
    invite({ email, role });
    setEmail('');
    setIsInviting(false);
  };

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>
            Invite new members to your organization
          </CardDescription>
        </div>
        <Dialog open={isInviting} onOpenChange={setIsInviting}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your organization
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'ADMIN' | 'MEMBER' | 'VIEWER')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviting(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={isPending || !email}>
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {invitations && invitations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>{invitation.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{invitation.role.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invitation.status === 'PENDING'
                          ? 'secondary'
                          : invitation.status === 'ACCEPTED'
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {invitation.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {invitation.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resendInvitation(invitation.id)}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelInvitation(invitation.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No pending invitations
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SSOTab({ orgId }: { orgId: string }) {
  const {
    ssoConfig,
    isLoading,
    configureSAML,
    isConfiguringSAML,
    toggleSSO,
    testConnection,
    isTesting,
  } = useSSOConfig(orgId);

  const [samlConfig, setSamlConfig] = useState({
    domain: '',
    issuer: '',
    ssoUrl: '',
    certificate: '',
  });

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Single Sign-On (SSO)</CardTitle>
              <CardDescription>
                Configure SAML or OIDC authentication for your organization
              </CardDescription>
            </div>
            {ssoConfig && (
              <div className="flex items-center gap-2">
                <Label htmlFor="sso-enabled">Enabled</Label>
                <Switch
                  id="sso-enabled"
                  checked={ssoConfig.enabled}
                  onCheckedChange={(checked) => toggleSSO(checked)}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ssoConfig ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge>{ssoConfig.provider}</Badge>
                <Badge variant={ssoConfig.enabled ? 'default' : 'secondary'}>
                  {ssoConfig.enabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <div className="text-sm">
                <p>
                  <strong>Domain:</strong> {ssoConfig.domain}
                </p>
                <p>
                  <strong>SSO URL:</strong> {ssoConfig.ssoUrl}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => testConnection()}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Domain</Label>
                  <Input
                    value={samlConfig.domain}
                    onChange={(e) =>
                      setSamlConfig({ ...samlConfig, domain: e.target.value })
                    }
                    placeholder="company.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Issuer</Label>
                  <Input
                    value={samlConfig.issuer}
                    onChange={(e) =>
                      setSamlConfig({ ...samlConfig, issuer: e.target.value })
                    }
                    placeholder="https://idp.company.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>SSO URL</Label>
                  <Input
                    value={samlConfig.ssoUrl}
                    onChange={(e) =>
                      setSamlConfig({ ...samlConfig, ssoUrl: e.target.value })
                    }
                    placeholder="https://idp.company.com/sso"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Certificate</Label>
                  <Textarea
                    value={samlConfig.certificate}
                    onChange={(e) =>
                      setSamlConfig({ ...samlConfig, certificate: e.target.value })
                    }
                    placeholder="Paste your X.509 certificate here..."
                    rows={4}
                  />
                </div>
              </div>
              <Button
                onClick={() => configureSAML(samlConfig)}
                disabled={isConfiguringSAML}
              >
                {isConfiguringSAML ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Configure SAML SSO
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WhiteLabelTab({ orgId }: { orgId: string }) {
  const { config, isLoading, updateConfig, verifyDomain } = useWhiteLabel(orgId);

  const [formData, setFormData] = useState({
    primaryColor: config?.primaryColor || '#3b82f6',
    secondaryColor: config?.secondaryColor || '#64748b',
    customDomain: config?.customDomain || '',
    hideWatermark: config?.hideWatermark || false,
  });

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>White Label Settings</CardTitle>
          <CardDescription>
            Customize the appearance for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo upload */}
          <div className="grid gap-2">
            <Label>Organization Logo</Label>
            <div className="flex items-center gap-4">
              {config?.logo ? (
                <Image
                  src={config.logo}
                  alt="Logo"
                  className="w-16 h-16 object-contain bg-muted rounded"
                />
              ) : (
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <Button variant="outline">Upload Logo</Button>
            </div>
          </div>

          {/* Colors */}
          <div className="grid gap-2">
            <Label>Brand Colors</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) =>
                    setFormData({ ...formData, primaryColor: e.target.value })
                  }
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <span className="text-sm">Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) =>
                    setFormData({ ...formData, secondaryColor: e.target.value })
                  }
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <span className="text-sm">Secondary</span>
              </div>
            </div>
          </div>

          {/* Custom domain */}
          <div className="grid gap-2">
            <Label>Custom Domain</Label>
            <div className="flex gap-2">
              <Input
                value={formData.customDomain}
                onChange={(e) =>
                  setFormData({ ...formData, customDomain: e.target.value })
                }
                placeholder="presentations.company.com"
              />
              <Button
                variant="outline"
                onClick={() => verifyDomain(formData.customDomain)}
              >
                <Globe className="w-4 h-4 mr-2" />
                Verify
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add a CNAME record pointing to app.presentationdesigner.com
            </p>
          </div>

          {/* Hide watermark */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Hide Watermark</Label>
              <p className="text-sm text-muted-foreground">
                Remove &quot;Made with PresentationDesigner&quot; branding
              </p>
            </div>
            <Switch
              checked={formData.hideWatermark}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, hideWatermark: checked })
              }
            />
          </div>

          <Button onClick={() => updateConfig(formData)}>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function GeneralSettingsTab({ organization }: { organization: unknown }) {
  const org = organization as { id: string; name: string };
  const { updateOrganization, isUpdating } = useOrganization(org.id);
  const [name, setName] = useState(org.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Manage your organization&apos;s basic information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Organization Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Organization Slug</Label>
          <Input value={(organization as Organization).slug || ''} disabled />
          <p className="text-xs text-muted-foreground">
            Used in URLs: app.presentationdesigner.com/{(organization as Organization).slug || 'slug'}
          </p>
        </div>
        <Button
          onClick={() => updateOrganization({ name })}
          disabled={isUpdating || name === (organization as Organization).name}
        >
          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
}
