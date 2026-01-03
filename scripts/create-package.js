import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const { name: projectName, version } = packageJson;

let gitHash = 'no-git';
try {
    gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (e) {}

const releasesDir = path.join(rootDir, 'releases');
if (!fs.existsSync(releasesDir)) fs.mkdirSync(releasesDir, { recursive: true });

const archiveName = `${projectName}-v${version}-${gitHash}.zip`;
const archivePath = path.join(releasesDir, archiveName);

const distDir = path.join(rootDir, 'dist', projectName, 'browser');

if (!fs.existsSync(distDir)) {
    console.error(`❌ Dist-Ordner nicht gefunden: ${distDir}`);
    process.exit(1);
}

const output = fs.createWriteStream(archivePath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
    console.log(`✅ Paket erstellt: ${archiveName} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
});

archive.pipe(output);
archive.glob('**/*', { cwd: distDir, ignore: ['**/*.map'] });
archive.finalize();
