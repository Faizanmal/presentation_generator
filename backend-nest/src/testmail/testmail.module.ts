import { Module } from '@nestjs/common';
import { TestMailService } from './testmail.service';

/**
 * TestMail Module
 * Provides email testing and verification capabilities
 *
 * Usage:
 * ```
 * @Module({
 *   imports: [TestMailModule],
 * })
 * export class AuthModule {}
 * ```
 */

@Module({
  providers: [TestMailService],
  exports: [TestMailService],
})
export class TestMailModule {}
