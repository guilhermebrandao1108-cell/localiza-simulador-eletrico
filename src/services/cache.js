/**
 * Cache em localStorage com validade.
 *
 * O armazenamento pode faltar ou falhar (navegação privada, cota cheia,
 * bloqueio por política): nesses casos o cache simplesmente não guarda nada
 * e o app segue funcionando.
 */
import { STORAGE_PREFIX } from '../config.js';

/** Armazenamento em memória, usado quando não há localStorage. */
export function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  };
}

function browserStorage() {
  try {
    // Só o acesso à propriedade já lança erro quando o armazenamento está bloqueado.
    return globalThis.localStorage ?? memoryStorage();
  } catch {
    return memoryStorage();
  }
}

/**
 * @param {object} [options]
 * @param {Pick<Storage, 'getItem'|'setItem'|'removeItem'>} [options.storage]
 * @param {string} [options.prefix]
 * @param {() => number} [options.now] relógio, substituível nos testes
 */
export function createCache({
  storage = browserStorage(),
  prefix = STORAGE_PREFIX,
  now = Date.now,
} = {}) {
  return {
    /**
     * @param {string} key
     * @param {number} [maxAgeMs] idade máxima aceita; sem ela, o valor não expira
     * @returns {any|null} o valor salvo, ou null se não existe, expirou ou está corrompido
     */
    get(key, maxAgeMs = Infinity) {
      try {
        const raw = storage.getItem(prefix + key);
        if (raw === null) return null;
        const { savedAt, value } = JSON.parse(raw);
        if (typeof savedAt !== 'number' || now() - savedAt > maxAgeMs) return null;
        return value ?? null;
      } catch {
        return null;
      }
    },

    /** @returns {boolean} false se não foi possível salvar */
    set(key, value) {
      try {
        storage.setItem(prefix + key, JSON.stringify({ savedAt: now(), value }));
        return true;
      } catch {
        return false;
      }
    },

    remove(key) {
      try {
        storage.removeItem(prefix + key);
      } catch {
        // Sem armazenamento, não há o que remover.
      }
    },
  };
}
