import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private twilioClient: Twilio | null = null;
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio SMS client initialized');
    } else {
      this.logger.warn(
        'Twilio credentials not configured. SMS service will log messages instead of sending.',
      );
    }
  }

  /**
   * Send an SMS message
   */
  async sendSms(to: string, body: string): Promise<void> {
    if (!this.twilioClient) {
      // Dev fallback: log the message
      this.logger.log(`[DEV SMS] To: ${to} | Body: ${body}`);
      return;
    }

    try {
      const from = this.configService.get<string>('TWILIO_PHONE_NUMBER');
      await this.twilioClient.messages.create({
        body,
        from,
        to,
      });
      this.logger.log(`SMS sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}`, error.stack);
      throw error;
    }
  }

  /**
   * Send OTP via SMS with formatted message
   */
  async sendOtpSms(
    to: string,
    otp: string,
    expiresInMinutes: number = 5,
  ): Promise<void> {
    const message = `Your Presentation Designer verification code is: ${otp}. Expires in ${expiresInMinutes} minutes. Do not share this code with anyone.`;
    await this.sendSms(to, message);
  }

  /**
   * Check if SMS service is available
   */
  isAvailable(): boolean {
    return this.twilioClient !== null;
  }
}
