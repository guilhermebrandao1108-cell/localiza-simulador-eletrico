import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../src/services/http.js';
import {
  formatCep,
  locateByDevice,
  LocationError,
  lookupCep,
  normalizeCep,
  parseReverseGeocode,
} from '../src/services/location.js';

const brasilApi = { cep: '30130010', state: 'MG', city: 'Belo Horizonte' };
const viaCep = { cep: '30130-010', uf: 'MG', localidade: 'Belo Horizonte' };
const codigo = (esperado) => (erro) => erro instanceof LocationError && erro.code === esperado;
/** fetchJson falso: responde conforme o trecho do endereço consultado. */
function rotas(mapa) {
  const request = async (url) => {
    request.urls.push(url);
    const [, resposta] = Object.entries(mapa).find(([trecho]) => url.includes(trecho));
    if (resposta instanceof Error) throw resposta;
    return resposta;
  };
  request.urls = [];
  return request;
}

test('normaliza e formata o CEP', () => {
  assert.equal(normalizeCep('30130-010'), '30130010');
  assert.equal(normalizeCep('3013'), null);
  assert.equal(normalizeCep(null), null);
  assert.equal(formatCep('30130010'), '30130-010');
  assert.equal(formatCep('301'), '301');
  assert.equal(formatCep('30130-0109999'), '30130-010');
});

test('consulta o CEP na BrasilAPI', async () => {
  const fetchJson = rotas({ brasilapi: brasilApi });
  assert.deepEqual(await lookupCep('30130-010', { fetchJson }), {
    uf: 'mg',
    city: 'Belo Horizonte',
    cep: '30130010',
    source: 'BrasilAPI',
  });
  assert.equal(fetchJson.urls.length, 1);
});

test('usa o ViaCEP quando a BrasilAPI está fora do ar', async () => {
  const fetchJson = rotas({
    brasilapi: new HttpError('status', 'https://brasilapi.com.br', { status: 503 }),
    viacep: viaCep,
  });
  const lugar = await lookupCep('30130010', { fetchJson });
  assert.equal(lugar.source, 'ViaCEP');
  assert.equal(lugar.uf, 'mg');
});

test('CEP inexistente não aciona a alternativa', async () => {
  const fetchJson = rotas({
    brasilapi: new HttpError('status', 'https://brasilapi.com.br', { status: 404 }),
    viacep: viaCep,
  });
  await assert.rejects(lookupCep('00000000', { fetchJson }), codigo('not-found'));
  assert.equal(fetchJson.urls.length, 1);
});

test('informa os erros de CEP com mensagens distintas', async () => {
  await assert.rejects(lookupCep('123'), codigo('invalid-cep'));
  const semServico = rotas({
    brasilapi: new HttpError('network', 'https://brasilapi.com.br'),
    viacep: new HttpError('timeout', 'https://viacep.com.br'),
  });
  await assert.rejects(lookupCep('30130010', { fetchJson: semServico }), codigo('unavailable'));
  const naoExiste = rotas({
    brasilapi: new HttpError('network', 'https://brasilapi.com.br'),
    viacep: { erro: 'true' },
  });
  await assert.rejects(lookupCep('30130010', { fetchJson: naoExiste }), codigo('not-found'));
});

test('reaproveita a consulta de CEP guardada no cache', async () => {
  const guardado = new Map();
  const cache = { get: (k) => guardado.get(k) ?? null, set: (k, v) => guardado.set(k, v) };
  const fetchJson = rotas({ brasilapi: brasilApi });
  await lookupCep('30130010', { fetchJson, cache });
  await lookupCep('30130-010', { fetchJson, cache });
  assert.equal(fetchJson.urls.length, 1);
});

test('lê cidade e estado da resposta do OpenStreetMap', () => {
  const br = { address: { city: 'Curitiba', 'ISO3166-2-lvl4': 'BR-PR', country_code: 'br' } };
  assert.deepEqual(parseReverseGeocode(br), {
    uf: 'pr',
    city: 'Curitiba',
    cep: null,
    source: 'OpenStreetMap',
  });
  const fora = { address: { city: 'Lisboa', country_code: 'pt' } };
  assert.throws(() => parseReverseGeocode(fora), codigo('outside'));
  assert.throws(() => parseReverseGeocode({}), codigo('unavailable'));
});

test('localiza pelo aparelho enviando coordenadas arredondadas', async () => {
  const geolocation = {
    getCurrentPosition: (ok) => ok({ coords: { latitude: -19.923456, longitude: -43.938765 } }),
  };
  const fetchJson = rotas({
    nominatim: { address: { town: 'Contagem', 'ISO3166-2-lvl4': 'BR-MG', country_code: 'br' } },
  });
  const lugar = await locateByDevice({ fetchJson, geolocation });
  assert.equal(lugar.city, 'Contagem');
  assert.match(fetchJson.urls[0], /lat=-19\.92&lon=-43\.94$/);
});

test('traduz a recusa de permissão de localização', async () => {
  const negada = { getCurrentPosition: (ok, falha) => falha({ code: 1 }) };
  await assert.rejects(locateByDevice({ geolocation: negada }), codigo('denied'));
  const semSinal = { getCurrentPosition: (ok, falha) => falha({ code: 2 }) };
  await assert.rejects(locateByDevice({ geolocation: semSinal }), codigo('unavailable'));
});
