#!/usr/bin/env node
/**
 * Atualiza src/data/energy-tariffs.js com as tarifas residenciais vigentes,
 * a partir dos dados abertos da ANEEL.
 *
 * A API da ANEEL não permite chamadas diretas do navegador (não envia os
 * cabeçalhos de CORS), então o app usa este retrato gerado periodicamente.
 *
 * Uso: npm run update:energy
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RESIDENTIAL_FILTERS, tariffsByUf } from './aneel.mjs';

const API = 'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search';
const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';
const DATASET_URL =
  'https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica';
const OUTPUT = fileURLToPath(new URL('../src/data/energy-tariffs.js', import.meta.url));
// Cada distribuidora tem poucas tarifas por ano: os registros mais recentes cobrem todas as vigentes.
const PAGE_SIZE = 1000;

async function fetchRecords() {
  const url = new URL(API);
  url.searchParams.set('resource_id', RESOURCE_ID);
  url.searchParams.set('filters', JSON.stringify(RESIDENTIAL_FILTERS));
  url.searchParams.set('sort', 'DatInicioVigencia desc');
  url.searchParams.set('limit', String(PAGE_SIZE));
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`ANEEL respondeu HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload.success || !Array.isArray(payload.result?.records)) {
    throw new Error('Resposta da ANEEL fora do formato esperado');
  }
  return payload.result.records;
}

function render(tariffs, today) {
  const lines = Object.keys(tariffs)
    .sort()
    .map((uf) => {
      const names = tariffs[uf].distributors.map((name) => JSON.stringify(name)).join(', ');
      return `    ${uf}: { base: ${tariffs[uf].base}, distributors: [${names}] },`;
    });
  return `/**
 * Tarifa residencial de energia por estado, em R$/kWh e sem impostos.
 *
 * ARQUIVO GERADO por scripts/update-energy-tariffs.mjs. Não edite à mão:
 * rode \`npm run update:energy\` para atualizar.
 *
 * Fonte: ANEEL, tarifas de aplicação homologadas (grupo B1, residencial
 * convencional, TUSD + TE). Em estados com mais de uma distribuidora de grande
 * porte, o valor é a média simples entre elas.
 */
export const ENERGY_TARIFFS = {
  updatedAt: '${today}',
  source: '${DATASET_URL}',
  byUf: {
${lines.join('\n')}
  },
};
`;
}

const today = new Date().toISOString().slice(0, 10);
const records = await fetchRecords();
const tariffs = tariffsByUf(records, today);
await writeFile(OUTPUT, render(tariffs, today), 'utf8');
console.log(`Tarifas de ${Object.keys(tariffs).length} estados gravadas em ${OUTPUT}`);
