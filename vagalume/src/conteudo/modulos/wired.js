// Vagalume — módulo "wired": copiar, colar, exportar e importar a configuração de wireds; Enter salva
// a janela de wired; e (opção) não andar ao clicar em mobis.
// Como funciona o copiar e colar: quando você salva um wired, o jogo manda a configuração inteira
// (formato lido no cliente e conferido ao vivo com um ativador: id, números, texto, mobis
// selecionados, código de seleção e três listas). O Vagalume guarda essa mensagem e, ao colar,
// manda a mesma coisa trocando só o id pelo do wired selecionado (o último clicado). Só funciona
// entre wireds do mesmo tipo; o servidor recusa o resto. Colar ainda não foi testado ao vivo.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.conexao || !VL.codigos || !VL.jogo) return;
  const { nucleo, camada, conexao, codigos, jogo } = VL;
  const { SAIDA } = codigos;
  const SALVAR = codigos.SALVAR_WIRED; // { cabecalho: 'nome do tipo' }

  function paraBase64(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
  function deBase64(texto) { const s = atob(texto); const b = new Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }

  nucleo.definirModulo({
    id: 'wired',
    iniciar(ctx) {
      let copiado = null;  // { cabecalho, dados: [bytes sem o id] }
      let ultimo = null;   // última configuração salva no jogo
      let selecionado = null;
      let organizador = null;

      const cancelar = Object.keys(SALVAR).map(function (cab) {
        return conexao.ouvir('saida', Number(cab), function (l, bytes) {
          if (!bytes || bytes.length < 4) return;
          ultimo = { cabecalho: Number(cab), dados: Array.from(bytes.subarray(4)) };
          if (ctx.secao().copiarAoSalvar) copiado = ultimo;
          atualizarAba();
        });
      });
      cancelar.push(conexao.ouvir('saida', SAIDA.CLICAR_MOBI, function (l) { selecionado = l.inteiro(); atualizarAba(); if (organizador) organizador.atualizarSelecao(); }));
      ctx.aoParar(function () { cancelar.forEach((fn) => fn()); });

      // Não andar ao clicar em mobis: o jogo manda "clicar no mobi" (355) e logo depois "andar" (3320).
      // Ao ver o primeiro, segura o andar por um instante. A conversa com o adaptador é síncrona, então
      // o bloqueio já vale para o 3320 do mesmo clique.
      cancelar.push(conexao.ouvir('saida', SAIDA.CLICAR_MOBI, function () {
        if (!ctx.secao().naoAndarAoClicar) return;
        const desfazer = conexao.bloquear('saida', SAIDA.ANDAR);
        setTimeout(desfazer, 300);
      }));

      function descrever(c) { return c ? SALVAR[c.cabecalho] + ' (' + c.dados.length + ' bytes)' : 'nada'; }

      function colar() {
        if (!conexao.disponivel()) { camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' }); return; }
        if (!copiado) { camada.aviso('Nada copiado: salve um wired (ou use copiarwired) primeiro.', { tipo: 'erro' }); return; }
        if (!selecionado) { camada.aviso('Clique no wired que vai receber a configuração.', { tipo: 'erro' }); return; }
        conexao.enviar(copiado.cabecalho, [['i', selecionado], ['r', copiado.dados]]).then(function (r) {
          camada.aviso(r.ok ? 'Configuração colada no wired ' + selecionado + '. Se ele for de outro tipo, o jogo recusa.' : 'Não deu para colar: ' + r.motivo + '.', { tipo: r.ok ? 'ok' : 'erro' });
        });
      }

      function exportar() {
        if (!copiado) { camada.aviso('Nada copiado para exportar.', { tipo: 'erro' }); return; }
        const json = JSON.stringify({ app: 'vagalume', tipo: 'wired', cabecalho: copiado.cabecalho, nome: SALVAR[copiado.cabecalho], dados: paraBase64(copiado.dados) }, null, 2);
        camada.baixar('vagalume-wired-' + camada.carimbo(true) + '.json', json, 'application/json;charset=utf-8');
      }

      function importar(texto) {
        let obj;
        try { obj = JSON.parse(texto); } catch (erro) { camada.aviso('Arquivo inválido.', { tipo: 'erro' }); return; }
        if (!obj || obj.app !== 'vagalume' || obj.tipo !== 'wired' || !SALVAR[obj.cabecalho] || typeof obj.dados !== 'string') {
          camada.aviso('Este arquivo não é uma configuração de wired do Vagalume.', { tipo: 'erro' });
          return;
        }
        let dados;
        try { dados = deBase64(obj.dados); } catch (erro) { camada.aviso('Arquivo corrompido.', { tipo: 'erro' }); return; }
        if (dados.length > 8000) { camada.aviso('Configuração grande demais.', { tipo: 'erro' }); return; }
        copiado = { cabecalho: obj.cabecalho, dados };
        atualizarAba();
        camada.aviso('Configuração importada: ' + descrever(copiado) + '. Clique no wired e cole.', { tipo: 'ok' });
      }

      // Enter salva a janela de wired aberta (como o botão "Pronto"), exceto quando o foco está num
      // campo de texto de várias linhas ou no chat com algo escrito.
      ctx.escutar(window, 'keydown', function (ev) {
        if (ev.key !== 'Enter' || !ctx.secao().enterSalva || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.isComposing) return;
        const janela = document.querySelector('.nitro-wired');
        if (!janela) return;
        const alvo = ev.target;
        if (alvo && alvo.tagName === 'TEXTAREA') return;
        if (alvo && jogo.ehEntradaChat(alvo) && String(alvo.value || '').trim()) return;
        const pronto = janela.querySelector('.btn-success');
        if (!pronto) return;
        ev.preventDefault();
        ev.stopPropagation();
        pronto.click();
      }, true);

      // Configurações avançadas sempre abertas: ao aparecer uma janela de wired, clica uma vez no link
      // "Mostrar configurações avançadas" do jogo (`.text-decoration-underline`, conferido ao vivo em 2026-11-14).
      const janelasVistas = new WeakSet();
      function abrirAvancadas() {
        if (!ctx.secao().avancadasAbertas) return;
        const janela = document.querySelector('.nitro-wired');
        if (!janela || janelasVistas.has(janela)) return;
        const link = [...janela.querySelectorAll('.text-decoration-underline')].find((e) => /^mostrar configura/i.test(e.textContent.trim()));
        if (!link) return;
        janelasVistas.add(janela);
        link.click();
      }
      let pendenteAvancadas = false;
      const observadorAvancadas = new MutationObserver(function () {
        if (pendenteAvancadas) return;
        pendenteAvancadas = true;
        setTimeout(function () { pendenteAvancadas = false; abrirAvancadas(); }, 120);
      });
      if (document.body) observadorAvancadas.observe(document.body, { childList: true, subtree: true });
      ctx.aoParar(function () { observadorAvancadas.disconnect(); });

      // ---------- aba "Wired" ----------
      const el = camada.el;
      let situacao = null;
      let botaoMarcadores = null;
      organizador = VL.wiredToolNotas ? VL.wiredToolNotas.iniciar(ctx, function () { return selecionado; }) : null;
      function atualizarAba() {
        if (situacao && situacao.isConnected) situacao.textContent = 'Copiado: ' + descrever(copiado) + '. Último salvo: ' + descrever(ultimo) + '. Wired selecionado: ' + (selecionado || 'nenhum') + '. Marcadores: ' + (VL.wiredsQuarto && VL.wiredsQuarto.visivel() ? 'visíveis' : 'desligados') + '.';
        if (botaoMarcadores) botaoMarcadores.textContent = VL.wiredsQuarto && VL.wiredsQuarto.visivel() ? 'Esconder marcadores' : 'Ver wireds ocultos';
      }
      ctx.ouvir('wireds:visibilidade', atualizarAba);
      ctx.aba({
        id: 'wired',
        titulo: 'Wired',
        ordem: 47,
        montar(alvo) {
          situacao = el('p', { class: 'vl-nota' });
          const arquivo = el('input', { type: 'file', accept: 'application/json,.json' });
          botaoMarcadores = el('button', { type: 'button', class: 'vl-botao destaque', texto: 'Ver wireds ocultos', onclick() {
            if (!VL.wiredsQuarto) { camada.aviso('Ligue o módulo Construção para ver os wireds no quarto.', { tipo: 'erro' }); return; }
            VL.wiredsQuarto.alternar().then(atualizarAba);
          } });
          arquivo.addEventListener('change', function () {
            const f = arquivo.files && arquivo.files[0];
            if (!f) return;
            if (f.size > 100000) { camada.aviso('Arquivo grande demais.', { tipo: 'erro' }); return; }
            f.text().then(importar);
            arquivo.value = '';
          });
          alvo.replaceChildren(
            situacao,
            el('div', { class: 'vl-linha' }, [
              el('button', { type: 'button', class: 'vl-botao destaque', texto: '✦ Organizar Wired Tool', onclick() { if (organizador) organizador.abrir(); } }),
              el('span', { class: 'vl-nota', texto: 'Nomes de antenas, pilhas e anotações compartilhadas no quarto.' }),
            ]),
            el('div', { class: 'vl-linha' }, [
              botaoMarcadores,
              el('button', { type: 'button', class: 'vl-botao', texto: 'Copiar último salvo', onclick() { if (ultimo) { copiado = ultimo; atualizarAba(); } else camada.aviso('Salve um wired primeiro.'); } }),
              el('button', { type: 'button', class: 'vl-botao primario', texto: 'Colar no selecionado', onclick: colar }),
              el('button', { type: 'button', class: 'vl-botao', texto: 'Exportar', onclick: exportar }),
            ]),
            el('label', { class: 'vl-nota' }, [el('span', { texto: 'Importar de arquivo: ' }), arquivo]),
            el('p', { class: 'vl-nota', texto: 'Ver wireds ocultos cria marcadores locais nos pisos; eles continuam após :wired e abrem a configuração ao clicar (se você tiver direitos). Para copiar: abra um wired e salve (Pronto). Para colar: clique no wired de destino, do mesmo tipo, e use "Colar no selecionado".' })
          );
          atualizarAba();
          return function () { situacao = null; botaoMarcadores = null; };
        },
      });

      ctx.comando({ nome: 'copiarwired', uso: 'copiarwired', descricao: 'Copia a configuração do último wired salvo.', executar() { if (ultimo) { copiado = ultimo; camada.aviso('Copiado: ' + descrever(copiado) + '.', { tipo: 'ok' }); } else camada.aviso('Salve um wired primeiro.', { tipo: 'erro' }); } });
      ctx.comando({ nome: 'colarwired', apelidos: ['clonarwired'], uso: 'colarwired', descricao: 'Cola a configuração copiada no wired selecionado (o último clicado).', executar: colar });
      ctx.comando({ nome: 'exportarwired', uso: 'exportarwired', descricao: 'Baixa a configuração copiada num arquivo.', executar: exportar });
      ctx.comando({ nome: 'wirednotas', uso: 'wirednotas', descricao: 'Abre nomes e anotações do Wired Tool para o quarto.', executar() { if (organizador) organizador.abrir(); } });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
