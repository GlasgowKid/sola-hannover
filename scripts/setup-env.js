const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mode = process.argv[2] || 'development'; 
const isProd = mode === 'production';

const dir = path.join(__dirname, '../src/environments');
const fileName = `environment.${mode}.ts`;
const targetPath = path.join(dir, fileName);

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const envConfigFile = `
export const environment = {
  extensionKey: '${process.env.EXTENSION_KEY || ''}',
  ctBaseUrl: '${process.env.CT_BASE_URL || ''}',
  ctUsername: '${process.env.CT_USERNAME || ''}',
  ctPassword: '${process.env.CT_PASSWORD || ''}',
  production: ${isProd}
};
`;

try {
    fs.writeFileSync(targetPath, envConfigFile, 'utf8');
    console.log(`✅ ${fileName} wurde erfolgreich generiert.`);
} catch (err) {
    console.error('❌ Fehler beim Schreiben der Datei:', err);
    process.exit(1);
}