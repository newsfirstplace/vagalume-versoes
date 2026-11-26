// Vagalume — ponte com a tela do jogo. É o ÚNICO arquivo que conhece o HTML do cliente do Habblet.
//
// ATENÇÃO: os seletores abaixo são hipóteses para um cliente no padrão Nitro e ainda precisam ser
// conferidos no Habblet (a aba "Início" do painel mostra o que foi encontrado na página).
// Para ajustar, edite somente a tabela SELETORES: cada chave aceita alternativas, testadas em ordem.
(function (raiz) {
  'use strict';
  const VL = (raiz.VL = raiz.VL || {});
  if (VL.jogo) return;

  const SELETORES = {
    // O primeiro é o campo que a HIBISCO põe no lugar do campo do jogo (conferido ao vivo em 2026-11-13: o do jogo fica com altura 0).
    entradaChat: ['.mentions.chat-input input', '.nitro-chat-input-container input', '.chat-input-container input', 'input.chat-input'],
    balao: ['.bubble-container', '.chat-bubble'],
    corpoBalao: ['.chat-bubble'],
    autor: ['.username'],
    mensagem: ['.message'],
    janela: ['.draggable-window', '.nitro-card'],
    fechar: ['.nitro-card-header-close', '.nitro-card-close', '.btn-close', '[aria-label="Close"]', '[aria-label="Fechar"]'],
    carteira: ['.nitro-purse-container', '.nitro-purse'],
    quarto: ['.nitro-room-container canvas', '.nitro-room canvas', '#root canvas', 'canvas'],
  };

  // Todas as alternativas de uma chave em um único seletor CSS.
  function seletor(chave) {
    return SELETORES[chave].join(', ');
  }

  function primeiro(base, chave) {
    for (const s of SELETORES[chave]) {
      const achado = base.querySelector(s);
      if (achado) return achado;
    }
    return null;
  }

  // Elementos da primeira alternativa que casar (evita contar o pai e o filho como dois itens).
  function todos(base, chave) {
    for (const s of SELETORES[chave]) {
      if (base.nodeType === 1 && base.matches(s)) return [base];
      const lista = base.querySelectorAll(s);
      if (lista.length) return Array.from(lista);
    }
    return [];
  }

  // ---------- campo de chat ----------

  function entradaChat() {
    const campo = primeiro(document, 'entradaChat');
    return campo && campo.isConnected ? campo : null;
  }

  function ehEntradaChat(el) {
    return !!(el && el.nodeType === 1 && el.matches(seletor('entradaChat')));
  }

  // O Habblet joga o foco no campo de chat a cada tecla apertada fora de um campo, até Shift e Ctrl
  // sozinhos (conferido ao vivo em 2026-11-14). Por isso os atalhos com Ctrl e Shift paravam no chat.
  // campoOcupado: o alvo é um campo onde a pessoa está escrevendo (o chat do jogo vazio não conta).
  function campoOcupado(alvo) {
    if (!alvo || alvo.nodeType !== 1) return false;
    const tag = String(alvo.tagName || '').toLowerCase();
    const texto = tag === 'input' || tag === 'textarea' || tag === 'select' || alvo.isContentEditable === true;
    if (!texto) return false;
    if (ehEntradaChat(alvo) && !String(alvo.value || '').trim()) return false;
    return true;
  }
  // Para Shift e Ctrl sozinhos antes de chegarem ao jogo, quando ninguém está escrevendo. Os atalhos
  // do navegador continuam valendo (nada de preventDefault); a primeira letra digitada ainda abre o chat.
  function segurarModificador(ev) {
    if (ev.key !== 'Shift' && ev.key !== 'Control') return false;
    if (campoOcupado(ev.target)) return false;
    ev.stopPropagation();
    return true;
  }

  // Escreve no campo como se fosse digitação: usa o "setter" nativo e avisa a página com "input".
  function definirValor(campo, valor) {
    const proto = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descritor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descritor && descritor.set) descritor.set.call(campo, valor);
    else campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function apertarEnter(campo) {
    const dados = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true };
    campo.dispatchEvent(new KeyboardEvent('keydown', dados));
    campo.dispatchEvent(new KeyboardEvent('keypress', dados));
    campo.dispatchEvent(new KeyboardEvent('keyup', dados));
  }

  function limparEntrada(campo) {
    const alvo = campo || entradaChat();
    if (!alvo) return false;
    definirValor(alvo, '');
    return true;
  }

  // Envia uma fala pelo campo de chat do jogo. Devolve false quando o campo não foi encontrado.
  // O que o usuário estava digitando é devolvido ao campo depois do envio.
  function enviarFala(texto) {
    const campo = entradaChat();
    const limpo = String(texto == null ? '' : texto).replace(/[\r\n]+/g, ' ').trim();
    if (!campo || !limpo) return false;
    const rascunho = campo.value;
    definirValor(campo, limpo);
    apertarEnter(campo);
    if (rascunho && rascunho !== limpo) definirValor(campo, rascunho);
    return true;
  }

  // ---------- falas ----------

  function limparAutor(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().replace(/\s*:$/, '');
  }

  function lerFala(balao) {
    const elAutor = primeiro(balao, 'autor');
    const elMensagem = primeiro(balao, 'mensagem');
    let autor = elAutor ? elAutor.textContent : '';
    let texto = elMensagem ? elMensagem.textContent : '';
    if (!elMensagem) {
      const inteiro = String(balao.textContent || '').trim();
      const nome = String(autor || '').trim();
      if (nome && inteiro.startsWith(nome)) {
        texto = inteiro.slice(nome.length);
      } else {
        const corte = inteiro.indexOf(': ');
        if (!nome && corte > 0 && corte <= 40) {
          autor = inteiro.slice(0, corte);
          texto = inteiro.slice(corte + 2);
        } else {
          texto = inteiro;
        }
      }
    }
    texto = String(texto).replace(/\s+/g, ' ').trim();
    if (!texto) return null;
    return { autor: limparAutor(autor), texto, quando: Date.now(), el: balao };
  }

  // O balão "oficial" de um elemento: a alternativa mais externa que o contém.
  function balaoDe(el) {
    if (!el || el.nodeType !== 1) return null;
    for (const s of SELETORES.balao) {
      const achado = el.closest(s);
      if (achado) return achado;
    }
    return null;
  }

  function corpoDoBalao(balao) {
    return (balao && primeiro(balao, 'corpoBalao')) || balao;
  }

  // Troca pedaços do texto de uma fala por elementos (links, menções), sem mexer no resto. O texto do
  // balão não é redesenhado pelo jogo depois de aparecer. Cada pedaço trocado leva data-vl-trecho e
  // não é tocado de novo. achar(texto) devolve [{ inicio, fim, ... }] em ordem; montar(trecho, texto) devolve o elemento.
  function marcarTrechos(balao, achar, montar) {
    const alvo = (balao && primeiro(balao, 'mensagem')) || null;
    if (!alvo) return 0;
    const textos = [];
    const andar = document.createTreeWalker(alvo, NodeFilter.SHOW_TEXT);
    for (let no = andar.nextNode(); no; no = andar.nextNode()) {
      if (no.parentElement && no.parentElement.closest('[data-vl-trecho]')) continue;
      textos.push(no);
    }
    let total = 0;
    for (const no of textos) {
      const s = no.data;
      const trechos = achar(s) || [];
      if (!trechos.length) continue;
      const pedacos = document.createDocumentFragment();
      let pos = 0;
      for (const t of trechos) {
        if (t.inicio < pos || t.fim <= t.inicio) continue;
        if (t.inicio > pos) pedacos.appendChild(document.createTextNode(s.slice(pos, t.inicio)));
        const novo = montar(t, s.slice(t.inicio, t.fim));
        novo.setAttribute('data-vl-trecho', '');
        pedacos.appendChild(novo);
        pos = t.fim;
        total += 1;
      }
      if (pos < s.length) pedacos.appendChild(document.createTextNode(s.slice(pos)));
      no.replaceWith(pedacos);
    }
    return total;
  }

  const assinantes = new Set();
  let observador = null;
  let vistos = new WeakSet();

  function avisar(balao) {
    if (vistos.has(balao)) return;
    // O histórico do chat do próprio Habblet (janela) redesenha as falas antigas com as mesmas classes
    // de balão: elas não são falas novas. Balões de verdade nunca ficam dentro de uma janela.
    if (balao.closest && balao.closest('.nitro-card, .draggable-window')) return;
    const fala = lerFala(balao);
    if (!fala) return; // balão ainda vazio: será lido quando o texto chegar
    vistos.add(balao);
    for (const fn of Array.from(assinantes)) {
      try { fn(fala); } catch (erro) { /* um assinante com erro não derruba os outros */ }
    }
  }

  function aoMudar(registros) {
    for (const registro of registros) {
      for (const no of registro.addedNodes) {
        if (no.nodeType !== 1) continue;
        const achados = todos(no, 'balao');
        if (achados.length) {
          for (const el of achados) avisar(balaoDe(el) || el);
        } else if (no.parentElement) {
          const pai = balaoDe(no.parentElement);
          if (pai) avisar(pai);
        }
      }
    }
  }

  // Um único observador para todos os módulos; ele só existe enquanto alguém estiver ouvindo.
  function observarFalas(fn) {
    if (typeof fn !== 'function') return function () {};
    assinantes.add(fn);
    if (!observador && document.body) {
      observador = new MutationObserver(aoMudar);
      observador.observe(document.body, { childList: true, subtree: true });
    }
    return function parar() {
      assinantes.delete(fn);
      if (!assinantes.size && observador) {
        observador.disconnect();
        observador = null;
        vistos = new WeakSet();
      }
    };
  }

  // ---------- janelas do jogo ----------

  function visivel(el) {
    if (!el.isConnected) return false;
    const caixa = el.getBoundingClientRect();
    if (caixa.width < 1 || caixa.height < 1) return false;
    const estilo = getComputedStyle(el);
    return estilo.visibility !== 'hidden' && estilo.display !== 'none';
  }

  function camadaDe(el) {
    for (let no = el; no && no.nodeType === 1 && no !== document.body; no = no.parentElement) {
      const z = parseInt(getComputedStyle(no).zIndex, 10);
      if (Number.isFinite(z)) return z;
    }
    return 0;
  }

  // Só contam janelas visíveis que tenham botão de fechar.
  function janelasAbertas() {
    for (const s of SELETORES.janela) {
      const lista = Array.from(document.querySelectorAll(s)).filter((j) => visivel(j) && primeiro(j, 'fechar'));
      if (lista.length) return lista;
    }
    return [];
  }

  function janelaDaFrente() {
    let melhor = null;
    let melhorZ = -Infinity;
    for (const janela of janelasAbertas()) {
      const z = camadaDe(janela);
      if (z >= melhorZ) { melhor = janela; melhorZ = z; }
    }
    return melhor;
  }

  function fecharJanela(janela) {
    const botao = janela && primeiro(janela, 'fechar');
    if (!botao) return false;
    botao.click();
    return true;
  }

  // ---------- diagnóstico ----------

  function diagnostico() {
    return [
      { id: 'entradaChat', nome: 'Campo de chat', achou: !!entradaChat(), obs: 'aparece dentro de um quarto' },
      { id: 'balao', nome: 'Balões de fala', achou: todos(document, 'balao').length > 0, obs: 'aparece quando alguém fala' },
      { id: 'janela', nome: 'Janelas do jogo', achou: janelasAbertas().length > 0, obs: 'aparece com uma janela aberta' },
      { id: 'carteira', nome: 'Carteira', achou: !!primeiro(document, 'carteira'), obs: '' },
      { id: 'quarto', nome: 'Tela do quarto', achou: !!primeiro(document, 'quarto'), obs: '' },
    ];
  }

  const api = {
    SELETORES, seletor,
    entradaChat, ehEntradaChat, campoOcupado, segurarModificador, definirValor, apertarEnter, limparEntrada, enviarFala,
    lerFala, limparAutor, balaoDe, corpoDoBalao, observarFalas, marcarTrechos,
    janelaDaFrente, fecharJanela, diagnostico,
  };
  VL.jogo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
