import { IsEmail, IsString, IsUUID } from 'class-validator';

export class ValidateGoogleDto {
  @IsEmail()
  email: string;

  @IsUUID()
  supabaseUserId: string;
}
