// Vagalume — utilidades de texto: links, acentos, horário e limpeza de CSS.
(function (raiz) {
  'use strict';

  function semAcento(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // Só aceita http e https; qualquer outro esquema (javascript:, data:, file:) é recusado.
  function linkSeguro(bruto) {
    try {
      const u = new URL(bruto);
      return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname ? u.href : '';
    } catch (e) {
      return '';
    }
  }

  function acharLinks(texto) {
    const achados = String(texto == null ? '' : texto).match(/\bhttps?:\/\/[^\s<>"'`]+/gi) || [];
    const vistos = new Set();
    const saida = [];
    for (let bruto of achados) {
      bruto = bruto.replace(/[)\].,;:!?]+$/, '');
      const url = linkSeguro(bruto);
      if (url && !vistos.has(url)) { vistos.add(url); saida.push(url); }
    }
    return saida;
  }

  // Posições dos links num texto: [{ inicio, fim, url }]. Aceita http, https e "www." (vira https).
  function trechosDeLink(texto) {
    const s = String(texto == null ? '' : texto);
    const saida = [];
    const re = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
    let m;
    while ((m = re.exec(s))) {
      const bruto = m[0].replace(/[)\].,;:!?]+$/, '');
      const url = linkSeguro(/^www\./i.test(bruto) ? 'https://' + bruto : bruto);
      if (url) saida.push({ inicio: m.index, fim: m.index + bruto.length, url });
    }
    return saida;
  }

  // Posições das menções "@apelido": [{ inicio, fim, nome }]. Com a lista de apelidos conhecidos
  // (pessoas do quarto), vale o mais longo que casar, mesmo com vírgula ou ponto ("@habblet,city");
  // sem casar com ninguém, vale até o primeiro espaço, sem a pontuação do fim.
  function trechosDeArroba(texto, conhecidos) {
    const s = String(texto == null ? '' : texto);
    const nomes = (conhecidos || []).map(String).filter(Boolean).sort((a, b) => b.length - a.length);
    const saida = [];
    const re = /@([^\s@]+)/g;
    let m;
    while ((m = re.exec(s))) {
      if (m.index > 0 && /[\w.]/.test(s[m.index - 1])) continue; // e-mail, não menção
      const resto = s.slice(m.index + 1).toLowerCase();
      let nome = nomes.find((n) => resto.startsWith(n.toLowerCase()) && !/[\w]/.test(resto.charAt(n.length) || ' '));
      if (nome) nome = s.substr(m.index + 1, nome.length);
      else nome = m[1].replace(/[.,;:!?)\]]+$/, '');
      if (!nome) continue;
      saida.push({ inicio: m.index, fim: m.index + 1 + nome.length, nome });
      re.lastIndex = m.index + 1 + nome.length;
    }
    return saida;
  }

  function hospedeiro(url) {
    try { return new URL(url).hostname; } catch (e) { return ''; }
  }

  function doisDigitos(n) { return String(n).padStart(2, '0'); }

  function hora(quando) {
    const d = new Date(quando);
    return doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes()) + ':' + doisDigitos(d.getSeconds());
  }

  // CSS do usuário: sem @import e sem url() remota, para que um estilo importado
  // de terceiros não consiga fazer a página buscar endereços externos.
  function limparCss(css, maximo) {
    let s = String(css == null ? '' : css).slice(0, maximo || 20000);
    s = s.replace(/<\/?style[^>]*>/gi, '');
    s = s.replace(/@import\b[^;]*;?/gi, '');
    s = s.replace(/image-set\s*\([^)]*\)/gi, 'none');
    // A verificação de "data:" fica dentro do lookahead, com os espaços: assim o \s* não volta atrás.
    s = s.replace(/url\s*\((?!\s*['"]?data:)[^)]*\)/gi, 'none');
    return s;
  }

  const api = { semAcento, linkSeguro, acharLinks, trechosDeLink, trechosDeArroba, hospedeiro, hora, limparCss };
  raiz.VL = raiz.VL || {};
  raiz.VL.texto = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
