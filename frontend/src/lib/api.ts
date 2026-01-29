import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
  Project,
  CreateProjectInput,
  GenerateProjectInput,
  Slide,
  CreateSlideInput,
  Block,
  CreateBlockInput,
  UpdateBlockInput,
  Theme,
  Subscription,
  PaginatedResponse,
  Asset,
  PresignedUploadResponse,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    // Load token from localStorage on init
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/register', credentials);
    this.setToken(data.accessToken);
    return data;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/auth/login', credentials);
    this.setToken(data.accessToken);
    return data;
  }

  async getProfile(): Promise<User> {
    const { data } = await this.client.get<User>('/auth/me');
    return data;
  }

  async refreshToken(): Promise<{ accessToken: string }> {
    const { data } = await this.client.post<{ accessToken: string }>('/auth/refresh');
    this.setToken(data.accessToken);
    return data;
  }

  logout() {
    this.clearToken();
  }

  // ============================================
  // PROJECTS ENDPOINTS
  // ============================================

  async getProjects(page = 1, limit = 20): Promise<PaginatedResponse<Project>> {
    const { data } = await this.client.get<PaginatedResponse<Project>>('/projects', {
      params: { page, limit },
    });
    return data;
  }

  async getProject(id: string): Promise<Project> {
    const { data } = await this.client.get<Project>(`/projects/${id}`);
    return data;
  }

  async getProjectByShareToken(shareToken: string): Promise<Project> {
    const { data } = await this.client.get<Project>(`/projects/shared/${shareToken}`);
    return data;
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const { data } = await this.client.post<Project>('/projects', input);
    return data;
  }

  async generateProject(input: GenerateProjectInput): Promise<Project> {
    const { data } = await this.client.post<Project>('/projects/generate', input);
    return data;
  }

  async updateProject(id: string, input: Partial<Project>): Promise<Project> {
    const { data } = await this.client.patch<Project>(`/projects/${id}`, input);
    return data;
  }

  async deleteProject(id: string): Promise<void> {
    await this.client.delete(`/projects/${id}`);
  }

  async duplicateProject(id: string): Promise<Project> {
    const { data } = await this.client.post<Project>(`/projects/${id}/duplicate`);
    return data;
  }

  // ============================================
  // SLIDES ENDPOINTS
  // ============================================

  async createSlide(input: CreateSlideInput): Promise<Slide> {
    const { data } = await this.client.post<Slide>('/slides', input);
    return data;
  }

  async updateSlide(id: string, input: Partial<Slide>): Promise<Slide> {
    const { data } = await this.client.patch<Slide>(`/slides/${id}`, input);
    return data;
  }

  async deleteSlide(id: string): Promise<void> {
    await this.client.delete(`/slides/${id}`);
  }

  async reorderSlides(projectId: string, slides: { id: string; order: number }[]): Promise<void> {
    await this.client.post(`/slides/reorder/${projectId}`, { slides });
  }

  async duplicateSlide(id: string): Promise<Slide> {
    const { data } = await this.client.post<Slide>(`/slides/${id}/duplicate`);
    return data;
  }

  // ============================================
  // BLOCKS ENDPOINTS
  // ============================================

  async createBlock(input: CreateBlockInput): Promise<Block> {
    const { data } = await this.client.post<Block>('/blocks', input);
    return data;
  }

  async updateBlock(id: string, input: UpdateBlockInput): Promise<Block> {
    const { data } = await this.client.patch<Block>(`/blocks/${id}`, input);
    return data;
  }

  async deleteBlock(id: string): Promise<void> {
    await this.client.delete(`/blocks/${id}`);
  }

  async reorderBlocks(projectId: string, blocks: { id: string; order: number }[]): Promise<void> {
    await this.client.post(`/blocks/reorder/${projectId}`, { blocks });
  }

  async batchUpdateBlocks(
    projectId: string,
    blocks: { id: string; content?: any; style?: any }[]
  ): Promise<void> {
    await this.client.post(`/blocks/batch/${projectId}`, { blocks });
  }

  // ============================================
  // THEMES ENDPOINTS
  // ============================================

  async getThemes(): Promise<Theme[]> {
    const { data } = await this.client.get<Theme[]>('/themes');
    return data;
  }

  async getTheme(id: string): Promise<Theme> {
    const { data } = await this.client.get<Theme>(`/themes/${id}`);
    return data;
  }

  // ============================================
  // SUBSCRIPTION ENDPOINTS
  // ============================================

  async getSubscription(): Promise<Subscription> {
    const { data } = await this.client.get<Subscription>('/users/subscription');
    return data;
  }

  async createCheckout(plan: 'pro' | 'enterprise'): Promise<{ url: string }> {
    const { data } = await this.client.post<{ url: string }>('/payments/checkout', { plan });
    return data;
  }

  async createPortalSession(): Promise<{ url: string }> {
    const { data } = await this.client.post<{ url: string }>('/payments/portal');
    return data;
  }

  async cancelSubscription(): Promise<void> {
    await this.client.post('/payments/cancel');
  }

  async resumeSubscription(): Promise<void> {
    await this.client.post('/payments/resume');
  }

  // ============================================
  // EXPORT ENDPOINTS
  // ============================================

  async canExport(): Promise<{ canExport: boolean }> {
    const { data } = await this.client.get<{ canExport: boolean }>('/export/can-export');
    return data;
  }

  async exportProject(projectId: string, format: 'pdf' | 'html' | 'json'): Promise<Blob> {
    const { data } = await this.client.get(`/export/${projectId}`, {
      params: { format },
      responseType: 'blob',
    });
    return data;
  }

  // ============================================
  // UPLOAD ENDPOINTS
  // ============================================

  async getPresignedUploadUrl(filename: string, mimeType: string): Promise<PresignedUploadResponse> {
    const { data } = await this.client.post<PresignedUploadResponse>('/upload/presigned', {
      filename,
      mimeType,
    });
    return data;
  }

  async confirmUpload(
    key: string,
    filename: string,
    mimeType: string,
    size: number
  ): Promise<Asset> {
    const { data } = await this.client.post<Asset>('/upload/confirm', {
      key,
      filename,
      mimeType,
      size,
    });
    return data;
  }

  async getAssets(page = 1, limit = 20): Promise<PaginatedResponse<Asset>> {
    const { data } = await this.client.get<PaginatedResponse<Asset>>('/upload/assets', {
      params: { page, limit },
    });
    return data;
  }

  async deleteAsset(id: string): Promise<void> {
    await this.client.delete(`/upload/${id}`);
  }

  async uploadAsset(formData: FormData): Promise<{ url: string; key: string; id: string }> {
    const { data } = await this.client.post<{ url: string; key: string; id: string }>(
      '/upload/direct',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  }

  // ============================================
  // AI ENDPOINTS
  // ============================================

  async enhanceContent(content: string, instruction: string): Promise<{ content: string }> {
    const { data } = await this.client.post<{ content: string }>('/ai/enhance', {
      content,
      instruction,
    });
    return data;
  }

  async generateSpeakerNotes(slideContent: string, context?: string): Promise<{ speakerNotes: string }> {
    const { data } = await this.client.post<{ speakerNotes: string }>('/ai/speaker-notes', {
      slideContent,
      context,
    });
    return data;
  }

  async transformText(
    text: string,
    action: 'shorten' | 'expand' | 'simplify' | 'professional' | 'casual' | 'academic' | 'persuasive' | 'fix-grammar'
  ): Promise<{ text: string; action: string }> {
    const { data } = await this.client.post<{ text: string; action: string }>('/ai/transform', {
      text,
      action,
    });
    return data;
  }

  async batchEnhance(
    items: { id: string; content: string }[],
    instruction: string
  ): Promise<{ results: { id: string; content: string; success: boolean }[] }> {
    const { data } = await this.client.post<{ results: { id: string; content: string; success: boolean }[] }>(
      '/ai/batch-enhance',
      { items, instruction }
    );
    return data;
  }

  async getSlideSuggestions(
    currentContent: string,
    slideType?: string
  ): Promise<{ suggestions: string }> {
    const { data } = await this.client.post<{ suggestions: string }>('/ai/slide-suggestions', {
      currentContent,
      slideType,
    });
    return data;
  }

  async generateContentIdeas(
    topic: string,
    slideType?: string,
    count?: number
  ): Promise<{ ideas: string }> {
    const { data } = await this.client.post<{ ideas: string }>('/ai/content-ideas', {
      topic,
      slideType,
      count,
    });
    return data;
  }

  // ============================================
  // VOICE-TO-SLIDE ENDPOINTS
  // ============================================

  async uploadVoiceRecording(formData: FormData): Promise<any> {
    const { data } = await this.client.post('/voice/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async getVoiceRecording(id: string): Promise<any> {
    const { data } = await this.client.get(`/voice/recordings/${id}`);
    return data;
  }

  async transcribeAudio(formData: FormData): Promise<any> {
    const { data } = await this.client.post('/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async generateFromVoice(recordingId: string, options?: any): Promise<any> {
    const { data } = await this.client.post(`/voice/recordings/${recordingId}/generate`, options);
    return data;
  }

  async getVoiceRecordings(page = 1, limit = 20): Promise<any> {
    const { data } = await this.client.get('/voice/recordings', { params: { page, limit } });
    return data;
  }

  // ============================================
  // ANALYTICS ENDPOINTS
  // ============================================

  async getAnalyticsSummary(projectId: string, startDate?: string, endDate?: string): Promise<any> {
    const { data } = await this.client.get(`/analytics/${projectId}/summary`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getSlidePerformance(projectId: string, startDate?: string, endDate?: string): Promise<any[]> {
    const { data } = await this.client.get(`/analytics/${projectId}/slides/performance`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getViewerSessions(projectId: string, page = 1, limit = 20): Promise<any> {
    const { data } = await this.client.get(`/analytics/${projectId}/viewer-sessions`, {
      params: { page, limit },
    });
    return data;
  }

  async getPresentationStats(projectId: string): Promise<any> {
    const { data } = await this.client.get(`/analytics/${projectId}/stats`);
    return data;
  }

  async getActiveViewers(projectId: string): Promise<any[]> {
    const { data } = await this.client.get(`/analytics/${projectId}/active-viewers`);
    return data;
  }

  async getSlideHeatmap(projectId: string, slideId: string): Promise<any[]> {
    const { data } = await this.client.get(`/analytics/${projectId}/slides/${slideId}/heatmap`);
    return data;
  }

  async exportAnalytics(projectId: string, format: 'csv' | 'pdf', timeRange?: string): Promise<any> {
    const { data } = await this.client.get(`/analytics/export/${projectId}`, {
      params: { format, timeRange },
      responseType: 'blob',
    });
    return data;
  }

  // Analytics tracking (public endpoints - no auth required)
  async trackViewStart(projectId: string, sessionId: string): Promise<any> {
    const { data } = await this.client.post('/analytics/track/view/start', {
      projectId,
      sessionId,
    });
    return data;
  }

  async trackViewEnd(presentationViewId: string): Promise<void> {
    await this.client.post(`/analytics/track/view/${presentationViewId}/end`);
  }

  async trackSlideEnter(presentationViewId: string, slideId: string, slideIndex: number): Promise<any> {
    const { data } = await this.client.post('/analytics/track/slide/enter', {
      presentationViewId,
      slideId,
      slideIndex,
    });
    return data;
  }

  async trackSlideExit(slideViewId: string): Promise<void> {
    await this.client.post(`/analytics/track/slide/${slideViewId}/exit`);
  }

  async trackSlideInteraction(slideViewId: string): Promise<void> {
    await this.client.post(`/analytics/track/slide/${slideViewId}/interaction`);
  }

  async trackHeatmap(projectId: string, slideId: string, x: number, y: number): Promise<void> {
    await this.client.post('/analytics/track/heatmap', {
      projectId,
      slideId,
      x,
      y,
    });
  }


  // ============================================
  // INTEGRATIONS ENDPOINTS
  // ============================================

  async getIntegrations(): Promise<any[]> {
    const { data } = await this.client.get('/integrations');
    return data;
  }

  async connectIntegration(provider: string): Promise<{ authUrl: string }> {
    const { data } = await this.client.post('/integrations/connect', { provider });
    return data;
  }

  async disconnectIntegration(integrationId: string): Promise<void> {
    await this.client.delete(`/integrations/${integrationId}`);
  }

  // Zoom
  async createZoomMeeting(data: any): Promise<any> {
    const { data: response } = await this.client.post('/integrations/zoom/meeting', data);
    return response;
  }

  async getZoomMeetings(): Promise<any[]> {
    const { data } = await this.client.get('/integrations/zoom/meetings');
    return data;
  }

  // Slack
  async getSlackChannels(): Promise<any[]> {
    const { data } = await this.client.get('/integrations/slack/channels');
    return data;
  }

  async sendToSlack(payload: any): Promise<void> {
    await this.client.post('/integrations/slack/send', payload);
  }

  // Teams
  async getTeamsList(): Promise<any> {
    const { data } = await this.client.get('/integrations/teams/list');
    return data;
  }

  async sendToTeams(payload: any): Promise<void> {
    await this.client.post('/integrations/teams/send', payload);
  }

  async createTeamsMeeting(data: any): Promise<any> {
    const { data: response } = await this.client.post('/integrations/teams/meeting', data);
    return response;
  }

  // Google Drive
  async getGoogleDriveFiles(): Promise<any[]> {
    const { data } = await this.client.get('/integrations/google-drive/files');
    return data;
  }

  async exportToGoogleDrive(payload: any): Promise<any> {
    const { data } = await this.client.post('/integrations/google-drive/export', payload);
    return data;
  }

  async importFromGoogleDrive(fileId: string): Promise<any> {
    const { data } = await this.client.post('/integrations/google-drive/import', { fileId });
    return data;
  }

  // Figma
  async getFigmaFiles(): Promise<any[]> {
    const { data } = await this.client.get('/integrations/figma/files');
    return data;
  }

  async importFromFigma(payload: any): Promise<any> {
    const { data } = await this.client.post('/integrations/figma/import', payload);
    return data;
  }

  async syncFromFigma(payload: any): Promise<any> {
    const { data } = await this.client.post('/integrations/figma/sync', payload);
    return data;
  }

  // Notion
  async getNotionPages(): Promise<any[]> {
    const { data } = await this.client.get('/integrations/notion/pages');
    return data;
  }

  async importFromNotion(pageId: string): Promise<any> {
    const { data } = await this.client.post('/integrations/notion/import', { pageId });
    return data;
  }

  async exportToNotion(payload: any): Promise<any> {
    const { data } = await this.client.post('/integrations/notion/export', payload);
    return data;
  }

  // ============================================
  // PERSONALIZATION / BRAND ENDPOINTS
  // ============================================

  async getBrandProfiles(): Promise<any[]> {
    const { data } = await this.client.get('/personalization/brand-profiles');
    return data;
  }

  async getBrandProfile(id: string): Promise<any> {
    const { data } = await this.client.get(`/personalization/brand-profiles/${id}`);
    return data;
  }

  async createBrandProfile(payload: any): Promise<any> {
    const { data } = await this.client.post('/personalization/brand-profiles', payload);
    return data;
  }

  async updateBrandProfile(id: string, payload: any): Promise<any> {
    const { data } = await this.client.patch(`/personalization/brand-profiles/${id}`, payload);
    return data;
  }

  async deleteBrandProfile(id: string): Promise<void> {
    await this.client.delete(`/personalization/brand-profiles/${id}`);
  }

  async uploadTrainingDocument(formData: FormData): Promise<any> {
    const { data } = await this.client.post('/personalization/training-documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async getTrainingDocuments(): Promise<any[]> {
    const { data } = await this.client.get('/personalization/training-documents');
    return data;
  }

  async deleteTrainingDocument(id: string): Promise<void> {
    await this.client.delete(`/personalization/training-documents/${id}`);
  }

  async getAIPersonalization(): Promise<any> {
    const { data } = await this.client.get('/personalization/ai-settings');
    return data;
  }

  async updateAIPersonalization(payload: any): Promise<any> {
    const { data } = await this.client.patch('/personalization/ai-settings', payload);
    return data;
  }

  // ============================================
  // ORGANIZATION ENDPOINTS
  // ============================================

  async getCurrentOrganization(): Promise<any> {
    const { data } = await this.client.get('/organizations/current');
    return data;
  }

  async getOrganization(id: string): Promise<any> {
    const { data } = await this.client.get(`/organizations/${id}`);
    return data;
  }

  async createOrganization(payload: any): Promise<any> {
    const { data } = await this.client.post('/organizations', payload);
    return data;
  }

  async updateOrganization(id: string, payload: any): Promise<any> {
    const { data } = await this.client.patch(`/organizations/${id}`, payload);
    return data;
  }

  async getOrganizationMembers(orgId: string): Promise<any[]> {
    const { data } = await this.client.get(`/organizations/${orgId}/members`);
    return data;
  }

  async updateMemberRole(orgId: string, memberId: string, role: string): Promise<any> {
    const { data } = await this.client.patch(`/organizations/${orgId}/members/${memberId}`, { role });
    return data;
  }

  async removeMember(orgId: string, memberId: string): Promise<void> {
    await this.client.delete(`/organizations/${orgId}/members/${memberId}`);
  }

  async getTeamInvitations(orgId: string): Promise<any[]> {
    const { data } = await this.client.get(`/organizations/${orgId}/invitations`);
    return data;
  }

  async sendInvitation(orgId: string, email: string, role: string): Promise<any> {
    const { data } = await this.client.post(`/organizations/${orgId}/invitations`, { email, role });
    return data;
  }

  async resendInvitation(orgId: string, invitationId: string): Promise<void> {
    await this.client.post(`/organizations/${orgId}/invitations/${invitationId}/resend`);
  }

  async cancelInvitation(orgId: string, invitationId: string): Promise<void> {
    await this.client.delete(`/organizations/${orgId}/invitations/${invitationId}`);
  }

  async bulkInvite(orgId: string, emails: string[], role: string): Promise<{ sent: number }> {
    const { data } = await this.client.post(`/organizations/${orgId}/invitations/bulk`, { emails, role });
    return data;
  }

  async getSSOConfig(orgId: string): Promise<any> {
    const { data } = await this.client.get(`/organizations/${orgId}/sso`);
    return data;
  }

  async configureSAML(orgId: string, payload: any): Promise<any> {
    const { data } = await this.client.post(`/organizations/${orgId}/sso/saml`, payload);
    return data;
  }

  async configureOIDC(orgId: string, payload: any): Promise<any> {
    const { data } = await this.client.post(`/organizations/${orgId}/sso/oidc`, payload);
    return data;
  }

  async toggleSSO(orgId: string, enabled: boolean): Promise<void> {
    await this.client.patch(`/organizations/${orgId}/sso`, { enabled });
  }

  async testSSOConnection(orgId: string): Promise<void> {
    await this.client.post(`/organizations/${orgId}/sso/test`);
  }

  async getAuditLogs(orgId: string, options?: any): Promise<any> {
    const { data } = await this.client.get(`/organizations/${orgId}/audit-logs`, { params: options });
    return data;
  }

  async exportAuditLogs(orgId: string, format: 'csv' | 'json', options?: any): Promise<any> {
    const { data } = await this.client.get(`/organizations/${orgId}/audit-logs/export`, {
      params: { format, ...options },
      responseType: 'blob',
    });
    return data;
  }

  async getWhiteLabelConfig(orgId: string): Promise<any> {
    const { data } = await this.client.get(`/organizations/${orgId}/white-label`);
    return data;
  }

  async updateWhiteLabelConfig(orgId: string, payload: any): Promise<any> {
    const { data } = await this.client.patch(`/organizations/${orgId}/white-label`, payload);
    return data;
  }

  async uploadOrganizationLogo(orgId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await this.client.post(`/organizations/${orgId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async verifyCustomDomain(orgId: string, domain: string): Promise<{ verified: boolean }> {
    const { data } = await this.client.post(`/organizations/${orgId}/verify-domain`, { domain });
    return data;
  }

  // ============================================
  // COLLABORATION ENDPOINTS
  // ============================================

  async getProjectCollaborators(projectId: string): Promise<any[]> {
    const { data } = await this.client.get(`/collaboration/${projectId}/collaborators`);
    return data;
  }

  async addCollaborator(projectId: string, email: string, role: string): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/collaborators`, { email, role });
    return data;
  }

  async updateCollaboratorRole(projectId: string, collaboratorId: string, role: string): Promise<any> {
    const { data } = await this.client.patch(`/collaboration/${projectId}/collaborators/${collaboratorId}`, { role });
    return data;
  }

  async removeCollaborator(projectId: string, collaboratorId: string): Promise<void> {
    await this.client.delete(`/collaboration/${projectId}/collaborators/${collaboratorId}`);
  }

  // Comments
  async getProjectComments(projectId: string, slideId?: string): Promise<any[]> {
    const { data } = await this.client.get(`/collaboration/${projectId}/comments`, {
      params: slideId ? { slideId } : undefined,
    });
    return data;
  }

  async createComment(
    projectId: string,
    content: string,
    slideId?: string,
    blockId?: string,
    parentId?: string
  ): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/comments`, {
      content,
      slideId,
      blockId,
      parentId,
    });
    return data;
  }

  async updateComment(projectId: string, commentId: string, content: string): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/comments/${commentId}`, {
      content,
    });
    return data;
  }

  async resolveComment(projectId: string, commentId: string): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/comments/${commentId}/resolve`);
    return data;
  }

  async unresolveComment(projectId: string, commentId: string): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/comments/${commentId}/unresolve`);
    return data;
  }

  async pinComment(projectId: string, commentId: string): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/comments/${commentId}/pin`);
    return data;
  }

  async unpinComment(projectId: string, commentId: string): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/comments/${commentId}/unpin`);
    return data;
  }

  async deleteComment(projectId: string, commentId: string): Promise<void> {
    await this.client.delete(`/collaboration/${projectId}/comments/${commentId}`);
  }

  // Versions
  async getProjectVersions(projectId: string): Promise<any[]> {
    const { data } = await this.client.get(`/collaboration/${projectId}/versions`);
    return data;
  }

  async createVersion(projectId: string, snapshot: any, message?: string): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/versions`, {
      snapshot,
      message,
    });
    return data;
  }

  async getVersion(projectId: string, version: number): Promise<any> {
    const { data } = await this.client.get(`/collaboration/${projectId}/versions/${version}`);
    return data;
  }

  async restoreVersion(projectId: string, version: number): Promise<any> {
    const { data } = await this.client.post(`/collaboration/${projectId}/versions/${version}/restore`);
    return data;
  }

  async getActiveCollaborators(projectId: string): Promise<any[]> {
    const { data } = await this.client.get(`/collaboration/${projectId}/active`);
    return data;
  }


  // ============================================
  // NAMESPACED API (for cleaner usage)
  // ============================================

  readonly projects = {
    getAll: async (): Promise<Project[]> => {
      const response = await this.getProjects(1, 100);
      return response.data;
    },
    getById: (id: string) => this.getProject(id),
    getByShareToken: (shareToken: string) => this.getProjectByShareToken(shareToken),
    create: (input: CreateProjectInput) => this.createProject(input),
    generate: (input: GenerateProjectInput) => this.generateProject(input),
    update: (id: string, input: Partial<Project>) => this.updateProject(id, input),
    delete: (id: string) => this.deleteProject(id),
    duplicate: (id: string) => this.duplicateProject(id),
  };

  readonly slides = {
    create: (projectId: string, input: Omit<CreateSlideInput, 'projectId'>) =>
      this.createSlide({ ...input, projectId }),
    update: (projectId: string, slideId: string, input: Partial<Slide>) =>
      this.updateSlide(slideId, input),
    delete: (projectId: string, slideId: string) => this.deleteSlide(slideId),
    reorder: (projectId: string, slides: { id: string; order: number }[]) =>
      this.reorderSlides(projectId, slides),
    duplicate: (projectId: string, slideId: string) => this.duplicateSlide(slideId),
  };

  readonly blocks = {
    create: (projectId: string, slideId: string, input: Omit<CreateBlockInput, 'slideId'>) =>
      this.createBlock({ ...input, slideId }),
    update: (projectId: string, slideId: string, blockId: string, input: UpdateBlockInput) =>
      this.updateBlock(blockId, input),
    delete: (projectId: string, slideId: string, blockId: string) => this.deleteBlock(blockId),
    reorder: (projectId: string, slideId: string, blocks: { id: string; order: number }[]) =>
      this.reorderBlocks(projectId, blocks),
    batchUpdate: (projectId: string, blocks: { id: string; content?: Record<string, unknown>; style?: Record<string, unknown> }[]) =>
      this.batchUpdateBlocks(projectId, blocks),
  };

  readonly themes = {
    getAll: () => this.getThemes(),
    getById: (id: string) => this.getTheme(id),
  };

  readonly subscription = {
    get: () => this.getSubscription(),
    createCheckout: (priceId: string) => this.createCheckout(priceId as 'pro' | 'enterprise'),
    createPortal: () => this.createPortalSession(),
    cancel: () => this.cancelSubscription(),
    resume: () => this.resumeSubscription(),
  };

  readonly export = {
    canExport: () => this.canExport(),
    export: (projectId: string, format: 'pdf' | 'html' | 'json') =>
      this.exportProject(projectId, format),
  };

  readonly upload = {
    getPresignedUrl: (filename: string, mimeType: string) =>
      this.getPresignedUploadUrl(filename, mimeType),
    confirm: (key: string, filename: string, mimeType: string, size: number) =>
      this.confirmUpload(key, filename, mimeType, size),
    getAssets: (page?: number, limit?: number) => this.getAssets(page, limit),
    deleteAsset: (id: string) => this.deleteAsset(id),
  };

  readonly ai = {
    enhance: (content: string, instruction: string) => this.enhanceContent(content, instruction),
  };
}

// Export singleton instance
export const api = new ApiClient();

// Export class for testing
export { ApiClient };
