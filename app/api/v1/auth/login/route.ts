import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

import { prisma }               from '../../../../../src/infrastructure/di/Container';
import { logger }               from '../../../../../src/utils/logger';
import { BcryptPasswordHasher } from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';
import { checkRateLimit, getClientIp } from '../../../../../src/utils/rateLimiter';

function registrarLogin(userId: string, role: string, ip: string, userAgent: string | null) {
  prisma.auditLog.create({
    data: {
      userId,
      actionType:   'LOGIN',
      resourceType: 'SESSION',
      detailsJson:  { role },
      ipAddress:    ip,
      userAgent,
    },
  }).catch(() => {});
}

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Instâncias (reutilizadas entre requisições — stateless)
// =============================================================================

const hasher = new BcryptPasswordHasher();

// =============================================================================
// POST /api/v1/auth/login
//
// Body (JSON):
//   { "email": "string", "senha": "string" }
//
// Fluxo:
//   1. Busca por email em UsuarioContador (role ACCOUNTANT)
//   2. Se não encontrar, busca em UsuarioCliente (role CLIENT)
//   3. Compara a senha com BcryptPasswordHasher
//   4. Gera JWT (HS256, 8h de expiração) via jose
//   5. Atualiza lastLoginAt no banco
//   6. Retorna token + dados sanitizados do usuário
//
// Respostas:
//   200 OK            → { token, usuario }
//   400 Bad Request   → campo ausente
//   401 Unauthorized  → credenciais inválidas
//   500 Internal      → erro de servidor
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // --------------------------------------------------------------------------
  // 0. Rate limiting — 20 tentativas por IP a cada 15 minutos
  // --------------------------------------------------------------------------
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`login:${ip}`, 20, 15 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(rl.resetInSec),
          'X-RateLimit-Limit':     '20',
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  // --------------------------------------------------------------------------
  // 1. Parse do body
  // --------------------------------------------------------------------------
  let body: { email?: string; senha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: 'Corpo da requisição deve ser JSON válido.' },
      { status: 400 },
    );
  }

  const email = body.email?.trim().toLowerCase();
  const senha = body.senha;

  if (!email || !senha) {
    return NextResponse.json(
      { message: 'Os campos "email" e "senha" são obrigatórios.' },
      { status: 400 },
    );
  }

  // --------------------------------------------------------------------------
  // 1.5. Rate limit por e-mail — 5 tentativas em 15 min (mais restritivo que por IP)
  // --------------------------------------------------------------------------
  const rlEmail = await checkRateLimit(`login:email:${email}`, 5, 15 * 60);
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas para este e-mail. Tente novamente em alguns minutos.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(rlEmail.resetInSec),
          'X-RateLimit-Limit':     '5',
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  // --------------------------------------------------------------------------
  // 2. Busca do usuário — tenta Contador primeiro, depois Cliente
  // --------------------------------------------------------------------------
  type UserRole = 'ACCOUNTANT' | 'CLIENT' | 'ADMIN' | 'EMPLOYEE';

  let userId:       string;
  let userName:     string;
  let passwordHash: string;
  let role:         UserRole;
  let avatarUrl:    string | null;
  let twoFactorEnabled: boolean = false;
  let twoFactorSecret: string | null = null;
  let primeiroLoginEm: Date | null = null;
  // Campos extras para EMPLOYEE
  let setores:      string[] | null = null;
  let vinculo:      string | null   = null;
  let superiorId:   string | null   = null;

  try {
    const [contador, cliente, funcionario] = await Promise.all([
      prisma.usuarioContador.findFirst({
        where: { email, deletedAt: null, isActive: true },
        select: { id: true, name: true, passwordHash: true, avatarUrl: true, isAdmin: true, twoFactorEnabled: true, twoFactorSecret: true, primeiroLoginEm: true },
      }),
      prisma.usuarioCliente.findFirst({
        where: { email, deletedAt: null, isActive: true },
        select: { id: true, name: true, passwordHash: true, avatarUrl: true, cnpj: true, twoFactorEnabled: true, twoFactorSecret: true },
      }),
      prisma.funcionario.findFirst({
        where: { email, deletedAt: null, isActive: true },
        select: { id: true, name: true, passwordHash: true, avatarUrl: true, setores: true, vinculo: true, contadorId: true, clienteId: true },
      }),
    ]);

    if (contador) {
      userId       = contador.id;
      userName     = contador.name;
      passwordHash = contador.passwordHash;
      role         = contador.isAdmin ? 'ADMIN' : 'ACCOUNTANT';
      avatarUrl    = contador.avatarUrl;
      twoFactorEnabled = contador.twoFactorEnabled;
      twoFactorSecret = contador.twoFactorSecret;
      primeiroLoginEm = contador.primeiroLoginEm;
    } else if (cliente) {
      // Conta ainda não ativada (convite pendente)
      if (!cliente.passwordHash) {
        return NextResponse.json(
          { message: 'Conta ainda não ativada. Verifique seu e-mail de convite.' },
          { status: 403 },
        );
      }

      userId       = cliente.id;
      userName     = cliente.name;
      passwordHash = cliente.passwordHash;
      role         = 'CLIENT';
      avatarUrl    = cliente.avatarUrl;
      twoFactorEnabled = cliente.twoFactorEnabled;
      twoFactorSecret = cliente.twoFactorSecret;
    } else if (funcionario) {
      userId       = funcionario.id;
      userName     = funcionario.name;
      passwordHash = funcionario.passwordHash;
      role         = 'EMPLOYEE';
      avatarUrl    = funcionario.avatarUrl;
      setores      = funcionario.setores;
      vinculo      = funcionario.vinculo;
      superiorId   = funcionario.contadorId ?? funcionario.clienteId ?? null;
      twoFactorEnabled = false;
      twoFactorSecret = null;
    } else {
      return NextResponse.json(
        { message: 'Credenciais inválidas.' },
        { status: 401 },
      );
    }
  } catch (err) {
    logger.error('[POST /auth/login] Erro ao buscar usuário', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }

  // --------------------------------------------------------------------------
  // 3. Verificação da senha
  // --------------------------------------------------------------------------
  const senhaValida = await hasher.comparar(senha, passwordHash);

  if (!senhaValida) {
    return NextResponse.json(
      { message: 'Credenciais inválidas.' },
      { status: 401 },
    );
  }

  // --------------------------------------------------------------------------
  // 3.5. Verificação de 2FA — se ativo, retornar tempToken em vez do JWT final
  // --------------------------------------------------------------------------
  if (twoFactorEnabled && twoFactorSecret) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.fatal('[POST /auth/login] JWT_SECRET não configurado');
      return NextResponse.json(
        { message: 'Erro de configuração do servidor.' },
        { status: 500 },
      );
    }

    // Verifica se existe o cookie de "lembrar 2FA" neste dispositivo
    const rememberCookie = request.cookies.get(`fiscohub_2fa_remember_${userId}`)?.value;
    let skip2FA = false;

    if (rememberCookie) {
      try {
        const key = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(rememberCookie, key);
        if (payload.sub === userId && payload.type === '2FA_REMEMBER') {
          skip2FA = true;
        }
      } catch {
        // Token de lembrança expirado ou inválido
      }
    }

    if (!skip2FA) {
      const tempToken = await new SignJWT({
        sub: userId,
        type: 'TEMP_2FA',
        role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode(secret));

      return NextResponse.json({ requires2FA: true, tempToken }, { status: 200 });
    }

    // 2FA lembrado neste dispositivo — login concluído diretamente
    registrarLogin(userId, role, ip, request.headers.get('user-agent'));
  }

  // --------------------------------------------------------------------------
  // 4. Geração do JWT (HS256, 8 horas)
  // --------------------------------------------------------------------------
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.fatal('[POST /auth/login] JWT_SECRET não configurado');
    return NextResponse.json(
      { message: 'Erro de configuração do servidor.' },
      { status: 500 },
    );
  }

  const jwtPayload: Record<string, unknown> = { role, nome: userName };
  if (role === 'EMPLOYEE') {
    jwtPayload.setores    = setores;
    jwtPayload.vinculo    = vinculo;
    jwtPayload.superiorId = superiorId;
  }

  const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
  const token = await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));

  // --------------------------------------------------------------------------
  // 5. Atualiza lastLoginAt (fire-and-forget — não bloqueia resposta)
  // --------------------------------------------------------------------------
  const now = new Date();
  if (role === 'ACCOUNTANT' || role === 'ADMIN') {
    prisma.usuarioContador.update({
      where: { id: userId },
      data:  { lastLoginAt: now },
    }).catch(() => {});
    // Track first login time (fire-and-forget)
    if (!primeiroLoginEm) {
      prisma.usuarioContador.update({
        where: { id: userId },
        data: { primeiroLoginEm: new Date() },
      }).catch(() => {/* non-critical */});
    }
  } else if (role === 'CLIENT') {
    prisma.usuarioCliente.update({
      where: { id: userId },
      data:  { lastLoginAt: now },
    }).catch(() => {});
  } else if (role === 'EMPLOYEE') {
    prisma.funcionario.update({
      where: { id: userId },
      data:  { lastLoginAt: now },
    }).catch(() => {});
  }

  // Login direto (sem 2FA ativo)
  registrarLogin(userId, role, ip, request.headers.get('user-agent'));

  // --------------------------------------------------------------------------
  // 6. Resposta
  // --------------------------------------------------------------------------
  const resposta: Record<string, unknown> = {
    token,
    usuario: {
      id:   userId,
      nome: userName,
      email,
      role,
      avatarUrl,
    },
  };
  if (role === 'EMPLOYEE') {
    (resposta.usuario as Record<string, unknown>).setores    = setores;
    (resposta.usuario as Record<string, unknown>).vinculo    = vinculo;
    (resposta.usuario as Record<string, unknown>).superiorId = superiorId;
  }
  const response = NextResponse.json(resposta);
  response.cookies.set('fiscohub_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   60 * 60 * 8, // 8 horas (igual ao JWT_EXPIRES_IN padrão)
  });
  return response;
  };

