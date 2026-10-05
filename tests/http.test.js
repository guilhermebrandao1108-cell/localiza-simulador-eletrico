import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchJson, HttpError } from '../src/services/http.js';

const resposta = (status, corpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});
/** fetch falso que devolve, a cada chamada, o próximo item da lista. */
function fila(...itens) {
  const fetchImpl = async () => {
    fetchImpl.chamadas++;
    const item = itens.shift();
    if (item instanceof Error) throw item;
    return item;
  };
  fetchImpl.chamadas = 0;
  return fetchImpl;
}
const semEspera = async () => {};
const URL_TESTE = 'https://api.exemplo.com/dados';

test('devolve o JSON quando a resposta é 200', async () => {
  const fetchImpl = fila(resposta(200, { ok: 1 }));
  assert.deepEqual(await fetchJson(URL_TESTE, { fetchImpl }), { ok: 1 });
  assert.equal(fetchImpl.chamadas, 1);
});

test('tenta de novo após erro do servidor e falha de rede', async () => {
  const fetchImpl = fila(resposta(503), new TypeError('rede'), resposta(200, { ok: 1 }));
  const esperas = [];
  const dados = await fetchJson(URL_TESTE, {
    fetchImpl,
    retries: 2,
    backoffMs: 100,
    sleep: async (ms) => void esperas.push(ms),
  });
  assert.deepEqual(dados, { ok: 1 });
  assert.deepEqual(esperas, [100, 200], 'a espera dobra a cada tentativa');
});

test('não insiste em erro definitivo (4xx)', async () => {
  const fetchImpl = fila(resposta(404), resposta(200, {}));
  await assert.rejects(fetchJson(URL_TESTE, { fetchImpl, sleep: semEspera }), (erro) => {
    assert.ok(erro instanceof HttpError);
    assert.equal(erro.status, 404);
    assert.equal(erro.retryable, false);
    return true;
  });
  assert.equal(fetchImpl.chamadas, 1);
});

test('desiste depois de esgotar as tentativas', async () => {
  const fetchImpl = fila(resposta(500), resposta(500), resposta(200, {}));
  await assert.rejects(
    fetchJson(URL_TESTE, { fetchImpl, retries: 1, sleep: semEspera }),
    (erro) => erro.kind === 'status' && erro.status === 500,
  );
  assert.equal(fetchImpl.chamadas, 2);
});

test('interrompe a requisição que passa do tempo limite', async () => {
  const fetchImpl = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abortada')));
    });
  await assert.rejects(
    fetchJson(URL_TESTE, { fetchImpl, timeoutMs: 10, retries: 0 }),
    (erro) => erro.kind === 'timeout' && erro.message.includes('api.exemplo.com'),
  );
});

test('classifica JSON inválido como erro de formato, sem nova tentativa', async () => {
  const quebrada = { ok: true, status: 200, json: async () => JSON.parse('<html>') };
  const fetchImpl = fila(quebrada, resposta(200, {}));
  await assert.rejects(
    fetchJson(URL_TESTE, { fetchImpl, sleep: semEspera }),
    (erro) => erro.kind === 'parse',
  );
  assert.equal(fetchImpl.chamadas, 1);
});
