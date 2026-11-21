// Vagalume — jogo fluido (mundo da página). Não envia pacotes nem lê dados do jogo.
// O cliente do Habblet trava o relógio de desenho (o Ticker do Pixi) em 60 quadros por segundo
// (24 sem aceleração de hardware), mesmo com a tela a 144 Hz ou mais: a câmera anda "em degraus".
// Com <html data-vl-fluido> presente (módulo "fluido"), o limite do relógio vira 0 (sem limite):
// o jogo desenha a cada quadro da tela. Quem quiser limitar usa o módulo "Limite de quadros", que
// espaça os quadros da página e vale também para o jogo. Sem o atributo, volta o limite do jogo.
// Também publica em <html data-vl-fps-jogo> quantos quadros o jogo desenhou no último segundo, para o
// contador (só quando ele pede, com <html data-vl-contador>).
(function () {
  'use strict';
  if (window.__vlFluido) return;
  Object.defineProperty(window, '__vlFluido', { value: true });
  const html = document.documentElement;
  let pixi = null;
  const pedidos = new WeakMap(); // ticker → limite que o jogo pediu
  let original = null;           // descritor original de maxFPS
  let tentativas = 0;

  function ligado() { return !!html && html.hasAttribute('data-vl-fluido'); }

  function acharPixi() {
    if (pixi) return pixi;
    const fila = window['webpackJsonpnitro-react'];
    if (!fila || fila.push === Array.prototype.push) return null;
    let req;
    const id = 'vl-fluido-' + Math.random().toString(36).slice(2);
    try { fila.push([[id], { [id]: (m, e, r) => { req = r; } }, [[id]]]); } catch (e) { return null; }
    for (const m of Object.values(req && req.c || {})) {
      const e = m && m.exports;
      if (e && e.Ticker && e.Ticker.prototype && e.Texture && e.Sprite) { pixi = e; break; }
    }
    return pixi;
  }

  // Troca o maxFPS do Ticker: o jogo continua "pedindo" o limite dele (guardado), mas o que vale é
  // 0 enquanto o jogo fluido está ligado.
  function instalar() {
    const proto = pixi.Ticker.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'maxFPS');
    if (!d || typeof d.set !== 'function' || typeof d.get !== 'function') return false;
    original = d;
    Object.defineProperty(proto, 'maxFPS', {
      configurable: true,
      enumerable: d.enumerable,
      get() { return original.get.call(this); },
      set(valor) {
        pedidos.set(this, valor);
        original.set.call(this, ligado() ? 0 : valor);
      },
    });
    return true;
  }
  // O jogo desenha pelo ticker da própria aplicação (não o Ticker.shared): cada ticker que roda
  // entra nesta lista na primeira vez e já recebe o limite certo.
  const vistos = new Set();
  function tickers() {
    const lista = [...vistos];
    try { if (pixi.Ticker.shared && !vistos.has(pixi.Ticker.shared)) lista.push(pixi.Ticker.shared); } catch (e) { /* sem ticker */ }
    return lista;
  }
  function aplicarEm(t) {
    if (!pedidos.has(t)) pedidos.set(t, original.get.call(t));
    original.set.call(t, ligado() ? 0 : pedidos.get(t));
  }
  // Também conta os passos que desenharam de verdade (o Pixi só muda lastTime quando roda), para o
  // contador mostrar o FPS do jogo e não o da página.
  function vigiar() {
    const proto = pixi.Ticker.prototype;
    const anterior = proto.update;
    proto.update = function () {
      if (!vistos.has(this)) { vistos.add(this); try { aplicarEm(this); } catch (e) { /* segue */ } }
      const antes = this.lastTime;
      const r = anterior.apply(this, arguments);
      if (this.lastTime !== antes) this.__vlDesenhos = (this.__vlDesenhos || 0) + 1;
      return r;
    };
  }
  function aplicar() {
    if (!original) return;
    for (const t of tickers()) aplicarEm(t);
  }

  function comecar() {
    if (!acharPixi()) {
      if (++tentativas < 240) setTimeout(comecar, 500); // até 2 minutos esperando o cliente
      return;
    }
    if (!instalar()) return;
    vigiar();
    aplicar();
    new MutationObserver(aplicar).observe(html, { attributes: true, attributeFilter: ['data-vl-fluido'] });
    // Publica os quadros do ticker que mais desenhou (o do jogo) no último segundo.
    setInterval(function () {
      let maior = 0;
      for (const t of vistos) { maior = Math.max(maior, t.__vlDesenhos || 0); t.__vlDesenhos = 0; }
      if (html.hasAttribute('data-vl-contador')) html.setAttribute('data-vl-fps-jogo', String(maior));
      else if (html.hasAttribute('data-vl-fps-jogo')) html.removeAttribute('data-vl-fps-jogo');
    }, 1000);
  }
  if (typeof module !== 'undefined' && module.exports) return;
  if (String(location.search).includes('vagalume=off')) return;
  comecar();
})();
