import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// =============================================================================
// Middleware de Proteção de Rotas
//
// Intercepta navegação client-side e server-side para garantir:
//   1. Rotas /(contador)/* só são acessíveis por ACCOUNTANT/ADMIN
//   2. Rotas /(cliente)/* só são acessíveis por CLIENT
//   3. Usuários não autenticados são redirecionados para /
//
// IMPORTANTE:
//   Next.js App Router route groups ((cliente), (contador)) não aparecem
//   no pathname da URL. As rotas reais são /documentos, /enviar (cliente)
//   e /dashboard, /lote, /clientes, /configuracoes (contador).
//
// EDGE RUNTIME:
//   Este middleware roda no Edge Runtime. `jose` é compatível (sem Node.js APIs).
//   A chave JWT é lazy-loaded e cacheada no escopo do módulo.
// =============================================================================

const ROTAS_ADMIN    = ['/dashboard-admin', '/contadores', '/faturamento', '/admin-config', '/webhook-logs', '/admin-boletos', '/admin-clientes', '/auditoria'];
const ROTAS_CONTADOR = ['/dashboard', '/lote', '/clientes', '/configuracoes', '/calendario', '/equipe', '/busca', '/assinaturas'];
const ROTAS_CLIENTE  = ['/documentos', '/enviar', '/ajuda'];
const ROTAS_COMPARTILHADAS = ['/chat', '/financeiro'];

// Rotas que funcionários do escritório NÃO podem acessar (exclusivas do dono)
const ROTAS_DONO_CONTADOR = ['/configuracoes', '/equipe'];

const TOKEN_COOKIE   = 'contabilidade_jwt';
const TOKEN_KEY_LS   = 'contabilidade_jwt';

let _jwtKey: Uint8Array | null = null;

function getJwtKey(): Uint8Array | null {
  if (_jwtKey) return _jwtKey;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  _jwtKey = new TextEncoder().encode(secret);
  return _jwtKey;
}

function matchesRoutes(pathname: string, routes: string[]): boolean {
  return routes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Modo manutenção — bloqueia acesso de não-admins
  if (process.env.MAINTENANCE_MODE === 'true') {
    const isPublic =
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/manutencao' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/v1/auth/') ||
      pathname.startsWith('/api/v1/assinatura') ||
      pathname.startsWith('/assinar') ||
      pathname.startsWith('/auth/');

    if (!isPublic) {
      const key = getJwtKey();
      let isAdmin = false;
      if (key) {
        const authHeader = request.headers.get('Authorization');
        let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) token = request.cookies.get('contabilidade_jwt')?.value ?? null;
        if (token) {
          try {
            const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
            const r = (payload as Record<string, unknown>).role as string;
            isAdmin = r === 'ADMIN' || r === 'ACCOUNTANT' || r === 'EMPLOYEE';
          } catch { /* invalid token */ }
        }
      }
      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = '/manutencao';
        return NextResponse.redirect(url);
      }
    }
  }

  // Ignora rotas que não precisam de proteção
  const isProtected =
    matchesRoutes(pathname, ROTAS_ADMIN)    ||
    matchesRoutes(pathname, ROTAS_CONTADOR) ||
    matchesRoutes(pathname, ROTAS_CLIENTE)  ||
    matchesRoutes(pathname, ROTAS_COMPARTILHADAS);

  if (!isProtected) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // Extrair token — tenta Authorization header → cookie
  // (O front via fetch envia header; navegação direta usa cookie se disponível)
  // -------------------------------------------------------------------------
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    token = request.cookies.get(TOKEN_COOKIE)?.value ?? null;
  }

  // Sem token → redireciona para login
  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // -------------------------------------------------------------------------
  // Verificar JWT
  // -------------------------------------------------------------------------
  const key = getJwtKey();
  if (!key) {
    // Sem JWT_SECRET configurado — permite (o withAuth da API vai barrar)
    return NextResponse.next();
  }

  let role: string | undefined;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    role = (payload as Record<string, unknown>).role as string | undefined;
  } catch {
    // Token inválido/expirado — redireciona para login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // -------------------------------------------------------------------------
  // Verificar permissão por role
  // -------------------------------------------------------------------------
  const isAdmin    = role === 'ADMIN';
  const isContador = role === 'ACCOUNTANT';
  const isCliente  = role === 'CLIENT';
  const isEmployee = role === 'EMPLOYEE';

  // Funcionário com vínculo ESCRITORIO → acessa rotas de contador
  // Funcionário com vínculo CLIENTE    → acessa rotas de cliente
  let vinculo: string | undefined;
  if (isEmployee) {
    try {
      const { payload } = await jwtVerify(token!, key, { algorithms: ['HS256'] });
      vinculo = (payload as Record<string, unknown>).vinculo as string | undefined;
    } catch { /* já verificado acima */ }
  }
  const isEmployeeEscritorio = isEmployee && vinculo === 'ESCRITORIO';
  const isEmployeeCliente    = isEmployee && vinculo === 'CLIENTE';

  // ---- Rotas /contadores, /faturamento, /admin-config — exclusivas para ADMIN ----
  if (matchesRoutes(pathname, ROTAS_ADMIN)) {
    if (!isAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = isCliente ? '/documentos' : '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  // ---- Admin tentando acessar rotas de contador → redireciona para /contadores ----
  if (matchesRoutes(pathname, ROTAS_CONTADOR) && isAdmin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/contadores';
    return NextResponse.redirect(redirectUrl);
  }

  // ---- Rotas compartilhadas (ex: /chat) ----
  if (matchesRoutes(pathname, ROTAS_COMPARTILHADAS)) {
    if (!isContador && !isCliente && !isAdmin && !isEmployee) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ---- Funcionário de escritório tentando acessar rotas exclusivas do dono ----
  if (isEmployeeEscritorio && matchesRoutes(pathname, ROTAS_DONO_CONTADOR)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // Cliente tentando acessar rotas de contador → redireciona para /documentos
  if (matchesRoutes(pathname, ROTAS_CONTADOR) && !isContador && !isEmployeeEscritorio) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = isCliente || isEmployeeCliente ? '/documentos' : '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // Contador tentando acessar rotas de cliente → redireciona para /dashboard
  if (matchesRoutes(pathname, ROTAS_CLIENTE) && !isCliente && !isEmployeeCliente) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  return res;
}

// =============================================================================
// Matcher — restringe o middleware apenas às rotas protegidas
// Exclui API routes, assets estáticos, _next, etc.
// =============================================================================

export const config = {
  matcher: [
    '/dashboard-admin/:path*',
    '/contadores/:path*',
    '/faturamento/:path*',
    '/admin-config/:path*',
    '/webhook-logs/:path*',
    '/admin-boletos/:path*',
    '/admin-clientes/:path*',
    '/auditoria/:path*',
    '/dashboard/:path*',
    '/lote/:path*',
    '/clientes/:path*',
    '/configuracoes/:path*',
    '/calendario/:path*',
    '/equipe/:path*',
    '/documentos/:path*',
    '/enviar/:path*',
    '/ajuda/:path*',
    '/chat/:path*',
    '/financeiro/:path*',
    '/busca/:path*',
    '/assinaturas/:path*',
  ],
};
