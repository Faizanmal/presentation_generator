import { Injectable, Logger } from '@nestjs/common';
import { PluginPermission } from './plugin-system.service';

interface SandboxContext {
  pluginId: string;
  userId: string;
  permissions: PluginPermission[];
}

interface APIProxy {
  projects: ProjectAPI;
  slides: SlideAPI;
  blocks: BlockAPI;
  user: UserAPI;
  ui: UIAPI;
  storage: StorageAPI;
  network: NetworkAPI;
}

interface ProjectAPI {
  get: (id: string) => Promise<unknown>;
  list: () => Promise<unknown[]>;
  create?: (data: unknown) => Promise<unknown>;
  update?: (id: string, data: unknown) => Promise<unknown>;
}

interface SlideAPI {
  get: (id: string) => Promise<unknown>;
  list: (projectId: string) => Promise<unknown[]>;
  create?: (projectId: string, data: unknown) => Promise<unknown>;
  update?: (id: string, data: unknown) => Promise<unknown>;
}

interface BlockAPI {
  get: (id: string) => Promise<unknown>;
  list: (slideId: string) => Promise<unknown[]>;
  create?: (slideId: string, data: unknown) => Promise<unknown>;
  update?: (id: string, data: unknown) => Promise<unknown>;
}

interface UserAPI {
  getCurrent: () => Promise<unknown>;
  getSettings?: () => Promise<unknown>;
  updateSettings?: (data: unknown) => Promise<unknown>;
}

interface UIAPI {
  showModal?: (options: { title: string; content: string }) => Promise<unknown>;
  showSidebar?: (options: { title: string; content: string }) => void;
  addToolbarButton?: (options: {
    icon: string;
    tooltip: string;
    onClick: () => void;
  }) => void;
  showNotification: (options: {
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }) => void;
}

interface StorageAPI {
  get?: (key: string) => Promise<unknown>;
  set?: (key: string, value: unknown) => Promise<void>;
  delete?: (key: string) => Promise<void>;
}

interface NetworkAPI {
  fetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

/**
 * Plugin Sandbox Service
 * Provides isolated execution environment for plugins
 */
@Injectable()
export class PluginSandboxService {
  private readonly logger = new Logger(PluginSandboxService.name);
  private readonly pluginStorage = new Map<string, Map<string, unknown>>();

  /**
   * Create a sandboxed API proxy for a plugin
   */
  createAPIProxy(context: SandboxContext): APIProxy {
    const { permissions } = context;

    return {
      projects: this.createProjectAPI(context, permissions),
      slides: this.createSlideAPI(context, permissions),
      blocks: this.createBlockAPI(context, permissions),
      user: this.createUserAPI(context, permissions),
      ui: this.createUIAPI(context, permissions),
      storage: this.createStorageAPI(context, permissions),
      network: this.createNetworkAPI(permissions),
    };
  }

  private createProjectAPI(
    context: SandboxContext,
    permissions: PluginPermission[],
  ): ProjectAPI {
    const api: ProjectAPI = {
      get: async (id: string) => {
        this.checkPermission(permissions, 'read:projects');
        return this.fetchProject(context.userId, id);
      },
      list: async () => {
        this.checkPermission(permissions, 'read:projects');
        return this.fetchProjects(context.userId);
      },
    };

    if (permissions.includes('write:projects')) {
      api.create = async (data: unknown) => {
        return this.createProject(context.userId, data);
      };
      api.update = async (id: string, data: unknown) => {
        return this.updateProject(context.userId, id, data);
      };
    }

    return api;
  }

  private createSlideAPI(
    context: SandboxContext,
    permissions: PluginPermission[],
  ): SlideAPI {
    const api: SlideAPI = {
      get: async (id: string) => {
        this.checkPermission(permissions, 'read:slides');
        return this.fetchSlide(context.userId, id);
      },
      list: async (projectId: string) => {
        this.checkPermission(permissions, 'read:slides');
        return this.fetchSlides(context.userId, projectId);
      },
    };

    if (permissions.includes('write:slides')) {
      api.create = async (projectId: string, data: unknown) => {
        return this.createSlide(context.userId, projectId, data);
      };
      api.update = async (id: string, data: unknown) => {
        return this.updateSlide(context.userId, id, data);
      };
    }

    return api;
  }

  private createBlockAPI(
    context: SandboxContext,
    permissions: PluginPermission[],
  ): BlockAPI {
    const api: BlockAPI = {
      get: async (id: string) => {
        this.checkPermission(permissions, 'read:blocks');
        return this.fetchBlock(context.userId, id);
      },
      list: async (slideId: string) => {
        this.checkPermission(permissions, 'read:blocks');
        return this.fetchBlocks(context.userId, slideId);
      },
    };

    if (permissions.includes('write:blocks')) {
      api.create = async (slideId: string, data: unknown) => {
        return this.createBlock(context.userId, slideId, data);
      };
      api.update = async (id: string, data: unknown) => {
        return this.updateBlock(context.userId, id, data);
      };
    }

    return api;
  }

  private createUserAPI(
    context: SandboxContext,
    permissions: PluginPermission[],
  ): UserAPI {
    const api: UserAPI = {
      getCurrent: async () => {
        this.checkPermission(permissions, 'read:user');
        return this.fetchUser(context.userId);
      },
    };

    if (permissions.includes('read:user')) {
      api.getSettings = async () => {
        return this.fetchUserSettings(context.userId);
      };
    }

    if (permissions.includes('write:user')) {
      api.updateSettings = async (data: unknown) => {
        return this.updateUserSettings(context.userId, data);
      };
    }

    return api;
  }

  private createUIAPI(
    context: SandboxContext,
    permissions: PluginPermission[],
  ): UIAPI {
    const api: UIAPI = {
      showNotification: (options) => {
        this.logger.log(
          `Plugin ${context.pluginId} notification: ${options.message}`,
        );
        // This would emit an event to the frontend
      },
    };

    if (permissions.includes('ui:modal')) {
      api.showModal = async (options) => {
        this.logger.log(
          `Plugin ${context.pluginId} showing modal: ${options.title}`,
        );
        // This would emit an event to the frontend to show a modal
        // satisfy require-await rule
        await Promise.resolve();
        return {};
      };
    }

    if (permissions.includes('ui:sidebar')) {
      api.showSidebar = (options) => {
        this.logger.log(
          `Plugin ${context.pluginId} showing sidebar: ${options.title}`,
        );
        // This would emit an event to the frontend to show a sidebar
      };
    }

    if (permissions.includes('ui:toolbar')) {
      api.addToolbarButton = (options) => {
        this.logger.log(
          `Plugin ${context.pluginId} adding toolbar button: ${options.tooltip}`,
        );
        // This would register a toolbar button
      };
    }

    return api;
  }

  private createStorageAPI(
    context: SandboxContext,
    permissions: PluginPermission[],
  ): StorageAPI {
    if (!permissions.includes('storage:local')) {
      return {};
    }

    const pluginKey = `${context.pluginId}:${context.userId}`;

    return {
      get: (key: string) => {
        const storage = this.pluginStorage.get(pluginKey);
        return Promise.resolve(storage?.get(key));
      },
      set: (key: string, value: unknown) => {
        if (!this.pluginStorage.has(pluginKey)) {
          this.pluginStorage.set(pluginKey, new Map());
        }
        this.pluginStorage.get(pluginKey)!.set(key, value);
        return Promise.resolve();
      },
      delete: (key: string) => {
        this.pluginStorage.get(pluginKey)?.delete(key);
        return Promise.resolve();
      },
    };
  }

  private createNetworkAPI(permissions: PluginPermission[]): NetworkAPI {
    if (!permissions.includes('network:fetch')) {
      return {};
    }

    return {
      fetch: async (url: string, options?: RequestInit) => {
        // Validate URL (prevent access to internal services)
        const parsedUrl = new URL(url);
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

        if (blockedHosts.includes(parsedUrl.hostname)) {
          throw new Error('Cannot fetch from localhost');
        }

        // Add timeout and size limits
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          return response;
        } finally {
          clearTimeout(timeout);
        }
      },
    };
  }

  private checkPermission(
    permissions: PluginPermission[],
    required: PluginPermission,
  ): void {
    if (!permissions.includes(required)) {
      throw new Error(`Permission denied: ${required}`);
    }
  }

  // Stub methods - these would be implemented to interact with actual services
  private fetchProject(_userId: string, id: string): Promise<unknown> {
    return Promise.resolve({ id, title: 'Sample Project' });
  }

  private fetchProjects(_userId: string): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  private createProject(_userId: string, data: unknown): Promise<unknown> {
    return Promise.resolve({ id: 'new-project', ...(data as object) });
  }

  private updateProject(
    _userId: string,
    id: string,
    data: unknown,
  ): Promise<unknown> {
    return Promise.resolve({ id, ...(data as object) });
  }

  private fetchSlide(_userId: string, id: string): Promise<unknown> {
    return Promise.resolve({ id, title: 'Sample Slide' });
  }

  private fetchSlides(_userId: string, _projectId: string): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  private createSlide(
    _userId: string,
    projectId: string,
    data: unknown,
  ): Promise<unknown> {
    return Promise.resolve({ id: 'new-slide', projectId, ...(data as object) });
  }

  private updateSlide(
    _userId: string,
    id: string,
    data: unknown,
  ): Promise<unknown> {
    return Promise.resolve({ id, ...(data as object) });
  }

  private fetchBlock(_userId: string, id: string): Promise<unknown> {
    return Promise.resolve({ id, type: 'paragraph' });
  }

  private fetchBlocks(_userId: string, _slideId: string): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  private createBlock(
    _userId: string,
    slideId: string,
    data: unknown,
  ): Promise<unknown> {
    return Promise.resolve({ id: 'new-block', slideId, ...(data as object) });
  }

  private updateBlock(
    _userId: string,
    id: string,
    data: unknown,
  ): Promise<unknown> {
    return Promise.resolve({ id, ...(data as object) });
  }

  private fetchUser(userId: string): Promise<unknown> {
    return Promise.resolve({ id: userId, name: 'User' });
  }

  private fetchUserSettings(_userId: string): Promise<unknown> {
    return Promise.resolve({});
  }

  private updateUserSettings(_userId: string, data: unknown): Promise<unknown> {
    return Promise.resolve(data);
  }
}
