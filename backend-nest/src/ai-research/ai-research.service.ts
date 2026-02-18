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
          relevanceScore: 0.9,
          credibilityScore: 0.85,
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
          relevanceScore: 0.95,
          credibilityScore: 0.8,
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
            relevanceScore: 0.7,
            credibilityScore: 0.7,
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
        relevanceScore: 0.85,
        credibilityScore: 0.95,
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
    // Using a free news API alternative (you can replace with NewsAPI if you have a key)
    try {
      const response = await axios.get('https://gnews.io/api/v4/search', {
        params: {
          q: query,
          lang: 'en',
          max: limit,
          apikey: this.configService.get('GNEWS_API_KEY') || 'demo',
        },
      });

      const articles = (response.data as GNewsResponse).articles || [];
      return articles.map((article: GNewsArticle) => ({
        title: article.title,
        url: article.url,
        snippet: article.description,
        content: article.content,
        sourceType: 'news',
        relevanceScore: 0.8,
        credibilityScore: 0.75,
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
  async factCheck(researchId: string, userId: string) {
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
}
