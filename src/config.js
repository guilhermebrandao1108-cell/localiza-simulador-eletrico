/** Endereços das APIs e parâmetros de rede e armazenamento. */

export const ENDPOINTS = {
  /** Preço médio da gasolina por estado. */
  fuel: 'https://combustivelapi.com.br/api/precos/',
  /** CEP → cidade e estado. */
  cep: (cep) => `https://brasilapi.com.br/api/cep/v2/${cep}`,
  /** Alternativa de CEP, usada quando a principal está fora do ar. */
  cepFallback: (cep) => `https://viacep.com.br/ws/${cep}/json/`,
  /** Coordenadas → cidade e estado (OpenStreetMap Nominatim). */
  reverseGeocode: (latitude, longitude) =>
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=pt-BR&lat=${latitude}&lon=${longitude}`,
};

export const REQUEST_TIMEOUT_MS = 12000;
export const GEOLOCATION_TIMEOUT_MS = 10000;

/** Prefixo das chaves no localStorage. Mude a versão ao alterar o formato salvo. */
export const STORAGE_PREFIX = 'localiza-simulador:v3:';

const DAY_MS = 24 * 60 * 60 * 1000;
/** CEPs mudam raramente: reaproveita a consulta por 30 dias. */
export const CEP_CACHE_MS = 30 * DAY_MS;
