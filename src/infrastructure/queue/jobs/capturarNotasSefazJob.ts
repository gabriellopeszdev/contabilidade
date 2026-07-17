import { createHash }               from 'node:crypto';
import { prisma, storageService, documentoRepository, queueProducer } from '@/infrastructure/di/Container';
import { decrypt }                 from '@/utils/encryption';
import { NFeDistribuicaoDFeClient } from '@/infrastructure/sefaz/NFeDistribuicaoDFeClient';
import { DocumentoFiscal }         from '@/domain/entities/DocumentoFiscal';
import { Setor }                   from '@/domain/value-objects/Setor';
import { logger }                  from '@/utils/logger';

export interface CapturarNotasSefazJobData {
  certificadoId: string;
}

export async function capturarNotasSefazJob(data: CapturarNotasSefazJobData): Promise<void> {
  const { certificadoId } = data;

  // 1. Busca o certificado ativo
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
      criadoPorId:    true,
    },
  });

  if (!cert || cert.status !== 'ATIVO') return;

  // Verifica validade
  if (cert.validade < new Date()) {
    await prisma.certificadoDigital.update({
      where: { id: cert.id },
      data:  { status: 'EXPIRADO' },
    });
    logger.warn('[capturarNotasSefazJob] Certificado expirado.', {
      certificadoId,
      clienteId: cert.clienteId,
      validade:  cert.validade.toISOString(),
    });
    return;
  }

  // 2. Decifra credenciais — só no momento da chamada, nunca em cache de módulo
  let pfxBuffer: Buffer;
  let pfxSenha: string;
  try {
    pfxBuffer = Buffer.from(decrypt(cert.arquivoCifrado), 'base64');
    pfxSenha  = decrypt(cert.senhaCifrada);
  } catch {
    logger.error('[capturarNotasSefazJob] Falha ao decifrar credenciais.', { certificadoId });
    return;
  }

  // 3. Consulta SEFAZ
  const ambiente = (process.env.SEFAZ_AMBIENTE ?? 'producao') as 'producao' | 'homologacao';
  const client   = new NFeDistribuicaoDFeClient(ambiente);

  let resultado;
  try {
    resultado = await client.consultarDistribuicao(
      cert.cnpjTitular,
      cert.ultimoNsu,
      pfxBuffer,
      pfxSenha,
    );
  } catch (err) {
    logger.error('[capturarNotasSefazJob] Erro na consulta à SEFAZ.', {
      certificadoId,
      clienteId: cert.clienteId,
      error:     err instanceof Error ? err.message : String(err),
    });
    // Atualiza ultimaConsultaEm mesmo em erro parcial pra não travar o loop
    await prisma.certificadoDigital.update({
      where: { id: cert.id },
      data:  { ultimaConsultaEm: new Date() },
    });
    return;
  }

  const bucket = process.env.MINIO_BUCKET ?? 'documentos-contabeis';
  const agora  = new Date();
  const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  let salvos = 0;
  for (const doc of resultado.documentos) {
    try {
      const xmlBuffer = Buffer.from(doc.xml, 'utf8');
      const hash      = createHash('sha256').update(xmlBuffer).digest('hex');

      // 4. Idempotência: pula se já existe
      const jaExiste = await documentoRepository.hashJaExiste(hash, cert.clienteId);
      if (jaExiste) continue;

      // 5. Upload para MinIO
      const uuid        = crypto.randomUUID();
      const storagePath = `${cert.clienteId}/FISCAL/${anoMes}/${uuid}.xml`;
      await storageService.upload(storagePath, xmlBuffer, 'text/xml');

      // 6. Persiste DocumentoFiscal
      const nomeArquivo = `${doc.chave}.xml`;
      const documentoFiscal = DocumentoFiscal.criar({
        id:           crypto.randomUUID(),
        clientId:     cert.clienteId,
        uploadedById: cert.criadoPorId,
        fileName:     nomeArquivo,
        fileType:     'XML',
        fileSizeBytes: xmlBuffer.length,
        storagePath,
        fileHash:     hash,
        sector:       Setor.FISCAL,
        competencia:  null,
        metadataJson: {},
      });
      await documentoRepository.salvar(documentoFiscal);

      // 7. Enfileira parsing de metadata
      const jobPayload = {
        tipo:    'PARSEAR_XML_NFE' as const,
        payload: { documentoId: documentoFiscal.id, storagePath },
      };
      await queueProducer.add(jobPayload.tipo, jobPayload, {
        jobId: `PARSEAR_XML_NFE-${documentoFiscal.id}`,
      });

      salvos++;
    } catch (err) {
      logger.error('[capturarNotasSefazJob] Falha ao salvar documento do lote.', {
        certificadoId,
        nsu:   doc.nsu,
        error: err instanceof Error ? err.message : String(err),
      });
      // Não quebra — continua processando os demais documentos do lote
    }
  }

  // 8. Avança cursor mesmo se houve falhas parciais
  await prisma.certificadoDigital.update({
    where: { id: cert.id },
    data:  {
      ultimoNsu:        resultado.maxNSU,
      ultimaConsultaEm: new Date(),
    },
  });

  logger.info('[capturarNotasSefazJob] Captura concluída.', {
    certificadoId,
    clienteId:  cert.clienteId,
    total:      resultado.documentos.length,
    salvos,
    novoNsu:    resultado.maxNSU,
  });
}
