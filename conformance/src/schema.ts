import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const SPEC_PATH = fileURLToPath(new URL('../../contracts/staff-api-v1.openapi.yaml', import.meta.url));
const ROOT_ID = 'urn:escalated:staff-api-v1';

let ajv: Ajv2020 | undefined;

function load(): Ajv2020 {
  if (ajv) return ajv;
  const spec = parse(readFileSync(SPEC_PATH, 'utf8'));
  const instance = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
  addFormats(instance);
  // Register the components under one root so '#/components/schemas/X' refs resolve.
  instance.addSchema({ $id: ROOT_ID, components: { schemas: spec.components.schemas } });
  ajv = instance;
  return instance;
}

/** Fails the test, with every Ajv error in the message, unless `value` matches the named OpenAPI component. */
export function expectSchema(name: string, value: unknown): void {
  const validate = load().getSchema(`${ROOT_ID}#/components/schemas/${name}`);
  if (!validate) throw new Error(`No schema named ${name} in staff-api-v1.openapi.yaml`);
  if (validate(value)) return;
  const lines = (validate.errors ?? []).map((e) => {
    const extra = e.params && Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : '';
    return `  ${e.instancePath || '/'} ${e.message}${extra}`;
  });
  throw new Error(`Response does not match schema ${name}:\n${lines.join('\n')}\nValue: ${JSON.stringify(value).slice(0, 600)}`);
}
