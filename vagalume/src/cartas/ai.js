import { COLORS } from "./deck.js";
import { isPlayable } from "./rules.js";

export function chooseCard(hand, top, activeColor, pendingDraw) {
  const jogaveis = hand.filter((c) => isPlayable(c, top, activeColor, pendingDraw));
  if (!jogaveis.length) return null;
  const numeros = jogaveis.filter((c) => c.type === "number");
  if (numeros.length) {
    const mesmaCor = numeros.filter((c) => c.color === activeColor);
    const pool = mesmaCor.length ? mesmaCor : numeros;
    return pool.sort((a, b) => Number(a.value) - Number(b.value))[0];
  }
  const acoes = jogaveis.filter((c) => c.type === "action");
  if (acoes.length) return acoes[0];
  return jogaveis[0];
}

export function chooseColor(hand) {
  const contagem = {};
  for (const c of hand) {
    if (c.color) contagem[c.color] = (contagem[c.color] || 0) + 1;
  }
  let melhor = COLORS[0];
  let maior = -1;
  for (const cor of COLORS) {
    const n = contagem[cor] || 0;
    if (n > maior) {
      maior = n;
      melhor = cor;
    }
  }
  return melhor;
}
