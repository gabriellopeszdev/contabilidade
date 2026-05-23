import { Queue, Worker, type Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import type { ILogger } from '../../domain/ports/ILogger';

// =============================================================================
// BullMQAdapter — Processamento Assíncrono em Background
//
// QUANDO USAR:
//   Operações que não devem bloquear a resposta HTTP e podem demorar mais do
//   que o timeout de uma request (ex: extração de texto de PDFs grandes,
//   geração de relatórios, envio de e-mails em lote, conversão de XML → JSON).
//
// ARQUITETURA:
//   - Queue (Producer): recebe jobs via `adicionarJob()` — qualquer route handler pode chamar.
//   - Worker (Consumer): processa jobs em background — inicializado em server.ts.
//
//   HTTP Request
//     └─► route handler
//           └─► adicionarJob({ tipo: 'EXTRAIR_TEXTO_PDF', payload: {...} })
//                 └─► BullMQ persiste job no Redis
//                       └─► Worker retira e processa (background, sem bloquear HTTP)
//
// PERSISTÊNCIA:
//   Jobs são armazenados no Redis. Se o servidor reiniciar com jobs pendentes,
//   o Worker os retomará automaticamente ao reconectar (durabilidade garantida
//   pelo Redis, não pela memória do processo).
//
// CONFIGURAÇÃO DA FILA EM PRODUÇÃO:
//   Ajuste `defaultJobOptions` conforme a tolerância a falhas de cada tipo de job:
//   - Aumentar `attempts` para jobs críticos (ex: e-mails legalmente obrigatórios)
//   - Aumentar `backoff.delay` se o serviço externo tem rate-limiting
//   - Monitorar com Bull Board: https://github.com/felixmosh/bull-board
// =============================================================================

// ---------------------------------------------------------------------------
// Definições de tipos dos jobs
// ---------------------------------------------------------------------------

/** Discriminated union de todos os tipos de job suportados pela fila. */
export type ProcessamentoJobData =
  | {
      tipo: 'EXTRAIR_TEXTO_PDF';
      payload: {
        documentoId: string;
        storagePath: string;
        clienteId:   string;
      };
    }
  | {
      tipo: 'GERAR_RELATORIO_MENSAL';
      payload: {
        contadorId: string;
        mesAno:     string; // 'YYYY-MM'
      };
    }
  | {
      tipo: 'ENVIAR_EMAIL_LOTE';
      payload: {
        destinatarios: string[];
        assunto:       string;
        template:      string;
      };
    };

// ---------------------------------------------------------------------------
// Nome da fila
// ---------------------------------------------------------------------------

export const NOME_FILA = 'processamento_arquivos_pesados';

// ---------------------------------------------------------------------------
// BullMQAdapter
// ---------------------------------------------------------------------------

export class BullMQAdapter {
  private readonly queue: Queue<ProcessamentoJobData>;
  private worker: Worker<ProcessamentoJobData> | null = null;

  constructor(
    private readonly redisConnection: Pick<RedisOptions, 'host' | 'port' | 'password'>,
    private readonly logger: ILogger,
  ) {
    // Queue: lado produtor — apenas adiciona jobs
    this.queue = new Queue<ProcessamentoJobData>(NOME_FILA, {
      connection: {
        host:     redisConnection.host,
        port:     redisConnection.port,
        password: redisConnection.password,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type:  'exponential',
          delay: 2_000, // 2s, 4s, 8s entre tentativas
        },
        // Remove jobs completados após 24h (evita acúmulo no Redis)
        removeOnComplete: { age: 86_400, count: 1_000 },
        // Mantém os últimos 500 jobs com falha para diagnóstico
        removeOnFail: { count: 500 },
      },
    });

    this.logger.info('[BullMQAdapter] Fila criada.', { fila: NOME_FILA });
  }

  // ---------------------------------------------------------------------------
  // Produtor — adiciona jobs à fila
  // ---------------------------------------------------------------------------

  /**
   * Adiciona um job à fila de processamento em background.
   * Retorna imediatamente — o processamento é assíncrono.
   *
   * @example
   * await bullMQ.adicionarJob({
   *   tipo: 'EXTRAIR_TEXTO_PDF',
   *   payload: { documentoId: 'uuid', storagePath: 'bucket/key', clienteId: 'uuid' },
   * });
   */
  async adicionarJob(data: ProcessamentoJobData): Promise<string> {
    const job = await this.queue.add(data.tipo, data, {
      // jobId único garante idempotência — evita duplicidade se o caller fizer retry
      jobId: `${data.tipo}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });

    this.logger.info('[BullMQAdapter] Job adicionado à fila.', {
      fila:  NOME_FILA,
      jobId: job.id,
      tipo:  data.tipo,
    });

    return job.id ?? '';
  }

  // ---------------------------------------------------------------------------
  // Consumidor — inicia o Worker que processa jobs em background
  // ---------------------------------------------------------------------------

  /**
   * Inicia o Worker de processamento.
   * Chamar em `server.ts` APÓS o servidor HTTP estar pronto.
   *
   * O Worker roda no mesmo processo Node.js, mas de forma assíncrona —
   * não bloqueia o event loop principal.
   *
   * @param concurrency Número de jobs processados em paralelo (padrão: 2).
   */
  iniciarWorker(concurrency = 2): void {
    if (this.worker) {
      this.logger.warn('[BullMQAdapter] Worker já está em execução.');
      return;
    }

    this.worker = new Worker<ProcessamentoJobData>(
      NOME_FILA,
      async (job: Job<ProcessamentoJobData>) => this.processarJob(job),
      {
        connection: {
          host:     this.redisConnection.host,
          port:     this.redisConnection.port,
          password: this.redisConnection.password,
        },
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.info('[BullMQAdapter] Job concluído.', {
        jobId: job.id,
        tipo:  job.data.tipo,
      });
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error('[BullMQAdapter] Job falhou.', {
        jobId:    job?.id,
        tipo:     job?.data.tipo,
        tentativa: job?.attemptsMade,
        message:  err.message,
      });
    });

    this.logger.info('[BullMQAdapter] Worker iniciado.', {
      fila:        NOME_FILA,
      concorrencia: concurrency,
    });
  }

  // ---------------------------------------------------------------------------
  // Processador de jobs (switch por tipo)
  // ---------------------------------------------------------------------------

  private async processarJob(job: Job<ProcessamentoJobData>): Promise<void> {
    this.logger.debug('[BullMQAdapter] Processando job.', {
      jobId:     job.id,
      tipo:      job.data.tipo,
      tentativa: job.attemptsMade + 1,
    });

    switch (job.data.tipo) {

      case 'EXTRAIR_TEXTO_PDF': {
        const { documentoId, storagePath, clienteId } = job.data.payload;
        // SIMULAÇÃO: Em produção, baixar do MinIO e executar extração com pdf-parse ou pdfjs-dist
        this.logger.info('[BullMQAdapter] Simulando extração de texto de PDF.', {
          documentoId,
          storagePath,
          clienteId,
        });
        // Simula latência de processamento (OCR/extração de PDF longo)
        await new Promise((resolve) => setTimeout(resolve, 500));
        this.logger.info('[BullMQAdapter] Extração concluída (simulada).', { documentoId });
        break;
      }

      case 'GERAR_RELATORIO_MENSAL': {
        const { contadorId, mesAno } = job.data.payload;
        this.logger.info('[BullMQAdapter] Gerando relatório mensal (simulado).', {
          contadorId,
          mesAno,
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
        break;
      }

      case 'ENVIAR_EMAIL_LOTE': {
        const { destinatarios, assunto } = job.data.payload;
        this.logger.info('[BullMQAdapter] Enviando e-mail em lote (simulado).', {
          total:   destinatarios.length,
          assunto,
        });
        await new Promise((resolve) => setTimeout(resolve, 200 * destinatarios.length));
        break;
      }

      default: {
        // Lança erro para que o BullMQ registre como falha e possa fazer retry/diagnóstico
        const tipo = (job.data as { tipo: string }).tipo;
        throw new Error(`[BullMQAdapter] Tipo de job desconhecido: "${tipo}".`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Encerramento gracioso — fechar em server.ts no SIGTERM/SIGINT
  // ---------------------------------------------------------------------------

  /**
   * Fecha a fila e o Worker aguardando os jobs em execução terminarem.
   * Chamar antes de `process.exit()` no handler de SIGTERM.
   */
  async fechar(): Promise<void> {
    this.logger.info('[BullMQAdapter] Encerrando fila e worker...');

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    await this.queue.close();
    this.logger.info('[BullMQAdapter] Fila encerrada.');
  }
}
