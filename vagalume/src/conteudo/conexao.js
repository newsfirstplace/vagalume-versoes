// Vagalume — lado dos content scripts do adaptador de conexão (src/principal/conexao.js).
// Junta os pedidos dos módulos (quais quadros ouvir, quais bloquear) e conversa com o adaptador
// por eventos no `document`. Sem o adaptador instalado (módulo "conexao" desligado ou hotel
// ainda não recarregado), `disponivel()` fica falso e nada é enviado.
(function (raiz) {
  'use strict';

  const PARA_EXTENSAO = 'vl:conexao:pagina';
  const PARA_PAGINA = 'vl:conexao:extensao';

  function criarCliente(doc, CustomEventoDe, P) {
    const ouvintes = { entrada: new Map(), saida: new Map() };   // cabeçalho -> Set de funções
    const bloqueios = { entrada: new Map(), saida: new Map() };  // cabeçalho -> contagem
    const doRegistro = new Set();
    const doEstado = new Set();
    const pendentes = new Map();
    let proximoId = 1;
    let disponivel = false;
    let conectado = false;

    function pedir(dados) {
      doc.dispatchEvent(new CustomEventoDe(PARA_PAGINA, { detail: JSON.stringify(dados) }));
    }

    function chaves(mapa) { return [...mapa.keys()]; }
    function sincronizarAssinaturas() { pedir({ tipo: 'assinar', entrada: chaves(ouvintes.entrada), saida: chaves(ouvintes.saida) }); }
    function sincronizarBloqueios() { pedir({ tipo: 'bloquear', entrada: chaves(bloqueios.entrada), saida: chaves(bloqueios.saida) }); }
    function sincronizarTudo() {
      sincronizarAssinaturas();
      sincronizarBloqueios();
      pedir({ tipo: 'registro', ligado: doRegistro.size > 0 });
    }

    function direcaoValida(direcao) {
      if (direcao !== 'entrada' && direcao !== 'saida') throw new TypeError('Direção deve ser "entrada" ou "saida".');
    }

    function avisarEstado() {
      for (const fn of doEstado) { try { fn({ disponivel, conectado }); } catch (erro) { console.warn('[Vagalume]', erro); } }
    }

    function aoAviso(evento) {
      let dados;
      try { dados = JSON.parse(evento.detail); } catch (erro) { return; }
      if (!dados || typeof dados !== 'object') return;
      if (!disponivel) {
        disponivel = true;
        sincronizarTudo(); // o adaptador pode ter sido carregado antes de nós: manda o que já pedimos
      }
      switch (dados.tipo) {
        case 'pronto':
          avisarEstado();
          break;
        case 'estado':
          conectado = dados.conectado === true;
          avisarEstado();
          break;
        case 'quadro': {
          const lista = (ouvintes[dados.direcao] || new Map()).get(dados.cabecalho);
          if (!lista || !Array.isArray(dados.dados)) break;
          const bytes = Uint8Array.from(dados.dados);
          for (const fn of [...lista]) {
            try { fn(P.criarLeitor(bytes), bytes); } catch (erro) { console.warn('[Vagalume] Falha ao ler o quadro ' + dados.cabecalho + ':', erro); }
          }
          break;
        }
        case 'resumo':
          for (const fn of [...doRegistro]) { try { fn(dados); } catch (erro) { console.warn('[Vagalume]', erro); } }
          break;
        case 'enviado': {
          const resolver = pendentes.get(dados.id);
          if (resolver) { pendentes.delete(dados.id); resolver({ ok: dados.ok === true, motivo: dados.motivo || '' }); }
          break;
        }
        case 'medida': {
          const r = medidaPendente;
          medidaPendente = null;
          if (r) r(dados);
          break;
        }
        default:
          break;
      }
    }
    let medidaPendente = null;
    // Tempo gasto na extensão com cada código recebido (ler o texto e rodar os ouvintes).
    const tempoPorCodigo = {};
    function aoAvisoMedido(evento) {
      const ini = performance.now();
      aoAviso(evento);
      const ms = performance.now() - ini;
      if (ms > 0.05) { const m = /"cabecalho":(\d+)/.exec(String(evento.detail).slice(0, 80)); const k = m ? m[1] : 'outros'; tempoPorCodigo[k] = (tempoPorCodigo[k] || 0) + ms; }
    }
    doc.addEventListener(PARA_EXTENSAO, aoAvisoMedido);
    pedir({ tipo: 'estado' });

    return {
      // Medida de desempenho (/desempenho): a ponte da página devolve tempo, mensagens e bytes.
      medida(zerar) {
        if (zerar) for (const k of Object.keys(tempoPorCodigo)) delete tempoPorCodigo[k];
        return new Promise(function (resolver) {
          medidaPendente = function (d) { resolver(Object.assign({}, d, { extensaoPorCodigo: Object.assign({}, tempoPorCodigo) })); };
          pedir({ tipo: 'medida', zerar: !!zerar });
          setTimeout(function () { if (medidaPendente) { medidaPendente = null; resolver(null); } }, 1500);
        });
      },
      disponivel: () => disponivel,
      conectado: () => conectado,
      aoEstado(fn) { doEstado.add(fn); return () => doEstado.delete(fn); },

      // fn(leitor, bytes) para cada quadro com esse código. Devolve a função que cancela.
      ouvir(direcao, cabecalho, fn) {
        direcaoValida(direcao);
        const mapa = ouvintes[direcao];
        if (!mapa.has(cabecalho)) mapa.set(cabecalho, new Set());
        mapa.get(cabecalho).add(fn);
        sincronizarAssinaturas();
        return function cancelar() {
          const lista = mapa.get(cabecalho);
          if (!lista || !lista.delete(fn)) return;
          if (!lista.size) mapa.delete(cabecalho);
          sincronizarAssinaturas();
        };
      },

      // Segura os quadros com esse código (não chegam ao jogo ou ao servidor). Devolve o desfazer.
      bloquear(direcao, cabecalho) {
        direcaoValida(direcao);
        const mapa = bloqueios[direcao];
        mapa.set(cabecalho, (mapa.get(cabecalho) || 0) + 1);
        sincronizarBloqueios();
        let desfeito = false;
        return function desfazer() {
          if (desfeito) return;
          desfeito = true;
          const n = (mapa.get(cabecalho) || 1) - 1;
          if (n <= 0) mapa.delete(cabecalho); else mapa.set(cabecalho, n);
          sincronizarBloqueios();
        };
      },

      // opcoes.forcar: o quadro passa mesmo que o código esteja bloqueado (ex.: Shift+seta com o anti-giro ligado).
      enviar(cabecalho, campos, opcoes) { return this.pedirAoAdaptador('enviar', cabecalho, campos, opcoes && opcoes.forcar === true); },

      // Entrega ao jogo um quadro como se viesse do servidor (só códigos que o adaptador permite).
      injetar(cabecalho, campos) { return this.pedirAoAdaptador('injetar', cabecalho, campos); },

      pedirAoAdaptador(tipo, cabecalho, campos, forcar) {
        if (!disponivel) return Promise.resolve({ ok: false, motivo: 'adaptador ausente' });
        try { P.montar(cabecalho, campos); } catch (erro) { return Promise.resolve({ ok: false, motivo: erro.message }); }
        const id = proximoId++;
        return new Promise(function (resolver) {
          pendentes.set(id, resolver);
          pedir(forcar ? { tipo, id, cabecalho, campos, forcar: true } : { tipo, id, cabecalho, campos });
          const relogio = setTimeout(function () {
            if (pendentes.delete(id)) resolver({ ok: false, motivo: 'sem resposta' });
          }, 2000);
          if (relogio && typeof relogio.unref === 'function') relogio.unref(); // só nos testes em Node
        });
      },

      // Resumo de todos os quadros (código, tamanho, palpite dos dados), para o mapeamento.
      registro(fn) {
        doRegistro.add(fn);
        if (doRegistro.size === 1) pedir({ tipo: 'registro', ligado: true });
        return function parar() {
          if (doRegistro.delete(fn) && !doRegistro.size) pedir({ tipo: 'registro', ligado: false });
        };
      },

      encerrar() { doc.removeEventListener(PARA_EXTENSAO, aoAviso); },
    };
  }

  const api = { criarCliente, PARA_EXTENSAO, PARA_PAGINA };
  raiz.VL = raiz.VL || {};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (raiz.document && raiz.VL.protocolo && !raiz.VL.conexao) {
    raiz.VL.conexao = criarCliente(raiz.document, raiz.CustomEvent, raiz.VL.protocolo);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
