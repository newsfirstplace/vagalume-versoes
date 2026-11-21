// Vagalume — módulo "silenciar": esconde ou apaga as falas de quem você escolher.
// Vale só na sua tela: ninguém é avisado e nada muda no jogo. Ao desligar, as falas voltam.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo) return;
  const { nucleo, camada, jogo } = VL;
  const MARCA = 'data-vl-silenciado';
  const CSS = {
    esconder: '[' + MARCA + '] { display: none !important; }',
    esmaecer: '[' + MARCA + '] { opacity: .25 !important; filter: grayscale(1) !important; }',
  };

  function chave(apelido) {
    return String(apelido || '').trim().toLowerCase();
  }

  nucleo.definirModulo({
    id: 'silenciar',
    iniciar(ctx) {
      let nomes = new Set();
      let termos = [];
      let removerEstilo = null;

      function lerLista() {
        nomes = new Set(ctx.secao().apelidos.map(chave));
        termos = (ctx.secao().termos || []).map(chave).filter(Boolean);
      }

      function aplicarEstilo() {
        if (removerEstilo) removerEstilo();
        removerEstilo = camada.estiloPagina('silenciar', CSS[ctx.secao().modo] || CSS.esconder);
      }

      // Esconder balões por tipo (pessoas, bots, pets), com exceção dos meus e dos de amigos.
      // Sem a Conexão do jogo, não dá para saber o tipo: todos contam como pessoas.
      function ocultaPorTipo(nome, autor) {
        const s = ctx.secao();
        if (!s.ocultarPessoas && !s.ocultarBots && !s.ocultarPets) return false;
        const eu = VL.pessoas && VL.pessoas.eu();
        if (eu && chave(eu) === autor) return !s.excetoMeus && !!s.ocultarPessoas;
        if (s.excetoAmigos && VL.amigos && VL.amigos.eAmigo(nome)) return false;
        const tipo = VL.pessoas ? VL.pessoas.tipoDe(nome) : null;
        if (tipo === 2) return !!s.ocultarPets;
        if (tipo === 3 || tipo === 4) return !!s.ocultarBots;
        return !!s.ocultarPessoas;
      }

      // Apelido na lista, ou um dos termos no apelido ou no texto da fala.
      function silenciada(fala) {
        if (!fala) return false;
        const autor = chave(fala.autor);
        if (nomes.has(autor)) return true;
        if (ocultaPorTipo(fala.autor, autor)) return true;
        const minimo = ctx.secao().minimoPontos || 0;
        if (minimo > 0 && VL.pessoas) { const p = VL.pessoas.pontosDe(fala.autor); if (p != null && p < minimo) return true; }
        if (!termos.length) return false;
        const texto = chave(fala.texto);
        return termos.some((t) => autor.includes(t) || texto.includes(t));
      }

      function marcar(balao) {
        const fala = jogo.lerFala(balao);
        if (silenciada(fala)) balao.setAttribute(MARCA, '');
        else balao.removeAttribute(MARCA);
      }

      // Também vale para as falas que já estavam na tela.
      function remarcar() {
        document.querySelectorAll(jogo.seletor('balao')).forEach(function (no) {
          marcar(jogo.balaoDe(no) || no);
        });
      }

      function desmarcar() {
        document.querySelectorAll('[' + MARCA + ']').forEach(function (no) { no.removeAttribute(MARCA); });
      }

      function gravarLista(lista) {
        return ctx.alterar('silenciar', { apelidos: lista });
      }

      lerLista();
      aplicarEstilo();
      remarcar();
      ctx.aoParar(jogo.observarFalas(function (fala) {
        if (fala.el && silenciada(fala)) fala.el.setAttribute(MARCA, '');
      }));
      ctx.aoParar(function () {
        if (removerEstilo) removerEstilo();
        removerEstilo = null;
        desmarcar();
      });
      ctx.aoConfig(function (secao) {
        if (secao !== 'silenciar') return;
        lerLista();
        aplicarEstilo();
        remarcar();
      });

      ctx.comando({
        nome: 'silenciar',
        alvoX: true,
        uso: 'silenciar <apelido>',
        descricao: 'Esconde as falas dessa pessoa, só na sua tela.',
        executar(pedido) {
          const apelido = pedido.resto.trim().replace(/^@+/, '').trim();
          if (!apelido) {
            camada.aviso('Diga quem silenciar. Exemplo: silenciar Fulano', { tipo: 'erro' });
            return undefined;
          }
          if (nomes.has(chave(apelido))) {
            camada.aviso(apelido + ' já está silenciado.');
            return undefined;
          }
          const lista = ctx.secao().apelidos.concat(apelido);
          if (lista.length > VL.config.LIMITES.silenciados) {
            camada.aviso('A lista já tem o máximo de ' + VL.config.LIMITES.silenciados + ' apelidos.', { tipo: 'erro' });
            return undefined;
          }
          return gravarLista(lista).then(function () {
            camada.aviso(apelido + ' foi silenciado. Para desfazer: ' + VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo) + 'liberar ' + apelido, { tipo: 'ok' });
          });
        },
      });

      ctx.comando({
        nome: 'liberar',
        alvoX: true,
        apelidos: ['dessilenciar'],
        uso: 'liberar <apelido>',
        descricao: 'Volta a mostrar as falas de quem estava silenciado.',
        executar(pedido) {
          const alvo = chave(String(pedido.resto).trim().replace(/^@+/, ''));
          const lista = ctx.secao().apelidos;
          const resto = lista.filter((n) => chave(n) !== alvo);
          if (!alvo || resto.length === lista.length) {
            camada.aviso('Esse apelido não está na lista de silenciados.', { tipo: 'erro' });
            return undefined;
          }
          return gravarLista(resto).then(function () {
            camada.aviso(pedido.resto.trim().replace(/^@+/, '') + ' voltou a aparecer no chat.', { tipo: 'ok' });
          });
        },
      });

      // Janela de silenciados (pedido do usuário em 2026-11-15), no jeito da lista de amigos: rosto (se a
      // pessoa estiver no quarto), apelido e o botão Liberar.
      function abrirSilenciados() {
        const el = camada.el;
        const corpo = el('div', { class: 'vl-amigos-lista' });
        function desenhar() {
          const lista = (ctx.secao().apelidos || []).slice().sort((a, b) => String(a).localeCompare(String(b)));
          if (!lista.length) { corpo.replaceChildren(el('p', { class: 'vl-nota', texto: 'Ninguém está silenciado. Para silenciar, use o botão Silenciar no quadro da pessoa ou /silenciar <apelido>.' })); return; }
          corpo.replaceChildren(...lista.map(function (apelido) {
            const foto = el('div', { class: 'vl-amigo-foto', 'data-letra': String(apelido).slice(0, 1).toUpperCase() });
            const v = VL.pessoas && VL.pessoas.visualDe ? VL.pessoas.visualDe(apelido) : null;
            if (v && v.visual) { const img = el('img', { class: 'vl-amigo-cabeca', alt: '' }); img.src = 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(v.visual) + '&headonly=1&direction=2&head_direction=3'; foto.appendChild(img); }
            const liberar = el('button', { type: 'button', class: 'vl-amigo-botao', texto: 'Liberar', title: 'Voltar a mostrar as falas de ' + apelido });
            liberar.addEventListener('click', function () {
              liberar.disabled = true;
              const resto = (ctx.secao().apelidos || []).filter((n) => String(n).toLowerCase() !== String(apelido).toLowerCase());
              ctx.alterar('silenciar', { apelidos: resto }).then(function () { camada.aviso(apelido + ' foi liberado.'); setTimeout(desenhar, 50); });
            });
            return el('div', { class: 'vl-amigo online' }, [foto, el('div', { class: 'vl-amigo-texto' }, [el('div', { class: 'vl-amigo-nome', texto: apelido }), el('div', { class: 'vl-amigo-missao', texto: v ? 'Está neste quarto' : 'As falas ficam escondidas só na sua tela' })]), el('div', { class: 'vl-amigo-botoes' }, [liberar])]);
          }));
        }
        desenhar();
        camada.dialogo({ titulo: 'Silenciados', texto: (ctx.secao().apelidos || []).length + ' pessoa(s) silenciada(s).', conteudo: el('div', { class: 'vl-amigos' }, [corpo]), largo: true });
      }
      ctx.comando({
        nome: 'silenciados',
        uso: 'silenciados',
        descricao: 'Abre a lista de quem você silenciou, com o botão de tirar o silêncio.',
        executar() { abrirSilenciados(); },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
