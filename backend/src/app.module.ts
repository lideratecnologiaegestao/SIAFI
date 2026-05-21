import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { QueueModule } from './modules/queue/queue.module';
import { AdminQueueMiddleware } from './modules/queue/admin-queue.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { LoansModule } from './modules/loans/loans.module';
import { InstallmentsModule } from './modules/installments/installments.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { RenegociacoesModule } from './modules/renegociacoes/renegociacoes.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PixModule } from './modules/pix/pix.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CronModule } from './modules/cron/cron.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ClientPortalModule } from './modules/client-portal/client-portal.module';
import { ConsultorModule } from './modules/consultor/consultor.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { ScoreRiscoModule } from './modules/score-risco/score-risco.module';
import { IntencaoModule } from './modules/intencao/intencao.module';
import { ReparcelamentoModule } from './modules/reparcelamento/reparcelamento.module';
import { MensagemModule } from './modules/mensagem/mensagem.module';
import { CobrancaModule } from './modules/cobranca/cobranca.module';
import { SupabaseAuthGuard } from './modules/auth/guards/supabase-auth.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    SupabaseModule,
    QueueModule,
    UsersModule,
    AuthModule,
    ClientsModule,
    LoansModule,
    InstallmentsModule,
    PaymentsModule,
    TransactionsModule,
    RenegociacoesModule,
    WebhookModule,
    PixModule,
    NotificationsModule,
    CronModule,
    ReportsModule,
    AuditModule,
    SettingsModule,
    ClientPortalModule,
    ConsultorModule,
    PdfModule,
    ScoreRiscoModule,
    IntencaoModule,
    ReparcelamentoModule,
    MensagemModule,
    CobrancaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SupabaseAuthGuard,
    JwtAuthGuard,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AdminQueueMiddleware).forRoutes('/admin/queues');
  }
}
