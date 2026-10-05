import assert from 'node:assert/strict';
import test from 'node:test';
import { createCache, memoryStorage } from '../src/services/cache.js';

test('guarda e devolve valores', () => {
  const cache = createCache({ storage: memoryStorage() });
  assert.equal(cache.get('a'), null);
  assert.equal(cache.set('a', { n: 1 }), true);
  assert.deepEqual(cache.get('a'), { n: 1 });
  cache.remove('a');
  assert.equal(cache.get('a'), null);
});

test('ignora valores mais velhos que a validade pedida', () => {
  let agora = 1000;
  const cache = createCache({ storage: memoryStorage(), now: () => agora });
  cache.set('a', 'x');
  agora += 5000;
  assert.equal(cache.get('a', 10000), 'x');
  assert.equal(cache.get('a', 1000), null);
  assert.equal(cache.get('a'), 'x', 'sem validade, não expira');
});

test('trata conteúdo corrompido como ausente', () => {
  const storage = memoryStorage();
  storage.setItem('p:a', '{quebrado');
  storage.setItem('p:b', JSON.stringify({ value: 1 }));
  const cache = createCache({ storage, prefix: 'p:' });
  assert.equal(cache.get('a'), null);
  assert.equal(cache.get('b'), null, 'sem data de gravação');
});

test('segue funcionando quando o armazenamento falha', () => {
  const falha = () => {
    throw new Error('bloqueado');
  };
  const cache = createCache({ storage: { getItem: falha, setItem: falha, removeItem: falha } });
  assert.equal(cache.set('a', 1), false);
  assert.equal(cache.get('a'), null);
  assert.doesNotThrow(() => cache.remove('a'));
});
