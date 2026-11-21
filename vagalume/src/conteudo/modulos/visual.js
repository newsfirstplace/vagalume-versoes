// Vagalume — módulo "visual": vestir um visual por código, copiar o visual de alguém do quarto,
// ver e vestir os visuais salvos, e atalhos para efeitos e itens de mão.
// Depende do adaptador de conexão. Conferido ao vivo em 2026-11-13: vestir (2730: gênero, código),
// que o servidor aceitou respondendo 3920 e 2429; visuais salvos (2742 → 3315).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.conexao || !VL.codigos) return;
  const { nucleo, camada, conexao, codigos } = VL;
  const { SAIDA, ENTRADA } = codigos;

  nucleo.definirModulo({
    id: 'visual',
    iniciar(ctx) {
      const noQuarto = new Map(); // apelido em minúsculas -> { nome, visual, genero }
      let esperaVisuais = null;
      let ultimoEfeito = 0;
      let ultimoHanditem = 0;
      let ultimaReaplicacao = { efeitos: 0, itens: 0 };
      const temporizadoresVisual = new Set();

      function agendarVisual(aba, atraso, forcar) {
        const timer = setTimeout(function () {
          temporizadoresVisual.delete(timer);
          const n = aba === 'efeitos' ? ultimoEfeito : ultimoHanditem;
          if (!n || !conexao.disponivel()) return;
          if (!forcar && !ctx.secao()[aba === 'efeitos' ? 'sempreManterEfeito' : 'sempreManterHanditem']) return;
          if (!forcar && Date.now() - ultimaReaplicacao[aba] < 15000) return;
          ultimaReaplicacao[aba] = Date.now();
          mandarComando((aba === 'efeitos' ? ':enable ' : ':handitem ') + n);
        }, atraso);
        temporizadoresVisual.add(timer);
      }

      const cancelar = [
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () {
          noQuarto.clear();
          if (ctx.secao().manterEfeito) agendarVisual('efeitos', 1500, true);
          if (ctx.secao().manterHanditem) agendarVisual('itens', 2700, true);
        }),
        conexao.ouvir('entrada', ENTRADA.EFEITO, function (l) {
          if (!VL.pessoas || !VL.pessoas.meuIndice || l.inteiro() !== VL.pessoas.meuIndice()) return;
          if (l.inteiro() === 0) agendarVisual('efeitos', 1200, false);
        }),
        conexao.ouvir('entrada', ENTRADA.ITEM_MAO, function (l) {
          if (!VL.pessoas || !VL.pessoas.meuIndice || l.inteiro() !== VL.pessoas.meuIndice()) return;
          if (l.inteiro() === 0) agendarVisual('itens', 1200, false);
        }),
        conexao.ouvir('entrada', ENTRADA.USUARIOS, function (l) {
          for (const u of codigos.lerUsuarios(l).lista) {
            if (u.visual) noQuarto.set(u.nome.toLowerCase(), { nome: u.nome, visual: u.visual, genero: u.genero || 'M' });
          }
        }),
        conexao.ouvir('entrada', ENTRADA.VISUAIS, function (l) {
          if (!esperaVisuais) return;
          const fn = esperaVisuais;
          esperaVisuais = null;
          try { fn(codigos.lerVisuais(l)); } catch (erro) { fn(null); }
        }),
      ];
      ctx.aoParar(function () { cancelar.forEach((fn) => fn()); temporizadoresVisual.forEach(clearTimeout); });
      // Os interruptores desta janela salvam a configuração sem reiniciar o módulo e fechar a lista.
      ctx.aoConfig(function () {});

      // Copiar visual "não achava o apelido" (relato do usuário em 2026-11-15): a lista deste módulo só
      // se enche ao entrar no quarto e se perde quando o módulo reinicia. O Conexão guarda também, e
      // atualiza quando a pessoa troca de roupa.
      function acharVisual(nome) {
        const chave = String(nome || '').trim().replace(/^@/, '').toLowerCase();
        if (!chave) return null;
        const doConexao = VL.pessoas && VL.pessoas.visualDe ? VL.pessoas.visualDe(chave) : null;
        return doConexao || noQuarto.get(chave) || null;
      }
      function exigir() {
        if (conexao.disponivel()) return true;
        camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' });
        return false;
      }

      function vestir(codigo, genero, origem) {
        const visual = codigos.visualValido(codigo);
        const g = String(genero || 'M').toUpperCase() === 'F' ? 'F' : 'M';
        if (!visual) { camada.aviso('Código de visual inválido.', { tipo: 'erro' }); return; }
        conexao.enviar(SAIDA.VESTIR, [['s', g], ['s', visual]]).then(function (r) {
          camada.aviso(r.ok ? 'Visual ' + (origem ? 'de ' + origem + ' ' : '') + 'vestido.' : 'Não deu para vestir: ' + r.motivo + '.', { tipo: r.ok ? 'ok' : 'erro' });
        });
      }

      function mandarComando(texto) {
        conexao.enviar(SAIDA.FALAR, [['s', texto], ['i', 0]]);
      }

      ctx.comando({
        nome: 'vestir',
        uso: 'vestir <código> [M|F]',
        descricao: 'Veste o visual pelo código (ex.: hd-180-1.ch-210-66).',
        executar(pedido) { if (exigir()) vestir(pedido.args[0], pedido.args[1]); },
      });

      ctx.comando({
        nome: 'copiarvisual',
        alvoX: true,
        uso: 'copiarvisual <apelido>',
        descricao: 'Veste o visual de alguém (ou de um bot) que está no quarto.',
        executar(pedido) {
          if (!exigir()) return;
          const alvo = acharVisual(pedido.args[0]);
          if (!alvo) { camada.aviso('Não achei o visual de ' + (pedido.args[0] || 'ninguém') + ' neste quarto. Se a pessoa acabou de chegar, espere um instante; se continuar, entre de novo no quarto.', { tipo: 'erro' }); return; }
          vestir(alvo.visual, alvo.genero, alvo.nome);
        },
      });

      ctx.comando({
        nome: 'codigovisual',
        alvoX: true,
        uso: 'codigovisual [apelido]',
        descricao: 'Copia o código do visual de alguém que está no quarto (o seu, se não disser o apelido).',
        executar(pedido) {
          const nome = pedido.args[0] || (VL.pessoas && VL.pessoas.eu()) || '';
          const alvo = acharVisual(nome);
          if (!alvo) { camada.aviso('Não achei o visual de ' + (nome || 'ninguém') + ' neste quarto.', { tipo: 'erro' }); return; }
          camada.copiar(alvo.visual).then(function (ok) {
            camada.aviso(ok ? 'Código do visual de ' + alvo.nome + ' copiado.' : alvo.visual, { tipo: ok ? 'ok' : '' });
          });
        },
      });

      // ---------- gerar visual a partir do estilo da pessoa (pedido do usuário em 2026-11-15) ----------
      // Pede os visuais de "Meu guarda-roupa", cria um novo com core/gerador-visual.js (no estilo da pessoa:
      // peças e cores dela e, com o catálogo do jogo, peças e tons novos parecidos) e mostra a prévia.
      function pedirVisuais() {
        return new Promise(function (resolver) {
          if (esperaVisuais) { resolver(null); return; }
          const fn = function (lista) { resolver(lista); };
          esperaVisuais = fn;
          setTimeout(function () { if (esperaVisuais === fn) { esperaVisuais = null; resolver(null); } }, 5000);
          conexao.enviar(SAIDA.PEDIR_VISUAIS, [['i', 0]]);
        });
      }
      // Prévia instantânea (pedido do usuário em 2026-11-16): o avatar é desenhado pelo próprio motor do
      // jogo, no navegador (script da página src/principal/avatar.js). Se o motor não responder, usa o
      // servidor de imagens do jogo, que leva meio segundo ou mais para cada visual novo.
      let motorDoJogo = null; // null: ainda não se sabe; true: funciona; false: não deu
      function imagemDoServidor(img, visual, genero) {
        // A prévia passa na frente das miniaturas do guarda-roupa: enquanto ela carrega, a fila delas espera.
        previasCarregando++;
        let pronto = false;
        const fim = function () { if (pronto) return; pronto = true; previasCarregando = Math.max(0, previasCarregando - 1); proximaImagem(); };
        img.addEventListener('load', fim, { once: true });
        img.addEventListener('error', fim, { once: true });
        setTimeout(fim, 6000);
        img.src = 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(visual) + '&gender=' + encodeURIComponent(genero) + '&direction=2&head_direction=3&gesture=sml&size=l';
      }
      function imagemDoVisual(visual, genero) {
        const img = el('img', { class: 'vl-visual-gerado', alt: 'Prévia do visual' });
        const g = String(genero || 'M').toUpperCase() === 'F' ? 'F' : 'M';
        if (motorDoJogo === false) { imagemDoServidor(img, visual, g); return img; }
        let doServidor = false;
        const aoImagem = function (ev) {
          let d = null;
          try { d = JSON.parse(String(ev.detail || '')); } catch (e) { return; }
          if (!d || d.figura !== visual || d.genero !== g || !/^data:image\//.test(String(d.url))) return;
          motorDoJogo = true;
          img.classList.add('vl-visual-local');
          img.src = d.url;
        };
        const aoFalha = function () {
          motorDoJogo = false;
          if (!doServidor) { doServidor = true; imagemDoServidor(img, visual, g); }
        };
        document.addEventListener('vl:avatar:imagem', aoImagem);
        document.addEventListener('vl:avatar:falhou', aoFalha, { once: true });
        // O jogo manda primeiro um avatar provisório (enquanto baixa as roupas) e depois o certo.
        setTimeout(function () { document.removeEventListener('vl:avatar:imagem', aoImagem); document.removeEventListener('vl:avatar:falhou', aoFalha); }, 15000);
        // Sem resposta do motor a tempo: o servidor de imagens (a do motor, se chegar depois, ainda entra).
        setTimeout(function () { if (!img.getAttribute('src') && !doServidor) { doServidor = true; imagemDoServidor(img, visual, g); } }, motorDoJogo ? 2500 : 1200);
        document.dispatchEvent(new CustomEvent('vl:avatar:pedir', { detail: JSON.stringify({ figura: visual, genero: g, direcao: 2 }) }));
        return img;
      }
      // estilo: { tema } (chave de VL.geradorVisual.TEMAS) ou { combinar: apelido } ou {} (o seu estilo).
      function opcoesDoEstilo(estilo, catalogo) {
        if (estilo && estilo.combinar) {
          const outro = acharVisual(estilo.combinar);
          if (!outro) { camada.aviso('Não achei o visual de ' + estilo.combinar + ' neste quarto.', { tipo: 'erro' }); return null; }
          return { combinar: { nome: outro.nome, visual: outro.visual } };
        }
        if (estilo && estilo.tema) {
          if (!catalogo) { camada.aviso('Os temas precisam do catálogo de roupas do jogo, que não carregou agora. Tente de novo.', { tipo: 'erro' }); return null; }
          return { tema: estilo.tema };
        }
        return {};
      }
      function controlesDeEstilo(estilo) {
        const temas = VL.geradorVisual.TEMAS;
        const escolha = el('select', { class: 'vl-campo', title: 'Estilo do próximo visual' }, [
          el('option', { value: '', texto: 'Meu estilo' }),
          ...Object.keys(temas).map((k) => el('option', { value: 'tema:' + k, texto: 'Tema: ' + temas[k].nome })),
          el('option', { value: 'combinar', texto: 'Combinar com alguém do quarto…' }),
        ]);
        const quem = el('input', { class: 'vl-campo', type: 'text', placeholder: 'apelido', title: 'Com quem combinar', maxlength: '40' });
        escolha.value = estilo.combinar ? 'combinar' : (estilo.tema ? 'tema:' + estilo.tema : '');
        quem.value = estilo.combinar || '';
        quem.hidden = escolha.value !== 'combinar';
        escolha.addEventListener('change', function () { quem.hidden = escolha.value !== 'combinar'; if (!quem.hidden) quem.focus(); });
        const ler = function () {
          if (escolha.value === 'combinar') return quem.value.trim() ? { combinar: quem.value.trim().replace(/^@/, '') } : {};
          if (escolha.value.indexOf('tema:') === 0) return { tema: escolha.value.slice(5) };
          return {};
        };
        return { el: el('div', { class: 'vl-linha vl-visual-estilo' }, [escolha, quem]), ler };
      }
      function mostrarGerado(lista, genero, catalogo, estilo) {
        estilo = estilo || {};
        const extra = opcoesDoEstilo(estilo, catalogo);
        if (!extra) return;
        // Peças evitadas (pedido do usuário em 2026-11-20): { tipo: [ids] }, ficam em todos os gerados.
        const evitados = {};
        for (const [t, ids] of Object.entries(estilo.evitados || {})) if (ids && ids.length) evitados[t] = ids.slice();
        const coresEvitadas = {};
        for (const [t, ids] of Object.entries(estilo.coresEvitadas || {})) if (ids && ids.length) coresEvitadas[t] = ids.slice();
        const r = VL.geradorVisual.gerar(lista, Object.assign({ genero, catalogo, evitados, coresEvitadas }, extra));
        if (!r) { camada.aviso('Não deu para criar um visual diferente: salve mais visuais em "Meu guarda-roupa" para o Vagalume conhecer o seu estilo.', { tipo: 'erro', duracaoMs: 8000 }); return; }
        const n = lista.filter((v) => String(v.genero).toUpperCase() === r.genero).length;
        const controles = controlesDeEstilo(estilo);
        // Peças fixas (pedido do usuário em 2026-11-16): escolhidas à direita entre as peças dos visuais
        // salvos; ficam em todos os visuais gerados até serem soltas.
        const fixos = Object.assign({}, estilo.fixos || {});
        const idsDoCatalogo = (t) => (((catalogo && catalogo.tipos && catalogo.tipos[t]) || {}).sets || []).filter((x) => x.g === 'U' || x.g === r.genero).map((x) => x.id);
        const coresDoCatalogo = (t) => ((catalogo && catalogo.paletas && catalogo.tipos && catalogo.tipos[t] && catalogo.paletas[catalogo.tipos[t].paleta]) || []).map((c) => c.id);
        const final = () => aplicarFixos(VL.geradorVisual.evitar(r.visual, evitados, idsDoCatalogo, coresEvitadas, coresDoCatalogo), fixos, catalogo);
        const previa = el('div', { class: 'vl-visual-previa' }, [imagemDoVisual(final(), r.genero)]);
        let ordemPrevia = 0;
        const atualizarPrevia = () => {
          const minha = ++ordemPrevia;
          const nova = imagemDoVisual(final(), r.genero);
          const visivel = [...previa.children].find((n) => n.style.display !== 'none');
          if (!visivel) { previa.replaceChildren(nova); return; }
          nova.style.display = 'none';
          previa.append(nova);
          const trocar = function () {
            if (minha !== ordemPrevia) { nova.remove(); return; } // já pediram outra
            nova.style.display = '';
            for (const n of [...previa.children]) if (n !== nova) n.remove();
          };
          nova.addEventListener('load', trocar, { once: true });
          nova.addEventListener('error', trocar, { once: true });
        };
        const painel = guardaRoupaFixo(r, fixos, evitados, coresEvitadas, catalogo, atualizarPrevia, final);
        let escolhida = null;
        const acao = (rotulo, valor, destaque) => el('button', { type: 'button', class: 'vl-botao' + (destaque ? ' primario' : ''), texto: rotulo, onclick() {
          escolhida = valor;
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // fecha o diálogo
        } });
        const acoes = el('div', { class: 'vl-gr-acoes' }, [acao('Gerar outro', 'outro'), acao('Vestir', 'vestir', true)]);
        camada.dialogo({
          titulo: 'Visual novo',
          texto: 'Este gerador não entrega um visual pronto para usar: ele monta uma ideia a partir do seu gosto (dos seus ' + n + ' visuais salvos) para inspirar um visual novo. Fixe peças à direita para elas ficarem nos próximos visuais gerados, ou marque as que você quer evitar.',
          conteudo: el('div', { class: 'vl-gr-junto' }, [el('div', { class: 'vl-gr-esq' }, [previa, el('p', { class: 'vl-nota vl-visual-aviso', texto: '* Se o visual não aparecer logo, espere só alguns segundos que ele já vai estar pronto.' }), controles.el, acoes]), painel]),
          largo: true,
          botoes: [{ rotulo: 'Fechar', valor: null, foco: true }],
        }).then(function (valor) {
          const escolha = escolhida || valor;
          if (escolha === 'outro') mostrarGerado(lista, genero, catalogo, Object.assign(controles.ler(), { fixos, evitados, coresEvitadas }));
          else if (escolha === 'vestir') vestir(final(), r.genero, 'gerado');
        });
      }
      // ---------- peças fixas do gerador: um guarda-roupa próprio, ao lado do gerador ----------
      // Pedido do usuário em 2026-11-16 (com desenho): independente do guarda-roupa do jogo. Em cima, as
      // três partes principais (cabeça, camisa, calça; a seta mostra as outras); abaixo, as opções de cada
      // uma; à direita, todas as peças do catálogo do jogo e as cores. A peça escolhida fica fixa (🔒) em
      // todos os visuais gerados até ser solta.
      const PRINCIPAIS = [
        { id: 'cabeca', nome: 'Cabeça', icone: 'cabeca', tipos: [['hr', 'Cabelo', 'cabelo'], ['ha', 'Chapéu', 'chapeu'], ['he', 'Na cabeça', 'laco'], ['ea', 'Óculos', 'oculos'], ['fa', 'Rosto', 'mascara']] },
        { id: 'camisa', nome: 'Camisa', icone: 'camisa', tipos: [['ch', 'Blusa', 'camisa'], ['cc', 'Casaco', 'casaco'], ['ca', 'No peito', 'colar'], ['cp', 'Estampa', 'estrela']] },
        { id: 'calca', nome: 'Calça', icone: 'calca', tipos: [['lg', 'Calça', 'calca'], ['sh', 'Sapato', 'sapato'], ['wa', 'Cintura', 'cinto']] },
      ];
      const DE_CABECA = new Set(['hr', 'ha', 'he', 'ea', 'fa']);
      const NOME_TIPO = {};
      for (const p of PRINCIPAIS) for (const [t, n] of p.tipos) NOME_TIPO[t] = n;
      const DESENHOS = {
        cabeca: 'M12 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM5 12c0-5 3-8 7-8s7 3 7 8',
        camisa: 'M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z',
        calca: 'M6 3h12l1 18h-5l-2-11-2 11H5z',
        cabelo: 'M5 14c0-6 3-10 7-10s7 4 7 10M5 14c2-2 4-5 5-8M19 14c-2-2-4-4-6-7M5 14v5M19 14v5',
        chapeu: 'M3 17h18M6 17c0-6 2-10 6-10s6 4 6 10',
        laco: 'M12 12l-7-4v8zM12 12l7-4v8zM12 10v4',
        oculos: 'M3 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM15 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM9 12h6',
        mascara: 'M4 8c5-2 11-2 16 0 0 7-3 11-8 11S4 15 4 8zM8 11h2M14 11h2',
        casaco: 'M8 3l-5 3 2 5 3-1v11h3V8M16 3l5 3-2 5-3-1v11h-3V8M8 3l4 5 4-5',
        colar: 'M6 4c0 6 3 9 6 9s6-3 6-9M12 13v4M10 17h4l-2 3z',
        estrela: 'M12 3l2.6 5.6 6 .6-4.6 4 1.4 6L12 16l-5.4 3.2 1.4-6-4.6-4 6-.6z',
        sapato: 'M3 16h18v3H3zM3 16V9h5l3 4 10 1v2',
        cinto: 'M3 10h18v4H3zM10 9h4v6h-4z',
        seta: 'M9 6l6 6-6 6',
      };
      function iconeSvg(nome) {
        const NS = 'http://www.w3.org/2000/svg';
        const s = document.createElementNS(NS, 'svg');
        s.setAttribute('viewBox', '0 0 24 24');
        s.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', DESENHOS[nome] || '');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '1.7');
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('stroke-linecap', 'round');
        s.appendChild(p);
        return s;
      }
      const CSS_GR = '.vl-dialogo.largo:has(.vl-gr) { width: min(1120px, 100%); }'
        + '.vl-gr-junto { display: flex; gap: 14px; align-items: stretch; flex-wrap: wrap; }'
        + '.vl-gr-esq { flex: 0 1 340px; min-width: 260px; display: flex; flex-direction: column; gap: 8px; }'
        + '.vl-gr { flex: 1 1 560px; min-width: 320px; display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid #2c3445; border-radius: 12px; background: #131820; }'
        + '.vl-gr-titulo { display: flex; align-items: center; gap: 8px; } .vl-gr-titulo b { color: #d6f24a; flex: 1; }'
        + '.vl-gr-acoes { display: flex; gap: 8px; } .vl-gr-acoes .vl-botao { flex: 1; padding: 9px 12px; }'
        + '.vl-gr-corpo { display: flex; gap: 8px; min-height: 360px; }'
        + '.vl-gr-trilho { display: flex; flex-direction: column; gap: 6px; flex: none; }'
        + '.vl-gr-principais { display: flex; align-items: center; gap: 4px; overflow: hidden; }'
        + '.vl-gr-outras { display: flex; gap: 4px; max-width: 0; opacity: 0; overflow: hidden; transition: max-width .18s ease, opacity .18s ease; }'
        + '.vl-gr-outras.aberta { max-width: 120px; opacity: 1; }'
        + '.vl-gr-botao { position: relative; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; border: 1px solid #2c3445; background: #1b2230; color: #c9d2e0; cursor: pointer; padding: 0; transition: background .12s, border-color .12s, color .12s; }'
        + '.vl-gr-botao:hover { border-color: #5d7222; color: #fff; }'
        + '.vl-gr-botao.ativo { background: #d6f24a; border-color: #d6f24a; color: #12161f; }'
        + '.vl-gr-botao svg { width: 24px; height: 24px; }'
        + '.vl-gr-botao.fixo::after { content: "🔒"; position: absolute; right: -4px; bottom: -4px; font-size: 11px; }'
        + '.vl-gr-seta { width: 22px; border: 0; background: none; color: #d6f24a; cursor: pointer; display: grid; place-items: center; transition: transform .18s ease; padding: 0; }'
        + '.vl-gr-seta.aberta { transform: rotate(180deg); }'
        + '.vl-gr-seta svg { width: 18px; height: 18px; }'
        + '.vl-gr-subs { display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 10px; background: #0f141b; border: 1px solid #222a37; align-self: flex-start; }'
        + '.vl-gr-pecas { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); grid-auto-rows: 64px; gap: 6px; max-height: 380px; overflow: auto; padding-right: 4px; align-content: start; }'
        + '.vl-gr-peca { position: relative; border-radius: 8px; border: 1px solid #3a4558; background: #2c3647; cursor: pointer; padding: 0; overflow: hidden; }'
        + '.vl-gr-peca:hover { border-color: #5d7222; }'
        + '.vl-gr-peca.fixa { border: 2px solid #d6f24a; box-shadow: 0 0 8px rgba(214, 242, 74, .4); }'
        + '.vl-gr-peca.fixa::after { content: "🔒"; position: absolute; right: 2px; bottom: 2px; font-size: 10px; z-index: 1; }'
        + '.vl-gr-peca.atual { border: 2px dashed #7d8c5a; }'
        + '.vl-gr-peca.evitada { border: 2px solid #e5484d; } .vl-gr-peca.evitada > img { opacity: .4; }'
        + '.vl-gr-peca.evitada::before { content: "⊘"; position: absolute; left: 3px; top: 1px; color: #ff6b6f; font: 700 13px/1 system-ui, sans-serif; z-index: 1; }'
        + '.vl-gr-cor.evitada { position: relative; opacity: .45; box-shadow: inset 0 0 0 2px #e5484d; } .vl-gr-cor.evitada::after { content: "⊘"; position: absolute; inset: 0; display: grid; place-items: center; color: #e5484d; font: 700 13px/1 system-ui, sans-serif; text-shadow: 0 0 2px #fff; }'
        + '.vl-gr-modo { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: #121722; border: 1px solid #2c3445; flex: none; }'
        + '.vl-gr-modo-botao { all: unset; cursor: pointer; padding: 3px 9px; border-radius: 6px; font: 600 12px/1.3 system-ui, sans-serif; color: #c8d0dc; }'
        + '.vl-gr-modo-botao.ativo { background: #d6f24a; color: #12161f; }'
        + '.vl-gr-modo-botao:focus-visible { outline: 2px solid #d6f24a; outline-offset: 1px; }'
        + '.vl-gr-peca img { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; display: block; }'
        + '.vl-gr-peca img.cabeca { position: absolute; width: 90px; height: 130px; max-width: none; left: 50%; top: 50%; transform: translate(-50%, -54%); object-fit: none; }'
        + '.vl-gr-peca img.corpo { position: absolute; width: 128px; height: 220px; max-width: none; left: 50%; object-fit: none; }'
        + '.vl-gr-peca img.corpo-local { position: absolute; width: 90px; height: 130px; max-width: none; left: 50%; transform: translateX(-50%); object-fit: none; }'
        + '.vl-gr-peca img:not([data-ok]) { visibility: hidden; }'
        + '.vl-gr-peca:has(img:not([data-ok])) { background: linear-gradient(100deg, #2c3647 30%, #3a4659 50%, #2c3647 70%); background-size: 300% 100%; animation: vl-gr-brilho 1.1s linear infinite; }'
        + '@keyframes vl-gr-brilho { from { background-position: 100% 0; } to { background-position: -100% 0; } }'
        + '.vl-gr-andamento { margin-left: auto; color: #9be8ad; }'
        + '.vl-gr-peca .vip { position: absolute; left: 3px; top: 3px; font: 800 8px/1 system-ui, sans-serif; color: #12161f; background: #f2c94c; border-radius: 3px; padding: 1px 3px; }'
        + '.vl-gr-nenhuma { display: grid; place-items: center; color: #8d99ad; font-size: 22px; }'
        + '.vl-gr-cores { flex: 0 0 168px; display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow: auto; }'
        + '.vl-gr-cores p { margin: 0; font-size: 11px; color: #8d99ad; }'
        + '.vl-gr-paleta { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }'
        + '.vl-gr-cor { aspect-ratio: 1; border-radius: 5px; border: 1px solid rgba(0, 0, 0, .35); cursor: pointer; padding: 0; }'
        + '.vl-gr-cor { position: relative; }'
        + '.vl-gr-cor.fixa { outline: 2px solid #d6f24a; outline-offset: 1px; box-shadow: 0 0 6px rgba(214, 242, 74, .6); }'
        + '.vl-gr-cor.fixa::after { content: "🔒"; position: absolute; right: -3px; bottom: -4px; font-size: 8px; }'
        + '.vl-gr-cor.atual { outline: 1px dashed #c9d2e0; outline-offset: 1px; }'
        + '.vl-gr-cores p.vl-gr-aviso-cor { color: #c9a94c; }'
        + '.vl-visual-aviso { margin: -2px 2px 0; font-size: 11px; line-height: 1.4; color: #8d99ad; font-style: italic; }'
        + '.vl-gr-estado { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #c9d2e0; min-height: 28px; }'
        + '.vl-gr-estado span { flex: 1; }';
      const estiloGr = camada.el('style', { texto: CSS_GR });
      camada.area().appendChild(estiloGr);
      ctx.aoParar(function () { estiloGr.remove(); });

      function partesDe(visual) {
        const m = new Map();
        for (const p of String(visual || '').split('.')) { const t = p.split('-')[0]; if (t) m.set(t, p); }
        return m;
      }
      // Peça e cor são independentes (pedido do usuário em 2026-11-16): fixos[tipo] = { peca, cores }.
      // peca: id da peça, 'sem' (fixado sem a peça) ou ausente (o gerador escolhe a peça).
      // cores: lista com as cores fixas por posição (null = o gerador escolhe aquela cor) ou ausente.
      function idDaParte(parte) { return Number(String(parte || '').split('-')[1]); }
      function coresDaParte(parte) { return String(parte || '').split('-').slice(2).map(Number).filter(Number.isFinite); }
      function temFixo(fixos, t) {
        const f = fixos && fixos[t];
        return !!f && (f.peca != null || (Array.isArray(f.cores) && f.cores.some((c) => c != null)));
      }
      function aplicarFixos(visual, fixos, catalogo) {
        const m = partesDe(visual);
        for (const t of Object.keys(fixos || {})) {
          const f = fixos[t];
          if (!temFixo(fixos, t)) continue;
          if (f.peca === 'sem') { m.delete(t); continue; }
          const base = m.get(t) || '';
          const id = f.peca != null ? f.peca : idDaParte(base);
          if (!Number.isFinite(id)) continue; // só a cor fixa e o visual não tem esta peça: nada a pintar
          const info = catalogo && catalogo.tipos && catalogo.tipos[t];
          const set = info ? (info.sets || []).find((s) => s.id === id) : null;
          const paleta = info && catalogo.paletas ? (catalogo.paletas[info.paleta] || []) : [];
          const geradas = coresDaParte(base);
          const fixas = Array.isArray(f.cores) ? f.cores : [];
          const n = set ? set.cores : Math.max(geradas.length, fixas.length, 1);
          const cores = [];
          for (let i = 0; i < n; i++) {
            const c = fixas[i] != null ? fixas[i] : (geradas[i] != null ? geradas[i] : (geradas[0] != null ? geradas[0] : (paleta.find((p) => !p.club) || paleta[0] || { id: 1 }).id));
            cores.push(c);
          }
          m.set(t, t + '-' + id + (cores.length ? '-' + cores.join('-') : ''));
        }
        return [...m.values()].join('.');
      }
      // O servidor de imagens do jogo aguenta uns 16 pedidos juntos (com 40 começa a recusar: medido em
      // 2026-11-16). A fila carrega 12 por vez: primeiro as que estão na tela, depois as do
      // pré-carregamento (que só enchem o cache do navegador, onde ficam por 3 dias), com nova tentativa.
      const filaImagens = [];
      let carregando = 0;
      let previasCarregando = 0;
      function proximaImagem() {
        // Descarta as que saíram da tela (outra parte escolhida); espera as que ainda vão entrar.
        for (let k = filaImagens.length - 1; k >= 0; k--) if (!filaImagens[k].previo && !filaImagens[k].img.isConnected && Date.now() - filaImagens[k].criada > 3000) filaImagens.splice(k, 1);
        while (carregando < 12 && !previasCarregando) {
          let i = filaImagens.findIndex((x) => !x.previo && x.img.isConnected);
          if (i < 0) i = filaImagens.findIndex((x) => x.previo);
          if (i < 0) break;
          const item = filaImagens.splice(i, 1)[0];
          carregando++;
          const fim = function (ok) {
            carregando--;
            if (ok) item.img.dataset.ok = '1';
            if (item.previo && (ok || item.tentativas >= 2) && item.aoTerminar) item.aoTerminar();
            if (!ok && item.tentativas < 2) { item.tentativas++; item.criada = Date.now(); setTimeout(function () { filaImagens.push(item); proximaImagem(); }, 1200); }
            proximaImagem();
          };
          item.img.onload = function () { fim(true); };
          item.img.onerror = function () { item.img.removeAttribute('src'); fim(false); };
          item.img.src = item.url + (item.tentativas ? '&t=' + item.tentativas : '');
        }
      }
      let agendada = false;
      function carregarImagem(img, url, previo, aoTerminar) {
        filaImagens.push({ img, url, tentativas: 0, criada: Date.now(), previo: !!previo, aoTerminar });
        // A imagem ainda não está na página: começa depois que a grade for montada.
        if (!agendada) { agendada = true; setTimeout(function () { agendada = false; proximaImagem(); }, 0); }
      }
      // Miniaturas pelo motor do jogo (script da página src/principal/avatar.js): os pedidos do mesmo
      // momento vão juntos ('vl:avatar:lote'); cada imagem volta pela chave ('vl:avatar:miniatura').
      const pendentesMini = new Map(); // chave -> { img, reserva }
      let filaMini = [];
      let loteAgendado = false;
      let contadorMini = 0;
      function miniaturaPeloMotor(img, figura, cabeca, genero, reserva) {
        const chave = 'm' + (++contadorMini);
        pendentesMini.set(chave, { img, reserva });
        filaMini.push({ chave, figura, genero: genero === 'F' ? 'F' : 'M', direcao: 2, cabeca });
        if (!loteAgendado) {
          loteAgendado = true;
          setTimeout(function () {
            loteAgendado = false;
            const itens = filaMini.splice(0, filaMini.length);
            for (let i = 0; i < itens.length; i += 96) document.dispatchEvent(new CustomEvent('vl:avatar:lote', { detail: JSON.stringify({ itens: itens.slice(i, i + 96) }) }));
          }, 0);
        }
        // Sem resposta em 5 s: o servidor de imagens.
        setTimeout(function () {
          const p = pendentesMini.get(chave);
          if (p && !p.img.dataset.ok) { pendentesMini.delete(chave); if (p.img.isConnected) p.reserva(); }
        }, 5000);
      }
      ctx.escutar(document, 'vl:avatar:miniatura', function (ev) {
        let d = null;
        try { d = JSON.parse(String(ev.detail || '')); } catch (e) { return; }
        const p = d && pendentesMini.get(d.chave);
        if (!p || !/^data:image\//.test(String(d.url))) return;
        if (!p.img.isConnected && p.img.dataset.ok) { pendentesMini.delete(d.chave); return; }
        motorDoJogo = true;
        p.img.src = d.url;
        p.img.dataset.ok = '1';
      });
      ctx.escutar(document, 'vl:avatar:falhou', function () {
        motorDoJogo = false;
        for (const [chave, p] of pendentesMini) { pendentesMini.delete(chave); if (p.img.isConnected && !p.img.dataset.ok) p.reserva(); }
      });
      function guardaRoupaFixo(r, fixos, evitados, coresEvitadas, catalogo, mudou, montar) {
        const caixa = el('div', { class: 'vl-gr', role: 'region', 'aria-label': 'Fixar peças' });
        if (!catalogo || !catalogo.tipos) {
          caixa.append(el('b', { texto: 'Fixar peças', style: 'color:#d6f24a' }), el('p', { class: 'vl-nota', texto: 'O catálogo de roupas do jogo não carregou. Feche e gere de novo.' }));
          return caixa;
        }
        const genero = r.genero;
        const atualDoVisual = partesDe(r.visual);
        const cabecaBase = atualDoVisual.get('hd') || 'hd-180-1';
        let principal = PRINCIPAIS[0];
        let tipo = principal.tipos[0][0];
        let abertas = false;
        const principaisEl = el('div', { class: 'vl-gr-principais' });
        const subsEl = el('div', { class: 'vl-gr-subs' });
        const pecasEl = el('div', { class: 'vl-gr-pecas' });
        const coresEl = el('div', { class: 'vl-gr-cores' });
        const estadoEl = el('div', { class: 'vl-gr-estado' });
        let observador = null;

        const setsDe = (t) => ((catalogo.tipos[t] || {}).sets || []).filter((s) => s.g === 'U' || s.g === genero);
        const paletaDe = (t) => catalogo.paletas[(catalogo.tipos[t] || {}).paleta] || [];
        // A peça como ela vai sair no visual (gerada, com o que estiver fixo por cima).
        function pecaAtual(t) { return partesDe(montar()).get(t) || ''; }
        // Modo do clique nas peças: fixar (padrão) ou evitar (marca várias; o gerador não usa).
        let modo = 'fixar';
        function alternarEvitar(t, id, onde) {
          const grupo = onde || evitados;
          const lista = grupo[t] || (grupo[t] = []);
          const i = lista.indexOf(id);
          if (i >= 0) lista.splice(i, 1); else lista.push(id);
          if (!lista.length) delete grupo[t];
          mudou();
          desenharEscolha();
        }
        const coresDe = coresDaParte;
        const idDe = idDaParte;
        const fixo = (t) => fixos[t] || (fixos[t] = {});
        const fixado = (t) => temFixo(fixos, t);
        const pecaFixa = (t) => (fixos[t] ? fixos[t].peca : undefined);
        const corFixa = (t, i) => (fixos[t] && Array.isArray(fixos[t].cores) ? fixos[t].cores[i] : undefined);
        function limpar(t) { if (!fixado(t)) delete fixos[t]; }
        // Clicar na peça fixa de novo solta só a peça; a cor continua como estava.
        function fixarPeca(t, peca) {
          const f = fixo(t);
          if (f.peca === peca) delete f.peca; else f.peca = peca;
          limpar(t);
          mudou();
          desenharEscolha();
        }
        // Clicar na cor fixa de novo solta só aquela cor; a peça continua como estava.
        function fixarCor(t, i, cor) {
          const f = fixo(t);
          const cores = Array.isArray(f.cores) ? f.cores.slice() : [];
          cores[i] = cores[i] === cor ? null : cor;
          while (cores.length && cores[cores.length - 1] == null) cores.pop();
          if (cores.length) f.cores = cores; else delete f.cores;
          limpar(t);
          mudou();
          desenharEscolha();
        }
        function urlMiniatura(t, id) {
          return 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(figuraMiniatura(t, id)) + '&gender=' + encodeURIComponent(genero) + '&direction=2&head_direction=2' + (DE_CABECA.has(t) ? '&headonly=1' : '&size=l');
        }
        function figuraMiniatura(t, id) {
          const pal = paletaDe(t);
          const cores = coresDe(pecaAtual(t));
          const c = cores.length ? cores : [pal[0] ? pal[0].id : 1];
          const parte = t + '-' + id + '-' + c.join('-');
          const cabelo = atualDoVisual.get('hr');
          return DE_CABECA.has(t) ? cabecaBase + '.' + parte : cabecaBase + (cabelo ? '.' + cabelo : '') + '.' + parte + (t === 'cp' ? '.ch-210-62' : '');
        }
        function miniatura(t, id) {
          const cabeca = DE_CABECA.has(t);
          const img = el('img', { alt: '', decoding: 'async', class: cabeca ? 'cabeca' : 'corpo' });
          // Pelo servidor de imagens: roupa na imagem grande (128 × 220), recortada na altura da peça.
          const peloServidor = function () {
            img.className = cabeca ? 'cabeca' : 'corpo';
            if (!cabeca) { img.style.top = ({ lg: '-150px', sh: '-158px', wa: '-148px' })[t] || '-122px'; img.style.transform = 'translateX(-50%)'; }
            carregarImagem(img, urlMiniatura(t, id));
          };
          if (motorDoJogo === false) { peloServidor(); return img; }
          // Pelo motor do jogo (na hora): imagem 90 × 130, a cabeça centralizada e a roupa recortada.
          if (!cabeca) { img.className = 'corpo-local'; img.style.top = ({ lg: '-62px', sh: '-66px', wa: '-58px' })[t] || '-50px'; }
          miniaturaPeloMotor(img, figuraMiniatura(t, id), cabeca, genero, peloServidor);
          return img;
        }
        // Pré-carregamento: ao abrir, a primeira tela (48 peças) de cada parte, começando pela parte aberta.
        // Fica no cache do navegador; ao clicar na parte, as miniaturas aparecem na hora.
        const andamento = el('span', { class: 'vl-nota vl-gr-andamento' });
        function preCarregar() {
          // Com o motor do jogo, as miniaturas saem na hora: não precisa pré-carregar do servidor.
          if (motorDoJogo !== false) { andamento.textContent = ''; return; }
          const ordem = [];
          for (const p of [principal].concat(PRINCIPAIS.filter((x) => x !== principal))) for (const [t] of p.tipos) ordem.push(t);
          const urls = [];
          for (const t of ordem) for (const s of setsDe(t).slice(0, 48)) urls.push(urlMiniatura(t, s.id));
          let feitas = 0;
          const total = urls.length;
          const mostrar = () => { andamento.textContent = feitas < total ? 'Preparando miniaturas: ' + Math.round(feitas * 100 / total) + '%' : 'Miniaturas prontas'; };
          mostrar();
          for (const u of urls) carregarImagem(new Image(), u, true, function () { feitas++; if (feitas % 12 === 0 || feitas === total) mostrar(); });
          setTimeout(proximaImagem, 0);
        }
        function desenharPrincipais() {
          const botao = (p) => {
            const b = el('button', { type: 'button', class: 'vl-gr-botao' + (p === principal ? ' ativo' : '') + (p.tipos.some(([t]) => fixado(t)) ? ' fixo' : ''), title: p.nome, 'aria-label': p.nome });
            b.appendChild(iconeSvg(p.icone));
            b.addEventListener('click', function () { principal = p; tipo = p.tipos[0][0]; abertas = false; desenharTudo(); });
            return b;
          };
          principaisEl.replaceChildren(...PRINCIPAIS.map(botao));
        }
        function desenharSubs() {
          subsEl.replaceChildren(...principal.tipos.map(function ([t, nome, icone]) {
            const b = el('button', { type: 'button', class: 'vl-gr-botao' + (t === tipo ? ' ativo' : '') + (fixado(t) ? ' fixo' : ''), title: nome + (fixado(t) ? ' (fixado)' : ''), 'aria-label': nome });
            b.appendChild(iconeSvg(icone));
            b.addEventListener('click', function () { tipo = t; desenharTudo(); });
            return b;
          }));
        }
        function desenharPecas() {
          if (observador) { observador.disconnect(); observador = null; }
          const lista = setsDe(tipo);
          const nenhuma = el('button', { type: 'button', class: 'vl-gr-peca vl-gr-nenhuma', title: 'Sem ' + NOME_TIPO[tipo].toLowerCase(), texto: '✕' });
          nenhuma.dataset.id = 'nenhuma';
          nenhuma.addEventListener('click', function () { if (modo === 'fixar') fixarPeca(tipo, 'sem'); });
          pecasEl.replaceChildren(nenhuma);
          pecasEl.scrollTop = 0;
          let feitos = 0;
          const sentinela = el('div', { style: 'grid-column: 1 / -1; height: 1px;' });
          function mais() {
            const ate = Math.min(lista.length, feitos + 48);
            const nos = [];
            for (; feitos < ate; feitos++) {
              const s = lista[feitos];
              const b = el('button', { type: 'button', class: 'vl-gr-peca', title: NOME_TIPO[tipo] + ' ' + s.id + (s.club ? ' (VIP)' : '') });
              b.dataset.id = String(s.id);
              b.appendChild(miniatura(tipo, s.id));
              if (s.club) b.appendChild(el('span', { class: 'vip', texto: 'VIP' }));
              b.addEventListener('click', function () { if (modo === 'evitar') alternarEvitar(tipo, s.id); else fixarPeca(tipo, s.id); });
              nos.push(b);
            }
            sentinela.remove();
            pecasEl.append(...nos);
            if (feitos < lista.length) pecasEl.append(sentinela);
            marcarPecas();
          }
          mais();
          observador = new IntersectionObserver(function (entradas) { if (entradas.some((e) => e.isIntersecting)) mais(); }, { root: pecasEl, rootMargin: '200px' });
          observador.observe(sentinela);
        }
        function desenharCores() {
          const parte = pecaAtual(tipo);
          const set = parte ? setsDe(tipo).find((s) => s.id === idDe(parte)) : null;
          const pal = paletaDe(tipo);
          const cores = coresDe(parte);
          const fixasN = fixos[tipo] && Array.isArray(fixos[tipo].cores) ? fixos[tipo].cores.length : 0;
          const n = set ? set.cores : Math.max(1, fixasN);
          if (set && n === 0) { coresEl.replaceChildren(el('p', { texto: 'Esta peça não muda de cor.' })); return; }
          const grupos = [];
          if (!parte) grupos.push(el('p', { class: 'vl-gr-aviso-cor', texto: pecaFixa(tipo) === 'sem' ? 'Fixado sem a peça: a cor vale se você soltar a peça.' : 'A cor fixa vale quando o visual gerado tiver esta peça.' }));
          for (let i = 0; i < Math.min(2, n); i++) {
            grupos.push(el('p', { texto: (n > 1 ? 'Cor ' + (i + 1) : 'Cor') + (corFixa(tipo, i) != null ? ' 🔒' : '') }));
            grupos.push(el('div', { class: 'vl-gr-paleta' }, pal.map(function (c) {
              const fixa = corFixa(tipo, i) === c.id;
              const evitada = (coresEvitadas[tipo] || []).includes(c.id);
              const b = el('button', { type: 'button', class: 'vl-gr-cor' + (evitada ? ' evitada' : '') + (fixa ? ' fixa' : (cores[i] === c.id ? ' atual' : '')), title: '#' + c.hex + (c.club ? ' (VIP)' : '') + (fixa ? ' (fixa: clique para soltar)' : ''), style: 'background:#' + c.hex + ';' });
              b.addEventListener('click', function () { if (modo === 'evitar') alternarEvitar(tipo, c.id, coresEvitadas); else fixarCor(tipo, i, c.id); });
              return b;
            })));
          }
          coresEl.replaceChildren(...grupos);
        }
        function desenharEstado() {
          const p = pecaFixa(tipo);
          const temCor = !!(fixos[tipo] && Array.isArray(fixos[tipo].cores) && fixos[tipo].cores.some((c) => c != null));
          const total = Object.keys(fixos).filter((t) => fixado(t)).length;
          const soltar = el('button', { type: 'button', class: 'vl-botao', texto: 'Soltar', title: 'O gerador volta a escolher a peça e a cor desta parte', disabled: !fixado(tipo) });
          const nEvitadas = (evitados[tipo] || []).length;
          const nCoresEvitadas = (coresEvitadas[tipo] || []).length;
          const totalEvitadas = Object.values(evitados).concat(Object.values(coresEvitadas)).reduce((n, l) => n + l.length, 0);
          soltar.disabled = !fixado(tipo) && !nEvitadas && !nCoresEvitadas;
          soltar.title = 'O gerador volta a escolher a peça e a cor desta parte, sem peças evitadas';
          soltar.addEventListener('click', function () { delete fixos[tipo]; delete evitados[tipo]; delete coresEvitadas[tipo]; mudou(); desenharEscolha(); });
          const soltarTudo = el('button', { type: 'button', class: 'vl-botao', texto: 'Soltar tudo', disabled: !total && !totalEvitadas });
          soltarTudo.addEventListener('click', function () { for (const t of Object.keys(fixos)) delete fixos[t]; for (const t of Object.keys(evitados)) delete evitados[t]; for (const t of Object.keys(coresEvitadas)) delete coresEvitadas[t]; mudou(); desenharTudo(); });
          const textoPeca = p === 'sem' ? 'sem peça 🔒' : (p != null ? 'peça fixa 🔒' : 'peça livre');
          estadoEl.replaceChildren(el('span', { texto: NOME_TIPO[tipo] + ': ' + textoPeca + ' · ' + (temCor ? 'cor fixa 🔒' : 'cor livre') + (nEvitadas ? ' · ' + nEvitadas + ' peça(s) evitada(s) ⊘' : '') + (nCoresEvitadas ? ' · ' + nCoresEvitadas + ' cor(es) evitada(s) ⊘' : '') + (total ? ' · ' + total + ' parte(s) com algo fixo' : '') }), soltar, soltarTudo);
        }
        const modoEl = el('div', { class: 'vl-gr-modo', role: 'group', 'aria-label': 'O que o clique na peça faz' });
        const notaModo = el('span', { class: 'vl-nota' });
        function desenharModo() {
          const botao = (valor, rotulo) => {
            const b = el('button', { type: 'button', class: 'vl-gr-modo-botao' + (modo === valor ? ' ativo' : ''), texto: rotulo, 'aria-pressed': String(modo === valor) });
            b.addEventListener('click', function () { modo = valor; desenharModo(); });
            return b;
          };
          modoEl.replaceChildren(botao('fixar', '🔒 Fixar'), botao('evitar', '⊘ Evitar'));
          notaModo.textContent = modo === 'evitar' ? 'Clique nas peças e nas cores que você não quer: dá para marcar várias. Clique de novo para liberar.' : 'Peça e cor são fixadas à parte: escolha só a peça, só a cor ou as duas. Clique de novo para soltar.';
        }
        function desenharTudo() { desenharPrincipais(); desenharSubs(); desenharPecas(); desenharCores(); desenharEstado(); }
        // Depois de escolher peça ou cor: só a marca na grade, as cores, o estado e os cadeados.
        function desenharEscolha() {
          marcarPecas();
          desenharPrincipais(); desenharSubs(); desenharCores(); desenharEstado();
        }
        // Peça fixa: borda limão com cadeado. Peça que o gerador escolheu (livre): borda tracejada.
        function marcarPecas() {
          const p = pecaFixa(tipo);
          const atual = String(idDe(pecaAtual(tipo)));
          for (const b of pecasEl.children) {
            if (!b.dataset || !b.dataset.id) continue;
            const id = b.dataset.id;
            const fixa = id === 'nenhuma' ? p === 'sem' : String(p) === id;
            b.classList.toggle('fixa', fixa);
            b.classList.toggle('atual', !fixa && p == null && id === atual);
            b.classList.toggle('evitada', (evitados[tipo] || []).includes(Number(id)));
          }
        }
        caixa.append(
          el('div', { class: 'vl-gr-titulo' }, [modoEl, notaModo, andamento]),
          principaisEl,
          el('div', { class: 'vl-gr-corpo' }, [subsEl, pecasEl, coresEl]),
          estadoEl,
        );
        desenharModo();
        desenharTudo();
        setTimeout(preCarregar, 400);
        return caixa;
      }
      function gerarVisual(estilo) {
        if (!exigir()) return;
        if (!VL.geradorVisual) { camada.aviso('O gerador de visual não carregou.', { tipo: 'erro' }); return; }
        // O catálogo de roupas do jogo traz peças e tons novos no mesmo estilo; sem ele, só o que a pessoa já usa.
        const catalogo = VL.dadosJogo && VL.dadosJogo.figuras ? VL.dadosJogo.figuras().catch(function () { return null; }) : Promise.resolve(null);
        Promise.all([pedirVisuais(), catalogo]).then(function ([lista, cat]) {
          if (!lista || !lista.length) { camada.aviso('Nenhum visual salvo em "Meu guarda-roupa". Salve alguns visuais seus para o Vagalume conhecer o seu estilo.', { tipo: 'erro', duracaoMs: 8000 }); return; }
          const eu = VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null;
          const meu = eu ? acharVisual(eu) : null;
          mostrarGerado(lista, meu ? meu.genero : null, cat, estilo);
        });
      }
      ctx.comando({
        nome: 'gerarvisual',
        alvoX: true,
        uso: 'gerarvisual [tema] | gerarvisual com <apelido>',
        descricao: 'Cria um visual novo no seu estilo, a partir dos visuais salvos em "Meu guarda-roupa". Com um tema (escuro, colorido, pastel, halloween, verao, natal, vagalume) usa as cores dele; com "com <apelido>", combina com o visual da pessoa.',
        executar(pedido) {
          const a0 = String(pedido.args[0] || '').toLowerCase();
          if (a0 === 'com') { gerarVisual({ combinar: String(pedido.args[1] || '').replace(/^@/, '') }); return; }
          if (a0 && VL.geradorVisual && VL.geradorVisual.TEMAS[a0]) { gerarVisual({ tema: a0 }); return; }
          if (a0) { camada.aviso('Temas: ' + Object.keys(VL.geradorVisual.TEMAS).join(', ') + '. Ou: gerarvisual com <apelido>.', { tipo: 'erro' }); return; }
          gerarVisual();
        },
      });
      // Botão "Gerar visual" no guarda-roupa do jogo, acima do "Salvar mudanças".
      function botaoNoGuardaRoupa() {
        for (const card of document.querySelectorAll('.nitro-card')) {
          const cab = card.querySelector('.nitro-card-header');
          if (!cab || !/guarda-roupa/i.test(cab.textContent)) continue;
          if (card.querySelector('.vl-gerar-visual')) continue;
          const salvar = [...card.querySelectorAll('button, .btn')].find((b) => /salvar mudan/i.test(b.textContent));
          if (!salvar) continue;
          const b = document.createElement(salvar.tagName.toLowerCase() === 'button' ? 'button' : 'div');
          if (b.tagName === 'BUTTON') b.type = 'button';
          b.className = salvar.className + ' vl-gerar-visual';
          b.textContent = 'Gerar visual';
          b.title = 'Criar um visual novo no seu estilo (Vagalume)';
          b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); gerarVisual(); });
          salvar.before(b);
        }
      }
      let pendenteGR = false;
      const observarGR = new MutationObserver(function () {
        if (pendenteGR) return;
        pendenteGR = true;
        setTimeout(function () { pendenteGR = false; botaoNoGuardaRoupa(); }, 250);
      });
      if (document.body) observarGR.observe(document.body, { childList: true, subtree: true });
      ctx.aoParar(function () { observarGR.disconnect(); document.querySelectorAll('.vl-gerar-visual').forEach((e) => e.remove()); });

      ctx.comando({
        nome: 'visuais',
        uso: 'visuais [número]',
        descricao: 'Mostra os visuais salvos no guarda-roupa; com número, veste aquele.',
        executar(pedido) {
          if (!exigir() || esperaVisuais) return;
          const escolha = pedido.args[0] == null ? null : Number(pedido.args[0]);
          esperaVisuais = function (lista) {
            if (!lista || !lista.length) { camada.aviso('Nenhum visual salvo no guarda-roupa.'); return; }
            if (escolha != null) {
              const v = lista.find((x) => x.posicao === escolha) || lista[escolha - 1];
              if (!v) { camada.aviso('Não há visual nessa posição.', { tipo: 'erro' }); return; }
              vestir(v.visual, v.genero, 'guarda-roupa');
              return;
            }
            camada.dialogo({
              titulo: 'Visuais salvos',
              texto: 'Use o comando visuais com o número para vestir. Os códigos podem ser selecionados e copiados.',
              detalhe: lista.map((v) => v.posicao + ' (' + v.genero + '): ' + v.visual).join('\n'),
            });
          };
          setTimeout(function () { esperaVisuais = null; }, 5000);
          conexao.enviar(SAIDA.PEDIR_VISUAIS, [['i', 0]]);
        },
      });

      // Efeitos e itens de mão: atalhos para os comandos do próprio Habblet (:enable e :handitem).
      ctx.comando({
        nome: 'efeito',
        apelidos: ['enable'],
        uso: 'efeito <número>',
        descricao: 'Aplica um efeito (0 tira). Ex.: 215 guardião, 660 invisível.',
        executar(pedido) {
          const n = Number(pedido.args[0]);
          if (!Number.isInteger(n) || n < 0 || n > 100000) { camada.aviso('Use um número.', { tipo: 'erro' }); return; }
          if (exigir()) { ultimoEfeito = n; mandarComando(':enable ' + n); }
        },
      });
      ctx.comando({
        nome: 'handitem',
        uso: 'handitem <número>',
        descricao: 'Segura um item na mão (0 solta).',
        executar(pedido) {
          const n = Number(pedido.args[0]);
          if (!Number.isInteger(n) || n < 0 || n > 100000) { camada.aviso('Use um número.', { tipo: 'erro' }); return; }
          if (exigir()) { ultimoHanditem = n; mandarComando(':handitem ' + n); }
        },
      });

      // ---------- lista de efeitos e itens de mão (pedido do usuário em 2026-11-14) ----------
      // Catálogo local complementado pelos textos do jogo (VL.dadosJogo). Clique aplica; ★ guarda nos favoritos
      // (storage.local, chave vl.favoritosVisual).
      const el = camada.el;
      const CHAVE_FAV = 'vl.favoritosVisual';
      let favoritos = { efeitos: [], itens: [] };
      const area = raiz.chrome && chrome.storage && chrome.storage.local;
      if (area) area.get(CHAVE_FAV).then(function (r) { const f = r[CHAVE_FAV]; if (f && Array.isArray(f.efeitos) && Array.isArray(f.itens)) favoritos = f; }).catch(function () {});
      function gravarFavoritos() { if (area) area.set({ [CHAVE_FAV]: favoritos }).catch(function () {}); }
      let abaGaleria = 'efeitos';
      let mudarAbaGaleria = null;
      function montarLista(alvo) {
        let ativo = true;
        alvo.appendChild(el('p', { class: 'vl-nota', texto: 'Carregando efeitos e itens de mão…' }));
        if (!VL.dadosJogo) {
          alvo.replaceChildren(el('p', { class: 'vl-vazio', texto: 'Não deu para ler os nomes do jogo.' }));
          return function () { ativo = false; };
        }
        Promise.all([VL.dadosJogo.efeitos(), VL.dadosJogo.itensDeMao()]).then(function (r) {
          if (!ativo) return;
          const listas = { efeitos: r[0], itens: r[1] };
          let aba = abaGaleria;
          let soFavoritos = false;
          let visiveis = [];
          let exibidos = 0;
          const opcoesVisual = Object.assign({}, ctx.secao());
          // Avatar de exemplo neutro: a prévia mantém contraste e escala iguais em todo o catálogo.
          const figura = 'hd-180-1.ch-210-66.lg-270-82.sh-290-91.hr-100-40';
          const busca = el('input', { type: 'search', class: 'vl-amigos-busca', placeholder: 'Buscar por nome ou ID…', 'aria-label': 'Buscar por nome ou ID' });
          const abas = el('div', { class: 'vl-efeitos-abas', role: 'tablist', 'aria-label': 'Tipo de visual' });
          const bE = el('button', { type: 'button', class: 'vl-efeitos-aba', texto: 'Efeitos', role: 'tab' });
          const bI = el('button', { type: 'button', class: 'vl-efeitos-aba', texto: 'Handitems', role: 'tab' });
          abas.append(bE, bI);
          const manter = el('input', { type: 'checkbox' });
          const sempre = el('input', { type: 'checkbox' });
          const fav = el('button', { type: 'button', class: 'vl-efeitos-filtro', texto: '☆ Favoritos', title: 'Mostrar só favoritos', 'aria-pressed': 'false' });
          const tituloLista = el('strong', { class: 'vl-efeitos-contagem' });
          const estado = el('div', { class: 'vl-efeitos-estado', role: 'status' });
          const lista = el('div', { class: 'vl-efeitos-lista', role: 'region', 'aria-label': 'Catálogo de efeitos e handitems' });
          const grade = el('div', { class: 'vl-efeitos-grade' });
          const rodape = el('div', { class: 'vl-efeitos-rodape' });
          lista.append(grade, rodape);

          function urlDaPrevia(id, tipo, acao) {
            const base = 'https://api.habblet.radiohabblet.com.br/api/v1/avatar?figure=' + encodeURIComponent(figura)
              + '&direction=2&head_direction=2&img_format=gif';
            return base + (id ? (tipo === 'efeitos' ? '&effect=' + id : '&action=' + encodeURIComponent((acao || 'crr') + '=' + id)) : '');
          }
          function urlReserva(id, tipo, acao) {
            const base = 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(figura)
              + '&direction=2&head_direction=2&gesture=std&img_format=png';
            return base + (id ? (tipo === 'efeitos' ? '&effect=' + id : '&action=' + encodeURIComponent((acao || 'crr') + '=' + id)) : '');
          }
          function cartao(x) {
            const tipo = aba;
            const marcado = favoritos[tipo].includes(x.id);
            const estrela = el('button', { type: 'button', class: 'vl-efeito-estrela' + (marcado ? ' ligada' : ''), texto: marcado ? '★' : '☆', title: marcado ? 'Remover dos favoritos' : 'Adicionar aos favoritos', 'aria-label': (marcado ? 'Remover dos favoritos: ' : 'Adicionar aos favoritos: ') + x.nome });
            estrela.addEventListener('click', function (ev) {
              ev.stopPropagation();
              const favs = favoritos[tipo];
              const pos = favs.indexOf(x.id);
              if (pos >= 0) favs.splice(pos, 1); else favs.push(x.id);
              gravarFavoritos();
              if (soFavoritos) desenhar(false);
              else { estrela.classList.toggle('ligada', pos < 0); estrela.textContent = pos < 0 ? '★' : '☆'; estrela.title = pos < 0 ? 'Remover dos favoritos' : 'Adicionar aos favoritos'; estrela.setAttribute('aria-label', estrela.title + ': ' + x.nome); }
            });
            // O GIF público do efeito 13 é totalmente transparente; represente-o com o avatar esmaecido.
            const invisivel = tipo === 'efeitos' && x.id === 13;
            const idPrevia = invisivel ? 0 : x.id;
            const img = el('img', { alt: '', class: invisivel ? 'vl-efeito-transparente' : '', loading: 'lazy', decoding: 'async' });
            const reserva = urlReserva(idPrevia, tipo, x.acao);
            let etapa = 0;
            img.addEventListener('error', function () {
              if (etapa++ === 0 && raiz.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ tipo: 'visual:previa', categoria: tipo, id: idPrevia, acao: x.acao || 'crr' })
                  .then(function (r) { img.src = r && r.ok && r.url ? r.url : reserva; })
                  .catch(function () { img.src = reserva; });
              } else if (img.src !== reserva) img.src = reserva;
              else img.hidden = true;
            });
            img.src = urlDaPrevia(idPrevia, tipo, x.acao);
            const selecionado = x.id > 0 && x.id === (tipo === 'efeitos' ? ultimoEfeito : ultimoHanditem);
            const cartaoEl = el('div', { class: 'vl-efeito' + (selecionado ? ' selecionado' : ''), role: 'button', tabindex: '0', 'aria-label': x.nome + ', ID ' + x.id, 'aria-pressed': selecionado ? 'true' : 'false', title: x.nome + ' · ' + (tipo === 'efeitos' ? ':enable ' : ':handitem ') + x.id }, [
              el('div', { class: 'vl-efeito-imagem' }, [img, el('span', { class: 'vl-efeito-num', texto: '#' + x.id }), estrela]),
              el('div', { class: 'vl-efeito-info' }, [
                el('span', { class: 'vl-efeito-nome', texto: x.nome }),
              ]),
            ]);
            function usar() {
              if (!exigir()) return;
              if (tipo === 'efeitos') ultimoEfeito = x.id; else ultimoHanditem = x.id;
              mandarComando((tipo === 'efeitos' ? ':enable ' : ':handitem ') + x.id);
              for (const outro of grade.querySelectorAll('.vl-efeito')) { outro.classList.remove('selecionado'); outro.setAttribute('aria-pressed', 'false'); }
              if (x.id > 0) { cartaoEl.classList.add('selecionado'); cartaoEl.setAttribute('aria-pressed', 'true'); }
              atualizarEstado();
              camada.aviso((tipo === 'efeitos' ? 'Efeito: ' : 'Item de mão: ') + x.nome + ' (' + x.id + ').');
            }
            cartaoEl.addEventListener('click', usar);
            cartaoEl.addEventListener('keydown', function (ev) { if (ev.target === cartaoEl && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); usar(); } });
            return cartaoEl;
          }
          function proximoLote() {
            if (exibidos >= visiveis.length) return;
            const fim = Math.min(visiveis.length, exibidos + 48);
            for (; exibidos < fim; exibidos++) grade.appendChild(cartao(visiveis[exibidos]));
            rodape.textContent = exibidos < visiveis.length ? 'Role para ver mais · ' + exibidos + ' de ' + visiveis.length : visiveis.length + ' itens';
          }
          function atualizarEstado() {
            const id = aba === 'efeitos' ? ultimoEfeito : ultimoHanditem;
            const escolha = id > 0 && listas[aba].find((x) => x.id === id);
            estado.textContent = escolha ? 'Último usado: ' + escolha.nome + ' · #' + id : 'Escolha um cartão para usar no avatar';
          }
          function desenhar(reiniciarRolagem = true) {
            manter.checked = !!opcoesVisual[aba === 'efeitos' ? 'manterEfeito' : 'manterHanditem'];
            sempre.checked = !!opcoesVisual[aba === 'efeitos' ? 'sempreManterEfeito' : 'sempreManterHanditem'];
            bE.classList.toggle('ativa', aba === 'efeitos');
            bI.classList.toggle('ativa', aba === 'itens');
            bE.setAttribute('aria-selected', aba === 'efeitos' ? 'true' : 'false');
            bI.setAttribute('aria-selected', aba === 'itens' ? 'true' : 'false');
            fav.classList.toggle('ativa', soFavoritos);
            fav.textContent = soFavoritos ? '★ Favoritos' : '☆ Favoritos';
            fav.setAttribute('aria-pressed', soFavoritos ? 'true' : 'false');
            const q = String(busca.value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            visiveis = listas[aba].filter(function (x) {
              const nome = x.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
              return (!soFavoritos || favoritos[aba].includes(x.id)) && (!q || nome.includes(q) || String(x.id).includes(q));
            });
            tituloLista.textContent = visiveis.length + ' de ' + listas[aba].length + ' ' + (aba === 'efeitos' ? 'efeitos' : 'itens de mão');
            atualizarEstado();
            exibidos = 0;
            grade.replaceChildren();
            if (reiniciarRolagem) lista.scrollTop = 0;
            if (visiveis.length) proximoLote();
            else rodape.textContent = soFavoritos ? 'Nenhum favorito encontrado.' : 'Nenhum item encontrado.';
          }
          bE.addEventListener('click', function () { aba = 'efeitos'; desenhar(); });
          bI.addEventListener('click', function () { aba = 'itens'; desenhar(); });
          fav.addEventListener('click', function () { soFavoritos = !soFavoritos; desenhar(); });
          lista.addEventListener('scroll', function () { if (lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 240) proximoLote(); });
          busca.addEventListener('input', function () { desenhar(); });
          busca.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
          manter.addEventListener('change', function () {
            const chave = aba === 'efeitos' ? 'manterEfeito' : 'manterHanditem';
            opcoesVisual[chave] = manter.checked;
            ctx.alterar('visual', { [chave]: manter.checked }).catch(function () { opcoesVisual[chave] = !opcoesVisual[chave]; desenhar(false); camada.aviso('Não deu para salvar esta opção.', { tipo: 'erro' }); });
          });
          sempre.addEventListener('change', function () {
            const chave = aba === 'efeitos' ? 'sempreManterEfeito' : 'sempreManterHanditem';
            opcoesVisual[chave] = sempre.checked;
            if (sempre.checked) agendarVisual(aba, 0, true);
            ctx.alterar('visual', { [chave]: sempre.checked }).catch(function () { opcoesVisual[chave] = !opcoesVisual[chave]; desenhar(false); camada.aviso('Não deu para salvar esta opção.', { tipo: 'erro' }); });
          });
          const ajuda = el('button', { type: 'button', class: 'vl-efeitos-ajuda', texto: '?', title: 'Ajuda', 'aria-label': 'Ajuda' });
          ajuda.addEventListener('click', function () { camada.dialogo({ titulo: 'Efeitos e handitems', texto: 'As prévias animadas usam um avatar de exemplo. Busque pelo nome ou ID, clique em um cartão para usar no seu avatar e marque a estrela para salvar um favorito. Os interruptores valem para a aba selecionada: o primeiro reaplica a escolha ao entrar em outro quarto; o segundo reaplica quando o jogo informar que ela foi removida. Alguns itens e efeitos podem não estar liberados para sua conta.' }); });
          const cabecalho = el('div', { class: 'vl-efeitos-cabecalho' }, [el('div', {}, [el('strong', { texto: 'Efeitos e itens de mão' }), estado]), ajuda]);
          const opcoes = el('details', { class: 'vl-efeitos-opcoes' }, [
            el('summary', { texto: 'Permanência da escolha' }),
            el('div', { class: 'vl-efeitos-opcoes-corpo' }, [
              el('label', { class: 'vl-efeitos-chave' }, [el('span', { texto: 'Manter ao trocar de quarto' }), manter]),
              el('label', { class: 'vl-efeitos-chave' }, [el('span', { texto: 'Reaplicar se for removido' }), sempre]),
            ]),
          ]);
          const topo = el('div', { class: 'vl-efeitos-topo' }, [abas, el('div', { class: 'vl-efeitos-busca' }, [busca, fav]), opcoes]);
          const faixa = el('div', { class: 'vl-efeitos-faixa' }, [tituloLista]);
          const painel = el('div', { class: 'vl-efeitos-painel' }, [cabecalho, !conexao.disponivel() ? el('p', { class: 'vl-efeitos-alerta', texto: 'Ligue a Conexão do jogo e recarregue o hotel para usar os efeitos e itens.' }) : null, topo, faixa, lista]);
          desenhar();
          alvo.replaceChildren(painel);
          mudarAbaGaleria = function (nova) { aba = nova; desenhar(); };
        }, function () {
          if (ativo) alvo.replaceChildren(el('p', { class: 'vl-vazio', texto: 'Não deu para ler a lista de nomes do jogo agora. Tente de novo.' }));
        });
        return function () { ativo = false; mudarAbaGaleria = null; };
      }
      function abrirLista(abaInicial) {
        abaGaleria = abaInicial === 'itens' ? 'itens' : 'efeitos';
        if (mudarAbaGaleria) mudarAbaGaleria(abaGaleria);
        ctx.emitir('painel:abrir', { aba: 'efeitos-itens' });
      }
      ctx.aba({ id: 'efeitos-itens', titulo: 'Efeitos e itens', ordem: 2, montar: montarLista });
      ctx.comando({ nome: 'efeitos', uso: 'efeitos', descricao: 'Abre a lista de efeitos com nomes, busca e favoritos. Clique para usar.', executar() { abrirLista('efeitos'); } });
      ctx.comando({ nome: 'handitens', apelidos: ['itensdemao'], uso: 'handitens', descricao: 'Abre a lista de itens de mão com nomes, busca e favoritos. Clique para segurar.', executar() { abrirLista('itens'); } });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
