import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { OtpService } from './otp.service';
import {
  RequestOtpDto,
  VerifyOtpDto,
  RequestEmailOtpDto,
  RequestSmsOtpDto,
  VerifyEmailOtpDto,
  VerifySmsOtpDto,
  OtpChannel,
  OtpPurpose,
} from './dto/otp.dto';

@Controller('otp')
@UseGuards(ThrottlerGuard)
export class OtpController {
  private readonly logger = new Logger(OtpController.name);

  constructor(private readonly otpService: OtpService) {}

  // ─── Generic OTP Request ───────────────────────────────────
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async requestOtp(@Body() dto: RequestOtpDto) {
    const result = await this.otpService.generateOtp(
      dto.identifier,
      dto.channel,
      dto.purpose || OtpPurpose.LOGIN,
    );
    return result;
  }

  // ─── Generic OTP Verify ────────────────────────────────────
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.otpService.verifyOtp(
      dto.identifier,
      dto.otp,
      OtpChannel.EMAIL, // Default fallback
      dto.purpose || OtpPurpose.LOGIN,
    );

    if (!result.success) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        ...result,
      };
    }
    return result;
  }

  // ─── Email OTP Endpoints ───────────────────────────────────
  @Post('email/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async requestEmailOtp(@Body() dto: RequestEmailOtpDto) {
    const result = await this.otpService.generateOtp(
      dto.email,
      OtpChannel.EMAIL,
      dto.purpose || OtpPurpose.EMAIL_VERIFICATION,
    );
    return result;
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    const result = await this.otpService.verifyOtp(
      dto.email,
      dto.otp,
      OtpChannel.EMAIL,
      dto.purpose || OtpPurpose.EMAIL_VERIFICATION,
    );

    if (!result.success) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        ...result,
      };
    }
    return result;
  }

  // ─── SMS OTP Endpoints ─────────────────────────────────────
  @Post('sms/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async requestSmsOtp(@Body() dto: RequestSmsOtpDto) {
    const result = await this.otpService.generateOtp(
      dto.phone,
      OtpChannel.SMS,
      dto.purpose || OtpPurpose.PHONE_VERIFICATION,
    );
    return result;
  }

  @Post('sms/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifySmsOtp(@Body() dto: VerifySmsOtpDto) {
    const result = await this.otpService.verifyOtp(
      dto.phone,
      dto.otp,
      OtpChannel.SMS,
      dto.purpose || OtpPurpose.PHONE_VERIFICATION,
    );

    if (!result.success) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        ...result,
      };
    }
    return result;
  }

  // ─── OTP Status Check ──────────────────────────────────────
  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getOtpStatus(
    @Query('identifier') identifier: string,
    @Query('channel') channel: OtpChannel = OtpChannel.EMAIL,
    @Query('purpose') purpose: OtpPurpose = OtpPurpose.LOGIN,
  ) {
    if (!identifier) {
      return { error: 'Identifier query parameter is required' };
    }
    return this.otpService.getOtpStatus(identifier, channel, purpose);
  }
}
