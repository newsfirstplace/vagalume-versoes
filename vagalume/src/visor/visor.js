// Vagalume — visor: mostra a página de um link (da missão) por cima do Habblet, com o tema do Vagalume.
// O site fica num quadro isolado (sandbox), sem acesso ao Habblet nem à extensão.
'use strict';
(function () {
  const parametro = new URLSearchParams(location.search).get('u') || '';
  let url = null;
  try {
    const u = new URL(parametro);
    if (u.protocol === 'https:' || u.protocol === 'http:') url = u.href;
  } catch (erro) { /* inválido */ }
  const site = document.getElementById('site');
  const historico = []; // páginas anteriores abertas neste visor
  const voltar = document.getElementById('voltar');
  function mostrarEndereco() { document.getElementById('endereco').textContent = url ? url.replace(/^https?:\/\//, '') : '(endereço inválido)'; voltar.hidden = !historico.length; }
  const aviso = document.getElementById('aviso');
  const texto = document.getElementById('texto');
  const permitir = document.getElementById('permitir');
  mostrarEndereco();

  function fechar() { descarregar(); window.parent.postMessage({ vagalume: 'visor:fechar' }, '*'); }
  document.getElementById('fechar').addEventListener('click', fechar);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fechar(); });
  document.getElementById('aba').addEventListener('click', function () { if (url) window.open(url, '_blank', 'noopener,noreferrer'); fechar(); });
  document.getElementById('janela').addEventListener('click', function () {
    if (!url) return;
    const l = Math.min(960, Math.max(480, screen.availWidth - 80));
    const a = Math.min(600, Math.max(400, screen.availHeight - 80));
    window.open(url, 'vl-missao', 'popup=yes,noopener,noreferrer,width=' + l + ',height=' + a + ',left=' + Math.round((screen.availWidth - l) / 2) + ',top=' + Math.round((screen.availHeight - a) / 2));
    fechar();
  });

  // Volume do site (0 a 100): guardado na extensão e mandado ao site por mensagem.
  const volume = document.getElementById('volume');
  const mudo = document.getElementById('mudo');
  const rotulo = document.getElementById('nivel');
  let nivel = 30;
  let antesDoMudo = 30;
  function enviarVolume() {
    volume.value = String(nivel);
    rotulo.textContent = nivel + '%';
    mudo.textContent = nivel === 0 ? '🔇' : '🔊';
    mudo.title = nivel === 0 ? 'Voltar o som' : 'Silenciar o site';
    if (site.contentWindow) site.contentWindow.postMessage({ vagalume: 'volume', valor: nivel / 100 }, '*');
  }
  function guardarVolume() { chrome.storage.local.set({ 'vl.visorVolume': nivel }).catch(function () {}); }
  chrome.storage.local.get('vl.visorVolume').then(function (r) {
    const v = Number(r['vl.visorVolume']);
    if (Number.isFinite(v)) nivel = Math.min(100, Math.max(0, Math.round(v)));
    enviarVolume();
  }, function () { enviarVolume(); });
  volume.addEventListener('input', function () { nivel = Number(volume.value); if (nivel > 0) antesDoMudo = nivel; enviarVolume(); guardarVolume(); });
  mudo.addEventListener('click', function () {
    if (nivel > 0) { antesDoMudo = nivel; nivel = 0; } else nivel = antesDoMudo || 30;
    enviarVolume();
    guardarVolume();
  });
  // O site pode criar o som um pouco depois de carregar: manda de novo.
  site.addEventListener('load', function () { enviarVolume(); setTimeout(enviarVolume, 600); setTimeout(enviarVolume, 2000); });

  function mostrarSite() {
    aviso.hidden = true;
    site.hidden = false;
    site.src = url;
  }
  function preparar() {
    if (!url) { texto.textContent = 'Este endereço não pode ser aberto.'; return; }
    texto.textContent = 'Preparando…';
    chrome.runtime.sendMessage({ tipo: 'visor:preparar', url }).then(function (r) {
      if (r && r.ok) { mostrarSite(); return; }
      if (r && r.erro === 'sem-permissao') {
        texto.textContent = 'Para mostrar ' + r.dominio + ' aqui dentro, o Vagalume precisa da sua permissão para esse site. Ela tira os bloqueios de quadro do site só neste visor (o site numa aba normal não muda).';
        permitir.textContent = 'Permitir ' + r.dominio;
        permitir.hidden = false;
        permitir.onclick = function () {
          const origens = ['https://' + r.dominio + '/*', 'https://*.' + r.dominio + '/*'];
          chrome.permissions.request({ origins: origens }).then(function (ok) {
            if (ok) preparar(); else texto.textContent = 'Sem a permissão, use Abrir em janela.';
          }, function () {
            // Fora de uma página de primeiro plano o Chrome pode recusar: pede pela janelinha da extensão.
            chrome.runtime.sendMessage({ tipo: 'link:permitir', url });
            texto.textContent = 'Responda na janelinha que abriu; depois clique no link de novo.';
          });
        };
        return;
      }
      texto.textContent = 'Não deu para preparar o visor. Use Abrir em janela.';
    }, function () { texto.textContent = 'Não deu para falar com a extensão. Use Abrir em janela.'; });
  }
  // Links clicados dentro do site (ver principal/volume.js): troca a página aqui mesmo.
  // Som de uma página só (relato do usuário em 2026-11-15: o som da página anterior se misturava ao
  // da nova). Ao trocar, a página antiga sai na hora, antes de a nova carregar ou de pedir permissão.
  function descarregar() { try { site.src = 'about:blank'; } catch (erro) { /* nada */ } }
  window.addEventListener('pagehide', descarregar);
  function irPara(novo) {
    let u;
    try { u = new URL(novo); } catch (erro) { return; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
    if (url && u.href === url) return;
    if (url) historico.push(url);
    if (historico.length > 30) historico.shift();
    url = u.href;
    mostrarEndereco();
    descarregar();
    site.hidden = true;
    aviso.hidden = false;
    permitir.hidden = true;
    preparar();
  }
  window.addEventListener('message', function (ev) {
    const d = ev.data;
    if (!d || d.vagalume !== 'visor:abrir' || ev.source !== site.contentWindow || typeof d.url !== 'string') return;
    irPara(d.url);
  });
  voltar.addEventListener('click', function () {
    if (!historico.length) return;
    url = historico.pop();
    mostrarEndereco();
    descarregar();
    site.hidden = true;
    aviso.hidden = false;
    permitir.hidden = true;
    preparar();
  });
  preparar();
})();
