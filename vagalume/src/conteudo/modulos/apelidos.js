// Apelidos locais, separados por conta. O texto original do jogo fica no DOM.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo) return;
  const { camada, jogo, nucleo } = VL;
  const MENU = '.nitro-context-menu.visible:not(.name-only):not(.nitro-widget-high-score)';
  const NOMES = '.nitro-context-menu:not(.nitro-widget-high-score) > .menu-header, .nitro-context-menu.name-only .text-shadow, .nitro-infostand .goldfish.fw-bold, .chat-bubble .username, .bubble-container .username, .nitro-friends-messenger .username, .nitro-friends .friend-row .text-truncate';
  const MARCA = 'data-vl-apelido-local';
  const FONTE = '--vl-fonte-apelido';
  const CSS = '[' + MARCA + '] { font-size:0!important; }'
    + '[' + MARCA + ']::before { content:attr(' + MARCA + '); font-size:var(' + FONTE + ', 13px); white-space:pre; }'
    + '[' + MARCA + '][data-vl-usa]::after { vertical-align:calc(var(' + FONTE + ', 13px) * .25 - 4px); }'
    + '.vl-editar-apelido { min-height:24px; cursor:pointer; }';

  nucleo.definirModulo({
    id: 'apelidos',
    iniciar(ctx) {
      const area = chrome.storage.local;
      let conta = '';
      let apelidos = new Map();
      let relogio = 0;
      let parado = false;
      const chave = (id) => 'vl.apelidos.' + id;
      const meuId = () => String(VL.pessoas?.meuId() || '');
      const nomeComparavel = (nome) => nome.trim().toLowerCase();
      ctx.aoParar(camada.estiloPagina('apelidos', CSS));

      function alvos() {
        const lista = new Map();
        for (const a of VL.amigos?.lista?.() || []) {
          if (a.nome && a.id) lista.set(nomeComparavel(a.nome), { id: String(a.id), nome: a.nome });
        }
        const eu = VL.pessoas?.eu();
        if (eu && conta) lista.set(nomeComparavel(eu), { id: conta, nome: eu });
        return lista;
      }

      VL.apelidos = {
        de(nome) {
          const pessoa = alvos().get(nomeComparavel(String(nome || '')));
          return pessoa ? (apelidos.get(pessoa.id) || '') : '';
        },
      };
      ctx.aoParar(function () { delete VL.apelidos; });

      function atualizarDados(valor) {
        apelidos = new Map(Object.entries(valor || {}).filter(([id, nome]) => /^\d+$/.test(id) && typeof nome === 'string' && nome.length <= 32));
        agendar();
      }
      function trocarConta() {
        const atual = meuId();
        if (atual === conta) return;
        conta = atual;
        apelidos.clear();
        if (atual) area.get(chave(atual)).then((r) => {
          if (!parado && conta === atual && atual === meuId()) atualizarDados(r[chave(atual)]);
        }).catch(() => {});
      }

      async function editar(alvo) {
        const dono = conta;
        const entrada = camada.el('input', { type: 'text', class: 'vl-campo vl-campo-apelido', maxlength: 32, 'aria-label': 'Apelido', value: apelidos.get(alvo.id) || '' });
        const acao = await camada.dialogo({
          titulo: alvo.id === dono ? 'Meu apelido' : 'Apelido de ' + alvo.nome,
          texto: 'Apenas você vê este apelido neste navegador.',
          conteudo: entrada,
          botoes: [{ rotulo: 'Cancelar', valor: null, foco: true }, { rotulo: 'Remover apelido', valor: 'remover' }, { rotulo: 'Salvar', valor: 'salvar', destaque: true }],
        });
        if (!acao || parado || dono !== meuId() || alvos().get(nomeComparavel(alvo.nome))?.id !== alvo.id) return;
        const novo = acao === 'salvar' ? entrada.value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32) : '';
        try {
          const k = chave(dono);
          const lido = await area.get(k);
          if (parado || dono !== meuId()) return;
          const dados = { ...lido[k] };
          if (novo) dados[alvo.id] = novo;
          else delete dados[alvo.id];
          await area.set({ [k]: dados });
          if (!parado && dono === meuId()) atualizarDados(dados);
        } catch (e) { camada.aviso('Não consegui salvar o apelido.', { tipo: 'erro' }); }
      }

      function restaurar(no) {
        if (!no.hasAttribute(MARCA)) return;
        no.removeAttribute(MARCA);
        no.style.removeProperty(FONTE);
      }
      function aplicar() {
        relogio = 0;
        trocarConta();
        const pessoas = alvos();
        for (const menu of document.querySelectorAll(MENU)) {
          const nome = menu.querySelector(':scope > .menu-header');
          const item = menu.querySelector(':scope > .menu-item.list-item:not(.vl-editar-apelido)');
          const alvo = nome && pessoas.get(nomeComparavel(nome.textContent));
          const existe = menu.querySelector(':scope > .vl-editar-apelido');
          // Só na página inicial do menu (as páginas internas do jogo têm o item com a seta para a
          // esquerda) e não na página do Vagalume (pedido do usuário em 2026-11-20).
          const interna = !!menu.dataset.vlPagina || !!menu.querySelector(':scope > .menu-item .left.fa-icon');
          if (!conta || !alvo || !item || interna) { existe?.remove(); continue; }
          if (existe?.dataset.pessoa === alvo.id) continue;
          existe?.remove();
          const botao = camada.el('div', { class: item.className + ' vl-editar-apelido', role: 'button', tabindex: '0', texto: 'Apelido', dataset: { pessoa: alvo.id } });
          const abrir = (ev) => { ev.preventDefault(); ev.stopPropagation(); editar(alvo); };
          botao.addEventListener('click', abrir);
          botao.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') abrir(ev); });
          item.before(botao);
        }
        for (const marcado of document.querySelectorAll('.vl-editar-apelido')) if (!marcado.closest(MENU)) marcado.remove();
        for (const no of document.querySelectorAll(NOMES)) {
          const original = no.textContent;
          const pessoa = pessoas.get(nomeComparavel(jogo.limparAutor(original)));
          const apelido = pessoa && apelidos.get(pessoa.id);
          if (!apelido || apelido === original.trim()) { restaurar(no); continue; }
          const exibido = apelido + (/:\s*$/.test(original) ? ': ' : '');
          if (no.getAttribute(MARCA) === exibido) continue;
          if (!no.hasAttribute(MARCA)) no.style.setProperty(FONTE, getComputedStyle(no).fontSize);
          no.setAttribute(MARCA, exibido);
        }
      }
      function agendar() { if (!parado && !relogio) relogio = setTimeout(aplicar, 60); }
      function mudou(mudancas, origem) {
        if (origem === 'local' && mudancas[chave(conta)]) atualizarDados(mudancas[chave(conta)].newValue);
      }
      chrome.storage.onChanged.addListener(mudou);
      const observar = new MutationObserver(agendar);
      observar.observe(document.body, { childList: true, characterData: true, subtree: true });
      // As listas do protocolo podem chegar depois da abertura de um menu que já estava na tela.
      const vigia = setInterval(() => { if (conta !== meuId() || document.querySelector(MENU)) agendar(); }, 750);
      ctx.aoParar(() => {
        parado = true;
        clearTimeout(relogio); clearInterval(vigia); observar.disconnect();
        chrome.storage.onChanged.removeListener(mudou);
        document.querySelectorAll('.vl-editar-apelido').forEach((no) => no.remove());
        document.querySelectorAll('[' + MARCA + ']').forEach(restaurar);
      });
      aplicar();
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
