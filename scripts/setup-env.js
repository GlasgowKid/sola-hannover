import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config'; // Lädt die .env automatisch

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] || 'development';
const isProd = mode === 'production';

const dir = path.join(__dirname, '../src/environments');
const targetPath = path.join(dir, `environment.${mode}.ts`);

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const envConfigFile = `export const environment = {
  extensionKey: '${process.env.EXTENSION_KEY || ''}',
  ctBaseUrl: '${process.env.CT_BASE_URL || ''}',
  ctUsername: '${process.env.CT_USERNAME || ''}',
  ctPassword: '${process.env.CT_PASSWORD || ''}',
  production: ${isProd}
};`;

fs.writeFileSync(targetPath, envConfigFile, 'utf8');
console.log(`✅ environment.${mode}.ts generiert.`);
