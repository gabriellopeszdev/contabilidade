import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                              from '../../../../../../src/infrastructure/di/Container';
import { encrypt }                             from '../../../../../../src/utils/encryption';
import { checkRateLimit }                      from '../../../../../../src/utils/rateLimiter';
import { extrairInfoCertificado }              from '../../../../../../src/infrastructure/certificado/CertificadoDigitalParser';
import { logger }                              from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper: verify client belongs to contador (IDOR protection)
async function clientePertenceAoContador(clienteId: string, contadorId: string): Promise<boolean> {
  const v = await prisma.contadorCliente.findUnique({
    where: { contadorId_clienteId: { contadorId, clienteId } },
  });
  return !!v;
}

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '0.0.0.0';
}

// =============================================================================
// PUT /api/v1/clientes/[id]/certificado
// Upload do certificado A1 (.pfx) do cliente
// =============================================================================
export const PUT = withAuth(async (req: NextRequest, ctx, auth) => {
  const { id: clienteId } = (ctx as ResolvedRouteContext).params;

  // Rate limit: 10 uploads/hora por contador
  const rl = await checkRateLimit(`cert:upload:${auth.sub}`, 10, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  // IDOR check
  if (!(await clientePertenceAoContador(clienteId, auth.sub))) {
    return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
  }

  // Busca CNPJ do cliente para validação cruzada
  const cliente = await prisma.usuarioCliente.findUnique({
    where: { id: clienteId },
    select: { cnpj: true },
  });
  if (!cliente?.cnpj) {
    return NextResponse.json(
      { message: 'Cliente não possui CNPJ cadastrado. Cadastre o CNPJ antes de enviar o certificado.' },
      { status: 400 },
    );
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: 'Requisição inválida. Envie multipart/form-data.' }, { status: 400 });
  }

  const arquivo = formData.get('arquivo') as File | null;
  const senha   = formData.get('senha')   as string | null;

  if (!arquivo || !senha) {
    return NextResponse.json({ message: 'Campos obrigatórios: arquivo (.pfx) e senha.' }, { status: 400 });
  }
  if (!arquivo.name.match(/\.(pfx|p12)$/i)) {
    return NextResponse.json({ message: 'Arquivo inválido. Envie um certificado .pfx ou .p12.' }, { status: 400 });
  }
  if (arquivo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ message: 'Arquivo muito grande. Máximo: 10 MB.' }, { status: 400 });
  }

  const pfxBuffer = Buffer.from(await arquivo.arrayBuffer());

  // Extrair e validar certificado
  let cnpjTitular: string;
  let validade: Date;
  try {
    const info = await extrairInfoCertificado(pfxBuffer, senha);
    cnpjTitular = info.cnpj;
    validade    = info.validade;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Arquivo ou senha inválidos.';
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  // Validar CNPJ do certificado contra CNPJ do cliente
  if (cnpjTitular !== cliente.cnpj) {
    return NextResponse.json(
      { message: `O certificado pertence ao CNPJ ${cnpjTitular}, mas o cliente possui CNPJ ${cliente.cnpj}. Verifique se enviou o certificado correto.` },
      { status: 400 },
    );
  }

  // Rejeitar certificado já vencido
  if (validade < new Date()) {
    return NextResponse.json(
      { message: `Certificado vencido em ${validade.toLocaleDateString('pt-BR')}. Não é possível cadastrar certificados expirados.` },
      { status: 400 },
    );
  }

  // Cifrar arquivo e senha
  const arquivoCifrado = encrypt(pfxBuffer.toString('base64'));
  const senhaCifrada   = encrypt(senha);

  // Upsert — preserva ultimoNsu em renovações
  const cert = await prisma.certificadoDigital.upsert({
    where:  { clienteId },
    create: {
      clienteId,
      arquivoCifrado,
      senhaCifrada,
      cnpjTitular,
      validade,
      status:      'ATIVO',
      criadoPorId: auth.sub,
    },
    update: {
      arquivoCifrado,
      senhaCifrada,
      cnpjTitular,
      validade,
      status:      'ATIVO',
      criadoPorId: auth.sub,
    },
  });

  // Audit log — sem arquivo/senha no detailsJson
  prisma.auditLog.create({
    data: {
      userId:       auth.sub,
      actionType:   'CERTIFICADO_CADASTRADO',
      resourceType: 'CERTIFICADO_DIGITAL',
      detailsJson:  { certId: cert.id, clienteId, cnpjTitular, validade: validade.toISOString() },
      ipAddress:    getIp(req),
    },
  }).catch((e: unknown) => logger.warn('[PUT /certificado] Falha ao gravar AuditLog', { error: String(e) }));

  return NextResponse.json({
    ok:          true,
    cnpjTitular: cert.cnpjTitular,
    validade:    cert.validade,
    status:      cert.status,
  });
}, ['ACCOUNTANT']);

// =============================================================================
// GET /api/v1/clientes/[id]/certificado
// Metadados do certificado (nunca retorna arquivo/senha)
// =============================================================================
export const GET = withAuth(async (req: NextRequest, ctx, auth) => {
  const { id: clienteId } = (ctx as ResolvedRouteContext).params;

  if (!(await clientePertenceAoContador(clienteId, auth.sub))) {
    return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
  }

  const cert = await prisma.certificadoDigital.findUnique({
    where:  { clienteId },
    select: { cnpjTitular: true, validade: true, status: true, ultimaConsultaEm: true, createdAt: true },
  });

  if (!cert) {
    return NextResponse.json({ certificado: null });
  }

  return NextResponse.json({ certificado: cert });
}, ['ACCOUNTANT']);

// =============================================================================
// DELETE /api/v1/clientes/[id]/certificado
// Marca como REVOGADO (não apaga — mantém histórico de auditoria)
// =============================================================================
export const DELETE = withAuth(async (req: NextRequest, ctx, auth) => {
  const { id: clienteId } = (ctx as ResolvedRouteContext).params;

  if (!(await clientePertenceAoContador(clienteId, auth.sub))) {
    return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
  }

  const cert = await prisma.certificadoDigital.findUnique({ where: { clienteId } });
  if (!cert) {
    return NextResponse.json({ message: 'Nenhum certificado cadastrado para este cliente.' }, { status: 404 });
  }

  await prisma.certificadoDigital.update({
    where: { clienteId },
    data:  { status: 'REVOGADO' },
  });

  prisma.auditLog.create({
    data: {
      userId:       auth.sub,
      actionType:   'CERTIFICADO_REMOVIDO',
      resourceType: 'CERTIFICADO_DIGITAL',
      detailsJson:  { certId: cert.id, clienteId, cnpjTitular: cert.cnpjTitular },
      ipAddress:    getIp(req),
    },
  }).catch((e: unknown) => logger.warn('[DELETE /certificado] Falha ao gravar AuditLog', { error: String(e) }));

  return NextResponse.json({ ok: true });
}, ['ACCOUNTANT']);
