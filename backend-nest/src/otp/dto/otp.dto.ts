import {
  IsString,
  IsEnum,
  IsEmail,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export enum OtpChannel {
  EMAIL = 'email',
  SMS = 'sms',
}

export enum OtpPurpose {
  LOGIN = 'login',
  REGISTER = 'register',
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  TWO_FACTOR = 'two_factor',
}

export class RequestOtpDto {
  @IsString()
  identifier: string; // email or phone number

  @IsEnum(OtpChannel)
  channel: OtpChannel;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose;
}

export class VerifyOtpDto {
  @IsString()
  identifier: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits' })
  otp: string;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose;
}

export class RequestEmailOtpDto {
  @IsEmail()
  email: string;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose;
}

export class RequestSmsOtpDto {
  @IsString()
  phone: string;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose;
}

export class VerifyEmailOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose;
}

export class VerifySmsOtpDto {
  @IsString()
  phone: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose;
}
