// Vagalume — gerador de visual a partir do estilo da pessoa (pedido do usuário em 2026-11-15).
// Arquivo puro (sem DOM, sem chrome.*). Recebe os visuais salvos em "Meu guarda-roupa" e cria um novo,
// diferente de todos, no estilo dela. Sem catálogo, só com peças e cores que ela já usa; com o catálogo
// do jogo (opcoes.catalogo), também com peças e tons novos parecidos com os dela:
//   - parte de um dos visuais salvos;
//   - muda mais os acessórios (põe, tira ou troca, com peso no que ela mais usa);
//   - muda cores, com as cores que ela já usa na mesma paleta (roupas, cabelo; a pele fica);
//   - às vezes troca uma peça principal (cabelo, blusa, calça, sapato) por outra dela.
(function (raiz) {
  'use strict';

  const PRINCIPAIS = ['hr', 'ch', 'lg', 'sh'];
  const ACESSORIOS = ['ha', 'he', 'ea', 'fa', 'ca', 'wa', 'cc', 'cp'];
  const NOMES = {
    hd: 'pele', hr: 'cabelo', ch: 'blusa', lg: 'calça', sh: 'sapato', ha: 'chapéu', he: 'acessório de cabeça',
    ea: 'óculos', fa: 'acessório de rosto', ca: 'acessório de peito', wa: 'cinto', cc: 'casaco', cp: 'estampa',
  };
  // Frases das mudanças, com a concordância de cada peça.
  const FEM = new Set(['ch', 'lg', 'cp', 'hd']);
  function frase(tipo, jeito) {
    const n = NOMES[tipo];
    const plural = tipo === 'ea';
    const fem = FEM.has(tipo);
    if (jeito === 'outro') return (plural ? 'outros ' : fem ? 'outra ' : 'outro ') + n;
    if (jeito === 'cor') return 'cor nova ' + (plural ? 'nos ' : fem ? 'na ' : 'no ') + n;
    if (jeito === 'novo') return n + (plural ? ' novos' : fem ? ' nova' : ' novo'); // peça que a pessoa ainda não usou
    if (jeito === 'tom') return 'tom novo ' + (plural ? 'nos ' : fem ? 'na ' : 'no ') + n;
    return jeito + ' ' + n; // "com" e "sem"
  }
  // Paleta de cores de cada tipo: as roupas e acessórios usam a mesma; cabelo e pele têm as suas.
  function paleta(tipo) { return tipo === 'hr' ? 'cabelo' : tipo === 'hd' ? 'pele' : 'roupa'; }

  function ler(codigo) {
    const partes = new Map();
    for (const pedaco of String(codigo || '').split('.')) {
      const m = /^([a-z]{2})-(\d+)((?:-\d+)*)$/.exec(pedaco.trim());
      if (!m) continue;
      partes.set(m[1], { tipo: m[1], set: Number(m[2]), cores: m[3] ? m[3].slice(1).split('-').map(Number) : [] });
    }
    return partes;
  }
  function escrever(partes) {
    const ordem = ['hd', 'hr', 'ha', 'he', 'ea', 'fa', 'ch', 'cc', 'ca', 'cp', 'wa', 'lg', 'sh'];
    const tipos = [...partes.keys()].sort((a, b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99));
    return tipos.map((t) => { const p = partes.get(t); return [p.tipo, p.set, ...p.cores].join('-'); }).join('.');
  }
  // Para comparar visuais sem ligar para a ordem das partes.
  function normalizar(codigo) { return [...ler(codigo).values()].map((p) => [p.tipo, p.set, ...p.cores].join('-')).sort().join('.'); }

  function sortear(lista, peso, aleatorio) {
    if (!lista.length) return null;
    const pesos = lista.map((x) => Math.max(0.0001, peso ? peso(x) : 1));
    let r = aleatorio() * pesos.reduce((s, p) => s + p, 0);
    for (let i = 0; i < lista.length; i++) { r -= pesos[i]; if (r <= 0) return lista[i]; }
    return lista[lista.length - 1];
  }

  // Estatística do estilo: por tipo, em quantos visuais aparece e quais peças (set + cores); por paleta,
  // quais cores e quantas vezes.
  function estilo(lista) {
    const presenca = new Map();
    const pecas = new Map();
    const cores = new Map();
    for (const partes of lista) {
      for (const p of partes.values()) {
        presenca.set(p.tipo, (presenca.get(p.tipo) || 0) + 1);
        if (!pecas.has(p.tipo)) pecas.set(p.tipo, []);
        pecas.get(p.tipo).push(p);
        const pal = paleta(p.tipo);
        if (!cores.has(pal)) cores.set(pal, new Map());
        for (const c of p.cores) cores.get(pal).set(c, (cores.get(pal).get(c) || 0) + 1);
      }
    }
    return { total: lista.length, presenca, pecas, cores };
  }

  function copia(p) { return { tipo: p.tipo, set: p.set, cores: p.cores.slice() }; }

  // ---------- catálogo do jogo (opcional): peças e cores novas no mesmo estilo ----------
  // catalogo = { tipos: { tipo: { paleta, sets: [{ id, g, club, cores, assinatura }] } }, paletas: { id: [{ id, club, hex }] } }
  // (montado por conteudo/dados-jogo.js a partir do FigureData.json do jogo; só peças selecionáveis e
  // que não são vendidas à parte). "Mesmo estilo" aqui é: número perto no catálogo (mesma coleção ou
  // época), mesmas partes (manga longa com manga longa, cabelo que fica embaixo do chapéu…) e o mesmo
  // número de cores; cores, as mais próximas das que a pessoa usa.
  function rgb(hex) { const n = parseInt(hex, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function distancia(a, b) { const x = rgb(a); const y = rgb(b); return Math.hypot((x[0] - y[0]) * 0.8, x[1] - y[1], (x[2] - y[2]) * 0.6); }
  function prepararCatalogo(cat, genero, lista) {
    if (!cat || !cat.tipos || !cat.paletas) return null;
    const porTipo = {};
    const usados = new Map(); // tipo -> Set de peças da pessoa
    let clube = 0;
    for (const partes of lista) for (const p of partes.values()) {
      if (!usados.has(p.tipo)) usados.set(p.tipo, new Set());
      usados.get(p.tipo).add(p.set);
      const tp = cat.tipos[p.tipo];
      const s = tp && tp.sets.find((x) => x.id === p.set);
      if (s) clube = Math.max(clube, s.club);
      const pal = tp && cat.paletas[tp.paleta];
      for (const c of p.cores) { const cor = pal && pal.find((x) => x.id === c); if (cor) clube = Math.max(clube, cor.club); }
    }
    for (const tipo of Object.keys(cat.tipos)) {
      const tp = cat.tipos[tipo];
      porTipo[tipo] = { paleta: tp.paleta, sets: tp.sets.filter((s) => (s.g === genero || s.g === 'U') && s.club <= clube) };
    }
    return { porTipo, paletas: cat.paletas, usados, clube };
  }
  function jaccard(a, b) {
    const x = new Set(String(a || '').split(',').filter(Boolean));
    const y = new Set(String(b || '').split(',').filter(Boolean));
    if (!x.size && !y.size) return 1;
    let comum = 0;
    for (const v of x) if (y.has(v)) comum++;
    return comum / (x.size + y.size - comum);
  }
  // Peça nova (que a pessoa ainda não usou) parecida com a de referência.
  function pecaParecida(c, tipo, ref, aleatorio) {
    const tp = c.porTipo[tipo];
    if (!tp || !tp.sets.length || ref == null) return null;
    const sets = tp.sets;
    const daRef = sets.find((s) => s.id === ref);
    let pos = sets.findIndex((s) => s.id >= ref);
    if (pos < 0) pos = sets.length - 1;
    const usados = c.usados.get(tipo) || new Set();
    const candidatos = [];
    for (let i = Math.max(0, pos - 60); i < Math.min(sets.length, pos + 60); i++) {
      const s = sets[i];
      if (s.id === ref || usados.has(s.id)) continue;
      const perto = Math.exp(-Math.abs(i - pos) / 18);
      const forma = daRef ? jaccard(s.assinatura, daRef.assinatura) : 0.5;
      const cores = daRef ? (s.cores === daRef.cores ? 1 : 0.4) : 0.7;
      candidatos.push({ s, nota: perto * 0.55 + forma * 0.3 + cores * 0.15 });
    }
    candidatos.sort((a, b) => b.nota - a.nota);
    const escolhido = sortear(candidatos.slice(0, 12), (x) => x.nota * x.nota, aleatorio);
    return escolhido ? escolhido.s : null;
  }
  // Cor nova perto das que a pessoa usa nessa paleta (não uma que ela já usa).
  function corParecida(c, tipo, coresDaPessoa, aleatorio) {
    const tp = c.porTipo[tipo];
    const pal = tp && c.paletas[tp.paleta];
    if (!pal || !pal.length || !coresDaPessoa || !coresDaPessoa.size) return null;
    const minhas = [...coresDaPessoa.entries()].map(([id, n]) => ({ cor: pal.find((x) => x.id === id), n })).filter((x) => x.cor);
    if (!minhas.length) return null;
    const candidatos = [];
    for (const cor of pal) {
      if (cor.club > c.clube || coresDaPessoa.has(cor.id)) continue;
      let melhor = 0;
      for (const m of minhas) melhor = Math.max(melhor, Math.exp(-distancia(cor.hex, m.cor.hex) / 45) * Math.sqrt(m.n));
      candidatos.push({ id: cor.id, nota: melhor });
    }
    candidatos.sort((a, b) => b.nota - a.nota);
    const escolhido = sortear(candidatos.slice(0, 10), (x) => x.nota, aleatorio);
    return escolhido ? escolhido.id : null;
  }
  // ---------- temas e combinar com outra pessoa ----------
  const TEMAS = {
    escuro: { nome: 'escuro', cores: ['0d0d0d', '2b2b2b', '4a4a4a', '6e6e6e', '1c2333'] },
    colorido: { nome: 'colorido', cores: ['ff2d2d', 'ffb000', 'ffe600', '2ecc40', '00b4ff', 'a855f7', 'ff4fa3'] },
    pastel: { nome: 'pastel', cores: ['ffd1dc', 'c1e1ff', 'd8f5c4', 'fff3b0', 'e3d0ff', 'ffe0c2'] },
    halloween: { nome: 'Halloween', cores: ['ff7a00', '1a1a1a', '5b2a86', '3c7a2e'] },
    verao: { nome: 'verão', cores: ['ffd23f', '29c7ac', 'ff6f59', 'ffffff', '3fa9f5'] },
    natal: { nome: 'Natal', cores: ['c1121f', '1b7f3a', 'ffffff', 'd4a017'] },
    vagalume: { nome: 'Vagalume', cores: ['d6f24a', '12161f', '7f9f18', '2a3a1a', 'f0ffc0'] },
  };
  // Cores preferidas por paleta: para um tema, as cores do jogo mais perto das do tema; para combinar,
  // as cores que a outra pessoa usa. Map paleta -> Map(id da cor -> peso).
  function coresDoTema(cat, chaveTema) {
    const tema = TEMAS[chaveTema];
    if (!tema || !cat) return null;
    const saida = new Map();
    for (const tipo of ['hr', 'ch']) {
      const tp = cat.porTipo[tipo];
      const pal = tp && cat.paletas[tp.paleta];
      if (!pal) continue;
      const pesos = new Map();
      tema.cores.forEach(function (hex, i) {
        const perto = pal.filter((c) => c.club <= cat.clube).map((c) => ({ id: c.id, d: distancia(c.hex, hex) })).sort((a, b) => a.d - b.d)[0];
        if (perto && perto.d < 90) pesos.set(perto.id, (pesos.get(perto.id) || 0) + (tema.cores.length - i)); // as primeiras cores pesam mais
      });
      saida.set(paleta(tipo), pesos);
    }
    return saida;
  }
  function coresDeOutro(partes) {
    const saida = new Map();
    for (const p of partes.values()) {
      if (p.tipo === 'hd') continue;
      const pal = paleta(p.tipo);
      if (!saida.has(pal)) saida.set(pal, new Map());
      for (const c of p.cores) saida.get(pal).set(c, (saida.get(pal).get(c) || 0) + 1);
    }
    return saida;
  }
  // Recolore as peças com as cores preferidas (a pele fica).
  function recolorir(novo, preferidas, chance, aleatorio, mudancas, frasePronta) {
    let mudou = false;
    for (const p of novo.values()) {
      if (p.tipo === 'hd' || !p.cores.length) continue;
      const pool = preferidas.get(paleta(p.tipo));
      if (!pool || !pool.size) continue;
      for (let i = 0; i < p.cores.length; i++) {
        if (aleatorio() >= chance) continue;
        const cor = sortear([...pool.keys()], (c) => pool.get(c), aleatorio);
        if (cor != null && cor !== p.cores[i]) { p.cores[i] = cor; mudou = true; }
      }
    }
    if (mudou) mudancas.push(frasePronta);
  }

  // Monta a parte com a peça nova, mantendo as cores que já tinha (e completando com cores do estilo).
  function parteNova(tipo, s, antigas, e, aleatorio) {
    const pool = e.cores.get(paleta(tipo));
    const cores = [];
    for (let i = 0; i < Math.max(1, s.cores); i++) {
      if (antigas && antigas[i] != null) cores.push(antigas[i]);
      else if (pool && pool.size) cores.push(sortear([...pool.keys()], (x) => pool.get(x), aleatorio));
    }
    return { tipo, set: s.id, cores };
  }

  function umaTentativa(lista, e, aleatorio, cat, extra) {
    const NOVO = 0.5; // chance de buscar no catálogo em vez de reaproveitar uma peça ou cor da pessoa
    const base = sortear(lista, null, aleatorio);
    const novo = new Map([...base.entries()].map(([t, p]) => [t, copia(p)]));
    const mudancas = [];
    const freq = (t) => (e.presenca.get(t) || 0) / e.total;
    const outraPeca = (tipo, atual) => {
      const opcoes = (e.pecas.get(tipo) || []).filter((p) => !atual || p.set !== atual.set);
      // peso: quantas vezes a mesma peça aparece (o que a pessoa mais usa)
      return sortear(opcoes, (p) => opcoes.filter((o) => o.set === p.set).length, aleatorio);
    };

    // Troca a peça: às vezes por uma nova do catálogo, parecida; senão, por outra que a pessoa já usou.
    const trocar = (tipo, atual) => {
      if (cat && aleatorio() < NOVO) {
        const ref = atual ? atual.set : (sortear(e.pecas.get(tipo) || [], null, aleatorio) || {}).set;
        const s = pecaParecida(cat, tipo, ref, aleatorio);
        if (s) { novo.set(tipo, parteNova(tipo, s, atual ? atual.cores : null, e, aleatorio)); mudancas.push(frase(tipo, 'novo')); return true; }
      }
      const p = outraPeca(tipo, atual);
      if (p) { novo.set(tipo, copia(p)); mudancas.push(frase(tipo, atual ? 'outro' : 'com')); return true; }
      return false;
    };

    // 1) peças principais: às vezes uma, raramente duas
    const nPrincipais = aleatorio() < 0.15 ? 2 : (aleatorio() < 0.45 ? 1 : 0);
    const principais = PRINCIPAIS.filter((t) => novo.has(t) && (cat || (e.pecas.get(t) || []).some((p) => p.set !== novo.get(t).set)));
    for (let i = 0; i < nPrincipais && principais.length; i++) {
      const tipo = principais.splice(Math.floor(aleatorio() * principais.length), 1)[0];
      trocar(tipo, novo.get(tipo));
    }

    // 2) acessórios: o que mais muda
    for (const tipo of ACESSORIOS) {
      const tem = novo.has(tipo);
      const r = aleatorio();
      if (tem) {
        if (r < 0.35) {
          trocar(tipo, novo.get(tipo));
        } else if (r < 0.5 && freq(tipo) < 0.85) {
          novo.delete(tipo); mudancas.push(frase(tipo, 'sem'));
        }
      } else if ((e.pecas.get(tipo) || []).length && r < 0.15 + freq(tipo) * 0.55) {
        trocar(tipo, null);
      }
    }

    // 3) cores: das que a pessoa já usa, na mesma paleta (a pele fica)
    for (const p of novo.values()) {
      if (p.tipo === 'hd' || !p.cores.length) continue;
      const chance = p.tipo === 'hr' ? 0.25 : (ACESSORIOS.includes(p.tipo) ? 0.45 : 0.35);
      if (aleatorio() >= chance) continue;
      const pool = e.cores.get(paleta(p.tipo));
      const qual = p.cores.length > 1 && aleatorio() < 0.5 ? 1 : 0;
      if (cat && aleatorio() < NOVO) {
        const nova = corParecida(cat, p.tipo, pool, aleatorio);
        if (nova != null) { p.cores[qual] = nova; mudancas.push(frase(p.tipo, 'tom')); continue; }
      }
      if (!pool || pool.size < 2) continue;
      const opcoes = [...pool.keys()].filter((c) => c !== p.cores[qual]);
      const cor = sortear(opcoes, (c) => pool.get(c), aleatorio);
      if (cor != null) { p.cores[qual] = cor; mudancas.push(frase(p.tipo, 'cor')); }
    }

    // 4) tema ou combinar com outra pessoa
    if (extra && extra.outro) {
      // às vezes a mesma peça que a outra pessoa usa (se servir para você)
      for (const p of extra.outro.partes.values()) {
        if (!ACESSORIOS.includes(p.tipo) && p.tipo !== 'hr') continue;
        if (aleatorio() >= (p.tipo === 'hr' ? 0.2 : 0.45)) continue;
        const tp = cat && cat.porTipo[p.tipo];
        const s = tp && tp.sets.find((x) => x.id === p.set);
        if (!s) continue; // sem catálogo, ou a peça não é do seu gênero ou do seu clube
        novo.set(p.tipo, { tipo: p.tipo, set: p.set, cores: p.cores.slice() });
        mudancas.push('mesmo ' + NOMES[p.tipo] + ' de ' + extra.outro.nome);
      }
      recolorir(novo, extra.outro.cores, 0.75, aleatorio, mudancas, 'cores combinando com ' + extra.outro.nome);
    } else if (extra && extra.tema) {
      recolorir(novo, extra.tema.cores, 0.85, aleatorio, mudancas, 'cores do tema ' + extra.tema.nome);
    }
    return { partes: novo, mudancas };
  }

  // visuais: [{ visual, genero }]; opcoes: { genero, aleatorio, catalogo }. Devolve { visual, genero, mudancas }
  // ou null quando não há visual salvo.
  function gerar(visuais, opcoes) {
    const o = opcoes || {};
    const aleatorio = typeof o.aleatorio === 'function' ? o.aleatorio : Math.random;
    let validos = (visuais || []).filter((v) => v && ler(v.visual).size);
    if (!validos.length) return null;
    const contagem = {};
    for (const v of validos) { const g = String(v.genero || 'M').toUpperCase(); contagem[g] = (contagem[g] || 0) + 1; }
    const genero = (o.genero && contagem[String(o.genero).toUpperCase()]) ? String(o.genero).toUpperCase()
      : Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];
    validos = validos.filter((v) => String(v.genero || 'M').toUpperCase() === genero);
    const lista = validos.map((v) => ler(v.visual));
    const e = estilo(lista);
    const existentes = new Set(validos.map((v) => normalizar(v.visual)));
    const cat = prepararCatalogo(o.catalogo, genero, lista);
    // opcoes.tema: chave de TEMAS (precisa do catálogo, para achar as cores do jogo perto do tema);
    // opcoes.combinar: { nome, visual } de outra pessoa.
    let extra = null;
    if (o.combinar && o.combinar.visual) extra = { outro: { nome: o.combinar.nome || 'a outra pessoa', partes: ler(o.combinar.visual), cores: coresDeOutro(ler(o.combinar.visual)) } };
    else if (o.tema && TEMAS[o.tema] && cat) extra = { tema: { nome: TEMAS[o.tema].nome, cores: coresDoTema(cat, o.tema) } };
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      const r = umaTentativa(lista, e, aleatorio, cat, extra);
      const visual = escrever(r.partes);
      if ((o.evitados || o.coresEvitadas) && tentativa < 30 && temEvitada(visual, o.evitados, o.coresEvitadas)) continue; // prefere sortear outro
      if (!existentes.has(normalizar(visual)) && r.mudancas.length) return { visual, genero, mudancas: [...new Set(r.mudancas)] };
    }
    return null; // não deu para fazer um diferente (por exemplo, um visual só e sem nada para variar)
  }

  // Peças e cores evitadas (pedido do usuário em 2026-11-20): evitados e cores = { tipo: [ids] }.
  function temEvitada(codigo, evitados, cores) {
    for (const p of ler(codigo).values()) {
      if (((evitados || {})[p.tipo] || []).includes(p.set)) return true;
      if (p.cores.some((c) => ((cores || {})[p.tipo] || []).includes(c))) return true;
    }
    return false;
  }
  // O id mais perto de "atual" na lista "ids" que não está em "fora" (ou null).
  function vizinha(ids, atual, fora) {
    const i = ids.indexOf(atual);
    for (let d = 1; d < ids.length + 1; d++) {
      for (const j of i < 0 ? [d - 1] : [i - d, i + d]) if (j >= 0 && j < ids.length && !fora.includes(ids[j])) return ids[j];
    }
    return null;
  }
  // Troca cada peça evitada pela vizinha mais perto na lista do catálogo (idsDe(tipo): ids em ordem),
  // com as mesmas cores; sem nenhuma permitida, tira a peça. Cada cor evitada vira a vizinha na paleta
  // (coresDe(tipo): ids em ordem); sem nenhuma permitida, a cor fica.
  function evitar(codigo, evitados, idsDe, cores, coresDe) {
    if (!evitados && !cores) return codigo;
    const partes = ler(codigo);
    for (const p of [...partes.values()]) {
      const fora = (evitados || {})[p.tipo] || [];
      let set = p.set;
      if (fora.includes(set)) {
        set = vizinha((idsDe && idsDe(p.tipo)) || [], set, fora);
        if (set == null) { partes.delete(p.tipo); continue; }
      }
      const foraCor = (cores || {})[p.tipo] || [];
      const lista = foraCor.length ? (coresDe && coresDe(p.tipo)) || [] : [];
      const novas = p.cores.map((c) => (foraCor.includes(c) ? (vizinha(lista, c, foraCor) ?? c) : c));
      partes.set(p.tipo, { tipo: p.tipo, set, cores: novas });
    }
    return escrever(partes);
  }

  const api = { TEMAS, gerar, evitar, temEvitada, ler, escrever, normalizar, estilo, prepararCatalogo, pecaParecida, corParecida, NOMES, PRINCIPAIS, ACESSORIOS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    raiz.VL = raiz.VL || {};
    raiz.VL.geradorVisual = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
