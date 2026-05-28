import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// From src/ OR dist/ (both one level under apps/api/), war/ is at ../../../war
export const WAR_ROOT = path.resolve(__dirname, '..', '..', '..', 'war');
