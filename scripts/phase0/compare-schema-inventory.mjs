#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const ignoredKeys = new Set([
  'captured_at',
  'generated_at',
  'oid',
  'owner',
]);

const INVENTORY_CONTRACT_VERSION = 2;
const requiredSections = [
  'application_schemas',
  'columns',
  'constraints',
  'extensions',
  'foreign_tables',
  'functions',
  'grants',
  'indexes',
  'policies',
  'sequences',
  'tables',
  'triggers',
  'types',
  'views',
];

function validateInventoryContract(inventory, label) {
  if (inventory === null || typeof inventory !== 'object' || Array.isArray(inventory)) {
    throw new Error(`${label} inventory must be a JSON object`);
  }
  if (inventory.inventory_contract_version !== INVENTORY_CONTRACT_VERSION) {
    throw new Error(
      `${label} inventory_contract_version must equal ${INVENTORY_CONTRACT_VERSION}`,
    );
  }
  for (const section of requiredSections) {
    if (!Array.isArray(inventory[section])) {
      throw new Error(`${label} inventory section ${section} must be an array`);
    }
  }
}

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
    const creatorFingerprint = object.object_type?.startsWith('DEFAULT ') &&
      object.creator_acl_fingerprint != null
      ? ` creator ${object.creator_acl_fingerprint}`
      : '';
    return `${object.object_type} ${objectPath}${functionArguments}${creatorFingerprint} -> ` +
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

    const bucketByIdentity = (objects) => {
      const buckets = new Map();
      for (const object of objects) {
        const identity = objectIdentity(section, object);
        const bucket = buckets.get(identity) ?? [];
        bucket.push({ object, occurrence: bucket.length + 1 });
        buckets.set(identity, bucket);
      }
      return buckets;
    };

    const productionBuckets = bucketByIdentity(productionObjects);
    const localBuckets = bucketByIdentity(localObjects);
    const identities = new Set([...productionBuckets.keys(), ...localBuckets.keys()]);

    for (const identity of [...identities].sort()) {
      const productionBucket = productionBuckets.get(identity) ?? [];
      const localBucket = localBuckets.get(identity) ?? [];
      const unmatchedLocal = [...localBucket];
      const unmatchedProduction = [];

      for (const productionEntry of productionBucket) {
        const exactIndex = unmatchedLocal.findIndex(
          (localEntry) => JSON.stringify(productionEntry.object) === JSON.stringify(localEntry.object),
        );
        if (exactIndex >= 0) {
          unmatchedLocal.splice(exactIndex, 1);
        } else {
          unmatchedProduction.push(productionEntry);
        }
      }

      const changedCount = Math.min(unmatchedProduction.length, unmatchedLocal.length);
      for (let index = 0; index < changedCount; index += 1) {
        const productionEntry = unmatchedProduction[index];
        const localEntry = unmatchedLocal[index];
        const fields = new Set([
          ...Object.keys(productionEntry.object),
          ...Object.keys(localEntry.object),
        ]);
        const occurrence = Math.max(productionBucket.length, localBucket.length) > 1
          ? ` (production occurrence ${productionEntry.occurrence}, local occurrence ${localEntry.occurrence})`
          : '';
        for (const field of [...fields].sort()) {
          if (JSON.stringify(productionEntry.object[field]) ===
              JSON.stringify(localEntry.object[field])) continue;
          differences.push(
            `- changed in local: ${section} ${identity}${occurrence}.${field}\n` +
            `  production: ${JSON.stringify(productionEntry.object[field])}\n` +
            `  local: ${JSON.stringify(localEntry.object[field])}`,
          );
        }
      }

      for (const entry of unmatchedProduction.slice(changedCount)) {
        const duplicate = productionBucket.length > 1 || localBucket.length > 1;
        differences.push(
          `- missing in local: ${section} ${identity}` +
          `${duplicate ? ` (occurrence ${entry.occurrence})\n  production: ${JSON.stringify(entry.object)}` : ''}`,
        );
      }

      for (const entry of unmatchedLocal.slice(changedCount)) {
        const duplicate = productionBucket.length > 1 || localBucket.length > 1;
        differences.push(
          `- extra in local: ${section} ${identity}` +
          `${duplicate ? ` (occurrence ${entry.occurrence})\n  local: ${JSON.stringify(entry.object)}` : ''}`,
        );
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

  let production;
  let local;
  try {
    [production, local] = await Promise.all(
      [productionPath, localPath].map(async (path) => JSON.parse(await readFile(path, 'utf8'))),
    );
    validateInventoryContract(production, 'production');
    validateInventoryContract(local, 'local');
  } catch (error) {
    process.stderr.write(`Schema inventory contract invalid: ${error.message}\n`);
    return 2;
  }

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
