/**
 * Leitura das tarifas residenciais nos dados abertos da ANEEL.
 *
 * A ANEEL publica a tarifa por distribuidora, não por estado. Aqui cada UF é
 * representada por suas principais distribuidoras, identificadas pelo CNPJ
 * (o nome muda quando a concessão troca de controlador; o CNPJ não).
 */

/** @typedef {{ cnpj: string, name: string }} Distributor */

/** @type {Record<string, Distributor[]>} */
export const DISTRIBUTORS_BY_UF = {
  ac: [{ cnpj: '04065033000170', name: 'Energisa Acre' }],
  al: [{ cnpj: '12272084000100', name: 'Equatorial Alagoas' }],
  am: [{ cnpj: '02341467000120', name: 'Amazonas Energia' }],
  ap: [{ cnpj: '05965546000109', name: 'CEA Equatorial' }],
  ba: [{ cnpj: '15139629000194', name: 'Neoenergia Coelba' }],
  ce: [{ cnpj: '07047251000170', name: 'Enel Ceará' }],
  df: [{ cnpj: '07522669000192', name: 'Neoenergia Brasília' }],
  es: [{ cnpj: '28152650000171', name: 'EDP Espírito Santo' }],
  go: [{ cnpj: '01543032000104', name: 'Equatorial Goiás' }],
  ma: [{ cnpj: '06272793000184', name: 'Equatorial Maranhão' }],
  mg: [{ cnpj: '06981180000116', name: 'Cemig' }],
  ms: [{ cnpj: '15413826000150', name: 'Energisa Mato Grosso do Sul' }],
  mt: [{ cnpj: '03467321000199', name: 'Energisa Mato Grosso' }],
  pa: [{ cnpj: '04895728000180', name: 'Equatorial Pará' }],
  pb: [{ cnpj: '09095183000140', name: 'Energisa Paraíba' }],
  pe: [{ cnpj: '10835932000108', name: 'Neoenergia Pernambuco' }],
  pi: [{ cnpj: '06840748000189', name: 'Equatorial Piauí' }],
  pr: [{ cnpj: '04368898000106', name: 'Copel' }],
  rj: [
    { cnpj: '60444437000146', name: 'Light' },
    { cnpj: '33050071000158', name: 'Enel Rio' },
  ],
  rn: [{ cnpj: '08324196000181', name: 'Neoenergia Cosern' }],
  ro: [{ cnpj: '05914650000166', name: 'Energisa Rondônia' }],
  rr: [{ cnpj: '02341470000144', name: 'Roraima Energia' }],
  rs: [
    { cnpj: '08467115000100', name: 'CEEE Equatorial' },
    { cnpj: '02016440000162', name: 'RGE' },
  ],
  sc: [{ cnpj: '08336783000190', name: 'Celesc' }],
  se: [{ cnpj: '13017462000163', name: 'Energisa Sergipe' }],
  sp: [
    { cnpj: '61695227000193', name: 'Enel São Paulo' },
    { cnpj: '33050196000188', name: 'CPFL Paulista' },
    { cnpj: '02328280000197', name: 'Neoenergia Elektro' },
    { cnpj: '02302100000106', name: 'EDP São Paulo' },
    { cnpj: '04172213000151', name: 'CPFL Piratininga' },
  ],
  to: [{ cnpj: '25086034000171', name: 'Energisa Tocantins' }],
};

/** Filtros que isolam a tarifa do consumidor residencial comum (grupo B1, sem tarifa branca). */
export const RESIDENTIAL_FILTERS = {
  DscBaseTarifaria: 'Tarifa de Aplicação',
  DscSubGrupo: 'B1',
  DscModalidadeTarifaria: 'Convencional',
  DscClasse: 'Residencial',
  DscSubClasse: 'Residencial',
  DscDetalhe: 'Não se aplica',
};

// Faixa plausível para a tarifa sem impostos, em R$/kWh. Fora dela, o dado é tratado como erro.
const MIN_TARIFF = 0.3;
const MAX_TARIFF = 2.5;

/** Converte um valor no formato brasileiro ("1.234,56") em número. */
export function parseBrNumber(value) {
  if (typeof value === 'number') return value;
  return Number(String(value).trim().replace(/\./g, '').replace(',', '.'));
}

/**
 * Escolhe, para cada distribuidora, a tarifa residencial mais recente já em
 * vigor na data informada.
 *
 * @param {object[]} records registros do recurso de tarifas homologadas
 * @param {string} today data de referência, no formato AAAA-MM-DD
 * @returns {Map<string, { tariff: number, since: string }>} tarifa (R$/kWh, sem impostos) por CNPJ
 */
export function currentTariffsByCnpj(records, today) {
  const current = new Map();
  for (const record of records) {
    const matches = Object.entries(RESIDENTIAL_FILTERS).every(
      ([field, value]) => record[field] === value,
    );
    if (!matches || record.DscUnidadeTerciaria !== 'MWh') continue;
    const since = record.DatInicioVigencia;
    if (typeof since !== 'string' || since > today) continue;
    // TUSD (uso da rede) + TE (energia), publicadas em R$/MWh.
    const tariff = (parseBrNumber(record.VlrTUSD) + parseBrNumber(record.VlrTE)) / 1000;
    if (!Number.isFinite(tariff) || tariff < MIN_TARIFF || tariff > MAX_TARIFF) continue;
    const known = current.get(record.NumCNPJDistribuidora);
    if (!known || since > known.since) current.set(record.NumCNPJDistribuidora, { tariff, since });
  }
  return current;
}

/**
 * Monta a tarifa de referência de cada estado: a média simples das suas
 * principais distribuidoras. Lança erro se faltar dado de alguma delas, para
 * que uma mudança na base da ANEEL nunca gere um arquivo incompleto.
 *
 * @param {object[]} records
 * @param {string} today
 * @param {Record<string, Distributor[]>} [distributorsByUf]
 * @returns {Record<string, { base: number, distributors: string[] }>}
 */
export function tariffsByUf(records, today, distributorsByUf = DISTRIBUTORS_BY_UF) {
  const current = currentTariffsByCnpj(records, today);
  const result = {};
  const missing = [];
  for (const [uf, distributors] of Object.entries(distributorsByUf)) {
    const found = distributors.filter((d) => current.has(d.cnpj));
    for (const d of distributors)
      if (!current.has(d.cnpj)) missing.push(`${uf.toUpperCase()}: ${d.name}`);
    if (!found.length) continue;
    const mean = found.reduce((sum, d) => sum + current.get(d.cnpj).tariff, 0) / found.length;
    result[uf] = { base: Math.round(mean * 10000) / 10000, distributors: found.map((d) => d.name) };
  }
  if (missing.length) throw new Error(`Sem tarifa vigente para: ${missing.join('; ')}`);
  return result;
}
