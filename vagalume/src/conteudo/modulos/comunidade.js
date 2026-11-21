// Vagalume — módulo "comunidade": o grupo Vagalume do Habblet e o selo de quem usa a extensão.
// Pedido do usuário em 2026-11-14:
// - entrar no grupo Vagalume (quarto 7034842) e favoritá-lo, ligado de fábrica. Faz isso uma vez por
//   conta: se a pessoa depois favoritar outro grupo, o Vagalume não troca de novo. Avisa quando faz.
// - mostrar um ponto verde brilhante ao lado do apelido de quem usa o Vagalume.
// Como sabemos quem usa: no Habblet, cada pessoa do quarto chega (mensagem 374) com o grupo favorito
// dela. Quem tem o grupo Vagalume como favorito ganha o selo. Não há servidor do Vagalume nem envio de
// dados para fora do jogo: o grupo favorito já é público no Habblet.
// Códigos do cliente: GROUP_REQUEST 998 (i grupo) e GROUP_FAVORITE 3549 (i grupo). Grupo 584754 visto
// ao vivo em 2026-11-14 (habblet,city e ZHEPHYRA com ele como favorito).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.conexao || !VL.codigos) return;
  const { nucleo, camada, jogo, conexao, codigos } = VL;
  const { SAIDA, ENTRADA } = codigos;
  const GRUPO_VAGALUME = 584754;
  const CHAVE_FEITO = 'vl.grupoVagalume'; // storage.local: ids das contas em que o Vagalume já entrou no grupo
  const CSS_SELO = '.vl-selo { display: inline-block; width: 8px; height: 8px; margin: 0 4px 1px 0; vertical-align: middle; border-radius: 50%;'
    + ' background: radial-gradient(circle at 35% 35%, #f4ffc2 0, #d6f24a 45%, #8fb11a 100%); box-shadow: 0 0 4px 1px rgba(214, 242, 74, .85), 0 0 9px rgba(214, 242, 74, .55); }'
    + '[data-vl-usa]::after { content: ""; display: inline-block; width: 8px; height: 8px; margin-left: 5px; vertical-align: middle; border-radius: 50%;'
    + ' background: radial-gradient(circle at 35% 35%, #f4ffc2 0, #d6f24a 45%, #8fb11a 100%); box-shadow: 0 0 4px 1px rgba(214, 242, 74, .85), 0 0 9px rgba(214, 242, 74, .55); }';
  // Conexões logo abaixo da missão (2026-11-21, pedido do usuário: no fim do quadro ficava solto e
  // baixo demais): uma faixa no jeito da caixa da missão, com o rótulo à esquerda e os ícones à direita.
  const CSS_PERFIL = '.nitro-infostand .vl-conexoes-perfil { display:block; margin:0; padding:0; border:0; background:transparent; }'
    + '.vl-perfil-abrir { box-sizing:border-box; width:100%; display:flex; align-items:center; gap:6px; min-height:26px; padding:3px 8px; border:1px solid rgba(214,242,74,.22); border-radius:8px; background:rgba(214,242,74,.06); color:#c8d0dc; cursor:pointer; font:600 11px/1 system-ui,sans-serif; text-align:left; }'
    + '.vl-perfil-abrir:hover,.vl-perfil-abrir:focus-visible { background:rgba(214,242,74,.14); border-color:rgba(214,242,74,.6); outline:none; color:#d6f24a; }'
    + '.vl-perfil-rotulo { flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:.2px; }'
    + '.vl-perfil-icones { display:flex; align-items:center; gap:4px; flex:none; }'
    + '.vl-perfil-abrir .vl-app-icone { width:17px; height:17px; }'
    + '.vl-perfil-detalhe .vl-app-icone { width:24px; height:24px; }'
    + ((VL.conexoesPerfil && VL.conexoesPerfil.CSS_ICONE) || '')
    + '.vl-perfil-mais { font:700 11px system-ui,sans-serif; color:#d6f24a; }'
    + '.vl-perfil-detalhes { position:fixed; z-index:2147483640; width:286px; max-height:min(410px,calc(100vh - 16px)); overflow-y:auto; box-sizing:border-box; padding:11px; border:1px solid #52673a; border-radius:11px; background:#1b2330; color:#edf2e2; box-shadow:0 14px 38px #000a; font:12px system-ui,sans-serif; }'
    + '.vl-perfil-detalhes-cabecalho { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:9px; font-weight:700; color:#d6f24a; }'
    + '.vl-perfil-detalhes-fechar { border:0; background:transparent; color:#d2d9c7; cursor:pointer; font-size:18px; }'
    + '.vl-perfil-detalhe { display:flex; align-items:center; gap:9px; padding:8px 2px; border-top:1px solid #354256; }'
    + '.vl-perfil-detalhe-texto { min-width:0; flex:1; }'
    + '.vl-perfil-detalhe-texto strong,.vl-perfil-detalhe-texto span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }'
    + '.vl-perfil-detalhe-texto span { color:#acb9c8; font-size:11px; }'
    + '.vl-perfil-confirmado { margin-left:5px; padding:0 5px; border-radius:999px; background:rgba(214,242,74,.16); border:1px solid rgba(214,242,74,.5); color:#d6f24a; font-size:10px; font-weight:700; }'
    + '.vl-perfil-detalhe-acao { border:1px solid #52673a; border-radius:6px; padding:5px 7px; background:#263344; color:#d6f24a; cursor:pointer; }'
    + '.vl-perfil-detalhes-rodape { margin:9px 0 0; color:#acb9c8; font-size:10px; }';

  // Ícone no formato do app de cada serviço (2026-11-19, pedido do usuário): quadrado arredondado com
  // o fundo da marca e o logo na cor do app. O logo é o SVG original (ver icones/conexoes/ORIGEM.md),
  // pintado por máscara; o Letterboxd usa o próprio desenho colorido.
  const SERVICOS_ICONE = ['discord', 'steam', 'valorant', 'lol', 'letterboxd', 'lastfm'];
  function iconeServico(id) {
    if (!SERVICOS_ICONE.includes(id)) return null;
    // League of Legends: o emblema colorido do jogo (imagem), como o usuário pediu; os outros são SVG.
    const url = chrome.runtime.getURL('icones/conexoes/' + id + (id === 'lol' ? '.png' : '.svg'));
    const caixa = document.createElement('span');
    caixa.className = 'vl-app-icone';
    caixa.dataset.servico = id;
    caixa.setAttribute('aria-hidden', 'true');
    if (id === 'letterboxd' || id === 'lol') {
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      caixa.appendChild(img);
      return caixa;
    }
    const marca = document.createElement('span');
    marca.className = 'vl-app-logo';
    marca.style.maskImage = 'url("' + url + '")';
    marca.style.webkitMaskImage = marca.style.maskImage;
    caixa.appendChild(marca);
    return caixa;
  }
  if (VL.conexoesPerfil) VL.conexoesPerfil.icone = iconeServico;

  nucleo.definirModulo({
    id: 'comunidade',
    iniciar(ctx) {
      const grupoDe = new Map(); // apelido em minúsculas -> grupo favorito
      const chave = (n) => String(n || '').trim().toLowerCase();
      // Quem usa: pela presença no servidor do Vagalume (cada Vagalume avisa o quarto em que está;
      // pedido do usuário em 2026-11-16). Sem servidor, vale o grupo favorito, como antes.
      const naPresenca = new Set(); // apelidos em minúsculas dos Vagalumes deste quarto
      const comServidor = () => !!(VL.servidor && VL.servidor.configurado());
      function usaVagalume(nome) {
        const k = chave(nome);
        if (comServidor()) return naPresenca.has(k);
        return grupoDe.get(k) === GRUPO_VAGALUME;
      }
      const ouvintesAcao = new Set();
      function acao(dado) { return chrome.runtime.sendMessage({ tipo: 'sala:presenca:acao', dado }).catch(function () { return null; }); }
      function direto(para, dado) { return chrome.runtime.sendMessage({ tipo: 'sala:presenca:direto', para, dado }).catch(function () { return null; }); }
      VL.comunidade = { usaVagalume, GRUPO: GRUPO_VAGALUME, acao, direto, aoAcao(fn) { ouvintesAcao.add(fn); return function () { ouvintesAcao.delete(fn); }; } };
      const tirarCssPerfil = camada.estiloPagina('comunidade-perfil', CSS_PERFIL);
      ctx.aoParar(tirarCssPerfil);

      // Links do miniperfil: salvos por conta e compartilhados entre Vagalumes do quarto.
      const P = VL.conexoesPerfil;
      const CHAVE_PERFIL = 'vl.perfilConexoes.';
      let perfilConta = '';
      let perfilCarregado = false;
      let meuPerfil = P ? P.normalizar({}) : null;
      const perfisDe = new Map();
      const perguntouPerfil = new Map();
      const respondeuPerfil = new Map();
      let painelDetalhes = null;
      let gatilhoDetalhes = null;
      function fecharDetalhes() {
        if (painelDetalhes) painelDetalhes.remove();
        painelDetalhes = null;
        if (gatilhoDetalhes) gatilhoDetalhes.setAttribute('aria-expanded', 'false');
        gatilhoDetalhes = null;
      }
      function abrirDetalhes(gatilho, nome, ativos, dados) {
        if (gatilhoDetalhes === gatilho) { fecharDetalhes(); return; }
        fecharDetalhes();
        const painel = document.createElement('section');
        painel.className = 'vl-perfil-detalhes';
        painel.setAttribute('aria-label', 'Conexões de ' + nome);
        const cabecalho = document.createElement('div');
        cabecalho.className = 'vl-perfil-detalhes-cabecalho';
        const titulo = document.createElement('span');
        titulo.textContent = 'Conexões de ' + nome;
        const fechar = document.createElement('button');
        fechar.type = 'button'; fechar.className = 'vl-perfil-detalhes-fechar'; fechar.textContent = '×'; fechar.title = 'Fechar conexões';
        fechar.addEventListener('click', fecharDetalhes);
        cabecalho.appendChild(titulo); cabecalho.appendChild(fechar); painel.appendChild(cabecalho);
        for (const s of ativos) {
          const valor = dados[s.id], url = P.destino(s.id, valor);
          const item = document.createElement('div'); item.className = 'vl-perfil-detalhe';
          item.appendChild(iconeServico(s.id));
          const texto = document.createElement('div'); texto.className = 'vl-perfil-detalhe-texto';
          const rotulo = document.createElement('strong'); rotulo.textContent = s.nome;
          if (dados.confirmados && dados.confirmados[s.id]) {
            const ok = document.createElement('b'); ok.className = 'vl-perfil-confirmado'; ok.textContent = '✓ confirmado';
            ok.title = 'Conta confirmada pelo Vagalume de quem publicou'; rotulo.appendChild(ok);
          }
          const identificador = document.createElement('span'); identificador.textContent = valor; identificador.title = valor;
          texto.appendChild(rotulo); texto.appendChild(identificador); item.appendChild(texto);
          const acao = document.createElement('button'); acao.type = 'button'; acao.className = 'vl-perfil-detalhe-acao';
          acao.textContent = url ? 'Abrir' : 'Copiar';
          acao.setAttribute('aria-label', (url ? 'Abrir ' : 'Copiar ') + s.nome + ': ' + valor);
          acao.addEventListener('click', function (ev) {
            ev.stopPropagation();
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            else camada.copiar(valor).then(function (ok) { camada.aviso(ok ? s.nome + ': identificador copiado.' : s.nome + ': ' + valor); });
          });
          item.appendChild(acao); painel.appendChild(item);
        }
        const rodape = document.createElement('p'); rodape.className = 'vl-perfil-detalhes-rodape';
        rodape.textContent = 'Informações publicadas pela pessoa. As marcadas com ✓ foram confirmadas pelo Vagalume dela.'; painel.appendChild(rodape);
        document.body.appendChild(painel);
        const retangulo = gatilho.getBoundingClientRect();
        painel.style.left = Math.max(8, Math.min(retangulo.right - 286, window.innerWidth - 294)) + 'px';
        painel.style.top = Math.max(8, Math.min(retangulo.bottom + 6, window.innerHeight - painel.offsetHeight - 8)) + 'px';
        painelDetalhes = painel; gatilhoDetalhes = gatilho;
        gatilho.setAttribute('aria-expanded', 'true');
      }
      function fecharDetalhesFora(ev) {
        if (painelDetalhes && !painelDetalhes.contains(ev.target) && !gatilhoDetalhes.contains(ev.target)) fecharDetalhes();
      }
      function fecharDetalhesEsc(ev) { if (ev.key === 'Escape') fecharDetalhes(); }
      document.addEventListener('click', fecharDetalhesFora);
      document.addEventListener('keydown', fecharDetalhesEsc);
      ctx.aoParar(function () {
        document.removeEventListener('click', fecharDetalhesFora);
        document.removeEventListener('keydown', fecharDetalhesEsc);
        fecharDetalhes();
      });
      function contaAtual() {
        const id = VL.pessoas && VL.pessoas.meuId && VL.pessoas.meuId();
        return /^[1-9]\d{0,14}$/.test(String(id || '')) ? String(id) : '';
      }
      function meuNome() { return VL.pessoas && VL.pessoas.eu ? String(VL.pessoas.eu() || '') : ''; }
      async function carregarPerfil() {
        if (!P) return;
        const id = contaAtual();
        if (!id || perfilConta === id && perfilCarregado) return;
        if (perfilConta !== id) { perfilConta = id; perfilCarregado = false; meuPerfil = P.normalizar({}); }
        try {
          const r = await chrome.storage.local.get(CHAVE_PERFIL + id);
          if (perfilConta !== id) return;
          meuPerfil = P.normalizar(r[CHAVE_PERFIL + id]);
          perfilCarregado = true;
          ctx.emitir('perfil:estado', {});
          marcarQuadros();
        } catch (erro) { perfilCarregado = false; }
      }
      async function salvarPerfil(dados) {
        if (!P) throw new Error('Conexões indisponíveis');
        await carregarPerfil();
        if (!perfilConta || !perfilCarregado) throw new Error('Entre no hotel para salvar as conexões deste perfil.');
        const novo = P.normalizar({ ...dados, publicado: true });
        await chrome.storage.local.set({ [CHAVE_PERFIL + perfilConta]: novo });
        meuPerfil = novo;
        ctx.emitir('perfil:estado', {});
        marcarQuadros();
        if (comServidor()) acao({ t: P.publicos(novo).length ? 'perfil:resposta' : 'perfil:limpar', para: '*', p: P.compactar(novo) });
        return novo;
      }
      VL.comunidade.perfil = { estado: () => ({ conta: perfilConta, carregado: perfilCarregado, dados: P ? P.normalizar(meuPerfil) : null }), salvar: salvarPerfil };
      carregarPerfil();
      function pedirPerfil(nome) {
        if (!P || !comServidor() || !usaVagalume(nome)) return;
        const chaveNome = chave(nome);
        if (Date.now() - (perguntouPerfil.get(chaveNome) || 0) < 30000) return;
        perguntouPerfil.set(chaveNome, Date.now());
        acao({ t: 'perfil:pedido', para: nome });
      }
      function tratarPerfil(m) {
        if (!P || !m || !m.dado || !m.nome || !comServidor()) return;
        const d = m.dado;
        if (d.t === 'perfil:pedido' && chave(d.para) === chave(meuNome())) {
          if (!perfilCarregado || !P.publicos(meuPerfil).length || Date.now() - (respondeuPerfil.get(chave(m.nome)) || 0) < 15000) return;
          respondeuPerfil.set(chave(m.nome), Date.now());
          acao({ t: 'perfil:resposta', para: m.nome, p: P.compactar(meuPerfil) });
          return;
        }
        if (chave(d.para) !== chave(meuNome()) && d.para !== '*') return;
        if (d.t === 'perfil:limpar') perfisDe.delete(chave(m.nome));
        else if (d.t === 'perfil:resposta' && d.p && typeof d.p === 'object') {
          const remoto = P.expandir(d.p);
          if (!/^[1-9]\d{0,14}$/.test(String(m.autorId || ''))) return;
          if (!P.publicos(remoto).length) return;
          if (perfisDe.size > 200) perfisDe.clear();
          perfisDe.set(chave(m.nome), { dados: remoto, quando: Date.now() });
        } else return;
        marcarQuadros();
      }
      function marcarPerfis() {
        if (!P) return;
        document.querySelectorAll('.nitro-infostand').forEach(function (quadro) {
          const antigo = quadro.querySelector('.vl-conexoes-perfil');
          const posicionar = function (linha) {
            // Logo depois da caixa da missão; sem ela, no fim do quadro, antes da música e dos atalhos.
            const missao = quadro.querySelector('.motto-container');
            if (missao && missao.parentNode) {
              if (missao.nextSibling !== linha) missao.parentNode.insertBefore(linha, missao.nextSibling);
              return;
            }
            const referencia = quadro.querySelector(':scope > .vl-musica') || quadro.querySelector(':scope > .vl-atalhos-quadro');
            if ((referencia && linha.nextElementSibling !== referencia) || (!referencia && linha !== quadro.lastElementChild)) {
              quadro.insertBefore(linha, referencia);
            }
          };
          const nomeEl = quadro.querySelector('.goldfish.fw-bold');
          const nome = nomeEl ? nomeEl.textContent.trim() : '';
          const proprio = !!nome && chave(nome) === chave(meuNome());
          const salvo = usaVagalume(nome) ? perfisDe.get(chave(nome)) : null;
          const dados = proprio ? (perfilCarregado ? meuPerfil : null) : salvo && Date.now() - salvo.quando < 600000 ? salvo.dados : null;
          if (!dados && nome && !proprio) pedirPerfil(nome);
          const ativos = P.publicos(dados);
          if (!ativos.length || !nome || !quadro.querySelector('.body-image .avatar-image')) {
            if (antigo) { if (gatilhoDetalhes && antigo.contains(gatilhoDetalhes)) fecharDetalhes(); antigo.remove(); }
            return;
          }
          const assinatura = nome + '|' + JSON.stringify(ativos.map((s) => [s.id, dados[s.id]]));
          if (antigo && antigo.dataset.chave === assinatura) { posicionar(antigo); return; }
          const linha = document.createElement('div');
          linha.className = 'vl-conexoes-perfil';
          linha.dataset.chave = assinatura;
          linha.setAttribute('aria-label', 'Conexões do perfil');
          const abrir = document.createElement('button');
          abrir.type = 'button'; abrir.className = 'vl-perfil-abrir';
          abrir.title = 'Ver todas as conexões de ' + nome;
          abrir.setAttribute('aria-label', abrir.title);
          abrir.setAttribute('aria-haspopup', 'dialog');
          abrir.setAttribute('aria-expanded', 'false');
          const rotulo = document.createElement('span');
          rotulo.className = 'vl-perfil-rotulo';
          rotulo.textContent = 'Conexões';
          const icones = document.createElement('span');
          icones.className = 'vl-perfil-icones';
          for (const s of ativos.slice(0, 4)) {
            const icone = iconeServico(s.id);
            icone.dataset.servico = s.id;
            icones.appendChild(icone);
          }
          if (ativos.length > 4) {
            const mais = document.createElement('span');
            mais.className = 'vl-perfil-mais';
            mais.textContent = '+' + (ativos.length - 4);
            icones.appendChild(mais);
          }
          abrir.append(rotulo, icones);
          abrir.addEventListener('click', function (ev) { ev.stopPropagation(); abrirDetalhes(abrir, nome, ativos, dados); });
          linha.appendChild(abrir);
          if (antigo) { if (gatilhoDetalhes && antigo.contains(gatilhoDetalhes)) fecharDetalhes(); antigo.remove(); }
          posicionar(linha);
        });
      }

      // Presença: entra na sala do quarto atual; repete a cada 30 s (se a página escondida da extensão
      // fechar, ela volta) e sai ao ir para a vista do hotel.
      let quartoAvisado = null;
      let ultimoAviso = 0;
      function cuidarDaPresenca() {
        carregarPerfil();
        if (!comServidor() || ctx.secao().aparecer === false) {
          if (quartoAvisado != null) { chrome.runtime.sendMessage({ tipo: 'sala:presenca:sair' }).catch(function () {}); quartoAvisado = null; naPresenca.clear(); marcarQuadros(); }
          return;
        }
        const q = VL.pessoas && VL.pessoas.quartoAtual ? VL.pessoas.quartoAtual() : null;
        const id = VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null;
        const nome = VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null;
        if (!q || id == null || !nome) return;
        if (q === quartoAvisado && Date.now() - ultimoAviso < 30000) return;
        if (q !== quartoAvisado) { naPresenca.clear(); perfisDe.clear(); perguntouPerfil.clear(); marcarQuadros(); }
        quartoAvisado = q;
        ultimoAviso = Date.now();
        chrome.runtime.sendMessage({ tipo: 'sala:presenca:entrar', quarto: q, id, nome }).catch(function () {});
      }
      const relogioPresenca = setInterval(cuidarDaPresenca, 3000);
      setTimeout(cuidarDaPresenca, 800);
      function aoAvisoDaSala(m) {
        if (!m || m.de !== 'sala') return;
        if (m.tipo === 'presenca:lista' && String(m.quarto) === String(quartoAvisado)) {
          naPresenca.clear();
          for (const n of m.nomes || []) naPresenca.add(chave(n));
          marcarQuadros();
        } else if (m.tipo === 'presenca:acao' || m.tipo === 'presenca:direto') {
          if (m.tipo === 'presenca:acao') tratarPerfil(m);
          for (const fn of ouvintesAcao) { try { fn(m); } catch (erro) { /* um ouvinte com erro não derruba os outros */ } }
        }
      }
      chrome.runtime.onMessage.addListener(aoAvisoDaSala);
      ctx.aoParar(function () {
        clearInterval(relogioPresenca);
        chrome.runtime.onMessage.removeListener(aoAvisoDaSala);
        if (quartoAvisado != null) chrome.runtime.sendMessage({ tipo: 'sala:presenca:sair' }).catch(function () {});
      });
      ctx.aoParar(function () { delete VL.comunidade; });

      // ---------- entrar no grupo e favoritar (uma vez por conta) ----------
      let verificado = false;
      function lerFeitos() {
        const area = raiz.chrome && chrome.storage && chrome.storage.local;
        if (!area) return Promise.resolve([]);
        return area.get(CHAVE_FEITO).then((r) => (Array.isArray(r[CHAVE_FEITO]) ? r[CHAVE_FEITO] : []), () => []);
      }
      function anotarFeito(id) {
        const area = raiz.chrome && chrome.storage && chrome.storage.local;
        if (!area) return;
        lerFeitos().then(function (lista) {
          if (lista.includes(id)) return;
          area.set({ [CHAVE_FEITO]: lista.concat(id).slice(-50) }).catch(function () {});
        });
      }
      function talvezEntrar(meu) {
        if (verificado || !ctx.secao().entrarNoGrupo || !meu) return;
        verificado = true;
        if (meu.grupo === GRUPO_VAGALUME) { anotarFeito(meu.id); return; } // já está e já favoritou
        lerFeitos().then(function (feitos) {
          if (feitos.includes(meu.id) || !conexao.conectado()) return;
          conexao.enviar(SAIDA.ENTRAR_GRUPO, [['i', GRUPO_VAGALUME]]);
          setTimeout(function () {
            conexao.enviar(SAIDA.FAVORITAR_GRUPO, [['i', GRUPO_VAGALUME]]);
            anotarFeito(meu.id);
            camada.aviso('O Vagalume colocou você no grupo Vagalume e o deixou como favorito, para os outros usuários da extensão verem o seu selo. Para não fazer isso, desligue em Ajustes › Comunidade.', { duracaoMs: 12000 });
          }, 1200);
        });
      }

      const cancelar = [
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { perfisDe.clear(); geracaoPerfil++; perguntouPerfil.clear(); }),
        conexao.ouvir('entrada', ENTRADA.USUARIOS, function (l) {
          let lista;
          try { lista = codigos.lerUsuarios(l).lista; } catch (erro) { return; }
          const meuId = VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null;
          for (const u of lista) {
            if (u.tipo !== 1) continue;
            if (grupoDe.size > 3000) grupoDe.clear();
            grupoDe.set(chave(u.nome), u.grupo);
            if (meuId != null && u.id === meuId) talvezEntrar(u);
          }
          marcarQuadros();
        }),
      ];
      ctx.aoParar(function () { cancelar.forEach((fn) => fn()); });

      // ---------- selo ao lado do apelido ----------
      let tirarCss = null;
      function estilo() {
        if (tirarCss) { tirarCss(); tirarCss = null; }
        if (ctx.secao().selo) tirarCss = camada.estiloPagina('comunidade-selo', CSS_SELO);
      }
      estilo();
      function seloNoBalao(fala) {
        if (!ctx.secao().selo || !fala || !fala.el || !usaVagalume(fala.autor)) return;
        const nome = fala.el.querySelector('.username');
        if (!nome || nome.querySelector('.vl-selo')) return;
        const selo = document.createElement('span');
        selo.className = 'vl-selo';
        selo.title = 'Usa o Vagalume';
        selo.setAttribute('data-vl-trecho', '');
        nome.insertBefore(selo, nome.firstChild);
      }
      ctx.aoParar(jogo.observarFalas(seloNoBalao));
      // No quadro de informações, o selo vem por CSS num atributo do nome (o texto continua do jogo).
      function marcarQuadros() {
        // Quadro de informações, etiqueta de nome do avatar (.nitro-context-menu.name-only > .text-shadow,
        // lido no cliente em 2026-11-14) e cabeçalho do menu do avatar.
        document.querySelectorAll('.nitro-infostand .goldfish.fw-bold, .nitro-context-menu.name-only .text-shadow, .nitro-context-menu .menu-header').forEach(function (n) {
          const quer = ctx.secao().selo && usaVagalume(n.textContent);
          if (quer && !n.hasAttribute('data-vl-usa')) { n.setAttribute('data-vl-usa', ''); n.title = 'Usa o Vagalume'; }
          else if (!quer && n.hasAttribute('data-vl-usa')) n.removeAttribute('data-vl-usa');
        });
        marcarPerfis();
      }
      let pendente = false;
      const observador = new MutationObserver(function () {
        if (pendente) return;
        pendente = true;
        setTimeout(function () { pendente = false; marcarQuadros(); }, 60);
      });
      if (document.body) observador.observe(document.body, { childList: true, subtree: true });
      ctx.aoParar(function () {
        observador.disconnect();
        if (tirarCss) tirarCss();
        document.querySelectorAll('.vl-selo').forEach((e) => e.remove());
        document.querySelectorAll('[data-vl-usa]').forEach((e) => e.removeAttribute('data-vl-usa'));
        document.querySelectorAll('.vl-conexoes-perfil').forEach((e) => e.remove());
      });
      ctx.aoConfig(function (secao) { if (secao === 'comunidade') { estilo(); marcarQuadros(); } });

      ctx.comando({
        nome: 'vagalumes',
        uso: 'vagalumes',
        descricao: 'Mostra quem no quarto usa o Vagalume.',
        executar() {
          const nomes = (VL.pessoas && VL.pessoas.lista ? VL.pessoas.lista() : []).filter(usaVagalume);
          camada.aviso(nomes.length ? 'Com o Vagalume no quarto: ' + nomes.join(', ') + '.' : 'Ninguém mais no quarto usa o Vagalume.');
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
