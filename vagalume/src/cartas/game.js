import { buildDeck, shuffle } from "./deck.js";
import { isPlayable } from "./rules.js";
import { chooseCard, chooseColor } from "./ai.js";
import { loadStats, saveStats } from "./storage.js";

const HUMANO = 0;
const IA = 1;

const el = {
  discard: document.getElementById("discard"),
  deck: document.getElementById("deck"),
  hand: document.getElementById("hand"),
  log: document.getElementById("log"),
  status: document.getElementById("status"),
  score: document.getElementById("score"),
  pass: document.getElementById("pass"),
  overlay: document.getElementById("overlay"),
  colors: document.getElementById("colors"),
  result: document.getElementById("result"),
  restart: document.getElementById("restart"),
};

let estado = null;
let stats = { wins: 0, losses: 0 };
let coringaPendente = null;

function topCard() {
  return estado.discard[estado.discard.length - 1];
}

function corLabel(cor) {
  return { rosa: "Rosa", laranja: "Laranja", lima: "Lima", azul: "Azul" }[cor] || "—";
}

function label(card) {
  if (card.value === "skip") return `Pular ${corLabel(card.color)}`;
  if (card.value === "reverse") return `Inverter ${corLabel(card.color)}`;
  if (card.value === "draw2") return `+2 ${corLabel(card.color)}`;
  if (card.value === "wild") return "Coringa";
  if (card.value === "wild4") return "Coringa +4";
  return `${card.value} ${corLabel(card.color)}`;
}

function face(card) {
  if (card.value === "skip") return "⊘";
  if (card.value === "reverse") return "⇄";
  if (card.value === "draw2") return "+2";
  if (card.value === "wild") return "★";
  if (card.value === "wild4") return "+4";
  return card.value;
}

function log(texto) {
  estado.log.unshift(texto);
  estado.log = estado.log.slice(0, 6);
}

function cardEl(card, pequeno) {
  const d = document.createElement("div");
  d.className = `card ${card.color || "wild"}${pequeno ? "" : " big"}`;
  d.textContent = face(card);
  return d;
}

function newGame() {
  const baralho = shuffle(buildDeck());
  estado = {
    deck: baralho,
    discard: [],
    hands: [[], []],
    turn: HUMANO,
    activeColor: null,
    pendingDraw: 0,
    skipNext: false,
    drawnThisTurn: false,
    over: false,
    log: [],
  };
  for (let i = 0; i < 7; i++) {
    estado.hands[HUMANO].push(estado.deck.pop());
    estado.hands[IA].push(estado.deck.pop());
  }
  let primeira = estado.deck.pop();
  while (primeira.type !== "number") {
    estado.deck.unshift(primeira);
    primeira = estado.deck.pop();
  }
  estado.discard.push(primeira);
  estado.activeColor = primeira.color;
  log("Nova partida.");
  render();
  beginTurn();
}

function drawCards(n) {
  const saida = [];
  for (let i = 0; i < n; i++) {
    if (!estado.deck.length) {
      if (estado.discard.length <= 1) break;
      const topo = estado.discard.pop();
      estado.deck = shuffle(estado.discard);
      estado.discard = [topo];
    }
    saida.push(estado.deck.pop());
  }
  return saida;
}

function beginTurn() {
  if (estado.over) return;
  render();
  if (estado.turn === IA) setTimeout(aiTurn, 800);
}

function nextTurn() {
  if (estado.over) return;
  estado.turn = 1 - estado.turn;
  if (estado.skipNext) {
    estado.skipNext = false;
    log(`${estado.turn === IA ? "IA" : "Você"} pulou a vez.`);
    estado.turn = 1 - estado.turn;
  }
  estado.drawnThisTurn = false;
  beginTurn();
}

function commitPlay(jogador, card, corEscolhida) {
  const mao = estado.hands[jogador];
  const idx = mao.findIndex((c) => c.id === card.id);
  if (idx === -1) return;
  mao.splice(idx, 1);
  estado.discard.push(card);
  estado.activeColor = card.type === "wild" ? corEscolhida : card.color;
  const quem = jogador === HUMANO ? "Você" : "IA";
  if (card.value === "wild") log(`${quem} jogou Coringa → ${corLabel(corEscolhida)}.`);
  else if (card.value === "wild4") log(`${quem} jogou Coringa +4 → ${corLabel(corEscolhida)}.`);
  else log(`${quem} jogou ${label(card)}.`);
  if (card.value === "skip") estado.skipNext = true;
  if (card.value === "reverse") estado.skipNext = true;
  if (card.value === "draw2") estado.pendingDraw += 2;
  if (card.value === "wild4") estado.pendingDraw += 4;
  if (mao.length === 0) return finish(jogador);
  if (mao.length === 1) log(`${quem} gritou Última!`);
  nextTurn();
}

function humanPlay(cardId) {
  if (!estado || estado.over || estado.turn !== HUMANO) return;
  const card = estado.hands[HUMANO].find((c) => c.id === cardId);
  if (!card) return;
  if (!isPlayable(card, topCard(), estado.activeColor, estado.pendingDraw)) return;
  if (card.type === "wild") {
    coringaPendente = card;
    el.colors.hidden = false;
    el.overlay.hidden = false;
    return;
  }
  commitPlay(HUMANO, card, null);
}

function humanDraw() {
  if (!estado || estado.over || estado.turn !== HUMANO) return;
  if (estado.drawnThisTurn) return;
  if (estado.pendingDraw > 0) {
    const n = estado.pendingDraw;
    estado.hands[HUMANO].push(...drawCards(n));
    estado.pendingDraw = 0;
    log(`Você comprou ${n}.`);
    return nextTurn();
  }
  const [c] = drawCards(1);
  if (c) estado.hands[HUMANO].push(c);
  estado.drawnThisTurn = true;
  log("Você comprou 1.");
  render();
}

function aiTurn() {
  if (!estado || estado.over || estado.turn !== IA) return;
  const topo = topCard();
  if (estado.pendingDraw > 0) {
    const empilha = estado.hands[IA].find((c) => isPlayable(c, topo, estado.activeColor, estado.pendingDraw));
    if (empilha) {
      const cor = empilha.type === "wild" ? chooseColor(estado.hands[IA]) : null;
      return commitPlay(IA, empilha, cor);
    }
    const n = estado.pendingDraw;
    estado.hands[IA].push(...drawCards(n));
    estado.pendingDraw = 0;
    log(`IA comprou ${n}.`);
    return nextTurn();
  }
  const escolha = chooseCard(estado.hands[IA], topo, estado.activeColor, 0);
  if (escolha) {
    const cor = escolha.type === "wild" ? chooseColor(estado.hands[IA]) : null;
    return commitPlay(IA, escolha, cor);
  }
  const [c] = drawCards(1);
  if (c) estado.hands[IA].push(c);
  log("IA comprou 1.");
  render();
  setTimeout(() => {
    if (!estado || estado.over) return;
    if (c && isPlayable(c, topCard(), estado.activeColor, 0)) {
      const cor = c.type === "wild" ? chooseColor(estado.hands[IA]) : null;
      commitPlay(IA, c, cor);
    } else {
      nextTurn();
    }
  }, 700);
}

async function finish(jogador) {
  estado.over = true;
  if (jogador === HUMANO) {
    stats.wins++;
    log("Você venceu!");
  } else {
    stats.losses++;
    log("A IA venceu.");
  }
  await saveStats(stats);
  render();
  el.result.textContent = jogador === HUMANO ? "Você venceu!" : "A IA venceu.";
  el.result.hidden = false;
  el.restart.hidden = false;
  el.overlay.hidden = false;
}

function render() {
  if (!estado) return;
  el.score.textContent = `Vitórias ${stats.wins} · Derrotas ${stats.losses}`;
  el.discard.replaceChildren();
  const topo = topCard();
  if (topo) el.discard.appendChild(cardEl(topo, false));
  el.deck.textContent = estado.deck.length;
  el.hand.replaceChildren();
  const vezDoHumano = estado.turn === HUMANO && !estado.over;
  for (const card of estado.hands[HUMANO]) {
    const node = cardEl(card, true);
    if (vezDoHumano && isPlayable(card, topo, estado.activeColor, estado.pendingDraw)) {
      node.classList.add("playable");
      node.addEventListener("click", () => humanPlay(card.id));
    } else {
      node.classList.add("dim");
    }
    el.hand.appendChild(node);
  }
  el.log.replaceChildren();
  for (const linha of estado.log) {
    const li = document.createElement("li");
    li.textContent = linha;
    el.log.appendChild(li);
  }
  el.pass.hidden = !(vezDoHumano && estado.drawnThisTurn);
  if (estado.over) el.status.textContent = "Partida encerrada";
  else if (estado.turn === IA) el.status.textContent = "Vez da IA…";
  else if (estado.pendingDraw > 0) el.status.textContent = `Compre ${estado.pendingDraw} ou empilhe`;
  else el.status.textContent = "Sua vez";
}

el.deck.addEventListener("click", humanDraw);

el.pass.addEventListener("click", () => {
  if (estado && estado.turn === HUMANO && estado.drawnThisTurn) nextTurn();
});

el.colors.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-color]");
  if (!btn) return;
  el.colors.hidden = true;
  el.overlay.hidden = true;
  const card = coringaPendente;
  coringaPendente = null;
  if (card) commitPlay(HUMANO, card, btn.dataset.color);
});

el.restart.addEventListener("click", () => {
  el.overlay.hidden = true;
  el.result.hidden = true;
  el.restart.hidden = true;
  newGame();
});

(async () => {
  stats = await loadStats();
  newGame();
})();
