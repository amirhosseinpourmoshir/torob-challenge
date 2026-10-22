import { writeFileSync } from 'node:fs'
import { agentWidgetSchema } from '../frontend/src/agent-ui/contracts.js'

const schema = JSON.stringify(agentWidgetSchema, null, 2) + '\n'
for (const path of ['../docs/agent-ui.schema.json', '../backend/agent/widget-schema.json']) {
  writeFileSync(new URL(path, import.meta.url), schema)
}
