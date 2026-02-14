import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from '../ai.service';
import axios from 'axios';

@Injectable()
export class ResearchAgentService {
  private readonly logger = new Logger(ResearchAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Conduct research on a topic using web search APIs
   */
  async conductResearch(
    topic: string,
    keyQuestions: string[] = [],
  ): Promise<{
    summary: string;
    sources: string[];
    dataPoints: string[];
  }> {
    this.logger.log(`Conducting research on: ${topic}`);

    // 1. Generate search queries
    const queries = await this.generateSearchQueries(topic, keyQuestions);

    // 2. Perform searches
    const searchResults = await this.performWebSearch(queries);

    // 3. Synthesize findings
    return this.synthesizeFindings(topic, searchResults);
  }

  /**
   * Generate effective search queries
   */
  private async generateSearchQueries(
    topic: string,
    questions: string[],
  ): Promise<string[]> {
    const prompt = `Generate 3 effective search queries to find real-time data and facts about: "${topic}".
${questions.length > 0 ? `Focus on answering: ${questions.join(', ')}` : ''}
Return only a JSON array of strings.`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content =
        response.choices[0]?.message?.content || '{"queries": []}';
      const parsed = JSON.parse(content);
      return parsed.queries || [topic, `${topic} statistics`, `${topic} facts`];
    } catch {
      return [topic, `${topic} trends`, `${topic} data`];
    }
  }

  /**
   * Perform actual web searches
   */
  private async performWebSearch(queries: string[]): Promise<string[]> {
    const results: string[] = [];
    const bingKey = this.configService.get<string>('BING_SEARCH_API_KEY');
    const googleKey = this.configService.get<string>('GOOGLE_SEARCH_API_KEY');
    const googleCx = this.configService.get<string>('GOOGLE_SEARCH_CX');

    // Limit to first 2 queries to save quota/time
    for (const query of queries.slice(0, 2)) {
      try {
        if (bingKey) {
          const response = await axios.get(
            'https://api.bing.microsoft.com/v7.0/search',
            {
              headers: { 'Ocp-Apim-Subscription-Key': bingKey },
              params: { q: query, count: 5 },
            },
          );

          (
            response.data as {
              webPages?: {
                value?: Array<{ name: string; snippet: string; url: string }>;
              };
            }
          ).webPages?.value?.forEach((page) => {
            results.push(
              `Source: ${page.name}\nSnippet: ${page.snippet}\nURL: ${page.url}`,
            );
          });
        } else if (googleKey && googleCx) {
          const response = await axios.get(
            'https://www.googleapis.com/customsearch/v1',
            {
              params: { key: googleKey, cx: googleCx, q: query, num: 5 },
            },
          );

          (
            response.data as {
              items?: Array<{ title: string; snippet: string; link: string }>;
            }
          ).items?.forEach((item) => {
            results.push(
              `Source: ${item.title}\nSnippet: ${item.snippet}\nURL: ${item.link}`,
            );
          });
        } else {
          // Mock response if no keys provided (for development/demo)
          this.logger.warn('No search API keys found. Using mock data.');
          results.push(
            `[Mock Search Result for "${query}"]: Latest data indicates significant growth in this sector. Key trends include AI adoption and sustainability. (Source: Simulated Data)`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Search failed for query "${query}": ${error.message}`,
        );
      }
    }

    return results;
  }

  /**
   * Synthesize search results into a cohesive summary
   */
  private async synthesizeFindings(
    topic: string,
    searchResults: string[],
  ): Promise<{ summary: string; sources: string[]; dataPoints: string[] }> {
    if (searchResults.length === 0) {
      return {
        summary: 'No external data found.',
        sources: [],
        dataPoints: [],
      };
    }

    const combinedResults = searchResults.join('\n\n');

    const prompt = `Analyze these search results for the topic "${topic}":

${combinedResults.substring(0, 6000)}

Provide:
1. A comprehensive summary suitable for a presentation context.
2. A list of key data points/statistics found.
3. A list of sources.

Return JSON:
{
  "summary": "string",
  "dataPoints": ["string"],
  "sources": ["string"]
}`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        summary: parsed.summary || 'Analysis of search results.',
        dataPoints: parsed.dataPoints || [],
        sources: parsed.sources || [],
      };
    } catch {
      return {
        summary: 'Error analyzing search results.',
        sources: [],
        dataPoints: [],
      };
    }
  }
}
