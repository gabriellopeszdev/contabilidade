import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import type { Server as NodeHttpServer } from 'node:http';
import Redis, { type RedisOptions } from 'ioredis';
import { jwtVerify } from 'jose';
import type { PrismaClient } from '@prisma/client';

import { REDIS_DOMAIN_EVENTS_CHANNEL } from '../events/RedisEventDispatcher';
import type { DomainEvent } from '../../shared/DomainEvent';
import type { ILogger } from '../../domain/ports/ILogger';
import { NotificacaoService } from '../notifications/NotificacaoService';
import { PushService } from '../notifications/PushService';

// =============================================================================
// Tipos — garantem que o payload emitido ao cliente seja tipado end-to-end
// =============================================================================

/** Dados autenticados armazenados em cada conexão WebSocket. */
interface SocketData {
  userId: string;
  role:   'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
}

/** Payloads dos eventos que o servidor EMITE para os clientes. */
interface ServerToClientEvents {
  /** Disparado ao contador após conclusão do upload em lote. */
  novoDocumentoUpload: (payload: {
    loteId:          string;
    clienteId:       string;
    totalUploadados: number;
    totalFalhas:     number;
    mensagem:        string;
  }) => void;

  /** Disparado ao destinatário quando alguém visualiza um documento pela 1ª vez. */
  documentoVisualizado: (payload: {
    documentoId: string;
    clienteId:   string;
    nomeArquivo: string;
    sector:      string;
    mensagem:    string;
  }) => void;

  /** Disparado ao cliente quando um novo boleto de honorário é gerado. */
  novoBoletoHonorario: (payload: {
    boletoId:      string;
    clienteId:     string;
    mesReferencia: string;
    valor:         number;
    vencimento:    string;
    mensagem:      string;
  }) => void;

  /** Nova mensagem de chat recebida. */
  chat_message: (payload: {
    id:         string;
    roomId:     string;
    senderId:   string;
    senderType: string;
    senderNome: string;
    content:    string;
    documentId: string | null;
    createdAt:  string;
  }) => void;

  /** Indicador de digitação. */
  chat_typing: (payload: {
    roomId:     string;
    userId:     string;
    nome:       string;
    isTyping:   boolean;
  }) => void;

  /** Notificação de nova mensagem de chat (para o sininho). */
  chat_notification: (payload: {
    roomId:     string;
    senderNome: string;
    preview:    string;
  }) => void;

  /** Disparado quando uma nova notificação in-app é persistida. */
  nova_notificacao: (payload: {
    id:        string;
    tipo:      string;
    titulo:    string;
    mensagem:  string;
    createdAt: string;
  }) => void;

  /** Disparado ao contador quando um cliente ativa a conta. */
  cliente_ativado: (payload: { clienteId: string }) => void;

  /** Disparado ao cliente quando um novo comunicado é publicado. */
  novo_comunicado: (payload: {
    comunicadoId: string;
    titulo:       string;
    contadorNome: string;
  }) => void;
}

/** Eventos que o CLIENT envia ao servidor. */
interface ClientToServerEvents {
  join_room:      (roomId: string) => void;
  leave_room:     (roomId: string) => void;
  send_message:   (data: { roomId: string; content: string; documentId?: string }, callback: (resp: { ok: boolean; message?: unknown; error?: string }) => void) => void;
  typing_status:  (data: { roomId: string; isTyping: boolean }) => void;
}

// =============================================================================
// SocketServer
//
// Servidor WebSocket que roteia Eventos de Domínio (via Redis Pub/Sub) para
// os clientes conectados corretos, usando rooms Socket.IO.
//
// ARQUITETURA DO FLUXO DE NOTIFICAÇÕES:
//
//   Use Case
//     └─► RedisEventDispatcher.dispatch(event)
//           └─► redis.PUBLISH("contabilidade:domain:events", json)
//                 └─► [SocketServer] subscriber Redis recebe a mensagem
//                       └─► roteaEvento(event)
//                             └─► io.to("user:{userId}").emit(...)
//                                   └─► browser do contador / cliente
//
// ROOMS:
//   Cada usuário autenticado entra automaticamente na room "user:{userId}".
//   O roteamento de eventos usa o ID do destinatário para encontrar a room.
//   Um usuário pode ter múltiplas abas abertas — todas na mesma room, todas
//   recebem o evento simultaneamente.
//
// REDIS SUBSCRIBER:
//   PRECISA de uma conexão DEDICADA. Conexões em modo SUBSCRIBE no Redis
//   só aceitam comandos de pub/sub (SUBSCRIBE, UNSUBSCRIBE, PSUBSCRIBE).
//   Por isso criamos um novo cliente Redis aqui, separado do redisPublisher.
//
// INTEGRAÇÃO COM NEXT.JS (server.ts na raiz do projeto):
//
//   import next from 'next';
//   import { createServer } from 'node:http';
//   import { SocketServer } from './src/infrastructure/websockets/SocketServer';
//
//   const app  = next({ dev: process.env.NODE_ENV !== 'production' });
//   const handler = app.getRequestHandler();
//
//   app.prepare().then(() => {
//     const httpServer = createServer(handler);
//     const socketServer = new SocketServer(httpServer, {
//       host:     process.env.REDIS_HOST     ?? 'localhost',
//       port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
//       password: process.env.REDIS_PASSWORD,
//     });
//
//     httpServer.listen(3000, () => {
//       console.info('Servidor rodando em http://localhost:3000');
//     });
//
//     process.on('SIGTERM', async () => {
//       await socketServer.fechar();
//       process.exit(0);
//     });
//   });
// =============================================================================

export class SocketServer {
  private readonly io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >;
  private readonly subscriber: Redis;
  private readonly jwtSecret: Uint8Array;
  private readonly logger: ILogger;
  private readonly db: PrismaClient;
  private readonly notificacaoSvc: NotificacaoService | null;
  private readonly pushSvc: PushService | null;

  constructor(
    httpServer: NodeHttpServer,
    redisConfig: Pick<RedisOptions, 'host' | 'port' | 'password'>,
    logger: ILogger,
    db?: PrismaClient,
  ) {
    this.logger = logger;
    this.db = db as PrismaClient;
    this.notificacaoSvc = db ? new NotificacaoService(db, logger) : null;
    this.pushSvc = db ? new PushService(db, logger) : null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const isDev = process.env.NODE_ENV !== 'production';

    this.io = new SocketIOServer(httpServer, {
      // Path distinto de "/socket.io" para evitar conflito com outras libs
      path: '/api/ws',
      addTrailingSlash: false,
      cors: {
        origin:      isDev ? '*' : appUrl,
        methods:     ['GET', 'POST'],
        credentials: !isDev,
      },
      // Em self-hosted com nginx que suporta WebSocket, desabilitar long-polling
      // melhora performance e simplifica o proxy reverso (sem sticky sessions).
      transports: ['websocket'],
      pingTimeout:  20_000,
      pingInterval: 25_000,
      // Tamanho máximo de mensagem: protege contra payloads maliciosos
      maxHttpBufferSize: 1_024 * 64, // 64 KB (eventos de domínio são pequenos)
    });

    // Subscriber dedicado — não pode ser o mesmo cliente do publisher
    this.subscriber = new Redis({
      ...redisConfig,
      // Subscriber deve reconectar indefinidamente (null = sem limite)
      maxRetriesPerRequest: null,
      enableReadyCheck:     false,
      lazyConnect:          false,
      retryStrategy: (times: number) => Math.min(times * 200, 5_000),
    });

    this.jwtSecret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? '',
    );

    this.configurarMiddlewareAuth();
    this.configurarEventosConexao();
    this.iniciarEscutaRedis();

    this.logger.info('[SocketServer] Iniciado.', {
      path:        '/api/ws',
      canalRedis:  REDIS_DOMAIN_EVENTS_CHANNEL,
    });
  }

  // ---------------------------------------------------------------------------
  // Middleware de autenticação WebSocket
  //
  // O cliente envia o JWT no handshake:
  //   socket = io(url, { auth: { token: "Bearer eyJ..." } })
  //
  // A verificação usa a mesma lógica do route handler HTTP — mesma chave,
  // mesmo algoritmo. Qualquer token válido para a API REST também é válido
  // para o WebSocket.
  // ---------------------------------------------------------------------------

  private configurarMiddlewareAuth(): void {
    this.io.use(async (socket, next) => {
      const rawToken = socket.handshake.auth?.token as string | undefined;

      if (!rawToken) {
        return next(new Error('WS_UNAUTHORIZED: token ausente'));
      }

      // Suporta tanto "Bearer eyJ..." quanto o token direto
      const token = rawToken.startsWith('Bearer ')
        ? rawToken.slice(7)
        : rawToken;

      if (!process.env.JWT_SECRET) {
        this.logger.error('[SocketServer] JWT_SECRET não configurado.');
        return next(new Error('WS_SERVER_ERROR: configuração inválida'));
      }

      try {
        const { payload } = await jwtVerify(token, this.jwtSecret, {
          algorithms: ['HS256'],
        });

        socket.data.userId = payload.sub as string;
        socket.data.role   = (payload as { role: string }).role as SocketData['role'];

        return next();
      } catch {
        return next(new Error('WS_UNAUTHORIZED: token inválido ou expirado'));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Gerenciamento de conexões e rooms
  //
  // Room naming: "user:{userId}"
  //   - Cada usuário tem uma room privada com seu ID
  //   - Múltiplas abas do mesmo usuário → todos os sockets na mesma room
  //   - io.to("user:xyz").emit(...) entrega para todas as abas simultaneamente
  // ---------------------------------------------------------------------------

  private configurarEventosConexao(): void {
    this.io.on(
      'connection',
      (
        socket: Socket<
          ClientToServerEvents,
          ServerToClientEvents,
          Record<string, never>,
          SocketData
        >,
      ) => {
        const { userId, role } = socket.data;
        const room = `user:${userId}`;

        socket.join(room);
        this.logger.info('[SocketServer] Conectado.', { userId, role, socketId: socket.id, room });

        // -----------------------------------------------------------------
        // Chat: join_room — entra na room do chat para receber mensagens
        // -----------------------------------------------------------------
        socket.on('join_room', (roomId: string) => {
          socket.join(`chat:${roomId}`);
          this.logger.info('[SocketServer] join_room', { userId, roomId });
        });

        // -----------------------------------------------------------------
        // Chat: leave_room
        // -----------------------------------------------------------------
        socket.on('leave_room', (roomId: string) => {
          socket.leave(`chat:${roomId}`);
          this.logger.info('[SocketServer] leave_room', { userId, roomId });
        });

        // -----------------------------------------------------------------
        // Chat: send_message — persiste no BD e emite para a room
        // -----------------------------------------------------------------
        socket.on('send_message', async (data, callback) => {
          try {
            if (!this.db) {
              callback({ ok: false, error: 'Banco de dados indisponível' });
              return;
            }

            const { roomId, content, documentId } = data;

            if (!content || content.trim().length === 0 || content.length > 2000) {
              callback({ ok: false, error: 'Conteúdo inválido (1-2000 caracteres)' });
              return;
            }

            // Verifica se a room existe e obtém clienteId
            const chatRoom = await this.db.chatRoom.findUnique({
              where: { id: roomId },
              select: { id: true, clienteId: true },
            });

            if (!chatRoom) {
              callback({ ok: false, error: 'Sala não encontrada' });
              return;
            }

            // Determina senderType
            const senderType = role === 'CLIENT' ? 'CLIENTE' : 'CONTADOR';

            // Busca nome do remetente
            let senderNome = 'Usuário';
            if (role === 'CLIENT') {
              const cliente = await this.db.usuarioCliente.findUnique({
                where: { id: userId },
                select: { name: true },
              });
              senderNome = cliente?.name ?? 'Cliente';
            } else {
              const contador = await this.db.usuarioContador.findUnique({
                where: { id: userId },
                select: { name: true },
              });
              senderNome = contador?.name ?? 'Contador';
            }

            // Persiste a mensagem
            const mensagem = await this.db.chatMessage.create({
              data: {
                roomId,
                senderId:   userId,
                senderType,
                content:    content.trim(),
                documentId: documentId ?? null,
              },
            });

            const payload = {
              id:         mensagem.id,
              roomId,
              senderId:   userId,
              senderType,
              senderNome,
              content:    mensagem.content,
              documentId: mensagem.documentId,
              createdAt:  mensagem.createdAt.toISOString(),
            };

            // Emite para todos na room do chat (incluindo o remetente)
            this.io.to(`chat:${roomId}`).emit('chat_message', payload);

            // Notificação para o destinatário que NÃO está na room do chat
            // (ele está na room user:{id}, mas talvez não em chat:{roomId})
            const recipientId = role === 'CLIENT'
              // Cliente enviou → notifica todos os contadores vinculados
              ? null
              // Contador enviou → notifica o cliente dono da room
              : chatRoom.clienteId;

            if (recipientId) {
              // Verifica se o destinatário está na room do chat
              const socketsNaRoom = await this.io.in(`chat:${roomId}`).fetchSockets();
              const destinatarioPresente = socketsNaRoom.some(
                (s) => s.data.userId === recipientId,
              );

              if (!destinatarioPresente) {
                const preview = content.trim().slice(0, 80);
                this.io.to(`user:${recipientId}`).emit('chat_notification', {
                  roomId,
                  senderNome,
                  preview,
                });
                if (this.pushSvc) {
                  void this.pushSvc.enviarParaUsuario(recipientId, {
                    title: 'Nova mensagem no chat',
                    body:  `${senderNome}: ${preview}`,
                    url:   '/chat',
                  });
                }
              }
            }

            callback({ ok: true, message: payload });
          } catch (err) {
            this.logger.error('[SocketServer] send_message erro', err instanceof Error ? err : { err });
            callback({ ok: false, error: 'Erro interno ao enviar mensagem' });
          }
        });

        // -----------------------------------------------------------------
        // Chat: typing_status — repassa indicador de digitação para a room
        // -----------------------------------------------------------------
        socket.on('typing_status', async (data) => {
          const { roomId, isTyping } = data;

          let nome = 'Usuário';
          if (this.db) {
            if (role === 'CLIENT') {
              const c = await this.db.usuarioCliente.findUnique({
                where: { id: userId }, select: { name: true },
              });
              nome = c?.name ?? 'Cliente';
            } else {
              const c = await this.db.usuarioContador.findUnique({
                where: { id: userId }, select: { name: true },
              });
              nome = c?.name ?? 'Contador';
            }
          }

          // Emite para todos na room EXCETO o remetente
          socket.to(`chat:${roomId}`).emit('chat_typing', {
            roomId,
            userId,
            nome,
            isTyping,
          });
        });

        socket.on('disconnect', (reason) => {
          this.logger.info('[SocketServer] Desconectado.', { userId, socketId: socket.id, reason });
          socket.leave(room);
        });

        socket.on('error', (err) => {
          this.logger.error('[SocketServer] Erro no socket.', { socketId: socket.id, userId, message: err.message });
        });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Escuta Redis — recebe eventos de domínio e roteia para rooms
  // ---------------------------------------------------------------------------

  private iniciarEscutaRedis(): void {
    this.subscriber.subscribe(REDIS_DOMAIN_EVENTS_CHANNEL, (err) => {
      if (err) {
        this.logger.error('[SocketServer] Falha ao subscrever ao canal Redis.', { canal: REDIS_DOMAIN_EVENTS_CHANNEL, message: err.message });
      } else {
        this.logger.info('[SocketServer] Subscrito ao canal Redis.', { canal: REDIS_DOMAIN_EVENTS_CHANNEL });
      }
    });

    this.subscriber.on('message', (_channel: string, message: string) => {
      let event: DomainEvent & Record<string, unknown>;
      try {
        event = JSON.parse(message) as DomainEvent & Record<string, unknown>;
      } catch (err) {
        this.logger.error('[SocketServer] Evento Redis malformado (JSON inválido).', err instanceof Error ? err : { err });
        return;
      }
      this.roteaEvento(event);
    });

    this.subscriber.on('error', (err: Error) => {
      this.logger.error('[SocketServer] Redis subscriber erro.', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Roteamento de eventos de domínio → rooms Socket.IO
  //
  // IMPORTANTE — getters não sobrevivem a JSON.parse:
  //   NovoDocumentoUploadEvent tem getters (sucesso, sucessoParcial, totalArquivos)
  //   definidos no prototype. JSON.stringify serializa apenas propriedades de instância.
  //   Após JSON.parse, temos um plain object — os getters são RECALCULADOS AQUI
  //   a partir das propriedades brutas (uploadados[], falhas[]).
  // ---------------------------------------------------------------------------

  private roteaEvento(event: DomainEvent & Record<string, unknown>): void {
    switch (event.eventName) {

      case 'NovoDocumentoUploadEvent': {
        const uploadados = (event.uploadados as unknown[]) ?? [];
        const falhas     = (event.falhas     as unknown[]) ?? [];
        const contadorId = event.contadorId  as string | undefined;
        const clienteId  = event.clienteId   as string | undefined;

        if (!contadorId) break;

        const total = uploadados.length + falhas.length;
        let mensagemContador: string;

        if (falhas.length === 0 && uploadados.length > 0) {
          mensagemContador = `Upload concluído: ${uploadados.length} documento(s) enviado(s) com sucesso.`;
        } else if (uploadados.length > 0) {
          mensagemContador = `Upload parcial: ${uploadados.length} de ${total} enviados. ${falhas.length} falha(s).`;
        } else {
          mensagemContador = `Upload falhou: nenhum documento foi salvo. ${falhas.length} erro(s).`;
        }

        this.io.to(`user:${contadorId}`).emit('novoDocumentoUpload', {
          loteId:          (event.loteId   as string) ?? '',
          clienteId:       clienteId ?? '',
          totalUploadados: uploadados.length,
          totalFalhas:     falhas.length,
          mensagem:        mensagemContador,
        });

        void this.persistirEEmitir(contadorId, 'CONTADOR', {
          tipo:     'UPLOAD_DOCUMENTOS',
          titulo:   'Upload de documentos',
          mensagem: mensagemContador,
        });

        // Notifica o CLIENTE sobre os documentos recebidos
        if (clienteId && uploadados.length > 0) {
          const mensagemCliente = uploadados.length === 1
            ? 'Seu escritório enviou 1 novo documento para você.'
            : `Seu escritório enviou ${uploadados.length} novos documentos para você.`;

          this.io.to(`user:${clienteId}`).emit('novoDocumentoUpload', {
            loteId:          (event.loteId as string) ?? '',
            clienteId,
            totalUploadados: uploadados.length,
            totalFalhas:     falhas.length,
            mensagem:        mensagemCliente,
          });

          void this.persistirEEmitir(clienteId, 'CLIENTE', {
            tipo:     'NOVO_DOCUMENTO_RECEBIDO',
            titulo:   'Novos documentos recebidos',
            mensagem: mensagemCliente,
            metadados: {
              loteId:          (event.loteId as string) ?? '',
              totalDocumentos: uploadados.length,
              sector:          (event.sector as string) ?? '',
            },
          });
        }
        break;
      }

      case 'DocumentoVisualizadoEvent': {
        const contadorResponsavelId = event.contadorResponsavelId as string | null;
        const clienteId = event.clienteId as string;
        const visualizadoPorId = event.visualizadoPorId as string | undefined;
        const visualizadoPorRole = event.visualizadoPorRole as string | undefined;

        let destinatarioId: string | null;
        let destinatarioTipo: 'CONTADOR' | 'CLIENTE';
        let mensagem: string;

        if (visualizadoPorRole === 'CLIENT') {
          destinatarioId   = contadorResponsavelId;
          destinatarioTipo = 'CONTADOR';
          mensagem = `"${(event.nomeArquivo as string) ?? ''}" foi visualizado pelo cliente`;
        } else {
          destinatarioId   = clienteId;
          destinatarioTipo = 'CLIENTE';
          mensagem = `"${(event.nomeArquivo as string) ?? ''}" foi visualizado pelo escritório`;
        }

        if (!destinatarioId || destinatarioId === visualizadoPorId) break;

        this.io.to(`user:${destinatarioId}`).emit('documentoVisualizado', {
          documentoId: (event.documentoId as string) ?? '',
          clienteId:   clienteId ?? '',
          nomeArquivo: (event.nomeArquivo  as string) ?? '',
          sector:      (event.sector       as string) ?? '',
          mensagem,
        });

        void this.persistirEEmitir(destinatarioId, destinatarioTipo, {
          tipo:     'DOCUMENTO_VISUALIZADO',
          titulo:   'Documento visualizado',
          mensagem,
        });
        break;
      }

      case 'NovoBoletoHonorarioEvent': {
        const clienteId     = event.clienteId     as string | undefined;
        const boletoId      = event.boletoId      as string | undefined;
        const mesReferencia = event.mesReferencia  as string | undefined;
        const valor         = event.valor          as number | undefined;
        const vencimento    = event.vencimento     as string | undefined;
        const mensagem      = (event.mensagem as string | undefined) ?? 'Novo boleto de honorários disponível.';

        if (!clienteId) break;

        this.io.to(`user:${clienteId}`).emit('novoBoletoHonorario', {
          boletoId:      boletoId      ?? '',
          clienteId,
          mesReferencia: mesReferencia ?? '',
          valor:         valor         ?? 0,
          vencimento:    vencimento    ?? '',
          mensagem,
        });

        void this.persistirEEmitir(clienteId, 'CLIENTE', {
          tipo:     'NOVO_BOLETO',
          titulo:   'Novo boleto de honorários',
          mensagem,
          metadados: { boletoId, mesReferencia, valor, vencimento },
        });
        break;
      }

      case 'ClienteAtivadoEvent': {
        const contadorId = event.contadorId as string | undefined;
        const clienteId  = event.clienteId  as string | undefined;
        if (!contadorId || !clienteId) break;
        this.io.to(`user:${contadorId}`).emit('cliente_ativado', { clienteId });
        break;
      }

      case 'NovoComunicadoEvent': {
        const comunicadoId = event.comunicadoId as string | undefined;
        const titulo       = event.titulo       as string | undefined;
        const contadorNome = event.contadorNome as string | undefined;
        const clienteIds   = (event.clienteIds  as string[] | undefined) ?? [];

        if (!comunicadoId || !titulo) break;

        for (const clienteId of clienteIds) {
          this.io.to(`user:${clienteId}`).emit('novo_comunicado', {
            comunicadoId,
            titulo,
            contadorNome: contadorNome ?? '',
          });

          void this.persistirEEmitir(clienteId, 'CLIENTE', {
            tipo:     'COMUNICADO',
            titulo:   `Novo informativo: ${titulo}`,
            mensagem: `Seu contador publicou um novo comunicado.`,
            metadados: { comunicadoId },
          });
        }
        break;
      }

      case 'AvisoAdminEvent': {
        const notificacoes = (event.notificacoes as Array<{ contadorId: string; notifId: string }> | undefined) ?? [];
        const titulo       = event.titulo   as string | undefined;
        const mensagem     = event.mensagem as string | undefined;
        if (!titulo || !mensagem) break;
        for (const { contadorId, notifId } of notificacoes) {
          this.io.to(`user:${contadorId}`).emit('nova_notificacao', {
            id:        notifId,
            tipo:      'AVISO_ADMIN',
            titulo,
            mensagem,
            createdAt: new Date().toISOString(),
          });
        }
        break;
      }

      default:
        // Evento desconhecido: ignora silenciosamente (forward-compatible).
        // Se novos eventos forem adicionados sem atualizar o SocketServer,
        // eles simplesmente não serão roteados — sem quebrar os demais.
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Persiste notificação no banco e emite nova_notificacao via WS
  // ---------------------------------------------------------------------------

  private async persistirEEmitir(
    userId: string,
    userType: 'CONTADOR' | 'CLIENTE',
    data: { tipo: string; titulo: string; mensagem: string; metadados?: Record<string, unknown> },
  ): Promise<void> {
    if (!this.notificacaoSvc) return;
    const id = await this.notificacaoSvc.criar({ userId, userType, ...data });
    if (!id) return;
    this.io.to(`user:${userId}`).emit('nova_notificacao', {
      id,
      tipo:      data.tipo,
      titulo:    data.titulo,
      mensagem:  data.mensagem,
      createdAt: new Date().toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // Encerramento gracioso — chamado no SIGTERM / SIGINT do server.ts
  //
  // Aguarda todas as conexões ativas serem fechadas antes de destruir o servidor.
  // ---------------------------------------------------------------------------

  async fechar(): Promise<void> {
    this.logger.info('[SocketServer] Iniciando encerramento gracioso...');

    await new Promise<void>((resolve, reject) =>
      this.io.close((err) => (err ? reject(err) : resolve())),
    );

    this.subscriber.disconnect();
    this.logger.info('[SocketServer] Encerrado com sucesso.');
  }
}
