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

interface ContentBlock {
  type: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
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
    const { projectId, sources = ['web', 'wikipedia'], maxResults = 10, language = 'en' } = options || {};

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
        const wikiResults = await this.searchWikipedia(topic, language, Math.ceil(maxResults / 2));
        results.push(...wikiResults);
      }

      // Search web (using DuckDuckGo instant answer API as free alternative)
      if (sources.includes('web')) {
        const webResults = await this.searchWeb(topic, Math.ceil(maxResults / 2));
        results.push(...webResults);
      }

      // Search academic sources
      if (sources.includes('academic')) {
        const academicResults = await this.searchAcademic(topic, Math.ceil(maxResults / 3));
        results.push(...academicResults);
      }

      // Search news
      if (sources.includes('news')) {
        const newsResults = await this.searchNews(topic, Math.ceil(maxResults / 3));
        results.push(...newsResults);
      }

      // Save sources to database
      for (const result of results) {
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
      const summary = await this.generateResearchSummary(topic, results);
      const keywords = await this.extractKeywords(topic, results);

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
  private async searchWikipedia(query: string, language: string = 'en', limit: number = 5): Promise<ResearchResult[]> {
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

      const searchResults: WikipediaSearchResult[] = searchResponse.data.query?.search || [];
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

        const page = contentResponse.data.query?.pages?.[result.pageid];
        
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
  private async searchWeb(query: string, limit: number = 5): Promise<ResearchResult[]> {
    try {
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1,
        },
      });

      const data = response.data;
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
  private async searchAcademic(query: string, limit: number = 5): Promise<ResearchResult[]> {
    try {
      const response = await axios.get('https://api.crossref.org/works', {
        params: {
          query,
          rows: limit,
          sort: 'relevance',
        },
        headers: {
          'User-Agent': 'PresentationGenerator/1.0 (mailto:support@example.com)',
        },
      });

      const items = response.data.message?.items || [];
      return items.map((item: { title?: string[]; DOI?: string; abstract?: string; author?: { given?: string; family?: string }[]; published?: { 'date-parts'?: number[][] } }) => ({
        title: item.title?.[0] || 'Untitled',
        url: item.DOI ? `https://doi.org/${item.DOI}` : undefined,
        snippet: item.abstract?.substring(0, 500) || 'No abstract available',
        content: item.abstract,
        sourceType: 'academic',
        relevanceScore: 0.85,
        credibilityScore: 0.95,
        author: item.author?.map((a: { given?: string; family?: string }) => `${a.given || ''} ${a.family || ''}`).join(', '),
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
  private async searchNews(query: string, limit: number = 5): Promise<ResearchResult[]> {
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

      const articles = response.data.articles || [];
      return articles.map((article: { title: string; url: string; description: string; content: string; source?: { name: string }; publishedAt: string }) => ({
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
  private async generateResearchSummary(topic: string, results: ResearchResult[]): Promise<string> {
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
        { maxTokens: 500 }
      );

      return response;
    } catch {
      return `Research results for "${topic}" compiled from ${results.length} sources.`;
    }
  }

  /**
   * Extract keywords from research
   */
  private async extractKeywords(topic: string, results: ResearchResult[]): Promise<string[]> {
    const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ');

    try {
      const response = await this.aiService.generateText(
        `Extract 5-10 key terms and keywords from the following text about "${topic}". Return only the keywords as a comma-separated list.

Text:
${allText.substring(0, 2000)}

Keywords:`,
        { maxTokens: 100 }
      );

      return response.split(',').map(k => k.trim()).filter(k => k.length > 0);
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
      .filter(s => s.relevanceScore && s.relevanceScore > 0.7)
      .slice(0, 5)
      .map(s => s.snippet || s.title);

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
      .filter(s => s.credibilityScore && s.credibilityScore > 0.8)
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
   * Extract statistics from research sources
   */
  private extractStatistics(sources: { snippet?: string | null; content?: string | null }[]): Array<{ label: string; value: string }> {
    const stats: Array<{ label: string; value: string }> = [];
    const statPattern = /(\d+(?:\.\d+)?%?|\$[\d,]+(?:\.\d+)?[KMB]?)\s+(?:of\s+)?([^.!?]+)/gi;

    for (const source of sources) {
      const text = `${source.snippet || ''} ${source.content || ''}`;
      let match;
      while ((match = statPattern.exec(text)) !== null && stats.length < 4) {
        stats.push({
          value: match[1],
          label: match[2].substring(0, 50).trim(),
        });
      }
    }

    return stats;
  }

  /**
   * Get user's research history
   */
  async getResearchHistory(userId: string, limit: number = 10) {
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
}
