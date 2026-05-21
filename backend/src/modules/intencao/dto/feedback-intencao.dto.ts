import { IsIn, IsString } from 'class-validator';

export class FeedbackIntencaoDto {
  @IsString()
  @IsIn(['whatsapp', 'email', 'presencial', 'telefone'])
  canal: string;
}
