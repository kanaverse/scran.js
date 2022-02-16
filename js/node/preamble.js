import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { URL } from 'url';
const __filename = new URL('', import.meta.url).pathname;
const __dirname = new URL('', import.meta.url).pathname;
