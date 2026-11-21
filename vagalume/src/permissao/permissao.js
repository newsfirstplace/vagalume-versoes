// Vagalume — pede ao Chrome uma permissão opcional. Só pode pedir aqui, numa página da extensão
// e com o clique do usuário. Dois usos:
//   ?d=<domínio>  mostrar esse site dentro do visor do Habblet;
//   ?captura=1    tirar prints da aba do hotel sem atalho (o Chrome só libera isso com a permissão
//                 de todos os sites; o Vagalume usa só para a captura).
'use strict';
(function () {
  const busca = new URLSearchParams(location.search);
  const ehCaptura = busca.get('captura') === '1';
  const ehMicrofone = busca.get('microfone') === '1';
  const ehSteam = busca.get('steam') === '1';
  const dominio = String(busca.get('d') || '').toLowerCase();
  const titulo = document.getElementById('titulo');
  const texto1 = document.getElementById('texto1');
  const texto2 = document.getElementById('texto2');
  const estado = document.getElementById('estado');
  const permitir = document.getElementById('permitir');
  let origens = null;

  function escrever(no, partes) {
    no.replaceChildren(...partes.map(function (p) {
      if (typeof p === 'string') return document.createTextNode(p);
      const forte = document.createElement('strong');
      forte.textContent = p.forte;
      return forte;
    }));
  }

  if (ehMicrofone) {
    titulo.textContent = 'Usar o microfone no Vagalume?';
    escrever(texto1, ['Para gravar áudios do chat e falar na chamada do quarto, o Vagalume precisa do microfone. O Habblet bloqueia o microfone na página do jogo, então quem grava é a própria extensão.']);
    escrever(texto2, ['O microfone só fica ligado enquanto você grava um áudio ou está numa chamada. Nada é gravado na chamada. Dá para retirar em chrome://settings/content/microphone.']);
  } else if (ehSteam) {
    titulo.textContent = 'Confirmar seu perfil Steam?';
    escrever(texto1, ['Para confirmar que o perfil é seu, o Vagalume lê a página pública do seu perfil em ', { forte: 'steamcommunity.com' }, ' e procura o código que você colocou no resumo.']);
    escrever(texto2, ['A leitura é feita sem a sua sessão do Steam e só quando você clica em Conferir. Dá para retirar a permissão em chrome://extensions, nos detalhes do Vagalume.']);
    origens = ['https://steamcommunity.com/*'];
  } else if (ehCaptura) {
    titulo.textContent = 'Tirar prints com um clique?';
    escrever(texto1, ['Sem esta permissão, o Chrome só deixa o Vagalume tirar print depois do atalho dele ou de um clique no ícone dele. Com ela, o botão de captura e o comando funcionam sempre.']);
    escrever(texto2, ['O Chrome vai mostrar o aviso de ', { forte: 'acesso a todos os sites' }, ', porque não existe uma permissão só de captura. O Vagalume usa esta permissão só para fotografar a aba do hotel. Dá para retirar em chrome://extensions, nos detalhes do Vagalume.']);
    origens = ['<all_urls>'];
  } else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dominio)) {
    titulo.textContent = 'Mostrar este site no Habblet?';
    escrever(texto1, ['O Vagalume quer mostrar ', { forte: dominio }, ' dentro do visor, por cima do Habblet. Para isso, tira os bloqueios de quadro desse site só no visor; o site aberto numa aba normal não muda.']);
    escrever(texto2, ['Dá para retirar a permissão em chrome://extensions, nos detalhes do Vagalume.']);
    origens = ['https://' + dominio + '/*', 'https://*.' + dominio + '/*'];
  } else {
    titulo.textContent = 'Pedido inválido';
  }
  if (!ehMicrofone && !origens) {
    permitir.disabled = true;
  }

  document.getElementById('cancelar').addEventListener('click', function () { window.close(); });
  permitir.addEventListener('click', function () {
    if (ehMicrofone) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (fluxo) {
        fluxo.getTracks().forEach((t) => t.stop());
        estado.textContent = 'Permitido. Pode voltar ao Habblet.';
        setTimeout(function () { window.close(); }, 900);
      }, function () { estado.textContent = 'O microfone não foi permitido.'; });
      return;
    }
    if (!origens) return;
    chrome.permissions.request({ origins: origens }).then(function (ok) {
      estado.textContent = ok ? 'Permitido. Pode voltar ao Habblet.' : 'Não foi permitido.';
      if (ok) setTimeout(function () { window.close(); }, 900);
    }, function (erro) {
      estado.textContent = 'O Chrome recusou o pedido: ' + (erro && erro.message ? erro.message : erro);
    });
  });
})();
