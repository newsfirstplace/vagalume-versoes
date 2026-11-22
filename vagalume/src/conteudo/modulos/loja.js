// Vagalume — módulo "loja": loja e inventário. Liberado pelo usuário em 2026-11-13, inclusive as
// partes que gastam moedas ou apagam mobis; toda compra em lote e toda exclusão pedem confirmação
// com quantidade e preço. Depende do adaptador de conexão.
// Conferido ao vivo: índice (1195/1032) e páginas (412/804) da loja, compra (3492/869) e inventário
// (3150/994). Lido no código do cliente e NÃO testado: a exclusão definitiva (380), barrada pela
// checagem de segurança da sessão de teste por ser irreversível.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.conexao || !VL.codigos || !VL.jogo) return;
  const { nucleo, camada, conexao, codigos, jogo } = VL;
  const texto = VL.texto;
  const { SAIDA, ENTRADA } = codigos;
  // Páginas de wired da loja do Habblet (rótulos vistos no índice em 2026-11-13).
  const PAGINAS_WIRED = new Set(['Ativadores', 'Efeitos', 'Condições', 'Seletores', 'Add-ons', 'Wired Variáveis', 'Extras Variáveis']);
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  nucleo.definirModulo({
    id: 'loja',
    iniciar(ctx) {
      const inventario = new Map(); // id -> item
      let recebendo = null;
      const ofertas = new Map();    // classe -> oferta (a última vista numa página da loja)
      const ofertasPorChave = new Map(); // 'página:oferta' -> oferta
      const classesWired = new Set();
      const paginasWired = new Set();
      const esperas = { indice: [], pagina: new Map(), compra: [] };
      const ultimaReposicao = new Map(); // classe -> quando
      let indiceVisto = null;           // páginas do último índice da loja (1032)
      const avisadosSemPreco = new Set(); // classes sem oferta conhecida já avisadas nesta aba

      // Ofertas vistas na loja ficam guardadas neste navegador (só número da página, da oferta, nome e
      // preço), para o "repor sozinho" funcionar depois de recarregar sem abrir a loja de novo.
      const CHAVE_VISTAS = 'vl.ofertasVistas';
      const MAX_VISTAS = 3000;
      let vistasMudou = false;
      try {
        const salvas = JSON.parse(localStorage.getItem(CHAVE_VISTAS) || '{}');
        for (const k of Object.keys(salvas)) {
          const v = salvas[k];
          if (!v || typeof v !== 'object') continue;
          const classe = Number(k);
          const o = { id: Number(v.o), pagina: Number(v.p), nome: String(v.n || ''), moedas: Number(v.m) || 0, pontos: Number(v.pt) || 0, tipoPontos: Number(v.tp) || 0, pacote: v.pc === true };
          if (!Number.isFinite(classe) || !Number.isFinite(o.id) || !Number.isFinite(o.pagina)) continue;
          ofertas.set(classe, o);
          if (v.w === true) classesWired.add(classe);
        }
      } catch (erro) { /* sem armazenamento: só vale o que for visto nesta aba */ }
      function guardarVistas() {
        if (!vistasMudou) return;
        vistasMudou = false;
        const saida = {};
        const classes = [...ofertas.keys()].slice(-MAX_VISTAS);
        for (const c of classes) {
          const o = ofertas.get(c);
          saida[c] = { p: o.pagina, o: o.id, n: o.nome, m: o.moedas, pt: o.pontos, tp: o.tipoPontos, pc: o.pacote === true, w: classesWired.has(c) };
        }
        try { localStorage.setItem(CHAVE_VISTAS, JSON.stringify(saida)); } catch (erro) { /* cheio ou bloqueado */ }
      }

      function contagem() {
        const c = new Map();
        for (const item of inventario.values()) c.set(item.classe, (c.get(item.classe) || 0) + 1);
        return c;
      }
      function nomeDe(classe) { const o = ofertas.get(classe); return o ? o.nome : 'tipo ' + classe; }

      const cancelar = [
        conexao.ouvir('entrada', ENTRADA.INVENTARIO, function (l) {
          const r = codigos.lerInventario(l);
          if (r.indice === 0 || !recebendo) recebendo = [];
          recebendo.push(...r.itens);
          if (r.indice >= r.total - 1) {
            inventario.clear();
            for (const item of recebendo) inventario.set(item.id, item);
            recebendo = null;
            atualizarAba();
          }
        }),
        conexao.ouvir('entrada', ENTRADA.INVENTARIO_ADD, function (l) {
          try { const item = codigos.lerItemInventario(l); inventario.set(item.id, item); atualizarAba(); } catch (erro) { /* formato diferente: a próxima lista corrige */ }
        }),
        conexao.ouvir('entrada', ENTRADA.INVENTARIO_REMOVE, function (l) {
          const id = l.inteiro();
          const item = inventario.get(id);
          inventario.delete(id);
          atualizarAba();
          if (item) talvezRepor(item.classe);
        }),
        conexao.ouvir('entrada', ENTRADA.INVENTARIO_MUDOU, function () { pedirInventario(); }),
        // Na vista do hotel o jogo não responde ao pedido de inventário (visto ao vivo); dentro do quarto, sim.
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { if (!inventario.size) setTimeout(pedirInventario, 1500); }),
        conexao.ouvir('entrada', ENTRADA.INDICE_LOJA, function (l) {
          let paginas;
          try { paginas = codigos.lerIndiceLoja(l); } catch (erro) { return; }
          for (const p of paginas) if (PAGINAS_WIRED.has(p.rotulo)) paginasWired.add(p.id);
          indiceVisto = paginas;
          esperas.indice.splice(0).forEach((fn) => fn(paginas));
        }),
        conexao.ouvir('entrada', ENTRADA.PAGINA_LOJA, function (l) {
          let pagina;
          try { pagina = codigos.lerPaginaLoja(l); } catch (erro) { return; }
          for (const o of pagina.ofertas) {
            ofertasPorChave.set(pagina.id + ':' + o.id, o);
            for (const p of o.produtos) {
              if (p.tipo === 'b') continue;
              ofertas.delete(p.classe); // reinsere no fim: a lista guardada fica com as mais recentes
              ofertas.set(p.classe, o);
              if (paginasWired.has(pagina.id)) classesWired.add(p.classe);
              vistasMudou = true;
            }
          }
          guardarVistas();
          const fn = esperas.pagina.get(pagina.id);
          if (fn) { esperas.pagina.delete(pagina.id); fn(pagina); }
        }),
        conexao.ouvir('entrada', ENTRADA.COMPRA_OK, function () { const fn = esperas.compra.shift(); if (fn) fn(true); }),
        conexao.ouvir('entrada', ENTRADA.COMPRA_ERRO, function () { const fn = esperas.compra.shift(); if (fn) fn(false); }),
        conexao.ouvir('entrada', ENTRADA.COMPRA_NEGADA, function () { const fn = esperas.compra.shift(); if (fn) fn(false); }),
      ];
      ctx.aoParar(function () { cancelar.forEach((fn) => fn()); });

      function pedirInventario() { if (conexao.disponivel()) conexao.enviar(SAIDA.PEDIR_INVENTARIO, []); }
      ctx.aoParar(conexao.aoEstado(function (e) { if (e.conectado) pedirInventario(); }));
      setTimeout(pedirInventario, 1500);

      function comTempo(promessa, ms, valor) { return Promise.race([promessa, esperar(ms).then(() => valor)]); }
      function pedirIndice() {
        const p = new Promise((r) => esperas.indice.push(r));
        conexao.enviar(SAIDA.PEDIR_INDICE_LOJA, [['s', 'NORMAL']]);
        return comTempo(p, 6000, null);
      }
      function pedirPagina(id) {
        const p = new Promise((r) => esperas.pagina.set(id, r));
        conexao.enviar(SAIDA.PEDIR_PAGINA_LOJA, [['i', id], ['i', -1], ['s', 'NORMAL']]);
        return comTempo(p, 6000, null);
      }
      // Uma oferta pelo número (2594 -> 3388), para saber o preço antes de comprar.
      const esperasOferta = [];
      cancelar.push(conexao.ouvir('entrada', ENTRADA.OFERTA, function (l) {
        let of = null;
        try { of = codigos.lerUmaOferta(l, -12345678); } catch (erro) { of = null; }
        const fn = esperasOferta.shift();
        if (fn) fn(of);
      }));
      function pedirOferta(id) {
        const p = new Promise((r) => esperasOferta.push(r));
        conexao.enviar(SAIDA.PEDIR_OFERTA, [['i', id]]);
        return comTempo(p, 5000, null);
      }
      function comprar(compra) {
        const p = new Promise((r) => esperas.compra.push(r));
        mandarCompra(compra);
        return comTempo(p, 8000, false);
      }
      // Compra por tipo de mobi (lista da Construção). Uma confirmação logo de cara, sem esperar preços
      // (pedido do usuário em 2026-11-22: "ao invés de conferir o preço, ir comprando"); depois, para cada
      // tipo, a oferta é pedida (2594 -> 3388, casada pelo tipo do mobi, com novas tentativas) e comprada na
      // hora, só se for paga em moedas e não for pacote. Durante o lote, o aviso de compra (869) e o saldo
      // (3475) não chegam ao jogo: sem som de moedas e sem um balão por compra; a última compra passa.
      // lista: [{ tipo, quantidade }].
      const MAX_TIPOS_COMPRA = 1000, MAX_UNIDADES_COMPRA = 5000;
      let comprandoLote = false;
      // opcoes.pular: rótulo de um terceiro botão (seguir sem comprar). Com ele, Cancelar devolve { cancelado: true }.
      async function comprarTipos(lista, motivo, opcoes) {
        const pular = opcoes && opcoes.pular;
        if (!conexao.disponivel()) { camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' }); return; }
        if (!VL.dadosJogo) return;
        if (comprandoLote) { camada.aviso('Já há uma compra em andamento.', { tipo: 'erro' }); return; }
        if (lista.length > MAX_TIPOS_COMPRA) { camada.aviso('Há mais de ' + MAX_TIPOS_COMPRA + ' tipos de mobi; divida a compra em grupos menores.', { tipo: 'erro' }); return; }
        let d;
        try { d = await VL.dadosJogo.mobis(); } catch (e) { camada.aviso('Não consegui ler os mobis do jogo.', { tipo: 'erro' }); return; }
        const pedidos = new Map(); // tipo -> { f, quantidade }
        for (const item of lista) {
          const f = d.chao.get(item.tipo) || d.parede.get(item.tipo);
          const q = Math.max(1, Math.floor(item.quantidade || 1));
          if (pedidos.has(item.tipo)) pedidos.get(item.tipo).quantidade += q;
          else pedidos.set(item.tipo, { f, quantidade: q });
        }
        const nomeDe = (tipo, p) => (p.f && p.f.nome) || 'tipo ' + tipo;
        // Raros, LTD e mobis sem oferta na loja não entram (pedido do usuário em 2026-11-22: não podem ser
        // comprados e travavam o colar); ficam de fora da cópia.
        let foraDaLoja = 0;
        for (const [tipo, p] of [...pedidos]) {
          if (p.f && p.f.oferta && !codigos.mobiRaro(p.f.classe, p.f.nome)) continue;
          foraDaLoja += p.quantidade;
          pedidos.delete(tipo);
        }
        const notaFora = foraDaLoja ? ' ' + foraDaLoja + (foraDaLoja === 1 ? ' raro, LTD ou fora da loja fica' : ' raros, LTD ou fora da loja ficam') + ' de fora.' : '';
        if (!pedidos.size) { camada.aviso((motivo ? motivo + ' ' : '') + 'Nada disso está à venda.' + notaFora); return; }
        const unidades = [...pedidos.values()].reduce((s, p) => s + p.quantidade, 0);
        if (unidades > MAX_UNIDADES_COMPRA) { camada.aviso('São ' + unidades + ' unidades; o máximo por vez é ' + MAX_UNIDADES_COMPRA + '.', { tipo: 'erro' }); return; }
        const ok = await camada.dialogoMobis({
          titulo: 'Comprar mobis',
          texto: (motivo ? motivo + ' ' : '') + 'Comprar ' + unidades + (unidades === 1 ? ' mobi' : ' mobis') + ' de ' + pedidos.size + (pedidos.size === 1 ? ' tipo' : ' tipos') + '.' + notaFora + ' O Vagalume compra um tipo depois do outro, só os vendidos em moedas.',
          itens: [...pedidos].map(([tipo, p]) => ({ nome: nomeDe(tipo, p), icone: p.f ? VL.dadosJogo.iconeDe(p.f.classe) : null, quantidade: p.quantidade })),
          botoes: pular
            ? [{ rotulo: 'Cancelar', valor: 'cancelar' }, { rotulo: pular, valor: false, foco: true }, { rotulo: 'Comprar', valor: true, destaque: true }]
            : [{ rotulo: 'Cancelar', valor: false, foco: true }, { rotulo: 'Comprar', valor: true, destaque: true }],
        });
        if (pular && ok !== true && ok !== false) return { cancelado: true }; // Cancelar ou Esc
        if (!ok) return;
        comprandoLote = true;
        // Ofertas casadas pelo tipo do mobi (uma resposta atrasada não vai para o tipo errado).
        const ofertas = new Map(); // tipo -> oferta
        let acordar = null;
        const pararOfertas = conexao.ouvir('entrada', ENTRADA.OFERTA, function (l) {
          let of = null;
          try { of = codigos.lerUmaOferta(l, -12345678); } catch (erro) { return; }
          if (!of) return;
          for (const p of of.produtos) if (pedidos.has(p.classe) && !ofertas.has(p.classe)) ofertas.set(p.classe, of);
          if (acordar) acordar();
        });
        const bloqueios = [conexao.bloquear('entrada', ENTRADA.COMPRA_OK), conexao.bloquear('entrada', ENTRADA.SALDO_MOEDAS)];
        const soltar = () => { while (bloqueios.length) bloqueios.pop()(); };
        const falhas = { semOferta: [], outraMoeda: [], pacote: [], recusada: [] };
        let feitas = 0, gasto = 0, tiposFeitos = 0;
        try {
          const comOferta = [...pedidos];
          for (let i = 0; i < comOferta.length; i++) {
            const [tipo, p] = comOferta[i];
            if (!ctx.ativo('loja')) break;
            for (let tentativa = 0; tentativa < 3 && !ofertas.has(tipo); tentativa++) {
              conexao.enviar(SAIDA.PEDIR_OFERTA, [['i', p.f.oferta]]);
              await new Promise(function (r) { if (ofertas.has(tipo)) { r(); return; } acordar = () => { if (ofertas.has(tipo)) r(); }; setTimeout(r, 1500 + tentativa * 1000); });
              acordar = null;
            }
            const of = ofertas.get(tipo);
            if (!of) { falhas.semOferta.push(nomeDe(tipo, p)); continue; }
            if (of.produtos.length !== 1 || of.produtos[0].quantidade !== 1) { falhas.pacote.push(nomeDe(tipo, p)); continue; }
            if (of.pontos > 0) { falhas.outraMoeda.push(nomeDe(tipo, p)); continue; }
            for (let restante = p.quantidade; restante > 0; restante -= 100) {
              const quantidade = Math.min(100, restante);
              if (i === comOferta.length - 1 && restante <= 100) soltar(); // a última compra chega ao jogo: um som só
              if (await comprar({ pagina: -12345678, oferta: of.id, quantidade })) { feitas += quantidade; gasto += (of.moedas || 0) * quantidade; }
              else falhas.recusada.push(nomeDe(tipo, p));
              await esperar(150);
            }
            tiposFeitos++;
            if (tiposFeitos % 5 === 0) camada.aviso('Comprando: ' + feitas + ' de ' + unidades + ' mobis (' + (i + 1) + ' de ' + comOferta.length + ' tipos)…', { duracaoMs: 2500 });
          }
        } finally {
          soltar();
          pararOfertas();
          comprandoLote = false;
        }
        const lista5 = (nomes) => nomes.slice(0, 5).join(', ') + (nomes.length > 5 ? ' e mais ' + (nomes.length - 5) : '');
        const notas = [
          falhas.semOferta.length ? 'sem oferta na loja: ' + lista5(falhas.semOferta) : '',
          falhas.outraMoeda.length ? 'pagos com outra moeda: ' + lista5(falhas.outraMoeda) : '',
          falhas.pacote.length ? 'só vendidos em pacote: ' + lista5(falhas.pacote) : '',
          falhas.recusada.length ? 'recusados pela loja: ' + lista5(falhas.recusada) : '',
        ].filter(Boolean);
        camada.aviso(feitas + ' de ' + unidades + ' mobis comprados (' + gasto.toLocaleString('pt-BR') + ' moedas).' + (notas.length ? ' Ficaram de fora — ' + notas.join('; ') + '.' : ''),
          { tipo: feitas === unidades ? 'ok' : 'erro', duracaoMs: notas.length ? 15000 : undefined });
        return { feitas, unidades };
      }
      // Papel de parede, piso e paisagem: a estampa é a oferta (cada estampa tem a sua na loja). Procura nas
      // páginas da loja de nome parecido a oferta com essa classe e esse extra, e compra uma. Não conferido ao vivo.
      async function comprarDecoracao(classe, valor) {
        if (!conexao.disponivel()) return false;
        const paginas = await pedirIndice();
        if (!paginas) return false;
        const candidatas = paginas.filter((p) => /papel|parede|piso|paisag|espaco|ambiente|wallpaper|floor|landscape/.test(codigos.semAcento(p.rotulo + ' ' + p.nome))).slice(0, 30);
        // Seis páginas por vez (antes uma por uma, com até 6 s de espera cada).
        for (let i = 0; i < candidatas.length; i += 6) {
          const paginasLidas = await Promise.all(candidatas.slice(i, i + 6).map((p) => pedirPagina(p.id)));
          for (const pagina of paginasLidas) {
            if (!pagina) continue;
            const of = pagina.ofertas.find((o) => o.produtos.length === 1 && o.produtos[0].classe === classe && String(o.produtos[0].extra) === String(valor) && !(o.pontos > 0));
            if (of) return comprar({ pagina: pagina.id, oferta: of.id, extra: String(valor), quantidade: 1 });
          }
        }
        return false;
      }
      VL.loja = { comprarTipos, comprarDecoracao };
      ctx.aoParar(function () { if (VL.loja && VL.loja.comprarTipos === comprarTipos) VL.loja = null; });

      // ---------- atalhos de páginas da loja ----------
      // A loja do jogo ignora páginas que chegam sem clique (conferido ao vivo), então o atalho
      // clica nos itens do menu da própria loja, do topo até a página (Utilitários > Wireds > Efeitos).
      function itemDaLoja(loja, rotulo) {
        const alvo = codigos.semAcento(rotulo);
        // Só itens visíveis: a busca da BANANA guarda listas escondidas com os mesmos nomes.
        return [...loja.querySelectorAll('.cursor-pointer')].find((e) => e.getClientRects().length > 0 && codigos.semAcento(e.textContent) === alvo) || null;
      }
      async function abrirCaminho(caminho) {
        const loja = document.querySelector('.nitro-catalog');
        if (!loja) return 'Abra a loja do jogo e use o comando de novo.';
        for (let i = 0; i < caminho.length; i++) {
          if (!loja.isConnected) return 'A loja foi fechada.';
          // Se o próximo nível já aparece, este já está aberto: clicar de novo fecharia.
          if (i < caminho.length - 1 && itemDaLoja(loja, caminho[i + 1])) continue;
          const item = itemDaLoja(loja, caminho[i]);
          if (!item) return 'Não achei "' + caminho[i] + '" no menu da loja.';
          item.click();
          // Espera o próximo nível aparecer (a loja pode pedir a página ao servidor).
          for (let t = 0; t < 12 && i < caminho.length - 1 && !itemDaLoja(loja, caminho[i + 1]); t++) await esperar(250);
        }
        return null;
      }
      ctx.comando({
        nome: 'lojapagina',
        apelidos: ['abrirloja'],
        uso: 'lojapagina [nome da página]',
        descricao: 'Abre na loja do jogo a página com esse nome (por exemplo: ativadores, efeitos, condições, seletores). Sem nome, lista as páginas de wired. A loja precisa estar aberta.',
        async executar(pedido) {
          if (!conexao.disponivel()) { camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' }); return; }
          const paginas = indiceVisto || await pedirIndice();
          if (!paginas) { camada.aviso('A loja não respondeu.', { tipo: 'erro' }); return; }
          const termo = pedido.args.join(' ');
          if (!termo) {
            const wired = paginas.filter((p) => PAGINAS_WIRED.has(p.rotulo) || /wired/i.test(p.rotulo));
            camada.dialogo({ titulo: 'Páginas de wired', texto: 'Use /lojapagina <nome> com a loja aberta.', detalhe: wired.map((p) => p.rotulo + (p.pai ? '  (em ' + p.pai + ')' : '')).join('\n') || 'Nenhuma página com wired no nome.' });
            return;
          }
          const achadas = codigos.acharPaginasLoja(paginas, termo).filter((p) => p.ofertas > 0 || p.id > 0);
          if (!achadas.length) { camada.aviso('Nenhuma página da loja com esse nome.', { tipo: 'erro' }); return; }
          const p = achadas[0];
          const erro = await abrirCaminho(codigos.caminhoPaginaLoja(paginas, p));
          if (erro) { camada.aviso(erro, { tipo: 'erro' }); return; }
          if (achadas.length > 1) camada.aviso('Abri "' + p.rotulo + '". Outras com esse nome: ' + achadas.slice(1, 6).map((x) => x.rotulo).join(', ') + '.');
        },
      });

      // ---------- carrinho ----------
      // Com o carrinho ligado, o "Comprar" da loja do jogo não chega ao servidor: a compra entra na
      // lista. "Comprar tudo" desliga o carrinho e manda as compras uma a uma, depois de confirmar.
      const carrinho = [];
      let pararCarrinho = null;
      function carrinhoLigado() { return !!pararCarrinho; }
      function ligarCarrinho() {
        if (pararCarrinho) return;
        const desbloquear = conexao.bloquear('saida', SAIDA.COMPRAR);
        const deixarDeOuvir = conexao.ouvir('saida', SAIDA.COMPRAR, function (l) {
          let c;
          try { c = codigos.lerCompra(l); } catch (erro) { return; }
          const o = ofertasPorChave.get(c.pagina + ':' + c.oferta);
          carrinho.push(Object.assign(c, o ? { nome: o.nome, moedas: o.moedas, pontos: o.pontos, tipoPontos: o.tipoPontos } : { nome: 'oferta ' + c.oferta, moedas: null }));
          camada.aviso('No carrinho: ' + (c.quantidade > 1 ? c.quantidade + '× ' : '') + c.nome + '. Itens: ' + carrinho.length + '. Use /carrinho comprar para levar tudo.');
        });
        pararCarrinho = function () { desbloquear(); deixarDeOuvir(); };
      }
      function desligarCarrinho() { if (pararCarrinho) { pararCarrinho(); pararCarrinho = null; } }
      ctx.aoParar(desligarCarrinho);
      ctx.aoParar(conexao.aoEstado(function (e) { if (!e.conectado) desligarCarrinho(); }));

      // ---------- confirmar compras com outra moeda (diamantes e afins) ----------
      // Com a opção ligada, o "Comprar" do jogo (3492) é segurado. Se a oferta, vista na página da
      // loja, custa algo além de moedas, o Vagalume pergunta antes de mandar; só moedas, ou oferta
      // ainda não vista, vai na hora. As compras da próprio Vagalume passam direto (forcar).
      const proprias = new Map(); // chave da compra -> quantas compras do Vagalume ainda vão passar pelo ouvinte
      function chaveCompra(c) { return [c.pagina, c.oferta, c.extra || '', c.quantidade].join(':'); }
      let pararConfirmar = null;
      function mandarCompra(c) {
        if (pararConfirmar) { const k = chaveCompra(c); proprias.set(k, (proprias.get(k) || 0) + 1); }
        return conexao.enviar(SAIDA.COMPRAR, [['i', c.pagina], ['i', c.oferta], ['s', c.extra || ''], ['i', c.quantidade]], { forcar: true });
      }
      // Quanto o usuário tem da moeda: a carteira do jogo mostra o ícone "<tipo>.png" ao lado do saldo.
      function saldoDaMoeda(tipo) {
        for (const icone of document.querySelectorAll('.nitro-purse .nitro-currency-icon')) {
          const img = getComputedStyle(icone).backgroundImage || '';
          if (new RegExp('/' + tipo + '\\.(png|gif)').test(img)) {
            const linha = icone.parentElement;
            const texto = linha ? linha.textContent.trim() : '';
            if (texto) return texto;
          }
        }
        return null;
      }
      // Tipo 5 = diamantes (ícone azul da carteira; conferido na loja, seção Diamantes, em 2026-11-14).
      function nomeDaMoeda(tipo) { return tipo === 5 ? 'diamantes' : 'da moeda especial (tipo ' + tipo + ')'; }
      // Preço do item escolhido na loja do jogo: '.item-price' com o ícone '<tipo>.png' (-1 = moedas).
      function precoNaTela() {
        const r = { nome: 'este item', moedas: 0, pontos: 0, tipoPontos: 0 };
        const nome = document.querySelector('.nitro-catalog .catalog-product-name, .nitro-catalog .fw-bold');
        if (nome && nome.textContent.trim()) r.nome = nome.textContent.trim();
        for (const preco of document.querySelectorAll('.nitro-catalog .item-price')) {
          const icone = preco.querySelector('.nitro-currency-icon');
          const m = icone ? /\/(-?\d+)\.(png|gif)/.exec(getComputedStyle(icone).backgroundImage || '') : null;
          const valor = Number(String(preco.textContent || '').replace(/\D/g, '')) || 0;
          if (!m) continue;
          if (Number(m[1]) === -1) r.moedas = valor; else { r.pontos = valor; r.tipoPontos = Number(m[1]); }
        }
        return r.pontos > 0 || r.moedas > 0 ? r : null;
      }
      function aplicarConfirmar() {
        const quer = ctx.secao().confirmarOutraMoeda === true;
        if (quer && !pararConfirmar) {
          const desbloquear = conexao.bloquear('saida', SAIDA.COMPRAR);
          const deixarDeOuvir = conexao.ouvir('saida', SAIDA.COMPRAR, async function (l) {
            let c;
            try { c = codigos.lerCompra(l); } catch (erro) { return; }
            const k = chaveCompra(c);
            const n = proprias.get(k) || 0;
            if (n > 0) { if (n === 1) proprias.delete(k); else proprias.set(k, n - 1); return; }
            if (carrinhoLigado()) return; // o carrinho guarda a compra
            // Oferta não vista (ex.: resultado de busca): usa o preço que a loja mostra na tela.
            const o = ofertasPorChave.get(c.pagina + ':' + c.oferta) || precoNaTela();
            if (!o || !(o.pontos > 0)) { mandarCompra(c); return; }
            const saldo = saldoDaMoeda(o.tipoPontos);
            const total = o.pontos * c.quantidade;
            const ok = await camada.confirmar((c.quantidade > 1 ? c.quantidade + '× ' : '') + o.nome + ' custa ' + total + ' ' + nomeDaMoeda(o.tipoPontos) + (saldo ? ' (você tem ' + saldo + ')' : '') + (o.moedas ? ' e ' + o.moedas * c.quantidade + ' moedas' : '') + '. Comprar?', { titulo: 'Compra com outra moeda', sim: 'Comprar' });
            if (ok) mandarCompra(c);
            else camada.aviso('Compra cancelada. Se o botão da loja ficar girando, escolha outro item.');
          });
          pararConfirmar = function () { desbloquear(); deixarDeOuvir(); proprias.clear(); };
        } else if (!quer && pararConfirmar) { pararConfirmar(); pararConfirmar = null; }
      }
      aplicarConfirmar();
      ctx.aoConfig(function (secao) { if (secao === 'loja') aplicarConfirmar(); });
      ctx.aoParar(function () { if (pararConfirmar) pararConfirmar(); pararConfirmar = null; });
      function textoPreco(r) {
        const partes = [r.moedas + ' moedas'];
        for (const [tipo, total] of r.pontos) partes.push(total + ' ' + (tipo === 5 ? 'diamantes' : 'pontos do tipo ' + tipo));
        return partes.join(', ') + (r.desconhecidos ? ' e ' + r.desconhecidos + ' itens sem preço conhecido' : '');
      }
      function mostrarCarrinho() {
        if (!carrinho.length) {
          camada.aviso(carrinhoLigado() ? 'Carrinho ligado e vazio: o "Comprar" da loja agora junta os itens aqui.' : 'Carrinho vazio e desligado. Use /carrinho ligar.');
          return;
        }
        camada.dialogo({
          titulo: 'Carrinho: ' + carrinho.length + ' itens',
          texto: 'Pelo preço de lista: ' + textoPreco(codigos.resumoCarrinho(carrinho)) + '. ' + (carrinhoLigado() ? 'O carrinho está ligado.' : 'O carrinho está desligado; os itens ficam guardados até você comprar ou limpar.'),
          detalhe: carrinho.map((c, i) => (i + 1) + '. ' + c.quantidade + '× ' + c.nome + (c.moedas != null ? ' · ' + c.moedas + ' moedas' + (c.pontos ? ' + ' + c.pontos : '') + ' cada' : '')).join('\n'),
        });
      }
      async function comprarCarrinho() {
        if (!carrinho.length) { camada.aviso('O carrinho está vazio.'); return; }
        if (comprando) { camada.aviso('Já há uma compra em andamento.'); return; }
        if (!conexao.disponivel()) { camada.aviso('Sem conexão com o jogo.', { tipo: 'erro' }); return; }
        const ok = await camada.confirmar('Comprar os ' + carrinho.length + ' itens do carrinho? Pelo preço de lista: ' + textoPreco(codigos.resumoCarrinho(carrinho)) + '.', { titulo: 'Comprar tudo', sim: 'Comprar' });
        if (!ok) return;
        desligarCarrinho();
        comprando = true;
        const falhas = [];
        let feitas = 0;
        try {
          for (const c of carrinho.splice(0)) {
            if (!ctx.ativo('loja')) { falhas.push(c); continue; }
            if (await comprar(c)) feitas++; else falhas.push(c);
            await esperar(400);
          }
        } finally { comprando = false; }
        carrinho.push(...falhas);
        camada.aviso(feitas + ' compras feitas; o carrinho foi desligado.' + (falhas.length ? ' ' + falhas.length + ' não deram (saldo, esgotado ou erro) e ficaram no carrinho.' : ''), { tipo: falhas.length ? 'erro' : 'ok' });
      }
      ctx.comando({
        nome: 'carrinho',
        uso: 'carrinho [ligar|desligar|comprar|limpar]',
        descricao: 'Com o carrinho ligado, o botão Comprar da loja junta os itens em vez de comprar. "comprar" leva tudo de uma vez, depois de confirmar o total.',
        executar(pedido) {
          const acao = (pedido.args[0] || '').toLowerCase();
          if (acao === 'ligar') {
            if (!conexao.disponivel()) { camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' }); return; }
            ligarCarrinho();
            camada.aviso('Carrinho ligado: o botão Comprar da loja agora junta os itens aqui. A loja do jogo pode ficar esperando resposta; feche e abra a página do item se precisar.');
            return;
          }
          if (acao === 'desligar') { desligarCarrinho(); camada.aviso('Carrinho desligado. ' + (carrinho.length ? carrinho.length + ' itens continuam guardados.' : '')); return; }
          if (acao === 'limpar') { carrinho.length = 0; camada.aviso('Carrinho limpo.'); return; }
          if (acao === 'comprar') return comprarCarrinho();
          mostrarCarrinho();
        },
      });

      // ---------- comprar wireds até a meta ----------
      let comprando = false;
      async function comprarWireds(meta) {
        if (comprando) { camada.aviso('Já há uma compra em andamento.'); return; }
        comprando = true;
        try {
          camada.aviso('Lendo as páginas de wired da loja…');
          const indice = await pedirIndice();
          if (!indice) { camada.aviso('A loja não respondeu.', { tipo: 'erro' }); return; }
          const paginas = indice.filter((p) => PAGINAS_WIRED.has(p.rotulo));
          const todas = [];
          for (const p of paginas) {
            const pagina = await pedirPagina(p.id);
            if (pagina) todas.push(...pagina.ofertas);
            await esperar(300);
          }
          const plano = codigos.planoDeCompra(todas, contagem(), meta);
          if (!plano.length) { camada.aviso('Você já tem pelo menos ' + meta + ' de cada wired.'); return; }
          const unidades = plano.reduce((s, c) => s + c.quantidade, 0);
          const moedas = plano.reduce((s, c) => s + c.moedas, 0);
          const ok = await camada.confirmar(
            'Comprar ' + unidades + ' wireds (' + plano.length + ' compras) por ' + moedas.toLocaleString('pt-BR') + ' moedas, para ter ' + meta + ' de cada um dos ' + todas.length + ' tipos da loja?',
            { titulo: 'Comprar wireds', sim: 'Comprar', detalhe: plano.slice(0, 60).map((c) => c.quantidade + '× ' + c.nome + ' — ' + c.moedas + ' moedas').join('\n') + (plano.length > 60 ? '\n…' : '') });
          if (!ok) return;
          let feitas = 0;
          for (const compra of plano) {
            if (!ctx.ativo('loja')) break;
            if (!(await comprar(compra))) { camada.aviso('A loja recusou ' + compra.nome + '. Parei depois de ' + feitas + ' compras.', { tipo: 'erro' }); return; }
            feitas++;
            if (feitas % 10 === 0) camada.aviso(feitas + ' de ' + plano.length + ' compras feitas…');
            await esperar(800);
          }
          camada.aviso('Pronto: ' + feitas + ' compras feitas.', { tipo: 'ok' });
          pedirInventario();
        } finally {
          comprando = false;
        }
      }

      // ---------- repor quando acaba ----------
      function talvezRepor(classe) {
        const o = ctx.secao();
        if (!o.repor || comprando) return;
        const oferta = ofertas.get(classe);
        if (!oferta) {
          // Sem a página vista: a oferta vem do arquivo de mobis do jogo (offerid) e a compra vai como a
          // da busca da loja (página -12345678). Corrigido em 2026-11-15 (o repor falhava muito).
          const resta0 = contagem().get(classe) || 0;
          if (resta0 > o.reporLimite || (o.reporSoWired && !classesWired.has(classe))) return;
          const agora0 = Date.now();
          if (agora0 - (ultimaReposicao.get(classe) || 0) < 10000) return;
          ultimaReposicao.set(classe, agora0);
          if (!VL.dadosJogo) return;
          VL.dadosJogo.mobis().then(function (d) {
            const f = d.chao.get(classe) || d.parede.get(classe);
            if (!f || !f.oferta) {
              if (!avisadosSemPreco.has(classe)) { avisadosSemPreco.add(classe); camada.aviso('Repor: o tipo ' + classe + ' não tem oferta na loja do jogo.'); }
              return;
            }
            if (o.reporSemTeleporte && /tele/i.test(f.nome)) return;
            // Confere o preço antes: só compra se a oferta for em moedas (nunca diamantes ou outra moeda).
            return pedirOferta(f.oferta).then(function (of) {
              if (!of) { camada.aviso('Repor: a loja não respondeu sobre ' + f.nome + '.', { tipo: 'erro' }); return; }
              if (of.pontos > 0 || !(of.moedas > 0)) return;
              // Conferido ao vivo em 2026-11-15: a compra pela busca (página -12345678) aceita o número que o
              // PRODUCT_OFFER devolve (of.id), não o offerid do arquivo de mobis.
              return comprar({ pagina: -12345678, oferta: of.id, quantidade: 1 }).then(function (ok) {
                camada.aviso(ok ? 'Reposto: 1× ' + f.nome + ' (' + of.moedas + ' moedas).' : 'Não deu para repor ' + f.nome + '. Abra a página dele na loja uma vez e o Vagalume tenta de novo por lá.', { tipo: ok ? 'ok' : 'erro' });
              });
            });
          }, function () {});
          return;
        }
        if (oferta.pontos > 0) return; // só o que se paga com moedas
        if (o.reporSoWired && !classesWired.has(classe)) return;
        if (o.reporSemTeleporte && /tele/i.test(oferta.nome)) return;
        const resta = contagem().get(classe) || 0;
        if (resta > o.reporLimite) return;
        const agora = Date.now();
        if (agora - (ultimaReposicao.get(classe) || 0) < 10000) return;
        ultimaReposicao.set(classe, agora);
        const quantidade = oferta.pacote ? o.reporQuantidade : 1;
        comprar({ pagina: oferta.pagina, oferta: oferta.id, quantidade }).then(function (ok) {
          camada.aviso(ok ? 'Reposto: ' + quantidade + '× ' + oferta.nome + '.' : 'Não deu para repor ' + oferta.nome + '.', { tipo: ok ? 'ok' : 'erro' });
        });
      }

      // ---------- quantidade padrão e confirmação de compra (tela da loja) ----------
      ctx.escutar(window, 'click', function (ev) {
        if (!ev.isTrusted || !ev.target || typeof ev.target.closest !== 'function') return;
        const loja = ev.target.closest('.nitro-catalog');
        if (!loja) return;
        const o = ctx.secao();
        if (o.quantidadePadrao > 1) {
          setTimeout(function () {
            const campo = loja.querySelector('input.quantity-input');
            if (campo && campo.value === '1' && document.activeElement !== campo) jogo.definirValor(campo, String(o.quantidadePadrao));
          }, 300);
        }
        // Pular confirmação (corrigido em 2026-11-15, print do usuário): a caixa do jogo é uma janela à
        // parte, ".nitro-card" com o título "Confirmar compra", fora da loja, com "Desistir" e "Comprar"
        // (.btn-success). Depois do "Comprar" da loja, espera essa caixa e clica no "Comprar" dela.
        if (o.pularConfirmacao && ev.target.closest('.btn-success') && !ev.target.closest('.vl-confirmada')) {
          let tentativas = 0;
          const relogio = setInterval(function () {
            tentativas++;
            const caixa = [...document.querySelectorAll('.nitro-card')].find(function (c) {
              const titulo = c.querySelector('.nitro-card-header');
              return c !== loja && titulo && /confirmar compra/i.test(titulo.textContent || '') && c.getClientRects().length;
            });
            const botao = caixa && ([...caixa.querySelectorAll('.btn-success, button')].find((b) => /^comprar$/i.test(String(b.textContent || '').trim())) || caixa.querySelector('.btn-success'));
            if (botao || tentativas > 25) {
              clearInterval(relogio);
              if (botao && !botao.disabled) { caixa.classList.add('vl-confirmada'); botao.click(); }
            }
          }, 80);
        }
      }, true);

      // ---------- aba "Inventário": contagem e exclusão em massa ----------
      const el = camada.el;
      let corpoAba = null;
      const marcados = new Set();
      // Aba refeita (pedido do usuário em 2026-11-15): cada tipo com imagem, nome e quantidade, busca,
      // seleção por clique no cartão. Nomes e ícones vêm dos dados de mobis do próprio jogo.
      let dadosMobis = null;
      let buscaInv = '';
      let filtroInv = 'todos';
      // Filtros da aba (pedido do usuário em 2026-11-15). O arquivo de mobis do Habblet não preenche
      // categoria nem "raro" (conferido: todos "unknown" e false), então a divisão é pelo nome técnico,
      // pelo nome e pelo que o jogo diz do mobi (sentar, deitar, parede, vendável na Feira Livre).
      const FILTROS_INV = [
        { id: 'todos', rotulo: 'Todos', testa: () => true },
        { id: 'wired', rotulo: 'Wired', testa: (g, d) => /^wf_/i.test(d ? d.classe : '') || /wired/i.test(g.nome) },
        { id: 'ltd', rotulo: 'LTD', testa: (g, d) => /(?:^|[_-])ltd(?:\d|[_-]|$)/i.test(d ? d.classe : '') || /\bltd\b/i.test(g.nome) },
        { id: 'chao', rotulo: 'Chão', testa: (g) => g.chao },
        { id: 'parede', rotulo: 'Parede', testa: (g) => !g.chao },
        { id: 'raros', rotulo: 'Raros', testa: (g, d) => g.vendavel || codigos.mobiRaro(d ? d.classe : '', g.nome) },
        { id: 'sentar', rotulo: 'Cadeiras', testa: (g, d) => !!(d && d.sentar) },
        { id: 'deitar', rotulo: 'Camas', testa: (g, d) => !!(d && d.deitar) },
        { id: 'roupas', rotulo: 'Roupas', testa: (g, d) => /^clothing_/i.test(d ? d.classe : '') },
        { id: 'outros', rotulo: 'Outros', testa: (g, d) => !FILTROS_INV.filter((f) => !['todos', 'chao', 'parede', 'outros'].includes(f.id)).some((f) => f.testa(g, d)) },
      ];
      function filtroAtual() { return FILTROS_INV.find((f) => f.id === filtroInv) || FILTROS_INV[0]; }
      let filtrosEl = null;
      function dadosDe(classe, chao) {
        if (!dadosMobis) return null;
        return (chao === false ? dadosMobis.parede.get(classe) : dadosMobis.chao.get(classe)) || dadosMobis.chao.get(classe) || dadosMobis.parede.get(classe) || null;
      }
      function nomeBonito(classe, chao) {
        const d = dadosDe(classe, chao);
        return (d && d.nome) || nomeDe(classe) || ('Mobi ' + classe);
      }
      function grupos() {
        const mapa = new Map();
        for (const item of inventario.values()) {
          const g = mapa.get(item.classe) || { classe: item.classe, chao: item.chao !== false, n: 0, vendavel: false };
          g.n += 1;
          if (item.vendavel) g.vendavel = true;
          mapa.set(item.classe, g);
        }
        return [...mapa.values()];
      }
      let ultimosVisiveis = [];
      // Marca todos os tipos que aparecem agora (com o filtro e a busca); se já estão todos marcados, desmarca.
      function selecionarTudo() {
        if (!ultimosVisiveis.length) { camada.aviso('Nada para marcar com esse filtro.'); return; }
        const todosMarcados = ultimosVisiveis.every((g) => marcados.has(g.classe));
        for (const g of ultimosVisiveis) { if (todosMarcados) marcados.delete(g.classe); else marcados.add(g.classe); }
        atualizarAba();
      }
      function atualizarAba() {
        if (!corpoAba || !corpoAba.isConnected) return;
        const todos = grupos().map((g) => Object.assign(g, { nome: nomeBonito(g.classe, g.chao) }));
        const q = texto.semAcento(buscaInv).trim();
        const filtro = filtroAtual();
        if (filtrosEl) {
          filtrosEl.replaceChildren(...FILTROS_INV.map(function (f) {
            const n = f.id === 'todos' ? todos.length : todos.filter((g) => f.testa(g, dadosDe(g.classe, g.chao))).length;
            if (!n && !['todos', 'wired', 'ltd', 'chao', 'parede', filtroInv].includes(f.id)) return null;
            return el('button', { type: 'button', class: 'vl-filtro', role: 'tab', 'aria-selected': f.id === filtro.id ? 'true' : 'false', texto: f.rotulo + ' (' + n + ')', onclick() { filtroInv = f.id; atualizarAba(); } });
          }).filter(Boolean));
        }
        const visiveis = todos.filter((g) => filtro.testa(g, dadosDe(g.classe, g.chao)) && (!q || texto.semAcento(g.nome).includes(q) || String(g.classe) === q)).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
        ultimosVisiveis = visiveis;
        const totalSel = [...marcados].reduce((s, classe) => s + ((todos.find((g) => g.classe === classe) || {}).n || 0), 0);
        const cartoes = visiveis.slice(0, 400).map(function (g) {
          const d = dadosDe(g.classe, g.chao);
          const img = el('img', { class: 'vl-inv-img', alt: '', loading: 'lazy' });
          const src = d ? VL.dadosJogo.iconeDe(d.classe) : '';
          if (src) img.src = src; else img.hidden = true;
          img.addEventListener('error', function () { img.hidden = true; });
          const cartao = el('button', { type: 'button', class: 'vl-inv' + (marcados.has(g.classe) ? ' marcado' : ''), title: g.nome + ' — tipo ' + g.classe + (d && d.classe ? ' (' + d.classe + ')' : ''), 'aria-pressed': marcados.has(g.classe) ? 'true' : 'false' }, [
            el('span', { class: 'vl-inv-foto' }, [img, el('span', { class: 'vl-inv-qtd', texto: '×' + g.n })]),
            el('span', { class: 'vl-inv-nome', texto: g.nome }),
          ]);
          cartao.addEventListener('click', function () {
            if (marcados.has(g.classe)) marcados.delete(g.classe); else marcados.add(g.classe);
            atualizarAba();
          });
          return cartao;
        });
        corpoAba.replaceChildren(
          el('p', { class: 'vl-nota', texto: (filtro.id === 'todos' ? '' : visiveis.length + ' tipos em ' + filtro.rotulo + ' · ') + inventario.size + ' mobis de ' + todos.length + ' tipos' + (marcados.size ? ' · ' + marcados.size + ' tipos marcados (' + totalSel + ' mobis)' : '') + '. Clique num mobi para marcar.' + (dadosMobis ? '' : ' Carregando nomes e imagens…') }),
          visiveis.length ? el('div', { class: 'vl-inv-grade' }, cartoes) : el('p', { class: 'vl-vazio', texto: inventario.size ? 'Nada com esse nome.' : 'Inventário vazio ou ainda não lido. Clique em Atualizar dentro de um quarto.' }),
        );
        if (botaoTudo) botaoTudo.textContent = visiveis.length && visiveis.every((g) => marcados.has(g.classe)) ? 'Desmarcar todos' : 'Selecionar tudo';
      }
      let botaoTudo = null;
      async function excluirMarcados() {
        if (!marcados.size) { camada.aviso('Marque pelo menos um tipo.'); return; }
        const c = contagem();
        const lista = [...marcados].filter((classe) => c.has(classe));
        const total = lista.reduce((s, classe) => s + c.get(classe), 0);
        const ok = await camada.confirmar(
          'Apagar PARA SEMPRE ' + total + ' mobis de ' + lista.length + ' tipos? Não há como desfazer: eles somem do inventário e não voltam.',
          { titulo: 'Excluir mobis para sempre', sim: 'Apagar para sempre', detalhe: lista.map((classe) => c.get(classe) + '× ' + nomeBonito(classe)).join('\n') });
        if (!ok) return;
        for (const classe of lista) {
          await conexao.enviar(SAIDA.EXCLUIR_DO_INVENTARIO, [['i', 1], ['s', String(classe)]]);
          marcados.delete(classe);
          await esperar(500);
        }
        camada.aviso('Pedido de exclusão enviado para ' + lista.length + ' tipos.');
        pedirInventario();
      }
      ctx.aba({
        id: 'inventario',
        titulo: 'Inventário',
        ordem: 46,
        montar(alvo) {
          corpoAba = el('div', { class: 'vl-inv-corpo' });
          const busca = el('input', { type: 'search', class: 'vl-campo', placeholder: 'Procurar no inventário…', 'aria-label': 'Procurar no inventário' });
          busca.value = buscaInv;
          busca.addEventListener('input', function () { buscaInv = busca.value; atualizarAba(); });
          busca.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
          alvo.replaceChildren(
            el('div', { class: 'vl-inv-barra' }, [
              busca,
              el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Atualizar', onclick() { pedirInventario(); } }),
              (botaoTudo = el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Selecionar tudo', title: 'Marca todos os tipos que aparecem com o filtro e a busca', onclick() { selecionarTudo(); } })),
              el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Limpar seleção', onclick() { marcados.clear(); atualizarAba(); } }),
              el('button', { type: 'button', class: 'vl-botao pequeno perigo', texto: 'Excluir marcados…', onclick() { excluirMarcados(); } }),
            ]),
            (filtrosEl = el('div', { class: 'vl-filtros vl-inv-filtros', role: 'tablist', 'aria-label': 'Filtrar inventário' })),
            corpoAba
          );
          atualizarAba();
          if (!dadosMobis && VL.dadosJogo) VL.dadosJogo.mobis().then(function (d) { dadosMobis = d; atualizarAba(); }, function () { /* sem nomes: fica o tipo */ });
          return function () { corpoAba = null; filtrosEl = null; botaoTudo = null; };
        },
      });

      ctx.comando({
        nome: 'comprarwireds',
        uso: 'comprarwireds [quantidade]',
        descricao: 'Compra o que falta para ter essa quantidade (20 se não disser) de cada wired da loja, depois de confirmar o preço.',
        executar(pedido) {
          if (!conexao.disponivel()) { camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' }); return; }
          const meta = pedido.args[0] == null ? 20 : Number(pedido.args[0]);
          if (!Number.isInteger(meta) || meta < 1 || meta > 100) { camada.aviso('Use um número de 1 a 100.', { tipo: 'erro' }); return; }
          comprarWireds(meta);
        },
      });

      // ---------- Feira Livre ----------
      let feiraConfig = null;
      let minhas = null;
      const esperasFeira = { minhas: [], venda: [], retirada: [] };
      cancelar.push(
        conexao.ouvir('entrada', ENTRADA.FEIRA_CONFIG, function (l) { try { feiraConfig = codigos.lerConfigFeira(l); } catch (erro) { /* formato diferente */ } }),
        conexao.ouvir('entrada', ENTRADA.FEIRA_MINHAS, function (l) {
          try { minhas = codigos.lerMinhasOfertas(l); } catch (erro) { minhas = null; }
          const fn = esperasFeira.minhas.shift(); if (fn) fn(minhas);
        }),
        conexao.ouvir('entrada', ENTRADA.FEIRA_VENDA, function (l) { let ok = false; try { ok = l.inteiro() === 1; } catch (erro) { /* */ } const fn = esperasFeira.venda.shift(); if (fn) fn(ok); }),
        conexao.ouvir('entrada', ENTRADA.FEIRA_RETIRADA, function (l) { let ok = false; try { l.inteiro(); ok = l.booleano(); } catch (erro) { /* */ } const fn = esperasFeira.retirada.shift(); if (fn) fn(ok); }),
      );
      function pedirMinhas() {
        const p = new Promise((r) => esperasFeira.minhas.push(r));
        conexao.enviar(SAIDA.FEIRA_MINHAS, []);
        return comTempo(p, 6000, null);
      }
      function precoValido(preco) {
        if (!Number.isInteger(preco) || preco < 1) return false;
        return !feiraConfig || (preco >= feiraConfig.minimo && preco <= feiraConfig.maximo);
      }
      function faixaDePreco() { return feiraConfig ? ' (de ' + feiraConfig.minimo + ' a ' + feiraConfig.maximo + ' asinhas)' : ''; }
      function vender(item, preco) {
        const p = new Promise((r) => esperasFeira.venda.push(r));
        conexao.enviar(SAIDA.FEIRA_VENDER, [['i', preco], ['i', item.chao ? 1 : 2], ['i', item.id]]);
        return comTempo(p, 8000, false);
      }
      // Espera um item novo daquela classe chegar ao inventário (depois de retirar uma oferta).
      async function itemNovo(classe, antes) {
        for (let i = 0; i < 16; i++) {
          await esperar(500);
          if (i === 4) pedirInventario();
          for (const item of inventario.values()) if (item.classe === classe && !antes.has(item.id)) return item;
        }
        return null;
      }
      let naFeira = false;
      async function repor(id, precoNovo) {
        if (naFeira) { camada.aviso('Já há uma operação na Feira Livre em andamento.'); return; }
        naFeira = true;
        try {
          const lista = await pedirMinhas();
          if (!lista) { camada.aviso('A lista das suas vendas não chegou.', { tipo: 'erro' }); return; }
          const alvo = codigos.ofertasParaRepor(lista.ofertas, id);
          if (!alvo.length) { camada.aviso(id == null ? 'Nenhuma oferta sua para repor.' : 'Essa oferta não está na sua lista ou já foi vendida.'); return; }
          if (precoNovo != null && !precoValido(precoNovo)) { camada.aviso('Preço fora do permitido' + faixaDePreco() + '.', { tipo: 'erro' }); return; }
          const ok = await camada.confirmar(
            'Repor ' + alvo.length + ' oferta(s) na Feira Livre? Cada uma é retirada e posta de novo, com o prazo renovado, ' +
            (precoNovo != null ? 'por ' + precoNovo + ' asinhas.' : 'pelo preço que a sua lista mostra. Confira se esse preço inclui a comissão: isso não foi conferido.'),
            { titulo: 'Feira Livre', sim: 'Repor' });
          if (!ok) return;
          let feitas = 0;
          for (const o of alvo) {
            const preco = precoNovo != null ? precoNovo : o.preco;
            if (!precoValido(preco)) continue;
            const antes = new Set(inventario.keys());
            const p = new Promise((r) => esperasFeira.retirada.push(r));
            conexao.enviar(SAIDA.FEIRA_RETIRAR, [['i', o.oferta]]);
            if (!(await comTempo(p, 8000, false))) continue;
            const item = await itemNovo(o.classe, antes);
            if (!item) { camada.aviso('A oferta ' + o.oferta + ' foi retirada, mas o item não apareceu no inventário. Ele não foi posto de novo.', { tipo: 'erro' }); continue; }
            if (await vender(item, preco)) feitas++;
            await esperar(400);
          }
          camada.aviso(feitas + ' de ' + alvo.length + ' oferta(s) postas de novo.');
        } finally { naFeira = false; }
      }
      async function venderVarios(classe, preco, quantos) {
        if (naFeira) { camada.aviso('Já há uma operação na Feira Livre em andamento.'); return; }
        const doTipo = [...inventario.values()].filter((i) => i.classe === classe);
        const itens = doTipo.filter((i) => i.vendavel).slice(0, quantos);
        if (!itens.length) { camada.aviso(doTipo.length ? 'Os mobis do tipo ' + classe + ' não podem ir para a Feira Livre.' : 'Nenhum mobi do tipo ' + classe + ' no inventário.', { tipo: 'erro' }); return; }
        const ok = await camada.confirmar('Pôr ' + itens.length + '× ' + nomeDe(classe) + ' à venda na Feira Livre por ' + preco + ' asinhas cada?', { titulo: 'Feira Livre', sim: 'Vender' });
        if (!ok) return;
        naFeira = true;
        let feitas = 0;
        try {
          for (const item of itens) { if (await vender(item, preco)) feitas++; await esperar(400); }
        } finally { naFeira = false; }
        camada.aviso(feitas + ' de ' + itens.length + ' postos à venda.');
      }
      function exigirConexao() {
        if (conexao.disponivel()) return true;
        camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' });
        return false;
      }
      const NOMES_ESTADO = { 1: 'à venda', 2: 'vendida', 3: 'vencida' };

      ctx.comando({
        nome: 'feira',
        uso: 'feira',
        descricao: 'Lista as suas ofertas na Feira Livre e quanto há para receber.',
        async executar() {
          if (!exigirConexao()) return;
          const lista = await pedirMinhas();
          if (!lista) { camada.aviso('A lista das suas vendas não chegou.', { tipo: 'erro' }); return; }
          const linhas = lista.ofertas.slice(0, 15).map((o) => '#' + o.oferta + ' ' + nomeDe(o.classe) + ': ' + o.preco + ' asinhas, ' + (NOMES_ESTADO[o.estado] || 'estado ' + o.estado));
          camada.aviso([lista.ofertas.length + ' oferta(s); ' + lista.aReceber + ' asinhas para receber.'].concat(linhas).join('\n'));
        },
      });
      ctx.comando({
        nome: 'feirarepor',
        uso: 'feirarepor [todos|<oferta>] [preço]',
        descricao: 'Retira e põe de novo à venda as suas ofertas que não venderam, com o prazo renovado (depois de confirmar).',
        executar(pedido) {
          if (!exigirConexao()) return;
          const [a, b] = pedido.args;
          const id = a == null || a === 'todos' ? null : Number(a);
          const preco = b == null ? null : Number(b);
          if (id != null && !Number.isInteger(id)) { camada.aviso('Use "todos" ou o número da oferta (veja em /feira).', { tipo: 'erro' }); return; }
          repor(id, preco);
        },
      });
      ctx.comando({
        nome: 'feiravender',
        uso: 'feiravender <tipo> <preço> [quantidade]',
        descricao: 'Põe vários mobis de um tipo do inventário à venda na Feira Livre (o tipo aparece na aba Inventário).',
        executar(pedido) {
          if (!exigirConexao()) return;
          const classe = Number(pedido.args[0]);
          const preco = Number(pedido.args[1]);
          const quantos = pedido.args[2] == null ? 1 : Number(pedido.args[2]);
          if (!Number.isInteger(classe) || !Number.isInteger(quantos) || quantos < 1 || quantos > 100) { camada.aviso('Uso: feiravender <tipo> <preço> [quantidade de 1 a 100].', { tipo: 'erro' }); return; }
          if (!precoValido(preco)) { camada.aviso('Preço fora do permitido' + faixaDePreco() + '.', { tipo: 'erro' }); return; }
          venderVarios(classe, preco, quantos);
        },
      });
      ctx.comando({
        nome: 'feiraresgatar',
        uso: 'feiraresgatar',
        descricao: 'Recebe as asinhas das vendas da Feira Livre.',
        executar() {
          if (!exigirConexao()) return;
          conexao.enviar(SAIDA.FEIRA_RESGATAR, []);
          camada.aviso('Pedido enviado. As vendidas saem da lista.');
        },
      });

      ctx.comando({
        nome: 'inventario',
        apelidos: ['inventário'],
        uso: 'inventario',
        descricao: 'Mostra quantos mobis e de quantos tipos você tem.',
        executar() {
          const c = contagem();
          camada.aviso(inventario.size + ' mobis de ' + c.size + ' tipos no inventário.');
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
