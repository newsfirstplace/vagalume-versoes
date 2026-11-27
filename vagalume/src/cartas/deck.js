// Cores do Vagalume no lugar das quatro do original, na mesma ordem (rosa, laranja, lima, azul).
export const COLORS = ["rosa", "laranja", "lima", "azul"];
export const ACTIONS = ["skip", "reverse", "draw2"];

export function buildDeck() {
  const deck = [];
  let id = 0;
  for (const color of COLORS) {
    deck.push({ id: id++, color, value: "0", type: "number" });
    for (let copia = 0; copia < 2; copia++) {
      for (let v = 1; v <= 9; v++) {
        deck.push({ id: id++, color, value: String(v), type: "number" });
      }
      for (const a of ACTIONS) {
        deck.push({ id: id++, color, value: a, type: "action" });
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: id++, color: null, value: "wild", type: "wild" });
    deck.push({ id: id++, color: null, value: "wild4", type: "wild" });
  }
  return deck;
}

export function shuffle(cards) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
