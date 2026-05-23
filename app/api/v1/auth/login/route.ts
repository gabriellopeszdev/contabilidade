import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

import { prisma }               from '../../../../../src/infrastructure/di/Container';
import { logger }               from '../../../../../src/utils/logger';
import { BcryptPasswordHasher } from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';

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
  // 2. Busca do usuário — tenta Contador primeiro, depois Cliente
  // --------------------------------------------------------------------------
  type UserRole = 'ACCOUNTANT' | 'CLIENT' | 'ADMIN' | 'EMPLOYEE';

  let userId:       string;
  let userName:     string;
  let passwordHash: string;
  let role:         UserRole;
  let avatarUrl:    string | null;
  // Campos extras para EMPLOYEE
  let setores:      string[] | null = null;
  let vinculo:      string | null   = null;
  let superiorId:   string | null   = null;

  try {
    const contador = await prisma.usuarioContador.findFirst({
      where: { email, deletedAt: null, isActive: true },
      select: { id: true, name: true, passwordHash: true, avatarUrl: true, isAdmin: true },
    });

    if (contador) {
      userId       = contador.id;
      userName     = contador.name;
      passwordHash = contador.passwordHash;
      role         = contador.isAdmin ? 'ADMIN' : 'ACCOUNTANT';
      avatarUrl    = contador.avatarUrl;
    } else {
      const cliente = await prisma.usuarioCliente.findFirst({
        where: { email, deletedAt: null, isActive: true },
        select: { id: true, name: true, passwordHash: true, avatarUrl: true, cnpj: true },
      });

      if (!cliente) {
        // Terceira tentativa: Funcionario
        const funcionario = await prisma.funcionario.findFirst({
          where: { email, deletedAt: null, isActive: true },
          select: { id: true, name: true, passwordHash: true, avatarUrl: true, setores: true, vinculo: true, contadorId: true, clienteId: true },
        });

        if (!funcionario) {
          return NextResponse.json(
            { message: 'Credenciais inválidas.' },
            { status: 401 },
          );
        }

        userId       = funcionario.id;
        userName     = funcionario.name;
        passwordHash = funcionario.passwordHash;
        role         = 'EMPLOYEE';
        avatarUrl    = funcionario.avatarUrl;
        setores      = funcionario.setores;
        vinculo      = funcionario.vinculo;
        superiorId   = funcionario.contadorId ?? funcionario.clienteId ?? null;
      } else {
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
      }
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

  const token = await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('8h')
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
  return NextResponse.json(resposta);
  };

