import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks — devem vir ANTES dos imports da rota
// =============================================================================

vi.mock('@/infrastructure/http/middlewares/withAuth', () => ({
  withAuth: (handler: Function, _roles?: string[]) =>
    (req: NextRequest, ctx: { params: Record<string, string> }) =>
      handler(req, ctx, { sub: 'uuid-contador', role: 'ACCOUNTANT', nome: 'Contador Teste' }),
}));

vi.mock('@/infrastructure/di/Container', () => ({
  prisma: {
    boletoHonorario:         { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    configuracaoEscritorio:  { findUnique: vi.fn() },
  },
}));

// Mock da classe AsaasService — instância com método estornarPagamento
const mockEstornarPagamento = vi.fn();
vi.mock('@/infrastructure/asaas/AsaasService', () => ({
  AsaasService: function MockAsaasService() {
    return { estornarPagamento: mockEstornarPagamento };
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// =============================================================================
// Imports dos módulos sob teste — após os mocks
// =============================================================================

import { POST } from '../../app/api/v1/financeiro/boletos/[id]/estorno/route';
import { prisma } from '@/infrastructure/di/Container';

// =============================================================================
// Helpers
// =============================================================================

function makeRequest(body: unknown = {}, boletoId = 'boleto-uuid') {
  return new NextRequest(
    `http://localhost/api/v1/financeiro/boletos/${boletoId}/estorno`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    },
  );
}

const boletoPago = {
  id:           'boleto-uuid',
  escritorioId: 'uuid-contador',
  status:       'PAGO',
  asaasId:      'pay_asaas_123',
  valor:        1500,
};

const configAsaas = { asaasApiKey: 'asaas-api-key-test' };

// =============================================================================
// Suite de testes
// =============================================================================

describe('POST /api/v1/financeiro/boletos/[id]/estorno', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Defaults: boleto encontrado, pertence ao contador, status PAGO
    (prisma.boletoHonorario.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(boletoPago);
    (prisma.boletoHonorario.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.boletoHonorario.update as ReturnType<typeof vi.fn>).mockResolvedValue(boletoPago);
    (prisma.configuracaoEscritorio.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(configAsaas);
    mockEstornarPagamento.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // Caminho feliz
  // ---------------------------------------------------------------------------

  it('solicita estorno com sucesso e retorna 200', async () => {
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mensagem).toBeDefined();
  });

  it('chama updateMany para reservar atomicamente o status ESTORNANDO', async () => {
    const req = makeRequest({}, 'boleto-uuid');
    await POST(req, { params: { id: 'boleto-uuid' } });
    expect(prisma.boletoHonorario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'boleto-uuid', status: 'PAGO' }),
        data:  expect.objectContaining({ status: 'ESTORNANDO' }),
      }),
    );
  });

  it('chama estornarPagamento do AsaasService com o asaasId correto', async () => {
    const req = makeRequest({}, 'boleto-uuid');
    await POST(req, { params: { id: 'boleto-uuid' } });
    expect(mockEstornarPagamento).toHaveBeenCalledWith('pay_asaas_123', undefined);
  });

  it('encaminha valor parcial quando fornecido no body', async () => {
    const req = makeRequest({ valor: 500 }, 'boleto-uuid');
    await POST(req, { params: { id: 'boleto-uuid' } });
    expect(mockEstornarPagamento).toHaveBeenCalledWith('pay_asaas_123', 500);
  });

  // ---------------------------------------------------------------------------
  // 409 — boleto já em processo de estorno (race condition)
  // ---------------------------------------------------------------------------

  it('retorna 409 quando updateMany não atualiza nenhuma linha (boleto já em ESTORNANDO)', async () => {
    (prisma.boletoHonorario.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain('estorno');
  });

  // ---------------------------------------------------------------------------
  // 403 — boleto de outro escritório
  // ---------------------------------------------------------------------------

  it('retorna 403 quando boleto pertence a outro escritório', async () => {
    (prisma.boletoHonorario.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...boletoPago,
      escritorioId: 'outro-uuid',
    });
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    expect(res.status).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 400 — boleto não está PAGO
  // ---------------------------------------------------------------------------

  it('retorna 400 quando boleto não está com status PAGO', async () => {
    (prisma.boletoHonorario.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...boletoPago,
      status: 'PENDENTE',
    });
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('pagos');
  });

  // ---------------------------------------------------------------------------
  // 400 — boleto sem asaasId
  // ---------------------------------------------------------------------------

  it('retorna 400 quando boleto não tem asaasId (estorno manual necessário)', async () => {
    (prisma.boletoHonorario.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...boletoPago,
      asaasId: null,
    });
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Asaas');
  });

  // ---------------------------------------------------------------------------
  // 400 — integração Asaas não configurada
  // ---------------------------------------------------------------------------

  it('retorna 400 quando configuração Asaas não existe', async () => {
    (prisma.configuracaoEscritorio.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Asaas');
  });

  // ---------------------------------------------------------------------------
  // 404 — boleto não encontrado
  // ---------------------------------------------------------------------------

  it('retorna 404 quando boleto não existe', async () => {
    (prisma.boletoHonorario.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // Reversão de status em caso de erro na API externa
  // ---------------------------------------------------------------------------

  it('reverte status para PAGO quando AsaasService lança erro', async () => {
    mockEstornarPagamento.mockRejectedValue(new Error('Asaas API timeout'));
    const req = makeRequest({}, 'boleto-uuid');
    const res = await POST(req, { params: { id: 'boleto-uuid' } });
    // Deve retornar erro 500
    expect(res.status).toBe(500);
    // Deve ter chamado update para reverter o status
    expect(prisma.boletoHonorario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'boleto-uuid' },
        data:  { status: 'PAGO' },
      }),
    );
  });
});
