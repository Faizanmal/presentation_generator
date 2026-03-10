import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import axios from 'axios';

interface ResearchResult {
  title: string;
  url?: string;
  snippet: string;
  content?: string;
  sourceType: string;
  relevanceScore: number;
  credibilityScore: number;
  author?: string;
  publishedDate?: Date;
}

interface WikipediaSearchResult {
  title: string;
  pageid: number;
  snippet: string;
}

interface WikipediaSearchResponse {
  query?: {
    search?: WikipediaSearchResult[];
  };
}

interface WikipediaPageResponse {
  query?: {
    pages?: Record<
      string,
      {
        extract?: string;
      }
    >;
  };
}

interface DuckDuckGoResponse {
  Abstract?: string;
  Heading?: string;
  AbstractURL?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
}

interface CrossRefItem {
  title?: string[];
  DOI?: string;
  abstract?: string;
  author?: Array<{ given?: string; family?: string }>;
  published?: { 'date-parts'?: number[][] };
}

interface CrossRefResponse {
  message?: {
    items?: CrossRefItem[];
  };
}

interface GNewsArticle {
  title: string;
  url: string;
  description: string;
  content: string;
  source?: { name: string };
  publishedAt: string;
}

interface GNewsResponse {
  articles?: GNewsArticle[];
}

export interface ContentBlock {
  type: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

const MIN_RELEVANCE_SCORE = 0.3; // Filter out low-quality results

// Base credibility ranges per source type (adjusted dynamically)
const SOURCE_CREDIBILITY: Record<string, number> = {
  wikipedia: 0.85,
  web: 0.7,
  academic: 0.95,
  news: 0.75,
  bing: 0.75,
};

/** Research result cache with TTL */
const RESEARCH_CACHE = new Map<
  string,
  {
    results: ResearchResult[];
    timestamp: number;
  }
>();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

/** Source verification and fact-checking */
interface FactCheckResult {
  claim: string;
  verified: boolean;
  confidence: number;
  sources: string[];
}

/**
 * Compute a dynamic relevance score between a query and text content.
 * Uses term-frequency matching to avoid hardcoded scores.
 */
function computeRelevanceScore(query: string, text: string): number {
  if (!text || !query) return 0.3;
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const textLower = text.toLowerCase();
  const matchedTerms = queryTerms.filter((term) => textLower.includes(term));
  const termRatio =
    queryTerms.length > 0 ? matchedTerms.length / queryTerms.length : 0;
  // Scale from 0.3 (no match) to 0.98 (all terms matched)
  return Math.min(0.98, 0.3 + termRatio * 0.68);
}

@Injectable()
export class AIResearchService {
  private readonly logger = new Logger(AIResearchService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Research a topic and return curated content blocks
   */
  async researchTopic(
    userId: string,
    topic: string,
    options?: {
      projectId?: string;
      sources?: string[];
      maxResults?: number;
      language?: string;
    },
  ) {
    const {
      projectId,
      sources = ['web', 'wikipedia'],
      maxResults = 10,
      language = 'en',
    } = options || {};

    // Create research record
    const research = await this.prisma.contentResearch.create({
      data: {
        userId,
        projectId,
        topic,
        query: topic,
        status: 'researching',
        keywords: [],
      },
    });

    try {
      const results: ResearchResult[] = [];

      // Search Wikipedia
      if (sources.includes('wikipedia')) {
        const wikiResults = await this.searchWikipedia(
          topic,
          language,
          Math.ceil(maxResults / 2),
        );
        results.push(...wikiResults);
      }

      // Search web (using DuckDuckGo instant answer API as free alternative)
      if (sources.includes('web')) {
        const webResults = await this.searchWeb(
          topic,
          Math.ceil(maxResults / 2),
        );
        results.push(...webResults);
      }

      // Search academic sources
      if (sources.includes('academic')) {
        const academicResults = await this.searchAcademic(
          topic,
          Math.ceil(maxResults / 3),
        );
        results.push(...academicResults);
      }

      // Search news
      if (sources.includes('news')) {
        const newsResults = await this.searchNews(
          topic,
          Math.ceil(maxResults / 3),
        );
        results.push(...newsResults);
      }

      // Deduplicate results by URL and filter by relevance threshold
      const seenUrls = new Set<string>();
      const deduplicated = results
        .filter((r) => {
          if (r.relevanceScore < MIN_RELEVANCE_SCORE) return false;
          if (r.url) {
            if (seenUrls.has(r.url)) return false;
            seenUrls.add(r.url);
          }
          return true;
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);

      // Save sources to database
      for (const result of deduplicated) {
        await this.prisma.contentResearchSource.create({
          data: {
            researchId: research.id,
            sourceType: result.sourceType,
            title: result.title,
            url: result.url,
            snippet: result.snippet,
            content: result.content,
            relevanceScore: result.relevanceScore,
            credibilityScore: result.credibilityScore,
            author: result.author,
            publishedDate: result.publishedDate,
          },
        });
      }

      // Generate AI summary and content blocks
      const summary = await this.generateResearchSummary(topic, deduplicated);
      const keywords = await this.extractKeywords(topic, deduplicated);

      // Update research record
      const updatedResearch = await this.prisma.contentResearch.update({
        where: { id: research.id },
        data: {
          status: 'completed',
          results: results as unknown as object,
          summary,
          keywords,
          completedAt: new Date(),
        },
        include: {
          sources: true,
        },
      });

      return updatedResearch;
    } catch (error) {
      this.logger.error(`Research failed for topic: ${topic}`, error);
      await this.prisma.contentResearch.update({
        where: { id: research.id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  /**
   * Search Wikipedia for relevant content
   */
  private async searchWikipedia(
    query: string,
    language: string = 'en',
    limit: number = 5,
  ): Promise<ResearchResult[]> {
    try {
      const searchUrl = `https://${language}.wikipedia.org/w/api.php`;

      // Search for articles
      const searchResponse = await axios.get(searchUrl, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: query,
          srlimit: limit,
          format: 'json',
          origin: '*',
        },
      });

      const searchResults: WikipediaSearchResult[] =
        (searchResponse.data as WikipediaSearchResponse).query?.search || [];
      const results: ResearchResult[] = [];

      for (const result of searchResults) {
        // Get full content for each result
        const contentResponse = await axios.get(searchUrl, {
          params: {
            action: 'query',
            pageids: result.pageid,
            prop: 'extracts',
            exintro: true,
            explaintext: true,
            format: 'json',
            origin: '*',
          },
        });

        const page = (contentResponse.data as WikipediaPageResponse).query
          ?.pages?.[result.pageid];

        results.push({
          title: result.title,
          url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
          snippet: result.snippet.replace(/<[^>]*>/g, ''), // Strip HTML
          content: page?.extract || result.snippet.replace(/<[^>]*>/g, ''),
          sourceType: 'wikipedia',
          relevanceScore: computeRelevanceScore(
            query,
            `${result.title} ${result.snippet} ${page?.extract || ''}`,
          ),
          credibilityScore: SOURCE_CREDIBILITY['wikipedia'],
        });
      }

      return results;
    } catch (error) {
      this.logger.error('Wikipedia search failed', error);
      return [];
    }
  }

  /**
   * Search web using DuckDuckGo instant answer API
   */
  private async searchWeb(
    query: string,
    limit: number = 5,
  ): Promise<ResearchResult[]> {
    try {
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1,
        },
      });

      const data = response.data as DuckDuckGoResponse;
      const results: ResearchResult[] = [];

      // Add abstract if available
      if (data.Abstract) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.Abstract,
          content: data.Abstract,
          sourceType: 'web',
          relevanceScore: computeRelevanceScore(
            query,
            `${data.Heading || ''} ${data.Abstract}`,
          ),
          credibilityScore: SOURCE_CREDIBILITY['web'],
        });
      }

      // Add related topics
      const relatedTopics = data.RelatedTopics?.slice(0, limit - 1) || [];
      for (const topic of relatedTopics) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 50),
            url: topic.FirstURL,
            snippet: topic.Text,
            sourceType: 'web',
            relevanceScore: computeRelevanceScore(query, topic.Text),
            credibilityScore: SOURCE_CREDIBILITY['web'],
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Web search failed', error);
      return [];
    }
  }

  /**
   * Search academic sources using CrossRef API (free)
   */
  private async searchAcademic(
    query: string,
    limit: number = 5,
  ): Promise<ResearchResult[]> {
    try {
      const response = await axios.get('https://api.crossref.org/works', {
        params: {
          query,
          rows: limit,
          sort: 'relevance',
        },
        headers: {
          'User-Agent':
            'PresentationGenerator/1.0 (mailto:support@example.com)',
        },
      });

      const items = (response.data as CrossRefResponse).message?.items || [];
      return items.map((item: CrossRefItem) => ({
        title: item.title?.[0] || 'Untitled',
        url: item.DOI ? `https://doi.org/${item.DOI}` : undefined,
        snippet: item.abstract?.substring(0, 500) || 'No abstract available',
        content: item.abstract,
        sourceType: 'academic',
        relevanceScore: computeRelevanceScore(
          query,
          `${item.title?.[0] || ''} ${item.abstract || ''}`,
        ),
        credibilityScore: SOURCE_CREDIBILITY['academic'],
        author: item.author
          ?.map((a) => `${a.given || ''} ${a.family || ''}`)
          .join(', '),
        publishedDate: item.published?.['date-parts']?.[0]
          ? new Date(item.published['date-parts'][0].join('-'))
          : undefined,
      }));
    } catch (error) {
      this.logger.error('Academic search failed', error);
      return [];
    }
  }

  /**
   * Search news articles
   */
  private async searchNews(
    query: string,
    limit: number = 5,
  ): Promise<ResearchResult[]> {
    // Using GNews API — requires a real API key
    try {
      const apiKey = this.configService.get('GNEWS_API_KEY');
      if (!apiKey) {
        this.logger.warn(
          'GNews API key not configured. Skipping news search. Set GNEWS_API_KEY in your environment.',
        );
        return [];
      }

      const response = await axios.get('https://gnews.io/api/v4/search', {
        params: {
          q: query,
          lang: 'en',
          max: limit,
          apikey: apiKey,
        },
      });

      const articles = (response.data as GNewsResponse).articles || [];
      return articles.map((article: GNewsArticle) => ({
        title: article.title,
        url: article.url,
        snippet: article.description,
        content: article.content,
        sourceType: 'news',
        relevanceScore: computeRelevanceScore(
          query,
          `${article.title} ${article.description} ${article.content}`,
        ),
        credibilityScore: SOURCE_CREDIBILITY['news'],
        author: article.source?.name,
        publishedDate: new Date(article.publishedAt),
      }));
    } catch (error) {
      this.logger.error('News search failed', error);
      return [];
    }
  }

  /**
   * Generate AI summary of research results
   */
  private async generateResearchSummary(
    topic: string,
    results: ResearchResult[],
  ): Promise<string> {
    const sourceSummaries = results
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`)
      .join('\n');

    try {
      const response = await this.aiService.generateText(
        `Summarize the following research on "${topic}" into a concise, informative paragraph that could be used in a presentation. Focus on key facts, statistics, and insights.

Research findings:
${sourceSummaries}

Provide a clear, professional summary in 2-3 paragraphs.`,
        { maxTokens: 500 },
      );

      return response;
    } catch {
      return `Research results for "${topic}" compiled from ${results.length} sources.`;
    }
  }

  /**
   * Extract keywords from research
   */
  private async extractKeywords(
    topic: string,
    results: ResearchResult[],
  ): Promise<string[]> {
    const allText = results.map((r) => `${r.title} ${r.snippet}`).join(' ');

    try {
      const response = await this.aiService.generateText(
        `Extract 5-10 key terms and keywords from the following text about "${topic}". Return only the keywords as a comma-separated list.

Text:
${allText.substring(0, 2000)}

Keywords:`,
        { maxTokens: 100 },
      );

      return response
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
    } catch {
      return [topic];
    }
  }

  /**
   * Generate ready-to-insert content blocks from research
   */
  async generateContentBlocks(researchId: string): Promise<ContentBlock[]> {
    const research = await this.prisma.contentResearch.findUnique({
      where: { id: researchId },
      include: { sources: true },
    });

    if (!research) {
      throw new BadRequestException('Research not found');
    }

    const blocks: ContentBlock[] = [];

    // Generate heading block
    blocks.push({
      type: 'heading',
      content: research.topic,
    });

    // Generate summary paragraph
    if (research.summary) {
      blocks.push({
        type: 'paragraph',
        content: research.summary,
      });
    }

    // Generate key points from sources
    const keyPoints = research.sources
      .filter((s) => s.relevanceScore && s.relevanceScore > 0.7)
      .slice(0, 5)
      .map((s) => s.snippet || s.title);

    if (keyPoints.length > 0) {
      blocks.push({
        type: 'bullet_list',
        content: keyPoints.join('\n'),
        metadata: { items: keyPoints },
      });
    }

    // Generate statistics block if available
    const stats = this.extractStatistics(research.sources);
    if (stats.length > 0) {
      blocks.push({
        type: 'stats_grid',
        content: JSON.stringify(stats),
        metadata: { stats },
      });
    }

    // Generate quote from credible source
    const topSource = research.sources
      .filter((s) => s.credibilityScore && s.credibilityScore > 0.8)
      .sort((a, b) => (b.credibilityScore || 0) - (a.credibilityScore || 0))[0];

    if (topSource?.snippet) {
      blocks.push({
        type: 'quote',
        content: topSource.snippet,
        source: topSource.url || topSource.title,
        metadata: {
          author: topSource.author,
          source: topSource.title,
        },
      });
    }

    return blocks;
  }

  /**
   * Fact-check research sources using the AI service and persist results
   */
  async factCheckResearch(researchId: string, userId: string) {
    const research = await this.prisma.contentResearch.findUnique({
      where: { id: researchId },
      include: { sources: true },
    });

    if (!research || research.userId !== userId) {
      throw new BadRequestException('Research not found');
    }

    const sourcesToCheck = (research.sources || []).slice(0, 6); // limit checks

    const results: Array<{
      sourceId: string;
      verdict: string;
      confidence: number;
      note: string;
    }> = [];

    for (const s of sourcesToCheck) {
      const prompt = `You are an expert fact-checker. Evaluate the credibility and factual accuracy of the following source. Return ONLY a JSON object with keys: verdict (confirmed|disputed|uncertain), confidence (0-100), note (short reasoning).\nTitle: ${s.title}\nURL: ${s.url || 'n/a'}\nSnippet: ${s.snippet || ''}\nContent: ${s.content || ''}`;

      let raw: string;
      try {
        raw = await this.aiService.generateText(prompt, { maxTokens: 200 });
      } catch (err) {
        this.logger.warn('AI fact-check failed for source', err);
        raw = '';
      }

      // Try to parse JSON out of AI response
      let parsed: { verdict: string; confidence: number; note: string } = {
        verdict: 'uncertain',
        confidence: 50,
        note: raw || 'AI fact-check failed to return structured output',
      };

      try {
        const first = raw.indexOf('{');
        const last = raw.lastIndexOf('}');
        const jsonText =
          first !== -1 && last !== -1 ? raw.substring(first, last + 1) : raw;
        const obj = JSON.parse(jsonText) as {
          verdict?: string;
          confidence?: number;
          note?: string;
        };
        parsed = {
          verdict: obj.verdict || 'uncertain',
          confidence: obj.confidence || 50,
          note: obj.note || JSON.stringify(obj).slice(0, 200),
        };
      } catch {
        // keep fallback parsed
      }

      // Persist per-source fact-check result into metadata
      const newMetadata = {
        ...((s.metadata as Record<string, unknown>) || {}),
        factCheck: parsed,
      };

      await this.prisma.contentResearchSource.update({
        where: { id: s.id },
        data: { metadata: newMetadata },
      });

      results.push({ sourceId: s.id, ...parsed });
    }

    // Generate a short summary of fact-check results
    const summaryPrompt = `Given these fact-check outcomes for research on "${research.topic}":\n${results
      .map(
        (r) =>
          `- source:${r.sourceId} verdict:${r.verdict} confidence:${r.confidence} note:${r.note}`,
      )
      .join(
        '\n',
      )}\n\nProvide a 2-sentence summary of overall reliability and recommended next actions.`;

    let summary = 'Fact-check completed.';
    try {
      summary = await this.aiService.generateText(summaryPrompt, {
        maxTokens: 200,
      });
    } catch {
      // ignore summary failure
    }

    await this.prisma.contentResearch.update({
      where: { id: researchId },
      data: {
        metadata: {
          ...((research.metadata as Record<string, unknown>) || {}),
          factCheckSummary: summary,
          factCheckedAt: new Date(),
        },
      },
    });

    return this.prisma.contentResearch.findUnique({
      where: { id: researchId },
      include: { sources: true },
    });
  }

  /**
   * Extract statistics from research sources
   */
  private extractStatistics(
    sources: { snippet?: string | null; content?: string | null }[],
  ): Array<{ label: string; value: string }> {
    const stats: Array<{ label: string; value: string }> = [];
    const statPattern =
      /(\d+(?:\.\d+)?%?|\$[\d,]+(?:\.\d+)?[KMB]?)\s+(?:of\s+)?([^.!?]+)/gi;

    for (const source of sources) {
      const text = `${source.snippet || ''} ${source.content || ''}`;
      let match;
      while ((match = statPattern.exec(text)) !== null && stats.length < 4) {
        stats.push({
          value: match[1],
          label: (match[2] as string).substring(0, 50).trim(),
        });
      }
    }

    return stats;
  }

  /**
   * Get user's research history
   */
  getResearchHistory(userId: string, limit: number = 10) {
    return this.prisma.contentResearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            url: true,
            relevanceScore: true,
          },
        },
      },
    });
  }

  /**
   * List research items for a project (scoped to user)
   */
  listResearchByProject(projectId: string, userId: string) {
    return this.prisma.contentResearch.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            url: true,
            relevanceScore: true,
          },
        },
      },
    });
  }

  /**
   * Get single research by ID
   */
  async getResearch(id: string, userId: string) {
    const research = await this.prisma.contentResearch.findUnique({
      where: { id },
      include: { sources: true },
    });

    if (!research || research.userId !== userId) {
      throw new BadRequestException('Research not found');
    }

    return research;
  }

  /**
   * Delete research
   */
  async deleteResearch(id: string, userId: string) {
    const research = await this.prisma.contentResearch.findUnique({
      where: { id },
    });

    if (!research || research.userId !== userId) {
      throw new BadRequestException('Research not found');
    }

    return this.prisma.contentResearch.delete({ where: { id } });
  }

  /**
   * Get paginated research history for a user
   */
  async getResearchHistoryPaginated(
    userId: string,
    options?: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 20, status } = options || {};
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.contentResearch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          topic: true,
          status: true,
          summary: true,
          keywords: true,
          createdAt: true,
          completedAt: true,
          _count: { select: { sources: true } },
        },
      }),
      this.prisma.contentResearch.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get research statistics for a user
   */
  async getResearchStats(userId: string) {
    const [total, completed, failed] = await Promise.all([
      this.prisma.contentResearch.count({ where: { userId } }),
      this.prisma.contentResearch.count({
        where: { userId, status: 'completed' },
      }),
      this.prisma.contentResearch.count({
        where: { userId, status: 'failed' },
      }),
    ]);

    const topKeywordsRaw = await this.prisma.contentResearch.findMany({
      where: { userId, status: 'completed' },
      select: { keywords: true },
      take: 100,
    });

    // Flatten and count keywords
    const keywordFrequency: Record<string, number> = {};
    for (const r of topKeywordsRaw) {
      const kws = r.keywords as unknown as string[];
      if (Array.isArray(kws)) {
        for (const kw of kws) {
          keywordFrequency[kw] = (keywordFrequency[kw] || 0) + 1;
        }
      }
    }

    const topKeywords = Object.entries(keywordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw, count]) => ({ keyword: kw, count }));

    return {
      total,
      completed,
      failed,
      inProgress: total - completed - failed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      topKeywords,
    };
  }

  /**
   * Parallel research with multiple sources
   */
  async conductParallelResearch(
    query: string,
    options: {
      sources?: Array<'wikipedia' | 'web' | 'academic' | 'news'>;
      maxResults?: number;
      language?: string;
    } = {},
  ): Promise<{
    results: ResearchResult[];
    summary: string;
    keywords: string[];
    totalTime: number;
  }> {
    const startTime = Date.now();
    const {
      sources = ['wikipedia', 'web', 'academic'],
      maxResults = 20,
      language = 'en',
    } = options;

    // Check cache first
    const cacheKey = `${query}-${sources.join(',')}-${language}`.toLowerCase();
    const cached = RESEARCH_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      this.logger.log(`Cache hit for research query: ${query}`);
      return {
        results: cached.results,
        summary: await this.generateResearchSummary(query, cached.results),
        keywords: await this.extractKeywords(query, cached.results),
        totalTime: Date.now() - startTime,
      };
    }

    // Execute all searches in parallel
    const searchPromises: Promise<ResearchResult[]>[] = [];

    if (sources.includes('wikipedia')) {
      searchPromises.push(
        this.searchWikipedia(query, language, 5).catch((err) => {
          this.logger.warn('Wikipedia search failed', err);
          return [];
        }),
      );
    }

    if (sources.includes('web')) {
      searchPromises.push(
        this.searchWeb(query, 5).catch((err) => {
          this.logger.warn('Web search failed', err);
          return [];
        }),
      );
    }

    if (sources.includes('academic')) {
      searchPromises.push(
        this.searchAcademic(query, 5).catch((err) => {
          this.logger.warn('Academic search failed', err);
          return [];
        }),
      );
    }

    // Wait for all searches to complete
    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();

    // Deduplicate and rank
    const seenUrls = new Set<string>();
    const deduplicated = flatResults
      .filter((r) => {
        if (r.relevanceScore < MIN_RELEVANCE_SCORE) return false;
        if (r.url) {
          if (seenUrls.has(r.url)) return false;
          seenUrls.add(r.url);
        }
        return true;
      })
      .sort((a, b) => {
        // Weighted ranking: relevance + credibility
        const scoreA = a.relevanceScore * 0.7 + a.credibilityScore * 0.3;
        const scoreB = b.relevanceScore * 0.7 + b.credibilityScore * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, maxResults);

    // Cache results
    RESEARCH_CACHE.set(cacheKey, {
      results: deduplicated,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    this.cleanupCache();

    const summary = await this.generateResearchSummary(query, deduplicated);
    const keywords = await this.extractKeywords(query, deduplicated);

    return {
      results: deduplicated,
      summary,
      keywords,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of RESEARCH_CACHE.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        RESEARCH_CACHE.delete(key);
      }
    }
  }

  /**
   * Fact-check a claim using multiple sources
   */
  async factCheck(claim: string): Promise<FactCheckResult> {
    try {
      const research = await this.conductParallelResearch(claim, {
        sources: ['wikipedia', 'academic', 'news'],
        maxResults: 10,
      });

      // Use AI to analyze if sources support the claim
      const verificationPrompt = `Analyze if the following claim is supported by the research sources:

Claim: "${claim}"

Sources:
${research.results.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join('\n')}

Return JSON:
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "explanation": "brief explanation",
  "supportingSources": [indices of supporting sources]
}`;

      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a fact-checking expert. Analyze claims objectively.',
          },
          { role: 'user', content: verificationPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No verification result');
      }

      const result = JSON.parse(content);

      const sourcesArr: number[] = Array.isArray(result.supportingSources)
        ? (result.supportingSources as number[])
        : [];
      const sources = sourcesArr
        .map((i) => research.results[i]?.url || '')
        .filter(Boolean);

      return {
        claim,
        verified: result.verified || false,
        confidence: result.confidence || 0.5,
        sources,
      };
    } catch (error) {
      this.logger.error('Fact checking failed', error);
      return {
        claim,
        verified: false,
        confidence: 0,
        sources: [],
      };
    }
  }

  /**
   * Extract key insights from research results
   */
  async extractInsights(
    topic: string,
    results: ResearchResult[],
  ): Promise<{
    keyPoints: string[];
    trends: string[];
    statistics: Array<{ fact: string; source: string }>;
    recommendations: string[];
  }> {
    try {
      const combinedContent = results
        .map((r) => `${r.title}: ${r.content || r.snippet}`)
        .join('\n\n');

      const prompt = `Analyze this research about "${topic}" and extract insights:

${combinedContent}

Return JSON:
{
  "keyPoints": ["point 1", "point 2", ...],
  "trends": ["trend 1", "trend 2", ...],
  "statistics": [{"fact": "stat", "source": "source name"}, ...],
  "recommendations": ["recommendation 1", ...]
}`;

      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Extract key insights from research data. Be factual and concise.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No insights generated');
      }

      const parsed = JSON.parse(content);
      return parsed as {
        keyPoints: string[];
        trends: string[];
        statistics: Array<{ fact: string; source: string }>;
        recommendations: string[];
      };
    } catch (error) {
      this.logger.error('Insight extraction failed', error);
      return {
        keyPoints: [],
        trends: [],
        statistics: [],
        recommendations: [],
      };
    }
  }

  /**
   * Multi-lingual research support
   */
  async researchMultiLingual(
    query: string,
    languages: string[] = ['en', 'es', 'fr', 'de'],
  ): Promise<Map<string, ResearchResult[]>> {
    const results = new Map<string, ResearchResult[]>();

    // Search in parallel for all languages
    const searches = languages.map(async (lang) => {
      try {
        const langResults = await this.conductParallelResearch(query, {
          language: lang,
          maxResults: 5,
        });
        return { lang, results: langResults.results };
      } catch (error) {
        this.logger.warn(`Research for language ${lang} failed`, error);
        return { lang, results: [] };
      }
    });

    const completed = await Promise.all(searches);

    for (const { lang, results: langResults } of completed) {
      results.set(lang, langResults);
    }

    return results;
  }

  /**
   * Trend analysis over time
   */
  async analyzeTrends(
    topic: string,
    timeframe: 'week' | 'month' | 'year' = 'month',
  ): Promise<{
    trendScore: number; // -100 to +100
    direction: 'rising' | 'falling' | 'stable';
    insights: string[];
    dataPoints: Array<{ date: string; volume: number }>;
  }> {
    try {
      // Research current and historical data
      const currentResearch = await this.conductParallelResearch(topic, {
        sources: ['news', 'web'],
        maxResults: 20,
      });

      // Analyze publication dates to determine trend
      const recentDates = currentResearch.results
        .filter((r) => r.publishedDate)
        .map((r) => r.publishedDate!.getTime())
        .sort((a, b) => b - a);

      const now = Date.now();
      const timeframes = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };

      const lookback = timeframes[timeframe];
      const recentCount = recentDates.filter(
        (d) => now - d < lookback / 2,
      ).length;
      const olderCount = recentDates.filter(
        (d) => now - d >= lookback / 2 && now - d < lookback,
      ).length;

      const trendScore =
        olderCount > 0 ? ((recentCount - olderCount) / olderCount) * 100 : 0;
      const direction =
        trendScore > 20 ? 'rising' : trendScore < -20 ? 'falling' : 'stable';

      return {
        trendScore,
        direction,
        insights: [
          `Found ${recentCount} recent mentions in the last ${timeframe}`,
          `Trend is ${direction} with score ${trendScore.toFixed(1)}`,
        ],
        dataPoints: [], // Would need time-series API for real data points
      };
    } catch (error) {
      this.logger.error('Trend analysis failed', error);
      return {
        trendScore: 0,
        direction: 'stable',
        insights: [],
        dataPoints: [],
      };
    }
  }

  /**
   * Generate research report with comprehensive analysis
   */
  async generateResearchReport(
    topic: string,
    options: {
      includeFactCheck?: boolean;
      includeTrends?: boolean;
      includeInsights?: boolean;
    } = {},
  ): Promise<{
    topic: string;
    summary: string;
    results: ResearchResult[];
    insights?: ReturnType<AIResearchService['extractInsights']> extends Promise<
      infer U
    >
      ? U
      : never;
    trends?: ReturnType<AIResearchService['analyzeTrends']> extends Promise<
      infer U
    >
      ? U
      : never;
    factChecks?: FactCheckResult[];
    generatedAt: Date;
  }> {
    const research = await this.conductParallelResearch(topic, {
      sources: ['wikipedia', 'web', 'academic', 'news'],
      maxResults: 30,
    });

    const report: {
      topic: string;
      summary: string;
      results: ResearchResult[];
      insights?: Awaited<ReturnType<AIResearchService['extractInsights']>>;
      trends?: Awaited<ReturnType<AIResearchService['analyzeTrends']>>;
      factChecks?: FactCheckResult[];
      generatedAt: Date;
    } = {
      topic,
      summary: research.summary,
      results: research.results,
      generatedAt: new Date(),
    };

    // Add insights if requested
    if (options.includeInsights) {
      report.insights = await this.extractInsights(topic, research.results);
    }

    // Add trend analysis if requested
    if (options.includeTrends) {
      report.trends = await this.analyzeTrends(topic);
    }

    // Add fact-checking if requested
    if (options.includeFactCheck && report.insights) {
      const claims = report.insights.keyPoints.slice(0, 3); // Check top 3 claims
      const factCheckPromises = claims.map((claim) => this.factCheck(claim));
      report.factChecks = await Promise.all(factCheckPromises);
    }

    return report;
  }
}
