/**
 * Elétricos oferecidos e seus equivalentes a gasolina.
 *
 * Todo elétrico é automático, então cada par a gasolina é um hatch automático
 * de porte e proposta próximos: comparar com versões manuais de entrada
 * exageraria a diferença de mensalidade.
 *
 * `range` (km) e `battery` (kWh) são dados nominais do elétrico; `urban` é o
 * consumo urbano do par a gasolina, em km/L (PBE Veicular/Inmetro).
 *
 * `rent` é a mensalidade estimada, em R$, e pode ser trocada pelo cliente na
 * interface. Origem de cada valor (planos de 48 meses e 1.000 km/mês):
 *  - Dolphin Mini e Dolphin: preços "a partir de" divulgados para a Localiza Meoo.
 *  - Onix LTZ Turbo AT: oferta de assinatura encontrada no mercado, não da Localiza.
 *  - Argo Drive CVT: estimativa proporcional ao preço de tabela; sem oferta publicada.
 */
export const CARS = {
  mini: {
    id: 'mini',
    name: 'Dolphin Mini',
    version: 'GS',
    full: 'BYD Dolphin Mini GS',
    image: 'assets/img/byd-dolphin-mini.png',
    range: 280,
    battery: 38.88,
    category: 'Subcompactos',
    rent: 2870,
    gas: {
      name: 'Argo',
      full: 'Fiat Argo Drive 1.3 CVT',
      version: 'Drive 1.3 automático',
      image: 'assets/img/fiat-argo.png',
      urban: 12.8,
      rent: 2250,
    },
  },
  dolphin: {
    id: 'dolphin',
    name: 'Dolphin',
    version: 'GS',
    full: 'BYD Dolphin GS',
    image: 'assets/img/byd-dolphin.png',
    range: 291,
    battery: 44.9,
    category: 'Hatches médios',
    rent: 3580,
    gas: {
      name: 'Onix',
      full: 'Chevrolet Onix LTZ 1.0 Turbo AT',
      version: 'LTZ 1.0 Turbo automático',
      image: 'assets/img/chevrolet-onix.png',
      urban: 12.0,
      rent: 2700,
    },
  },
};

/** Plano a que as mensalidades estimadas se referem. */
export const RENT_PLAN = '48 meses · 1.000 km/mês';

/** Ilustrações 3D. */
export const ARTWORK = {
  battery: 'assets/img/battery-3d.png',
  money: 'assets/img/money-3d.png',
};
