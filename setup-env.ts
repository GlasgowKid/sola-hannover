const fs = require('fs');
require('dotenv').config();

const targetPath = `./src/environments/environment.development.ts`;
const envConfigFile = `
export const environment = {
  ctBaseUrl: '${process.env['CT_BASE_URL']}',
  ctUsername: '${process.env['CT_USERNAME']}',
  ctPassword: '${process.env['CT_PASSWORD']}',
  production: false
};
`;
fs.writeFileSync(targetPath, envConfigFile);
