import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks — devem vir ANTES dos imports da rota para que o vi.mock seja hoisted
// =============================================================================

vi.mock('@/infrastructure/http/middlewares/withAuth', () => ({
  withAuth: (handler: Function, _roles?: string[]) =>
    (req: NextRequest, ctx: { params: Record<string, string> }) =>
      handler(req, ctx, { sub: 'uuid-contador', role: 'ACCOUNTANT', nome: 'Contador Teste' }),
}));

vi.mock('@/infrastructure/di/Container', () => ({
  prisma: {
    usuarioCliente:  { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    contadorCliente: { count: vi.fn(), upsert: vi.fn(), create: vi.fn() },
    $transaction:    vi.fn(),
  },
  emailService: { enviarConviteCliente: vi.fn() },
}));

vi.mock('@/utils/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetInSec: 0 }),
}));

vi.mock('@/utils/planLimits', () => ({
  checkClienteLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, limit: 10 }),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// =============================================================================
// Imports dos módulos sob teste — após os mocks
// =============================================================================

import { POST } from '../../app/api/v1/clientes/route';
import { prisma, emailService } from '@/infrastructure/di/Container';
import { checkClienteLimit }   from '@/utils/planLimits';
import { checkRateLimit }      from '@/utils/rateLimiter';

// =============================================================================
// Helpers
// =============================================================================

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/v1/clientes', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

/** CNPJ válido: 11.222.333/0001-81 (dígitos verificadores corretos) */
const CNPJ_VALIDO = '11.222.333/0001-81';

const clienteCriado = {
  id:        'uuid-cliente',
  name:      'Empresa Teste',
  email:     'empresa@teste.com',
  cnpj:      '11222333000181',
  phone:     null,
  avatarUrl: null,
  isActive:  false,
  createdAt: new Date(),
};

// =============================================================================
// Suite de testes
// =============================================================================

describe('POST /api/v1/clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Defaults: sem duplicatas, transação pass-through
    (prisma.usuarioCliente.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    (prisma.usuarioCliente.create as ReturnType<typeof vi.fn>).mockResolvedValue(clienteCriado);
    (prisma.contadorCliente.create as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (emailService.enviarConviteCliente as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (checkClienteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, current: 0, limit: 10 });
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, resetInSec: 0 });
  });

  // ---------------------------------------------------------------------------
  // Caminho feliz
  // ---------------------------------------------------------------------------

  it('cria cliente com dados válidos e retorna 201', async () => {
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.cliente).toBeDefined();
    expect(body.inviteLink).toContain('ativar-conta');
  });

  it('inclui os campos esperados no objeto cliente retornado', async () => {
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    const { cliente } = await res.json();
    expect(cliente).toMatchObject({
      id:       'uuid-cliente',
      nome:     'Empresa Teste',
      email:    'empresa@teste.com',
      isActive: false,
    });
  });

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  it('retorna 429 quando rate limit atingido', async () => {
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: false, resetInSec: 3600 });
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
  });

  // ---------------------------------------------------------------------------
  // Limite de plano
  // ---------------------------------------------------------------------------

  it('retorna 403 quando limite de plano atingido', async () => {
    (checkClienteLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      current: 5,
      limit:   5,
    });
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain('Limite de clientes');
  });

  // ---------------------------------------------------------------------------
  // Conflitos (409)
  // ---------------------------------------------------------------------------

  it('retorna 409 com mensagem de E-mail quando email já existe', async () => {
    (prisma.usuarioCliente.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: 'empresa@teste.com',
      cnpj:  null,
    });
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain('E-mail');
  });

  it('retorna 409 com mensagem de CNPJ quando cnpj já existe', async () => {
    (prisma.usuarioCliente.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      email: 'outro@email.com',
      cnpj:  '11222333000181',
    });
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain('CNPJ');
  });

  // ---------------------------------------------------------------------------
  // Validação de input (400)
  // ---------------------------------------------------------------------------

  it('retorna 400 com CNPJ inválido (dígitos verificadores errados)', async () => {
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: '00.000.000/0000-00' });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.erros).toBeDefined();
  });

  it('retorna 400 quando nome está ausente', async () => {
    const req = makeRequest({ email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(400);
  });

  it('retorna 400 quando email é inválido', async () => {
    const req = makeRequest({ nome: 'Empresa Teste', email: 'nao-e-email', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(400);
  });

  it('retorna 400 quando corpo não é JSON válido', async () => {
    const req = new NextRequest('http://localhost/api/v1/clientes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'isso-nao-e-json',
    });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('JSON');
  });

  // ---------------------------------------------------------------------------
  // Race condition — P2002 do Prisma
  // ---------------------------------------------------------------------------

  it('retorna 409 quando Prisma lança P2002 (race condition)', async () => {
    const prismaError = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(prismaError);
    const req = makeRequest({ nome: 'Empresa Teste', email: 'empresa@teste.com', cnpj: CNPJ_VALIDO });
    const res = await POST(req, { params: {} });
    expect(res.status).toBe(409);
  });
});
