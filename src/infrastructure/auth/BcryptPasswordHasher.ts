import bcrypt from 'bcryptjs';

import type { IPasswordHasher } from '../../domain/ports/IPasswordHasher';

const SALT_ROUNDS = 12;

export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(senhaPlana: string): Promise<string> {
    return bcrypt.hash(senhaPlana, SALT_ROUNDS);
  }

  async comparar(senhaPlana: string, hashArmazenado: string): Promise<boolean> {
    return bcrypt.compare(senhaPlana, hashArmazenado);
  }
}
