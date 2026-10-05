import assert from 'node:assert/strict';
import test from 'node:test';
import { FUEL_ESTIMATE, FUEL_SNAPSHOT } from '../src/data/fuel.js';
import { STATES } from '../src/data/states.js';
import { fetchFuelPrices, normalizeFuel } from '../src/services/fuel.js';

const valida = {
  error: false,
  data_coleta: '2026-10-03 01:52:36',
  precos: { gasolina: { mg: '6,32', sp: 6.36, br: '6,55', xx: '1,00', rj: 'n/d' } },
};

test('converte preços e ignora o que não é estado', () => {
  const dados = normalizeFuel(valida);
  assert.deepEqual(dados.prices, { mg: 6.32, sp: 6.36 });
  assert.equal(dados.collectedAt, '2026-10-03 01:52:36');
});

test('rejeita respostas fora do formato', () => {
  assert.throws(() => normalizeFuel(null));
  assert.throws(() => normalizeFuel({ error: true }));
  assert.throws(() => normalizeFuel({ ...valida, data_coleta: 'ontem' }));
  assert.throws(() => normalizeFuel({ ...valida, precos: { gasolina: {} } }));
});

test('consulta a API e devolve resposta original e dados validados', async () => {
  const { payload, data } = await fetchFuelPrices({ fetchJson: async () => valida });
  assert.equal(payload, valida);
  assert.equal(data.prices.mg, 6.32);
});

test('os dados de reserva são válidos e cobrem todos os estados', () => {
  assert.ok(Object.keys(normalizeFuel(FUEL_SNAPSHOT).prices).length > 0);
  for (const uf of Object.keys(STATES)) assert.ok(FUEL_ESTIMATE.prices[uf] > 0, uf);
});
