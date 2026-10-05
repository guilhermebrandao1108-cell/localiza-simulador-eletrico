import assert from 'node:assert/strict';
import test from 'node:test';
import { describeDistributors, homeEnergyPrice } from '../src/core/energy.js';
import { ENERGY_TARIFFS } from '../src/data/energy-tariffs.js';
import { STATES } from '../src/data/states.js';

const tarifas = {
  byUf: { mg: { base: 0.9, distributors: ['Cemig'] }, xx: { base: 0, distributors: [] } },
};

test('aplica os impostos estimados sobre a tarifa da ANEEL', () => {
  assert.deepEqual(homeEnergyPrice('mg', tarifas, 1.3), {
    price: 1.17,
    base: 0.9,
    distributors: ['Cemig'],
  });
});

test('devolve null quando o estado não tem tarifa válida', () => {
  assert.equal(homeEnergyPrice('sp', tarifas, 1.3), null);
  assert.equal(homeEnergyPrice('xx', tarifas, 1.3), null);
});

test('descreve as distribuidoras de forma curta', () => {
  assert.equal(describeDistributors(['Cemig']), 'Cemig');
  assert.equal(describeDistributors(['Light', 'Enel Rio']), 'média de Light e Enel Rio');
  assert.equal(describeDistributors(['A', 'B', 'C']), 'média de 3 distribuidoras');
});

test('o arquivo gerado cobre todos os estados com valores plausíveis', () => {
  for (const uf of Object.keys(STATES)) {
    const energia = homeEnergyPrice(uf, ENERGY_TARIFFS, 1.3);
    assert.ok(energia, `sem tarifa para ${uf}`);
    assert.ok(energia.price > 0.4 && energia.price < 3, `${uf}: ${energia.price}`);
  }
});
