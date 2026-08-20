#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const ignoredKeys = new Set([
  'captured_at',
  'generated_at',
  'oid',
  'owner',
]);

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !ignoredKeys.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }

  return typeof value === 'string' ? value.replaceAll('\r\n', '\n') : value;
}

function objectIdentity(section, object) {
  if (section === 'functions') {
    return `${object.schema}.${object.name}(${object.identity_arguments ?? ''})`;
  }

  if (section === 'grants') {
    const objectPath = [object.schema, object.object, object.column]
      .filter((part) => part != null && part !== '')
      .join('.');
    const functionArguments = object.identity_arguments == null
      ? ''
      : `(${object.identity_arguments})`;
    return `${object.object_type} ${objectPath}${functionArguments} -> ` +
      `${object.grantee} ${object.privilege}`;
  }

  const parts = [object.schema, object.table, object.name]
    .filter((part) => part !== undefined && part !== '');
  return parts.length > 0 ? parts.join('.') : JSON.stringify(object);
}

function findDifferences(production, local) {
  const differences = [];

  const sections = new Set([...Object.keys(production), ...Object.keys(local)]);
  for (const section of [...sections].sort()) {
    const productionObjects = Array.isArray(production[section]) ? production[section] : [];
    const localObjects = Array.isArray(local[section]) ? local[section] : [];
    if (!Array.isArray(production[section]) && !Array.isArray(local[section])) continue;

    const productionByIdentity = new Map(
      productionObjects.map((object) => [objectIdentity(section, object), object]),
    );
    const localByIdentity = new Map(
      localObjects.map((object) => [objectIdentity(section, object), object]),
    );
    for (const object of productionObjects) {
      const identity = objectIdentity(section, object);
      const localObject = localByIdentity.get(identity);
      if (!localObject) {
        differences.push(`- missing in local: ${section} ${identity}`);
        continue;
      }

      const fields = new Set([...Object.keys(object), ...Object.keys(localObject)]);
      for (const field of [...fields].sort()) {
        if (JSON.stringify(object[field]) === JSON.stringify(localObject[field])) continue;
        differences.push(
          `- changed in local: ${section} ${identity}.${field}\n` +
          `  production: ${JSON.stringify(object[field])}\n` +
          `  local: ${JSON.stringify(localObject[field])}`,
        );
      }
    }

    for (const object of localObjects) {
      const identity = objectIdentity(section, object);
      if (!productionByIdentity.has(identity)) {
        differences.push(`- extra in local: ${section} ${identity}`);
      }
    }
  }

  return differences;
}

async function main([productionPath, localPath]) {
  if (!productionPath || !localPath) {
    process.stderr.write('Usage: compare-schema-inventory.mjs <production.json> <local.json>\n');
    return 2;
  }

  const [production, local] = await Promise.all(
    [productionPath, localPath].map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
  );

  const canonicalProduction = canonicalize(production);
  const canonicalLocal = canonicalize(local);
  const matches = JSON.stringify(canonicalProduction) === JSON.stringify(canonicalLocal);
  if (matches) {
    process.stdout.write('Schema inventories match.\n');
    return 0;
  }

  const differences = findDifferences(canonicalProduction, canonicalLocal);
  process.stdout.write(`Schema inventories differ:\n${differences.join('\n')}\n`);
  return 1;
}

process.exitCode = await main(process.argv.slice(2));
