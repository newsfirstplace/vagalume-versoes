// Vagalume — módulo "comandos": comandos locais digitados no chat do jogo (por exemplo "/ajuda").
// O texto é interceptado antes de o jogo enviá-lo: um comando nunca vira fala.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.comandos) return;
  const { nucleo, camada, jogo } = VL;
  const el = camada.el;

  const ACOES_COM_PESSOA = [
    ['empurrar', 'push', 'Empurra a pessoa um piso para longe (ela precisa estar ao seu lado)'],
    ['puxar', 'pull', 'Puxa a pessoa para perto de você'],
    ['abracar', 'abracar', 'Abraça a pessoa'],
    ['beijar', 'kiss', 'Beija a pessoa', { comando: 'beijar', verbo: 'beijou', efeito: 9, gesto: 2 }],          // efeito 9: Apaixonado
    ['socar', 'soco', 'Dá um soco na pessoa', { comando: 'socar', verbo: 'deu um soco em', efeito: 157 }],    // efeito 157 (pedido do usuário em 2026-11-16)
  ];

  nucleo.definirModulo({
    id: 'comandos',
    iniciar(ctx) {
      ctx.aoConfig(function () {}); // o prefixo é lido a cada Enter; não é preciso reiniciar

      function prefixo() {
        return VL.comandos.inicioDigitado(ctx.secao().prefixo);
      }

      // "x" no lugar do apelido, como nos comandos do Habblet: vale a última pessoa clicada (a do
      // quadro de informações do canto). O nome sai de `.nitro-infostand` com `.body-image` (avatar) e
      // `.goldfish.fw-bold` (apelido), conferido ao vivo em 2026-11-14; fica guardado depois de fechar o quadro.
      let ultimaPessoa = '';
      function lerPessoaDoQuadro() {
        for (const quadro of document.querySelectorAll('.nitro-infostand')) {
          if (!quadro.querySelector('.body-image .avatar-image')) continue;
          const n = quadro.querySelector('.goldfish.fw-bold');
          const nome = n ? n.textContent.trim() : '';
          if (nome) return nome;
        }
        return '';
      }
      function pessoaSelecionada() {
        const agora = lerPessoaDoQuadro();
        if (agora) ultimaPessoa = agora;
        return ultimaPessoa;
      }
      let pendenteQuadro = false;
      const observadorQuadro = new MutationObserver(function () {
        if (pendenteQuadro) return;
        pendenteQuadro = true;
        setTimeout(function () { pendenteQuadro = false; pessoaSelecionada(); }, 250);
      });
      if (document.body) observadorQuadro.observe(document.body, { childList: true, subtree: true });
      ctx.aoParar(function () { observadorQuadro.disconnect(); });

      function trocarX(def, pedido) {
        if (!def.alvoX || !pedido.args.length || !/^x$/i.test(pedido.args[0])) return pedido;
        const nome = pessoaSelecionada();
        if (!nome) return null;
        return Object.assign({}, pedido, {
          args: [nome].concat(pedido.args.slice(1)),
          resto: String(pedido.resto || '').replace(/^x(?=\s|$)/i, nome),
        });
      }

      function pessoasNoQuarto() {
        return (VL.pessoas && VL.pessoas.lista ? VL.pessoas.lista() : []).map((nome) => ({
          nome, apelido: VL.apelidos && VL.apelidos.de ? VL.apelidos.de(nome) : '',
        }));
      }

      function nomeOriginalNoInicio(resto) {
        return VL.comandos.substituirApelidoInicial(resto, pessoasNoQuarto());
      }

      function executar(pedido) {
        const def = nucleo.comandos.achar(pedido.nome);
        if (!def) {
          camada.aviso('Comando desconhecido: “' + pedido.nome + '”. Digite ' + prefixo() + 'ajuda.', { tipo: 'erro' });
          return;
        }
        const comX = trocarX(def, pedido);
        if (!comX) {
          camada.aviso('Para usar x, clique antes na pessoa (o quadro dela abre no canto).', { tipo: 'erro' });
          return;
        }
        pedido = comX;
        if (def.alvoX || /apelido/.test(String(def.uso || ''))) {
          const resto = nomeOriginalNoInicio(pedido.resto);
          if (resto !== pedido.resto) pedido = Object.assign({}, pedido, { resto, args: resto.trim().split(/\s+/) });
        }
        function falhou(erro) {
          console.warn('[Vagalume] O comando "' + pedido.nome + '" falhou:', erro);
          camada.aviso('O comando falhou: ' + ((erro && erro.message) || 'erro inesperado'), { tipo: 'erro' });
        }
        try {
          const retorno = def.executar(pedido);
          if (retorno && typeof retorno.then === 'function') retorno.then(null, falhou);
        } catch (erro) {
          falhou(erro);
        }
      }

      // ---------- ações com outra pessoa ----------
      // :push, :pull e :abracar são comandos do Habblet. /beijar e /socar usam
      // a sala do Vagalume para que o efeito apareça só a quem tem a extensão;
      // os comandos nativos :kiss e :soco continuam disponíveis no chat do hotel.
      const BALAO_AVISO = 34; // balão com "!" das mensagens do jogo (visto no Barzinho)
      // autor: quem fez (outro Vagalume do quarto, pela presença); sem autor, sou eu.
      function soNaTela(alvo, propria, autor) {
        const pessoas = VL.pessoas;
        const cx = VL.conexao;
        if (!pessoas || !pessoas.indiceDe || !cx || !cx.disponivel()) {
          camada.aviso('Para isso, ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' });
          return;
        }
        const indice = pessoas.indiceDe(alvo);
        if (indice == null) { camada.aviso(alvo + ' não está neste quarto.', { tipo: 'erro' }); return; }
        const meu = autor ? pessoas.indiceDe(autor) : (pessoas.meuIndice ? pessoas.meuIndice() : null);
        const eu = autor || (pessoas.eu && pessoas.eu()) || 'Você';
        // Só lado a lado (um dos 8 pisos em volta), como o abraço do jogo (pedido do usuário em 2026-11-16).
        // Vale também para a ação que chega de outro Vagalume: de longe, não aparece.
        if (meu === indice) { if (!autor) camada.aviso('Escolha outra pessoa.', { tipo: 'erro' }); return; }
        const pa = pessoas.posicaoDe && meu != null ? pessoas.posicaoDe(meu) : null;
        const pb = pessoas.posicaoDe ? pessoas.posicaoDe(indice) : null;
        if (pa && pb && Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y)) > 1) {
          if (!autor) camada.aviso('Fique ao lado de ' + alvo + ' para ' + (propria.comando === 'socar' ? 'socar' : 'beijar') + '.', { tipo: 'erro' });
          return;
        }
        const C = VL.codigos;
        const texto = '* ' + eu + ' ' + propria.verbo + ' ' + alvo + ' *';
        if (meu != null) cx.injetar(C.ENTRADA.SUSSURRO, [['i', meu], ['s', texto], ['i', 0], ['i', BALAO_AVISO], ['i', 0], ['i', texto.length]]);
        else camada.aviso(texto);
        // efeito só na tela, e depois volta o que a pessoa tinha
        const antes = pessoas.efeitoDe ? pessoas.efeitoDe(indice) : 0;
        cx.injetar(C.ENTRADA.EFEITO, [['i', indice], ['i', propria.efeito], ['i', 0]]);
        setTimeout(function () { cx.injetar(C.ENTRADA.EFEITO, [['i', indice], ['i', (pessoas.efeitoDe ? pessoas.efeitoDe(indice) : 0) === propria.efeito ? antes : (pessoas.efeitoDe ? pessoas.efeitoDe(indice) : antes)], ['i', 0]]); }, 6000);
        if (autor) return; // de outro Vagalume: só o balão e o efeito
        // As outros Vagalumes do quarto também veem o balão e o efeito (pela presença no servidor).
        if (VL.comunidade && VL.comunidade.acao) VL.comunidade.acao({ acao: 'pessoa', comando: propria.comando, alvo }).then(function (r) {
          if (!r || !r.ok) camada.aviso('A ação apareceu só para você: não consegui compartilhá-la com as outros Vagalumes.', { tipo: 'erro' });
        });
        else camada.aviso('A ação apareceu só para você: ligue Comunidade Vagalume para compartilhá-la.', { tipo: 'erro' });
        // virar para a pessoa (e mandar beijo): de verdade, todos veem
        const pos = pessoas.posicaoDe ? pessoas.posicaoDe(indice) : null;
        if (pos) cx.enviar(C.SAIDA.OLHAR_PARA, [['i', pos.x], ['i', pos.y]], { forcar: true });
        if (propria.gesto) cx.enviar(C.SAIDA.EXPRESSAO, [['i', propria.gesto]]);
      }
      // Beijar e socar de outro Vagalume do quarto: mostra aqui o mesmo balão e o mesmo efeito.
      function aoAcaoDeOutra(m) {
        if (!m || m.de !== 'sala' || m.tipo !== 'presenca:acao' || !m.dado || m.dado.acao !== 'pessoa') return;
        const item = ACOES_COM_PESSOA.find((a) => a[0] === m.dado.comando && a[3]);
        const alvo = String(m.dado.alvo || '').slice(0, 40);
        const autor = String(m.nome || '').slice(0, 40);
        const pessoas = VL.pessoas;
        if (!item || !alvo || !autor || !pessoas || !pessoas.indiceDe) return;
        if (pessoas.eu && String(pessoas.eu()).toLowerCase() === autor.toLowerCase()) return;
        if (pessoas.indiceDe(autor) == null || pessoas.indiceDe(alvo) == null) return; // os dois precisam estar aqui
        soNaTela(alvo, item[3], autor);
      }
      chrome.runtime.onMessage.addListener(aoAcaoDeOutra);
      ctx.aoParar(function () { chrome.runtime.onMessage.removeListener(aoAcaoDeOutra); });
      for (const [nome, doJogo, descricao, propria] of ACOES_COM_PESSOA) {
        ctx.comando({
          nome,
          alvoX: true,
          uso: nome + ' <apelido | x>',
          descricao: descricao + (propria ? ' (aparece para quem usa o Vagalume no quarto).' : ' (comando :' + doJogo + ' do Habblet).'),
          executar(pedido) {
            const alvo = String(pedido.args[0] || '').replace(/^@/, '');
            if (!alvo) { camada.aviso('Diga com quem: ' + prefixo() + nome + ' <apelido>, ou clique na pessoa e use x.', { tipo: 'erro' }); return; }
            if (propria) { soNaTela(alvo, propria); return; }
            if (!jogo.enviarFala(':' + doJogo + ' ' + alvo)) camada.aviso('Entre num quarto para usar o chat.', { tipo: 'erro' });
          },
        });
      }

      // ---------- sugestões enquanto a pessoa digita ----------

      // Só "/" (ou ":vl ") mostra todos os comandos, numa lista com rolagem; com o começo de um nome,
      // os que combinam. Clicar num item escreve o comando no campo; setas ↑↓ escolhem e Tab completa.
      // "@" seguido do começo de um apelido sugere quem está no quarto (pedido do usuário em 2026-11-14).
      let caixa = null;   // lista de sugestões na camada, quando aberta
      let itensAtuais = [];
      let escolhido = 0;
      let campoAtual = null;

      function fecharSugestoes() {
        if (caixa) caixa.remove();
        caixa = null;
        itensAtuais = [];
        escolhido = 0;
        campoAtual = null;
      }

      // "@parcial" no fim do texto: devolve { inicio, parcial } ou null.
      function arrobaNoFim(valor) {
        const m = /(^|\s)@([^\s@]*)$/.exec(String(valor || ''));
        return m ? { inicio: m.index + m[1].length, parcial: m[2] } : null;
      }

      // "/comando parcial" de um comando que pede uma pessoa: sugere quem está no quarto (sem @; pedido do
      // usuário em 2026-11-15). No /liberar, sugere quem está silenciado.
      function apelidoNoComando(valor) {
        const inicio = VL.comandos.inicioDigitado(ctx.secao().prefixo);
        const v = String(valor || '');
        if (!v.toLowerCase().startsWith(inicio.toLowerCase())) return null;
        const m = /^(\S+) +(.*)$/.exec(v.slice(inicio.length));
        if (!m) return null;
        const cmd = nucleo.comandos.achar(m[1].toLowerCase());
        if (!cmd || cmd.nome === 'gerarvisual' || !(cmd.alvoX || /apelido/.test(String(cmd.uso || '')))) return null;
        return { cmd, inicio: v.length - m[2].length, parcial: m[2].replace(/^@/, '') };
      }
      function textoCompleto(item, valor) {
        if (item.apelidoEm != null) return valor.slice(0, item.apelidoEm) + item.nome + ' ';
        if (item.arroba) return valor.slice(0, item.arroba.inicio) + '@' + item.nome + ' ';
        return item.completar || prefixo() + item.nome + ' ';
      }

      function completar(campo, item) {
        jogo.definirValor(campo, textoCompleto(item, String(campo.value || '')));
        campo.focus();
        sugerir(campo);
      }

      function sugestoesPessoas(parcial, inicio, tipo) {
        return VL.comandos.sugerirPessoas(pessoasNoQuarto(), parcial, 30).map((p) => ({
          nome: p.nome,
          uso: p.apelido && p.apelido !== p.nome ? p.apelido + ' → ' + p.nome : p.nome,
          descricao: 'no quarto',
          ...(tipo === 'arroba' ? { arroba: inicio } : { apelidoEm: inicio }),
        }));
      }

      function itensPara(valor) {
        const s = ctx.secao();
        const nativo = /^(:\S+ +)(.*)$/.exec(String(valor || ''));
        if (nativo && nativo[1].trim().toLowerCase() !== VL.comandos.cabeca(s.prefixo)) {
          return sugestoesPessoas(nativo[2].replace(/^@/, ''), nativo[1].length);
        }
        const arroba = arrobaNoFim(valor);
        const mencoes = ctx.config().mencoes || {};
        if (arroba && mencoes.sugerirApelidos !== false && VL.pessoas && VL.pessoas.lista) {
          return sugestoesPessoas(arroba.parcial, arroba, 'arroba');
        }
        const pede = apelidoNoComando(valor);
        if (pede) {
          if (pede.cmd.nome === 'liberar') {
            const p = pede.parcial.toLowerCase();
            const achados = ((ctx.config().silenciar || {}).apelidos || []).filter((n) => String(n).toLowerCase().startsWith(p) && String(n).toLowerCase() !== p).slice(0, 30);
            if (achados.length) return achados.map((n) => ({ nome: n, uso: n, descricao: 'silenciado', apelidoEm: pede.inicio }));
          } else {
            const achados = sugestoesPessoas(pede.parcial, pede.inicio);
            if (achados.length) return achados;
          }
        }
        if (!s.sugestoes) return [];
        const inicio = VL.comandos.inicioDigitado(s.prefixo).trim().toLowerCase();
        const tudo = String(valor || '').trim().toLowerCase() === inicio;
        let itens = VL.comandos.sugerir(valor, s.prefixo, nucleo.comandos.listar(), tudo ? 500 : 30);
        if (!itens.length) itens = VL.comandos.sugerirDoJogo(valor, s.prefixo, 30);
        return itens;
      }

      function marcarEscolhido() {
        if (!caixa) return;
        caixa.querySelectorAll('.vl-sugestao').forEach(function (no, i) {
          no.classList.toggle('primeira', i === escolhido);
          if (i === escolhido && typeof no.scrollIntoView === 'function') no.scrollIntoView({ block: 'nearest' });
        });
      }

      function sugerir(campo) {
        const itens = itensPara(campo.value);
        if (!itens.length) { fecharSugestoes(); return; }
        const p = prefixo();
        const lista = el('div', { class: 'vl-sugestoes-lista' }, itens.map(function (s, i) {
          const no = el('div', { class: 'vl-sugestao' }, [
            el('code', { class: 'vl-codigo', texto: s.arroba || s.completar || s.apelidoEm != null ? s.uso : p + s.uso }),
            el('span', { class: 'vl-nota', texto: s.descricao }),
          ]);
          // mousedown sem efeito padrão: o campo de chat não perde o foco com o clique.
          no.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
          no.addEventListener('click', function (ev) { ev.preventDefault(); if (campoAtual) completar(campoAtual, itens[i]); });
          no.addEventListener('mouseenter', function () { escolhido = i; marcarEscolhido(); });
          return no;
        }));
        const rodape = el('p', { class: 'vl-nota', texto: itens.length > 1 ? itens.length + ' opções · clique, ou ↑↓ e Tab' : 'Clique ou Tab para completar' });
        if (!caixa) {
          caixa = el('div', { class: 'vl-sugestoes' });
          camada.area().appendChild(caixa);
        }
        caixa.replaceChildren(lista, rodape);
        // Logo acima do campo de chat.
        const r = campo.getBoundingClientRect();
        caixa.style.left = Math.max(8, Math.round(r.left)) + 'px';
        caixa.style.bottom = Math.max(8, Math.round(window.innerHeight - r.top + 6)) + 'px';
        const mesmaLista = itensAtuais.length === itens.length && itensAtuais.every((x, i) => x.nome === itens[i].nome);
        if (!mesmaLista) escolhido = 0;
        itensAtuais = itens;
        campoAtual = campo;
        marcarEscolhido();
      }

      ctx.escutar(window, 'input', function (ev) {
        if (jogo.ehEntradaChat(ev.target)) sugerir(ev.target);
      }, true);
      ctx.escutar(window, 'focusout', function (ev) {
        if (jogo.ehEntradaChat(ev.target)) fecharSugestoes();
      }, true);
      ctx.escutar(window, 'keydown', function (ev) {
        if (!caixa || !jogo.ehEntradaChat(ev.target) || !ev.isTrusted) return;
        if (ev.key === 'Escape') { fecharSugestoes(); return; } // o Esc segue para o jogo
        if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && itensAtuais.length > 1) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          const n = itensAtuais.length;
          escolhido = (escolhido + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n;
          marcarEscolhido();
          return;
        }
        if (ev.key !== 'Tab' || ev.shiftKey || !itensAtuais.length) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        completar(ev.target, itensAtuais[escolhido] || itensAtuais[0]);
      }, true);
      ctx.aoParar(fecharSugestoes);

      // Fase de captura na janela: roda antes dos ouvintes que o jogo põe no campo de chat.
      ctx.escutar(window, 'keydown', function (ev) {
        if (ev.key !== 'Enter' || !ev.isTrusted || ev.isComposing || ev.ctrlKey || ev.altKey || ev.metaKey) return;
        const campo = ev.target;
        if (!jogo.ehEntradaChat(campo)) return;
        fecharSugestoes();
        const nativo = /^(:\S+\s+)(.*)$/.exec(String(campo.value || ''));
        if (nativo && nativo[1].trim().toLowerCase() !== VL.comandos.cabeca(ctx.secao().prefixo)) {
          const original = nomeOriginalNoInicio(nativo[2]);
          if (original !== nativo[2]) jogo.definirValor(campo, nativo[1] + original);
          return;
        }
        const pedido = VL.comandos.interpretar(campo.value, ctx.secao().prefixo);
        if (!pedido) return;
        if (ctx.secao().prefixo === '/' && !nucleo.comandos.achar(pedido.nome)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        jogo.limparEntrada(campo);
        executar(pedido);
      }, true);

      ctx.comando({
        nome: 'ajuda',
        apelidos: ['?', 'help'],
        uso: 'ajuda',
        descricao: 'Mostra os comandos disponíveis.',
        executar() {
          if (ctx.ativo('painel')) {
            ctx.emitir('painel:abrir', { aba: 'comandos' });
            return;
          }
          const linhas = nucleo.comandos.listar().map((c) => prefixo() + '' + (c.uso || c.nome) + ' — ' + (c.descricao || ''));
          camada.aviso(linhas.join('\n'), { duracaoMs: 12000 });
        },
      });

      ctx.comando({
        nome: 'buscar',
        apelidos: ['procurar'],
        uso: 'buscar <termo>',
        descricao: 'Procura funções do Vagalume (comandos e módulos) por palavra.',
        executar(pedido) {
          const termo = pedido.args.join(' ');
          const achados = VL.comandos.buscarFuncoes(termo, nucleo.comandos.listar(), VL.padroes.CATALOGO, 30);
          if (!termo.trim()) { camada.aviso('Use: buscar <termo>', { tipo: 'erro' }); return; }
          if (!achados.length) { camada.aviso('Nada encontrado para "' + termo + '".'); return; }
          camada.dialogo({
            titulo: 'Busca: ' + termo,
            texto: achados.length + ' resultado(s). Módulos se ligam no ícone do Vagalume ou nas opções.',
            detalhe: achados.map((a) => (a.tipo === 'modulo' ? 'Módulo ' + a.nome : prefixo() + '' + a.nome) + ' — ' + a.texto).join('\n'),
          });
        },
      });

      // Janela de novidades: cada item 'Título: texto' vira um cartão numerado.
      function mostrarNovidades(versao) {
        const itens = VL.padroes.NOVIDADES.map(function (n, i) {
          const k = n.indexOf(':');
          const titulo = k > 0 && k < 40 ? n.slice(0, k) : '';
          const texto = titulo ? n.slice(k + 1).trim() : n;
          return el('li', { class: 'vl-nov-item' }, [
            el('span', { class: 'vl-nov-num', 'aria-hidden': 'true', texto: String(i + 1) }),
            el('div', null, [titulo ? el('strong', { texto: titulo }) : null, el('span', { texto: texto.charAt(0).toUpperCase() + texto.slice(1) })]),
          ]);
        });
        const conteudo = el('div', null, [
          el('div', { class: 'vl-nov-topo' }, [
            el('span', { class: 'vl-nov-ponto', 'aria-hidden': 'true' }),
            el('div', null, [el('p', { class: 'vl-nov-titulo', texto: 'Novidades do Vagalume' }), el('p', { class: 'vl-nov-sub', texto: 'Veja o que chegou nesta atualização.' })]),
            el('span', { class: 'vl-nov-versao', texto: 'v' + versao }),
          ]),
          el('ul', { class: 'vl-nov-lista' }, itens),
        ]);
        camada.dialogo({ titulo: 'Novidades do Vagalume ' + versao, conteudo, classe: 'vl-nov-caixa', botoes: [{ rotulo: 'Entendi, vamos lá!', valor: null, foco: true, destaque: true }] });
      }

      // Novidades: uma vez por versão nova (não na primeira instalação).
      try {
        const versao = chrome.runtime.getManifest().version;
        chrome.storage.local.get('vl.versaoVista').then(function (r) {
          const vista = r && r['vl.versaoVista'];
          if (vista && vista !== versao && ctx.secao().novidades && VL.padroes.NOVIDADES.length) {
            mostrarNovidades(versao);
          }
          if (vista !== versao) chrome.storage.local.set({ 'vl.versaoVista': versao });
        }).catch(function () { /* sem armazenamento: sem aviso */ });
      } catch (erro) { /* extensão recarregada: sem aviso */ }

      // Ver e mudar opções pelo chat, com a mesma validação da página de opções (config.mesclarSecao).
      // Listas (macros, termos, apelidos) ficam só na página de opções.
      const SIM = ['ligar', 'ligado', 'sim', 'true', '1', 'on'];
      const NAO = ['desligar', 'desligado', 'nao', 'não', 'false', '0', 'off'];
      function mostrarValor(v) { return Array.isArray(v) ? v.length + ' itens' : typeof v === 'boolean' ? (v ? 'ligado' : 'desligado') : JSON.stringify(v); }
      ctx.comando({
        nome: 'opcao',
        apelidos: ['opção', 'config'],
        uso: 'opcao [seção[.chave] [valor]]',
        descricao: 'Para usuários avançados: muda um ajuste pelo chat, sem abrir o painel (Alt+V faz o mesmo com botões). Ex.: /opcao zoom.maximo 6. Sem nada, lista as seções; /opcao zoom lista os ajustes do zoom.',
        async executar(pedido) {
          const PADROES = VL.padroes.PADROES;
          const alvo = pedido.args[0] || '';
          const p = VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo);
          const nomeDaSecao = function (s) { const m = VL.padroes.CATALOGO.find((x) => x.id === s); return m ? m.nome : (s === 'modulos' ? 'Módulos ligados e desligados' : ''); };
          const rotuloDe = function (s, k) { if (s === 'modulos') return nomeDaSecao(k); const lista = (VL.campos && VL.campos.AJUSTES[s]) || []; const c = lista.find((x) => x.chave === k); return c ? c.rotulo : ''; };
          if (!alvo) {
            camada.dialogo({
              titulo: 'Ajustes pelo chat',
              texto: 'O jeito mais fácil de mudar ajustes é o painel (Alt+V, aba Ajustes). Este comando faz o mesmo pelo chat, em três passos: ' + p + 'opcao <seção> mostra os ajustes da seção; ' + p + 'opcao <seção>.<ajuste> mostra o valor; ' + p + 'opcao <seção>.<ajuste> <valor> muda (ligar, desligar ou um número). Exemplo: ' + p + 'opcao contador.canto inf-dir',
              detalhe: Object.keys(PADROES).map((s) => s + (nomeDaSecao(s) ? '  —  ' + nomeDaSecao(s) : '')).join('\n'),
            });
            return;
          }
          const [secao, chave] = alvo.split('.');
          if (!PADROES[secao]) { camada.aviso('Seção desconhecida: ' + secao + '. Use /opcao para ver a lista.', { tipo: 'erro' }); return; }
          const atual = ctx.secao(secao) || {};
          if (!chave) {
            camada.dialogo({ titulo: 'Ajustes: ' + (nomeDaSecao(secao) || secao), texto: 'Para mudar: ' + p + 'opcao ' + secao + '.<ajuste> <valor>. Exemplo: ' + p + 'opcao ' + secao + '.' + Object.keys(PADROES[secao])[0] + ' ' + (typeof PADROES[secao][Object.keys(PADROES[secao])[0]] === 'boolean' ? 'ligar' : '<valor>'), detalhe: Object.keys(PADROES[secao]).map((k) => k + ' = ' + mostrarValor(atual[k]) + (rotuloDe(secao, k) ? '   (' + rotuloDe(secao, k) + ')' : '')).join('\n') });
            return;
          }
          if (!(chave in PADROES[secao])) { camada.aviso('A seção ' + secao + ' não tem a chave ' + chave + '.', { tipo: 'erro' }); return; }
          const padrao = PADROES[secao][chave];
          const bruto = pedido.args.slice(1).join(' ').trim();
          if (!bruto) { camada.aviso(secao + '.' + chave + ' = ' + mostrarValor(atual[chave])); return; }
          let valor;
          if (Array.isArray(padrao) || (padrao && typeof padrao === 'object')) { camada.aviso('Listas se mudam na página de opções.', { tipo: 'erro' }); return; }
          if (typeof padrao === 'boolean') {
            const b = bruto.toLowerCase();
            if (SIM.includes(b)) valor = true; else if (NAO.includes(b)) valor = false;
            else { camada.aviso('Use ligar ou desligar.', { tipo: 'erro' }); return; }
          } else if (typeof padrao === 'number') {
            valor = Number(bruto.replace(',', '.'));
            if (!Number.isFinite(valor)) { camada.aviso('Use um número.', { tipo: 'erro' }); return; }
          } else valor = /^(""|''|vazio|limpar)$/i.test(bruto) ? '' : bruto; // "" ou vazio apaga o texto
          const aceito = VL.config.mesclarSecao(secao, Object.assign({}, atual, { [chave]: valor }))[chave];
          if (aceito === atual[chave] && aceito !== valor) { camada.aviso('Valor não aceito para ' + secao + '.' + chave + '.', { tipo: 'erro' }); return; }
          await ctx.alterar(secao, { [chave]: aceito });
          camada.aviso(secao + '.' + chave + ' = ' + mostrarValor(aceito) + (aceito !== valor ? ' (ajustado ao limite)' : '') + '. Algumas opções só valem depois de recarregar o hotel.', { tipo: 'ok' });
        },
      });

      ctx.comando({
        nome: 'recarregarextensao',
        apelidos: ['recarregarvl'],
        uso: 'recarregarextensao',
        descricao: 'Para quem carregou o Vagalume sem compactação: relê os arquivos da pasta e recarrega o hotel.',
        executar() {
          let pedido;
          try { pedido = chrome.runtime.sendMessage({ tipo: 'recarregar-extensao' }); } catch (erro) { camada.aviso('A extensão já foi recarregada: recarregue o hotel.', { tipo: 'erro' }); return; }
          return pedido.then(function (r) {
            if (!r || !r.ok) { camada.aviso('Só funciona com o Vagalume carregado sem compactação.', { tipo: 'erro' }); return; }
            camada.aviso('Recarregando o Vagalume e o hotel…');
            setTimeout(function () { location.reload(); }, 1500);
          }, function () { camada.aviso('Não deu para falar com a extensão.', { tipo: 'erro' }); });
        },
      });

      // Medidor de desempenho (2026-11-20, o usuário achou o jogo menos fluido com o Vagalume): mede
      // durante alguns segundos os quadros da página e o tempo de cada parte do Vagalume.
      ctx.comando({
        nome: 'desempenho',
        apelidos: ['medir', 'lag'],
        uso: 'desempenho [segundos]',
        descricao: 'Mede por 15 s (ou o que você escolher) os FPS do jogo e quanto tempo cada parte do Vagalume ocupa. Use na hora em que o jogo estiver travando.',
        async executar({ args }) {
          if (!VL.medidor) { camada.aviso('O medidor não carregou. Recarregue a extensão.', { tipo: 'erro' }); return; }
          if (VL.medidor.ativo()) { camada.aviso('Já tem uma medição rodando.'); return; }
          const segundos = Math.max(3, Math.min(60, parseInt(args[0], 10) || 15));
          camada.aviso('Medindo por ' + segundos + ' s. Continue jogando normalmente (ande, fale, abra janelas).', { duracaoMs: 4000 });
          const conexao = VL.conexao && VL.conexao.disponivel && VL.conexao.disponivel() && VL.conexao.medida ? VL.conexao : null;
          if (conexao) await conexao.medida(true);
          const r = await VL.medidor.medir(segundos);
          const ponte = conexao ? await conexao.medida(false) : null;
          const nomes = {};
          const C = VL.codigos;
          if (C && C.ENTRADA) for (const [k, v] of Object.entries(C.ENTRADA)) if (typeof v === 'number') nomes[v] = k;
          const kb = (n) => (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
          const linhas = [];
          linhas.push('Medição de ' + r.segundos + ' s');
          linhas.push('Jogo: ' + r.fps + ' FPS em média; ' + r.lentos + ' quadros lentos (mais de 34 ms); o pior levou ' + r.pior + ' ms.');
          linhas.push('');
          linhas.push('Vagalume (extensão): ' + r.extensaoMs + ' ms no total = ' + r.porSegundo + ' ms por segundo (' + (r.porSegundo / 10).toFixed(1) + '% do tempo).');
          for (const x of r.lista.slice(0, 10)) linhas.push('  ' + x.ms + ' ms · ' + x.onde + ' · ' + x.vezes + 'x');
          if (ponte) {
            linhas.push('');
            linhas.push('Ponte da conexão (na página do jogo): ' + ponte.ms + ' ms; ' + ponte.mensagens + ' mensagens do jogo; ' + kb(ponte.bytes) + ' repassados à extensão.');
            const porBytes = Object.entries(ponte.porCodigo || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
            for (const [cod, b] of porBytes) linhas.push('  ' + kb(b) + ' · código ' + cod + (nomes[cod] ? ' (' + nomes[cod] + ')' : ''));
            const porTempo = Object.entries(ponte.extensaoPorCodigo || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
            if (porTempo.length) linhas.push('Tempo na extensão por mensagem:');
            for (const [cod, ms] of porTempo) linhas.push('  ' + Math.round(ms) + ' ms · código ' + cod + (nomes[cod] ? ' (' + nomes[cod] + ')' : ''));
          }
          const texto = linhas.join('\n');
          const escolha = await camada.dialogo({ titulo: 'Desempenho do Vagalume', texto: 'Mande este resultado para quem cuida da extensão (o botão copia).', detalhe: texto, largo: true, botoes: [{ rotulo: 'Fechar', valor: null }, { rotulo: 'Copiar resultado', valor: 'copiar', primario: true, foco: true }] });
          if (escolha === 'copiar') camada.copiar(texto).then((ok) => camada.aviso(ok ? 'Resultado copiado.' : 'Não deu para copiar; selecione o texto no quadro.'));
        },
      });

      ctx.comando({
        nome: 'versao',
        apelidos: ['versão'],
        uso: 'versao',
        descricao: 'Mostra a versão do Vagalume instalada.',
        executar() {
          let versao = VL.padroes.VERSAO;
          try { versao = chrome.runtime.getManifest().version || versao; } catch (erro) { /* extensão recarregada: fica a do código */ }
          camada.aviso('Vagalume ' + versao + '. Extensão não oficial, sem vínculo com o Habblet.');
        },
      });

      // Aba "Quarto": os comandos do dia a dia num clique. Cada botão chama o comando do Vagalume de
      // mesmo nome; os de módulos desligados não aparecem.
      // Aba Quarto repaginada (pedido do usuário em 2026-11-15): sem o grupo Avatar; cada ação é um
      // cartão com nome, uma linha do que faz e, nas que ligam e desligam, o estado atual.
      const BOTOES_QUARTO = [
        { titulo: 'Quarto', itens: [
          { rotulo: 'Entrar de novo', cmd: 'reentrar', desc: 'Recarrega o quarto em que você está.' },
          { rotulo: 'Últimos quartos', cmd: 'quartos', desc: 'Lista os quartos desta sessão.' },
          { rotulo: 'Zoom normal', cmd: 'zoom', args: ['normal'], desc: 'Volta o quarto ao tamanho normal.' },
        ] },
        { titulo: 'Pessoas', itens: [
          { rotulo: 'Só amigos', cmd: 'soamigos', desc: 'Esconde quem não é seu amigo.', estado: () => !!(ctx.config().amigos || {}).soAmigos },
          { rotulo: 'Destacar amigos', cmd: 'lotado', desc: 'Quem não é seu amigo vira fantasma por alguns segundos, só na sua tela.' },
          { rotulo: 'Amigos', cmd: 'amigos', desc: 'Quem está online, seguir e mensagem.' },
          { rotulo: 'Silenciados', cmd: 'silenciados', desc: 'Quem você escondeu do chat.' },
        ] },
        { titulo: 'Construção', itens: [
          { rotulo: 'Lista de mobis', cmd: 'mobis', desc: 'Todos os mobis do chão do quarto.' },
          { rotulo: 'Wireds do quarto', cmd: 'wireds', desc: 'Lista e abre os wireds.' },
          { rotulo: 'Marcar área', cmd: 'area', desc: 'Entre os 2 últimos mobis clicados.' },
          { rotulo: 'Limpar repetidos', cmd: 'limparrepetidos', desc: 'Recolhe mobis iguais no mesmo piso.' },
          { rotulo: 'Copiar quarto', cmd: 'copiarquarto', desc: 'Guarda a posição de todos os mobis.' },
        ] },
        { titulo: 'Avisos', itens: [
          { rotulo: 'Avisos do jogo', cmd: 'notificacoes', desc: 'Os avisos do canto desde que o hotel abriu.' },
        ] },
      ];
      ctx.aba({
        id: 'quarto',
        titulo: 'Quarto',
        ordem: 5,
        montar(alvo) {
          function desenhar() {
            const grupos = BOTOES_QUARTO.map(function (g) {
              const botoes = g.itens.filter((i) => nucleo.comandos.achar(i.cmd)).map(function (i) {
                const args = i.args || [];
                const ligado = i.estado ? i.estado() : null;
                return el('button', {
                  type: 'button', class: 'vl-acao' + (ligado ? ' ligada' : ''),
                  title: prefixo() + i.cmd + (args.length ? ' ' + args.join(' ') : ''),
                  onclick() { const c = nucleo.comandos.achar(i.cmd); if (c) c.executar({ nome: i.cmd, args, resto: args.join(' ') }); },
                }, [
                  el('span', { class: 'vl-acao-topo' }, [el('strong', { texto: i.rotulo }), ligado == null ? null : el('span', { class: 'vl-acao-estado', texto: ligado ? 'ligado' : 'desligado' })]),
                  el('span', { class: 'vl-acao-desc', texto: i.desc }),
                ]);
              });
              return botoes.length ? [el('h3', { class: 'vl-acoes-titulo', texto: g.titulo }), el('div', { class: 'vl-acoes' }, botoes)] : [];
            }).flat();
            alvo.replaceChildren(
              el('p', { class: 'vl-nota', texto: 'Atalhos do dia a dia. Passe o mouse num cartão para ver o comando equivalente.' }),
              ...(grupos.length ? grupos : [el('p', { texto: 'Ligue os módulos Conexão e Construção para ver os botões.' })])
            );
          }
          desenhar();
          const parar = nucleo.ouvir('modulo', desenhar);
          const parar2 = nucleo.ouvir('config', desenhar);
          return function () { parar(); parar2(); };
        },
      });

      ctx.aba({
        id: 'comandos',
        titulo: 'Comandos',
        ordem: 20,
        montar(alvo) {
          function desenhar() {
            const p = prefixo();
            alvo.replaceChildren(
              el('p', { class: 'vl-nota', texto: 'Digite no chat do jogo e aperte Enter. O comando não é enviado como fala.' }),
              el('ul', { class: 'vl-lista' }, nucleo.comandos.listar().map((c) => el('li', { class: 'vl-item' }, [
                el('code', { class: 'vl-codigo', texto: p + (c.uso || c.nome) }),
                el('div', { texto: c.descricao || '' }),
                c.apelidos && c.apelidos.length
                  ? el('div', { class: 'vl-nota', texto: 'Também: ' + c.apelidos.map((a) => p + a).join(', ') })
                  : null,
                c.alvoX ? el('div', { class: 'vl-nota', texto: 'Use x no lugar do apelido para a última pessoa em que você clicou.' }) : null,
              ])))
            );
          }
          desenhar();
          const parar1 = nucleo.ouvir('config', desenhar);
          const parar2 = nucleo.ouvir('modulo', desenhar);
          return function () {
            parar1();
            parar2();
          };
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
