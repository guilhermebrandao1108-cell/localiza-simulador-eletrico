/**
 * Premissas do cálculo. Todas aparecem para o cliente em "Como calculamos",
 * e as tarifas e mensalidades podem ser trocadas na interface.
 */
export const ASSUMPTIONS = {
  /** Autonomia obtida no uso real, em relação à nominal. */
  rangeFactor: 0.8,
  /** Faixa de bateria usada no dia a dia: entre 20% e 80%. */
  window: 0.6,
  /** Aproveitamento da recarga: 10% de perdas. */
  efficiency: 0.9,
  /** Margem aplicada ao trajeto diário: 30% de folga. */
  safety: 1.3,
  /** Energia em ponto público, em R$/kWh. Valor de exemplo: não há fonte pública consolidada. */
  publicTariff: 2.5,
};

/**
 * Impostos sobre a tarifa residencial (ICMS e PIS/Cofins), como multiplicador.
 * Estimativa única para o país: as alíquotas variam por estado e por mês.
 */
export const ENERGY_TAX_FACTOR = 1.3;

/** Tarifa de energia usada se faltar o dado de um estado, em R$/kWh. */
export const HOME_TARIFF_FALLBACK = 1.2;

/** Rotina exibida ao abrir o simulador. */
export const DEFAULT_INPUT = { car: 'mini', kmDay: 40, daysMonth: 30, charging: 'yes', uf: 'mg' };

/** Limites dos campos, compartilhados entre o formulário e a leitura de links. */
export const LIMITS = {
  kmDay: { min: 10, max: 240, step: 5 },
  daysMonth: { min: 1, max: 31 },
  rent: { min: 0, max: 50000 },
  tariff: { min: 0.01, max: 20 },
};
