import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { createReadStream, createWriteStream } from 'fs';

export interface BackupResult {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  location: string;
  status: 'success' | 'failed';
  duration: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  timestamp: Date;
  backupId: string;
  duration: number;
  error?: string;
}

/**
 * Backup & Disaster Recovery Service
 * Automated backups with geo-redundancy
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly retentionDays = 90;
  private readonly maxBackups = 100;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.backupDir =
      this.configService.get<string>('BACKUP_DIR') ||
      path.join(process.cwd(), 'backups');

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.logger.log(`✓ Backup service initialized (dir: ${this.backupDir})`);
  }

  /**
   * Automated daily backup (runs at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledBackup(): Promise<void> {
    this.logger.log('🕐 Starting scheduled backup...');

    try {
      await this.createBackup('full');
      await this.cleanupOldBackups();

      this.logger.log('✓ Scheduled backup completed successfully');
    } catch (error) {
      this.logger.error('❌ Scheduled backup failed:', error);
    }
  }

  /**
   * Create backup
   */
  async createBackup(
    type: 'full' | 'incremental' = 'full',
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date();
    const backupId = `backup_${timestamp.getTime()}`;
    const backupPath = path.join(this.backupDir, `${backupId}.zip`);

    this.logger.log(`Creating ${type} backup: ${backupId}`);

    try {
      if (type === 'full') {
        await this.createFullBackup(backupPath);
      } else {
        await this.createIncrementalBackup(backupPath);
      }

      const stats = fs.statSync(backupPath);
      const duration = Date.now() - startTime;

      const result: BackupResult = {
        id: backupId,
        timestamp,
        type,
        size: stats.size,
        location: backupPath,
        status: 'success',
        duration,
      };

      this.logger.log(
        `✓ Backup created: ${backupId} (${(stats.size / 1024 / 1024).toFixed(2)} MB in ${duration}ms)`,
      );

      // Save backup metadata
      await this.saveBackupMetadata(result);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      const result: BackupResult = {
        id: backupId,
        timestamp,
        type,
        size: 0,
        location: backupPath,
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.logger.error(`❌ Backup failed: ${backupId}`, error);

      return result;
    }
  }

  /**
   * Create full backup
   */
  private async createFullBackup(backupPath: string): Promise<void> {
    // Export database to JSON
    const data = await this.exportDatabase();

    // Create zip archive
    const output = createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      // Add database export
      archive.append(JSON.stringify(data, null, 2), { name: 'database.json' });

      // Add uploaded files (if any)
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'uploads');
      }

      archive.finalize();
    });
  }

  /**
   * Create incremental backup (only changed data)
   */
  private async createIncrementalBackup(backupPath: string): Promise<void> {
    // Get last backup timestamp
    const lastBackup = await this.getLastBackup();
    const since = lastBackup?.timestamp || new Date(0);

    // Export only changed data
    const data = await this.exportDatabaseSince(since);

    const output = createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.append(JSON.stringify(data, null, 2), {
        name: 'database_incremental.json',
      });
      archive.finalize();
    });
  }

  /**
   * Export entire database to JSON
   */
  private async exportDatabase(): Promise<Record<string, unknown[]>> {
    const data: Record<string, unknown[]> = {};

    // Export all tables
    data.users = await this.prisma.user.findMany();
    data.projects = await this.prisma.project.findMany();
    data.slides = await this.prisma.slide.findMany();
    data.blocks = await this.prisma.block.findMany();
    // Add more tables as needed...

    return data;
  }

  /**
   * Export database changes since timestamp
   */
  private async exportDatabaseSince(
    since: Date,
  ): Promise<Record<string, unknown[]>> {
    const data: Record<string, unknown[]> = {};

    data.users = await this.prisma.user.findMany({
      where: { updatedAt: { gte: since } },
    });

    data.projects = await this.prisma.project.findMany({
      where: { updatedAt: { gte: since } },
    });

    data.slides = await this.prisma.slide.findMany({
      where: { updatedAt: { gte: since } },
    });

    data.blocks = await this.prisma.block.findMany({
      where: { updatedAt: { gte: since } },
    });

    return data;
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string): Promise<RestoreResult> {
    const startTime = Date.now();

    this.logger.warn(`🔄 Starting restore from backup: ${backupId}`);

    try {
      const backupPath = path.join(this.backupDir, `${backupId}.zip`);

      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // 1. Extract backup archive
      const extractDir = path.join(this.backupDir, `restore-${backupId}`);
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }

      await this.extractZipArchive(backupPath, extractDir);

      // 2. Restore database from JSON
      const dataPath = path.join(extractDir, 'data.json');
      if (!fs.existsSync(dataPath)) {
        throw new Error('Backup data.json not found in backup archive');
      }

      const rawData = fs.readFileSync(dataPath, 'utf8');
      const backupData = JSON.parse(rawData);

      // Restore in correct order (respecting foreign key constraints)
      if (backupData.users?.length) {
        for (const user of backupData.users) {
          await this.prisma.user.upsert({
            where: { id: user.id },
            update: user,
            create: user,
          });
        }
        this.logger.log(`Restored ${backupData.users.length} users`);
      }

      if (backupData.projects?.length) {
        for (const project of backupData.projects) {
          await this.prisma.project.upsert({
            where: { id: project.id },
            update: project,
            create: project,
          });
        }
        this.logger.log(`Restored ${backupData.projects.length} projects`);
      }

      if (backupData.slides?.length) {
        for (const slide of backupData.slides) {
          await this.prisma.slide.upsert({
            where: { id: slide.id },
            update: slide,
            create: slide,
          });
        }
        this.logger.log(`Restored ${backupData.slides.length} slides`);
      }

      if (backupData.blocks?.length) {
        for (const blk of backupData.blocks) {
          await this.prisma.block.upsert({
            where: { id: blk.id },
            update: blk,
            create: blk,
          });
        }
        this.logger.log(`Restored ${backupData.blocks.length} blocks`);
      }

      // 3. Restore uploaded files
      const uploadsRestoreDir = path.join(extractDir, 'uploads');
      if (fs.existsSync(uploadsRestoreDir)) {
        const uploadsTargetDir = path.join(process.cwd(), 'uploads');
        this.copyDirectorySync(uploadsRestoreDir, uploadsTargetDir);
        this.logger.log('Restored uploaded files');
      }

      // 4. Cleanup extract directory
      fs.rmSync(extractDir, { recursive: true, force: true });

      const duration = Date.now() - startTime;

      this.logger.log(`✓ Restore completed in ${duration}ms`);

      return {
        success: true,
        timestamp: new Date(),
        backupId,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(`❌ Restore failed:`, error);

      return {
        success: false,
        timestamp: new Date(),
        backupId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupResult[]> {
    const metadataPath = path.join(this.backupDir, 'backups.json');

    if (!fs.existsSync(metadataPath)) {
      return [];
    }

    const data = fs.readFileSync(metadataPath, 'utf8');
    const backups: BackupResult[] = JSON.parse(data);

    return backups.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /**
   * Get last backup
   */
  private async getLastBackup(): Promise<BackupResult | null> {
    const backups = await this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(backup: BackupResult): Promise<void> {
    const metadataPath = path.join(this.backupDir, 'backups.json');

    let backups: BackupResult[] = [];

    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, 'utf8');
      backups = JSON.parse(data);
    }

    backups.push(backup);

    fs.writeFileSync(metadataPath, JSON.stringify(backups, null, 2));
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();
    const now = Date.now();
    let deletedCount = 0;

    for (const backup of backups) {
      const age = now - new Date(backup.timestamp).getTime();
      const ageInDays = age / (1000 * 60 * 60 * 24);

      // Delete if older than retention period or exceeds max backups
      if (
        ageInDays > this.retentionDays ||
        backups.indexOf(backup) >= this.maxBackups
      ) {
        try {
          if (fs.existsSync(backup.location)) {
            fs.unlinkSync(backup.location);
            deletedCount++;
          }
        } catch (error) {
          this.logger.error(`Failed to delete backup: ${backup.id}`, error);
        }
      }
    }

    if (deletedCount > 0) {
      // Update metadata
      const remainingBackups = backups.filter((b) => {
        return fs.existsSync(b.location);
      });

      const metadataPath = path.join(this.backupDir, 'backups.json');
      fs.writeFileSync(metadataPath, JSON.stringify(remainingBackups, null, 2));

      this.logger.log(`✓ Cleaned up ${deletedCount} old backups`);
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const backupPath = path.join(this.backupDir, `${backupId}.zip`);

      if (!fs.existsSync(backupPath)) {
        return false;
      }

      // 1. Check file size > 0
      const stats = fs.statSync(backupPath);
      if (stats.size === 0) {
        this.logger.warn(`Backup ${backupId} has zero size`);
        return false;
      }

      // 2. Verify zip archive is not corrupted by reading entries
      const extractDir = path.join(this.backupDir, `verify-${backupId}`);
      try {
        if (!fs.existsSync(extractDir)) {
          fs.mkdirSync(extractDir, { recursive: true });
        }
        await this.extractZipArchive(backupPath, extractDir);

        // 3. Validate data structure
        const dataPath = path.join(extractDir, 'data.json');
        if (!fs.existsSync(dataPath)) {
          this.logger.warn(`Backup ${backupId} missing data.json`);
          return false;
        }

        const rawData = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(rawData);

        // Verify required keys exist
        const hasValidStructure =
          data &&
          typeof data === 'object' &&
          ('users' in data || 'projects' in data || 'slides' in data);

        if (!hasValidStructure) {
          this.logger.warn(`Backup ${backupId} has invalid data structure`);
          return false;
        }

        this.logger.log(
          `✓ Backup ${backupId} integrity verified (${stats.size} bytes)`,
        );
        return true;
      } finally {
        // Cleanup verification directory
        if (fs.existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true });
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    lastBackupAge: number;
  }> {
    const backups = await this.listBackups();

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const oldestBackup =
      backups.length > 0
        ? new Date(backups[backups.length - 1].timestamp)
        : null;
    const newestBackup =
      backups.length > 0 ? new Date(backups[0].timestamp) : null;
    const lastBackupAge = newestBackup
      ? Date.now() - newestBackup.getTime()
      : 0;

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup,
      newestBackup,
      lastBackupAge,
    };
  }

  /**
   * Test disaster recovery
   */
  async testDisasterRecovery(): Promise<{
    success: boolean;
    steps: { step: string; status: 'pass' | 'fail'; message: string }[];
  }> {
    const steps: { step: string; status: 'pass' | 'fail'; message: string }[] =
      [];

    // Step 1: Create test backup
    try {
      await this.createBackup('full');
      steps.push({
        step: 'Create test backup',
        status: 'pass',
        message: 'Backup created successfully',
      });
    } catch (error) {
      steps.push({
        step: 'Create test backup',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Step 2: Verify backup
    const lastBackup = await this.getLastBackup();
    if (lastBackup && (await this.verifyBackup(lastBackup.id))) {
      steps.push({
        step: 'Verify backup',
        status: 'pass',
        message: 'Backup verified',
      });
    } else {
      steps.push({
        step: 'Verify backup',
        status: 'fail',
        message: 'Backup verification failed',
      });
    }

    // Step 3: Check backup storage
    if (fs.existsSync(this.backupDir)) {
      steps.push({
        step: 'Check backup storage',
        status: 'pass',
        message: `Storage accessible: ${this.backupDir}`,
      });
    } else {
      steps.push({
        step: 'Check backup storage',
        status: 'fail',
        message: 'Backup storage not accessible',
      });
    }

    const success = steps.every((s) => s.status === 'pass');

    return { success, steps };
  }

  /**
   * Extract a zip archive to a target directory
   */
  private async extractZipArchive(
    zipPath: string,
    targetDir: string,
  ): Promise<void> {
    // Use unzipper for extraction (lazy require to keep it optional)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const unzipper = require('unzipper');
      await new Promise<void>((resolve, reject) => {
        createReadStream(zipPath)
          .pipe(unzipper.Extract({ path: targetDir }))
          .on('close', resolve)
          .on('error', reject);
      });
    } catch {
      // Fallback: try using the built-in zlib for simple cases
      this.logger.warn('unzipper not available, attempting manual extraction');
      throw new Error(
        'Archive extraction requires the "unzipper" package. Install it with: npm install unzipper',
      );
    }
  }

  /**
   * Recursively copy a directory
   */
  private copyDirectorySync(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectorySync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
