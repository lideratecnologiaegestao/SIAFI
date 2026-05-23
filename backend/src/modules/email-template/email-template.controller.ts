import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmailTemplateService } from './email-template.service';

class UpdateTemplateDto {
  @IsOptional() @IsString() @MinLength(3) nome?:    string;
  @IsOptional() @IsString() @MinLength(3) assunto?: string;
  @IsOptional() @IsString() @MinLength(10) corpo?:  string;
  @IsOptional() @IsBoolean()              ativo?:   boolean;
}

class PreviewDto {
  @IsOptional() vars?: Record<string, string>;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email-templates')
export class EmailTemplateController {
  constructor(private readonly svc: EmailTemplateService) {}

  @Get()
  @Roles('admin', 'financeiro')
  findAll() { return this.svc.findAll(); }

  @Get(':slug')
  @Roles('admin', 'financeiro')
  findOne(@Param('slug') slug: string) { return this.svc.findBySlug(slug); }

  @Patch(':slug')
  @Roles('admin')
  update(@Param('slug') slug: string, @Body() dto: UpdateTemplateDto) {
    return this.svc.update(slug, dto);
  }

  @Post(':slug/preview')
  @Roles('admin', 'financeiro')
  preview(@Param('slug') slug: string, @Body() dto: PreviewDto) {
    return this.svc.renderPreview(slug, dto.vars ?? {});
  }
}
