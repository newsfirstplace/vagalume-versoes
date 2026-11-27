export function isPlayable(card, top, activeColor, pendingDraw) {
  if (!top) return true;
  if (pendingDraw > 0) return card.value === top.value;
  if (card.type === "wild") return true;
  if (card.color === activeColor) return true;
  return card.value === top.value;
}
