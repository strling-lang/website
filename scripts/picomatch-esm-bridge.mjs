import { createRequire } from 'node:module';

const loadCommonJs = createRequire(import.meta.url);
const picomatch = loadCommonJs('picomatch');

export default picomatch;
