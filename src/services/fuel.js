/**
 * Preço da gasolina por estado (Combustível API).
 */
import { ENDPOINTS } from '../config.js';
import { STATES } from '../data/states.js';
import { fetchJson } from './http.js';

/**
 * @typedef {object} FuelData
 * @property {Record<string, number>} prices R$/L por UF (sigla em minúsculas)
 * @property {string} collectedAt data da coleta, "AAAA-MM-DD HH:MM:SS"
 * @property {string} source página de origem dos preços
 */

const COLLECTED_AT = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/;

/**
 * Valida a resposta da API e devolve os preços como números. A API envia os
 * valores como texto com vírgula ("6,32") e inclui a média nacional ("br"),
 * que não é um estado.
 *
 * @param {any} payload
 * @returns {FuelData}
 * @throws {Error} se o formato for inesperado ou não houver nenhum preço válido
 */
export function normalizeFuel(payload) {
  if (
    !payload ||
    payload.error !== false ||
    !payload.precos ||
    !payload.precos.gasolina ||
    typeof payload.data_coleta !== 'string' ||
    !COLLECTED_AT.test(payload.data_coleta)
  )
    throw new Error('Resposta de preços inválida');

  const prices = {};
  for (const [uf, raw] of Object.entries(payload.precos.gasolina)) {
    if (!Object.hasOwn(STATES, uf)) continue;
    const price = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
    if (Number.isFinite(price) && price > 0 && price < 50) prices[uf] = price;
  }
  if (!Object.keys(prices).length) throw new Error('Sem preços por estado');

  return {
    prices,
    collectedAt: payload.data_coleta,
    source: payload.fonte || 'https://combustivelapi.com.br/',
  };
}

/**
 * Consulta os preços atuais.
 *
 * @param {{ fetchJson?: typeof fetchJson }} [deps]
 * @returns {Promise<{ payload: any, data: FuelData }>} resposta original (para o cache) e dados validados
 */
export async function fetchFuelPrices({ fetchJson: request = fetchJson } = {}) {
  const payload = await request(ENDPOINTS.fuel, {
    init: { cache: 'no-store', referrerPolicy: 'no-referrer' },
  });
  return { payload, data: normalizeFuel(payload) };
}
