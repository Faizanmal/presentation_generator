import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEmailPreferencesDto {
  @IsBoolean()
  @IsOptional()
  loginOtp?: boolean;

  @IsBoolean()
  @IsOptional()
  passwordReset?: boolean;

  @IsBoolean()
  @IsOptional()
  marketingEmails?: boolean;

  @IsBoolean()
  @IsOptional()
  projectUpdates?: boolean;

  @IsBoolean()
  @IsOptional()
  securityAlerts?: boolean;

  @IsBoolean()
  @IsOptional()
  productUpdates?: boolean;
}
