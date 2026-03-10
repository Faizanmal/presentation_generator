import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PluginManifest,
  PluginHook,
  CustomBlockDefinition,
  CustomThemeDefinition,
  CustomActionDefinition,
} from './plugin-system.service';

// plugin hook handler accepts any context and may return any value (async or sync)
// returning a Promise is allowed because Promise<unknown> extends unknown
// the union with unknown was redundant so we simplify it.
// returning a Promise is allowed becausextends unknown
// the union with unknown was redundant so we simplify it.
type HookHandler = (context: unknown) => unknown;

interface RegisteredPlugin {
  id: string;
  pluginId: string;
  manifest: PluginManifest;
  hooks: Map<PluginHook, HookHandler[]>;
  blocks: CustomBlockDefinition[];
  themes: CustomThemeDefinition[];
  actions: CustomActionDefinition[];
}

/**
 * Plugin Registry Service
 * Manages active plugins, their hooks, and custom components
 */
@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly plugins = new Map<string, RegisteredPlugin>();
  private readonly hookSubscriptions = new Map<
    PluginHook,
    Array<{ pluginId: string; handler: HookHandler }>
  >();
  private readonly customBlocks = new Map<
    string,
    { pluginId: string; definition: CustomBlockDefinition }
  >();
  private readonly customThemes = new Map<
    string,
    { pluginId: string; definition: CustomThemeDefinition }
  >();
  private readonly customActions = new Map<
    string,
    { pluginId: string; definition: CustomActionDefinition }
  >();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a plugin and its components
   */
  registerPlugin(pluginId: string, manifest: PluginManifest): void {
    if (this.plugins.has(pluginId)) {
      this.logger.warn(`Plugin ${pluginId} is already registered`);
      return;
    }

    const plugin: RegisteredPlugin = {
      id: pluginId,
      pluginId: manifest.id,
      manifest,
      hooks: new Map(),
      blocks: manifest.blocks || [],
      themes: manifest.themes || [],
      actions: manifest.actions || [],
    };

    // Register custom blocks
    if (manifest.blocks) {
      for (const block of manifest.blocks) {
        const blockId = `${pluginId}:${block.type}`;
        this.customBlocks.set(blockId, { pluginId, definition: block });
        this.logger.log(`Registered custom block: ${blockId}`);
      }
    }

    // Register custom themes
    if (manifest.themes) {
      for (const theme of manifest.themes) {
        const themeId = `${pluginId}:${theme.id}`;
        this.customThemes.set(themeId, { pluginId, definition: theme });
        this.logger.log(`Registered custom theme: ${themeId}`);
      }
    }

    // Register custom actions
    if (manifest.actions) {
      for (const action of manifest.actions) {
        const actionId = `${pluginId}:${action.id}`;
        this.customActions.set(actionId, { pluginId, definition: action });
        this.logger.log(`Registered custom action: ${actionId}`);
      }
    }

    this.plugins.set(pluginId, plugin);
    this.logger.log(`Plugin registered: ${pluginId}`);
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    // Remove custom blocks
    for (const block of plugin.blocks) {
      this.customBlocks.delete(`${pluginId}:${block.type}`);
    }

    // Remove custom themes
    for (const theme of plugin.themes) {
      this.customThemes.delete(`${pluginId}:${theme.id}`);
    }

    // Remove custom actions
    for (const action of plugin.actions) {
      this.customActions.delete(`${pluginId}:${action.id}`);
    }

    // Remove hook subscriptions
    for (const [hook, subscribers] of this.hookSubscriptions) {
      this.hookSubscriptions.set(
        hook,
        subscribers.filter((s) => s.pluginId !== pluginId),
      );
    }

    this.plugins.delete(pluginId);
    this.logger.log(`Plugin unregistered: ${pluginId}`);
  }

  /**
   * Subscribe to a hook
   */
  subscribeToHook(
    pluginId: string,
    hook: PluginHook,
    handler: HookHandler,
  ): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.manifest.hooks.includes(hook)) {
      throw new Error(
        `Plugin ${pluginId} does not have permission for hook ${hook}`,
      );
    }

    if (!this.hookSubscriptions.has(hook)) {
      this.hookSubscriptions.set(hook, []);
    }

    this.hookSubscriptions.get(hook)!.push({ pluginId, handler });
    this.logger.log(`Plugin ${pluginId} subscribed to hook ${hook}`);
  }

  /**
   * Trigger a hook
   */
  async triggerHook<T>(
    hook: PluginHook,
    context: {
      userId: string;
      projectId?: string;
      slideId?: string;
      blockId?: string;
      data?: unknown;
    },
  ): Promise<T[]> {
    const subscribers = this.hookSubscriptions.get(hook) || [];
    const results: T[] = [];

    for (const { pluginId, handler } of subscribers) {
      try {
        // Check if plugin is enabled for user
        const isEnabled = await this.isPluginEnabledForUser(
          pluginId,
          context.userId,
        );
        if (!isEnabled) continue;

        const result = await handler(context);
        if (result !== undefined) {
          results.push(result as T);
        }
      } catch (error) {
        this.logger.error(`Error in plugin ${pluginId} hook ${hook}:`, error);
      }
    }

    return results;
  }

  /**
   * Get all registered custom blocks
   */
  getCustomBlocks(): Array<{ id: string; definition: CustomBlockDefinition }> {
    return Array.from(this.customBlocks.entries()).map(
      ([id, { definition }]) => ({
        id,
        definition,
      }),
    );
  }

  /**
   * Get all registered custom themes
   */
  getCustomThemes(): Array<{ id: string; definition: CustomThemeDefinition }> {
    return Array.from(this.customThemes.entries()).map(
      ([id, { definition }]) => ({
        id,
        definition,
      }),
    );
  }

  /**
   * Get all registered custom actions
   */
  getCustomActions(): Array<{
    id: string;
    definition: CustomActionDefinition;
  }> {
    return Array.from(this.customActions.entries()).map(
      ([id, { definition }]) => ({
        id,
        definition,
      }),
    );
  }

  /**
   * Get custom blocks available for a user
   */
  async getCustomBlocksForUser(
    userId: string,
  ): Promise<CustomBlockDefinition[]> {
    const enabledPlugins = await this.getEnabledPluginsForUser(userId);
    const blocks: CustomBlockDefinition[] = [];

    for (const pluginId of enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin?.blocks) {
        blocks.push(...plugin.blocks);
      }
    }

    return blocks;
  }

  /**
   * Get custom themes available for a user
   */
  async getCustomThemesForUser(
    userId: string,
  ): Promise<CustomThemeDefinition[]> {
    const enabledPlugins = await this.getEnabledPluginsForUser(userId);
    const themes: CustomThemeDefinition[] = [];

    for (const pluginId of enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin?.themes) {
        themes.push(...plugin.themes);
      }
    }

    return themes;
  }

  /**
   * Get registered plugins info
   */
  getRegisteredPlugins(): Array<{ id: string; name: string; version: string }> {
    return Array.from(this.plugins.values()).map((p) => ({
      id: p.pluginId,
      name: p.manifest.name,
      version: p.manifest.version,
    }));
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async isPluginEnabledForUser(
    pluginId: string,
    userId: string,
  ): Promise<boolean> {
    const installation = await this.prisma.pluginInstallation.findFirst({
      where: {
        plugin: { pluginId },
        userId,
        isEnabled: true,
      },
    });

    return !!installation;
  }

  private async getEnabledPluginsForUser(userId: string): Promise<string[]> {
    const installations = await this.prisma.pluginInstallation.findMany({
      where: { userId, isEnabled: true },
      include: { plugin: { select: { pluginId: true } } },
    });

    return installations
      .filter((i) => i.plugin !== null)
      .map((i) => i.plugin!.pluginId)
      .filter((id): id is string => id !== null);
  }
}
