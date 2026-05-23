import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    // .trim() protege contra \r residual em arquivos .env editados no Windows
    url: process.env.DATABASE_URL?.trim(),
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
