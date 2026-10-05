/**
 * Descobre a cidade e o estado do cliente, pelo CEP ou pela localização do
 * aparelho. O estado define os preços de gasolina e de energia da simulação.
 *
 * CEP: BrasilAPI, com o ViaCEP como alternativa se ela estiver fora do ar.
 * Localização: geolocalização do navegador + OpenStreetMap Nominatim.
 */
import { CEP_CACHE_MS, ENDPOINTS, GEOLOCATION_TIMEOUT_MS } from '../config.js';
import { STATES } from '../data/states.js';
import { fetchJson, HttpError } from './http.js';

/**
 * @typedef {object} Place
 * @property {string} uf sigla do estado, em minúsculas
 * @property {string} city
 * @property {string|null} cep oito dígitos, quando a busca foi por CEP
 * @property {string} source serviço que respondeu
 */

/** Erro com mensagem pronta para o cliente e um código para o programa. */
export class LocationError extends Error {
  /** @param {'invalid-cep'|'not-found'|'unavailable'|'denied'|'unsupported'|'outside'} code */
  constructor(code) {
    super(LocationError.MESSAGES[code]);
    this.name = 'LocationError';
    this.code = code;
  }

  static MESSAGES = {
    'invalid-cep': 'Digite um CEP com 8 dígitos.',
    'not-found': 'CEP não encontrado. Confira os números.',
    unavailable:
      'Não foi possível consultar agora. Escolha o estado em "Ajustar preços e assinatura".',
    denied: 'Sem permissão para usar a localização. Informe o CEP.',
    unsupported: 'Este navegador não informa a localização. Informe o CEP.',
    outside: 'A localização está fora do Brasil. Informe o CEP.',
  };
}

/** @returns {string|null} os oito dígitos do CEP, ou null se estiver incompleto */
export function normalizeCep(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 8 ? digits : null;
}

/** Aplica a máscara 00000-000 ao que já foi digitado. */
export function formatCep(value) {
  const digits = String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function place(uf, city, cep, source) {
  const key = typeof uf === 'string' ? uf.trim().toLowerCase() : '';
  const name = typeof city === 'string' ? city.trim() : '';
  if (!Object.hasOwn(STATES, key) || !name) throw new LocationError('not-found');
  return { uf: key, city: name, cep, source };
}

/** @returns {Place} */
export function parseBrasilApiCep(payload, cep) {
  return place(payload?.state, payload?.city, cep, 'BrasilAPI');
}

/** @returns {Place} */
export function parseViaCep(payload, cep) {
  // O ViaCEP responde 200 com { erro: true } quando o CEP não existe.
  if (!payload || payload.erro) throw new LocationError('not-found');
  return place(payload.uf, payload.localidade, cep, 'ViaCEP');
}

/** @returns {Place} */
export function parseReverseGeocode(payload) {
  const address = payload?.address;
  if (!address) throw new LocationError('unavailable');
  if (address.country_code !== 'br') throw new LocationError('outside');
  // "BR-MG" → "mg"
  const uf = String(address['ISO3166-2-lvl4'] ?? '').replace(/^BR-/i, '');
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  return place(uf, city, null, 'OpenStreetMap');
}

/**
 * Consulta um CEP.
 *
 * @param {string} value CEP como digitado, com ou sem máscara
 * @param {{ fetchJson?: typeof fetchJson, cache?: { get: Function, set: Function } }} [deps]
 * @returns {Promise<Place>}
 * @throws {LocationError}
 */
export async function lookupCep(value, { fetchJson: request = fetchJson, cache } = {}) {
  const cep = normalizeCep(value);
  if (!cep) throw new LocationError('invalid-cep');

  const cached = cache?.get(`cep:${cep}`, CEP_CACHE_MS);
  if (cached && Object.hasOwn(STATES, cached.uf) && cached.city) return cached;

  let found;
  try {
    found = parseBrasilApiCep(await request(ENDPOINTS.cep(cep)), cep);
  } catch (error) {
    // 4xx é resposta definitiva: o CEP não existe. Qualquer outra falha vale tentar a alternativa.
    if (error instanceof LocationError) throw error;
    if (error instanceof HttpError && !error.retryable) throw new LocationError('not-found');
    try {
      found = parseViaCep(await request(ENDPOINTS.cepFallback(cep)), cep);
    } catch (fallbackError) {
      if (fallbackError instanceof LocationError) throw fallbackError;
      throw new LocationError('unavailable');
    }
  }

  cache?.set(`cep:${cep}`, found);
  return found;
}

/**
 * Lê a posição do aparelho.
 *
 * @param {{ geolocation?: Geolocation, timeoutMs?: number }} [deps]
 * @returns {Promise<{ latitude: number, longitude: number }>}
 * @throws {LocationError}
 */
export function currentPosition({
  geolocation = globalThis.navigator?.geolocation,
  timeoutMs = GEOLOCATION_TIMEOUT_MS,
} = {}) {
  if (!geolocation) return Promise.reject(new LocationError('unsupported'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      // Código 1 = permissão negada; 2 e 3 = posição indisponível ou tempo esgotado.
      (error) => reject(new LocationError(error?.code === 1 ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/**
 * Descobre cidade e estado a partir da posição do aparelho.
 *
 * Só o estado importa para a simulação, então as coordenadas são arredondadas
 * para cerca de 1 km antes de sair do aparelho.
 *
 * @param {{ fetchJson?: typeof fetchJson, geolocation?: Geolocation }} [deps]
 * @returns {Promise<Place>}
 * @throws {LocationError}
 */
export async function locateByDevice({ fetchJson: request = fetchJson, geolocation } = {}) {
  const position = await currentPosition(geolocation ? { geolocation } : undefined);
  const url = ENDPOINTS.reverseGeocode(position.latitude.toFixed(2), position.longitude.toFixed(2));
  let payload;
  try {
    payload = await request(url);
  } catch {
    throw new LocationError('unavailable');
  }
  return parseReverseGeocode(payload);
}
