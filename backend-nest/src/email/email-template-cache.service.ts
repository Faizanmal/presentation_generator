import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface CompiledTemplate {
  name: string;
  template: Handlebars.TemplateDelegate;
  compiledAt: Date;
}

/**
 * Email Template Cache Service
 * Pre-compiles Handlebars templates at startup for faster email rendering.
 * Templates are cached in memory and can be used directly without re-parsing.
 */
@Injectable()
export class EmailTemplateCacheService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateCacheService.name);
  private readonly compiledTemplates = new Map<string, CompiledTemplate>();
  private readonly templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, 'templates');
  }

  async onModuleInit() {
    await this.precompileTemplates();
  }

  /**
   * Pre-compile all templates at startup
   */
  private async precompileTemplates(): Promise<void> {
    const templateNames = [
      'otp',
      'welcome',
      'password-reset',
      'email-verification',
      'notification',
      'project-shared',
      'team-invite',
    ];

    this.logger.log(`Pre-compiling ${templateNames.length} email templates...`);

    for (const name of templateNames) {
      try {
        await this.compileTemplate(name);
        this.logger.debug(`✓ Template compiled: ${name}`);
      } catch (error) {
        this.logger.error(`✗ Failed to compile template: ${name}`, error.stack);
      }
    }

    this.logger.log(
      `Email template cache initialized with ${this.compiledTemplates.size} templates`,
    );
  }

  /**
   * Compile a single template
   */
  private async compileTemplate(name: string): Promise<void> {
    const templatePath = path.join(this.templatesDir, `${name}.hbs`);

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      this.logger.warn(`Template file not found: ${templatePath}`);
      return;
    }

    const templateSource = await fs.promises.readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateSource);

    this.compiledTemplates.set(name, {
      name,
      template: compiled,
      compiledAt: new Date(),
    });
  }

  /**
   * Get a compiled template by name
   */
  getTemplate(name: string): Handlebars.TemplateDelegate | null {
    const cached = this.compiledTemplates.get(name);
    return cached?.template || null;
  }

  /**
   * Render a template with context
   */
  render(name: string, context: Record<string, unknown>): string | null {
    const template = this.getTemplate(name);
    if (!template) {
      this.logger.warn(`Template not found in cache: ${name}`);
      return null;
    }
    return template(context);
  }

  /**
   * Check if a template is cached
   */
  hasTemplate(name: string): boolean {
    return this.compiledTemplates.has(name);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    count: number;
    templates: string[];
    compiledAt: Record<string, Date>;
  } {
    const templates = Array.from(this.compiledTemplates.keys());
    const compiledAt: Record<string, Date> = {};

    for (const [name, entry] of this.compiledTemplates) {
      compiledAt[name] = entry.compiledAt;
    }

    return {
      count: this.compiledTemplates.size,
      templates,
      compiledAt,
    };
  }

  /**
   * Reload a specific template (for hot-reloading in development)
   */
  async reloadTemplate(name: string): Promise<boolean> {
    try {
      await this.compileTemplate(name);
      this.logger.log(`Template reloaded: ${name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to reload template: ${name}`, error.stack);
      return false;
    }
  }

  /**
   * Reload all templates
   */
  async reloadAll(): Promise<void> {
    this.compiledTemplates.clear();
    await this.precompileTemplates();
  }
}
