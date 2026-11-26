// Temas de fala: somente chat enviado pela própria conta, compartilhado por mensagem no quarto.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.baloes) return;
  const { nucleo, camada, jogo, baloes: B } = VL;
  const el = camada.el;
  const chave = (v) => String(v || '').trim().toLowerCase();
  const valor = (v) => B.valido(v) ? v : 'jogo';

  nucleo.definirModulo({
    id: 'baloes',
    iniciar(ctx) {
      const tirarCss = camada.estiloPagina('baloes-fala', B.cssPagina);
      ctx.aoParar(tirarCss);
      const enviados = []; // fala enviada ao Habblet, ainda sem o balão correspondente
      const aguardando = []; // balão de outro usuário, ainda sem o aviso Vagalume correspondente
      const sinais = []; // aviso Vagalume recebido antes do balão
      const marcados = new Set();
      const vistos = new Set(); // evita que retransmissões vistam uma segunda fala igual
      const fila = [];
      let quartoAnterior = '';
      let transmissao = 0;
      let sequencia = 0;
      const meuEstilo = () => valor(ctx.secao().estilo);
      const quarto = () => String(VL.pessoas && VL.pessoas.quartoAtual && VL.pessoas.quartoAtual() || '');
      const meuNome = () => chave(VL.pessoas && VL.pessoas.eu && VL.pessoas.eu());

      function limparPendentes() {
        const limite = Date.now() - 12000;
        for (const lista of [enviados, aguardando, sinais]) {
          for (let i = lista.length - 1; i >= 0; i--) {
            if (lista[i].quando < limite || (lista === aguardando && !lista[i].balao.isConnected)) lista.splice(i, 1);
          }
        }
        for (const balao of marcados) if (!balao.isConnected) marcados.delete(balao);
      }
      function marcar(balao, estilo) {
        if (!B.valido(estilo)) return;
        balao.setAttribute('data-vl-bolha', estilo);
        marcados.add(balao);
      }
      function agendarEnvio() {
        if (transmissao || !fila.length) return;
        transmissao = setTimeout(enviarLote, 1800);
      }
      function enviarLote() {
        transmissao = 0;
        const atual = quarto();
        for (let i = fila.length - 1; i >= 0; i--) if (fila[i].quarto !== atual) fila.splice(i, 1);
        if (!fila.length) return;
        if (!VL.comunidade || !VL.comunidade.acao) { agendarEnvio(); return; }
        const lote = fila.slice(0, 12);
        const empacotar = (itens) => ({ t: 'chat:fala', q: atual, a: itens.map((item) => [item.token, item.assinaturas.length === 1 ? item.assinaturas[0] : item.assinaturas, item.estilo]) });
        const novos = lote.filter((item) => item.tentativas === 0);
        if (novos.length && VL.comunidade.fala) VL.comunidade.fala(empacotar(novos));
        VL.comunidade.acao(empacotar(lote));
        for (const item of lote) item.tentativas++;
        for (let i = fila.length - 1; i >= 0; i--) if (fila[i].tentativas >= 3) fila.splice(i, 1);
        agendarEnvio();
      }
      function anunciarFala(assinaturas, estilo) {
        const atual = quarto();
        if (!atual) return;
        const token = Date.now().toString(36) + (++sequencia).toString(36);
        fila.push({ quarto: atual, token, assinaturas, estilo, tentativas: 0 });
        if (fila.length > 36) fila.shift();
        // O aviso sai com o pacote de fala: o outro cliente pode tê-lo antes de renderizar o balão.
        clearTimeout(transmissao);
        transmissao = 0;
        enviarLote();
      }
      function aoSaida(leitor, sussurro) {
        const estilo = meuEstilo();
        if (!B.valido(estilo)) return;
        const texto = String(leitor.texto() || '');
        if (!texto.trim()) return;
        const assinaturas = [B.assinatura(texto)];
        if (sussurro && /^\S+\s+\S/.test(texto)) assinaturas.push(B.assinatura(texto.replace(/^\S+\s+/, '')));
        limparPendentes();
        enviados.push({ assinaturas, estilo, quarto: quarto(), quando: Date.now() });
        if (enviados.length > 40) enviados.shift();
        anunciarFala(assinaturas, estilo);
      }
      if (VL.conexao && VL.codigos && VL.conexao.ouvir) {
        const S = VL.codigos.SAIDA;
        ctx.aoParar(VL.conexao.ouvir('saida', S.FALAR, (l) => aoSaida(l, false)));
        ctx.aoParar(VL.conexao.ouvir('saida', S.GRITAR, (l) => aoSaida(l, false)));
        ctx.aoParar(VL.conexao.ouvir('saida', S.SUSSURRAR, (l) => aoSaida(l, true)));
      }
      function aoFala(fala) {
        if (!fala || !fala.el || !fala.autor) return;
        const balao = fala.el.matches && fala.el.matches('.chat-bubble') ? fala.el : fala.el.querySelector && fala.el.querySelector('.chat-bubble');
        if (!balao) return;
        limparPendentes();
        const autor = chave(fala.autor);
        const assinatura = B.assinatura(fala.texto);
        if (autor === meuNome() && autor) {
          const i = enviados.findIndex((item) => item.quarto === quarto() && item.assinaturas.includes(assinatura));
          if (i < 0) return; // uma fala de wired com o meu nome não foi enviada pelo meu chat
          const enviado = enviados.splice(i, 1)[0];
          marcar(balao, enviado.estilo);
          return;
        }
        const i = sinais.findIndex((item) => item.autor === autor && item.assinaturas.includes(assinatura));
        if (i >= 0) { marcar(balao, sinais.splice(i, 1)[0].estilo); return; }
        aguardando.push({ balao, autor, assinatura, quando: Date.now() });
        if (aguardando.length > 60) aguardando.shift();
      }
      ctx.aoParar(jogo.observarFalas(aoFala));

      function aoAcao(m) {
        if (!m || m.de !== 'sala' || !['presenca:acao', 'presenca:direto'].includes(m.tipo) || !m.nome || !m.dado) return;
        const d = m.dado;
        if (d.t !== 'chat:fala' || String(d.q) !== quarto() || !Array.isArray(d.a)) return;
        limparPendentes();
        const autor = chave(m.nome);
        if (!autor || autor === meuNome()) return;
        for (const item of d.a.slice(0, 12)) {
          if (!Array.isArray(item) || item.length !== 3) continue;
          const [token, assinatura, estilo] = item;
          const assinaturas = Array.isArray(assinatura) ? assinatura : [assinatura];
          if (typeof token !== 'string' || !/^[a-z0-9]{1,24}$/.test(token) || !assinaturas.length || assinaturas.length > 2 || !assinaturas.every((s) => typeof s === 'string' && /^[a-z0-9]+:[a-z0-9]+$/.test(s)) || !B.valido(estilo)) continue;
          const unico = autor + ':' + token;
          if (vistos.has(unico)) continue;
          vistos.add(unico);
          const i = aguardando.findIndex((fala) => fala.autor === autor && assinaturas.includes(fala.assinatura));
          if (i >= 0) marcar(aguardando.splice(i, 1)[0].balao, estilo);
          else sinais.push({ autor, assinaturas, estilo, quando: Date.now() });
        }
        while (sinais.length > 60) sinais.shift();
        while (vistos.size > 500) vistos.delete(vistos.values().next().value);
      }
      function ligarComunidade() {
        if (!VL.comunidade || !VL.comunidade.aoAcao) return false;
        ctx.aoParar(VL.comunidade.aoAcao(aoAcao));
        return true;
      }
      if (!ligarComunidade()) {
        const espera = setInterval(function () { if (ligarComunidade()) clearInterval(espera); }, 1000);
        ctx.aoParar(function () { clearInterval(espera); });
      }
      const relogio = setInterval(function () {
        const atual = quarto();
        if (quartoAnterior === '') { quartoAnterior = atual; return; }
        if (atual === quartoAnterior) return;
        quartoAnterior = atual;
        enviados.length = 0; aguardando.length = 0; sinais.length = 0; fila.length = 0; vistos.clear();
      }, 1800);
      ctx.aoParar(function () {
        clearInterval(relogio); clearTimeout(transmissao);
        for (const balao of marcados) if (balao.isConnected) balao.removeAttribute('data-vl-bolha');
        marcados.clear();
      });

      // O seletor do Habblet é recriado pelo React a cada abertura. Acrescentamos os temas
      // ao fim da grade nativa. A seleção não altera os balões já exibidos.
      function montarNoSeletor() {
        document.querySelectorAll('.nitro-chat-style-selector-container').forEach(function (seletor) {
          const primeiro = seletor.querySelector('.bubble-parent-container');
          const grade = primeiro && primeiro.parentElement;
          if (!grade || grade.querySelector('.vl-bolha-picker')) return;
          for (const tema of B.ESTILOS) {
            const botao = el('button', { type: 'button', class: 'bubble-parent-container vl-bolha-picker', title: 'Vagalume ' + tema.nome + ' · próximas falas', 'aria-label': 'Balão Vagalume ' + tema.nome, 'data-vl-estilo': tema.id }, [
              el('img', { src: B.recurso(tema.id, 'icone'), alt: '' }),
            ]);
            botao.classList.toggle('ativa', meuEstilo() === tema.id);
            botao.addEventListener('click', function (ev) {
              ev.preventDefault(); ev.stopPropagation();
              ctx.alterar('baloes', { estilo: tema.id });
              const gatilho = document.querySelector('.nitro-room-chatinput-component .chatstyles-selector');
              if (gatilho) setTimeout(function () { if (seletor.isConnected) gatilho.click(); }, 0);
            });
            grade.appendChild(botao);
          }
        });
      }
      const observarSeletor = new MutationObserver(montarNoSeletor);
      observarSeletor.observe(document.documentElement, { childList: true, subtree: true });
      montarNoSeletor();
      ctx.aoParar(function () {
        observarSeletor.disconnect();
        document.querySelectorAll('.vl-bolha-picker').forEach((b) => b.remove());
      });
      ctx.escutar(document, 'click', function (ev) {
        if (!ev.target || !ev.target.closest) return;
        const nativo = ev.target.closest('.nitro-chat-style-selector-container .bubble-parent-container:not(.vl-bolha-picker)');
        if (nativo && nativo.querySelector('.chat-bubble')) ctx.alterar('baloes', { estilo: 'jogo' });
      }, true);
      ctx.aoConfig(function (secao) {
        if (secao !== 'baloes') return;
        document.querySelectorAll('.vl-bolha-picker').forEach((b) => b.classList.toggle('ativa', b.getAttribute('data-vl-estilo') === meuEstilo()));
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
