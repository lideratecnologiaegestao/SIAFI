import { CanActivate, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PAGAMENTO_ONLINE_ATIVO, MOTIVO_PAGAMENTO_ONLINE_DESLIGADO } from '../pagamento-online';

/**
 * Fecha o modulo de cobranca online quando PAGAMENTO_ONLINE_ENABLED=false.
 *
 * 503 e nao 404: o recurso existe e volta se a instalacao religar o gateway —
 * 404 faria parecer erro de rota e mandaria quem investiga para o lado errado.
 *
 * Fecha TAMBEM as rotas de leitura. Elas so leem cobrancas emitidas por este
 * mesmo gateway; com ele desligado nao ha o que ler, e meia porta aberta e
 * superficie que alguem volta a chamar sem perceber.
 */
@Injectable()
export class PagamentoOnlineGuard implements CanActivate {
  canActivate(): boolean {
    if (!PAGAMENTO_ONLINE_ATIVO) {
      throw new ServiceUnavailableException(MOTIVO_PAGAMENTO_ONLINE_DESLIGADO);
    }
    return true;
  }
}
