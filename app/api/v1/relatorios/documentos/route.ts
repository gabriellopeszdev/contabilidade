import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { gerarPDF, ExportColumn } from '@/lib/exporters/pdfExporter';
import { gerarExcel } from '@/lib/exporters/excelExporter';

const COLUNAS: ExportColumn[] = [
  { header: 'Arquivo',     key: 'fileName',    width: 0.35 },
  { header: 'Tipo',        key: 'fileType',    width: 0.08 },
  { header: 'Setor',       key: 'sector',      width: 0.12 },
  { header: 'Competência', key: 'competencia', width: 0.12 },
  { header: 'Lido',        key: 'lido',        width: 0.08 },
  { header: 'Enviado em',  key: 'createdAt',   width: 0.25 },
];

export const GET = withAuth(async (req, ctx, auth) => {
  const { searchParams } = req.nextUrl;
  const format    = searchParams.get('format') ?? 'pdf';
  const clienteId = searchParams.get('clienteId');
  const de        = searchParams.get('de');
  const ate       = searchParams.get('ate');

  const documentos = await prisma.documentoFiscal.findMany({
    where: {
      deletedAt: null,
      ...(clienteId ? { clientId: clienteId } : {}),
      ...(de || ate ? {
        createdAt: {
          ...(de ? { gte: new Date(de) } : {}),
          ...(ate ? { lte: new Date(ate + 'T23:59:59') } : {}),
        }
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: { fileName: true, fileType: true, sector: true, competencia: true, readStatus: true, createdAt: true },
  });

  const linhas = documentos.map((d) => ({
    fileName:    d.fileName,
    fileType:    d.fileType,
    sector:      d.sector,
    competencia: d.competencia ? new Date(d.competencia).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : '-',
    lido:        d.readStatus ? 'Sim' : 'Não',
    createdAt:   new Date(d.createdAt).toLocaleDateString('pt-BR'),
  }));

  if (format === 'json') {
    return NextResponse.json({ total: linhas.length, dados: linhas });
  }

  if (format === 'excel') {
    const buffer = await gerarExcel({ titulo: 'Relatório de Documentos Fiscais', planilha: 'Documentos', colunas: COLUNAS, linhas });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="documentos.xlsx"',
      },
    });
  }

  const bytes = await gerarPDF({ titulo: 'Relatório de Documentos Fiscais', colunas: COLUNAS, linhas });
  return new NextResponse(bytes, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="documentos.pdf"' },
  });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
