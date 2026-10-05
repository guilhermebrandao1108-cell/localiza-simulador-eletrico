/** Preços de gasolina usados quando a API não responde ou não traz o estado. */

/** Última coleta salva da Combustível API: ponto de partida e reserva para uso offline. */
export const FUEL_SNAPSHOT = {
  error: false,
  data_coleta: '2026-10-03 01:52:36',
  fonte: 'https://precos.petrobras.com.br/',
  moeda: 'BRL',
  precos: {
    gasolina: {
      br: '6,55',
      al: '6,64',
      am: '7,32',
      ce: '6,98',
      df: '6,67',
      es: '6,45',
      go: '6,69',
      ma: '6,63',
      mt: '6,82',
      mg: '6,32',
      pr: '6,61',
      pb: '6,42',
      pa: '6,72',
      pe: '6,94',
      rs: '6,22',
      rj: '6,62',
      sc: '6,44',
      sp: '6,36',
    },
  },
};

/** Média ANP da gasolina comum por estado, usada quando a API não traz a UF. */
export const FUEL_ESTIMATE = {
  period: '20 a 26/09/2026',
  source:
    'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas',
  prices: {
    ac: 7.86,
    al: 6.85,
    am: 7.75,
    ap: 6.55,
    ba: 6.85,
    ce: 7.007,
    df: 6.67,
    es: 6.57,
    go: 6.626,
    ma: 6.828,
    mg: 6.317,
    ms: 6.634,
    mt: 6.83,
    pa: 6.864,
    pb: 6.515,
    pe: 6.867,
    pi: 6.763,
    pr: 6.531,
    rj: 6.711,
    rn: 6.858,
    ro: 7.355,
    rr: 7.56,
    rs: 6.342,
    sc: 6.439,
    se: 7.01,
    sp: 6.416,
    to: 6.936,
  },
};
