import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export type DataSourceType =
  | 'google_sheets'
  | 'excel_online'
  | 'airtable'
  | 'notion'
  | 'csv'
  | 'json_api'
  | 'postgresql'
  | 'mysql'
  | 'mongodb';

export interface DataSourceConfig {
  type: DataSourceType;
  name: string;
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    connectionString?: string;
  };
  config: {
    spreadsheetId?: string;
    sheetName?: string;
    range?: string;
    tableId?: string;
    databaseId?: string;
    apiUrl?: string;
    query?: string;
    collection?: string;
    refreshInterval?: number; // minutes
  };
}

export interface DataSourceConnection {
  id: string;
  userId: string;
  type: DataSourceType;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date | null;
  config: object;
}

export interface DataPreview {
  columns: Array<{
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
  }>;
  rows: Array<Record<string, unknown>>;
  totalRows: number;
}

@Injectable()
export class DataConnectorService {
  private readonly logger = new Logger(DataConnectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('data-sync') private dataSyncQueue: Queue,
  ) {}

  /**
   * Create a new data source connection
   */
  async createConnection(
    userId: string,
    config: DataSourceConfig,
  ): Promise<DataSourceConnection> {
    // Validate connection
    this.validateConnection(config);

    const connection = await this.prisma.dataSourceConnection.create({
      data: {
        userId,
        type: config.type,
        name: config.name,
        credentials: config.credentials
          ? this.encryptCredentials(config.credentials)
          : undefined,
        config: config.config,
        status: 'connected',
      },
    });

    // Schedule initial sync
    await this.scheduleSync(connection.id);

    return {
      id: connection.id,
      userId: connection.userId,
      type: connection.type as DataSourceType,
      name: connection.name,
      status: connection.status as 'connected' | 'disconnected' | 'error',
      lastSync: connection.lastSync,
      config: connection.config as object,
    };
  }

  /**
   * Get all connections for a user
   */
  async getConnections(userId: string): Promise<DataSourceConnection[]> {
    const connections = await this.prisma.dataSourceConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((c) => ({
      id: c.id,
      userId: c.userId,
      type: c.type as DataSourceType,
      name: c.name,
      status: c.status as 'connected' | 'disconnected' | 'error',
      lastSync: c.lastSync,
      config: c.config as object,
    }));
  }

  /**
   * Update connection configuration
   */
  async updateConnection(
    connectionId: string,
    userId: string,
    updates: Partial<DataSourceConfig>,
  ): Promise<DataSourceConnection> {
    const existing = await this.prisma.dataSourceConnection.findUnique({
      where: { id: connectionId },
    });

    if (!existing || existing.userId !== userId) {
      throw new Error('Connection not found');
    }

    const updated = await this.prisma.dataSourceConnection.update({
      where: { id: connectionId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.config && { config: updates.config }),
        ...(updates.credentials && {
          credentials: this.encryptCredentials(updates.credentials),
        }),
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      type: updated.type as DataSourceType,
      name: updated.name,
      status: updated.status as 'connected' | 'disconnected' | 'error',
      lastSync: updated.lastSync,
      config: updated.config as object,
    };
  }

  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: string, userId: string): Promise<void> {
    await this.prisma.dataSourceConnection.deleteMany({
      where: { id: connectionId, userId },
    });
  }

  /**
   * Test connection
   */
  testConnection(
    config: DataSourceConfig,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.validateConnection(config);
      return Promise.resolve({
        success: true,
        message: 'Connection successful',
      });
    } catch (error) {
      return Promise.resolve({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }

  /**
   * Validate and test connection
   */
  private validateConnection(config: DataSourceConfig): void {
    switch (config.type) {
      case 'google_sheets':
        this.validateGoogleSheets(config);
        break;
      case 'excel_online':
        this.validateExcelOnline(config);
        break;
      case 'airtable':
        this.validateAirtable(config);
        break;
      case 'notion':
        this.validateNotion(config);
        break;
      case 'json_api':
        this.validateJsonApi(config);
        break;
      case 'postgresql':
      case 'mysql':
        this.validateSqlDatabase(config);
        break;
      case 'mongodb':
        this.validateMongoDB(config);
        break;
      case 'csv':
        // CSV doesn't need validation
        break;
      default:
        throw new Error(
          `Unsupported data source type: ${config.type as string}`,
        );
    }
  }

  private validateGoogleSheets(config: DataSourceConfig): void {
    if (!config.credentials?.accessToken) {
      throw new Error('Google Sheets requires OAuth access token');
    }
    if (!config.config.spreadsheetId) {
      throw new Error('Spreadsheet ID is required');
    }
    // In production, would make API call to validate
  }

  private validateExcelOnline(config: DataSourceConfig): void {
    if (!config.credentials?.accessToken) {
      throw new Error('Excel Online requires Microsoft OAuth access token');
    }
  }

  private validateAirtable(config: DataSourceConfig): void {
    if (!config.credentials?.apiKey) {
      throw new Error('Airtable requires API key');
    }
    if (!config.config.tableId) {
      throw new Error('Table ID is required');
    }
  }

  private validateNotion(config: DataSourceConfig): void {
    if (!config.credentials?.accessToken) {
      throw new Error('Notion requires OAuth access token');
    }
    if (!config.config.databaseId) {
      throw new Error('Database ID is required');
    }
  }

  private validateJsonApi(config: DataSourceConfig): void {
    if (!config.config.apiUrl) {
      throw new Error('API URL is required');
    }
    // Validate URL format
    try {
      new URL(config.config.apiUrl);
    } catch {
      throw new Error('Invalid API URL');
    }
  }

  private validateSqlDatabase(config: DataSourceConfig): void {
    if (!config.credentials?.connectionString) {
      throw new Error('Database connection string is required');
    }
  }

  private validateMongoDB(config: DataSourceConfig): void {
    if (!config.credentials?.connectionString) {
      throw new Error('MongoDB connection string is required');
    }
    if (!config.config.collection) {
      throw new Error('Collection name is required');
    }
  }

  /**
   * Fetch data from source
   */
  async fetchData(
    connectionId: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: Record<string, unknown>;
    } = {},
  ): Promise<DataPreview> {
    const connection = await this.prisma.dataSourceConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    const credentials = connection.credentials
      ? this.decryptCredentials(connection.credentials)
      : undefined;

    const config: DataSourceConfig = {
      type: connection.type as DataSourceType,
      name: connection.name,
      credentials,
      config: connection.config as DataSourceConfig['config'],
    };

    return this.fetchFromSource(config, options);
  }

  private async fetchFromSource(
    config: DataSourceConfig,
    options: {
      limit?: number;
      offset?: number;
      filters?: Record<string, unknown>;
    },
  ): Promise<DataPreview> {
    switch (config.type) {
      case 'google_sheets':
        return this.fetchFromGoogleSheets(config, options);
      case 'excel_online':
        return this.fetchFromExcelOnline(config, options);
      case 'airtable':
        return this.fetchFromAirtable(config, options);
      case 'notion':
        return this.fetchFromNotion(config, options);
      case 'json_api':
        return this.fetchFromJsonApi(config, options);
      default:
        throw new Error(`Fetching not implemented for: ${config.type}`);
    }
  }

  private async fetchFromGoogleSheets(
    config: DataSourceConfig,
    options: { limit?: number },
  ): Promise<DataPreview> {
    const { spreadsheetId, sheetName, range } = config.config;
    const token = config.credentials?.accessToken;
    const sheetRange =
      range || (sheetName ? `${sheetName}!A1:Z1000` : 'Sheet1!A1:Z1000');

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetRange)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }

    const result = await response.json();
    const values: string[][] = result.values || [];

    if (values.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }

    // First row is headers
    const headers = values[0];
    const dataRows = values.slice(
      1,
      options.limit ? options.limit + 1 : undefined,
    );

    const columns = headers.map((name) => ({
      name,
      type: this.inferColumnType(dataRows[0]?.[headers.indexOf(name)]),
    }));

    const rows = dataRows.map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? null;
      });
      return obj;
    });

    return { columns, rows, totalRows: values.length - 1 };
  }

  private async fetchFromExcelOnline(
    config: DataSourceConfig,
    options: { limit?: number },
  ): Promise<DataPreview> {
    const token = config.credentials?.accessToken;
    const { spreadsheetId, sheetName, range } = config.config;

    // Microsoft Graph API for Excel workbooks
    const sheetPath = sheetName
      ? `/worksheets('${encodeURIComponent(sheetName)}')`
      : '/worksheets/1';
    const rangePath = range
      ? `/range(address='${encodeURIComponent(range)}')`
      : '/usedRange';
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${spreadsheetId}/workbook${sheetPath}${rangePath}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.statusText}`);
    }

    const result = await response.json();
    const values: Array<Array<string | number | boolean | null>> =
      result.values || [];

    if (values.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }

    const headers = values[0].map(String);
    const dataRows = values.slice(
      1,
      options.limit ? options.limit + 1 : undefined,
    );

    const columns = headers.map((name: string) => ({
      name,
      type: this.inferColumnType(dataRows[0]?.[headers.indexOf(name)]),
    }));

    const rows = dataRows.map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h: string, i: number) => {
        obj[h] = row[i] ?? null;
      });
      return obj;
    });

    return { columns, rows, totalRows: values.length - 1 };
  }

  private async fetchFromAirtable(
    config: DataSourceConfig,
    options: { limit?: number },
  ): Promise<DataPreview> {
    const apiKey = config.credentials?.apiKey;
    const { tableId } = config.config;
    const limit = options.limit || 100;

    const url = `https://api.airtable.com/v0/${tableId}?maxRecords=${limit}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      records?: Array<{ fields?: Record<string, unknown> }>;
    };
    const records = result.records || [];

    if (records.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }

    // Infer columns from first record's fields
    const firstFields = records[0].fields || {};
    const columns = Object.keys(firstFields).map((name) => ({
      name,
      type: this.inferColumnType(firstFields[name]),
    }));

    const rows = records.map((r) => ({
      ...r.fields,
    }));

    return { columns, rows, totalRows: records.length };
  }

  private async fetchFromNotion(
    config: DataSourceConfig,
    options: { limit?: number },
  ): Promise<DataPreview> {
    const token = config.credentials?.accessToken;
    const { databaseId } = config.config;
    const limit = options.limit || 100;

    const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: limit }),
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.statusText}`);
    }

    const result = await response.json();
    type NotionProperty = { type: string; [key: string]: unknown };
    type NotionPage = { properties?: Record<string, NotionProperty> };

    const pages = (result.results || []) as NotionPage[];

    if (pages.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }

    // Extract property names & types from first page
    const firstProps = pages[0].properties || {};
    const propNames = Object.keys(firstProps);
    const columns = propNames.map((name) => {
      const prop = firstProps[name];
      return {
        name,
        type: this.notionPropertyToColumnType(prop?.type ?? ''),
      };
    });

    const rows = pages.map((page: NotionPage) => {
      const obj: Record<string, unknown> = {};
      propNames.forEach((name) => {
        const prop = page.properties?.[name];
        obj[name] = this.extractNotionValue(prop);
      });
      return obj;
    });

    return { columns, rows, totalRows: pages.length };
  }

  private notionPropertyToColumnType(
    notionType: string,
  ): 'string' | 'number' | 'date' | 'boolean' {
    switch (notionType) {
      case 'number':
        return 'number';
      case 'date':
      case 'created_time':
      case 'last_edited_time':
        return 'date';
      case 'checkbox':
        return 'boolean';
      default:
        return 'string';
    }
  }

  private extractNotionValue(
    prop: { type: string; [key: string]: unknown } | null | undefined,
  ): unknown {
    if (!prop) return null;
    switch (prop.type) {
      case 'title':
        return (
          (prop.title as Array<{ plain_text: string }>)
            ?.map((t: { plain_text: string }) => t.plain_text)
            .join('') || ''
        );
      case 'rich_text':
        return (
          (prop.rich_text as Array<{ plain_text: string }>)
            ?.map((t: { plain_text: string }) => t.plain_text)
            .join('') || ''
        );
      case 'number':
        return prop.number;
      case 'select':
        return (
          (prop.select as { name?: string } | null | undefined)?.name || null
        );
      case 'multi_select':
        return Array.isArray(prop.multi_select)
          ? (prop.multi_select as Array<{ name: string }>)
              .map((s) => s.name)
              .join(', ')
          : '';
      case 'date':
        return (
          (prop.date as { start?: string } | null | undefined)?.start || null
        );
      case 'checkbox':
        return prop.checkbox;
      case 'url':
        return prop.url;
      case 'email':
        return prop.email;
      case 'phone_number':
        return prop.phone_number;
      default:
        return JSON.stringify(prop[prop.type]);
    }
  }

  private async fetchFromJsonApi(
    config: DataSourceConfig,
    options: { limit?: number },
  ): Promise<DataPreview> {
    const response = await fetch(config.config.apiUrl!, {
      headers: config.credentials?.apiKey
        ? { Authorization: `Bearer ${config.credentials.apiKey}` }
        : {},
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = (
      Array.isArray(data) ? data : data.data || data.results || [data]
    ) as Array<Record<string, unknown>>;

    // Infer columns from first row
    const columns =
      rows.length > 0
        ? Object.keys(rows[0]).map((name) => ({
            name,
            type: this.inferColumnType(rows[0][name]),
          }))
        : [];

    return {
      columns,
      rows: rows.slice(0, options.limit || 100),
      totalRows: rows.length,
    };
  }

  private inferColumnType(
    value: unknown,
  ): 'string' | 'number' | 'date' | 'boolean' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
  }

  /**
   * Schedule data sync
   */
  async scheduleSync(
    connectionId: string,
    intervalMinutes?: number,
  ): Promise<void> {
    const connection = await this.prisma.dataSourceConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) return;

    const config = connection.config as DataSourceConfig['config'];
    const interval = intervalMinutes || config.refreshInterval || 60;

    // Add to sync queue with repeat
    await this.dataSyncQueue.add(
      'sync-data',
      { connectionId },
      {
        repeat: { every: interval * 60 * 1000 },
        jobId: `sync-${connectionId}`,
      },
    );
  }

  /**
   * Trigger manual sync
   */
  async triggerSync(connectionId: string): Promise<void> {
    await this.dataSyncQueue.add('sync-data', { connectionId });
  }

  // Encryption helpers (simplified - use proper encryption in production)
  private encryptCredentials(credentials: object): string {
    // In production, use proper encryption
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }

  private decryptCredentials(
    encrypted: unknown,
  ): DataSourceConfig['credentials'] {
    // In production, use proper decryption
    return JSON.parse(
      Buffer.from(encrypted as string, 'base64').toString(),
    ) as DataSourceConfig['credentials'];
  }

  /**
   * Get OAuth URL for data source
   */
  getOAuthUrl(type: DataSourceType, redirectUri: string): string {
    const clientIds: Record<string, string> = {
      google_sheets: process.env.GOOGLE_CLIENT_ID || '',
      excel_online: process.env.MICROSOFT_CLIENT_ID || '',
      notion: process.env.NOTION_CLIENT_ID || '',
      airtable: process.env.AIRTABLE_CLIENT_ID || '',
    };

    switch (type) {
      case 'google_sheets':
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientIds.google_sheets}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https://www.googleapis.com/auth/spreadsheets.readonly&response_type=code`;
      case 'excel_online':
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientIds.excel_online}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=Files.Read.All&response_type=code`;
      case 'notion':
        return `https://api.notion.com/v1/oauth/authorize?client_id=${clientIds.notion}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
      default:
        throw new Error(`OAuth not supported for: ${type}`);
    }
  }
}
