// Vagalume — adaptador de conexão, no mundo da página (registrado pelo fundo em document_start,
// junto com core/protocolo.js, só quando o módulo "conexao" está ligado).
//
// Envolve o WebSocket antes de o jogo abrir a conexão. Não guarda nem envia nada para fora da
// página: só repassa aos content scripts do Vagalume os quadros que eles pediram, e manda ao jogo
// os quadros que eles montarem. A conversa com os content scripts é por eventos no `document`,
// com o detalhe em JSON (texto atravessa os mundos sem perder nada).
(function (raiz) {
  'use strict';

  const PARA_EXTENSAO = 'vl:conexao:pagina';
  const PARA_PAGINA = 'vl:conexao:extensao';
  const MAX_ASSINADOS = 200;
  // Únicos códigos que podem ser entregues ao jogo como se viessem do servidor (só mudam a tela):
  // ROOM_RIGHTS (780) para "simular direitos"; lista de pessoas (374) e saída (2661) para "mostrar só
  // amigos"; efeito do avatar (1167) para "destacar amigos"; sussurro (2704) para devolver ao jogo os
  // sussurros comuns enquanto o Vagalume esconde os recados técnicos da música.
  const INJETAVEIS = new Set([780, 374, 2661, 1167, 2704, 1640, 2233, 1474, 1797]); // 1640 e 2233: estado e dança de quem volta da tela

  function listaDeCodigos(valor) {
    if (!Array.isArray(valor)) return [];
    return valor.filter((n) => Number.isInteger(n) && n >= 0 && n <= 32767).slice(0, MAX_ASSINADOS);
  }

  function instalar(janela, P) {
    const Original = janela.WebSocket;
    if (typeof Original !== 'function' || Original.__vlEnvolvido) return null;
    const doc = janela.document;

    const estado = {
      jogo: null,              // o socket que recebe quadros binários do jogo
      sobraEntrada: null,
      registro: false,         // resumo de todo quadro, para o mapeamento dos códigos
      assinados: { entrada: new Set(), saida: new Set() },
      bloqueados: { entrada: new Set(), saida: new Set() },
      reenviados: new WeakSet(), // mensagens que nós mesmos redespachamos depois de filtrar
      // Medida de desempenho (comando /desempenho): tempo gasto aqui e quanto foi repassado.
      medida: { ms: 0, mensagens: 0, avisos: 0, bytes: 0, porCodigo: {} },
    };

    const relogio = janela.performance && typeof janela.performance.now === 'function' ? () => janela.performance.now() : () => Date.now();
    function avisar(dados) {
      try {
        const texto = JSON.stringify(dados);
        estado.medida.avisos++;
        estado.medida.bytes += texto.length;
        if (dados.tipo === 'quadro') estado.medida.porCodigo[dados.cabecalho] = (estado.medida.porCodigo[dados.cabecalho] || 0) + texto.length;
        doc.dispatchEvent(new janela.CustomEvent(PARA_EXTENSAO, { detail: texto }));
      } catch (erro) { /* sem ouvinte ou página saindo: nada a fazer */ }
    }

    function observar(direcao, quadro) {
      if (estado.registro) avisar({ tipo: 'resumo', direcao, cabecalho: quadro.cabecalho, tamanho: quadro.dados.length, palpite: P.palpite(quadro.dados, { ocultarSenhas: direcao === "saida" }) });
      if (estado.assinados[direcao].has(quadro.cabecalho)) {
        avisar({ tipo: 'quadro', direcao, cabecalho: quadro.cabecalho, dados: Array.from(quadro.dados) });
      }
    }

    function aoReceber(evento) {
      const inicio = relogio();
      try { receber.call(this, evento); } finally { estado.medida.ms += relogio() - inicio; estado.medida.mensagens++; }
    }
    function receber(evento) {
      const socket = this;
      if (!(evento.data instanceof janela.ArrayBuffer || evento.data instanceof ArrayBuffer)) return;
      if (estado.reenviados.has(evento)) return; // já passou pelo filtro
      if (estado.jogo !== socket) {
        estado.jogo = socket;
        estado.sobraEntrada = null;
        avisar({ tipo: 'estado', conectado: true });
      }
      const resultado = P.separar(evento.data, estado.sobraEntrada);
      estado.sobraEntrada = resultado.sobra;
      if (resultado.invalido) return;
      let filtrou = false;
      const mantidos = [];
      for (const quadro of resultado.quadros) {
        observar('entrada', quadro);
        if (estado.bloqueados.entrada.has(quadro.cabecalho)) filtrou = true;
        else mantidos.push(quadro);
      }
      if (!filtrou) return;
      // Algum quadro foi bloqueado: segura a mensagem original e entrega ao jogo só o resto.
      evento.stopImmediatePropagation();
      if (!mantidos.length) return;
      const partes = mantidos.map((q) => P.remontar(q.cabecalho, q.dados));
      const total = partes.reduce((soma, p) => soma + p.length, 0);
      const junto = new Uint8Array(total);
      let pos = 0;
      for (const p of partes) { junto.set(p, pos); pos += p.length; }
      const novo = new janela.MessageEvent('message', { data: junto.buffer, origin: evento.origin });
      estado.reenviados.add(novo);
      socket.dispatchEvent(novo);
    }

    class SocketVagalume extends Original {
      constructor(endereco, protocolos) {
        if (protocolos === undefined) super(endereco);
        else super(endereco, protocolos);
        this.addEventListener('message', aoReceber);
        this.addEventListener('close', () => {
          if (estado.jogo === this) {
            estado.jogo = null;
            estado.sobraEntrada = null;
            avisar({ tipo: 'estado', conectado: false });
          }
        });
      }

      send(dados) {
        if (estado.jogo === this && (dados instanceof ArrayBuffer || dados instanceof janela.ArrayBuffer || ArrayBuffer.isView(dados))) {
          let resultado;
          try { resultado = P.separar(dados, null); } catch (erro) { resultado = { quadros: [], invalido: true }; }
          if (!resultado.invalido && resultado.quadros.length) {
            const mantidos = [];
            for (const quadro of resultado.quadros) {
              observar('saida', quadro);
              if (estado.forcando || !estado.bloqueados.saida.has(quadro.cabecalho)) mantidos.push(quadro);
            }
            if (!mantidos.length) return undefined;
            if (mantidos.length !== resultado.quadros.length) {
              const partes = mantidos.map((q) => P.remontar(q.cabecalho, q.dados));
              const junto = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
              let pos = 0;
              for (const p of partes) { junto.set(p, pos); pos += p.length; }
              return super.send(junto.buffer);
            }
          }
        }
        return super.send(dados);
      }
    }
    Object.defineProperty(SocketVagalume, 'name', { value: Original.name || 'WebSocket' });
    Object.defineProperty(SocketVagalume, '__vlEnvolvido', { value: true });
    janela.WebSocket = SocketVagalume;

    function enviar(cabecalho, campos, forcar) {
      const socket = estado.jogo;
      if (!socket || socket.readyState !== 1) return { ok: false, motivo: 'sem conexão' };
      let quadro;
      try { quadro = P.montar(cabecalho, campos); } catch (erro) { return { ok: false, motivo: erro.message }; }
      // Passa pelo nosso `send`, para aparecer no registro como qualquer quadro do jogo.
      estado.forcando = forcar === true;
      try { socket.send(quadro.buffer); } finally { estado.forcando = false; }
      return { ok: true };
    }

    // Entrega ao jogo um quadro como se tivesse vindo do servidor. Só muda o que o cliente mostra:
    // o servidor não fica sabendo e continua decidindo o que vale. Usado por "simular direitos".
    // Só códigos da lista INJETAVEIS, para o recurso não virar uma porta aberta.
    function injetar(cabecalho, campos) {
      const socket = estado.jogo;
      if (!socket || socket.readyState !== 1) return { ok: false, motivo: 'sem conexão' };
      if (!INJETAVEIS.has(cabecalho)) return { ok: false, motivo: 'código não permitido' };
      let quadro;
      try { quadro = P.montar(cabecalho, campos); } catch (erro) { return { ok: false, motivo: erro.message }; }
      const evento = new janela.MessageEvent('message', { data: quadro.buffer });
      estado.reenviados.add(evento);
      socket.dispatchEvent(evento);
      return { ok: true };
    }

    function aoPedido(evento) {
      let pedido;
      try { pedido = JSON.parse(evento.detail); } catch (erro) { return; }
      if (!pedido || typeof pedido !== 'object') return;
      switch (pedido.tipo) {
        case 'assinar':
          estado.assinados.entrada = new Set(listaDeCodigos(pedido.entrada));
          estado.assinados.saida = new Set(listaDeCodigos(pedido.saida));
          break;
        case 'bloquear':
          estado.bloqueados.entrada = new Set(listaDeCodigos(pedido.entrada));
          estado.bloqueados.saida = new Set(listaDeCodigos(pedido.saida));
          break;
        case 'registro':
          estado.registro = pedido.ligado === true;
          break;
        case 'enviar': {
          const resposta = enviar(pedido.cabecalho, pedido.campos, pedido.forcar === true);
          avisar({ tipo: 'enviado', id: pedido.id, ok: resposta.ok, motivo: resposta.motivo });
          break;
        }
        case 'injetar': {
          const resposta = injetar(pedido.cabecalho, pedido.campos);
          avisar({ tipo: 'enviado', id: pedido.id, ok: resposta.ok, motivo: resposta.motivo });
          break;
        }
        case 'estado':
          avisar({ tipo: 'estado', conectado: !!(estado.jogo && estado.jogo.readyState === 1) });
          break;
        case 'medida': {
          const m = estado.medida;
          avisar({ tipo: 'medida', ms: Math.round(m.ms), mensagens: m.mensagens, avisos: m.avisos, bytes: m.bytes, porCodigo: m.porCodigo });
          if (pedido.zerar) estado.medida = { ms: 0, mensagens: 0, avisos: 0, bytes: 0, porCodigo: {} };
          break;
        }
        default:
          break;
      }
    }
    doc.addEventListener(PARA_PAGINA, aoPedido);
    avisar({ tipo: 'pronto' });

    return { estado, enviar, Original, SocketVagalume };
  }

  const api = { instalar, PARA_EXTENSAO, PARA_PAGINA };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (raiz.VL && raiz.VL.protocolo && raiz.document) {
    const P = raiz.VL.protocolo;
    // O protocolo veio para o mundo da página só para este script; não deixa rastro no `window`.
    delete raiz.VL.protocolo;
    if (!Object.keys(raiz.VL).length) delete raiz.VL;
    instalar(raiz, P);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
