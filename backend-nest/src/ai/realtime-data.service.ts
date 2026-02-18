import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  displayLink?: string;
}

export interface RealTimeDataResult {
  query: string;
  results: SearchResult[];
  statistics?: unknown;
  timestamp: Date;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

interface GoogleSearchItem {
  title?: string;
  snippet?: string;
  link?: string;
  displayLink?: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  searchInformation?: unknown;
}

interface BingSearchItem {
  name?: string;
  snippet?: string;
  url?: string;
  displayUrl?: string;
}

interface BingSearchResponse {
  webPages?: {
    value?: BingSearchItem[];
  };
}

// Tavily Search Interfaces
interface TavilySearchItem {
  title: string;
  content: string;
  url: string;
}

interface TavilySearchResponse {
  results?: TavilySearchItem[];
  answer?: string;
}

@Injectable()
export class RealTimeDataService {
  private readonly logger = new Logger(RealTimeDataService.name);
  private readonly googleApiKey: string;
  private readonly googleSearchEngineId: string;
  private readonly bingApiKey: string;
  private readonly tavilyApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.googleApiKey = this.configService.get<string>('GOOGLE_API_KEY') || '';
    this.googleSearchEngineId =
      this.configService.get<string>('GOOGLE_SEARCH_ENGINE_ID') || '';
    this.bingApiKey = this.configService.get<string>('BING_API_KEY') || '';
    this.tavilyApiKey = this.configService.get<string>('TAVILY_API_KEY') || '';
  }

  /**
   * Search using Tavily API (Optimized for AI/LLM context)
   */
  async searchTavily(
    query: string,
    limit: number = 5,
  ): Promise<RealTimeDataResult> {
    if (!this.tavilyApiKey) {
      this.logger.warn('Tavily API key not configured');
      return this.getMockSearchResults(query, limit);
    }

    try {
      const response = await axios.post(
        'https://api.tavily.com/search',
        {
          query,
          search_depth: 'basic',
          max_results: limit,
          include_answer: true,
          include_raw_content: false,
        },
        {
          headers: {
            'api-key': this.tavilyApiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data as TavilySearchResponse;
      const results: SearchResult[] =
        data.results?.map((item) => ({
          title: item.title || '',
          snippet: item.content || item.title || '',
          link: item.url || '',
          displayLink: new URL(item.url).hostname,
        })) || [];

      // Include the direct answer if available as a "featured" result or statistics
      let statistics: unknown = undefined;
      if (data.answer) {
        statistics = { answer: data.answer };
      }

      return {
        query,
        results,
        statistics,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Tavily search failed: ${errorMessage}`);
      return this.getMockSearchResults(query, limit);
    }
  }

  /**
   * Search using Google Custom Search API
   */
  async searchGoogle(
    query: string,
    limit: number = 5,
  ): Promise<RealTimeDataResult> {
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      this.logger.warn('Google API credentials not configured');
      return this.getMockSearchResults(query, limit); // Fallback to mock if config missing
    }

    try {
      const response = await axios.get<GoogleSearchResponse>(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: {
            key: this.googleApiKey,
            cx: this.googleSearchEngineId,
            q: query,
            num: limit,
          },
        },
      );

      const items = response.data.items || [];
      // If google returns valid but empty items, it's a valid result, not an error.
      // But for our fallback logic, empty results might trigger next provider.

      const results: SearchResult[] = items.map((item) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        link: item.link || '',
        displayLink: item.displayLink,
      }));

      return {
        query,
        results,
        statistics: response.data.searchInformation,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Google search failed: ${errorMessage}`);
      // Don't return mock here, throw or return empty so the main search loop can try next provider
      // But returning mock here was the previous behavior.
      // Let's modify the main search method to handle fallbacks properly instead of relying on this returning mock.
      // For now, to keep signature, we return empty results if failed, to let caller decide.
      return { query, results: [], timestamp: new Date() };
    }
  }

  /**
   * Search using Bing Search API
   */
  async searchBing(
    query: string,
    limit: number = 5,
  ): Promise<RealTimeDataResult> {
    if (!this.bingApiKey) {
      this.logger.warn('Bing API key not configured');
      return { query, results: [], timestamp: new Date() };
    }

    try {
      const response = await axios.get<BingSearchResponse>(
        'https://api.bing.microsoft.com/v7.0/search',
        {
          params: {
            q: query,
            count: limit,
          },
          headers: {
            'Ocp-Apim-Subscription-Key': this.bingApiKey,
          },
        },
      );

      const results: SearchResult[] =
        response.data.webPages?.value?.map((item) => ({
          title: item.name || '',
          snippet: item.snippet || '',
          link: item.url || '',
          displayLink: item.displayUrl,
        })) || [];

      return {
        query,
        results,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bing search failed: ${errorMessage}`);
      return { query, results: [], timestamp: new Date() };
    }
  }

  /**
   * Smart search with fallback: Tavily -> Google -> Bing -> Mock
   */
  async search(query: string, limit: number = 5): Promise<RealTimeDataResult> {
    let result: RealTimeDataResult | null = null;

    // 1. Try Tavily (Best for AI context)
    if (this.tavilyApiKey) {
      result = await this.searchTavily(query, limit);
      if (result.results.length > 0) return result;
    }

    // 2. Try Google
    if (this.googleApiKey && this.googleSearchEngineId) {
      result = await this.searchGoogle(query, limit);
      if (result.results.length > 0) return result;
    }

    // 3. Try Bing
    if (this.bingApiKey) {
      result = await this.searchBing(query, limit);
      if (result.results.length > 0) return result;
    }

    // 4. Fallback to Mock Data
    this.logger.warn(
      `All search providers failed or returned no results for: "${query}". Using fallback.`,
    );
    return this.getMockSearchResults(query, limit);
  }

  /**
   * Extract numerical data from search results for charts
   */
  async extractChartData(
    query: string,
    dataPoints: number = 5,
  ): Promise<ChartDataPoint[]> {
    const searchResult = await this.search(query, 10);

    // Try to extract numbers and labels from snippets
    const extractedData: ChartDataPoint[] = [];

    for (const result of searchResult.results) {
      // Look for patterns like "X: 123" or "X - 123" or "X is 123"
      const patterns = [
        /([A-Za-z\s]+):\s*(\d+(?:\.\d+)?)/g,
        /([A-Za-z\s]+)\s*-\s*(\d+(?:\.\d+)?)/g,
        /([A-Za-z\s]+)\s+is\s+(\d+(?:\.\d+)?)/g,
        /(\d+(?:\.\d+)?)\s*([A-Za-z\s]+)/g,
      ];

      for (const pattern of patterns) {
        let match: RegExpExecArray | null = null;
        while ((match = pattern.exec(result.snippet)) !== null) {
          const label = match[1].trim();
          const value = parseFloat(match[2]);

          if (!isNaN(value) && label.length > 1 && label.length < 50) {
            extractedData.push({ label, value });
            if (extractedData.length >= dataPoints) break;
          }
        }
        if (extractedData.length >= dataPoints) break;
      }
      if (extractedData.length >= dataPoints) break;
    }

    // If we couldn't extract enough data, generate sample data
    if (extractedData.length < 3) {
      return this.generateSampleChartData(query, dataPoints);
    }

    return extractedData.slice(0, dataPoints);
  }

  /**
   * Generate sample chart data when real data isn't available
   */
  private generateSampleChartData(
    query: string,
    count: number,
  ): ChartDataPoint[] {
    const baseValue = Math.floor(Math.random() * 100) + 50;
    const data: ChartDataPoint[] = [];

    for (let i = 0; i < count; i++) {
      data.push({
        label: `Data Point ${i + 1}`,
        value: baseValue + Math.floor(Math.random() * 50) - 25,
      });
    }

    return data;
  }

  /**
   * Provide mock search results for development/fallback
   */
  private getMockSearchResults(
    query: string,
    limit: number,
  ): RealTimeDataResult {
    const mockResults: SearchResult[] = [
      {
        title: `Information about ${query}`,
        snippet: `This is a sample result about ${query}. In production, this would be real search data from Google or Bing.`,
        link: 'https://example.com/1',
        displayLink: 'example.com',
      },
      {
        title: `${query} - Overview and Statistics`,
        snippet: `Key statistics and data points about ${query}. Market size: $1.2B, Growth rate: 15%, Users: 2.5M.`,
        link: 'https://example.com/2',
        displayLink: 'example.com',
      },
      {
        title: `Latest trends in ${query}`,
        snippet: `Recent developments show ${query} is growing rapidly with significant investments and adoption.`,
        link: 'https://example.com/3',
        displayLink: 'example.com',
      },
    ];

    return {
      query,
      results: mockResults.slice(0, limit),
      timestamp: new Date(),
    };
  }

  /**
   * Get real-time statistics for a topic
   */
  async getTopicStatistics(topic: string): Promise<unknown> {
    const searchResult = await this.search(`${topic} statistics data`, 5);

    return {
      topic,
      searchResults: searchResult.results,
      summary: searchResult.results[0]?.snippet || 'No data available',
      lastUpdated: new Date(),
    };
  }
}
