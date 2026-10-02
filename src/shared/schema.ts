// JSON Schema is the single source for both runtime validation and TypeScript types.
export const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'TaskOtter data', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'settings', 'tasks', 'outcomes'],
  properties: {
    schemaVersion: { const: 1 },
    settings: { type: 'object', additionalProperties: false, required: ['timeStep'], properties: { timeStep: { enum: [15, 30] } } },
    tasks: { type: 'array', items: { $ref: '#/definitions/task' } },
    outcomes: { type: 'array', items: { $ref: '#/definitions/outcome' } },
  },
  definitions: {
    date: { anyOf: [{ const: '' }, { type: 'string', format: 'date' }] },
    start: { anyOf: [{ const: '' }, { const: 'before' }, { type: 'string', format: 'date' }] },
    end: { anyOf: [{ const: '' }, { const: 'after' }, { type: 'string', format: 'date' }] },
    task: {
      type: 'object', additionalProperties: false,
      required: ['id', 'name', 'memo', 'category', 'status', 'due', 'start', 'end', 'next', 'nextEnd', 'outcomeId'],
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 200 }, name: { type: 'string', minLength: 1, pattern: '\\S' },
        memo: { type: 'string' }, category: { type: 'string' },
        status: { enum: ['Inbox', 'NextAction', 'Waiting', 'Doing', 'Done', 'Someday'] },
        due: { $ref: '#/definitions/date' }, start: { $ref: '#/definitions/start' }, end: { $ref: '#/definitions/end' },
        next: { type: 'string', pattern: '^$|^\\d{4}-\\d{2}-\\d{2}T([01]\\d|2[0-3]):[0-5]\\d$' },
        nextEnd: { type: 'string', pattern: '^$|^([01]\\d|2[0-3]):[0-5]\\d$' }, outcomeId: { type: 'string' },
      },
    },
    outcome: {
      type: 'object', additionalProperties: false,
      required: ['id', 'name', 'memo', 'start', 'end', 'priority', 'complete'],
      properties: {
        id: { type: 'string', minLength: 1, maxLength: 200 }, name: { type: 'string', minLength: 1, pattern: '\\S' },
        memo: { type: 'string' }, start: { $ref: '#/definitions/date' }, end: { $ref: '#/definitions/date' },
        priority: { enum: ['High', 'Medium', 'Low'] }, complete: { type: 'boolean' },
      },
    },
  },
} as const;
