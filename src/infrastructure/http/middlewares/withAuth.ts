import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

// =============================================================================
// withAuth — Higher-Order Function de Autenticação para o App Router
//
// OBJETIVO:
//   Eliminar o código de verificação JWT duplicado em cada route handler.
//   Envolve o handler em uma camada que verifica o token antes de delegar.
//
// USO BÁSICO:
//   export const GET = withAuth(async (req, ctx, auth) => {
//     return NextResponse.json({ userId: auth.sub });
//   });
//
// COM RESTRIÇÃO DE ROLE:
//   export const POST = withAuth(async (req, ctx, auth) => {
//     // Só contadores chegam aqui
//     return NextResponse.json({ ok: true });
//   }, ['ACCOUNTANT']);
//
// ASSINATURA DO HANDLER ENCAPSULADO:
//   (req: NextRequest, ctx: RouteContext, auth: AuthPayload) => Promise<NextResponse>
//
// FLUXO:
//   1. Extrai "Authorization: Bearer <token>" do header
//   2. Verifica assinatura HS256 com JWT_SECRET
//   3. (Opcional) Verifica se o role está na lista `allowedRoles`
//   4. Injeta o payload verificado como 3º argumento no handler
//   5. Responde 401/403 sem chamar o handler se qualquer etapa falhar
// =============================================================================

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Contexto de rota do App Router — suporta rotas dinâmicas com [param]. */
export interface RouteContext {
  params: Record<string, string> | Promise<Record<string, string>>;
}

/** Role codificado dentro do JWT. */
export type UserRole = 'CLIENT' | 'ACCOUNTANT' | 'ADMIN' | 'EMPLOYEE';

/** Payload extraído do JWT após verificação bem-sucedida. */
export interface AuthPayload {
  /** UUID do usuário (claim `sub` do JWT). */
  sub:  string;
  role: UserRole;
  /** Nome do usuário (campo personalizado no JWT, opcional). */
  nome?: string;
  /** Setores autorizados (apenas EMPLOYEE). */
  setores?: string[];
  /** Tipo de vínculo: ESCRITORIO ou CLIENTE (apenas EMPLOYEE). */
  vinculo?: string;
  /** ID do superior hierárquico (apenas EMPLOYEE). */
  superiorId?: string;
}

/** Contexto com params já resolvidos (pós-await no withAuth). */
export interface ResolvedRouteContext {
  params: Record<string, string>;
}

/** Tipo do handler que recebe o contexto de autenticação injetado. */
export type AuthenticatedHandler = (
  req:  NextRequest,
  ctx:  ResolvedRouteContext,
  auth: AuthPayload,
) => Promise<NextResponse>;

// ---------------------------------------------------------------------------
// Chave JWT — lazily instanciada (evita falha no build time do Next.js)
// ---------------------------------------------------------------------------

let _jwtKey: Uint8Array | null = null;

function getJwtKey(): Uint8Array {
  if (_jwtKey) return _jwtKey;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[withAuth] JWT_SECRET não está configurada.');
  }

  _jwtKey = new TextEncoder().encode(secret);
  return _jwtKey;
}

// ---------------------------------------------------------------------------
// Higher-Order Function
// ---------------------------------------------------------------------------

/**
 * Envolve um route handler do Next.js App Router com verificação JWT.
 *
 * @param handler   Handler autenticado — recebe `(req, ctx, auth)`.
 * @param allowedRoles Lista de roles permitidos. Se omitido, qualquer role válido é aceito.
 * @returns Handler compatível com a convenção `export const GET = ...` do App Router.
 */
export function withAuth(
  handler:      AuthenticatedHandler,
  allowedRoles?: UserRole[],
) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse> => {

    // -----------------------------------------------------------------------
    // 1. Extração do token — header Authorization ou cookie httpOnly
    // -----------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    let token: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim() || null;
    }

    if (!token) {
      token = req.cookies.get('fiscohub_token')?.value ?? null;
    }

    if (!token) {
      return NextResponse.json(
        { message: 'Token de autorização ausente. Faça login para continuar.' },
        { status: 401 },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Verificação JWT
    // -----------------------------------------------------------------------
    let jwtKey: Uint8Array;
    try {
      jwtKey = getJwtKey();
    } catch {
      return NextResponse.json(
        { message: 'Erro de configuração do servidor.' },
        { status: 500 },
      );
    }

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(token, jwtKey, { algorithms: ['HS256'] });
      payload = result.payload;
    } catch {
      return NextResponse.json(
        { message: 'Token inválido ou expirado. Faça login novamente.' },
        { status: 401 },
      );
    }

    // -----------------------------------------------------------------------
    // 3. Extração e validação do payload
    // -----------------------------------------------------------------------
    const sub  = payload.sub;
    const role = (payload as Record<string, unknown>).role as UserRole | undefined;

    if (!sub || !role) {
      return NextResponse.json(
        { message: 'Token com formato inválido.' },
        { status: 401 },
      );
    }

    // -----------------------------------------------------------------------
    // 4. Verificação de role (RBAC simples)
    // -----------------------------------------------------------------------
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return NextResponse.json(
        {
          message: `Acesso negado. Role "${role}" não tem permissão para este recurso.`,
          allowedRoles,
        },
        { status: 403 },
      );
    }

    // -----------------------------------------------------------------------
    // 5. Delegação ao handler com o contexto de auth injetado
    // -----------------------------------------------------------------------
    const auth: AuthPayload = {
      sub,
      role,
      nome:       (payload as Record<string, unknown>).nome       as string   | undefined,
      setores:    (payload as Record<string, unknown>).setores    as string[] | undefined,
      vinculo:    (payload as Record<string, unknown>).vinculo    as string   | undefined,
      superiorId: (payload as Record<string, unknown>).superiorId as string   | undefined,
    };

    // Next.js 14.2.x+ retorna params como Promise (migração para v15).
    // Resolvemos aqui para que todos os handlers recebam params síncronos.
    const resolvedParams = await Promise.resolve(ctx.params);

    return handler(req, { params: resolvedParams }, auth);
  };
}
