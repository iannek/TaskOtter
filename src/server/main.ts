import { createApp } from './app.js';
import { Store } from './store.js';
const app = await createApp(new Store(process.env.DATA_DIR || './data'), 'dist/frontend');
await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3000) });
console.log('TaskOtter: http://localhost:' + (process.env.PORT || 3000));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void app.close(); });
