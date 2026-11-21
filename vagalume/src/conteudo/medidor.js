// Vagalume — medidor de desempenho (comando /desempenho; 2026-11-20, o usuário achou o jogo menos
// fluido com o Vagalume). Carrega antes de todos os outros scripts da extensão e envolve, só no
// mundo da extensão (o jogo não é tocado), os observadores, temporizadores, quadros e ouvintes de
// eventos, para saber quanto tempo cada arquivo do Vagalume ocupa. Fora de uma medição, o custo é
// uma checagem de booleano por chamada. Nada sai do navegador.
(function (raiz) {
  'use strict';
  if (raiz.__vlMedidor) return;
  const VL = (raiz.VL = raiz.VL || {});
  let ativo = false;
  let tempos = new Map(); // arquivo → { ms, vezes }
  const agora = () => performance.now();

  // Arquivo do Vagalume que registrou o callback (primeira linha da pilha fora deste arquivo).
  function origem() {
    const pilha = String(new Error().stack || '').split('\n');
    for (const linha of pilha) {
      const m = /\/src\/([\w/.-]+\.js)/.exec(linha);
      if (m && !m[1].endsWith('medidor.js')) return m[1];
    }
    return 'outros';
  }
  function contar(onde, ms) {
    const t = tempos.get(onde) || { ms: 0, vezes: 0 };
    t.ms += ms; t.vezes++;
    tempos.set(onde, t);
  }
  function envolver(fn, onde) {
    if (typeof fn !== 'function') return fn;
    return function () {
      if (!ativo) return fn.apply(this, arguments);
      const ini = agora();
      try { return fn.apply(this, arguments); } finally { contar(onde, agora() - ini); }
    };
  }

  // Observadores: sempre envolvidos (são criados na partida); a origem é lida uma vez.
  const MO = raiz.MutationObserver;
  if (typeof MO === 'function') {
    raiz.MutationObserver = class extends MO {
      constructor(cb) { super(envolver(cb, origem() + ' (observador)')); }
    };
  }
  // Intervalos: sempre (também nascem na partida). Atrasos e quadros: só durante a medição.
  const si = raiz.setInterval, st = raiz.setTimeout, raf = raiz.requestAnimationFrame;
  raiz.setInterval = function (fn, ms, ...resto) { return si.call(raiz, envolver(fn, origem() + ' (intervalo)'), ms, ...resto); };
  raiz.setTimeout = function (fn, ms, ...resto) { return st.call(raiz, ativo ? envolver(fn, origem() + ' (atraso)') : fn, ms, ...resto); };
  if (typeof raf === 'function') raiz.requestAnimationFrame = function (fn) { return raf.call(raiz, ativo ? envolver(fn, origem() + ' (quadro)') : fn); };
  // Ouvintes de eventos: sempre envolvidos, com o removeEventListener achando o envolvido.
  const proto = raiz.EventTarget && raiz.EventTarget.prototype;
  if (proto) {
    const add = proto.addEventListener, rem = proto.removeEventListener;
    const envolvidos = new WeakMap();
    proto.addEventListener = function (tipo, fn, opcoes) {
      if (typeof fn !== 'function') return add.call(this, tipo, fn, opcoes);
      let porTipo = envolvidos.get(fn);
      if (!porTipo) { porTipo = new Map(); envolvidos.set(fn, porTipo); }
      let w = porTipo.get(tipo);
      if (!w) { w = envolver(fn, origem() + ' (' + tipo + ')'); porTipo.set(tipo, w); }
      return add.call(this, tipo, w, opcoes);
    };
    proto.removeEventListener = function (tipo, fn, opcoes) {
      const porTipo = typeof fn === 'function' && envolvidos.get(fn);
      return rem.call(this, tipo, (porTipo && porTipo.get(tipo)) || fn, opcoes);
    };
  }

  // Uma medição: liga, conta os quadros da página e devolve o resumo depois de `segundos`.
  function medir(segundos) {
    return new Promise(function (resolver) {
      tempos = new Map();
      ativo = true;
      const duracao = Math.max(3, Math.min(60, Number(segundos) || 15)) * 1000;
      const quadros = [];
      let ultimo = agora();
      const inicio = ultimo;
      function quadro(t) {
        quadros.push(t - ultimo);
        ultimo = t;
        if (t - inicio < duracao) raf.call(raiz, quadro);
      }
      raf.call(raiz, quadro);
      st.call(raiz, function () {
        ativo = false;
        const total = agora() - inicio;
        const lista = [...tempos.entries()].map(([onde, t]) => ({ onde, ms: Math.round(t.ms), vezes: t.vezes })).sort((a, b) => b.ms - a.ms);
        const soma = lista.reduce((s, x) => s + x.ms, 0);
        const intervalos = quadros.slice(1);
        const fps = intervalos.length ? Math.round(1000 / (intervalos.reduce((s, x) => s + x, 0) / intervalos.length)) : 0;
        const lentos = intervalos.filter((x) => x > 34).length;
        const pior = intervalos.length ? Math.round(Math.max(...intervalos)) : 0;
        resolver({ segundos: Math.round(total / 1000), fps, quadros: intervalos.length, lentos, pior, extensaoMs: soma, porSegundo: Math.round(soma / (total / 1000)), lista });
      }, duracao);
    });
  }

  Object.defineProperty(raiz, '__vlMedidor', { value: true });
  VL.medidor = { medir, ativo: () => ativo };
})(typeof globalThis !== 'undefined' ? globalThis : this);
