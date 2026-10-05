/** Mensagens exibidas para cada resultado da simulação. */
export const STATUS = {
  fits: {
    badge: 'Rotina compatível',
    title: 'Seu trajeto cabe na estimativa.',
    detail: 'Confirme a recarga em casa ou no trabalho.',
  },
  adjust: {
    badge: 'Planeje a recarga',
    title: 'Seu trajeto cabe. A recarga pede atenção.',
    detail: 'Confira os pontos públicos antes de sair.',
  },
  'not-fit': {
    badge: 'Rotina acima da autonomia',
    title: 'Este elétrico não cobre seu dia com folga.',
    detail: 'Seria preciso recarregar durante o dia.',
  },
};
