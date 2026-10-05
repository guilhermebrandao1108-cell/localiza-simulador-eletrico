/** Formatação de números, moeda e datas no padrão brasileiro. */

/** @param {number} n @param {number} [digits] casas decimais máximas */
export const number = (n, digits = 0) =>
  Number(n).toLocaleString('pt-BR', { maximumFractionDigits: digits });

/** @param {number} n @param {number} [digits] casas decimais */
export const brl = (n, digits = 0) =>
  Number(n).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** Converte "AAAA-MM-DD" (com ou sem horário) em "DD/MM/AAAA". */
export const brDate = (iso) => iso.slice(0, 10).split('-').reverse().join('/');
