import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const angularJsonPath = path.join(__dirname, '../angular.json');
const action = process.argv[2] || 'set';

try {
    const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
    const projectName = Object.keys(angularJson.projects)[0];
    const buildOptions = angularJson.projects[projectName].architect.build.options;

    if (action === 'reset') {
        buildOptions.baseHref = '/';
        console.log('✅ angular.json: baseHref auf "/" zurückgesetzt.');
    } else {
        const extensionKey = process.env.EXTENSION_KEY;
        if (!extensionKey) throw new Error('EXTENSION_KEY fehlt in .env');
        
        buildOptions.baseHref = `/ccm/${extensionKey}/`;
        console.log(`✅ angular.json: baseHref auf "${buildOptions.baseHref}" gesetzt.`);
    }

    fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2), 'utf8');
} catch (err) {
    console.error('❌ Fehler:', err.message);
    process.exit(1);
}
