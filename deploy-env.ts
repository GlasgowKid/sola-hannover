const extensionKey = process.env['EXTENSION_KEY'];
const baseHref = `/ccm/${extensionKey}/`;

const angularJsonPath = './angular.json';
const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));

const projectName = Object.keys(angularJson.projects)[0]; // Holt das erste Projekt
angularJson.projects[projectName].architect.build.options.baseHref = baseHref;

fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));

console.log(`✅ BaseHref wurde auf ${baseHref} gesetzt und in angular.json gespeichert.`);
