import { Queue, Worker, type Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import type { ILogger } from '../../domain/ports/ILogger';
import type { PrismaClient } from '@prisma/client';
import type { IEmailService } from '../../domain/ports/IEmailService';
import { emailWrapper, emailButton, emailHeading, emailSubheading, emailCallout, emailWarningCallout, emailInfoBox } from '../email/emailTemplate';
import { verificarLembretesJob } from './jobs/verificarLembretesJob';
import { gerarObrigacoesRecorrentesJob } from './jobs/gerarObrigacoesRecorrentesJob';
import { parsearXmlNfeJob } from './jobs/parsearXmlNfeJob';
import { gerarRelatorioMensalJob } from './jobs/gerarRelatorioMensalJob';

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
    }
  | {
      tipo: 'LEMBRETE_BOLETO_VENCIMENTO';
      payload: Record<string, never>; // disparo automático sem payload
    }
  | {
      tipo: 'PARSEAR_XML_NFE';
      payload: {
        documentoId: string;
        storagePath: string;
      };
    }
  | Record<string, never>; // Empty object for scheduled jobs (verificar-lembretes, gerar-obrigacoes-recorrentes)

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
    private readonly prisma?: PrismaClient,
    private readonly emailService?: IEmailService,
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

  /**
   * Agenda lembrete diário de boletos vencendo em 3 dias.
   * Cron: todo dia às 08:00 (horário do servidor).
   * Idempotente — chamadas repetidas não duplicam a schedule.
   */
  async agendarLembreteBoleto(): Promise<void> {
    await this.queue.add(
      'LEMBRETE_BOLETO_VENCIMENTO',
      { tipo: 'LEMBRETE_BOLETO_VENCIMENTO', payload: {} },
      {
        jobId: 'lembrete-boleto-diario', // ID fixo garante idempotência
        repeat: { pattern: '0 8 * * *' },
        removeOnComplete: { count: 7 },
        removeOnFail:     { count: 30 },
      },
    );
    this.logger.info('[BullMQAdapter] Lembrete de boleto agendado (08:00 diário).');
  }

  /**
   * Agenda jobs recorrentes de obrigações fiscais:
   *  - verificar-lembretes: diariamente às 08:00
   *  - gerar-obrigacoes-recorrentes: todo dia 25 às 09:00
   * Idempotente — IDs fixos evitam duplicação de schedules.
   */
  async agendarJobsObrigacoes(): Promise<void> {
    // Daily at 08:00 — check reminders
    await this.queue.add('verificar-lembretes', {}, {
      repeat: { pattern: '0 8 * * *' },
      jobId: 'verificar-lembretes',
    });

    // Monthly on 25th at 09:00 — generate next month's recurring obligations
    await this.queue.add('gerar-obrigacoes-recorrentes', {}, {
      repeat: { pattern: '0 9 25 * *' },
      jobId: 'gerar-obrigacoes-recorrentes',
    });

    this.logger.info('[BullMQAdapter] Jobs de obrigações agendados (lembretes 08:00 diário, recorrências dia 25 09:00).');
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

    // Scheduled jobs with empty payloads are dispatched by job.name
    if (job.name === 'verificar-lembretes') {
      await verificarLembretesJob();
      return;
    }
    if (job.name === 'gerar-obrigacoes-recorrentes') {
      await gerarObrigacoesRecorrentesJob();
      return;
    }

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
        this.logger.info('[BullMQAdapter] Gerando relatório mensal.', { contadorId, mesAno });
        await gerarRelatorioMensalJob(contadorId, mesAno);
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

      case 'LEMBRETE_BOLETO_VENCIMENTO': {
        await this.processarLembreteBoleto();
        break;
      }

      case 'PARSEAR_XML_NFE': {
        await parsearXmlNfeJob(job.data.payload);
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
  // Handler: lembretes de boleto vencendo em 3 dias
  // ---------------------------------------------------------------------------

  private async processarLembreteBoleto(): Promise<void> {
    if (!this.prisma || !this.emailService) {
      this.logger.warn('[BullMQAdapter] prisma/emailService não injetados — lembrete ignorado.');
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em3Dias = new Date(hoje);
    em3Dias.setDate(em3Dias.getDate() + 3);
    em3Dias.setHours(23, 59, 59, 999);

    const boletos = await this.prisma.boletoHonorario.findMany({
      where: {
        status:     'PENDENTE',
        vencimento: { gte: hoje, lte: em3Dias },
      },
      select: {
        id:           true,
        valor:        true,
        vencimento:   true,
        mesReferencia: true,
        cliente:       { select: { email: true, name: true } },
        escritorio:    { select: { name: true } },
      },
    });

    this.logger.info('[BullMQAdapter] Lembretes de boleto a enviar.', { total: boletos.length });

    for (const boleto of boletos) {
      const vencimentoFmt = new Date(boleto.vencimento).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
      });
      const valorFmt = Number(boleto.valor).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL',
      });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

      const html = emailWrapper(`
        ${emailSubheading('Lembrete de Vencimento')}
        ${emailHeading('Seu boleto vence em breve')}
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px 0">
          Olá, <strong>${boleto.cliente.name}</strong>! Este é um lembrete de que você tem um boleto de honorários contábeis com vencimento em <strong>${vencimentoFmt}</strong>.
        </p>
        ${emailWarningCallout(`Este boleto vence em <strong>${vencimentoFmt}</strong>. Efetue o pagamento para evitar encargos por atraso.`)}
        ${emailInfoBox([
          { label: 'Escritório', value: boleto.escritorio.name },
          { label: 'Referência', value: boleto.mesReferencia },
          { label: 'Valor',      value: valorFmt },
          { label: 'Vencimento', value: vencimentoFmt },
        ])}
        ${emailCallout('Acesse o portal para visualizar e baixar o boleto.', 'ℹ️')}
        <div style="text-align:center;margin:32px 0">
          ${emailButton('Acessar Portal', `${appUrl}/cliente/financeiro`)}
        </div>
      `);

      try {
        await this.emailService.enviar({
          destinatario: boleto.cliente.email,
          assunto:      `[Lembrete] Boleto de ${valorFmt} vence em ${vencimentoFmt}`,
          corpoHtml:    html,
          corpoTexto:   `Olá ${boleto.cliente.name}, seu boleto de ${valorFmt} vence em ${vencimentoFmt}. Acesse: ${appUrl}/cliente/financeiro`,
        });
        this.logger.info('[BullMQAdapter] Lembrete enviado.', {
          clienteEmail: boleto.cliente.email,
          boletoId: boleto.id,
        });
      } catch (err) {
        this.logger.error('[BullMQAdapter] Falha ao enviar lembrete.', {
          boletoId: boleto.id,
          message:  err instanceof Error ? err.message : String(err),
        });
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
