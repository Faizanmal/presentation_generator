import {
  IsEmail,
  IsString,
  IsOptional,
  Length,
  Matches,
  IsBoolean,
  IsEnum,
} from 'class-validator';

export enum OtpChannelType {
  EMAIL = 'email',
  SMS = 'sms',
}

export class RequestOtpLoginDto {
  @IsEmail()
  email: string;
}

export class VerifyOtpLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;

  @IsString()
  @Length(8, 128)
  newPassword: string;
}

// Multi-channel OTP DTOs
export class RequestOtpMultiChannelDto {
  @IsString()
  identifier: string; // email or phone

  @IsEnum(OtpChannelType)
  @IsOptional()
  channel?: OtpChannelType = OtpChannelType.EMAIL;

  @IsBoolean()
  @IsOptional()
  rememberDevice?: boolean = false;
}

export class VerifyOtpMultiChannelDto {
  @IsString()
  identifier: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;

  @IsEnum(OtpChannelType)
  @IsOptional()
  channel?: OtpChannelType = OtpChannelType.EMAIL;

  @IsBoolean()
  @IsOptional()
  rememberDevice?: boolean = false;
}
