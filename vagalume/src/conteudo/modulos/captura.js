// Vagalume — módulo "captura": salva ou copia uma imagem da aba do hotel.
// A imagem é feita pelo navegador (service worker ou popup) e fica no computador de quem usa.
// O navegador só libera a captura depois de um gesto na extensão: o atalho ou o clique no ícone.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada) return;
  const { nucleo, camada } = VL;
  const el = camada.el;

  const FALHA = 'Não foi possível capturar a tela. Aguarde um instante e tente de novo.';
  const MENSAGENS = {
    'aba-inativa': 'A aba do hotel precisa estar à vista para ser capturada.',
    'fora-do-hotel': 'A captura só funciona na aba do hotel.',
    limite: 'O navegador permite até duas capturas por segundo. Aguarde um instante e tente de novo.',
  };

  // O Chrome só libera a captura depois de um gesto na extensão (o atalho dela ou o clique no ícone).
  // Se a combinação sugerida já é de outro programa, o Chrome não dá atalho nenhum ao Vagalume.
  function textoDaPermissao(atalho, comando) {
    if (atalho) return 'O navegador só libera a captura depois de um gesto na extensão. Aperte ' + atalho + ' ou clique no ícone do Vagalume na barra do Chrome uma vez; depois disso, ' + comando + ' e os botões funcionam até recarregar a página.';
    return 'A captura está sem atalho: no seu Chrome, o Alt+Shift+P já é usado por outro programa (por isso ele faz outra coisa). Escolha outra combinação em chrome://extensions/shortcuts, em Vagalume, "Capturar a tela". Enquanto isso, clique uma vez no ícone do Vagalume na barra do Chrome: aí ' + comando + ' e os botões funcionam até recarregar a página.';
  }

  // Converte o "data:image/png;base64,..." devolvido pelo navegador sem passar por fetch.
  function paraBlob(dataUrl) {
    const bruto = String(dataUrl || '');
    const virgula = bruto.indexOf(',');
    if (virgula < 0 || !/^data:image\/png;base64$/i.test(bruto.slice(0, virgula))) return null;
    try {
      const binario = atob(bruto.slice(virgula + 1));
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
      return new Blob([bytes], { type: 'image/png' });
    } catch (erro) {
      return null;
    }
  }

  nucleo.definirModulo({
    id: 'captura',
    iniciar(ctx) {
      let ocupado = false;

      function prefixo() {
        return VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo);
      }

      // Sem permissão: uma caixa oferece liberar a captura de vez (o Chrome pergunta uma vez).
      function oferecerLiberar(atalho) {
        camada.dialogo({
          titulo: 'Liberar a captura',
          texto: 'O Chrome só deixa o Vagalume tirar print depois de um gesto nele' + (atalho ? ' (o atalho ' + atalho + ' ou um clique no ícone dela)' : ' (um clique no ícone dela; o atalho Alt+Shift+P está com outro programa no seu Chrome)') + '. Para tirar print sempre com um clique, permita uma vez. O Chrome vai avisar "todos os sites", porque não há permissão só de captura; o Vagalume usa só para fotografar a aba do hotel.',
          botoes: [
            { rotulo: 'Agora não', valor: null },
            { rotulo: 'Permitir uma vez', valor: 'permitir', destaque: true, foco: true },
          ],
        }).then(function (v) {
          if (v !== 'permitir') return;
          try {
            chrome.runtime.sendMessage({ tipo: 'captura:permitir' }).then(function () {
              camada.aviso('Responda na janelinha do Vagalume que abriu. Depois, é só tirar o print de novo.');
            }, function () { camada.aviso(textoDaPermissao(atalho, prefixo() + 'captura'), { tipo: 'erro', duracaoMs: 12000 }); });
          } catch (erro) { camada.aviso(textoDaPermissao(atalho, prefixo() + 'captura'), { tipo: 'erro', duracaoMs: 12000 }); }
        });
      }

      // modo: 'salvar', 'copiar' ou 'editar'. Devolve true quando a imagem foi guardada de algum jeito.
      async function capturar(modo) {
        if (ocupado) return false;
        ocupado = true;
        try {
          let resposta = null;
          try {
            // A camada do Vagalume some durante a captura para não aparecer na imagem.
            resposta = await camada.ocultarDurante(function () {
              return chrome.runtime.sendMessage({ tipo: 'capturar' });
            });
          } catch (erro) {
            resposta = null;
          }
          const blob = resposta && resposta.ok ? paraBlob(resposta.dataUrl) : null;
          if (!blob) {
            const motivo = resposta && typeof resposta.erro === 'string' ? resposta.erro : '';
            const conhecido = Object.prototype.hasOwnProperty.call(MENSAGENS, motivo);
            if (motivo === 'permissao') {
              oferecerLiberar(resposta.atalho);
              return false;
            }
            const texto = conhecido ? MENSAGENS[motivo] : FALHA;
            camada.aviso(texto, {
              tipo: 'erro',
              duracaoMs: motivo === 'permissao' ? 12000 : undefined,
            });
            return false;
          }
          const nome = 'vagalume-' + camada.carimbo(true) + '.png';
          if (modo === 'editar') {
            let aberto = null;
            try {
              aberto = await chrome.runtime.sendMessage({ tipo: 'captura:editar', dataUrl: resposta.dataUrl });
            } catch (erro) {
              aberto = null;
            }
            if (aberto && aberto.ok) {
              camada.aviso('O editor abriu em uma nova aba.', { tipo: 'ok' });
              return true;
            }
            // Sem editor, a imagem não se perde: vai para os downloads.
            camada.baixar(nome, blob);
            camada.aviso((aberto && aberto.erro === 'grande'
              ? 'A imagem é grande demais para o editor'
              : 'Não foi possível abrir o editor') + '; ela foi salva em ' + nome + '.', { tipo: 'erro' });
            return true;
          }
          if (modo === 'copiar') {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              camada.aviso('Imagem copiada.', { tipo: 'ok' });
              return true;
            } catch (erro) {
              camada.baixar(nome, blob);
              camada.aviso('Não foi possível copiar; a imagem foi salva em ' + nome + '.');
              return true;
            }
          }
          camada.baixar(nome, blob);
          camada.aviso('Imagem salva em ' + nome + '.', { tipo: 'ok' });
          return true;
        } finally {
          ocupado = false;
        }
      }

      // Pedidos vindos do service worker (atalho de teclado) e do popup (que captura por conta própria).
      function aoMensagem(mensagem, remetente, responder) {
        if (!remetente || remetente.id !== chrome.runtime.id || !mensagem || typeof mensagem.tipo !== 'string') return undefined;
        if (mensagem.tipo === 'captura:atalho') {
          capturar('salvar').then(
            function (ok) { responder({ ok }); },
            function () { responder({ ok: false }); }
          );
          return true; // a resposta vem depois
        }
        if (mensagem.tipo === 'captura:ocultar') {
          camada.ocultar(1500);
          camada.quadros().then(function () { responder({ ok: true }); });
          return true;
        }
        if (mensagem.tipo === 'captura:mostrar') {
          camada.mostrar();
          responder({ ok: true });
        }
        return undefined;
      }

      chrome.runtime.onMessage.addListener(aoMensagem);
      ctx.aoParar(function () {
        try {
          chrome.runtime.onMessage.removeListener(aoMensagem);
        } catch (erro) {
          // o contexto da extensão já foi encerrado
        }
      });

      ctx.comando({
        nome: 'captura',
        apelidos: ['foto'],
        uso: 'captura [copiar | editar]',
        descricao: 'Salva uma imagem da aba do hotel; com "copiar", manda para a área de transferência; com "editar", abre o editor para recortar.',
        executar(pedido) {
          const modo = String((pedido.args || [])[0] || 'salvar').toLowerCase();
          if (modo !== 'salvar' && modo !== 'copiar' && modo !== 'editar') {
            camada.aviso('Opção desconhecida. Use ' + prefixo() + 'captura, ' + prefixo() + 'captura copiar ou ' + prefixo() + 'captura editar.', { tipo: 'erro' });
            return undefined;
          }
          return capturar(modo);
        },
      });

      ctx.aba({
        id: 'captura',
        titulo: 'Captura',
        ordem: 40,
        montar(alvo) {
          const notaAtalho = el('p', { class: 'vl-nota', texto: 'Conferindo o atalho da captura…' });
          try {
            chrome.runtime.sendMessage({ tipo: 'captura:qual-atalho' }).then(function (r) {
              if (notaAtalho.isConnected) notaAtalho.textContent = (r && r.atalho ? 'Atalho: ' + r.atalho + ' (dá para trocar em chrome://extensions/shortcuts). ' : '') + textoDaPermissao(r && r.atalho, prefixo() + 'captura');
            }, function () { notaAtalho.textContent = textoDaPermissao('', prefixo() + 'captura'); });
          } catch (erro) { notaAtalho.textContent = textoDaPermissao('', prefixo() + 'captura'); }
          alvo.replaceChildren(
            el('p', { class: 'vl-nota', texto: 'Guarde uma imagem do que está à vista na aba do hotel. O painel e os avisos do Vagalume ficam de fora.' }),
            el('div', { class: 'vl-linha' }, [
              el('button', { type: 'button', class: 'vl-botao primario', texto: 'Salvar imagem', onclick() { capturar('salvar'); } }),
              el('button', { type: 'button', class: 'vl-botao', texto: 'Copiar imagem', onclick() { capturar('copiar'); } }),
              el('button', { type: 'button', class: 'vl-botao', texto: 'Editar imagem', onclick() { capturar('editar'); } }),
            ]),
            notaAtalho,
            el('p', { class: 'vl-nota', texto: 'A imagem fica no seu computador; nada é enviado a servidor algum.' })
          );
          return undefined;
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
