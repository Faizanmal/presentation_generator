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
  rows: Array<Record<string, any>>;
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
    await this.validateConnection(config);

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
  async testConnection(
    config: DataSourceConfig,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.validateConnection(config);
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Validate and test connection
   */
  private async validateConnection(config: DataSourceConfig): Promise<void> {
    switch (config.type) {
      case 'google_sheets':
        await this.validateGoogleSheets(config);
        break;
      case 'excel_online':
        await this.validateExcelOnline(config);
        break;
      case 'airtable':
        await this.validateAirtable(config);
        break;
      case 'notion':
        await this.validateNotion(config);
        break;
      case 'json_api':
        await this.validateJsonApi(config);
        break;
      case 'postgresql':
      case 'mysql':
        await this.validateSqlDatabase(config);
        break;
      case 'mongodb':
        await this.validateMongoDB(config);
        break;
      case 'csv':
        // CSV doesn't need validation
        break;
      default:
        throw new Error(`Unsupported data source type: ${config.type}`);
    }
  }

  private async validateGoogleSheets(config: DataSourceConfig): Promise<void> {
    if (!config.credentials?.accessToken) {
      throw new Error('Google Sheets requires OAuth access token');
    }
    if (!config.config.spreadsheetId) {
      throw new Error('Spreadsheet ID is required');
    }
    // In production, would make API call to validate
  }

  private async validateExcelOnline(config: DataSourceConfig): Promise<void> {
    if (!config.credentials?.accessToken) {
      throw new Error('Excel Online requires Microsoft OAuth access token');
    }
  }

  private async validateAirtable(config: DataSourceConfig): Promise<void> {
    if (!config.credentials?.apiKey) {
      throw new Error('Airtable requires API key');
    }
    if (!config.config.tableId) {
      throw new Error('Table ID is required');
    }
  }

  private async validateNotion(config: DataSourceConfig): Promise<void> {
    if (!config.credentials?.accessToken) {
      throw new Error('Notion requires OAuth access token');
    }
    if (!config.config.databaseId) {
      throw new Error('Database ID is required');
    }
  }

  private async validateJsonApi(config: DataSourceConfig): Promise<void> {
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

  private async validateSqlDatabase(config: DataSourceConfig): Promise<void> {
    if (!config.credentials?.connectionString) {
      throw new Error('Database connection string is required');
    }
  }

  private async validateMongoDB(config: DataSourceConfig): Promise<void> {
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
      filters?: Record<string, any>;
    } = {},
  ): Promise<DataPreview> {
    const connection = await this.prisma.dataSourceConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    const credentials = connection.credentials
      ? this.decryptCredentials(connection.credentials as object)
      : null;

    const config: DataSourceConfig = {
      type: connection.type as DataSourceType,
      name: connection.name,
      credentials,
      config: connection.config as any,
    };

    return this.fetchFromSource(config, options);
  }

  private async fetchFromSource(
    config: DataSourceConfig,
    options: { limit?: number; offset?: number; filters?: Record<string, any> },
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
      type: this.inferColumnType(dataRows[0]?.[headers.indexOf(name)]) as any,
    }));

    const rows = dataRows.map((row) => {
      const obj: Record<string, any> = {};
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
    const values: any[][] = result.values || [];

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
      type: this.inferColumnType(dataRows[0]?.[headers.indexOf(name)]) as any,
    }));

    const rows = dataRows.map((row) => {
      const obj: Record<string, any> = {};
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

    const result = await response.json();
    const records = result.records || [];

    if (records.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }

    // Infer columns from first record's fields
    const firstFields = records[0].fields || {};
    const columns = Object.keys(firstFields).map((name) => ({
      name,
      type: this.inferColumnType(firstFields[name]) as any,
    }));

    const rows = records.map((r: { fields: Record<string, any> }) => ({
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
    const pages = result.results || [];

    if (pages.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }

    // Extract property names & types from first page
    const firstProps = pages[0].properties || {};
    const propNames = Object.keys(firstProps);
    const columns = propNames.map((name) => ({
      name,
      type: this.notionPropertyToColumnType(firstProps[name].type),
    }));

    const rows = pages.map((page: { properties: Record<string, any> }) => {
      const obj: Record<string, any> = {};
      propNames.forEach((name) => {
        obj[name] = this.extractNotionValue(page.properties[name]);
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

  private extractNotionValue(prop: { type: string; [key: string]: any }): any {
    if (!prop) return null;
    switch (prop.type) {
      case 'title':
        return (
          prop.title
            ?.map((t: { plain_text: string }) => t.plain_text)
            .join('') || ''
        );
      case 'rich_text':
        return (
          prop.rich_text
            ?.map((t: { plain_text: string }) => t.plain_text)
            .join('') || ''
        );
      case 'number':
        return prop.number;
      case 'select':
        return prop.select?.name || null;
      case 'multi_select':
        return (
          prop.multi_select?.map((s: { name: string }) => s.name).join(', ') ||
          ''
        );
      case 'date':
        return prop.date?.start || null;
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
    const rows = Array.isArray(data)
      ? data
      : data.data || data.results || [data];

    // Infer columns from first row
    const columns =
      rows.length > 0
        ? Object.keys(rows[0]).map((name) => ({
            name,
            type: this.inferColumnType(rows[0][name]) as any,
          }))
        : [];

    return {
      columns,
      rows: rows.slice(0, options.limit || 100),
      totalRows: rows.length,
    };
  }

  private inferColumnType(value: any): string {
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

    const config = connection.config as any;
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
  private encryptCredentials(credentials: object): object {
    // In production, use proper encryption
    return Buffer.from(JSON.stringify(credentials)).toString('base64') as any;
  }

  private decryptCredentials(encrypted: object): any {
    // In production, use proper decryption
    return JSON.parse(Buffer.from(encrypted as any, 'base64').toString());
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
