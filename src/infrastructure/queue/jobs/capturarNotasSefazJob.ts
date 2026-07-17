import { createHash }               from 'node:crypto';
import { prisma, storageService }   from '@/infrastructure/di/Container';
import { decrypt }                  from '@/utils/encryption';
import { NFeDistribuicaoDFeClient } from '@/infrastructure/sefaz/NFeDistribuicaoDFeClient';
import { parseNFe }                 from '@/utils/nfeParser';
import { logger }                   from '@/utils/logger';

export interface CapturarNotasSefazJobData {
  certificadoId: string;
}

export async function capturarNotasSefazJob(data: CapturarNotasSefazJobData): Promise<void> {
  const { certificadoId } = data;

  const cert = await prisma.certificadoDigital.findUnique({
    where:  { id: certificadoId },
    select: {
      id:             true,
      clienteId:      true,
      arquivoCifrado: true,
      senhaCifrada:   true,
      cnpjTitular:    true,
      validade:       true,
      ultimoNsu:      true,
      status:         true,
    },
  });

  if (!cert || cert.status !== 'ATIVO') return;

  if (cert.validade < new Date()) {
    await prisma.certificadoDigital.update({
      where: { id: cert.id },
      data:  { status: 'EXPIRADO' },
    });
    logger.warn('[capturarNotasSefazJob] Certificado expirado.', { certificadoId, clienteId: cert.clienteId });
    return;
  }

  let pfxBuffer: Buffer;
  let pfxSenha: string;
  try {
    pfxBuffer = Buffer.from(decrypt(cert.arquivoCifrado), 'base64');
    pfxSenha  = decrypt(cert.senhaCifrada);
  } catch {
    logger.error('[capturarNotasSefazJob] Falha ao decifrar credenciais.', { certificadoId });
    return;
  }

  const ambiente = (process.env.SEFAZ_AMBIENTE ?? 'producao') as 'producao' | 'homologacao';
  const client   = new NFeDistribuicaoDFeClient(ambiente);

  let resultado;
  try {
    resultado = await client.consultarDistribuicao(cert.cnpjTitular, cert.ultimoNsu, pfxBuffer, pfxSenha);
  } catch (err) {
    logger.error('[capturarNotasSefazJob] Erro na consulta à SEFAZ.', {
      certificadoId,
      error: err instanceof Error ? err.message : String(err),
    });
    await prisma.certificadoDigital.update({ where: { id: cert.id }, data: { ultimaConsultaEm: new Date() } });
    return;
  }

  const agora  = new Date();
  const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  let novos = 0;
  for (const doc of resultado.documentos) {
    try {
      const xmlBuffer = Buffer.from(doc.xml, 'utf8');
      const hash      = createHash('sha256').update(xmlBuffer).digest('hex');

      // Idempotência: pula se já existe como nota pendente
      const jaExiste = await prisma.notaPendenteSefaz.findUnique({
        where: { clienteId_fileHash: { clienteId: cert.clienteId, fileHash: hash } },
        select: { id: true },
      });
      if (jaExiste) continue;

      // Upload para MinIO
      const uuid        = crypto.randomUUID();
      const storagePath = `${cert.clienteId}/FISCAL/${anoMes}/${uuid}.xml`;
      await storageService.upload(storagePath, xmlBuffer, 'text/xml');

      // Parseia metadados para exibição na fila
      let meta: {
        emitenteCnpj: string;
        emitenteNome: string;
        numero:       string;
        serie:        string;
        dataEmissao:  Date;
        valorTotal:   number;
      } = {
        emitenteCnpj: '',
        emitenteNome: 'Emitente desconhecido',
        numero:       '0',
        serie:        '0',
        dataEmissao:  agora,
        valorTotal:   0,
      };
      try {
        const parsed = parseNFe(doc.xml);
        meta = {
          emitenteCnpj: parsed.emitente.cnpj,
          emitenteNome: parsed.emitente.nome,
          numero:       parsed.numero,
          serie:        parsed.serie,
          dataEmissao:  parsed.dataEmissao ? new Date(parsed.dataEmissao) : agora,
          valorTotal:   parsed.valorTotal,
        };
      } catch {
        // Mantém defaults — não bloqueia a inserção por falha de parsing
      }

      await prisma.notaPendenteSefaz.create({
        data: {
          clienteId:     cert.clienteId,
          certificadoId,
          chaveAcesso:   doc.chave,
          nsu:           doc.nsu,
          storagePath,
          fileHash:      hash,
          fileSizeBytes: BigInt(xmlBuffer.length),
          emitenteCnpj:  meta.emitenteCnpj,
          emitenteNome:  meta.emitenteNome,
          numero:        meta.numero,
          serie:         meta.serie,
          dataEmissao:   meta.dataEmissao,
          valorTotal:    meta.valorTotal,
        },
      });

      novos++;
    } catch (err) {
      logger.error('[capturarNotasSefazJob] Falha ao salvar nota pendente.', {
        certificadoId,
        nsu:   doc.nsu,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await prisma.certificadoDigital.update({
    where: { id: cert.id },
    data:  { ultimoNsu: resultado.maxNSU, ultimaConsultaEm: new Date() },
  });

  logger.info('[capturarNotasSefazJob] Captura concluída.', {
    certificadoId,
    clienteId: cert.clienteId,
    total:     resultado.documentos.length,
    novos,
    novoNsu:   resultado.maxNSU,
  });
}
