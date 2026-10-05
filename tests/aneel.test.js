import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currentTariffsByCnpj,
  parseBrNumber,
  RESIDENTIAL_FILTERS,
  tariffsByUf,
} from '../scripts/aneel.mjs';

const registro = (cnpj, inicio, tusd, te, extra = {}) => ({
  ...RESIDENTIAL_FILTERS,
  DscUnidadeTerciaria: 'MWh',
  NumCNPJDistribuidora: cnpj,
  DatInicioVigencia: inicio,
  VlrTUSD: tusd,
  VlrTE: te,
  ...extra,
});
const distribuidoras = {
  mg: [{ cnpj: '1', name: 'Cemig' }],
  rj: [
    { cnpj: '2', name: 'Light' },
    { cnpj: '3', name: 'Enel Rio' },
  ],
};
const registros = [
  registro('1', '2026-01-01', '541,30', '317,28'),
  registro('1', '2026-05-28', '593,08', '310,21'),
  registro('1', '2027-05-28', '700,00', '400,00'), // ainda não vigente
  registro('1', '2026-06-01', '100,00', '100,00', { DscDetalhe: 'SCEE' }), // outra modalidade
  registro('2', '2026-03-15', '578,56', '302,00'),
  registro('3', '2026-03-15', '731,72', '329,38'),
];

test('lê números no formato brasileiro', () => {
  assert.equal(parseBrNumber('1.234,56'), 1234.56);
  assert.equal(parseBrNumber('593,08'), 593.08);
});

test('escolhe a tarifa mais recente já em vigor', () => {
  const atual = currentTariffsByCnpj(registros, '2026-10-05');
  assert.equal(atual.get('1').since, '2026-05-28');
  assert.ok(Math.abs(atual.get('1').tariff - 0.90329) < 1e-9);
});

test('calcula a tarifa de cada estado pela média das distribuidoras', () => {
  assert.deepEqual(tariffsByUf(registros, '2026-10-05', distribuidoras), {
    mg: { base: 0.9033, distributors: ['Cemig'] },
    rj: { base: 0.9708, distributors: ['Light', 'Enel Rio'] },
  });
});

test('falha em vez de gerar arquivo incompleto', () => {
  const semLight = registros.filter((r) => r.NumCNPJDistribuidora !== '2');
  assert.throws(() => tariffsByUf(semLight, '2026-10-05', distribuidoras), /RJ: Light/);
});
