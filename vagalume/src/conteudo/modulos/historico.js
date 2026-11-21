// Histórico do chat do quarto, guardado localmente no perfil do navegador.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.historico || !VL.texto) return;
  const { nucleo, camada, jogo, texto } = VL;
  const el = camada.el;

  async function pedir(acao, dados) {
    const r = await chrome.runtime.sendMessage({ tipo: 'historico:local', acao, ...dados });
    if (!r?.ok) throw new Error('Histórico indisponível');
    return r.dados;
  }

  nucleo.definirModulo({
    id: 'historico',
    iniciar(ctx) {
      let aoMudar = null;
      let falhou = false;
      let exportando = false;
      ctx.aoParar(jogo.observarFalas(({ autor, texto, quando }) => {
        pedir('adicionar', { fala: { autor, texto, quando } }).then(() => {
          falhou = false;
          aoMudar?.();
        }).catch(() => {
          if (!falhou) camada.aviso('Não consegui guardar as falas no histórico local.', { tipo: 'erro' });
          falhou = true;
        });
      }));
      ctx.aoConfig((secao) => { if (secao === 'historico') aoMudar?.(true); });

      async function exportar(formato) {
        if (exportando) return;
        exportando = true;
        try {
          const json = formato === 'json';
          const lotes = [];
          let antes = null;
          do {
            const r = await pedir('pagina', { antes, limite: 1000 });
            if (r.itens.length) {
              const itens = r.itens.reverse();
              lotes.push(json ? VL.historico.paraJson(itens).slice(1, -1).trim() : VL.historico.paraTexto(itens));
            }
            antes = r.proxima;
          } while (antes !== null);
          if (!lotes.length) { camada.aviso('O histórico está vazio.'); return; }
          const partes = [];
          if (json) partes.push('[\n');
          for (const lote of lotes.reverse()) {
            if (partes.length > (json ? 1 : 0)) partes.push(json ? ',\n' : '\n');
            partes.push(lote);
          }
          if (json) partes.push('\n]');
          const blob = new Blob(partes, { type: json ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' });
          const nome = 'vagalume-historico-' + camada.carimbo() + '.' + formato;
          camada.baixar(nome, blob);
          camada.aviso('Histórico salvo em ' + nome + '.', { tipo: 'ok' });
        } catch (e) { camada.aviso('Não consegui exportar o histórico.', { tipo: 'erro' }); }
        finally { exportando = false; }
      }

      async function limpar() {
        try {
          const { total } = await pedir('pagina', { limite: 1 });
          if (!total) { camada.aviso('O histórico já está vazio.'); return; }
          const sim = await camada.confirmar('Apagar todas as falas guardadas neste navegador?', { titulo: 'Limpar o histórico', sim: 'Apagar' });
          if (!sim) return;
          await pedir('limpar');
          aoMudar?.(true);
          camada.aviso('Histórico apagado.', { tipo: 'ok' });
        } catch (e) { camada.aviso('Não consegui limpar o histórico.', { tipo: 'erro' }); }
      }

      ctx.comando({ nome: 'historico', uso: 'historico', descricao: 'Abre o histórico do chat no painel.', executar() {
        if (ctx.ativo('painel')) ctx.emitir('painel:abrir', { aba: 'historico' });
        else camada.aviso('Ligue o painel para ler o histórico ou use o comando exportar.');
      } });
      ctx.comando({ nome: 'exportar', uso: 'exportar [txt|json]', descricao: 'Salva o histórico do chat em um arquivo.', executar(pedido) {
        const formato = String((pedido.args || [])[0] || 'txt').toLowerCase();
        if (formato === 'txt' || formato === 'json') exportar(formato);
        else camada.aviso('Formato desconhecido. Use txt ou json.', { tipo: 'erro' });
      } });
      ctx.comando({ nome: 'limpar', uso: 'limpar', descricao: 'Apaga o histórico do chat guardado neste navegador.', executar: limpar });

      ctx.aba({
        id: 'historico', titulo: 'Histórico', ordem: 10,
        montar(alvo) {
          let relogio = 0;
          let geracao = 0;
          let carregando = false;
          let novas = false;
          let cursores = [null];
          let proxima = null;
          const contagem = el('p', { class: 'vl-nota', 'aria-live': 'polite' });
          const resultado = el('div');
          const campoBusca = el('input', { type: 'search', class: 'vl-campo', placeholder: 'Buscar nas falas', 'aria-label': 'Buscar nas falas', oninput: recomeçar });
          const campoAutor = el('input', { type: 'text', class: 'vl-campo', placeholder: 'Nome exato', 'aria-label': 'Filtrar pelo nome do jogador', oninput: recomeçar });
          const recentes = el('button', { type: 'button', class: 'vl-botao', texto: 'Mais recentes', onclick() { cursores.pop(); desenhar(); } });
          const antigas = el('button', { type: 'button', class: 'vl-botao', texto: 'Mais antigas', onclick() { if (proxima !== null) { cursores.push(proxima); desenhar(); } } });

          function recomeçar() {
            geracao++;
            cursores = [null];
            recentes.disabled = antigas.disabled = true;
            clearTimeout(relogio);
            relogio = setTimeout(desenhar, 150);
          }
          function agendar(reset) {
            if (reset) { recomeçar(); return; }
            if (cursores.length > 1) return;
            if (carregando) { novas = true; return; }
            if (!relogio) relogio = setTimeout(desenhar, 500);
          }
          async function desenhar() {
            clearTimeout(relogio);
            relogio = 0;
            carregando = true;
            const vez = ++geracao;
            const busca = campoBusca.value.trim();
            const autor = campoAutor.value.trim();
            recentes.disabled = antigas.disabled = true;
            try {
              const r = await pedir('pagina', { antes: cursores.at(-1), limite: ctx.secao().limite, busca, autor });
              if (vez !== geracao) return;
              proxima = r.proxima;
              recentes.disabled = cursores.length < 2;
              antigas.disabled = proxima === null;
              contagem.textContent = 'Guardadas neste navegador: ' + r.total + ' · Página ' + cursores.length;
              resultado.replaceChildren(r.itens.length ? el('ul', { class: 'vl-lista' }, r.itens.map((f) => el('li', { class: 'vl-item' }, [
                el('time', { class: 'vl-hora', title: new Date(f.quando).toLocaleString('pt-BR'), texto: new Date(f.quando).toLocaleDateString('pt-BR') + ' ' + texto.hora(f.quando) }), ' ',
                el('span', { class: 'vl-autor', texto: f.autor || '?' }), ' ' + f.texto,
              ]))) : el('p', { class: 'vl-vazio', texto: busca || autor ? 'Nenhuma fala combina com a busca.' : 'Nenhuma fala nesta página.' }));
            } catch (e) {
              if (vez === geracao) {
                contagem.textContent = 'Não consegui abrir o histórico local.';
                resultado.replaceChildren(el('button', { type: 'button', class: 'vl-botao', texto: 'Tentar novamente', onclick: desenhar }));
              }
            } finally {
              if (vez === geracao) { carregando = false; if (novas) { novas = false; agendar(); } }
            }
          }

          alvo.replaceChildren(
            el('div', { class: 'vl-linha' }, [campoBusca, campoAutor]),
            el('div', { class: 'vl-linha' }, [
              el('button', { type: 'button', class: 'vl-botao', texto: 'Salvar .txt', onclick() { exportar('txt'); } }),
              el('button', { type: 'button', class: 'vl-botao', texto: 'Salvar .json', onclick() { exportar('json'); } }),
              el('button', { type: 'button', class: 'vl-botao discreto', texto: 'Limpar', onclick: limpar }),
            ]),
            contagem, el('div', { class: 'vl-linha' }, [recentes, antigas]), resultado
          );
          aoMudar = agendar;
          desenhar();
          return () => { aoMudar = null; geracao++; clearTimeout(relogio); };
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
