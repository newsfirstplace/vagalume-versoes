// Vagalume — regras do jogo de damas (regra brasileira) e um bot (pedido do usuário em 2026-11-22). Puro, sem página.
// Tabuleiro 8 × 8, peças nas casas escuras (a1 é escura), brancas embaixo e começam. Pedra anda uma casa para a
// frente e captura para a frente e para trás; captura é obrigatória e vale a lei da maioria (o caminho que toma
// mais peças); peças tomadas só saem no fim do lance e não podem ser puladas duas vezes; dama voa (anda e captura
// a qualquer distância); a pedra só vira dama se terminar o lance na última fileira. Empate: 20 lances seguidos só
// de damas sem captura (de cada lado) ou a mesma posição três vezes. Quem não tem lance perde.
// Casas: índice 0 a 63 como no xadrez (linha 0 = oitava fileira, lado das pretas). Peças: w/W brancas (W dama), b/B pretas.
(function (raiz) {
  'use strict';
  const COLUNAS = 'abcdefgh';
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const corDe = (p) => (p ? p.toLowerCase() : null);
  const outra = (c) => (c === 'w' ? 'b' : 'w');
  const ehDama = (p) => p === 'W' || p === 'B';
  const escura = (i) => ((i >> 3) + (i & 7)) % 2 === 1;
  const casa = (i) => COLUNAS[i & 7] + (8 - (i >> 3));
  function indice(nome) {
    const m = /^([a-h])([1-8])$/.exec(String(nome || ''));
    return m ? (8 - Number(m[2])) * 8 + COLUNAS.indexOf(m[1]) : -1;
  }

  function novo() {
    const tab = new Array(64).fill('');
    for (let i = 0; i < 64; i++) if (escura(i)) { const r = i >> 3; if (r <= 2) tab[i] = 'b'; else if (r >= 5) tab[i] = 'w'; }
    const e = { tab, vez: 'w', semCaptura: 0, posicoes: [] };
    e.posicoes.push(chave(e));
    return e;
  }
  function chave(e) { return e.tab.map((p) => p || '.').join('') + e.vez; }
  function copiar(e) { return { tab: e.tab.slice(), vez: e.vez, semCaptura: e.semCaptura, posicoes: e.posicoes.slice() }; }
  // Posição em texto (32 casas escuras de cima para baixo + vez), para sincronizar uma partida.
  function paraTexto(e) { let s = ''; for (let i = 0; i < 64; i++) if (escura(i)) s += e.tab[i] || '.'; return s + ' ' + e.vez + ' ' + e.semCaptura; }
  function deTexto(t) {
    const m = /^([wWbB.]{32}) ([wb]) (\d{1,3})$/.exec(String(t || ''));
    if (!m) throw new Error('posição inválida');
    const tab = new Array(64).fill('');
    let k = 0;
    for (let i = 0; i < 64; i++) if (escura(i)) { const ch = m[1][k++]; tab[i] = ch === '.' ? '' : ch; }
    const e = { tab, vez: m[2], semCaptura: Number(m[3]), posicoes: [] };
    e.posicoes.push(chave(e));
    return e;
  }

  // Todas as sequências de captura que começam na casa de origem (só as que não podem continuar).
  function capturasDe(tab, origem) {
    const peca = tab[origem], v = corDe(peca), dama = ehDama(peca);
    const b = tab.slice();
    b[origem] = ''; // a peça saiu da origem: pode passar por ela de novo
    const res = [];
    (function seguir(pos, caminho, tomadas) {
      let continuou = false;
      const r = pos >> 3, c = pos & 7;
      for (const [dr, dc] of DIAG) {
        if (!dama) {
          const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
          if (!dentro(r2, c2)) continue;
          const j = r1 * 8 + c1, k = r2 * 8 + c2;
          if (b[j] && corDe(b[j]) !== v && !tomadas.includes(j) && !b[k]) { continuou = true; seguir(k, caminho.concat(k), tomadas.concat(j)); }
        } else {
          let rr = r + dr, cc = c + dc;
          while (dentro(rr, cc) && !b[rr * 8 + cc]) { rr += dr; cc += dc; }
          if (!dentro(rr, cc)) continue;
          const j = rr * 8 + cc;
          if (corDe(b[j]) === v || tomadas.includes(j)) continue;
          let r2 = rr + dr, c2 = cc + dc;
          while (dentro(r2, c2) && !b[r2 * 8 + c2]) {
            continuou = true;
            seguir(r2 * 8 + c2, caminho.concat(r2 * 8 + c2), tomadas.concat(j));
            r2 += dr; c2 += dc;
          }
        }
      }
      if (!continuou && tomadas.length) res.push({ caminho, capturas: tomadas });
    })(origem, [origem], []);
    return res;
  }
  function promove(e, m) {
    const peca = e.tab[m.caminho[0]];
    const fim = m.caminho[m.caminho.length - 1] >> 3;
    return !ehDama(peca) && ((peca === 'w' && fim === 0) || (peca === 'b' && fim === 7));
  }
  function lances(e) {
    const b = e.tab, v = e.vez;
    let capturas = [];
    for (let i = 0; i < 64; i++) if (b[i] && corDe(b[i]) === v) capturas = capturas.concat(capturasDe(b, i));
    let lista;
    if (capturas.length) {
      const max = Math.max(...capturas.map((m) => m.capturas.length));
      lista = capturas.filter((m) => m.capturas.length === max);
    } else {
      lista = [];
      for (let i = 0; i < 64; i++) {
        const p = b[i];
        if (!p || corDe(p) !== v) continue;
        const r = i >> 3, c = i & 7;
        if (ehDama(p)) {
          for (const [dr, dc] of DIAG) {
            let rr = r + dr, cc = c + dc;
            while (dentro(rr, cc) && !b[rr * 8 + cc]) { lista.push({ caminho: [i, rr * 8 + cc], capturas: [] }); rr += dr; cc += dc; }
          }
        } else {
          const dr = v === 'w' ? -1 : 1;
          for (const dc of [-1, 1]) { const rr = r + dr, cc = c + dc; if (dentro(rr, cc) && !b[rr * 8 + cc]) lista.push({ caminho: [i, rr * 8 + cc], capturas: [] }); }
        }
      }
    }
    for (const m of lista) m.promove = promove(e, m);
    return lista;
  }
  function jogar(e, m) {
    const n = copiar(e);
    const de = m.caminho[0], para = m.caminho[m.caminho.length - 1];
    const peca = n.tab[de];
    n.tab[de] = '';
    for (const j of m.capturas) n.tab[j] = '';
    n.tab[para] = m.promove ? peca.toUpperCase() : peca;
    n.semCaptura = ehDama(peca) && !m.capturas.length ? n.semCaptura + 1 : 0;
    n.vez = outra(n.vez);
    n.posicoes.push(chave(n));
    return n;
  }
  function texto(m) { return m.caminho.map(casa).join(m.capturas.length ? 'x' : '-'); }
  function lanceDe(e, t) {
    const casas = String(t || '').toLowerCase().split(/[-x]/).map(indice);
    if (casas.length < 2 || casas.some((i) => i < 0)) return null;
    return lances(e).find((m) => m.caminho.length === casas.length && m.caminho.every((i, k) => i === casas[k])) || null;
  }
  function situacao(e) {
    if (!lances(e).length) return { fim: true, vencedor: outra(e.vez), motivo: e.tab.some((p) => corDe(p) === e.vez) ? 'sem lances' : 'todas as peças tomadas' };
    if (e.semCaptura >= 40) return { fim: true, vencedor: null, motivo: '20 lances de damas sem captura' };
    const k = chave(e);
    if (e.posicoes.filter((p) => p === k).length >= 3) return { fim: true, vencedor: null, motivo: 'repetição da posição' };
    return { fim: false };
  }

  // ---------- bot ----------
  function avaliar(e) {
    let s = 0;
    for (let i = 0; i < 64; i++) {
      const p = e.tab[i];
      if (!p) continue;
      const r = i >> 3, c = i & 7;
      let v;
      if (ehDama(p)) v = 330;
      else v = 100 + (p === 'w' ? (7 - r) : r) * 4 + ((r === 7 && p === 'w') || (r === 0 && p === 'b') ? 8 : 0); // avançar e guardar a última fileira
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 6; // centro
      s += corDe(p) === 'w' ? v : -v;
    }
    return e.vez === 'w' ? s : -s;
  }
  const VITORIA = 100000;
  const NIVEIS = { facil: { prof: 2, ms: 250, folga: 60 }, medio: { prof: 4, ms: 600, folga: 10 }, dificil: { prof: 8, ms: 1400, folga: 0 } };
  function melhorLance(estado, nivel, sorteio) {
    const n = NIVEIS[nivel] || NIVEIS.medio;
    const aleatorio = sorteio || Math.random;
    const todos = lances(estado);
    if (!todos.length) return null;
    if (todos.length === 1) return todos[0];
    const fim = Date.now() + n.ms;
    let nos = 0, parou = false;
    function negamax(e, prof, alfa, beta, ply) {
      if ((++nos & 511) === 0 && Date.now() > fim) parou = true;
      if (parou) return 0;
      const lista = lances(e);
      if (!lista.length) return -VITORIA + ply;
      if (prof <= 0 && !lista[0].capturas.length) return avaliar(e);
      if (prof <= -4) return avaliar(e); // capturas obrigatórias seguem um pouco além, sem ir longe demais
      lista.sort((a, b) => b.capturas.length - a.capturas.length);
      for (const m of lista) {
        const v = -negamax(jogar(e, m), prof - 1, -beta, -alfa, ply + 1);
        if (parou) return 0;
        if (v >= beta) return beta;
        if (v > alfa) alfa = v;
      }
      return alfa;
    }
    let escolhido = null, notas = null;
    for (let prof = 1; prof <= n.prof; prof++) {
      const lista = escolhido ? [escolhido].concat(todos.filter((m) => m !== escolhido)) : todos;
      let alfa = -Infinity, melhor = null;
      const atuais = [];
      for (const m of lista) {
        const v = -negamax(jogar(estado, m), prof - 1, -Infinity, n.folga > 0 ? Infinity : -alfa, 1);
        if (parou) break;
        atuais.push([m, v]);
        if (v > alfa) { alfa = v; melhor = m; }
      }
      if (parou) { if (!escolhido && melhor) escolhido = melhor; break; }
      escolhido = melhor;
      notas = atuais;
    }
    if (n.folga > 0 && notas && notas.length) {
      const topo = Math.max(...notas.map(([, v]) => v));
      const parecidos = notas.filter(([, v]) => v >= topo - n.folga);
      return parecidos[Math.floor(aleatorio() * parecidos.length)][0];
    }
    return escolhido || todos[0];
  }

  const api = { novo, lances, jogar, lanceDe, texto, situacao, melhorLance, avaliar, paraTexto, deTexto, casa, indice, escura, corDe, ehDama, NIVEIS };
  raiz.VL = raiz.VL || {};
  raiz.VL.damas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
