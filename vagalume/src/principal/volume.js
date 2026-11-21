// Vagalume — volume do site aberto no visor. Roda no mundo da página do site (registrado pelo fundo
// só para os sites que o usuário permitiu) e só age quando a página está dentro do visor da
// Vagalume, isto é, num quadro cujo pai é uma página de extensão. Numa aba normal não faz nada.
(function () {
  'use strict';
  if (window.top === window) return;
  if (window.__vlVolumeVisor) return; // registrado por site e para todos os sites: roda uma vez só
  window.__vlVolumeVisor = true;
  const pais = location.ancestorOrigins ? Array.from(location.ancestorOrigins) : [];
  // Posição do visor na fila de quadros acima deste: 0 = o site aberto no visor; mais = um quadro
  // dentro do site (player do YouTube, SoundCloud…), que também segue o volume do visor.
  const nivelNoVisor = pais.findIndex((o) => o.indexOf('chrome-extension://') === 0);
  if (nivelNoVisor < 0) return;
  const ORIGEM_DO_VISOR = pais[nivelNoVisor];
  const direto = nivelNoVisor === 0;

  let volume = 0.3; // começa baixo até o visor mandar o nível guardado
  let aplicando = false;
  const ganhos = new Set();
  // Todas as mídias do site, inclusive as que não estão na página (new Audio(), elementos soltos ou
  // dentro de componentes com shadow DOM), que a busca no documento não acha (2026-11-16).
  const conhecidas = new WeakSet();
  const lista = []; // WeakRef de cada mídia
  const descVolume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  const descMudo = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');

  function aplicarMidia(m) {
    aplicando = true;
    try { descVolume.set.call(m, volume); descMudo.set.call(m, volume === 0); } catch (erro) { /* mídia sem controle */ }
    aplicando = false;
  }
  function registrar(m) {
    if (!(m instanceof HTMLMediaElement)) return;
    if (!conhecidas.has(m)) {
      conhecidas.add(m);
      lista.push(typeof WeakRef === 'function' ? new WeakRef(m) : { deref: () => m });
    }
    aplicarMidia(m);
  }
  function aplicarTudo() {
    document.querySelectorAll('audio, video').forEach(registrar);
    for (let i = lista.length - 1; i >= 0; i--) {
      const m = lista[i].deref();
      if (m) aplicarMidia(m); else lista.splice(i, 1);
    }
    ganhos.forEach(function (g) { try { g.gain.value = volume; } catch (erro) { /* contexto fechado */ } });
  }

  // O volume é segurado na fonte: o que o site pedir de volume ou de mudo vira o volume do visor.
  // (Antes, só se corrigia depois, pelo evento volumechange, que não sai de elementos fora da página.)
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    configurable: true, enumerable: descVolume.enumerable,
    get() { return descVolume.get.call(this); },
    set(v) { if (aplicando) { descVolume.set.call(this, v); return; } registrar(this); },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
    configurable: true, enumerable: descMudo.enumerable,
    get() { return descMudo.get.call(this); },
    set(v) { if (aplicando) { descMudo.set.call(this, v); return; } registrar(this); },
  });
  // Mídias criadas por código: new Audio() e document.createElement('audio' / 'video').
  if (typeof window.Audio === 'function') {
    const AudioOriginal = window.Audio;
    const AudioDoVisor = function Audio(src) {
      const a = arguments.length ? new AudioOriginal(src) : new AudioOriginal();
      registrar(a);
      return a;
    };
    AudioDoVisor.prototype = AudioOriginal.prototype;
    window.Audio = AudioDoVisor;
  }
  const criarElemento = Document.prototype.createElement;
  Document.prototype.createElement = function (nome) {
    const el = criarElemento.apply(this, arguments);
    if (el instanceof HTMLMediaElement) registrar(el);
    return el;
  };

  // Música e vídeo: ajusta antes de tocar, ao aparecer na página e se o site mudar o volume depois.
  const tocar = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { registrar(this); return tocar.apply(this, arguments); };
  document.addEventListener('volumechange', function (ev) {
    const m = ev.target;
    if (aplicando || !(m instanceof HTMLMediaElement)) return;
    if (Math.abs(descVolume.get.call(m) - volume) > 0.001 || descMudo.get.call(m) !== (volume === 0)) registrar(m);
  }, true);
  // Mídia que começa a tocar sozinha (autoplay) ou dentro de shadow DOM: o evento "play" passa pela captura.
  document.addEventListener('play', function (ev) { if (ev.target instanceof HTMLMediaElement) registrar(ev.target); }, true);
  new MutationObserver(function (mudancas) {
    for (const mudanca of mudancas) {
      for (const no of mudanca.addedNodes) {
        if (no.nodeType !== 1) continue;
        if (no.matches && no.matches('audio, video')) registrar(no);
        if (no.querySelectorAll) no.querySelectorAll('audio, video').forEach(registrar);
      }
    }
  }).observe(document, { childList: true, subtree: true });

  // Som gerado por código (Web Audio): o que vai para a saída passa por um ganho do Vagalume.
  if (window.AudioNode && window.AudioDestinationNode) {
    const conectar = AudioNode.prototype.connect;
    const porContexto = new WeakMap();
    AudioNode.prototype.connect = function (destino) {
      if (destino instanceof AudioDestinationNode) {
        let ganho = porContexto.get(destino.context);
        if (!ganho) {
          ganho = destino.context.createGain();
          conectar.call(ganho, destino);
          porContexto.set(destino.context, ganho);
          ganhos.add(ganho);
        }
        ganho.gain.value = volume;
        const args = Array.prototype.slice.call(arguments);
        args[0] = ganho;
        return conectar.apply(this, args);
      }
      return conectar.apply(this, arguments);
    };
  }

  // Links dentro do visor (pedido do usuário em 2026-11-15: "ao invés de abrir uma nova guia, trocar
  // a página no próprio pop-up"). O clique num link e o window.open mandam o endereço ao visor, que
  // troca a página do quadro (assim o visor também libera o quadro do site novo, se tiver permissão).
  // Ctrl/Shift/clique do meio continuam abrindo fora, como o usuário escolheu.
  if (direto) {
  function enderecoValido(href) {
    try { const u = new URL(href, location.href); return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null; } catch (erro) { return null; }
  }
  function abrirNoVisor(href) {
    const url = enderecoValido(href);
    if (!url) return false;
    window.parent.postMessage({ vagalume: 'visor:abrir', url }, ORIGEM_DO_VISOR);
    return true;
  }
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('download')) return;
    const url = enderecoValido(a.getAttribute('href'));
    if (!url) return; // javascript:, mailto: etc. ficam com o site
    const atual = new URL(location.href);
    const destino = new URL(url);
    // âncora na mesma página: deixa o site rolar
    if (destino.origin === atual.origin && destino.pathname === atual.pathname && destino.search === atual.search && destino.hash) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    abrirNoVisor(url);
  }, true);
  const abrirOriginal = window.open;
  window.open = function (url) {
    if (url && abrirNoVisor(String(url))) return null;
    return abrirOriginal.apply(window, arguments);
  };
  }

  // Volume master (pedido do usuário em 2026-11-15): a barra do visor manda em tudo. Os controles
  // do próprio site não conseguem mudar o volume (ver volumechange acima) e os quadros de dentro
  // (players embutidos) recebem o mesmo nível, repassado daqui.
  function repassar() {
    for (let i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage({ vagalume: 'volume', valor: volume }, '*'); } catch (erro) { /* quadro fechado */ }
    }
  }
  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent) return;
    if (direto && ev.origin !== ORIGEM_DO_VISOR) return;
    const d = ev.data;
    if (!d || d.vagalume !== 'volume' || typeof d.valor !== 'number' || !isFinite(d.valor)) return;
    volume = Math.min(1, Math.max(0, d.valor));
    aplicarTudo();
    repassar();
  });
  // Players que aparecem depois (ou recarregam) recebem o nível de novo.
  setInterval(repassar, 1500);
})();
