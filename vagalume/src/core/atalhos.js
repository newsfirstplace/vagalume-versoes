// Vagalume — combinações de teclas: forma canônica, leitura de eventos e validação.
(function (raiz) {
  'use strict';

  const ORDEM = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const APELIDOS_MOD = {
    ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', shift: 'Shift',
    meta: 'Meta', cmd: 'Meta', win: 'Meta', os: 'Meta',
  };
  const NOMEADAS = [
    'Esc', 'Enter', 'Tab', 'Space', 'Insert', 'Delete', 'Home', 'End',
    'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  ];
  const RESERVADAS = new Set([
    'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+R', 'Ctrl+L', 'Ctrl+P', 'Ctrl+S', 'Ctrl+F',
    'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+A', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Tab',
    'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Ctrl+Shift+W', 'Ctrl+Shift+I', 'Ctrl+Shift+J',
    'Alt+F4', 'Alt+Tab', 'Alt+Home', 'Alt+ArrowLeft', 'Alt+ArrowRight',
    'F1', 'F3', 'F5', 'F6', 'F11', 'F12',
  ]);

  function nomeTecla(bruto) {
    if (typeof bruto !== 'string' || !bruto) return '';
    if (bruto === ' ') return 'Space';
    if (/^[a-z0-9]$/i.test(bruto)) return bruto.toUpperCase();
    const f = /^f([1-9]|1[0-2])$/i.exec(bruto);
    if (f) return 'F' + f[1];
    const baixo = bruto.toLowerCase();
    if (baixo === 'escape') return 'Esc';
    return NOMEADAS.find((n) => n.toLowerCase() === baixo) || '';
  }

  function montar(mods, tecla) {
    return ORDEM.filter((m) => mods.has(m)).concat(tecla).join('+');
  }

  // "ctrl + shift+k" -> "Ctrl+Shift+K"; devolve '' se não for uma combinação válida.
  function normalizar(texto) {
    if (typeof texto !== 'string') return '';
    const partes = texto.split('+').map((p) => p.trim()).filter(Boolean);
    const mods = new Set();
    let tecla = '';
    for (const p of partes) {
      const mod = APELIDOS_MOD[p.toLowerCase()];
      if (mod) { mods.add(mod); continue; }
      if (tecla) return '';
      tecla = nomeTecla(p);
      if (!tecla) return '';
    }
    return tecla ? montar(mods, tecla) : '';
  }

  // Lê um KeyboardEvent. Usa `code` para letras e dígitos, assim Alt/Shift não trocam o caractere.
  function deEvento(ev) {
    if (!ev || ['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(ev.key)) return '';
    let tecla = '';
    const letra = /^Key([A-Z])$/.exec(ev.code || '');
    const digito = /^Digit(\d)$/.exec(ev.code || '');
    if (letra) tecla = letra[1];
    else if (digito) tecla = digito[1];
    else tecla = nomeTecla(ev.key);
    if (!tecla) return '';
    const mods = new Set();
    if (ev.ctrlKey) mods.add('Ctrl');
    if (ev.altKey) mods.add('Alt');
    if (ev.shiftKey) mods.add('Shift');
    if (ev.metaKey) mods.add('Meta');
    return montar(mods, tecla);
  }

  function validar(texto) {
    const combo = normalizar(texto);
    if (!combo) return { ok: false, combo: '', motivo: 'Combinação não reconhecida.' };
    if (RESERVADAS.has(combo)) return { ok: false, combo, motivo: 'Essa combinação é usada pelo navegador.' };
    const ehF = /(^|\+)F\d{1,2}$/.test(combo);
    const temMod = /(^|\+)(Ctrl|Alt|Meta)\+/.test(combo + '+') && combo.includes('+');
    if (!ehF && !temMod) return { ok: false, combo, motivo: 'Inclua Ctrl ou Alt para não atrapalhar a digitação.' };
    return { ok: true, combo, motivo: '' };
  }

  const api = { normalizar, deEvento, validar, RESERVADAS };
  raiz.VL = raiz.VL || {};
  raiz.VL.atalhos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
