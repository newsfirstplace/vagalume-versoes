// Vagalume — módulo "macros": sequências de falas disparadas por atalho, por comando ou pelo painel.
// Uma macro roda uma vez por acionamento, uma de cada vez, e nunca se repete sozinha.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.atalhos || !VL.texto) return;
  const { nucleo, camada, jogo, atalhos, texto } = VL;
  const el = camada.el;

  function chaveDe(s) {
    return texto.semAcento(String(s || '')).trim().toLowerCase();
  }

  nucleo.definirModulo({
    id: 'macros',
    iniciar(ctx) {
      let emCurso = null; // { macro, indice, relogio }

      ctx.aoConfig(function () {}); // a lista é lida a cada uso; não é preciso reiniciar

      function lista() {
        return ctx.secao().lista || [];
      }

      function prefixo() {
        return VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo);
      }

      function achar(chave) {
        const alvo = chaveDe(chave);
        if (!alvo) return null;
        const todas = lista();
        return todas.find((m) => String(m.id).toLowerCase() === alvo) ||
          todas.find((m) => chaveDe(m.nome) === alvo) || null;
      }

      function avisarEstado() {
        ctx.emitir('macros:estado', { emCurso: emCurso ? emCurso.macro.id : null });
      }

      function parar(silencioso) {
        if (!emCurso) return false;
        clearTimeout(emCurso.relogio);
        emCurso = null;
        avisarEstado();
        if (!silencioso) camada.aviso('Macro interrompida.');
        return true;
      }

      function executar(macro) {
        if (emCurso) {
          camada.aviso('Já há uma macro em andamento. Use ' + prefixo() + 'parar.', { tipo: 'erro' });
          return false;
        }
        const linhas = (macro.linhas || []).filter(Boolean);
        if (!linhas.length) {
          camada.aviso('A macro “' + macro.nome + '” não tem falas.', { tipo: 'erro' });
          return false;
        }
        if (!jogo.entradaChat()) {
          camada.aviso('Não achei o campo de chat. Entre em um quarto e tente de novo.', { tipo: 'erro' });
          return false;
        }
        const intervalo = ctx.secao().intervaloMs;
        const estado = { macro, indice: 0, relogio: 0 };
        emCurso = estado;
        avisarEstado();

        function passo() {
          if (emCurso !== estado) return;
          if (!jogo.enviarFala(linhas[estado.indice])) {
            emCurso = null;
            avisarEstado();
            camada.aviso('A macro parou: o campo de chat sumiu.', { tipo: 'erro' });
            return;
          }
          estado.indice += 1;
          if (estado.indice >= linhas.length) {
            emCurso = null;
            avisarEstado();
            return;
          }
          estado.relogio = setTimeout(passo, intervalo);
        }
        passo();
        return true;
      }

      ctx.escutar(window, 'keydown', function (ev) {
        if (!ev.isTrusted || ev.repeat || ev.isComposing) return;
        const combo = atalhos.deEvento(ev);
        if (!combo) return;
        const macro = lista().find((m) => m.atalho && m.atalho === combo);
        if (!macro) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        executar(macro);
      }, true);

      ctx.comando({
        nome: 'macro',
        uso: 'macro <nome>',
        descricao: 'Executa uma macro pelo nome ou pelo código.',
        executar(pedido) {
          const chave = String(pedido.resto || (pedido.args || []).join(' ')).trim();
          if (!chave) {
            camada.aviso('Informe a macro. Exemplo: ' + prefixo() + 'macro m1', { tipo: 'erro' });
            return;
          }
          const macro = achar(chave);
          if (!macro) {
            camada.aviso('Não há macro chamada “' + chave + '”.', { tipo: 'erro' });
            return;
          }
          executar(macro);
        },
      });

      ctx.comando({
        nome: 'macros',
        uso: 'macros',
        descricao: 'Mostra as macros cadastradas.',
        executar() {
          if (ctx.ativo('painel')) {
            ctx.emitir('painel:abrir', { aba: 'macros' });
            return;
          }
          const todas = lista();
          camada.aviso(todas.length
            ? todas.map((m) => m.id + ' — ' + m.nome + (m.atalho ? ' (' + m.atalho + ')' : '')).join('\n')
            : 'Nenhuma macro ainda. Crie na aba Macros do painel (Alt+V).', { duracaoMs: 10000 });
        },
      });

      ctx.comando({
        nome: 'parar',
        uso: 'parar',
        descricao: 'Interrompe a macro em andamento.',
        executar() {
          if (!parar(false)) camada.aviso('Nenhuma macro em andamento.');
        },
      });

      ctx.aoParar(function () { parar(true); });

      // Editor no próprio painel (pedido do usuário em 2026-11-15: nada na página externa).
      function gravarLista(nova) {
        const limpa = VL.config.limparMacros(nova);
        return ctx.alterar('macros', { lista: limpa });
      }
      function editar(original) {
        const m = original || { id: '', nome: '', atalho: '', linhas: [] };
        const nome = el('input', { type: 'text', class: 'vl-campo', maxlength: 60, placeholder: 'Ex.: Boas-vindas', 'aria-label': 'Nome da macro' });
        nome.value = m.nome || '';
        const falas = el('textarea', { class: 'vl-campo vl-falas', rows: 6, placeholder: 'Uma fala por linha (até 20).\nPode usar comandos do Habblet, como :sit', 'aria-label': 'Falas da macro' });
        falas.value = (m.linhas || []).join('\n');
        const atalho = el('input', { type: 'text', class: 'vl-campo', readonly: true, placeholder: 'Clique e aperte as teclas (ex.: Alt+1)', 'aria-label': 'Atalho da macro' });
        atalho.value = m.atalho || '';
        const avisoAtalho = el('span', { class: 'vl-nota' });
        atalho.addEventListener('keydown', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.key === 'Backspace' || ev.key === 'Delete') { atalho.value = ''; avisoAtalho.textContent = 'Sem atalho.'; return; }
          const combo = atalhos.deEvento(ev);
          if (!combo) return;
          const v = atalhos.validar(combo);
          if (v.ok) { atalho.value = v.combo; avisoAtalho.textContent = ''; } else avisoAtalho.textContent = v.motivo;
        });
        for (const campo of [nome, falas]) campo.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
        const conteudo = el('div', { class: 'vl-form' }, [
          el('label', { class: 'vl-form-campo' }, [el('span', { texto: 'Nome' }), nome]),
          el('label', { class: 'vl-form-campo' }, [el('span', { texto: 'Falas, uma por linha' }), falas]),
          el('label', { class: 'vl-form-campo' }, [el('span', { texto: 'Atalho (opcional)' }), atalho, avisoAtalho]),
        ]);
        setTimeout(function () { nome.focus(); }, 30);
        return camada.dialogo({
          titulo: original ? 'Editar macro' : 'Nova macro',
          conteudo,
          largo: true,
          botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Gravar', valor: 'gravar', destaque: true }],
        }).then(function (r) {
          if (r !== 'gravar') return;
          const linhas = falas.value.split('\n').map((l) => l.trim()).filter(Boolean);
          if (!nome.value.trim() || !linhas.length) { camada.aviso('Dê um nome e escreva pelo menos uma fala.', { tipo: 'erro' }); return; }
          const atual = lista().slice();
          const nova = { id: m.id || ('m' + Date.now().toString(36)).slice(0, 24), nome: nome.value.trim(), atalho: atalho.value, linhas };
          const i = atual.findIndex((x) => x.id === m.id && m.id);
          if (i >= 0) atual[i] = nova; else atual.push(nova);
          if (atual.length > 30) { camada.aviso('Até 30 macros.', { tipo: 'erro' }); return; }
          return gravarLista(atual).then(function () { camada.aviso('Macro gravada.', { tipo: 'ok' }); });
        });
      }
      function apagar(m) {
        return camada.confirmar('Apagar a macro "' + m.nome + '"?', { titulo: 'Apagar macro', sim: 'Apagar' }).then(function (ok) {
          if (ok) return gravarLista(lista().filter((x) => x.id !== m.id));
        });
      }

      ctx.aba({
        id: 'macros',
        titulo: 'Macros',
        ordem: 30,
        montar(alvo) {
          function desenhar() {
            const todas = lista();
            const nos = [el('div', { class: 'vl-linha' }, [
              el('button', { type: 'button', class: 'vl-botao destaque', 'data-foco': 'nova', texto: '+ Nova macro', onclick() { editar(null); } }),
            ])];
            if (!todas.length) {
              nos.push(el('p', { class: 'vl-vazio', texto: 'Nenhuma macro ainda. Uma macro manda várias falas em sequência, com um clique, um atalho ou o comando macro.' }));
            } else {
              nos.push(el('ul', { class: 'vl-lista' }, todas.map((m) => {
                const falas = (m.linhas || []).length;
                return el('li', { class: 'vl-item linha' }, [
                  el('span', { class: 'vl-cresce' }, [
                    el('strong', { texto: m.nome }),
                    el('span', { class: 'vl-nota', style: 'display: block;', texto: (m.atalho || 'sem atalho') + ' · ' + falas + (falas === 1 ? ' fala' : ' falas') + ' · ' + prefixo() + 'macro ' + m.id }),
                  ]),
                  el('button', {
                    type: 'button',
                    class: 'vl-botao',
                    'data-foco': 'executar-' + m.id,
                    'aria-label': 'Executar a macro ' + m.nome,
                    texto: 'Executar',
                    disabled: !!emCurso,
                    onclick() { executar(m); },
                  }),
                  el('button', { type: 'button', class: 'vl-botao discreto', 'aria-label': 'Editar a macro ' + m.nome, texto: 'Editar', onclick() { editar(m); } }),
                  el('button', { type: 'button', class: 'vl-botao discreto', 'aria-label': 'Apagar a macro ' + m.nome, texto: 'Apagar', onclick() { apagar(m); } }),
                ]);
              })));
            }
            nos.push(el('div', { class: 'vl-linha' }, [
              el('button', { type: 'button', class: 'vl-botao', 'data-foco': 'parar', texto: 'Parar', disabled: !emCurso, onclick() { parar(false); } }),
              el('span', { class: 'vl-nota', texto: emCurso ? 'Enviando: ' + emCurso.macro.nome + '…' : '' }),
            ]));
            nos.push(el('p', { class: 'vl-nota', texto: 'As falas saem com ' + ctx.secao().intervaloMs + ' ms de intervalo. Cada acionamento roda a macro uma vez; ela nunca se repete sozinha.' }));
            camada.trocar(alvo, nos);
          }
          desenhar();
          const parar1 = nucleo.ouvir('config', desenhar);
          const parar2 = nucleo.ouvir('macros:estado', desenhar);
          return function () {
            parar1();
            parar2();
          };
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
