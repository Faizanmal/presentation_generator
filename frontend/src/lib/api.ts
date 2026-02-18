import type { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
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
  Tag,
  CreateTagInput,
  UpdateTagInput,
  VoiceRecording,
  AnalyticsOverview,
  SlideAnalytics,
  ViewerSession,
  HeatmapData,
  Integration,
  ZoomMeeting,
  SlackChannel,
  WebhookConfig,
  BrandProfile,
  TrainingDocument,
  AIPersonalization,
  Organization,
  OrganizationMember,
  TeamInvitation,
  SSOConfig,
  AuditLogEntry,
  WhiteLabelConfig,
  ProjectVersion,
  ThinkingGenerationResult,
  ThinkingStep,
  ThinkingState,
  ThinkingPresentation,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private csrfToken: string | null = null;
  private csrfPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // Request interceptor to add auth token
    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      // Add Auth token
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }

      // Add CSRF token for mutation requests
      if (
        config.method &&
        ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase()) &&
        !config.url?.includes('/auth/login')
      ) {
        if (!this.csrfToken) {
          await this.fetchCsrfToken().catch(err => console.error('[ApiClient] CSRF fetch failed', err));
        }

        if (this.csrfToken) {
          // console.log('[ApiClient] Attaching CSRF token');
          config.headers['x-csrf-token'] = this.csrfToken;
        } else {
          console.warn('[ApiClient] Failed to obtain CSRF token - request may fail');
        }
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
  // CSRF
  // ============================================

  async fetchCsrfToken(): Promise<string> {
    if (this.csrfToken) { return this.csrfToken; }
    if (this.csrfPromise) { return this.csrfPromise; }

    this.csrfPromise = (async () => {
      try {
        // Add timestamp to prevent 304 Not Modified responses
        const timestamp = new Date().getTime();
        const response = await this.client.get<{ token: string }>(`/csrf/token?t=${timestamp}`);

        if (response.data) {
          // Handle case where token might be nested or direct property
          // Based on controller, it is { token: "..." }
          this.csrfToken = response.data.token || (response.data as { csrfToken?: string }).csrfToken || null;

          if (!this.csrfToken) {
            console.error('[ApiClient] CSRF response data structure mismatch', response.data);
            throw new Error('CSRF token not found in response');
          }

          return this.csrfToken;
        } else {
          console.error('[ApiClient] CSRF response missing body', response);
          throw new Error('CSRF response missing body');
        }
      } catch (error) {
        console.error('[ApiClient] Failed to fetch CSRF token', error);
        this.csrfToken = null;
        throw error;
      } finally {
        this.csrfPromise = null;
      }
    })();

    return this.csrfPromise;
  }

  // ============================================
  // RAW HTTP METHODS
  // ============================================


  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }> {
    return this.client.get<T>(url, config);
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T }> {
    return this.client.post<T>(url, data, config);
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T }> {
    return this.client.patch<T>(url, data, config);
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T }> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }> {
    return this.client.delete<T>(url, config);
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

  async requestOtpLogin(email: string): Promise<{ success: boolean; message: string; expiresInSeconds?: number }> {
    const { data } = await this.client.post<{ success: boolean; message: string; expiresInSeconds?: number }>('/auth/otp/request', { email });
    return data;
  }

  async requestOtpLoginMultiChannel(
    identifier: string,
    channel: 'email' | 'sms' = 'email',
    rememberDevice: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    expiresInSeconds?: number;
    resendAfterSeconds?: number;
    retryAfterSeconds?: number;
  }> {
    const { data } = await this.client.post<{
      success: boolean;
      message: string;
      expiresInSeconds?: number;
      resendAfterSeconds?: number;
      retryAfterSeconds?: number;
    }>('/auth/otp/request-multi', {
      identifier,
      channel,
      rememberDevice
    });
    return data;
  }

  async verifyOtpLogin(email: string, otp: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/otp/verify', { email, otp });
    const data = response.data;
    if (data.accessToken) {
      this.setToken(data.accessToken);
    }
    return data;
  }

  async verifyOtpLoginMultiChannel(
    identifier: string,
    otp: string,
    channel: 'email' | 'sms' = 'email',
    rememberDevice: boolean = false
  ): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/otp/verify-multi', {
      identifier,
      otp,
      channel,
      rememberDevice
    });
    const data = response.data;
    if (data.accessToken) {
      this.setToken(data.accessToken);
    }
    return data;
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; expiresInSeconds?: number }> {
    const { data } = await this.client.post<{ success: boolean; message: string; expiresInSeconds?: number }>('/auth/password/reset-request', { email });
    return data;
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const { data } = await this.client.post<{ success: boolean; message: string }>('/auth/password/reset', { email, otp, newPassword });
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

  async generateProject(input: GenerateProjectInput): Promise<{ status: string; jobId: string; message?: string }> {
    // Backend enqueues generation job and returns a job handle (queued)
    const { data } = await this.client.post<{ status: string; jobId: string; message?: string }>('/projects/generate', input);
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
    blocks: { id: string; content?: Record<string, unknown>; style?: Record<string, unknown> }[]
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

  async exportProject(projectId: string, format: 'pdf' | 'html' | 'json'): Promise<{ blob: Blob; filename?: string }> {
    const response = await this.client.get(`/export/${projectId}`, {
      params: {
        format,
        t: new Date().getTime() // Cache buster
      },
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      responseType: 'blob',
    });

    let filename: string | undefined;
    const disposition = response.headers['content-disposition'];
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    return { blob: response.data, filename };
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

  // ============================================
  // AI THINKING MODE ENDPOINTS
  // ============================================

  /**
   * Generate a presentation using the AI Thinking Loop
   * Uses multi-step reasoning: Planning → Generation → Reflection → Refinement
   */
  async generateWithThinking(params: {
    topic: string;
    tone?: 'professional' | 'casual' | 'academic' | 'creative';
    audience?: string;
    length?: number;
    type?: 'presentation' | 'document' | 'pitch-deck' | 'report';
    style?: 'professional' | 'creative' | 'academic' | 'casual';
    generateImages?: boolean;
    imageSource?: 'ai' | 'stock';
    smartLayout?: boolean;
    qualityLevel?: 'standard' | 'high' | 'premium';
    additionalContext?: string;
    brandGuidelines?: {
      colors?: string[];
      fonts?: string[];
      tone?: string;
      restrictions?: string[];
    };
    rawData?: string; // Support for unstructured raw data inputs
  }): Promise<ThinkingGenerationResult> {
    const { data } = await this.client.post<{
      status: string;
      jobId: string;
      message?: string;
    }>('/ai/thinking/generate', params);
    return this.waitForThinkingJob<ThinkingGenerationResult>(data.jobId);
  }

  /**
   * Quick generation without full thinking loop (faster but lower quality)
   */
  async generateQuick(params: {
    topic: string;
    tone?: string;
    audience?: string;
    length?: number;
    type?: string;
    rawData?: string; // Support for unstructured raw data inputs
  }): Promise<ThinkingGenerationResult> {
    const { data } = await this.client.post<ThinkingGenerationResult>('/ai/thinking/generate/quick', params);
    return data;
  }

  /**
   * Compare quality between thinking and quick modes
   */
  async compareThinkingQuality(topic: string, audience?: string): Promise<{
    thinking: { score: number; time: number };
    quick: { score: number; time: number };
    improvement: number;
  }> {
    const { data } = await this.client.post<{
      thinking: { score: number; time: number };
      quick: { score: number; time: number };
      improvement: number;
    }>('/ai/thinking/compare', { topic, audience });
    return data;
  }

  /**
   * Get thinking phase description for UI display
   */
  async getThinkingPhaseDescription(phase: string): Promise<{ description: string }> {
    const { data } = await this.client.get<{ description: string }>(`/ai/thinking/phase/${phase}`);
    return data;
  }

  /**
   * Stream the thinking process in real-time using EventSource
   */
  streamThinkingGeneration(
    params: {
      topic: string;
      tone?: string;
      audience?: string;
      length?: number;
      type?: string;
      qualityLevel?: string;
      imageSource?: string;
      rawData?: string;
    },
    onStep: (step: ThinkingStep) => void,
    onState: (state: ThinkingState) => void,
    onPresentation: (presentation: ThinkingPresentation) => void,
    onError: (error: Error) => void,
  ): () => void {
    const queryParams = new URLSearchParams();
    queryParams.set('topic', params.topic);
    if (params.tone) { queryParams.set('tone', params.tone); }
    if (params.audience) { queryParams.set('audience', params.audience); }
    if (params.length) { queryParams.set('length', params.length.toString()); }
    if (params.type) { queryParams.set('type', params.type); }
    if (params.qualityLevel) { queryParams.set('qualityLevel', params.qualityLevel); }
    if (params.imageSource) { queryParams.set('imageSource', params.imageSource); }
    if (params.rawData) { queryParams.set('rawData', params.rawData); }

    const url = `${API_URL}/ai/thinking/generate/stream?${queryParams.toString()}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; data: unknown };
        if (data.type === 'step') {
          onStep(data.data as ThinkingStep);
        } else if (data.type === 'state') {
          onState(data.data as ThinkingState);
        } else if (data.type === 'presentation') {
          onPresentation(data.data as ThinkingPresentation);
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      onError(new Error('Streaming connection failed'));
      eventSource.close();
    };

    // Return cleanup function
    return () => eventSource.close();
  }

  /**
   * Generate a presentation and automatically create a project from it
   */
  async generateAndCreateProject(params: {
    topic: string;
    tone?: string;
    audience?: string;
    length?: number;
    type?: string;
    qualityLevel?: string;
    title?: string;
    description?: string;
    themeId?: string;
  }): Promise<{
    projectId: string;
    slideCount: number;
    blockCount: number;
    qualityScore: number;
    generationTimeMs: number;
    tokensUsed?: number;
  }> {
    const { data } = await this.client.post<{
      status: string;
      jobId: string;
      message?: string;
    }>('/ai/thinking/generate-and-create', params);
    return this.waitForThinkingJob<{
      projectId: string;
      slideCount: number;
      blockCount: number;
      qualityScore: number;
      generationTimeMs: number;
      tokensUsed?: number;
    }>(data.jobId);
  }

  async getThinkingJobStatus(jobId: string): Promise<{
    id: string;
    state: string;
    result: unknown;
    failedReason?: string;
  }> {
    const { data } = await this.client.get<{
      id: string;
      state: string;
      result: unknown;
      failedReason?: string;
    }>(`/ai/thinking/jobs/${jobId}`);
    return data;
  }

  /**
   * Create a project from an already generated presentation result
   */
  async createProjectFromThinkingResult(params: {
    presentation: ThinkingPresentation;
    title?: string;
    description?: string;
    themeId?: string;
    generateImages?: boolean;
  }): Promise<{
    projectId: string;
    slideCount: number;
    blockCount: number;
  }> {
    const { data } = await this.client.post<{
      projectId: string;
      slideCount: number;
      blockCount: number;
    }>('/ai/thinking/create-project', params);
    return data;
  }

  private async waitForThinkingJob<T>(
    jobId: string,
    timeoutMs = 20 * 60 * 1000,
    pollIntervalMs = 1500,
  ): Promise<T> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const status = await this.getThinkingJobStatus(jobId);

      if (status.state === 'completed') {
        return status.result as T;
      }

      if (status.state === 'failed') {
        throw new Error(status.failedReason || 'Thinking generation failed');
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Thinking generation timed out');
  }

  // ============================================
  // TAGS ENDPOINTS
  // ============================================

  async getTags(): Promise<Tag[]> {
    const { data } = await this.client.get<Tag[]>('/tags');
    return data;
  }

  async getTag(id: string): Promise<Tag> {
    const { data } = await this.client.get<Tag>(`/tags/${id}`);
    return data;
  }

  async createTag(input: CreateTagInput): Promise<Tag> {
    const { data } = await this.client.post<Tag>('/tags', input);
    return data;
  }

  async updateTag(id: string, input: UpdateTagInput): Promise<Tag> {
    const { data } = await this.client.patch<Tag>(`/tags/${id}`, input);
    return data;
  }

  async deleteTag(id: string): Promise<void> {
    await this.client.delete(`/tags/${id}`);
  }

  async addTagToProject(tagId: string, projectId: string): Promise<void> {
    await this.client.post(`/tags/${tagId}/projects/${projectId}`);
  }

  async removeTagFromProject(tagId: string, projectId: string): Promise<void> {
    await this.client.delete(`/tags/${tagId}/projects/${projectId}`);
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

  async uploadVoiceRecording(formData: FormData): Promise<VoiceRecording> {
    const { data } = await this.client.post<VoiceRecording>('/voice/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async getVoiceRecording(id: string): Promise<VoiceRecording> {
    const { data } = await this.client.get<VoiceRecording>(`/voice/recordings/${id}`);
    return data;
  }

  async transcribeAudio(formData: FormData): Promise<{ transcription: string }> {
    const { data } = await this.client.post<{ transcription: string }>('/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async generateFromVoice(recordingId: string, options?: Record<string, unknown>): Promise<{ slides: Slide[] }> {
    const { data } = await this.client.post<{ slides: Slide[] }>(`/voice/recordings/${recordingId}/generate`, options);
    return data;
  }

  async getVoiceRecordings(page = 1, limit = 20): Promise<PaginatedResponse<VoiceRecording>> {
    const { data } = await this.client.get<PaginatedResponse<VoiceRecording>>('/voice/recordings', { params: { page, limit } });
    return data;
  }

  // ============================================
  // ANALYTICS ENDPOINTS
  // ============================================

  async getAnalyticsSummary(projectId: string, startDate?: string, endDate?: string): Promise<AnalyticsOverview> {
    const { data } = await this.client.get<AnalyticsOverview>(`/analytics/${projectId}/summary`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getSlidePerformance(projectId: string, startDate?: string, endDate?: string): Promise<SlideAnalytics[]> {
    const { data } = await this.client.get<SlideAnalytics[]>(`/analytics/${projectId}/slides/performance`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getViewerSessions(projectId: string, page = 1, limit = 20): Promise<PaginatedResponse<ViewerSession>> {
    const { data } = await this.client.get<PaginatedResponse<ViewerSession>>(`/analytics/${projectId}/viewer-sessions`, {
      params: { page, limit },
    });
    return data;
  }

  async getPresentationStats(projectId: string): Promise<AnalyticsOverview> {
    const { data } = await this.client.get<AnalyticsOverview>(`/analytics/${projectId}/stats`);
    return data;
  }

  async getActiveViewers(projectId: string): Promise<Array<{ userId: string; userName: string }>> {
    const { data } = await this.client.get<Array<{ userId: string; userName: string }>>(`/analytics/${projectId}/active-viewers`);
    return data;
  }

  async getSlideHeatmap(projectId: string, slideId: string): Promise<HeatmapData[]> {
    const { data } = await this.client.get<HeatmapData[]>(`/analytics/${projectId}/slides/${slideId}/heatmap`);
    return data;
  }

  async exportAnalytics(projectId: string, format: 'csv' | 'pdf', timeRange?: string): Promise<Blob> {
    const { data } = await this.client.get<Blob>(`/analytics/export/${projectId}`, {
      params: { format, timeRange },
      responseType: 'blob',
    });
    return data;
  }

  // Analytics tracking (public endpoints - no auth required)
  async trackViewStart(projectId: string, sessionId: string): Promise<{ viewId: string }> {
    const { data } = await this.client.post<{ viewId: string }>('/analytics/track/view/start', {
      projectId,
      sessionId,
    });
    return data;
  }

  async trackViewEnd(presentationViewId: string): Promise<void> {
    await this.client.post(`/analytics/track/view/${presentationViewId}/end`);
  }

  async trackSlideEnter(presentationViewId: string, slideId: string, slideIndex: number): Promise<unknown> {
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

  async getIntegrations(): Promise<Integration[]> {
    const { data } = await this.client.get<Integration[]>('/integrations');
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
  async createZoomMeeting(data: Record<string, unknown>): Promise<{ meetingId: string; joinUrl: string }> {
    const { data: response } = await this.client.post<{ meetingId: string; joinUrl: string }>('/integrations/zoom/meeting', data);
    return response;
  }

  async getZoomMeetings(): Promise<ZoomMeeting[]> {
    const { data } = await this.client.get<ZoomMeeting[]>('/integrations/zoom/meetings');
    return data;
  }

  // Slack
  async getSlackChannels(): Promise<SlackChannel[]> {
    const { data } = await this.client.get<SlackChannel[]>('/integrations/slack/channels');
    return data;
  }

  async sendToSlack(payload: Record<string, unknown>): Promise<void> {
    await this.client.post('/integrations/slack/send', payload);
  }

  // Teams
  async getTeamsList(): Promise<Array<{ id: string; displayName: string }>> {
    const { data } = await this.client.get<Array<{ id: string; displayName: string }>>('/integrations/teams/list');
    return data;
  }

  async sendToTeams(payload: Record<string, unknown>): Promise<void> {
    await this.client.post('/integrations/teams/send', payload);
  }

  async createTeamsMeeting(data: Record<string, unknown>): Promise<{ meetingId: string; joinUrl: string }> {
    const { data: response } = await this.client.post<{ meetingId: string; joinUrl: string }>('/integrations/teams/meeting', data);
    return response;
  }

  // Google Drive
  async getGoogleDriveFiles(): Promise<Array<{ id: string; name: string; mimeType: string }>> {
    const { data } = await this.client.get<Array<{ id: string; name: string; mimeType: string }>>('/integrations/google-drive/files');
    return data;
  }

  async exportToGoogleDrive(payload: Record<string, unknown>): Promise<{ fileId: string; webViewLink: string }> {
    const { data } = await this.client.post<{ fileId: string; webViewLink: string }>('/integrations/google-drive/export', payload);
    return data;
  }

  async importFromGoogleDrive(fileId: string): Promise<Project> {
    const { data } = await this.client.post<Project>('/integrations/google-drive/import', { fileId });
    return data;
  }

  // Figma
  async getFigmaFiles(): Promise<Array<{ id: string; name: string; lastModified: string }>> {
    const { data } = await this.client.get<Array<{ id: string; name: string; lastModified: string }>>('/integrations/figma/files');
    return data;
  }

  async importFromFigma(payload: Record<string, unknown>): Promise<{ slides: Slide[] }> {
    const { data } = await this.client.post<{ slides: Slide[] }>('/integrations/figma/import', payload);
    return data;
  }

  async syncFromFigma(payload: Record<string, unknown>): Promise<{ updated: number }> {
    const { data } = await this.client.post<{ updated: number }>('/integrations/figma/sync', payload);
    return data;
  }

  // Notion
  async getNotionPages(): Promise<Array<{ id: string; title: string; lastEditedTime: string }>> {
    const { data } = await this.client.get<Array<{ id: string; title: string; lastEditedTime: string }>>('/integrations/notion/pages');
    return data;
  }

  async importFromNotion(pageId: string): Promise<Project> {
    const { data } = await this.client.post<Project>('/integrations/notion/import', { pageId });
    return data;
  }

  async exportToNotion(payload: Record<string, unknown>): Promise<{ pageId: string; url: string }> {
    const { data } = await this.client.post<{ pageId: string; url: string }>('/integrations/notion/export', payload);
    return data;
  }

  // ============================================
  // PERSONALIZATION / BRAND ENDPOINTS
  // ============================================

  async getBrandProfiles(): Promise<BrandProfile[]> {
    const { data } = await this.client.get<BrandProfile[]>('/personalization/brand-profiles');
    return data;
  }

  async getBrandProfile(id: string): Promise<BrandProfile> {
    const { data } = await this.client.get<BrandProfile>(`/personalization/brand-profiles/${id}`);
    return data;
  }

  async createBrandProfile(payload: Record<string, unknown>): Promise<BrandProfile> {
    const { data } = await this.client.post<BrandProfile>('/personalization/brand-profiles', payload);
    return data;
  }

  async updateBrandProfile(id: string, payload: Record<string, unknown>): Promise<BrandProfile> {
    const { data } = await this.client.patch<BrandProfile>(`/personalization/brand-profiles/${id}`, payload);
    return data;
  }

  async deleteBrandProfile(id: string): Promise<void> {
    await this.client.delete(`/personalization/brand-profiles/${id}`);
  }

  async uploadTrainingDocument(formData: FormData): Promise<TrainingDocument> {
    const { data } = await this.client.post<TrainingDocument>('/personalization/training-documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async getTrainingDocuments(): Promise<TrainingDocument[]> {
    const { data } = await this.client.get<TrainingDocument[]>('/personalization/training-documents');
    return data;
  }

  async deleteTrainingDocument(id: string): Promise<void> {
    await this.client.delete(`/personalization/training-documents/${id}`);
  }

  async getAIPersonalization(): Promise<AIPersonalization> {
    const { data } = await this.client.get<AIPersonalization>('/personalization/ai-settings');
    return data;
  }

  async updateAIPersonalization(payload: Record<string, unknown>): Promise<AIPersonalization> {
    const { data } = await this.client.patch<AIPersonalization>('/personalization/ai-settings', payload);
    return data;
  }

  // ============================================
  // ORGANIZATION ENDPOINTS
  // ============================================

  async getCurrentOrganization(): Promise<Organization> {
    const { data } = await this.client.get<Organization>('/organizations/current');
    return data;
  }

  async getOrganization(id: string): Promise<Organization> {
    const { data } = await this.client.get<Organization>(`/organizations/${id}`);
    return data;
  }

  async createOrganization(payload: Record<string, unknown>): Promise<Organization> {
    const { data } = await this.client.post<Organization>('/organizations', payload);
    return data;
  }

  async updateOrganization(id: string, payload: Record<string, unknown>): Promise<Organization> {
    const { data } = await this.client.patch<Organization>(`/organizations/${id}`, payload);
    return data;
  }

  async getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
    const { data } = await this.client.get<OrganizationMember[]>(`/organizations/${orgId}/members`);
    return data;
  }

  async updateMemberRole(orgId: string, memberId: string, role: string): Promise<OrganizationMember> {
    const { data } = await this.client.patch<OrganizationMember>(`/organizations/${orgId}/members/${memberId}`, { role });
    return data;
  }

  async removeMember(orgId: string, memberId: string): Promise<void> {
    await this.client.delete(`/organizations/${orgId}/members/${memberId}`);
  }

  async getTeamInvitations(orgId: string): Promise<TeamInvitation[]> {
    const { data } = await this.client.get<TeamInvitation[]>(`/organizations/${orgId}/invitations`);
    return data;
  }

  async sendInvitation(orgId: string, email: string, role: string): Promise<TeamInvitation> {
    const { data } = await this.client.post<TeamInvitation>(`/organizations/${orgId}/invitations`, { email, role });
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

  async getSSOConfig(orgId: string): Promise<SSOConfig> {
    const { data } = await this.client.get<SSOConfig>(`/organizations/${orgId}/sso`);
    return data;
  }

  async configureSAML(orgId: string, payload: Record<string, unknown>): Promise<SSOConfig> {
    const { data } = await this.client.post<SSOConfig>(`/organizations/${orgId}/sso/saml`, payload);
    return data;
  }

  async configureOIDC(orgId: string, payload: Record<string, unknown>): Promise<SSOConfig> {
    const { data } = await this.client.post<SSOConfig>(`/organizations/${orgId}/sso/oidc`, payload);
    return data;
  }

  async toggleSSO(orgId: string, enabled: boolean): Promise<void> {
    await this.client.patch(`/organizations/${orgId}/sso`, { enabled });
  }

  async testSSOConnection(orgId: string): Promise<void> {
    await this.client.post(`/organizations/${orgId}/sso/test`);
  }

  async getAuditLogs(orgId: string, options?: Record<string, unknown>): Promise<PaginatedResponse<AuditLogEntry>> {
    const { data } = await this.client.get<PaginatedResponse<AuditLogEntry>>(`/organizations/${orgId}/audit-logs`, { params: options });
    return data;
  }

  async exportAuditLogs(orgId: string, format: 'csv' | 'json', options?: Record<string, unknown>): Promise<Blob> {
    const { data } = await this.client.get<Blob>(`/organizations/${orgId}/audit-logs/export`, {
      params: { format, ...options },
      responseType: 'blob',
    });
    return data;
  }

  async getWhiteLabelConfig(orgId: string): Promise<WhiteLabelConfig> {
    const { data } = await this.client.get<WhiteLabelConfig>(`/organizations/${orgId}/white-label`);
    return data;
  }

  async updateWhiteLabelConfig(orgId: string, payload: Record<string, unknown>): Promise<WhiteLabelConfig> {
    const { data } = await this.client.patch<WhiteLabelConfig>(`/organizations/${orgId}/white-label`, payload);
    return data;
  }

  async uploadOrganizationLogo(orgId: string, file: File): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await this.client.post<{ logoUrl: string }>(`/organizations/${orgId}/logo`, formData, {
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

  async getProjectCollaborators(projectId: string): Promise<Array<{ userId: string; userName: string; role: string }>> {
    const { data } = await this.client.get<Array<{ userId: string; userName: string; role: string }>>(`/collaboration/${projectId}/collaborators`);
    return data;
  }

  async addCollaborator(projectId: string, email: string, role: string): Promise<{ userId: string; userName: string; role: string }> {
    const { data } = await this.client.post<{ userId: string; userName: string; role: string }>(`/collaboration/${projectId}/collaborators`, { email, role });
    return data;
  }

  async updateCollaboratorRole(projectId: string, collaboratorId: string, role: string): Promise<{ userId: string; userName: string; role: string }> {
    const { data } = await this.client.patch<{ userId: string; userName: string; role: string }>(`/collaboration/${projectId}/collaborators/${collaboratorId}`, { role });
    return data;
  }

  async removeCollaborator(projectId: string, collaboratorId: string): Promise<void> {
    await this.client.delete(`/collaboration/${projectId}/collaborators/${collaboratorId}`);
  }

  // Comments
  async getProjectComments(projectId: string, slideId?: string): Promise<Comment[]> {
    const { data } = await this.client.get<Comment[]>(`/collaboration/${projectId}/comments`, {
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
  ): Promise<Comment> {
    const { data } = await this.client.post<Comment>(`/collaboration/${projectId}/comments`, {
      content,
      slideId,
      blockId,
      parentId,
    });
    return data;
  }

  async updateComment(projectId: string, commentId: string, content: string): Promise<Comment> {
    const { data } = await this.client.post<Comment>(`/collaboration/${projectId}/comments/${commentId}`, {
      content,
    });
    return data;
  }

  async resolveComment(projectId: string, commentId: string): Promise<Comment> {
    const { data } = await this.client.post<Comment>(`/collaboration/${projectId}/comments/${commentId}/resolve`);
    return data;
  }

  async unresolveComment(projectId: string, commentId: string): Promise<Comment> {
    const { data } = await this.client.post<Comment>(`/collaboration/${projectId}/comments/${commentId}/unresolve`);
    return data;
  }

  async pinComment(projectId: string, commentId: string): Promise<Comment> {
    const { data } = await this.client.post<Comment>(`/collaboration/${projectId}/comments/${commentId}/pin`);
    return data;
  }

  async unpinComment(projectId: string, commentId: string): Promise<Comment> {
    const { data } = await this.client.post<Comment>(`/collaboration/${projectId}/comments/${commentId}/unpin`);
    return data;
  }

  async deleteComment(projectId: string, commentId: string): Promise<void> {
    await this.client.delete(`/collaboration/${projectId}/comments/${commentId}`);
  }

  // Versions
  async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    const { data } = await this.client.get<ProjectVersion[]>(`/collaboration/${projectId}/versions`);
    return data;
  }

  async createVersion(projectId: string, snapshot: Record<string, unknown>, message?: string): Promise<ProjectVersion> {
    const { data } = await this.client.post<ProjectVersion>(`/collaboration/${projectId}/versions`, {
      snapshot,
      message,
    });
    return data;
  }

  async getVersion(projectId: string, version: number): Promise<ProjectVersion> {
    const { data } = await this.client.get<ProjectVersion>(`/collaboration/${projectId}/versions/${version}`);
    return data;
  }

  async restoreVersion(projectId: string, version: number): Promise<Project> {
    const { data } = await this.client.post<Project>(`/collaboration/${projectId}/versions/${version}/restore`);
    return data;
  }

  async getActiveCollaborators(projectId: string): Promise<Array<{ userId: string; userName: string }>> {
    const { data } = await this.client.get<Array<{ userId: string; userName: string }>>(`/collaboration/${projectId}/active`);
    return data;
  }

  // ============================================
  // AI ADVANCED ENDPOINTS
  // ============================================

  async generateImage(prompt: string, options?: {
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    style?: string;
    quality?: 'standard' | 'hd';
  }): Promise<AxiosResponse<{ imageUrl: string; revisedPrompt?: string }>> {
    return this.client.post('/ai/generate-image', {
      prompt,
      ...options,
    });
  }

  async suggestLayout(content: string): Promise<{
    layout: string;
    confidence: number;
    alternatives: string[];
  }> {
    const { data } = await this.client.post('/ai/suggest-layout', { content });
    return data;
  }

  async generateVoiceNarration(text: string, options?: {
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    speed?: number;
  }): Promise<{ audioUrl: string; duration: number }> {
    const { data } = await this.client.post('/ai/generate-narration', {
      text,
      ...options,
    });
    return data;
  }

  async generateSpeakerNotes(slideContent: string): Promise<{ notes: string }> {
    const { data } = await this.client.post('/ai/generate-speaker-notes', {
      content: slideContent,
    });
    return data;
  }

  async suggestImages(topic: string, count?: number): Promise<{
    suggestions: Array<{ prompt: string; description: string }>;
  }> {
    const { data } = await this.client.post('/ai/suggest-images', {
      topic,
      count: count || 3,
    });
    return data;
  }

  // ============================================
  // LIVE PRESENTATION ENDPOINTS
  // ============================================

  async startLiveSession(projectId: string): Promise<{
    sessionId: string;
    joinCode: string;
    joinUrl: string;
  }> {
    const { data } = await this.client.post(`/collaboration/${projectId}/live/start`);
    return data;
  }

  async endLiveSession(projectId: string, sessionId: string): Promise<void> {
    await this.client.post(`/collaboration/${projectId}/live/${sessionId}/end`);
  }

  async getLiveSessionQuestions(sessionId: string): Promise<Array<{
    id: string;
    question: string;
    author: string;
    votes: number;
    answered: boolean;
    timestamp: string;
  }>> {
    const { data } = await this.client.get(`/collaboration/live/${sessionId}/questions`);
    return data;
  }

  async createPoll(sessionId: string, question: string, options: string[]): Promise<{
    pollId: string;
    question: string;
    options: Array<{ id: string; text: string; votes: number }>;
  }> {
    const { data } = await this.client.post(`/collaboration/live/${sessionId}/polls`, {
      question,
      options,
    });
    return data;
  }

  async closePoll(sessionId: string, pollId: string): Promise<{
    results: Array<{ option: string; votes: number; percentage: number }>;
  }> {
    const { data } = await this.client.post(`/collaboration/live/${sessionId}/polls/${pollId}/close`);
    return data;
  }

  // ============================================
  // ANALYTICS ADVANCED ENDPOINTS
  // ============================================

  async getAIInsights(projectId: string): Promise<{
    insights: string[];
    recommendations: string[];
    score: number;
  }> {
    const { data } = await this.client.get(`/analytics/${projectId}/ai-insights`);
    return data;
  }

  async getStructuredInsights(projectId: string): Promise<{
    insights: Array<{
      type: 'improvement' | 'warning' | 'tip' | 'success';
      title: string;
      description: string;
      actionable: boolean;
      priority: 'high' | 'medium' | 'low';
      implementation?: string;
      expectedImpact?: string;
    }>;
    generatedAt: string;
  }> {
    const { data } = await this.client.get(`/analytics/${projectId}/ai-insights/structured`);
    return data;
  }

  async getPredictiveAnalytics(projectId: string, days: number = 30): Promise<{
    forecast: Array<{ date: string; predictedViews: number }>;
    trend: string;
    confidence: number;
    projectedGrowth: number;
    insights: string[];
  }> {
    const { data } = await this.client.get(`/analytics/${projectId}/predictive`, {
      params: { days },
    });
    return data;
  }

  async getRealTimeMetrics(projectId: string): Promise<{
    activeViewers: number;
    viewsLastHour: number;
    viewsLast24Hours: number;
    engagementRate: number;
    timestamp: string;
  }> {
    const { data } = await this.client.get(`/analytics/${projectId}/real-time`);
    return data;
  }

  async getAudienceSegments(projectId: string): Promise<{
    devices: Record<string, number>;
    browsers: Record<string, number>;
    engagement: { high: number; medium: number; low: number };
    totalAudience: number;
    insights: string[];
  }> {
    const { data } = await this.client.get(`/analytics/${projectId}/audience-segments`);
    return data;
  }

  async getContentOptimization(projectId: string, slideId?: string): Promise<{
    suggestions: Array<{
      slideNumber: number;
      type: string;
      issue: string;
      suggestion: string;
      priority: string;
      expectedImpact: string;
    }>;
  }> {
    const { data } = await this.client.post(`/analytics/${projectId}/optimize-content`, {
      slideId,
    });
    return data;
  }

  async getEngagementHeatmap(projectId: string): Promise<{
    slides: Array<{
      slideId: string;
      viewTime: number;
      interactions: number;
      dropoffRate: number;
    }>;
  }> {
    const { data } = await this.client.get(`/analytics/${projectId}/heatmap`);
    return data;
  }

  async getAudienceBreakdown(projectId: string): Promise<{
    devices: Record<string, number>;
    browsers: Record<string, number>;
    locations: Record<string, number>;
    referrers: Record<string, number>;
  }> {
    const { data } = await this.client.get(`/analytics/${projectId}/audience`);
    return data;
  }

  // ============================================
  // EXPORT ADVANCED ENDPOINTS
  // ============================================

  async exportToPptx(projectId: string, options?: {
    includeNotes?: boolean;
    includeAnimations?: boolean;
  }): Promise<Blob> {
    const { data } = await this.client.post(
      `/export/${projectId}/pptx`,
      options,
      { responseType: 'blob' }
    );
    return data;
  }

  async exportToVideo(projectId: string, options?: {
    resolution?: '720p' | '1080p' | '4k';
    includeNarration?: boolean;
    transitionDuration?: number;
  }): Promise<{ jobId: string; estimatedTime: number }> {
    const { data } = await this.client.post(`/export/${projectId}/video`, options);
    return data;
  }

  async getExportJobStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    downloadUrl?: string;
    error?: string;
  }> {
    const { data } = await this.client.get(`/export/jobs/${jobId}`);
    return data;
  }

  // ============================================
  // WEBHOOKS ENDPOINTS
  // ============================================

  async getWebhooks(): Promise<WebhookConfig[]> {
    const { data } = await this.client.get<WebhookConfig[]>('/integrations/webhooks');
    return data;
  }

  async createWebhook(url: string, events: string[], secret?: string): Promise<Pick<WebhookConfig, 'id' | 'url' | 'events' | 'secret'>> {
    const { data } = await this.client.post('/integrations/webhooks', {
      url,
      events,
      secret,
    });
    return data;
  }

  async updateWebhook(id: string, updates: {
    url?: string;
    events?: string[];
    active?: boolean;
  }): Promise<Pick<WebhookConfig, 'id' | 'url' | 'events' | 'active'>> {
    const { data } = await this.client.patch<Pick<WebhookConfig, 'id' | 'url' | 'events' | 'active'>>(`/integrations/webhooks/${id}`, updates);
    return data;
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.client.delete(`/integrations/webhooks/${id}`);
  }

  async testWebhook(id: string): Promise<{ success: boolean; response?: Record<string, unknown>; error?: string }> {
    const { data } = await this.client.post<{ success: boolean; response?: Record<string, unknown>; error?: string }>(`/integrations/webhooks/${id}/test`);
    return data;
  }

  // ============================================
  // PERSONALIZATION ENDPOINTS (EXTENDED)
  // ============================================

  async getPersonalizationBrand(): Promise<BrandProfile> {
    const { data } = await this.client.get<BrandProfile>('/personalization/brand');
    return data;
  }

  async updatePersonalizationBrand(payload: {
    companyName?: string;
    brandVoice?: string;
    industry?: string;
    targetAudience?: string;
    keywords?: string[];
    colorPalette?: { primary: string; secondary: string; accent: string };
  }): Promise<BrandProfile> {
    const { data } = await this.client.post<BrandProfile>('/personalization/brand', payload);
    return data;
  }

  async uploadBrandLogo(formData: FormData): Promise<{ logoUrl: string }> {
    const { data } = await this.client.post<{ logoUrl: string }>('/personalization/brand/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async getPersonalizationDocuments(): Promise<TrainingDocument[]> {
    const { data } = await this.client.get<TrainingDocument[]>('/personalization/documents');
    return data;
  }

  async uploadPersonalizationDocument(formData: FormData): Promise<TrainingDocument> {
    const { data } = await this.client.post<TrainingDocument>('/personalization/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async deletePersonalizationDocument(id: string): Promise<void> {
    await this.client.delete(`/personalization/documents/${id}`);
  }

  async getPersonalizationSettings(): Promise<{
    preferences?: Record<string, unknown>;
    promptTemplate?: string;
    examples?: Array<{ input: string; output: string }>;
  }> {
    const { data } = await this.client.get('/personalization/settings');
    return data;
  }

  async savePersonalizationSettings(payload: {
    preferences?: Record<string, unknown>;
    promptTemplate?: string;
    examples?: Array<{ input: string; output: string }>;
  }): Promise<Record<string, unknown>> {
    const { data } = await this.client.post('/personalization/settings', payload);
    return data;
  }

  async generateBrandTheme(): Promise<{ theme: Record<string, unknown> }> {
    const { data } = await this.client.get<{ theme: Record<string, unknown> }>('/personalization/brand/theme');
    return data;
  }

  async getPersonalizedPrompt(): Promise<{ prompt: string }> {
    const { data } = await this.client.get<{ prompt: string }>('/personalization/prompt');
    return data;
  }

  async searchRelevantContent(query: string, limit?: number): Promise<{ results: unknown[] }> {
    const { data } = await this.client.post<{ results: unknown[] }>('/personalization/search', { query, limit });
    return data;
  }

  // ============================================
  // INTERACTIVE EMBEDS ENDPOINTS
  // ============================================

  async createPollEmbed(projectId: string, slideId: string, poll: {
    question: string;
    options: string[];
    allowMultiple?: boolean;
    showResults?: boolean;
  }): Promise<{ id: string; type: string; data: unknown }> {
    const { data } = await this.client.post(`/interactive/poll/${projectId}/${slideId}`, poll);
    return data;
  }

  async votePoll(embedId: string, optionIds: string[], voterId?: string): Promise<{ results: unknown }> {
    const { data } = await this.client.post(`/interactive/poll/${embedId}/vote`, { optionIds, voterId });
    return data;
  }

  async createQASession(projectId: string, slideId: string, qa: {
    title: string;
    allowAnonymous?: boolean;
    moderationEnabled?: boolean;
  }): Promise<{ id: string; type: string; data: unknown }> {
    const { data } = await this.client.post(`/interactive/qa/${projectId}/${slideId}`, qa);
    return data;
  }

  async submitQAQuestion(embedId: string, question: string, authorName?: string): Promise<{ questionId: string }> {
    const { data } = await this.client.post(`/interactive/qa/${embedId}/question`, { question, authorName });
    return data;
  }

  async upvoteQuestion(embedId: string, questionId: string): Promise<{ upvotes: number }> {
    const { data } = await this.client.post(`/interactive/qa/${embedId}/question/${questionId}/upvote`);
    return data;
  }

  async answerQuestion(embedId: string, questionId: string, answer: string): Promise<void> {
    await this.client.post(`/interactive/qa/${embedId}/question/${questionId}/answer`, { answer });
  }

  async createFormEmbed(projectId: string, slideId: string, form: {
    title: string;
    description?: string;
    fields: Array<{ id: string; type: string; label: string; required?: boolean; options?: string[] }>;
  }): Promise<{ id: string; type: string; data: unknown }> {
    const { data } = await this.client.post(`/interactive/form/${projectId}/${slideId}`, form);
    return data;
  }

  async submitFormResponse(embedId: string, responses: Record<string, unknown>): Promise<{ success: boolean }> {
    const { data } = await this.client.post(`/interactive/form/${embedId}/submit`, { responses });
    return data;
  }

  async createQuizEmbed(projectId: string, slideId: string, quiz: {
    title: string;
    questions: Array<{ question: string; options: string[]; correctAnswer: number }>;
    showCorrectAfterSubmit?: boolean;
    timeLimit?: number;
  }): Promise<{ id: string; type: string; data: unknown }> {
    const { data } = await this.client.post(`/interactive/quiz/${projectId}/${slideId}`, quiz);
    return data;
  }

  async submitQuizAnswers(embedId: string, answers: Record<string, number>): Promise<{ score: number; total: number; results: unknown }> {
    const { data } = await this.client.post(`/interactive/quiz/${embedId}/submit`, { answers });
    return data;
  }

  async createWordCloud(projectId: string, slideId: string, wordCloud: {
    prompt: string;
    maxResponses?: number;
  }): Promise<{ id: string; type: string; data: unknown }> {
    const { data } = await this.client.post(`/interactive/wordcloud/${projectId}/${slideId}`, wordCloud);
    return data;
  }

  async submitWords(embedId: string, words: string[]): Promise<{ wordCloud: unknown }> {
    const { data } = await this.client.post(`/interactive/wordcloud/${embedId}/submit`, { words });
    return data;
  }

  async getSlideEmbeds(slideId: string): Promise<Array<{ id: string; type: string; data: unknown }>> {
    const { data } = await this.client.get(`/interactive/slide/${slideId}`);
    return data;
  }

  async getEmbedAnalytics(embedId: string): Promise<{ responses: number; data: unknown }> {
    const { data } = await this.client.get(`/interactive/${embedId}/analytics`);
    return data;
  }

  // ============================================
  // MULTILINGUAL ENDPOINTS
  // ============================================

  async getSupportedLanguages(): Promise<Array<{ code: string; name: string; nativeName: string; flag?: string }>> {
    const { data } = await this.client.get('/multilingual/languages');
    return data;
  }

  async initializeProjectLanguage(projectId: string, primaryLanguage: string): Promise<{ success: boolean }> {
    const { data } = await this.client.post(`/multilingual/${projectId}/initialize`, { primaryLanguage });
    return data;
  }

  async translateProject(projectId: string, targetLanguage: string): Promise<{ jobId: string }> {
    const { data } = await this.client.post(`/multilingual/${projectId}/translate`, { targetLanguage });
    return data;
  }

  async translateSlide(projectId: string, slideId: string, targetLanguage: string): Promise<{ success: boolean }> {
    const { data } = await this.client.post(`/multilingual/${projectId}/slides/${slideId}/translate`, { targetLanguage });
    return data;
  }

  async getProjectInLanguage(projectId: string, language: string): Promise<Project> {
    const { data } = await this.client.get<Project>(`/multilingual/${projectId}/view/${language}`);
    return data;
  }

  async updateBlockTranslation(projectId: string, slideId: string, blockId: string, language: string, translatedContent: unknown): Promise<void> {
    await this.client.patch(`/multilingual/${projectId}/slides/${slideId}/blocks/${blockId}/translation/${language}`, { translatedContent });
  }

  async getTranslationJobStatus(jobId: string): Promise<{ status: string; progress: number }> {
    const { data } = await this.client.get(`/multilingual/jobs/${jobId}`);
    return data;
  }

  async getTranslationProgress(projectId: string): Promise<{ languages: Record<string, number> }> {
    const { data } = await this.client.get(`/multilingual/${projectId}/progress`);
    return data;
  }

  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    const { data } = await this.client.post('/multilingual/detect-language', { text });
    return data;
  }

  // ============================================
  // DESIGN SYSTEM ENDPOINTS
  // ============================================

  async createDesignSystem(payload: {
    name: string;
    description?: string;
    organizationId?: string;
    presetId?: string;
  }): Promise<{ id: string; name: string; tokens: unknown }> {
    const { data } = await this.client.post('/design-system', payload);
    return data;
  }

  async getDesignSystemPresets(): Promise<Array<{ id: string; name: string; description: string }>> {
    const { data } = await this.client.get('/design-system/presets');
    return data;
  }

  async getUserDesignSystems(): Promise<Array<{ id: string; name: string; description?: string }>> {
    const { data } = await this.client.get('/design-system/my-systems');
    return data;
  }

  async getDesignSystem(systemId: string): Promise<{ id: string; name: string; tokens: unknown }> {
    const { data } = await this.client.get(`/design-system/${systemId}`);
    return data;
  }

  async updateDesignSystemTokens(systemId: string, tokens: {
    colors?: Array<{ name: string; value: string }>;
    typography?: Array<{ name: string; fontFamily: string; fontSize: string }>;
    spacing?: Array<{ name: string; value: string }>;
    shadows?: Array<{ name: string; value: string }>;
    borders?: Array<{ name: string; value: string }>;
  }): Promise<{ success: boolean }> {
    const { data } = await this.client.patch(`/design-system/${systemId}/tokens`, tokens);
    return data;
  }

  async updateDesignSystemColor(systemId: string, colorName: string, newValue: string): Promise<{ success: boolean }> {
    const { data } = await this.client.patch(`/design-system/${systemId}/color`, { colorName, newValue });
    return data;
  }

  async applyDesignSystemToProject(systemId: string, projectId: string): Promise<{ success: boolean }> {
    const { data } = await this.client.post(`/design-system/${systemId}/apply/${projectId}`);
    return data;
  }

  async generateColorPalette(baseColor: string, name: string): Promise<{ colors: Array<{ name: string; value: string }> }> {
    const { data } = await this.client.post('/design-system/generate-palette', { baseColor, name });
    return data;
  }

  async exportDesignSystemCSS(systemId: string): Promise<{ css: string }> {
    const { data } = await this.client.get(`/design-system/${systemId}/export/css`);
    return data;
  }

  async exportDesignSystemTailwind(systemId: string): Promise<{ config: unknown }> {
    const { data } = await this.client.get(`/design-system/${systemId}/export/tailwind`);
    return data;
  }

  // ============================================
  // AUDIENCE ADAPTATION ENDPOINTS
  // ============================================

  async getAudienceTypes(): Promise<Array<{ id: string; name: string; description: string }>> {
    const { data } = await this.client.get('/audience-adaptation/audience-types');
    return data;
  }

  async previewAudienceAdaptation(projectId: string, options: {
    targetAudience: string;
    adjustTone?: boolean;
    adjustLength?: boolean;
    adjustComplexity?: boolean;
    preserveKeyPoints?: boolean;
  }): Promise<{ adaptedSlides: unknown[]; changes: unknown[] }> {
    const { data } = await this.client.post(`/audience-adaptation/${projectId}/preview`, options);
    return data;
  }

  async getAudienceSuggestions(projectId: string, audienceType: string): Promise<{
    suggestions: Array<{ slideId: string; suggestion: string; priority: 'high' | 'medium' | 'low' }>;
  }> {
    const { data } = await this.client.get(`/audience-adaptation/${projectId}/suggestions/${audienceType}`);
    return data;
  }

  // ============================================
  // CONTENT GOVERNANCE ENDPOINTS
  // ============================================

  async createWorkflow(orgId: string, workflow: {
    name: string;
    description?: string;
    stages: string[];
    requiredApprovers: Record<string, { minApprovals: number; approverRoles: string[] }>;
    autoPublish?: boolean;
  }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post(`/governance/organizations/${orgId}/workflows`, workflow);
    return data;
  }

  async getWorkflows(orgId: string): Promise<Array<{ id: string; name: string; stages: string[] }>> {
    const { data } = await this.client.get(`/governance/organizations/${orgId}/workflows`);
    return data;
  }

  async submitForApproval(projectId: string, workflowId: string, message?: string): Promise<{ requestId: string }> {
    const { data } = await this.client.post(`/governance/projects/${projectId}/submit-approval`, { workflowId, message });
    return data;
  }

  async processApproval(requestId: string, action: 'approve' | 'reject' | 'request_changes', comment?: string): Promise<{ status: string }> {
    const { data } = await this.client.post(`/governance/requests/${requestId}/process`, { action, comment });
    return data;
  }

  async addApprovalComment(requestId: string, content: string): Promise<{ commentId: string }> {
    const { data } = await this.client.post(`/governance/requests/${requestId}/comments`, { content });
    return data;
  }

  async getApprovalHistory(projectId: string): Promise<Array<{ requestId: string; status: string; createdAt: string }>> {
    const { data } = await this.client.get(`/governance/projects/${projectId}/approval-history`);
    return data;
  }

  async createDisclaimer(orgId: string, disclaimer: {
    name: string;
    content: string;
    placement: 'first_slide' | 'last_slide' | 'all_slides' | 'custom';
    categories?: string[];
    isRequired?: boolean;
  }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post(`/governance/organizations/${orgId}/disclaimers`, disclaimer);
    return data;
  }

  async getApplicableDisclaimers(projectId: string, orgId: string): Promise<Array<{ id: string; name: string; content: string }>> {
    const { data } = await this.client.get(`/governance/projects/${projectId}/organizations/${orgId}/disclaimers`);
    return data;
  }

  async checkDisclaimers(projectId: string, orgId: string): Promise<{ compliant: boolean; missing: string[] }> {
    const { data } = await this.client.get(`/governance/projects/${projectId}/organizations/${orgId}/check-disclaimers`);
    return data;
  }

  async lockContent(projectId: string, lock: {
    slideId?: string;
    blockId?: string;
    lockType: string;
    reason?: string;
    expiresAt?: string;
  }): Promise<{ lockId: string }> {
    const { data } = await this.client.post(`/governance/projects/${projectId}/locks`, lock);
    return data;
  }

  async unlockContent(lockId: string): Promise<{ success: boolean }> {
    const { data } = await this.client.delete(`/governance/locks/${lockId}`);
    return data;
  }

  async isContentLocked(projectId: string): Promise<{ locked: boolean; locks: unknown[] }> {
    const { data } = await this.client.get(`/governance/projects/${projectId}/check-lock`);
    return data;
  }

  async createPolicy(orgId: string, policy: {
    name: string;
    rules: Array<{ type: string; config: unknown }>;
    enforcementLevel: 'warn' | 'block';
  }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post(`/governance/organizations/${orgId}/policies`, policy);
    return data;
  }

  async validateContent(projectId: string): Promise<{ valid: boolean; violations: unknown[] }> {
    const { data } = await this.client.get(`/governance/projects/${projectId}/validate`);
    return data;
  }

  // ============================================
  // TEAM ANALYTICS ENDPOINTS
  // ============================================

  async getTeamPerformance(orgId: string, startDate?: string, endDate?: string): Promise<{
    totalProjects: number;
    totalPresentations: number;
    averageEngagement: number;
  }> {
    const { data } = await this.client.get(`/team-analytics/organizations/${orgId}/performance`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getMemberContributions(orgId: string, startDate?: string, endDate?: string): Promise<Array<{
    userId: string;
    userName: string;
    projectsCreated: number;
    slidesCreated: number;
    avatar?: string;
  }>> {
    const { data } = await this.client.get(`/team-analytics/organizations/${orgId}/contributions`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getTeamDashboard(orgId: string, startDate?: string, endDate?: string): Promise<{
    overview: unknown;
    trends: unknown;
    topContributors: unknown[];
  }> {
    const { data } = await this.client.get(`/team-analytics/organizations/${orgId}/dashboard`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getActivityTimeline(orgId: string, options?: {
    limit?: number;
    offset?: number;
    userId?: string;
    projectId?: string;
  }): Promise<Array<{ action: string; timestamp: string; userId: string; targetType: string; userName?: string }>> {
    const { data } = await this.client.get(`/team-analytics/organizations/${orgId}/activity`, {
      params: options,
    });
    return data;
  }

  async getProductivityTrends(orgId: string, startDate?: string, endDate?: string): Promise<{
    dailyActivity: Array<{ date: string; count: number }>;
  }> {
    const { data } = await this.client.get(`/team-analytics/organizations/${orgId}/trends`, {
      params: { startDate, endDate },
    });
    return data;
  }

  async getRevisionHeatmap(projectId: string): Promise<Array<{ slideId: string; revisions: number }>> {
    const { data } = await this.client.get(`/team-analytics/projects/${projectId}/heatmap`);
    return data;
  }

  async getProjectAttribution(projectId: string): Promise<Array<{ userId: string; contribution: number }>> {
    const { data } = await this.client.get(`/team-analytics/projects/${projectId}/attribution`);
    return data;
  }

  async trackTeamActivity(action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>): Promise<{ success: boolean }> {
    const { data } = await this.client.post('/team-analytics/track', { action, targetType, targetId, metadata });
    return data;
  }

  // ============================================
  // TEMPLATE MARKETPLACE ENDPOINTS
  // ============================================

  async listMarketplaceTemplates(options?: {
    category?: string;
    pricing?: string;
    search?: string;
    featured?: boolean;
    sortBy?: 'downloads' | 'rating' | 'newest' | 'popular';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<{
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    price: number;
    rating: number;
    downloads: number;
  }>> {
    const { data } = await this.client.get('/marketplace/templates', { params: options });
    return data;
  }

  async getMarketplaceTemplate(templateId: string): Promise<{
    id: string;
    title: string;
    description: string;
    previewImages: string[];
    price: number;
    author: { id: string; name: string };
  }> {
    const { data } = await this.client.get(`/marketplace/templates/${templateId}`);
    return data;
  }

  async getMarketplaceCategories(): Promise<Array<{ id: string; name: string; count: number }>> {
    const { data } = await this.client.get('/marketplace/categories');
    return data;
  }

  async submitTemplate(projectId: string, template: {
    title: string;
    description: string;
    category: string;
    tags: string[];
    pricing: string;
    price?: number;
    thumbnail?: string;
    previewImages?: string[];
  }): Promise<{ templateId: string; status: string }> {
    const { data } = await this.client.post('/marketplace/templates/submit', { projectId, ...template });
    return data;
  }

  async useTemplate(templateId: string, newTitle?: string): Promise<Project> {
    const { data } = await this.client.post<Project>(`/marketplace/templates/${templateId}/use`, { newTitle });
    return data;
  }

  async purchaseTemplate(templateId: string, paymentIntentId: string): Promise<{ success: boolean }> {
    const { data } = await this.client.post(`/marketplace/templates/${templateId}/purchase`, { paymentIntentId });
    return data;
  }

  async addTemplateReview(templateId: string, rating: number, comment?: string): Promise<{ reviewId: string }> {
    const { data } = await this.client.post(`/marketplace/templates/${templateId}/review`, { rating, comment });
    return data;
  }

  async getTemplateReviews(templateId: string, page = 1, limit = 10): Promise<PaginatedResponse<{
    id: string;
    rating: number;
    comment: string;
    author: string;
    createdAt: string;
  }>> {
    const { data } = await this.client.get(`/marketplace/templates/${templateId}/reviews`, {
      params: { page, limit },
    });
    return data;
  }

  async getAuthorDashboard(): Promise<{
    templates: Array<{ id: string; title: string; downloads: number; earnings: number }>;
    totalEarnings: number;
    totalDownloads: number;
  }> {
    const { data } = await this.client.get('/marketplace/author/dashboard');
    return data;
  }

  // ============================================
  // NARRATION EXPORT ENDPOINTS
  // ============================================

  async getVoiceOptions(): Promise<Array<{ id: string; name: string; language: string; gender: 'male' | 'female' | 'neutral'; accent?: string }>> {
    const { data } = await this.client.get('/narration/voices');
    return data;
  }

  async generateProjectSpeakerNotes(projectId: string, options?: {
    tone?: 'professional' | 'casual' | 'educational' | 'persuasive';
    duration?: 'short' | 'medium' | 'detailed';
  }): Promise<{ slides: Array<{ slideId: string; speakerNotes: string }> }> {
    const { data } = await this.client.post(`/narration/${projectId}/speaker-notes/generate`, options);
    return data;
  }

  async updateSlideSpeakerNotes(slideId: string, speakerNotes: string): Promise<{ success: boolean }> {
    const { data } = await this.client.patch(`/narration/slides/${slideId}/speaker-notes`, { speakerNotes });
    return data;
  }

  async generateNarration(projectId: string, options: {
    voice: string;
    speed?: number;
    slideIds?: string[];
  }): Promise<{ narrationProjectId: string; audioUrl: string }> {
    const { data } = await this.client.post(`/narration/${projectId}/generate`, options);
    return data;
  }

  async getNarrationProject(narrationProjectId: string): Promise<{
    id: string;
    slides: Array<{
      slideId: string;
      audioUrl: string;
      duration: number;
      status?: 'pending' | 'generating' | 'complete' | 'error';
      slideNumber?: number;
      speakerNotes?: string;
    }>;
  }> {
    const { data } = await this.client.get(`/narration/projects/${narrationProjectId}`);
    return data;
  }

  async exportVideoFromProject(projectId: string, options: {
    format: string;
    resolution: '720p' | '1080p' | '4k';
    includeNarration: boolean;
    slideTransition?: 'none' | 'fade' | 'slide';
    slideDuration?: number;
    narrationProjectId?: string;
  }): Promise<{ jobId: string; estimatedTime: number }> {
    const { data } = await this.client.post(`/narration/${projectId}/export-video`, options);
    return data;
  }

  async getVideoExportJob(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    downloadUrl?: string;
    error?: string;
  }> {
    const { data } = await this.client.get(`/narration/jobs/${jobId}`);
    return data;
  }

  // ============================================
  // ACCESSIBILITY ENDPOINTS
  // ============================================

  async checkProjectAccessibility(projectId: string): Promise<{
    score: number;
    issues: Array<{ id: string; type: string; severity: string; message: string; slideId?: string; blockId?: string; suggestion?: string }>;
  }> {
    const { data } = await this.client.post(`/accessibility/${projectId}/check`);
    return data;
  }

  async getWCAGGuidelines(): Promise<Array<{ id: string; title: string; level: string; description: string }>> {
    const { data } = await this.client.get('/accessibility/guidelines');
    return data;
  }

  async checkContrast(foreground: string, background: string): Promise<{
    ratio: number;
    passesAA: boolean;
    passesAAA: boolean;
  }> {
    const { data } = await this.client.post('/accessibility/check-contrast', { foreground, background });
    return data;
  }

  async suggestAccessibleColors(foreground: string, background: string, targetRatio?: number): Promise<{
    suggestions: Array<{ foreground: string; background: string; ratio: number }>;
  }> {
    const { data } = await this.client.post('/accessibility/suggest-colors', { foreground, background, targetRatio });
    return data;
  }

  async generateAltText(imageUrl: string): Promise<{ altText: string }> {
    const { data } = await this.client.post('/accessibility/generate-alt-text', { imageUrl });
    return data;
  }

  async autoFixAccessibilityIssues(projectId: string, issueIds: string[]): Promise<{
    fixed: number;
    failed: number;
    results: Array<{ issueId: string; fixed: boolean; error?: string }>;
  }> {
    const { data } = await this.client.post(`/accessibility/${projectId}/auto-fix`, { issueIds });
    return data;
  }

  // ============================================
  // DATA CHARTS ENDPOINTS
  // ============================================

  async createCSVDataSource(projectId: string, name: string, csvContent: string, delimiter?: string): Promise<{
    id: string;
    name: string;
    columns: string[];
    rowCount: number;
  }> {
    const { data } = await this.client.post('/data-charts/datasource/csv', { projectId, name, csvContent, delimiter });
    return data;
  }

  async uploadCSVFile(formData: FormData): Promise<{
    id: string;
    name: string;
    columns: string[];
    rowCount: number;
  }> {
    const { data } = await this.client.post('/data-charts/datasource/csv/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async connectGoogleSheetsDirect(projectId: string, name: string, sheetId: string, range: string, accessToken: string): Promise<{
    id: string;
    name: string;
    columns: string[];
  }> {
    const { data } = await this.client.post('/data-charts/datasource/google-sheets', { projectId, name, sheetId, range, accessToken });
    return data;
  }

  async connectAPIDataSource(projectId: string, name: string, apiEndpoint: string, options?: {
    headers?: Record<string, string>;
    refreshInterval?: number;
    dataPath?: string;
  }): Promise<{
    id: string;
    name: string;
    columns: string[];
  }> {
    const { data } = await this.client.post('/data-charts/datasource/api', { projectId, name, apiEndpoint, ...options });
    return data;
  }

  async refreshDataSource(dataSourceId: string): Promise<{ success: boolean; rowCount: number }> {
    const { data } = await this.client.post(`/data-charts/datasource/${dataSourceId}/refresh`);
    return data;
  }

  async createChartRaw(projectId: string, chart: {
    slideId: string;
    blockId: string;
    dataSourceId: string;
    config: {
      type: string;
      xAxis?: string;
      yAxis?: string[];
      title?: string;
      colors?: string[];
    };
  }): Promise<{ id: string; type: string }> {
    const { data } = await this.client.post(`/data-charts/${projectId}/chart`, chart);
    return data;
  }

  async getChartData(chartId: string): Promise<{ data: unknown[]; config: unknown }> {
    const { data } = await this.client.get(`/data-charts/chart/${chartId}`);
    return data;
  }

  async updateChartConfig(chartId: string, config: Record<string, unknown>): Promise<{ success: boolean }> {
    const { data } = await this.client.patch(`/data-charts/chart/${chartId}`, { config });
    return data;
  }

  async suggestChartTypeSimple(dataSourceId: string, goal?: string): Promise<{
    suggestions: Array<{ type: string; confidence: number; reason: string }>;
  }> {
    const { data } = await this.client.post(`/data-charts/datasource/${dataSourceId}/suggest`, { goal });
    return data;
  }

  // Additional data chart methods for component compatibility
  async getDataSources(projectId: string): Promise<Array<{ id: string; name: string; type: string; config: Record<string, unknown> }>> {
    const { data } = await this.client.get(`/data-charts/${projectId}/datasources`);
    return data;
  }

  async uploadCSVData(projectId: string, csvData: { name: string; content: string }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post('/data-charts/datasource/csv', { projectId, ...csvData });
    return data;
  }

  async createJSONDataSource(projectId: string, jsonData: { name: string; content: string }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post('/data-charts/datasource/json', { projectId, name: jsonData.name, jsonContent: jsonData.content });
    return data;
  }

  async connectGoogleSheets(projectId: string, config: { url: string; sheetName: string }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post('/data-charts/datasource/google-sheets', { projectId, ...config });
    return data;
  }

  async connectAPIData(projectId: string, config: { url: string; method: string; headers?: Record<string, string>; refreshInterval?: number }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post('/data-charts/datasource/api', { projectId, ...config });
    return data;
  }

  async getSlideCharts(slideId: string): Promise<Array<{ id: string; type: string; title: string; dataSourceId: string }>> {
    const { data } = await this.client.get(`/data-charts/slide/${slideId}/charts`);
    return data;
  }

  async createChart(projectId: string, slideId: string, config: {
    type: string;
    title: string;
    dataSourceId: string;
    config: Record<string, unknown>;
  }): Promise<{ id: string; type: string; title: string; dataSourceId: string }> {
    const { data } = await this.client.post(`/data-charts/${projectId}/chart`, { slideId, ...config });
    return data;
  }

  async suggestChartType(projectId: string, dataSourceId: string): Promise<{ suggestedType: string; confidence: number }> {
    const { data } = await this.client.post(`/data-charts/${projectId}/datasource/${dataSourceId}/suggest`);
    return data;
  }

  // Additional multilingual methods
  async getProjectLanguages(projectId: string): Promise<Array<{ languageCode: string; languageName: string; progress: number; status: 'complete' | 'partial' | 'pending' }>> {
    const { data } = await this.client.get(`/multilingual/${projectId}/languages`);
    return data;
  }

  async detectContentLanguage(text: string): Promise<{ detectedLanguage: string; confidence: number }> {
    const { data } = await this.client.post('/multilingual/detect', { text });
    return data;
  }

  // Additional narration methods
  async generateSlideSpeakerNotes(projectId: string, slideId: string): Promise<{ speakerNotes: string }> {
    const { data } = await this.client.post(`/narration/${projectId}/slides/${slideId}/generate-notes`);
    return data;
  }

  async generateSlideNarration(projectId: string, slideId: string, text: string, voiceId: string): Promise<{ audioUrl: string; duration: number }> {
    const { data } = await this.client.post(`/narration/${projectId}/slides/${slideId}/generate`, { text, voiceId });
    return data;
  }

  async exportNarrationVideo(projectId: string, options: { quality: string; includeNarration: boolean; format: string }): Promise<{ downloadUrl: string; jobId: string }> {
    const { data } = await this.client.post(`/narration/${projectId}/export-video`, options);
    return data;
  }

  // ============================================
  // AI RESEARCH API
  // ============================================

  // Start research; if projectId is falsy, call the general `/ai-research/research` endpoint
  async startResearch(projectId: string | undefined, input: { topic: string; depth?: string; sources?: string[] }) {
    const url = projectId ? `/ai-research/research/${projectId}` : `/ai-research/research`;
    const { data } = await this.client.post(url, input);
    return data;
  }

  // Get research by id (legacy frontend path)
  async getResearch(id: string) {
    const { data } = await this.client.get(`/ai-research/research/${id}`);
    return data;
  }

  // List research items for a project
  async listResearch(projectId: string) {
    const { data } = await this.client.get(`/ai-research/research/project/${projectId}`);
    return data;
  }

  // Get user-level research history (no projectId)
  async getResearchHistory() {
    const { data } = await this.client.get(`/ai-research/history`);
    return data;
  }

  async generateContentBlocks(id: string) {
    const { data } = await this.client.post(`/ai-research/research/${id}/generate-blocks`);
    return data;
  }

  async factCheck(id: string) {
    const { data } = await this.client.post(`/ai-research/research/${id}/fact-check`);
    return data;
  }

  // ============================================
  // STORYBOARDING API (aligned with backend)
  // ============================================

  // Create / generate a storyboard using the backend AI endpoint.
  // Maps frontend `title` -> backend `topic` and includes `projectId`.
  async createStoryboard(projectId: string, input: { title: string; narrativeArc?: string; audienceType?: string; slidesCount?: number }) {
    const payload = {
      topic: input.title,
      projectId,
      audienceType: input.audienceType || 'general',
      // presentationType left undefined so backend will default to 'summary'
    } as const;

    const { data } = await this.client.post(`/storyboarding/generate`, payload);
    return data;
  }

  // Get a storyboard by id (backend route: GET /storyboarding/:id)
  async getStoryboard(id: string) {
    const { data } = await this.client.get(`/storyboarding/${id}`);
    return data;
  }

  // List storyboards for the current user and optionally filter by projectId on the client
  async listStoryboards(projectId?: string) {
    const { data } = await this.client.get(`/storyboarding`);
    if (projectId) {
      // server returns user's storyboards; filter client-side by projectId when requested
      return (data as any[]).filter((s) => s.projectId === projectId);
    }
    return data;
  }

  // Apply a storyboard to a project. Backend route: POST /storyboarding/:id/apply/:projectId
  async applyStoryboard(id: string, projectId?: string) {
    if (!projectId) {
      throw new Error('projectId is required to apply a storyboard');
    }

    const { data } = await this.client.post(`/storyboarding/${id}/apply/${projectId}`);
    return data;
  }

  // ============================================
  // A/B TESTING API
  // ============================================

  async createABTest(projectId: string, input: { name: string; variants: object[] }) {
    const { data } = await this.client.post(`/ab-testing/tests/${projectId}`, input);
    return data;
  }

  async getABTest(id: string) {
    const { data } = await this.client.get(`/ab-testing/tests/${id}`);
    return data;
  }

  async listABTests(projectId: string) {
    const { data } = await this.client.get(`/ab-testing/tests/project/${projectId}`);
    return data;
  }

  async recordABImpression(testId: string, variantId: string) {
    const { data } = await this.client.post(`/ab-testing/tests/${testId}/impression`, { variantId });
    return data;
  }

  async getABResults(testId: string) {
    const { data } = await this.client.get(`/ab-testing/tests/${testId}/results`);
    return data;
  }

  // ============================================
  // VR/AR API
  // ============================================

  async exportToVR(projectId: string, options?: object) {
    const { data } = await this.client.post(`/vr-ar/export/${projectId}`, options || {});
    return data;
  }

  async getVRExport(id: string) {
    const { data } = await this.client.get(`/vr-ar/exports/${id}`);
    return data;
  }

  async generateARMarker(projectId: string) {
    const { data } = await this.client.post(`/vr-ar/ar-marker/${projectId}`);
    return data;
  }

  // ============================================
  // HOLOGRAPHIC API
  // ============================================

  async createHolographicPreview(projectId: string, input: { format: string; settings?: object }) {
    const { data } = await this.client.post(`/holographic/preview/${projectId}`, input);
    return data;
  }

  async getHolographicPreview(id: string) {
    const { data } = await this.client.get(`/holographic/preview/${id}`);
    return data;
  }

  async getHolographicFormats() {
    const { data } = await this.client.get('/holographic/formats');
    return data;
  }

  // ============================================
  // BLOCKCHAIN/NFT API
  // ============================================

  async createNFTCollection(input: { name: string; chain: string; description?: string }) {
    const { data } = await this.client.post('/blockchain/collections', input);
    return data;
  }

  async listNFTCollections() {
    const { data } = await this.client.get('/blockchain/collections');
    return data;
  }

  async mintNFT(collectionId: string, input: { presentationId: string; name: string; description?: string }) {
    const { data } = await this.client.post(`/blockchain/collections/${collectionId}/mint`, input);
    return data;
  }

  async verifyNFTOwnership(tokenId: string) {
    const { data } = await this.client.get(`/blockchain/verify/${tokenId}`);
    return data;
  }

  // ============================================
  // AI COPILOT API
  // ============================================

  async createChatSession(projectId: string) {
    const { data } = await this.client.post(`/ai-copilot/sessions/${projectId}`);
    return data;
  }

  async sendChatMessage(sessionId: string, message: string) {
    const { data } = await this.client.post(`/ai-copilot/sessions/${sessionId}/message`, { message });
    return data;
  }

  async getChatHistory(sessionId: string) {
    const { data } = await this.client.get(`/ai-copilot/sessions/${sessionId}/history`);
    return data;
  }

  async executeCopilotAction(sessionId: string, action: string, params?: object) {
    const { data } = await this.client.post(`/ai-copilot/sessions/${sessionId}/action`, { action, params });
    return data;
  }

  // ============================================
  // LIVE Q&A API
  // ============================================

  async createLiveQASession(projectId: string, settings?: object) {
    const { data } = await this.client.post(`/live-qa/sessions/${projectId}`, settings);
    return data;
  }

  async getQASession(id: string) {
    const { data } = await this.client.get(`/live-qa/sessions/${id}`);
    return data;
  }

  async endQASession(sessionId: string) {
    const { data } = await this.client.post(`/live-qa/sessions/${sessionId}/end`);
    return data;
  }

  async getQASummary(sessionId: string) {
    const { data } = await this.client.get(`/live-qa/sessions/${sessionId}/summary`);
    return data;
  }

  // ============================================
  // CROSS-PLATFORM SYNC API
  // ============================================

  async registerSyncDevice(input: { deviceName: string; deviceType: string; platform: string }) {
    const { data } = await this.client.post('/sync/devices', input);
    return data;
  }

  async listSyncDevices() {
    const { data } = await this.client.get('/sync/devices');
    return data;
  }

  async getSyncStatus(projectId: string) {
    const { data } = await this.client.get(`/sync/status/${projectId}`);
    return data;
  }

  async resolveConflict(conflictId: string, resolution: string) {
    const { data } = await this.client.post(`/sync/conflicts/${conflictId}/resolve`, { resolution });
    return data;
  }

  // ============================================
  // PREDICTIVE ANALYTICS API
  // ============================================

  async getPredictiveInsights(projectId: string) {
    const { data } = await this.client.get(`/predictive-analytics/insights/${projectId}`);
    return data;
  }

  async getPredictiveRecommendations(projectId: string) {
    const { data } = await this.client.get(`/predictive-analytics/recommendations/${projectId}`);
    return data;
  }

  async getPredictiveBenchmarks(projectId: string) {
    const { data } = await this.client.get(`/predictive-analytics/benchmarks/${projectId}`);
    return data;
  }

  // ============================================
  // SENTIMENT ANALYSIS API
  // ============================================

  async startSentimentSession(projectId: string, options?: object) {
    const { data } = await this.client.post(`/sentiment-analysis/sessions/${projectId}`, options);
    return data;
  }

  async getSentimentSession(id: string) {
    const { data } = await this.client.get(`/sentiment-analysis/sessions/${id}`);
    return data;
  }

  async getSentimentSummary(sessionId: string) {
    const { data } = await this.client.get(`/sentiment-analysis/sessions/${sessionId}/summary`);
    return data;
  }

  // ============================================
  // LEARNING PATHS API
  // ============================================

  async createLearningPath(presentationId: string) {
    const { data } = await this.client.post(`/learning-paths/paths/${presentationId}`);
    return data;
  }

  async getLearningPath(id: string) {
    const { data } = await this.client.get(`/learning-paths/paths/${id}`);
    return data;
  }

  async listLearningPaths() {
    const { data } = await this.client.get('/learning-paths/paths');
    return data;
  }

  async updateLearningProgress(pathId: string, moduleId: string, completed: boolean) {
    const { data } = await this.client.post(`/learning-paths/paths/${pathId}/progress`, { moduleId, completed });
    return data;
  }

  async getLearningCertificate(pathId: string) {
    const { data } = await this.client.get(`/learning-paths/paths/${pathId}/certificate`);
    return data;
  }

  // ============================================
  // SIGN LANGUAGE API
  // ============================================

  async translateToSignLanguage(input: { text: string; language?: string }) {
    const { data } = await this.client.post('/sign-language/translate', input);
    return data;
  }

  async getSignLanguageConfig(projectId: string) {
    const { data } = await this.client.get(`/sign-language/config/${projectId}`);
    return data;
  }

  async updateSignLanguageConfig(projectId: string, config: object) {
    const { data } = await this.client.put(`/sign-language/config/${projectId}`, config);
    return data;
  }

  async getSupportedSignLanguages() {
    const { data } = await this.client.get('/sign-language/languages');
    return data;
  }

  // ============================================
  // COGNITIVE ACCESSIBILITY API
  // ============================================

  async getCognitiveProfile() {
    const { data } = await this.client.get('/cognitive-accessibility/profile');
    return data;
  }

  async updateCognitiveProfile(settings: object) {
    const { data } = await this.client.put('/cognitive-accessibility/profile', settings);
    return data;
  }

  async getCognitivePresets() {
    const { data } = await this.client.get('/cognitive-accessibility/presets');
    return data;
  }

  async applyPreset(presetName: string) {
    const { data } = await this.client.post(`/cognitive-accessibility/presets/${presetName}/apply`);
    return data;
  }

  async simplifyText(text: string, level?: string) {
    const { data } = await this.client.post('/cognitive-accessibility/simplify', { text, level });
    return data;
  }

  // ============================================
  // UNIVERSAL DESIGN CHECKER API
  // ============================================

  async checkDesign(projectId: string, options?: object) {
    const { data } = await this.client.post(`/universal-design/check/${projectId}`, options);
    return data;
  }

  async getDesignReport(reportId: string) {
    const { data } = await this.client.get(`/universal-design/reports/${reportId}`);
    return data;
  }

  async getCulturalGuide(region: string) {
    const { data } = await this.client.get(`/universal-design/cultural-guide/${region}`);
    return data;
  }

  // ============================================
  // PUBLIC API KEYS MANAGEMENT
  // ============================================

  async createAPIKey(input: { name: string; scopes: string[]; expiresInDays?: number }) {
    const { data } = await this.client.post('/public-api/keys', input);
    return data;
  }

  async listAPIKeys() {
    const { data } = await this.client.get('/public-api/keys');
    return data;
  }

  async revokeAPIKey(id: string) {
    const { data } = await this.client.delete(`/public-api/keys/${id}`);
    return data;
  }

  async getAPIUsage(keyId: string) {
    const { data } = await this.client.get(`/public-api/keys/${keyId}/usage`);
    return data;
  }

  async getAPIDocs() {
    const { data } = await this.client.get('/public-api/docs');
    return data;
  }

  // ============================================
  // WHITE-LABEL SDK API
  // ============================================

  async createSDKConfig(input: { name: string; branding?: object; features?: string[] }) {
    const { data } = await this.client.post('/white-label-sdk/configurations', input);
    return data;
  }

  async listSDKConfigs() {
    const { data } = await this.client.get('/white-label-sdk/configurations');
    return data;
  }

  async getSDKConfig(id: string) {
    const { data } = await this.client.get(`/white-label-sdk/configurations/${id}`);
    return data;
  }

  async updateSDKConfig(id: string, updates: object) {
    const { data } = await this.client.put(`/white-label-sdk/configurations/${id}`, updates);
    return data;
  }

  async getSDKEmbedCode(id: string) {
    const { data } = await this.client.get(`/white-label-sdk/configurations/${id}/embed`);
    return data;
  }

  async getSDKReactComponent(id: string) {
    const { data } = await this.client.get(`/white-label-sdk/configurations/${id}/react`);
    return data;
  }

  // ============================================
  // IOT INTEGRATION API
  // ============================================

  async registerIoTDevice(input: { name: string; type: string; capabilities: object }) {
    const { data } = await this.client.post('/iot/devices', input);
    return data;
  }

  async listIoTDevices() {
    const { data } = await this.client.get('/iot/devices');
    return data;
  }

  async getIoTDevice(id: string) {
    const { data } = await this.client.get(`/iot/devices/${id}`);
    return data;
  }

  async sendIoTCommand(deviceId: string, command: { action: string; payload?: object }) {
    const { data } = await this.client.post(`/iot/devices/${deviceId}/command`, command);
    return data;
  }

  async getIoTDeviceTypes() {
    const { data } = await this.client.get('/iot/device-types');
    return data;
  }

  async revokeIoTDevice(id: string) {
    const { data } = await this.client.delete(`/iot/devices/${id}`);
    return data;
  }

  // ============================================
  // ECO-FRIENDLY API
  // ============================================

  async getEcoSettings() {
    const { data } = await this.client.get('/eco/settings');
    return data;
  }

  async updateEcoSettings(settings: object) {
    const { data } = await this.client.put('/eco/settings', settings);
    return data;
  }

  async getEcoPreset(preset: string) {
    const { data } = await this.client.get(`/eco/presets/${preset}`);
    return data;
  }

  async optimizePresentation(presentationId: string, options: object) {
    const { data } = await this.client.post(`/eco/optimize/${presentationId}`, options);
    return data;
  }

  async getEcoTips() {
    const { data } = await this.client.get('/eco/tips');
    return data;
  }

  async trackEcoMetrics(metrics: object) {
    const { data } = await this.client.post('/eco/track', metrics);
    return data;
  }

  // ============================================
  // PRESENTER WELLNESS API
  // ============================================

  async startWellnessSession(presentationId: string) {
    const { data } = await this.client.post(`/wellness/sessions/${presentationId}`);
    return data;
  }

  async updateWellnessMetrics(sessionId: string, metrics: object) {
    const { data } = await this.client.put(`/wellness/sessions/${sessionId}/metrics`, metrics);
    return data;
  }

  async endWellnessSession(sessionId: string) {
    const { data } = await this.client.post(`/wellness/sessions/${sessionId}/end`);
    return data;
  }

  async recordWellnessBreak(sessionId: string, breakType: string) {
    const { data } = await this.client.post(`/wellness/sessions/${sessionId}/break`, { breakType });
    return data;
  }

  async analyzeSpeakingPace(audioMetrics: object) {
    const { data } = await this.client.post('/wellness/analyze/pace', audioMetrics);
    return data;
  }

  async detectStress(voiceMetrics: object) {
    const { data } = await this.client.post('/wellness/analyze/stress', voiceMetrics);
    return data;
  }

  async getWellnessHistory() {
    const { data } = await this.client.get('/wellness/history');
    return data;
  }

  async getWellnessTrends() {
    const { data } = await this.client.get('/wellness/trends');
    return data;
  }

  async getBreakReminders() {
    const { data } = await this.client.get('/wellness/break-reminders');
    return data;
  }

  // ============================================
  // CARBON FOOTPRINT API
  // ============================================

  async getCarbonFootprint(presentationId: string) {
    const { data } = await this.client.get(`/carbon/presentation/${presentationId}`);
    return data;
  }

  async calculateSessionCarbon(sessionData: object) {
    const { data } = await this.client.post('/carbon/session', sessionData);
    return data;
  }

  async getEcoReport(period: string) {
    const { data } = await this.client.get(`/carbon/report?period=${period}`);
    return data;
  }

  async getCarbonOffsetOptions(emissionsKg: number) {
    const { data } = await this.client.get(`/carbon/offset-options?emissions=${emissionsKg}`);
    return data;
  }

  async purchaseCarbonOffset(offsetData: object) {
    const { data } = await this.client.post('/carbon/offset', offsetData);
    return data;
  }

  async getCarbonOffsetHistory() {
    const { data } = await this.client.get('/carbon/offset-history');
    return data;
  }

  async getEcoBadges() {
    const { data } = await this.client.get('/carbon/badges');
    return data;
  }

  // ============================================
  // BRAND KIT ENDPOINTS
  // ============================================

  async createBrandKit(data: {
    name: string;
    colors?: { primary: string; secondary: string; accent: string; background?: string; text?: string };
    typography?: { headingFont: string; bodyFont: string; monoFont?: string };
    logos?: { primary?: string; secondary?: string; icon?: string };
    guidelines?: string;
  }, organizationId?: string): Promise<{ id: string; name: string }> {
    const { data: result } = await this.client.post('/brand-kits', data, {
      params: organizationId ? { organizationId } : undefined,
    });
    return result;
  }

  async getBrandKits(organizationId?: string): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
    const { data } = await this.client.get('/brand-kits', {
      params: organizationId ? { organizationId } : undefined,
    });
    return data;
  }

  async getDefaultBrandKit(organizationId?: string): Promise<{ id: string; name: string }> {
    const { data } = await this.client.get('/brand-kits/default', {
      params: organizationId ? { organizationId } : undefined,
    });
    return data;
  }

  async getBrandKit(id: string): Promise<{ id: string; name: string; colors: unknown; typography: unknown; logos: unknown }> {
    const { data } = await this.client.get(`/brand-kits/${id}`);
    return data;
  }

  async getBrandKitAsTheme(id: string): Promise<{ theme: unknown }> {
    const { data } = await this.client.get(`/brand-kits/${id}/theme`);
    return data;
  }

  async updateBrandKit(id: string, updates: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const { data } = await this.client.put(`/brand-kits/${id}`, updates);
    return data;
  }

  async setDefaultBrandKit(id: string): Promise<{ success: boolean }> {
    const { data } = await this.client.put(`/brand-kits/${id}/default`);
    return data;
  }

  async duplicateBrandKit(id: string, name?: string): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post(`/brand-kits/${id}/duplicate`, { name });
    return data;
  }

  async deleteBrandKit(id: string): Promise<void> {
    await this.client.delete(`/brand-kits/${id}`);
  }

  // ============================================
  // CONTENT LIBRARY ENDPOINTS
  // ============================================

  async saveToLibrary(item: {
    name: string;
    description?: string;
    type: 'slide' | 'block';
    content: unknown;
    tags?: string[];
    category?: string;
  }): Promise<{ id: string; name: string }> {
    const { data } = await this.client.post('/library/save', item);
    return data;
  }

  async getLibrary(options?: {
    type?: 'slide' | 'block';
    category?: string;
    search?: string;
  }): Promise<{ items: Array<{ id: string; name: string; type: string; content: unknown; tags?: string[]; category?: string }> }> {
    const { data } = await this.client.get('/library', { params: options });
    return data;
  }

  async getLibraryTemplates(type?: 'slide' | 'block'): Promise<{ templates: Array<{ id: string; name: string; type: string; content: unknown }> }> {
    const { data } = await this.client.get('/library/templates', { params: type ? { type } : undefined });
    return data;
  }

  async deleteFromLibrary(itemId: string): Promise<{ success: boolean }> {
    const { data } = await this.client.delete(`/library/${itemId}`);
    return data;
  }

  // ============================================
  // IMAGE ACQUISITION ENDPOINTS
  // ============================================

  async acquireImage(options: {
    source: 'ai' | 'unsplash' | 'pexels' | 'pixabay' | 'url';
    query?: string;
    prompt?: string;
    url?: string;
    orientation?: 'landscape' | 'portrait' | 'square';
    color?: string;
    projectId: string;
    slideId?: string;
    autoAdd?: boolean;
  }): Promise<{ success: boolean; image: { url: string; source: string; width: number; height: number; attribution?: string } }> {
    const { data } = await this.client.post('/image-acquisition/acquire', options);
    return data;
  }

  async acquireImageAsync(options: {
    source: 'ai' | 'unsplash' | 'pexels' | 'pixabay' | 'url';
    query?: string;
    prompt?: string;
    url?: string;
    orientation?: 'landscape' | 'portrait' | 'square';
    color?: string;
    projectId: string;
    slideId?: string;
    autoAdd?: boolean;
  }): Promise<{ success: boolean; jobId: string; message: string }> {
    const { data } = await this.client.post('/image-acquisition/acquire-async', options);
    return data;
  }

  async smartAcquireImage(options: {
    query: string;
    projectId: string;
    slideId?: string;
    orientation?: 'landscape' | 'portrait' | 'square';
    autoAdd?: boolean;
  }): Promise<{ success: boolean; image: { url: string; source: string; width: number; height: number } }> {
    const { data } = await this.client.post('/image-acquisition/smart-acquire', options);
    return data;
  }

  async bulkAcquireImages(options: {
    topic: string;
    count: number;
    projectId: string;
    autoCreateSlides?: boolean;
  }): Promise<{ success: boolean; jobId: string; message: string }> {
    const { data } = await this.client.post('/image-acquisition/bulk-acquire', options);
    return data;
  }

  async getImageAcquisitionJobStatus(jobId: string): Promise<{
    success: boolean;
    job: { id: string; state: string; progress: number; result: unknown; failedReason?: string };
  }> {
    const { data } = await this.client.get(`/image-acquisition/job/${jobId}`);
    return data;
  }

  async getImageSources(): Promise<{
    success: boolean;
    sources: Array<{ id: string; name: string; available: boolean; requiresQuery?: boolean; requiresPrompt?: boolean }>;
  }> {
    const { data } = await this.client.get('/image-acquisition/sources');
    return data;
  }

  // ============================================
  // IMAGE RECOGNITION ENDPOINTS
  // ============================================

  async generateImageEmbedding(uploadId: string, imageUrl: string): Promise<{ embedding: number[] }> {
    const { data } = await this.client.post('/image-recognition/embedding', { uploadId, imageUrl });
    return data;
  }

  async batchGenerateImageEmbeddings(uploadIds: string[]): Promise<{ message: string; count: number }> {
    const { data } = await this.client.post('/image-recognition/embeddings/batch', { uploadIds });
    return data;
  }

  async findSimilarImages(uploadId: string, limit?: number, minSimilarity?: number): Promise<{
    images: Array<{ uploadId: string; similarity: number; imageUrl: string }>;
  }> {
    const { data } = await this.client.post('/image-recognition/similar', { uploadId, limit, minSimilarity });
    return data;
  }

  async trackImageUsage(usage: {
    uploadId: string;
    projectId: string;
    slideId?: string;
    blockId?: string;
    usageType?: 'content' | 'background' | 'thumbnail';
  }): Promise<{ success: boolean }> {
    const { data } = await this.client.post('/image-recognition/track-usage', usage);
    return data;
  }

  async removeImageUsage(usageId: string): Promise<{ success: boolean }> {
    const { data } = await this.client.delete(`/image-recognition/usage/${usageId}`);
    return data;
  }

  async getImagesInPresentation(projectId: string): Promise<{
    images: Array<{ uploadId: string; imageUrl: string; slideId: string; usageType: string }>;
  }> {
    const { data } = await this.client.get(`/image-recognition/presentation/${projectId}/images`);
    return data;
  }

  async findPresentationsUsingImage(uploadId: string): Promise<{
    presentations: Array<{ projectId: string; title: string; slideCount: number }>;
  }> {
    const { data } = await this.client.get(`/image-recognition/image/${uploadId}/presentations`);
    return data;
  }

  async getImageAnalytics(): Promise<{
    totalImages: number;
    totalUsages: number;
    topImages: Array<{ uploadId: string; usageCount: number }>;
  }> {
    const { data } = await this.client.get('/image-recognition/analytics');
    return data;
  }

  async predictImagesForPresentation(options: {
    title?: string;
    description?: string;
    tone?: string;
    audience?: string;
    existingTags?: string[];
    limit?: number;
  }): Promise<{ predictions: Array<{ uploadId: string; imageUrl: string; relevanceScore: number }> }> {
    const { data } = await this.client.post('/image-recognition/predict', options);
    return data;
  }

  async describeImage(imageUrl: string): Promise<{ description: string }> {
    const { data } = await this.client.post('/image-recognition/describe', { imageUrl });
    return data;
  }

  // ============================================
  // PRESENTATION COACH ENDPOINTS
  // ============================================

  async analyzePresentation(input: {
    title: string;
    slides: Array<{ content: string; speakerNotes?: string; hasImage: boolean; layout: string }>;
    audience?: string;
    purpose?: string;
  }): Promise<{
    overallScore: number;
    categories: Array<{ name: string; score: number; feedback: string }>;
    suggestions: string[];
  }> {
    const { data } = await this.client.post('/ai/coach/analyze', input);
    return data;
  }

  async getRehearsalFeedback(input: {
    transcript: string;
    duration: number;
    slideTimings: Array<{ slideIndex: number; startTime: number; endTime: number }>;
    suggestedDurationPerSlide: number;
  }): Promise<{
    pacingFeedback: string;
    timingIssues: Array<{ slideIndex: number; issue: string }>;
    suggestions: string[];
  }> {
    const { data } = await this.client.post('/ai/coach/rehearsal-feedback', input);
    return data;
  }

  async suggestSlideImprovements(input: {
    content: string;
    type: string;
    context: string;
  }): Promise<{
    improvements: Array<{ area: string; suggestion: string; priority: string }>;
  }> {
    const { data } = await this.client.post('/ai/coach/improve-slide', input);
    return data;
  }

  async generateCoachSpeakerNotes(input: {
    title: string;
    content: string;
    context: string;
    duration: number;
  }): Promise<{ speakerNotes: string }> {
    const { data } = await this.client.post('/ai/coach/speaker-notes', input);
    return data;
  }

  // ============================================
  // DATA IMPORT ENDPOINTS
  // ============================================

  async uploadDataFile(formData: FormData): Promise<{
    success: boolean;
    data: { parsed: { headers: string[]; rows: unknown[][]; metadata: unknown }; analysis: unknown };
  }> {
    const { data } = await this.client.post('/ai/data-import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async generatePresentationFromData(formData: FormData): Promise<{
    success: boolean;
    data: { project: unknown; presentation: unknown; metadata: unknown };
  }> {
    const { data } = await this.client.post('/ai/data-import/generate-presentation', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async previewExcelSheets(formData: FormData): Promise<{
    success: boolean;
    data: { fileName: string; sheets: Array<{ name: string; rowCount: number }> };
  }> {
    const { data } = await this.client.post('/ai/data-import/preview-sheets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  async analyzeDataFile(formData: FormData, sheetName?: string): Promise<{
    success: boolean;
    data: { metadata: unknown; analysis: unknown; preview: { headers: string[]; sampleRows: unknown[][] } };
  }> {
    const { data } = await this.client.post('/ai/data-import/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: sheetName ? { sheetName } : undefined,
    });
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
    generateAndCreate: (input: unknown) => this.generateAndCreateProject(input as GenerateProjectInput),
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
    generateImage: (prompt: string, options?: { size?: '1024x1024' | '1792x1024' | '1024x1792'; style?: string }) =>
      this.generateImage(prompt, options),
    suggestLayout: (content: string) => this.suggestLayout(content),
    generateNarration: (text: string, options?: { voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'; speed?: number }) =>
      this.generateVoiceNarration(text, options),
    generateSpeakerNotes: (content: string) => this.generateSpeakerNotes(content),
    suggestImages: (topic: string, count?: number) => this.suggestImages(topic, count),
  };

  readonly live = {
    startSession: (projectId: string) => this.startLiveSession(projectId),
    endSession: (projectId: string, sessionId: string) => this.endLiveSession(projectId, sessionId),
    getQuestions: (sessionId: string) => this.getLiveSessionQuestions(sessionId),
    createPoll: (sessionId: string, question: string, options: string[]) =>
      this.createPoll(sessionId, question, options),
    closePoll: (sessionId: string, pollId: string) => this.closePoll(sessionId, pollId),
  };

  readonly analytics = {
    getInsights: (projectId: string) => this.getAIInsights(projectId),
    getHeatmap: (projectId: string) => this.getEngagementHeatmap(projectId),
    getAudience: (projectId: string) => this.getAudienceBreakdown(projectId),
  };

  readonly webhooks = {
    getAll: () => this.getWebhooks(),
    create: (url: string, events: string[], secret?: string) => this.createWebhook(url, events, secret),
    update: (id: string, updates: { url?: string; events?: string[]; active?: boolean }) => this.updateWebhook(id, updates),
    delete: (id: string) => this.deleteWebhook(id),
    test: (id: string) => this.testWebhook(id),
  };

  readonly tags = {
    getAll: () => this.getTags(),
    getById: (id: string) => this.getTag(id),
    create: (input: CreateTagInput) => this.createTag(input),
    update: (id: string, input: UpdateTagInput) => this.updateTag(id, input),
    delete: (id: string) => this.deleteTag(id),
    addToProject: (tagId: string, projectId: string) => this.addTagToProject(tagId, projectId),
    removeFromProject: (tagId: string, projectId: string) => this.removeTagFromProject(tagId, projectId),
  };

  readonly research = {
    start: (projectId: string | undefined, input: { topic: string; depth?: string; sources?: string[] }) => this.startResearch(projectId, input),
    get: (id: string) => this.getResearch(id),
    list: (projectId: string) => this.listResearch(projectId),
    getHistory: () => this.getResearchHistory(),
    generateBlocks: (id: string) => this.generateContentBlocks(id),
    factCheck: (id: string) => this.factCheck(id),
  };

  readonly storyboard = {
    create: (projectId: string, input: { title: string; narrativeArc?: string; audienceType?: string }) => this.createStoryboard(projectId, input),
    get: (id: string) => this.getStoryboard(id),
    list: (projectId?: string) => this.listStoryboards(projectId),
    apply: (id: string, projectId?: string) => this.applyStoryboard(id, projectId),
  };

  readonly abTesting = {
    create: (projectId: string, input: { name: string; variants: object[] }) => this.createABTest(projectId, input),
    get: (id: string) => this.getABTest(id),
    list: (projectId: string) => this.listABTests(projectId),
    recordImpression: (testId: string, variantId: string) => this.recordABImpression(testId, variantId),
    getResults: (testId: string) => this.getABResults(testId),
  };

  readonly vr = {
    export: (projectId: string, options?: object) => this.exportToVR(projectId, options),
    get: (id: string) => this.getVRExport(id),
    generateMarker: (projectId: string) => this.generateARMarker(projectId),
  };

  readonly holographic = {
    create: (projectId: string, input: { format: string; settings?: object }) => this.createHolographicPreview(projectId, input),
    get: (id: string) => this.getHolographicPreview(id),
    getFormats: () => this.getHolographicFormats(),
  };

  readonly blockchain = {
    createCollection: (input: { name: string; chain: string; description?: string }) => this.createNFTCollection(input),
    listCollections: () => this.listNFTCollections(),
    mint: (collectionId: string, input: { presentationId: string; name: string; description?: string }) => this.mintNFT(collectionId, input),
    verify: (tokenId: string) => this.verifyNFTOwnership(tokenId),
  };

  readonly copilot = {
    createSession: (projectId: string) => this.createChatSession(projectId),
    sendMessage: (sessionId: string, message: string) => this.sendChatMessage(sessionId, message),
    getHistory: (sessionId: string) => this.getChatHistory(sessionId),
    executeAction: (sessionId: string, action: string, params?: object) => this.executeCopilotAction(sessionId, action, params),
  };

  readonly qa = {
    createSession: (projectId: string, settings?: object) => this.createLiveQASession(projectId, settings),
    getSession: (id: string) => this.getQASession(id),
    endSession: (sessionId: string) => this.endQASession(sessionId),
    getSummary: (sessionId: string) => this.getQASummary(sessionId),
  };

  readonly crossSync = {
    registerDevice: (input: object) => this.registerSyncDevice(input as any),
    listDevices: () => this.listSyncDevices(),
    getSyncStatus: () => this.getSyncStatus(''),
    resolveConflict: (conflictId: string) => this.resolveConflict(conflictId, 'accept'),
  };

  readonly predictive = {
    getInsights: (projectId: string) => this.getPredictiveInsights(projectId),
    getRecommendations: (projectId: string) => this.getPredictiveRecommendations(projectId),
    getBenchmarks: (projectId: string) => this.getPredictiveBenchmarks(projectId),
  };

  readonly sentiment = {
    startSession: (projectId: string, options?: object) => this.startSentimentSession(projectId, options as any),
    getSession: (id: string) => this.getSentimentSession(id),
    getSummary: (sessionId: string) => this.getSentimentSummary(sessionId),
  };

  readonly learningPaths = {
    create: (input: object) => this.createLearningPath(input as any),
    get: (id: string) => this.getLearningPath(id),
    list: () => this.listLearningPaths(),
    updateProgress: (pathId: string, moduleId: string, completed: boolean) => this.updateLearningProgress(pathId, moduleId, completed),
    getCertificate: (pathId: string) => this.getLearningCertificate(pathId),
  };

  readonly signLanguage = {
    translate: (input: { text: string; language?: string }) => this.translateToSignLanguage(input),
    getConfig: (projectId?: string) => this.getSignLanguageConfig(projectId || ''),
    updateConfig: (projectId: string, config: object) => this.updateSignLanguageConfig(projectId, config),
    getLanguages: () => this.getSupportedSignLanguages(),
  };

  readonly cognitiveAccess = {
    getProfile: () => this.getCognitiveProfile(),
    updateProfile: (settings: object) => this.updateCognitiveProfile(settings),
    getPresets: () => this.getCognitivePresets(),
    applyPreset: (name: string) => this.applyPreset(name),
    simplifyText: (text: string, level?: string) => this.simplifyText(text, level),
  };

  readonly universalDesign = {
    check: (projectId: string, options?: object) => this.checkDesign(projectId, options as any),
    getReport: (projectId: string) => this.getDesignReport(projectId),
    getCulturalGuide: (projectId: string) => this.getCulturalGuide(projectId),
  };

  readonly apiKeys = {
    create: (input: { name: string; scopes: string[]; expiresInDays?: number }) => this.createAPIKey(input),
    list: () => this.listAPIKeys(),
    revoke: (id: string) => this.revokeAPIKey(id),
    getUsage: () => this.getAPIUsage(''),
    getDocs: () => this.getAPIDocs(),
  };

  readonly sdk = {
    create: (input: object) => this.createSDKConfig(input as any),
    list: () => this.listSDKConfigs(),
    get: (id: string) => this.getSDKConfig(id),
    update: (id: string, updates: object) => this.updateSDKConfig(id, updates),
    getEmbedCode: (id: string) => this.getSDKEmbedCode(id),
    getReactComponent: (id: string) => this.getSDKReactComponent(id),
  };

  readonly iot = {
    register: (input: object) => this.registerIoTDevice(input as any),
    list: () => this.listIoTDevices(),
    get: (id: string) => this.getIoTDevice(id),
    sendCommand: (deviceId: string, command: { action: string; payload?: object }) => this.sendIoTCommand(deviceId, command),
    getDeviceTypes: () => this.getIoTDeviceTypes(),
    revoke: (id: string) => this.revokeIoTDevice(id),
  };

  readonly eco = {
    getSettings: () => this.getEcoSettings(),
    updateSettings: (settings: object) => this.updateEcoSettings(settings),
    getPreset: (preset: string) => this.getEcoPreset(preset),
    optimize: (presentationId: string, options: object) => this.optimizePresentation(presentationId, options),
    getTips: () => this.getEcoTips(),
    trackMetrics: (metrics: object) => this.trackEcoMetrics(metrics),
  };

  readonly wellness = {
    startSession: (input: object) => this.startWellnessSession(input as any),
    updateMetrics: (sessionId: string, metrics: object) => this.updateWellnessMetrics(sessionId, metrics),
    endSession: (sessionId: string) => this.endWellnessSession(sessionId),
    recordBreak: (input: object) => this.recordWellnessBreak((input as any).sessionId, (input as any).type || 'short'),
    analyzePace: (sessionId: string) => this.analyzeSpeakingPace({ sessionId } as any),
    detectStress: (sessionId: string) => this.detectStress({ sessionId } as any),
    getHistory: () => this.getWellnessHistory(),
    getTrends: () => this.getWellnessTrends(),
    getBreakReminders: () => this.getBreakReminders(),
  };

  readonly carbon = {
    getFootprint: (presentationId: string) => this.getCarbonFootprint(presentationId),
    calculateSession: (sessionData: object) => this.calculateSessionCarbon(sessionData),
    getReport: (period: string) => this.getEcoReport(period),
    getOffsetOptions: () => this.getCarbonOffsetOptions(0),
    purchaseOffset: (offsetData: object) => this.purchaseCarbonOffset(offsetData),
    getOffsetHistory: () => this.getCarbonOffsetHistory(),
    getBadges: () => this.getEcoBadges(),
  };

  readonly brandKit = {
    create: (data: Parameters<typeof this.createBrandKit>[0], orgId?: string) => this.createBrandKit(data, orgId),
    list: (orgId?: string) => this.getBrandKits(orgId),
    getDefault: (orgId?: string) => this.getDefaultBrandKit(orgId),
    get: (id: string) => this.getBrandKit(id),
    getAsTheme: (id: string) => this.getBrandKitAsTheme(id),
    update: (id: string, updates: Record<string, unknown>) => this.updateBrandKit(id, updates),
    setDefault: (id: string) => this.setDefaultBrandKit(id),
    duplicate: (id: string, name?: string) => this.duplicateBrandKit(id, name),
    delete: (id: string) => this.deleteBrandKit(id),
  };

  readonly library = {
    save: (item: Parameters<typeof this.saveToLibrary>[0]) => this.saveToLibrary(item),
    get: (options?: Parameters<typeof this.getLibrary>[0]) => this.getLibrary(options),
    getTemplates: (type?: 'slide' | 'block') => this.getLibraryTemplates(type),
    delete: (itemId: string) => this.deleteFromLibrary(itemId),
  };

  readonly imageAcquisition = {
    acquire: (options: Parameters<typeof this.acquireImage>[0]) => this.acquireImage(options),
    acquireAsync: (options: Parameters<typeof this.acquireImageAsync>[0]) => this.acquireImageAsync(options),
    smartAcquire: (options: Parameters<typeof this.smartAcquireImage>[0]) => this.smartAcquireImage(options),
    bulkAcquire: (options: Parameters<typeof this.bulkAcquireImages>[0]) => this.bulkAcquireImages(options),
    getJobStatus: (jobId: string) => this.getImageAcquisitionJobStatus(jobId),
    getSources: () => this.getImageSources(),
  };

  readonly imageRecognition = {
    generateEmbedding: (uploadId: string, imageUrl: string) => this.generateImageEmbedding(uploadId, imageUrl),
    batchEmbeddings: (uploadIds: string[]) => this.batchGenerateImageEmbeddings(uploadIds),
    findSimilar: (uploadId: string, limit?: number, minSimilarity?: number) => this.findSimilarImages(uploadId, limit, minSimilarity),
    trackUsage: (usage: Parameters<typeof this.trackImageUsage>[0]) => this.trackImageUsage(usage),
    removeUsage: (usageId: string) => this.removeImageUsage(usageId),
    getInPresentation: (projectId: string) => this.getImagesInPresentation(projectId),
    findPresentations: (uploadId: string) => this.findPresentationsUsingImage(uploadId),
    getAnalytics: () => this.getImageAnalytics(),
    predict: (options: Parameters<typeof this.predictImagesForPresentation>[0]) => this.predictImagesForPresentation(options),
    describe: (imageUrl: string) => this.describeImage(imageUrl),
  };

  readonly coach = {
    analyze: (input: Parameters<typeof this.analyzePresentation>[0]) => this.analyzePresentation(input),
    rehearsalFeedback: (input: Parameters<typeof this.getRehearsalFeedback>[0]) => this.getRehearsalFeedback(input),
    improveSlide: (input: Parameters<typeof this.suggestSlideImprovements>[0]) => this.suggestSlideImprovements(input),
    speakerNotes: (input: Parameters<typeof this.generateCoachSpeakerNotes>[0]) => this.generateCoachSpeakerNotes(input),
  };

  readonly dataImport = {
    upload: (formData: FormData) => this.uploadDataFile(formData),
    generatePresentation: (formData: FormData) => this.generatePresentationFromData(formData),
    previewSheets: (formData: FormData) => this.previewExcelSheets(formData),
    analyze: (formData: FormData, sheetName?: string) => this.analyzeDataFile(formData, sheetName),
  };
}

// Export singleton instance
export const api = new ApiClient();

// Export class for testing
export { ApiClient };
