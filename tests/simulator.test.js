import assert from 'node:assert/strict';
import test from 'node:test';
import { breakEven, simulate } from '../src/core/simulator.js';

const mini = { range: 280, battery: 38.88, gas: { urban: 13.6 } };
const premissas = {
  rangeFactor: 0.8,
  window: 0.6,
  efficiency: 0.9,
  safety: 1.3,
  homeTariff: 1.2,
  publicTariff: 2.5,
  gasPrice: 6.32,
  electricRent: 2870,
  gasRent: 1970,
};
const rotina = { kmDay: 40, daysMonth: 30, charging: 'yes' };
const perto = (real, esperado) =>
  assert.ok(Math.abs(real - esperado) < 0.01, `${real} ≠ ${esperado}`);

test('calcula autonomia útil e custos mensais', () => {
  const r = simulate(rotina, mini, premissas);
  assert.equal(r.monthlyKm, 1200);
  perto(r.usableRange, 134.4);
  perto(r.maxKmDay, 103.38);
  perto(r.electricCost, 277.71);
  perto(r.fuelCost, 557.65);
  perto(r.electricTotal, 3147.71);
  perto(r.fuelTotal, 2527.65);
});

test('mostra quando o elétrico NÃO compensa financeiramente', () => {
  const r = simulate(rotina, mini, premissas);
  assert.ok(r.energySavings > 0, 'a energia sai mais barata que a gasolina');
  assert.ok(r.savings < 0, 'mas a diferença de assinatura pesa mais nessa rotina');
});

test('mostra economia quando as mensalidades são equivalentes', () => {
  const r = simulate(rotina, mini, { ...premissas, electricRent: 2000, gasRent: 2000 });
  perto(r.savings, r.energySavings);
  assert.ok(r.savings > 0);
});

test('classifica a rotina pela autonomia e pela recarga', () => {
  assert.equal(simulate(rotina, mini, premissas).status, 'fits');
  assert.equal(simulate({ ...rotina, charging: 'no' }, mini, premissas).status, 'adjust');
  assert.equal(simulate({ ...rotina, kmDay: 220 }, mini, premissas).status, 'not-fit');
});

test('recarga pública usa a tarifa pública', () => {
  const r = simulate({ ...rotina, charging: 'no' }, mini, premissas);
  assert.equal(r.tariff, 2.5);
  perto(r.electricCost, 578.57);
});

test('rejeita entradas inválidas', () => {
  assert.throws(() => simulate({ ...rotina, kmDay: 0 }, mini, premissas));
  assert.throws(() => simulate({ ...rotina, daysMonth: 32 }, mini, premissas));
  assert.throws(() => simulate({ ...rotina, charging: 'talvez' }, mini, premissas));
  assert.throws(() => simulate(rotina, mini, { ...premissas, electricRent: -1 }));
});

test('ponto de equilíbrio: km por dia em que os custos totais se igualam', () => {
  const r = simulate(rotina, mini, premissas);
  const ponto = breakEven(r, rotina.daysMonth);
  assert.equal(ponto.kind, 'above');
  // Na quilometragem do ponto de equilíbrio, a economia é zero.
  const noPonto = simulate({ ...rotina, kmDay: ponto.kmDay }, mini, premissas);
  perto(noPonto.savings, 0);
});

test('ponto de equilíbrio: casos sem cruzamento', () => {
  const base = { electricPerKm: 0.2, fuelPerKm: 0.5, electricRent: 2000, gasRent: 2000 };
  assert.equal(breakEven(base, 30).kind, 'always');
  assert.equal(breakEven({ ...base, electricPerKm: 0.6, electricRent: 2500 }, 30).kind, 'never');
  assert.equal(breakEven({ ...base, electricPerKm: 0.5, electricRent: 1900 }, 30).kind, 'always');
});

test('ponto de equilíbrio: recarga cara só compensa até certa quilometragem', () => {
  const ponto = breakEven(
    { electricPerKm: 0.6, fuelPerKm: 0.5, electricRent: 1900, gasRent: 2000 },
    25,
  );
  assert.equal(ponto.kind, 'below');
  perto(ponto.kmDay, 40); // R$ 100 de vantagem ÷ R$ 0,10 por km ÷ 25 dias
});
