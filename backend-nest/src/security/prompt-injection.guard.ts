/**
 * AI Prompt Injection Guard
 *
 * Detects and neutralizes prompt injection attacks in user-provided
 * content before it reaches AI agents. Works as both a NestJS guard
 * and a standalone utility.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

// ============================================
// INJECTION PATTERNS
// ============================================

const INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium';
  name: string;
}> = [
  // Direct instruction override attempts
  {
    pattern:
      /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|rules?|directions?)/i,
    severity: 'critical',
    name: 'instruction_override',
  },
  {
    pattern:
      /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|context)/i,
    severity: 'critical',
    name: 'disregard_instructions',
  },
  {
    pattern: /forget\s+(everything|all|your)\s+(you|instructions?|rules?)/i,
    severity: 'critical',
    name: 'forget_instructions',
  },

  // Role-play / identity attacks
  {
    pattern: /you\s+are\s+now\s+(a|an|the)\s+/i,
    severity: 'high',
    name: 'role_reassignment',
  },
  {
    pattern: /pretend\s+(to\s+be|you\s+are|that\s+you)/i,
    severity: 'high',
    name: 'role_pretend',
  },
  {
    pattern: /act\s+as\s+(a|an|the|if)\s+/i,
    severity: 'medium',
    name: 'act_as',
  },

  // System prompt extraction
  {
    pattern: /what\s+(is|are)\s+your\s+(system\s+)?prompt/i,
    severity: 'critical',
    name: 'prompt_extraction',
  },
  {
    pattern: /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
    severity: 'critical',
    name: 'reveal_prompt',
  },
  {
    pattern:
      /show\s+(me\s+)?(your|the)\s+(original|system|initial)\s+(prompt|instructions?)/i,
    severity: 'critical',
    name: 'show_prompt',
  },
  {
    pattern:
      /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?)\s*(back|verbatim)?/i,
    severity: 'critical',
    name: 'repeat_prompt',
  },

  // Data exfiltration
  {
    pattern:
      /output\s+(all|every|the\s+entire)\s+(conversation|context|data|text)/i,
    severity: 'high',
    name: 'data_exfiltration',
  },
  {
    pattern: /print\s+(all|the)\s+(internal|system|hidden)/i,
    severity: 'high',
    name: 'print_internal',
  },

  // Command injection (markdown/code escape)
  {
    pattern: /```\s*(system|admin|root|sudo|shell|bash|cmd|exec)/i,
    severity: 'high',
    name: 'code_injection',
  },

  // Token manipulation
  {
    pattern: /<\|?(system|endoftext|im_start|im_end)\|?>/i,
    severity: 'critical',
    name: 'token_manipulation',
  },
  {
    pattern: /\[INST\]|\[\/INST\]|<<SYS>>|<<\/SYS>>/i,
    severity: 'critical',
    name: 'llama_tokens',
  },

  // Jailbreak patterns
  {
    pattern: /DAN\s*(mode|prompt|jailbreak)/i,
    severity: 'critical',
    name: 'dan_jailbreak',
  },
  {
    pattern: /developer\s+mode\s+(enabled|activated|on)/i,
    severity: 'critical',
    name: 'dev_mode',
  },
  {
    pattern:
      /bypass\s+(your|the|all)\s+(safety|content|ethical)\s+(filters?|guidelines?|restrictions?)/i,
    severity: 'critical',
    name: 'bypass_safety',
  },
];

// ============================================
// SANITIZATION
// ============================================

/**
 * Sanitize user input by removing/neutralizing injection attempts.
 * Returns the cleaned text and a list of detected threats.
 */
export function sanitizePromptInput(input: string): {
  sanitized: string;
  threats: Array<{ name: string; severity: string; matched: string }>;
  isSafe: boolean;
} {
  const threats: Array<{ name: string; severity: string; matched: string }> =
    [];
  let sanitized = input;

  for (const { pattern, severity, name } of INJECTION_PATTERNS) {
    const match = sanitized.match(pattern);
    if (match) {
      threats.push({ name, severity, matched: match[0] });

      if (severity === 'critical') {
        // Remove the entire matched segment for critical threats
        sanitized = sanitized.replace(pattern, '[FILTERED]');
      } else if (severity === 'high') {
        // Neutralize by adding context markers
        sanitized = sanitized.replace(pattern, '[user-text: $&]');
      }
      // Medium severity: leave in place but flag
    }
  }

  // Remove special tokens that could confuse LLMs
  sanitized = sanitized.replace(/<\|[^|]*\|>/g, '');
  sanitized = sanitized.replace(/\[INST\]|\[\/INST\]/g, '');
  sanitized = sanitized.replace(/<<SYS>>|<<\/SYS>>/g, '');

  const hasCritical = threats.some((t) => t.severity === 'critical');

  return {
    sanitized,
    threats,
    isSafe: !hasCritical,
  };
}

/**
 * Validate that content length is within acceptable bounds.
 */
export function validateContentLength(
  input: string,
  maxChars: number = 10000,
): boolean {
  return input.length <= maxChars;
}

/**
 * Sanitize HTML content to prevent XSS in AI outputs.
 */
export function sanitizeHtmlOutput(html: string): string {
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '');
}

// ============================================
// NESTJS GUARD
// ============================================

@Injectable()
export class PromptInjectionGuard implements CanActivate {
  private readonly logger = new Logger(PromptInjectionGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as Record<string, unknown>;

    if (!body) return true;

    // Fields to check for injection
    const fieldsToCheck = [
      'topic',
      'prompt',
      'content',
      'message',
      'additionalContext',
      'text',
      'query',
    ];

    for (const field of fieldsToCheck) {
      const value = body[field];
      if (typeof value !== 'string') continue;

      // Check content length
      if (!validateContentLength(value, 50000)) {
        this.logger.warn(
          `Content too long in field "${field}": ${value.length} chars`,
        );
        throw new BadRequestException(
          `Field "${field}" exceeds maximum length`,
        );
      }

      const result = sanitizePromptInput(value);

      if (!result.isSafe) {
        this.logger.warn(
          `🛡️ Prompt injection BLOCKED in field "${field}": ${result.threats.map((t) => t.name).join(', ')}`,
        );
        throw new BadRequestException(
          'Your input contains content that cannot be processed. Please rephrase.',
        );
      }

      if (result.threats.length > 0) {
        this.logger.log(
          `⚠️ Prompt injection detected (non-critical) in "${field}": ${result.threats.map((t) => t.name).join(', ')}`,
        );
        // Sanitize the field in-place for non-critical threats
        (body as Record<string, string>)[field] = result.sanitized;
      }
    }

    return true;
  }
}

// ============================================
// AI OUTPUT SANITIZER
// ============================================

/**
 * Sanitize AI-generated content before sending to the frontend.
 * Removes potential XSS vectors from HTML/markdown output.
 */
@Injectable()
export class AIOutputSanitizerService {
  /**
   * Clean AI-generated slide content before storage/rendering.
   */
  sanitizeSlideContent(
    content: Record<string, unknown>,
  ): Record<string, unknown> {
    const cleaned = { ...content };

    if (typeof cleaned.text === 'string') {
      cleaned.text = sanitizeHtmlOutput(cleaned.text);
    }

    if (typeof cleaned.html === 'string') {
      cleaned.html = sanitizeHtmlOutput(cleaned.html);
    }

    if (Array.isArray(cleaned.items)) {
      cleaned.items = (cleaned.items as unknown[]).map((item) =>
        typeof item === 'string' ? sanitizeHtmlOutput(item) : item,
      );
    }

    return cleaned;
  }

  /**
   * Validate image URLs returned by AI to prevent SSRF.
   */
  validateImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Block private/internal URLs
      const blockedHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254',
      ];
      if (blockedHosts.includes(parsed.hostname)) return false;
      if (
        parsed.hostname.endsWith('.internal') ||
        parsed.hostname.endsWith('.local')
      )
        return false;
      // Only allow HTTPS
      if (parsed.protocol !== 'https:') return false;
      return true;
    } catch {
      return false;
    }
  }
}
