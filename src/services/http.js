/**
 * Cliente HTTP usado por todos os serviços: JSON, tempo limite e nova
 * tentativa com espera crescente quando a falha é passageira.
 */
import { REQUEST_TIMEOUT_MS } from '../config.js';

/** Erro de rede com a causa classificada, para decidir entre repetir, usar alternativa ou desistir. */
export class HttpError extends Error {
  /**
   * @param {'network'|'timeout'|'status'|'parse'} kind
   * @param {string} url
   * @param {{ status?: number|null, cause?: unknown }} [details]
   */
  constructor(kind, url, { status = null, cause } = {}) {
    super(`${HttpError.describe(kind, status)} (${hostOf(url)})`, { cause });
    this.name = 'HttpError';
    this.kind = kind;
    this.url = url;
    this.status = status;
  }

  static describe(kind, status) {
    if (kind === 'timeout') return 'Tempo de resposta esgotado';
    if (kind === 'status') return `HTTP ${status}`;
    if (kind === 'parse') return 'Resposta em formato inválido';
    return 'Falha de rede';
  }

  /** Falhas passageiras: rede, tempo esgotado, limite de requisições e erros do servidor. */
  get retryable() {
    if (this.kind === 'network' || this.kind === 'timeout') return true;
    return this.kind === 'status' && (this.status === 429 || this.status >= 500);
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Busca um JSON.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.timeoutMs] tempo limite de cada tentativa
 * @param {number} [options.retries] novas tentativas após uma falha passageira
 * @param {number} [options.backoffMs] espera antes da 1ª nova tentativa; dobra a cada uma
 * @param {RequestInit} [options.init] opções extras do fetch
 * @param {typeof fetch} [options.fetchImpl] substituível nos testes
 * @param {(ms: number) => Promise<void>} [options.sleep] substituível nos testes
 * @returns {Promise<any>}
 * @throws {HttpError}
 */
export async function fetchJson(url, options = {}) {
  const {
    timeoutMs = REQUEST_TIMEOUT_MS,
    retries = 1,
    backoffMs = 500,
    init = {},
    fetchImpl = globalThis.fetch,
    sleep = wait,
  } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(url, timeoutMs, init, fetchImpl);
    } catch (error) {
      if (!(error instanceof HttpError) || !error.retryable || attempt >= retries) throw error;
      await sleep(backoffMs * 2 ** attempt);
    }
  }
}

async function requestOnce(url, timeoutMs, init, fetchImpl) {
  const controller = new AbortController();
  // O tempo limite cobre também a leitura do corpo, não só a chegada dos cabeçalhos.
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, {
        mode: 'cors',
        credentials: 'omit',
        ...init,
        signal: controller.signal,
      });
    } catch (cause) {
      throw new HttpError(controller.signal.aborted ? 'timeout' : 'network', url, { cause });
    }
    if (!response.ok) throw new HttpError('status', url, { status: response.status });
    try {
      return await response.json();
    } catch (cause) {
      const kind = controller.signal.aborted ? 'timeout' : 'parse';
      throw new HttpError(kind, url, { status: response.status, cause });
    }
  } finally {
    clearTimeout(timer);
  }
}
