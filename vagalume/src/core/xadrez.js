// Vagalume — regras do xadrez e um bot (pedido do usuário em 2026-11-22: o tabuleiro de xadrez do Habblet jogável
// entre Vagalumes ou contra o bot). Tudo puro, sem página: roque, en passant, promoção, xeque, xeque-mate,
// afogamento, 50 lances, repetição tripla e material insuficiente. Conferido por perft (testes/jogos.test.js).
// Casas: índice 0 a 63, linha 0 = oitava fileira (lado das pretas), coluna 0 = coluna a.
(function (raiz) {
  'use strict';
  const COLUNAS = 'abcdefgh';
  const N_DIR = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const K_DIR = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const B_DIR = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const R_DIR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const corDe = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
  const outra = (c) => (c === 'w' ? 'b' : 'w');
  const casa = (i) => COLUNAS[i & 7] + (8 - (i >> 3));
  function indice(nome) {
    const m = /^([a-h])([1-8])$/.exec(String(nome || ''));
    return m ? (8 - Number(m[2])) * 8 + COLUNAS.indexOf(m[1]) : -1;
  }

  // ---------- posição ----------
  function deFen(fen) {
    const partes = String(fen || '').trim().split(/\s+/);
    const linhas = (partes[0] || '').split('/');
    if (linhas.length !== 8) throw new Error('FEN inválido');
    const tab = [];
    for (const l of linhas) {
      for (const ch of l) {
        if (/[1-8]/.test(ch)) for (let k = 0; k < Number(ch); k++) tab.push('');
        else if (/[pnbrqkPNBRQK]/.test(ch)) tab.push(ch);
        else throw new Error('FEN inválido');
      }
    }
    if (tab.length !== 64) throw new Error('FEN inválido');
    const e = {
      tab,
      vez: partes[1] === 'b' ? 'b' : 'w',
      roque: partes[2] && partes[2] !== '-' ? partes[2].replace(/[^KQkq]/g, '') : '',
      ep: partes[3] && partes[3] !== '-' ? indice(partes[3]) : -1,
      meio: Number(partes[4]) || 0,
      lance: Number(partes[5]) || 1,
      posicoes: [],
    };
    e.posicoes.push(chave(e));
    return e;
  }
  function paraFen(e) {
    let s = '';
    for (let r = 0; r < 8; r++) {
      let vazio = 0;
      for (let c = 0; c < 8; c++) {
        const p = e.tab[r * 8 + c];
        if (!p) { vazio++; continue; }
        if (vazio) { s += vazio; vazio = 0; }
        s += p;
      }
      if (vazio) s += vazio;
      if (r < 7) s += '/';
    }
    return s + ' ' + e.vez + ' ' + (e.roque || '-') + ' ' + (e.ep >= 0 ? casa(e.ep) : '-') + ' ' + e.meio + ' ' + e.lance;
  }
  function chave(e) { return e.tab.map((p) => p || '.').join('') + e.vez + (e.roque || '-') + e.ep; }
  function novo() { return deFen(INICIAL); }
  function copiar(e) { return { tab: e.tab.slice(), vez: e.vez, roque: e.roque, ep: e.ep, meio: e.meio, lance: e.lance, posicoes: e.posicoes.slice() }; }

  // ---------- ataques e lances ----------
  function atacada(b, i, por) {
    const r = i >> 3, c = i & 7;
    const pr = por === 'w' ? r + 1 : r - 1, peao = por === 'w' ? 'P' : 'p';
    if (pr >= 0 && pr < 8) {
      if (c > 0 && b[pr * 8 + c - 1] === peao) return true;
      if (c < 7 && b[pr * 8 + c + 1] === peao) return true;
    }
    const cav = por === 'w' ? 'N' : 'n', rei = por === 'w' ? 'K' : 'k';
    for (const [dr, dc] of N_DIR) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === cav) return true; }
    for (const [dr, dc] of K_DIR) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === rei) return true; }
    const dama = por === 'w' ? 'Q' : 'q';
    const diag = por === 'w' ? 'B' : 'b', reta = por === 'w' ? 'R' : 'r';
    for (const [dirs, alvo] of [[B_DIR, diag], [R_DIR, reta]]) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const p = b[rr * 8 + cc];
          if (p) { if (p === alvo || p === dama) return true; break; }
          rr += dr; cc += dc;
        }
      }
    }
    return false;
  }
  function reiDe(b, cor) { const k = cor === 'w' ? 'K' : 'k'; return b.indexOf(k); }
  function emXeque(e, cor) { const c = cor || e.vez; const r = reiDe(e.tab, c); return r >= 0 && atacada(e.tab, r, outra(c)); }

  function pseudo(e) {
    const b = e.tab, v = e.vez, lista = [];
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || corDe(p) !== v) continue;
      const r = i >> 3, c = i & 7, t = p.toLowerCase();
      if (t === 'p') {
        const d = v === 'w' ? -1 : 1, ini = v === 'w' ? 6 : 1, ult = v === 'w' ? 0 : 7;
        const r1 = r + d;
        if (r1 < 0 || r1 > 7) continue;
        const add = (para, cap, ep) => {
          if ((para >> 3) === ult) for (const pr of 'qrbn') lista.push({ de: i, para, peca: p, captura: cap || null, promo: v === 'w' ? pr.toUpperCase() : pr });
          else lista.push({ de: i, para, peca: p, captura: cap || null, ep: !!ep });
        };
        if (!b[r1 * 8 + c]) {
          add(r1 * 8 + c, null);
          if (r === ini && !b[(r + 2 * d) * 8 + c]) lista.push({ de: i, para: (r + 2 * d) * 8 + c, peca: p, captura: null, duplo: true });
        }
        for (const dc of [-1, 1]) {
          const cc = c + dc;
          if (cc < 0 || cc > 7) continue;
          const j = r1 * 8 + cc;
          if (b[j] && corDe(b[j]) !== v) add(j, b[j]);
          else if (j === e.ep && !b[j]) add(j, v === 'w' ? 'p' : 'P', true);
        }
      } else if (t === 'n' || t === 'k') {
        for (const [dr, dc] of (t === 'n' ? N_DIR : K_DIR)) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          const j = rr * 8 + cc;
          if (!b[j] || corDe(b[j]) !== v) lista.push({ de: i, para: j, peca: p, captura: b[j] || null });
        }
      } else {
        const dirs = t === 'b' ? B_DIR : t === 'r' ? R_DIR : B_DIR.concat(R_DIR);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const j = rr * 8 + cc;
            if (!b[j]) lista.push({ de: i, para: j, peca: p, captura: null });
            else { if (corDe(b[j]) !== v) lista.push({ de: i, para: j, peca: p, captura: b[j] }); break; }
            rr += dr; cc += dc;
          }
        }
      }
    }
    // Roque: rei e torre nas casas iniciais, casas do meio vazias e o rei não passa por casa atacada.
    const inimigo = outra(v);
    if (v === 'w' && b[60] === 'K' && !atacada(b, 60, inimigo)) {
      if (e.roque.includes('K') && b[63] === 'R' && !b[61] && !b[62] && !atacada(b, 61, inimigo) && !atacada(b, 62, inimigo)) lista.push({ de: 60, para: 62, peca: 'K', captura: null, roque: 'K' });
      if (e.roque.includes('Q') && b[56] === 'R' && !b[59] && !b[58] && !b[57] && !atacada(b, 59, inimigo) && !atacada(b, 58, inimigo)) lista.push({ de: 60, para: 58, peca: 'K', captura: null, roque: 'Q' });
    }
    if (v === 'b' && b[4] === 'k' && !atacada(b, 4, inimigo)) {
      if (e.roque.includes('k') && b[7] === 'r' && !b[5] && !b[6] && !atacada(b, 5, inimigo) && !atacada(b, 6, inimigo)) lista.push({ de: 4, para: 6, peca: 'k', captura: null, roque: 'k' });
      if (e.roque.includes('q') && b[0] === 'r' && !b[3] && !b[2] && !b[1] && !atacada(b, 3, inimigo) && !atacada(b, 2, inimigo)) lista.push({ de: 4, para: 2, peca: 'k', captura: null, roque: 'q' });
    }
    return lista;
  }

  const TORRES_ROQUE = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] };
  const PERDE_ROQUE = { 60: 'KQ', 63: 'K', 56: 'Q', 4: 'kq', 7: 'k', 0: 'q' };
  // Faz o lance no próprio estado e devolve o que precisa para desfazer (busca do bot); jogar() copia antes.
  function fazer(e, m) {
    const b = e.tab;
    const u = { capturada: b[m.para], roque: e.roque, ep: e.ep, meio: e.meio, lance: e.lance, vez: e.vez, epCasa: -1, epPeca: '' };
    b[m.para] = m.promo || m.peca;
    b[m.de] = '';
    if (m.ep) { const cap = m.para + (e.vez === 'w' ? 8 : -8); u.epCasa = cap; u.epPeca = b[cap]; b[cap] = ''; }
    if (m.roque) { const [de, para] = TORRES_ROQUE[m.roque]; b[para] = b[de]; b[de] = ''; }
    let roque = e.roque;
    for (const sq of [m.de, m.para]) if (PERDE_ROQUE[sq]) for (const ch of PERDE_ROQUE[sq]) roque = roque.replace(ch, '');
    e.roque = roque;
    e.ep = m.duplo ? (m.de + m.para) >> 1 : -1;
    e.meio = (m.peca === 'P' || m.peca === 'p' || m.captura) ? 0 : e.meio + 1;
    if (e.vez === 'b') e.lance++;
    e.vez = outra(e.vez);
    return u;
  }
  function desfazer(e, m, u) {
    const b = e.tab;
    b[m.de] = m.peca;
    b[m.para] = u.capturada;
    if (u.epCasa >= 0) b[u.epCasa] = u.epPeca;
    if (m.roque) { const [de, para] = TORRES_ROQUE[m.roque]; b[de] = b[para]; b[para] = ''; }
    e.roque = u.roque; e.ep = u.ep; e.meio = u.meio; e.lance = u.lance; e.vez = u.vez;
  }
  function lances(e) {
    const v = e.vez, saida = [];
    for (const m of pseudo(e)) {
      const u = fazer(e, m);
      const r = reiDe(e.tab, v);
      if (r >= 0 && !atacada(e.tab, r, outra(v))) saida.push(m);
      desfazer(e, m, u);
    }
    return saida;
  }
  function jogar(e, m) {
    const n = copiar(e);
    fazer(n, m);
    n.posicoes.push(chave(n));
    return n;
  }
  // Lance pelo texto UCI ("e2e4", "e7e8q"); null se não for legal.
  function lanceDe(e, texto) {
    const t = String(texto || '').toLowerCase();
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(t);
    if (!m) return null;
    const de = indice(m[1]), para = indice(m[2]);
    return lances(e).find((l) => l.de === de && l.para === para && (!l.promo || l.promo.toLowerCase() === (m[3] || 'q'))) || null;
  }
  function uci(m) { return casa(m.de) + casa(m.para) + (m.promo ? m.promo.toLowerCase() : ''); }

  // ---------- fim de partida ----------
  function materialInsuficiente(b) {
    const pecas = b.map((p, i) => [p, i]).filter(([p]) => p && p.toLowerCase() !== 'k');
    if (!pecas.length) return true;
    if (pecas.length === 1 && /[nbNB]/.test(pecas[0][0])) return true;
    if (pecas.every(([p]) => p.toLowerCase() === 'b')) {
      const cores = new Set(pecas.map(([, i]) => ((i >> 3) + (i & 7)) % 2));
      return cores.size === 1;
    }
    return false;
  }
  function situacao(e) {
    const lista = lances(e);
    if (!lista.length) return emXeque(e) ? { fim: true, vencedor: outra(e.vez), motivo: 'xeque-mate' } : { fim: true, vencedor: null, motivo: 'afogamento' };
    if (e.meio >= 100) return { fim: true, vencedor: null, motivo: '50 lances sem captura nem lance de peão' };
    const k = chave(e);
    if (e.posicoes.filter((p) => p === k).length >= 3) return { fim: true, vencedor: null, motivo: 'repetição da posição' };
    if (materialInsuficiente(e.tab)) return { fim: true, vencedor: null, motivo: 'material insuficiente' };
    return { fim: false, xeque: emXeque(e) };
  }

  // ---------- notação (letras em português: R rei, D dama, T torre, B bispo, C cavalo) ----------
  const LETRA = { k: 'R', q: 'D', r: 'T', b: 'B', n: 'C' };
  function notacao(e, m) {
    let s;
    if (m.roque) s = m.roque.toLowerCase() === 'k' ? 'O-O' : 'O-O-O';
    else {
      const t = m.peca.toLowerCase();
      if (t === 'p') s = (m.captura ? COLUNAS[m.de & 7] + 'x' : '') + casa(m.para) + (m.promo ? '=' + LETRA[m.promo.toLowerCase()] : '');
      else {
        const outros = lances(e).filter((l) => l !== m && l.peca === m.peca && l.para === m.para && l.de !== m.de);
        let dis = '';
        if (outros.length) {
          const mesmaColuna = outros.some((l) => (l.de & 7) === (m.de & 7));
          const mesmaLinha = outros.some((l) => (l.de >> 3) === (m.de >> 3));
          dis = !mesmaColuna ? COLUNAS[m.de & 7] : !mesmaLinha ? String(8 - (m.de >> 3)) : casa(m.de);
        }
        s = LETRA[t] + dis + (m.captura ? 'x' : '') + casa(m.para);
      }
    }
    const depois = jogar(e, m);
    const st = situacao(depois);
    return s + (st.fim && st.motivo === 'xeque-mate' ? '#' : emXeque(depois) ? '+' : '');
  }

  // ---------- bot: negamax com poda alfa-beta, busca de capturas e tabelas de posição ----------
  const VALOR = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // Tabelas do ponto de vista das brancas (linha 0 = oitava fileira); as pretas usam a imagem espelhada.
  const TAB = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    kf: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };
  // Pontos do ponto de vista de quem joga agora.
  function avaliar(e) {
    const b = e.tab;
    let damas = 0, menores = 0;
    for (const p of b) { if (p === 'q' || p === 'Q') damas++; else if (p && 'nbrNBR'.includes(p)) menores++; }
    const final = damas === 0 || (damas <= 2 && menores <= 2);
    let s = 0;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const t = p.toLowerCase();
      const branca = p !== t;
      const idx = branca ? i : (7 - (i >> 3)) * 8 + (i & 7);
      const v = VALOR[t] + (t === 'k' ? TAB[final ? 'kf' : 'k'][idx] : TAB[t][idx]);
      s += branca ? v : -v;
    }
    return e.vez === 'w' ? s : -s;
  }
  function ordenar(lista) {
    return lista.sort((a, b) => ((b.captura ? 10 * VALOR[b.captura.toLowerCase()] - VALOR[b.peca.toLowerCase()] : 0) + (b.promo ? 800 : 0))
      - ((a.captura ? 10 * VALOR[a.captura.toLowerCase()] - VALOR[a.peca.toLowerCase()] : 0) + (a.promo ? 800 : 0)));
  }
  const MATE = 100000;
  function buscador(limiteMs) {
    const fim = Date.now() + limiteMs;
    let nos = 0, parou = false;
    function tempo() { if ((++nos & 1023) === 0 && Date.now() > fim) parou = true; return parou; }
    function quieta(e, alfa, beta, prof) {
      const parado = avaliar(e);
      if (parado >= beta) return beta;
      if (parado > alfa) alfa = parado;
      if (prof <= -6 || tempo()) return alfa;
      for (const m of ordenar(lances(e).filter((l) => l.captura || l.promo))) {
        const u = fazer(e, m);
        const v = -quieta(e, -beta, -alfa, prof - 1);
        desfazer(e, m, u);
        if (v >= beta) return beta;
        if (v > alfa) alfa = v;
      }
      return alfa;
    }
    function negamax(e, prof, alfa, beta, ply) {
      if (tempo()) return 0;
      if (prof <= 0) return quieta(e, alfa, beta, 0);
      const lista = ordenar(lances(e));
      if (!lista.length) return emXeque(e) ? -MATE + ply : 0;
      if (e.meio >= 100) return 0;
      for (const m of lista) {
        const u = fazer(e, m);
        const v = -negamax(e, prof - 1, -beta, -alfa, ply + 1);
        desfazer(e, m, u);
        if (parou) return 0;
        if (v >= beta) return beta;
        if (v > alfa) alfa = v;
      }
      return alfa;
    }
    return {
      // exato: nota de cada lance com a janela inteira (para sortear entre os parecidos); senão, só o melhor
      // é exato (os piores voltam com a nota do melhor até ali e não contam).
      raiz(e, prof, primeiro, exato) {
        let lista = ordenar(lances(e));
        if (primeiro) lista = [primeiro].concat(lista.filter((m) => uci(m) !== uci(primeiro)));
        const notas = [];
        let alfa = -Infinity, melhor = null;
        for (const m of lista) {
          const u = fazer(e, m);
          const repete = e.posicoes && e.posicoes.includes(chave(e));
          const v = repete ? 0 : -negamax(e, prof - 1, -Infinity, exato ? Infinity : -alfa, 1);
          desfazer(e, m, u);
          if (parou) break;
          notas.push([m, v]);
          if (v > alfa) { alfa = v; melhor = m; }
        }
        return { notas, melhor, completo: !parou };
      },
    };
  }
  // Níveis: fácil (1 lance à frente, sorteando entre os parecidos), médio (2) e difícil (até 4, com tempo).
  const NIVEIS = { facil: { prof: 1, ms: 300, folga: 120 }, medio: { prof: 2, ms: 700, folga: 25 }, dificil: { prof: 4, ms: 1500, folga: 0 } };
  function melhorLance(estado, nivel, sorteio) {
    const n = NIVEIS[nivel] || NIVEIS.medio;
    const aleatorio = sorteio || Math.random;
    const e = copiar(estado);
    const todos = lances(e);
    if (!todos.length) return null;
    if (todos.length === 1) return todos[0];
    const busca = buscador(n.ms);
    let escolhido = null, notas = null;
    for (let prof = 1; prof <= n.prof; prof++) {
      const r = busca.raiz(e, prof, escolhido, n.folga > 0);
      if (!r.completo) { if (!escolhido && r.melhor) escolhido = r.melhor; break; }
      escolhido = r.melhor;
      notas = r.notas;
    }
    if (n.folga > 0 && notas && notas.length) {
      const topo = Math.max(...notas.map(([, v]) => v));
      const parecidos = notas.filter(([, v]) => v >= topo - n.folga);
      return parecidos[Math.floor(aleatorio() * parecidos.length)][0];
    }
    return escolhido || todos[0];
  }

  // Contagem de posições (perft), para conferir o gerador de lances.
  function perft(e, prof) {
    if (prof === 0) return 1;
    let n = 0;
    for (const m of lances(e)) { const u = fazer(e, m); n += perft(e, prof - 1); desfazer(e, m, u); }
    return n;
  }

  const api = { INICIAL, novo, deFen, paraFen, lances, jogar, lanceDe, uci, casa, indice, corDe, emXeque, situacao, notacao, melhorLance, avaliar, perft, materialInsuficiente, NIVEIS };
  raiz.VL = raiz.VL || {};
  raiz.VL.xadrez = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
