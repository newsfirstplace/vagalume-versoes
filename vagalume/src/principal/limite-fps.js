// Vagalume — limitador de quadros. Único arquivo que roda no contexto da página (mundo MAIN),
// e só é registrado quando o módulo "Limite de quadros" está ligado.
// Não lê nem altera dados do jogo: apenas espaça as chamadas de requestAnimationFrame.
(function () {
  'use strict';

  const BASE_ID = 1e9; // ids próprios ficam longe dos ids nativos

  function criarLimitador(rafNativo, cancelNativo) {
    let limite = 0;          // 0 = sem limite
    let proximo = 0;         // instante a partir do qual o próximo quadro é liberado
    let quadroLiberado = -1; // carimbo do quadro em curso; todos os callbacks dele rodam juntos
    let seq = BASE_ID;
    let entregues = 0;       // quadros em que algum pedido do jogo rodou
    let ultimoEntregue = -1;
    const pendentes = new Map(); // id próprio -> id nativo

    function pedir(cb) {
      const id = ++seq;
      const passo = (t) => {
        if (limite > 0 && t !== quadroLiberado) {
          if (t < proximo) { pendentes.set(id, rafNativo(passo)); return; }
          const intervalo = 1000 / limite;
          proximo = t - proximo > intervalo ? t + intervalo : proximo + intervalo;
          quadroLiberado = t;
        }
        pendentes.delete(id);
        if (t !== ultimoEntregue) { ultimoEntregue = t; entregues += 1; }
        cb(t);
      };
      pendentes.set(id, rafNativo(passo));
      return id;
    }

    function cancelar(id) {
      if (pendentes.has(id)) { cancelNativo(pendentes.get(id)); pendentes.delete(id); }
      else if (!(id > BASE_ID)) cancelNativo(id); // pedido feito antes da instalação
    }

    function definir(n) {
      const v = Number(n);
      limite = Number.isFinite(v) && v >= 1 ? Math.min(240, v) : 0;
      proximo = 0;
    }

    return { pedir, cancelar, definir, limite: () => limite, pendentes: () => pendentes.size, entregues: () => entregues };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { criarLimitador }; return; }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Chave de emergência: abrir o jogo com "?vagalume=off" deixa a página intocada.
  if (String(location.search).includes('vagalume=off')) return;

  const html = document.documentElement;
  if (!html || html.hasAttribute('data-vl-fps-ativo')) return;

  const lim = criarLimitador(window.requestAnimationFrame.bind(window), window.cancelAnimationFrame.bind(window));
  window.requestAnimationFrame = function requestAnimationFrame(cb) { return lim.pedir(cb); };
  window.cancelAnimationFrame = function cancelAnimationFrame(id) { lim.cancelar(id); };

  const ler = () => lim.definir(html.getAttribute('data-vl-fps'));
  new MutationObserver(ler).observe(html, { attributes: true, attributeFilter: ['data-vl-fps'] });
  html.setAttribute('data-vl-fps-ativo', '1');
  ler();

  // Publica, uma vez por segundo, quantos quadros o jogo recebeu. Só quando o contador pede.
  let antes = 0;
  setInterval(function () {
    const agora = lim.entregues();
    if (html.hasAttribute('data-vl-contador')) html.setAttribute('data-vl-fps-medido', String(agora - antes));
    else if (html.hasAttribute('data-vl-fps-medido')) html.removeAttribute('data-vl-fps-medido');
    antes = agora;
  }, 1000);
})();
