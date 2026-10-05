/**
 * Motor de cálculo do simulador.
 *
 * Funções puras, sem acesso ao DOM nem à rede: recebem a rotina, o veículo e
 * as premissas e devolvem números. Rodam igual no navegador e no Node, o que
 * permite testá-las isoladamente.
 */

/**
 * @typedef {object} RoutineInput
 * @property {number} kmDay quilômetros rodados por dia
 * @property {number} daysMonth dias de uso por mês
 * @property {'yes'|'no'} charging 'yes' se há recarga em casa ou no trabalho
 */

/**
 * @typedef {object} Assumptions
 * @property {number} rangeFactor fração da autonomia nominal obtida no uso real
 * @property {number} window fração da bateria usada no dia a dia
 * @property {number} efficiency aproveitamento da recarga (1 = sem perdas)
 * @property {number} safety margem aplicada ao trajeto diário (1,3 = 30% de folga)
 * @property {number} homeTariff energia em casa ou no trabalho, em R$/kWh
 * @property {number} publicTariff energia em ponto público, em R$/kWh
 * @property {number} gasPrice gasolina, em R$/L
 * @property {number} [electricRent] mensalidade do elétrico, em R$
 * @property {number} [gasRent] mensalidade do carro a gasolina, em R$
 */

/**
 * @typedef {object} Simulation
 * @property {'fits'|'adjust'|'not-fit'} status
 * @property {number} monthlyKm
 * @property {number} effectiveRange autonomia esperada no uso real, em km
 * @property {number} usableRange autonomia entre recargas no dia a dia, em km
 * @property {number} maxKmDay maior trajeto diário que cabe com a margem de segurança
 * @property {number} consumption kWh por km
 * @property {number} tariff tarifa de energia aplicada, em R$/kWh
 * @property {number} electricCost energia no mês, em R$
 * @property {number} fuelCost gasolina no mês, em R$
 * @property {number} electricRent
 * @property {number} gasRent
 * @property {number} electricTotal assinatura + energia
 * @property {number} fuelTotal assinatura + gasolina
 * @property {number} savings quanto o elétrico economiza no mês (negativo se custa mais)
 * @property {number} energySavings economia só de energia × gasolina
 * @property {number} electricPerKm
 * @property {number} fuelPerKm
 */

/**
 * Compara o custo mensal do elétrico com o do equivalente a gasolina e diz
 * se a rotina cabe na autonomia.
 *
 * @param {RoutineInput} input rotina do cliente
 * @param {{ range: number, battery: number, gas: { urban: number } }} car elétrico e seu par a gasolina
 * @param {Assumptions} a premissas do cálculo
 * @returns {Simulation}
 */
export function simulate(input, car, a) {
  const positive = [
    input.kmDay,
    input.daysMonth,
    car.range,
    car.battery,
    car.gas?.urban,
    a.homeTariff,
    a.publicTariff,
    a.gasPrice,
    a.rangeFactor,
    a.window,
    a.efficiency,
    a.safety,
  ];
  if (
    positive.some((n) => !Number.isFinite(n) || n <= 0) ||
    input.daysMonth > 31 ||
    input.kmDay > 1000 ||
    !['yes', 'no'].includes(input.charging) ||
    a.rangeFactor > 1 ||
    a.window > 1 ||
    a.efficiency > 1 ||
    a.safety < 1
  )
    throw new Error('Confira os valores da simulação.');

  // Autonomia: desconta uso real (rangeFactor) e a faixa de bateria usada no dia a dia (window).
  const monthlyKm = input.kmDay * input.daysMonth;
  const effectiveRange = car.range * a.rangeFactor;
  const usableRange = effectiveRange * a.window;

  // Custo de rodar: kWh/km com perdas de recarga × tarifa, contra litros × preço da gasolina.
  const consumption = car.battery / effectiveRange;
  const tariff = input.charging === 'yes' ? a.homeTariff : a.publicTariff;
  const electricCost = ((monthlyKm * consumption) / a.efficiency) * tariff;
  const fuelCost = (monthlyKm / car.gas.urban) * a.gasPrice;

  // Custo total: assinatura + energia ou combustível.
  const electricRent = a.electricRent ?? 0;
  const gasRent = a.gasRent ?? 0;
  if (![electricRent, gasRent].every((n) => Number.isFinite(n) && n >= 0))
    throw new Error('Confira os valores da assinatura.');
  const electricTotal = electricCost + electricRent;
  const fuelTotal = fuelCost + gasRent;

  // Não cabe se o trajeto diário (com margem) passa da autonomia útil; sem recarga própria, pede atenção.
  const status =
    input.kmDay * a.safety > usableRange ? 'not-fit' : input.charging === 'no' ? 'adjust' : 'fits';

  return {
    status,
    monthlyKm,
    effectiveRange,
    usableRange,
    maxKmDay: usableRange / a.safety,
    consumption,
    tariff,
    electricCost,
    fuelCost,
    electricRent,
    gasRent,
    electricTotal,
    fuelTotal,
    savings: fuelTotal - electricTotal,
    energySavings: fuelCost - electricCost,
    electricPerKm: electricCost / monthlyKm,
    fuelPerKm: fuelCost / monthlyKm,
  };
}

/**
 * @typedef {object} BreakEven
 * @property {'always'|'above'|'below'|'never'} kind
 *   'always': o elétrico custa menos em qualquer quilometragem;
 *   'above': passa a custar menos a partir de `kmDay`;
 *   'below': custa menos só até `kmDay`;
 *   'never': não custa menos em nenhuma quilometragem.
 * @property {number|null} kmDay quilometragem diária do ponto de equilíbrio
 */

/**
 * Calcula a partir de quantos km por dia o elétrico compensa.
 *
 * O custo total é uma reta em função dos km rodados: a mensalidade é a parte
 * fixa e o custo por km é a inclinação. O ponto de equilíbrio é onde a reta do
 * elétrico cruza a do carro a gasolina.
 *
 * @param {Pick<Simulation, 'electricPerKm'|'fuelPerKm'|'electricRent'|'gasRent'>} simulation
 * @param {number} daysMonth dias de uso por mês
 * @returns {BreakEven}
 */
export function breakEven(simulation, daysMonth) {
  const savingPerKm = simulation.fuelPerKm - simulation.electricPerKm;
  const rentGap = simulation.electricRent - simulation.gasRent;

  if (savingPerKm > 0) {
    // Rodar com o elétrico custa menos: cada km ajuda a pagar a diferença de mensalidade.
    if (rentGap <= 0) return { kind: 'always', kmDay: null };
    return { kind: 'above', kmDay: rentGap / savingPerKm / daysMonth };
  }
  // Rodar com o elétrico custa igual ou mais (recarga cara): só vale se a mensalidade for menor.
  if (rentGap >= 0 || savingPerKm === 0)
    return { kind: rentGap < 0 ? 'always' : 'never', kmDay: null };
  return { kind: 'below', kmDay: rentGap / savingPerKm / daysMonth };
}
