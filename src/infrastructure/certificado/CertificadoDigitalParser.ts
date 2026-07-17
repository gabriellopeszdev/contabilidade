import { execFile }       from 'node:child_process';
import { promisify }      from 'node:util';
import { X509Certificate } from 'node:crypto';
import * as fs            from 'node:fs/promises';
import * as os            from 'node:os';
import * as path          from 'node:path';

const execFileAsync = promisify(execFile);

export interface InfoCertificado {
  cnpj:     string;
  validade: Date;
}

/**
 * Extrai CNPJ e validade de um certificado A1 ICP-Brasil (.pfx/.p12).
 *
 * Usa `openssl pkcs12` via child_process (não node-forge) porque certificados
 * ICP-Brasil podem usar PBE com RC2-40-CBC, que o node-forge não implementa.
 * A senha é escrita em arquivo temporário com permissão 0600 — nunca vai
 * para a linha de comando (visível em ps/proc).
 */
export async function extrairInfoCertificado(
  pfxBuffer: Buffer,
  senha: string,
): Promise<InfoCertificado> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cert-'));

  const pfxPath   = path.join(tmpDir, 'cert.pfx');
  const pemPath   = path.join(tmpDir, 'cert.pem');
  const passPath  = path.join(tmpDir, 'pass.txt');

  try {
    // Escreve o .pfx e a senha em arquivos temporários com permissão restrita
    await fs.writeFile(pfxPath,  pfxBuffer);
    await fs.writeFile(passPath, senha, { mode: 0o600 });

    try {
      // Extrai o certificado (sem chave privada) do PKCS#12
      // -legacy: necessário para algoritmos legados usados em certs ICP-Brasil
      await execFileAsync('openssl', [
        'pkcs12',
        '-in',      pfxPath,
        '-clcerts',
        '-nokeys',
        '-legacy',
        '-out',     pemPath,
        '-passin',  `file:${passPath}`,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/mac verify|invalid password|bad decrypt|wrong password/i.test(msg)) {
        throw new Error('Senha do certificado incorreta ou arquivo inválido.');
      }
      throw new Error('Senha do certificado incorreta ou arquivo inválido.');
    }

    const pemBuffer = await fs.readFile(pemPath);
    const cert      = new X509Certificate(pemBuffer);

    // Validade
    const validade = new Date(cert.validTo);

    // CNPJ do titular — em certificados e-CNPJ ICP-Brasil o CNPJ aparece de
    // uma das seguintes formas no subject/subjectAltName:
    //   1. CN=NOME DA EMPRESA:34140741000270  (14 dígitos após ":")
    //   2. serialNumber=34140741000270
    //   3. OID.2.16.76.1.3.3 no subjectAltName (formato othername hex)
    // Tentamos extrair na ordem de confiabilidade.
    const cnpj = extrairCnpjDoCertificado(cert);
    if (!cnpj) {
      throw new Error('Não foi possível extrair o CNPJ do certificado. Verifique se é um certificado e-CNPJ ICP-Brasil.');
    }

    return { cnpj, validade };
  } finally {
    // Garante limpeza dos arquivos temporários mesmo em caso de erro
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Extração de CNPJ do certificado ICP-Brasil
// ---------------------------------------------------------------------------

function extrairCnpjDoCertificado(cert: X509Certificate): string | null {
  // Tentativa 1: CN=NOME:CNPJ14DIGITOS
  const cnFromSubject = cnpjDoCampo(cert.subject);
  if (cnFromSubject) return cnFromSubject;

  // Tentativa 2: serialNumber no subject
  const serialMatch = cert.subject.match(/serialNumber=(\d{14})/i);
  if (serialMatch) return serialMatch[1];

  // Tentativa 3: subjectAltName (OID 2.16.76.1.3.3 em othername hex)
  const san = cert.subjectAltName ?? '';
  const cnpjFromSan = extrairCnpjDeSAN(san);
  if (cnpjFromSan) return cnpjFromSan;

  return null;
}

/** Extrai 14 dígitos após ":" em campos do subject (padrão ICP-Brasil e-CNPJ). */
function cnpjDoCampo(subject: string): string | null {
  // CN=I C FREIRE DA SILVA:34140741000270
  const match = subject.match(/:(\d{14})(?:\s|,|\/|$)/);
  return match ? match[1] : null;
}

/**
 * Parseia subjectAltName para extrair CNPJ do OID 2.16.76.1.3.3.
 * Node.js retorna othername como: "othername: 2.16.76.1.3.3;UTF8:34140741000270"
 * ou como valor hex que precisa de decodificação adicional.
 */
function extrairCnpjDeSAN(san: string): string | null {
  // Formato legível: othername: 2.16.76.1.3.3;UTF8:34140741000270
  const utfMatch = san.match(/2\.16\.76\.1\.3\.3[^;]*;(?:UTF8:)?(\d{14})/i);
  if (utfMatch) return utfMatch[1];

  // Formato hex: othername: 2.16.76.1.3.3, value:hex-string
  // Extrai 14 dígitos consecutivos presentes no valor hex decodificado como ASCII
  const hexMatch = san.match(/2\.16\.76\.1\.3\.3[^,]*,\s*value:([0-9a-fA-F]+)/i);
  if (hexMatch) {
    try {
      const decoded = Buffer.from(hexMatch[1], 'hex').toString('ascii');
      const digits = decoded.match(/\d{14}/);
      if (digits) return digits[0];
    } catch {
      // ignora erro de decodificação hex
    }
  }

  return null;
}
