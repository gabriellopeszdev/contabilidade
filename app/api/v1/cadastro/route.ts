import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/infrastructure/di/Container';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    nome?: string;
    email?: string;
    telefone?: string;
    cnpj?: string;
    crc?: string;
    planoNome?: string;
    mensagem?: string;
  };

  const { nome, email, telefone, cnpj, crc, planoNome, mensagem } = body;

  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json({ message: 'Nome e e-mail são obrigatórios.' }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.FROM_EMAIL ?? 'admin@fiscohub.com.br';

  const corpoHtml = `
    <h2>Novo Interesse de Contratação — FiscoHub</h2>
    <table>
      <tr><td><strong>Nome:</strong></td><td>${nome}</td></tr>
      <tr><td><strong>E-mail:</strong></td><td>${email}</td></tr>
      <tr><td><strong>Telefone:</strong></td><td>${telefone ?? '—'}</td></tr>
      <tr><td><strong>CNPJ:</strong></td><td>${cnpj ?? '—'}</td></tr>
      <tr><td><strong>CRC:</strong></td><td>${crc ?? '—'}</td></tr>
      <tr><td><strong>Plano de interesse:</strong></td><td><strong>${planoNome ?? 'Não informado'}</strong></td></tr>
      ${mensagem ? `<tr><td><strong>Mensagem:</strong></td><td>${mensagem}</td></tr>` : ''}
    </table>
  `;

  await emailService.enviar({
    destinatario: adminEmail,
    assunto:      `[FiscoHub] Novo interesse: ${nome} — ${planoNome ?? 'Plano não especificado'}`,
    corpoHtml,
  }).catch(() => {});

  return NextResponse.json({ message: 'Interesse registrado com sucesso!' });
}
