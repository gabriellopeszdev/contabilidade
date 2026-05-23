import type { IDocumentoRepository } from '../../domain/ports/IDocumentoRepository';
import type { IAuditLogRepository } from '../../domain/ports/IAuditLogRepository';
import type { IEventDispatcher } from '../../domain/ports/IEventDispatcher';

import { AuditLog } from '../../domain/entities/AuditLog';
import { DomainException } from '../../domain/exceptions/DomainException';
import { DocumentoVisualizadoEvent } from '../../domain/events/DocumentoVisualizadoEvent';
import type {
  RegistrarLeituraDocumentoInputDTO,
  RegistrarLeituraDocumentoOutputDTO,
} from '../dtos/RegistrarLeituraDTO';

// ---------------------------------------------------------------------------
// Use Case: RegistrarLeituraDocumentoUseCase
// ---------------------------------------------------------------------------

/**
 * Caso de Uso: RegistrarLeituraDocumentoUseCase
 *
 * Registra que um cliente visualizou um documento fiscal.
 * Invocado pelo controller quando o cliente abre a página de detalhes
 * ou solicita o download de um documento.
 *
 * FLUXO:
 *   1. Busca o DocumentoFiscal no repositório
 *   2. Verifica ownership (clienteId do token === clienteId do documento)
 *   3. Armazena o estado anterior de leitura (para saber se é primeira leitura)
 *   4. Invoca `documento.registrarVisualizacao()` na entidade rica
 *      → Idempotente: só altera estado e emite evento na primeira chamada
 *   5. Persiste a alteração (readStatus + readAt) no banco
 *   6. Persiste AuditLog da visualização
 *   7. Publica DocumentoVisualizadoEvent (WebSocket → notifica o contador)
 *
 * IDEMPOTÊNCIA:
 *   Se o documento já foi lido anteriormente, a operação é idempotente:
 *   - O estado NÃO é alterado novamente
 *   - O evento de domínio NÃO é emitido (evita spam de notificações)
 *   - O AuditLog É sempre gravado (cada acesso é rastreado, inclusive repetidos)
 *   - O output retorna `primeiraLeitura: false` e o `readAt` original
 *
 * SEGURANÇA:
 *   - Verificação de ownership feita no use case (defense in depth),
 *     mesmo que o RBAC middleware já tenha validado.
 *   - Não vaza informações sobre documentos de outros clientes:
 *     lança DomainException genérica em ambos os casos (não encontrado / não autorizado).
 *
 * DEPENDÊNCIAS (via injeção — Clean Architecture DIP):
 *   - IDocumentoRepository: leitura e atualização da entidade
 *   - IAuditLogRepository: registro imutável da visualização
 *   - IEventDispatcher: publicação do evento para WebSocket e listeners
 */
export class RegistrarLeituraDocumentoUseCase {
  constructor(
    private readonly documentoRepository: IDocumentoRepository,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  async executar(
    input: RegistrarLeituraDocumentoInputDTO,
  ): Promise<RegistrarLeituraDocumentoOutputDTO> {
    this.validarInput(input);

    // -------------------------------------------------------------------------
    // Etapa 1: Busca o documento
    // -------------------------------------------------------------------------
    const documento = await this.documentoRepository.buscarPorId(input.documentoId);

    // Mensagem genérica intencional: não revela se o documento existe ou pertence a outro cliente
    if (!documento) {
      throw new DomainException(
        'Documento não encontrado ou sem permissão de acesso.',
      );
    }

    // -------------------------------------------------------------------------
    // Etapa 2: Verifica ownership (defense in depth)
    // -------------------------------------------------------------------------
    if (documento.clientId !== input.clienteId) {
      throw new DomainException(
        'Documento não encontrado ou sem permissão de acesso.',
      );
    }

    // -------------------------------------------------------------------------
    // Etapa 3: Captura estado ANTES da mutação (para output e lógica condicional)
    // -------------------------------------------------------------------------
    const eraLidoAntes = documento.readStatus;
    const readAtAnterior = documento.readAt;

    // -------------------------------------------------------------------------
    // Etapa 4: Invoca comportamento da Entidade Rica (não anêmica)
    // → `registrarVisualizacao()` é idempotente: só muta e emite evento
    //   na PRIMEIRA chamada (quando readStatus era false)
    // -------------------------------------------------------------------------
    documento.registrarVisualizacao();

    // -------------------------------------------------------------------------
    // Etapa 5: Persiste a alteração de estado APENAS se houve mudança real
    // Otimização: evita UPDATE desnecessário no banco em acessos repetidos
    // -------------------------------------------------------------------------
    if (!eraLidoAntes) {
      await this.documentoRepository.atualizar(documento);
    }

    // -------------------------------------------------------------------------
    // Etapa 6: Audit log — registra SEMPRE (rastreia todos os acessos, inclusive repetidos)
    // Fire-and-forget: falha no audit log não reverte a operação
    // -------------------------------------------------------------------------
    try {
      const auditLog = AuditLog.criar({
        id: crypto.randomUUID(),
        userId: input.clienteId,
        documentId: input.documentoId,
        actionType: 'VIEW',
        resourceType: 'DOCUMENT',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent ?? null,
        detailsJson: {
          fileName: documento.fileName,
          sector: documento.sector.tipo,
          primeiraLeitura: !eraLidoAntes,
          contadorResponsavelId: input.contadorResponsavelId,
        },
      });
      await this.auditLogRepository.salvar(auditLog);
    } catch {
      // Best-effort: não falha a operação principal por falha no audit log.
      // Em produção, substituir por logger estruturado (Pino) para alertas.
    }

    // -------------------------------------------------------------------------
    // Etapa 7: Publica evento de domínio SOMENTE na primeira leitura
    // → O evento coletado pela entidade via pullDomainEvents() é do tipo
    //   inline (Etapa 1). Aqui criamos o evento concreto com payload completo
    //   para o dispatcher (inclui nomeArquivo, sector, contadorResponsavelId).
    // → APÓS a persistência (nunca antes) — garante consistência
    // -------------------------------------------------------------------------
    if (!eraLidoAntes) {
      // Limpa os eventos internos da entidade (já tratados aqui)
      documento.pullDomainEvents();

      const evento = new DocumentoVisualizadoEvent({
        documentoId: input.documentoId,
        clienteId: input.clienteId,
        contadorResponsavelId: input.contadorResponsavelId,
        ipAddress: input.ipAddress,
        nomeArquivo: documento.fileName,
        sector: documento.sector.tipo,
        visualizadoPorId: input.visualizadoPorId,
        visualizadoPorRole: input.visualizadoPorRole,
      });
      await this.eventDispatcher.dispatch(evento);
    }

    // -------------------------------------------------------------------------
    // Etapa 8: Monta e retorna o output DTO
    // -------------------------------------------------------------------------
    return {
      documentoId: input.documentoId,
      primeiraLeitura: !eraLidoAntes,
      readAt: documento.readAt ?? readAtAnterior ?? new Date(),
      nomeArquivo: documento.fileName,
    };
  }

  // ---------------------------------------------------------------------------
  // Validação de input (fast fail antes de qualquer I/O)
  // ---------------------------------------------------------------------------

  private validarInput(input: RegistrarLeituraDocumentoInputDTO): void {
    if (!input.documentoId?.trim()) {
      throw new DomainException('documentoId é obrigatório.');
    }
    if (!input.clienteId?.trim()) {
      throw new DomainException('clienteId é obrigatório para verificação de ownership.');
    }
    if (!input.ipAddress?.trim()) {
      throw new DomainException('ipAddress é obrigatório para rastreabilidade.');
    }
  }
}
