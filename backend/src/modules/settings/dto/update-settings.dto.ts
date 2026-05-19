import { IsArray, IsString, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SettingEntry {
  @IsString()
  chave: string;

  @IsString()
  valor: string;
}

export class UpdateSettingsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SettingEntry)
  entries: SettingEntry[];
}
