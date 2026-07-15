import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKUP_ROOT = '/backups';
const CATEGORIAS = ['daily', 'weekly', 'monthly'] as const;
type Categoria = typeof CATEGORIAS[number];

interface BackupEntry {
  nome:      string;
  categoria: Categoria;
  tamanho:   number;
  criadoEm:  string;
}

export const GET = withAuth(async () => {
  const entries: BackupEntry[] = [];

  for (const cat of CATEGORIAS) {
    const dir = path.join(BACKUP_ROOT, cat);
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch {
      // pasta não existe ou não acessível — ignorar
      continue;
    }

    for (const nome of files) {
      if (!nome.endsWith('.sql.gz') && !nome.endsWith('.sql')) continue;
      const filePath = path.join(dir, nome);
      try {
        const stat = await fs.stat(filePath);
        entries.push({
          nome,
          categoria: cat,
          tamanho:   stat.size,
          criadoEm:  stat.birthtime.toISOString(),
        });
      } catch {
        // ignorar arquivo inacessível
      }
    }
  }

  // Mais recente primeiro
  entries.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

  return NextResponse.json({ backups: entries });
}, ['ADMIN']);
