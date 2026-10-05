/**
 * Preço da energia em casa, a partir da tarifa homologada pela ANEEL.
 */

/**
 * @typedef {object} EnergyPrice
 * @property {number} price R$/kWh com impostos estimados
 * @property {number} base R$/kWh homologado pela ANEEL, sem impostos
 * @property {string[]} distributors distribuidoras consideradas
 */

/**
 * A ANEEL homologa a tarifa sem impostos. O valor da conta de luz inclui ICMS
 * e PIS/Cofins, que variam por estado e por mês; `taxFactor` os aproxima.
 *
 * @param {string} uf sigla do estado, em minúsculas
 * @param {{ byUf: Record<string, { base: number, distributors: string[] }> }} tariffs
 * @param {number} taxFactor multiplicador de impostos (1,3 = 30%)
 * @returns {EnergyPrice|null} null quando não há tarifa para o estado
 */
export function homeEnergyPrice(uf, tariffs, taxFactor) {
  const entry = tariffs.byUf[uf];
  if (!entry || !Number.isFinite(entry.base) || entry.base <= 0) return null;
  return {
    price: Math.round(entry.base * taxFactor * 100) / 100,
    base: entry.base,
    distributors: entry.distributors,
  };
}

/** Descreve as distribuidoras de um estado em poucas palavras, para a interface. */
export function describeDistributors(distributors) {
  if (distributors.length === 1) return distributors[0];
  if (distributors.length === 2) return `média de ${distributors[0]} e ${distributors[1]}`;
  return `média de ${distributors.length} distribuidoras`;
}
