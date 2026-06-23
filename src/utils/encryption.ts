import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12; // 96 bits recomendado para GCM
const TAG_BYTES  = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('[encryption] ENCRYPTION_KEY deve ter exatamente 64 caracteres hex (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Cifra um texto com AES-256-GCM.
 * Retorna string no formato: <iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv  = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag       = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decifra um texto cifrado pelo `encrypt`.
 * Lança se o formato for inválido ou a autenticação falhar.
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('[encryption] Formato de ciphertext inválido.');

  const [ivHex, tagHex, dataHex] = parts;
  const key      = getKey();
  const iv       = Buffer.from(ivHex,  'hex');
  const tag      = Buffer.from(tagHex, 'hex');
  const data     = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(data).toString('utf8') + decipher.final('utf8');
}

/**
 * Retorna true se a string parece ser um valor cifrado (formato iv:tag:data).
 * Usado para suportar migração gradual (valores antigos em texto claro).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === IV_BYTES * 2;
}
