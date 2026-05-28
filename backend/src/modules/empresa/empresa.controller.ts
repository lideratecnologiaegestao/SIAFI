import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmpresaConfigService } from './empresa-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

const LOGO_BUCKET = 'empresa-assets';
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml'];

@Controller('empresa')
export class EmpresaController {
  constructor(
    private readonly empresaConfig: EmpresaConfigService,
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  /** Público — usado pelo frontend a cada load para injetar CSS variables */
  @Get('tema')
  async getTema() {
    const e = await this.empresaConfig.get()
    return {
      logoUrl:      e.logoUrl,
      nomeFantasia: e.nomeFantasia || e.nome,
      corPrimaria:  e.corPrimaria,
      corSecundaria: e.corSecundaria,
      corAcento:    e.corAcento,
      corTexto:     e.corTexto,
      corFundo:     e.corFundo,
    }
  }

  /** Config completa — sem logoBase64 (campo pesado) */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getConfig() {
    const e = await this.empresaConfig.get()
    const { logoBase64: _omit, ...rest } = e
    return rest
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async atualizar(@Body() dto: UpdateEmpresaDto) {
    const entries = Object.entries(dto)
      .filter(([, v]) => v !== undefined)
      .map(([chave, valor]) => ({
        chave: `empresa.${chave}`,
        valor: valor as string,
      }))

    if (!entries.length) return { updated: 0 }

    await Promise.all(
      entries.map(({ chave, valor }) =>
        this.prisma.siteSetting.upsert({
          where:  { chave },
          update: { valor },
          create: { chave, valor },
        }),
      ),
    )

    this.empresaConfig.invalidarCache()
    return { updated: entries.length }
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não enviado')
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use PNG, JPG ou SVG')
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('Arquivo muito grande. Máximo 2 MB')
    }

    const ext = file.mimetype === 'image/svg+xml' ? 'svg'
      : file.mimetype === 'image/png' ? 'png' : 'jpg'
    const path = `logo.${ext}`

    await this.supabase.uploadFile(LOGO_BUCKET, path, file.buffer, file.mimetype)

    const { data } = this.supabase.admin.storage.from(LOGO_BUCKET).getPublicUrl(path)
    const logoUrl = data.publicUrl

    const logoBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`

    await Promise.all([
      this.prisma.siteSetting.upsert({
        where: { chave: 'empresa.logoUrl' },
        update: { valor: logoUrl },
        create: { chave: 'empresa.logoUrl', valor: logoUrl },
      }),
      this.prisma.siteSetting.upsert({
        where: { chave: 'empresa.logoBase64' },
        update: { valor: logoBase64 },
        create: { chave: 'empresa.logoBase64', valor: logoBase64 },
      }),
    ])

    this.empresaConfig.invalidarCache()
    return { logoUrl }
  }

  @Delete('logo')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async removerLogo() {
    await Promise.all([
      this.prisma.siteSetting.upsert({
        where: { chave: 'empresa.logoUrl' },
        update: { valor: '' },
        create: { chave: 'empresa.logoUrl', valor: '' },
      }),
      this.prisma.siteSetting.upsert({
        where: { chave: 'empresa.logoBase64' },
        update: { valor: '' },
        create: { chave: 'empresa.logoBase64', valor: '' },
      }),
    ])
    this.empresaConfig.invalidarCache()
  }
}
