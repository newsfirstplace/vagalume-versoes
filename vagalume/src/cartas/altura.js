// Camada do host: o popup da extensão crescia com o conteúdo; no Vagalume o jogo roda num quadro da janela de Jogos,
// que segue a altura da página por esta mensagem. Aberta sozinha (fora de um quadro), não faz nada.
if (window.parent !== window) {
  const avisar = () => window.parent.postMessage({ vagalume: "cartas:altura", h: Math.ceil(document.body.getBoundingClientRect().height) }, "*");
  new ResizeObserver(avisar).observe(document.body);
}
