/**
 * Tarifa residencial de energia por estado, em R$/kWh e sem impostos.
 *
 * ARQUIVO GERADO por scripts/update-energy-tariffs.mjs. Não edite à mão:
 * rode `npm run update:energy` para atualizar.
 *
 * Fonte: ANEEL, tarifas de aplicação homologadas (grupo B1, residencial
 * convencional, TUSD + TE). Em estados com mais de uma distribuidora de grande
 * porte, o valor é a média simples entre elas.
 */
export const ENERGY_TARIFFS = {
  updatedAt: '2026-10-05',
  source: 'https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica',
  byUf: {
    ac: { base: 0.8297, distributors: ["Energisa Acre"] },
    al: { base: 0.8514, distributors: ["Equatorial Alagoas"] },
    am: { base: 0.8757, distributors: ["Amazonas Energia"] },
    ap: { base: 0.8252, distributors: ["CEA Equatorial"] },
    ba: { base: 0.8777, distributors: ["Neoenergia Coelba"] },
    ce: { base: 0.7018, distributors: ["Enel Ceará"] },
    df: { base: 0.8267, distributors: ["Neoenergia Brasília"] },
    es: { base: 0.8437, distributors: ["EDP Espírito Santo"] },
    go: { base: 0.8918, distributors: ["Equatorial Goiás"] },
    ma: { base: 0.8888, distributors: ["Equatorial Maranhão"] },
    mg: { base: 0.9033, distributors: ["Cemig"] },
    ms: { base: 0.9866, distributors: ["Energisa Mato Grosso do Sul"] },
    mt: { base: 0.8994, distributors: ["Energisa Mato Grosso"] },
    pa: { base: 0.9783, distributors: ["Equatorial Pará"] },
    pb: { base: 0.7097, distributors: ["Energisa Paraíba"] },
    pe: { base: 0.7989, distributors: ["Neoenergia Pernambuco"] },
    pi: { base: 0.9467, distributors: ["Equatorial Piauí"] },
    pr: { base: 0.768, distributors: ["Copel"] },
    rj: { base: 0.9708, distributors: ["Light", "Enel Rio"] },
    rn: { base: 0.7758, distributors: ["Neoenergia Cosern"] },
    ro: { base: 0.7624, distributors: ["Energisa Rondônia"] },
    rr: { base: 0.7895, distributors: ["Roraima Energia"] },
    rs: { base: 0.8833, distributors: ["CEEE Equatorial", "RGE"] },
    sc: { base: 0.7598, distributors: ["Celesc"] },
    se: { base: 0.7546, distributors: ["Energisa Sergipe"] },
    sp: { base: 0.7894, distributors: ["Enel São Paulo", "CPFL Paulista", "Neoenergia Elektro", "EDP São Paulo", "CPFL Piratininga"] },
    to: { base: 0.9928, distributors: ["Energisa Tocantins"] },
  },
};
