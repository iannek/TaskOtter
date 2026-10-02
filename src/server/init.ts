import { Store } from './store.js';
import { schema } from '../shared/schema.js';
import { writeFile } from 'node:fs/promises';
if (process.argv.includes('--schema')) await writeFile('schemas/taskotter.schema.json', JSON.stringify(schema, null, 2) + '\n');
else { await new Store(process.env.DATA_DIR || './data').initialize(); console.log('空の taskotter.json を作成しました。'); }
