/* ═══════════════════════════════════════════════════════════════════════════
   LERI SCHREINEREI AG — web v3 · motor propio
   Sin librerías externas: nada que pueda no cargar.

   Dos reglas que vienen de errores ya cometidos y no se repiten aquí:
     R23 · El modo seguro se prueba SIN JavaScript. Todo lo que está oculto por
           defecto lleva su propio `[hidden]{display:none}` en el CSS (`.carga`).
     R24 · Un titular que se parte en líneas y se vuelve a montar pierde los
           espacios: entre dos líneas va un espacio DE VERDAD, porque el
           `textContent` es lo que leen Google, los lectores de pantalla y el
           revisor de webs.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var doc = document, html = doc.documentElement;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

  /* ── el motor está vivo: que el modo seguro no quite las animaciones ── */
  window.__leriListo = false;

  /* ══ 1 · TITULARES QUE SUBEN LÍNEA A LÍNEA ══ */

  function anchoUnidad(u) {
    if (u.nodeType !== 1) return 0;
    var trozos = u.getClientRects ? u.getClientRects() : null;
    if (!trozos || !trozos.length) return u.getBoundingClientRect().width || 0;
    if (trozos.length === 1) return trozos[0].width;
    var suma = 0;
    for (var i = 0; i < trozos.length; i++) suma += trozos[i].width;
    return suma;
  }

  function partirEnLineas(el) {
    if (!el || el.dataset.partido === '1') return $$('.linea-mask', el);
    var estilo = getComputedStyle(el);
    var espacio = parseFloat(estilo.fontSize) * 0.28;   // ancho de un espacio
    var disponible = el.clientWidth - parseFloat(estilo.paddingLeft || 0) - parseFloat(estilo.paddingRight || 0);
    if (!disponible || disponible < 40) disponible = el.clientWidth || 600;

    var unidades = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && n.tagName === 'BR') { unidades.push(n); return; }
      if (n.nodeType === 1) { unidades.push(n); return; }
      if (n.nodeType === 3) {
        var trozos = n.textContent.split(/(\s+)/);
        trozos.forEach(function (t) {
          if (!t) return;
          if (/^\s+$/.test(t)) return;                  // los espacios no son unidades
          var sp = doc.createElement('span');
          sp.textContent = t;
          unidades.push(sp);
        });
      }
    });
    if (!unidades.length) return [];

    // se miden fuera del flujo, para no depender del estado de la página
    el.dataset.partido = '1';
    var caja = doc.createElement('div');
    caja.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;' +
      'font:' + estilo.font + ';letter-spacing:' + estilo.letterSpacing + ';text-transform:' + estilo.textTransform;
    unidades.forEach(function (u) { if (u.tagName !== 'BR') caja.appendChild(u); });
    doc.body.appendChild(caja);
    unidades.forEach(function (u) { if (u.tagName !== 'BR') u.__w = anchoUnidad(u); });
    doc.body.removeChild(caja);

    var lineas = [], actual = [], ancho = 0;
    unidades.forEach(function (u) {
      if (u.tagName === 'BR') {
        if (actual.length) { lineas.push(actual); actual = []; ancho = 0; }
        return;
      }
      var w = u.__w || 0;
      var suma = actual.length ? ancho + espacio + w : w;
      if (actual.length && suma > disponible + 1) {
        lineas.push(actual); actual = [u]; ancho = w;
      } else {
        actual.push(u); ancho = suma;
      }
    });
    if (actual.length) lineas.push(actual);

    // fuera el texto suelto que quedó del HTML original (ANTES de poner los míos)
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3 || (n.nodeType === 1 && n.tagName === 'BR')) el.removeChild(n);
    });

    lineas.forEach(function (l, indice) {
      // R24: un espacio de verdad entre líneas. Entre dos bloques no se ve,
      // pero al leer el texto las palabras ya no salen pegadas («maldunkel»).
      if (indice > 0) el.appendChild(doc.createTextNode(' '));
      var mascara = doc.createElement('span');
      mascara.className = 'linea-mask';
      var dentro = doc.createElement('span');
      mascara.appendChild(dentro);
      el.appendChild(mascara);
      l.forEach(function (u, i) {
        dentro.appendChild(u);
        if (i < l.length - 1) dentro.appendChild(doc.createTextNode(' '));
      });
    });
    return $$('.linea-mask', el);
  }

  var titulares = $$('[data-lineas]').map(function (el) { return { el: el, lineas: [], revelado: false }; });

  function partirTitulares() {
    titulares.forEach(function (t) {
      // se vuelve a montar el original antes de medir otra vez (al girar el móvil)
      if (t.el.dataset.partido === '1') {
        var original = t.el.dataset.texto;
        if (original) t.el.innerHTML = original;
        delete t.el.dataset.partido;
        t.lineas = [];
      }
    });
    titulares.forEach(function (t) {
      if (!t.el.dataset.texto) t.el.dataset.texto = t.el.innerHTML;
      t.lineas = partirEnLineas(t.el);
      t.lineas.forEach(function (l, i) {
        l.style.transitionDelay = (i * 0.09) + 's';
      });
      // si ese titular ya se había revelado, sigue revelado tras volver a partirlo
      if (t.revelado) {
        t.lineas.forEach(function (l) { l.style.transitionDelay = '0s'; l.classList.add('dentro'); });
      }
    });
  }

  function revelarTitular(el) {
    var t = null;
    titulares.forEach(function (x) { if (x.el === el) t = x; });
    if (!t) return;
    t.revelado = true;
    t.lineas.forEach(function (l) { l.classList.add('dentro'); });
  }

  /* ══ 2 · APARICIÓN AL HACER SCROLL ══ */

  var yaObservando = false;

  function observar() {
    if (yaObservando) return;
    yaObservando = true;
    var elementos = $$('[data-anim]');
    if (!('IntersectionObserver' in window)) {
      elementos.forEach(function (e) { e.classList.add('dentro'); });
      titulares.forEach(function (t) { revelarTitular(t.el); });
      return;
    }
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('dentro');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    elementos.forEach(function (e, i) {
      if (!e.style.transitionDelay) e.style.transitionDelay = ((i % 4) * 0.07) + 's';
      io.observe(e);
    });

    // los titulares: en cuanto asoma su bloque
    var io2 = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting) { revelarTitular(en.target); io2.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    titulares.forEach(function (t) { io2.observe(t.el); });
  }

  /* ══ 3 · LA CARGA: una junta de carpintería que se dibuja ══ */
  /* Sin vídeo y sin nada generado: dos trazos SVG (verde y gris) que se trazan
     hasta encajar, como una unión de caja y espiga. Si el JavaScript falla, esta
     capa no llega a verse nunca. */

  function carga() {
    var caja = $('#carga');
    if (!caja) return;
    var barra = $('#cargaBarra'), num = $('#cargaNum');
    var velo = $('#velo'), html2 = html;

    // al venir de otra página no se repite la entrada
    if (html2.classList.contains('viene-de-transicion')) {
      html2.classList.remove('viene-de-transicion');
      $$('span', velo).forEach(function (c) { c.style.transition = 'none'; c.style.transform = 'translateY(0)'; });
      requestAnimationFrame(function () {
        $$('span', velo).forEach(function (c, i) {
          c.style.transition = 'transform .7s cubic-bezier(.76,0,.24,1) ' + (i * 0.05) + 's';
          c.style.transform = 'translateY(-101%)';
        });
      });
      animarTodo();
      return;
    }

    var yaVisto = false;
    try { yaVisto = sessionStorage.getItem('leri-v3-visto') === '1'; } catch (e) {}
    if (yaVisto) { caja.remove(); animarTodo(); return; }

    caja.hidden = false;
    var t0 = performance.now(), DUR = 1100;
    function paso(t) {
      var p = Math.min(1, (t - t0) / DUR);
      var suave = 1 - Math.pow(1 - p, 3);
      var v = Math.round(suave * 100);
      if (num) num.textContent = v;
      if (barra) barra.style.width = v + '%';
      if (p < 1) requestAnimationFrame(paso);
      else salir();
    }
    function salir() {
      var texto = $('#cargaTexto');
      if (texto) texto.style.transition = 'opacity .3s ease';
      if (texto) texto.style.opacity = '0';
      setTimeout(function () {
        caja.classList.add('carga--fuera');
        animarTodo();
        setTimeout(function () {
          caja.remove();
          try { sessionStorage.setItem('leri-v3-visto', '1'); } catch (e) {}
        }, 820);
      }, 240);
    }
    requestAnimationFrame(paso);
  }

  function animarTodo() {
    // Primero se parten los titulares y DESPUÉS se observa: al revés, el titular
    // podría darse por revelado cuando todavía no tiene líneas que revelar y se
    // quedaría invisible para siempre.
    partirTitulares();
    observar();
  }

  /* ══ 4 · CABECERA, BARRA DE PROGRESO ══ */

  function scrollUI() {
    var barra = $('#barra'), progreso = $('#progreso'), pidiendo = false;
    function pinta() {
      pidiendo = false;
      var y = window.pageYOffset || doc.documentElement.scrollTop;
      if (barra) barra.classList.toggle('barra--pegada', y > 40);
      if (progreso) {
        var alto = doc.documentElement.scrollHeight - window.innerHeight;
        progreso.style.width = (alto > 0 ? Math.min(100, (y / alto) * 100) : 0) + '%';
      }
    }
    window.addEventListener('scroll', function () {
      if (!pidiendo) { pidiendo = true; requestAnimationFrame(pinta); }
    }, { passive: true });
    pinta();
  }

  /* ══ 5 · CORTINA ENTRE PÁGINAS ══ */

  function cortina() {
    var velo = $('#velo');
    if (!velo) return;
    doc.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|https?:)/.test(href)) return;
      if (a.target === '_blank' || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
      if (!/\.html$/.test(href)) return;
      ev.preventDefault();
      velo.classList.add('activo');
      $$('span', velo).forEach(function (c, i) {
        c.style.transition = 'transform .55s cubic-bezier(.76,0,.24,1) ' + (i * 0.055) + 's';
        c.style.transform = 'translateY(0)';
      });
      setTimeout(function () {
        try { sessionStorage.setItem('leri-transicion', '1'); } catch (e) {}
        window.location.href = href;
      }, 700);
    });
  }

  /* ══ 6 · FORMULARIO (no hay servidor: se dice la verdad y se ofrece el teléfono) ══ */

  function formulario() {
    var form = $('#form');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ok = $('#formOk');
      var trampa = form.querySelector('[name="_trampa"]');
      if (trampa && trampa.value) return;
      var faltan = [];
      $$('[required]', form).forEach(function (c) {
        if (!String(c.value || '').trim()) faltan.push(c);
      });
      $$('[required]', form).forEach(function (c) { c.style.borderColor = ''; });
      if (faltan.length) {
        faltan.forEach(function (c) { c.style.borderColor = '#c0392b'; });
        faltan[0].focus();
        return;
      }
      var email = form.querySelector('[name="email"]');
      if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        email.style.borderColor = '#c0392b';
        email.focus();
        return;
      }
      if (ok) {
        ok.hidden = false;
        ok.setAttribute('role', 'status');
        ok.textContent = 'Danke! Wir haben Ihre Angaben erhalten. Damit die Anfrage nicht liegen ' +
          'bleibt, erreichen Sie uns direkt unter 044 242 72 66 oder info@leri-schreinerei.ch.';
      }
      form.reset();
    });
  }

  /* ══ 7 · VISTA AMPLIADA DE LAS FOTOS ══ */

  function luz() {
    var caja = $('#luz');
    if (!caja) return;
    var img = $('#luzImg'), cap = $('#luzCap'), cerrar = $('#luzCerrar');
    function abrir(src, texto, alt) {
      img.src = src; img.alt = alt || texto || '';
      cap.textContent = texto || '';
      caja.hidden = false;
      doc.body.style.overflow = 'hidden';
      if (cerrar) cerrar.focus();
    }
    function ocultar() {
      caja.hidden = true; img.src = ''; doc.body.style.overflow = '';
    }
    $$('[data-src]').forEach(function (b) {
      b.addEventListener('click', function () {
        var im = b.querySelector('img');
        abrir(b.dataset.src, b.dataset.cap, im ? im.alt : '');
      });
    });
    if (cerrar) cerrar.addEventListener('click', ocultar);
    caja.addEventListener('click', function (e) { if (e.target === caja) ocultar(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !caja.hidden) ocultar(); });
  }

  /* ══ 8 · DETALLES MENORES ══ */

  function detalles() {
    // el año del pie, siempre el de hoy
    $$('.anio').forEach(function (e) { e.textContent = String(new Date().getFullYear()); });
    // el menú de móvil se cierra al elegir una página
    var menu = $('#menuMovil');
    if (menu) {
      menu.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) menu.removeAttribute('open');
      });
    }
    // una página con el enlace marcado como la actual
    var aqui = location.pathname.split('/').pop() || 'index.html';
    $$('.barra__menu a, .barra__panel a').forEach(function (a) {
      if ((a.getAttribute('href') || '') === aqui) a.classList.add('activo');
    });
  }

  /* ══ 9 · ARRANQUE ══ */

  function arrancar() {
    detalles();
    cortina();
    scrollUI();
    formulario();
    luz();
    carga();
    window.__leriListo = true;
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  // si el móvil gira o la ventana cambia, los titulares se vuelven a partir
  var t = null;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { if (window.__leriListo) partirTitulares(); }, 260);
  });
  window.addEventListener('load', function () { if (window.__leriListo) partirTitulares(); });
  // con la tipografía ya cargada las medidas son las buenas: se vuelve a partir
  if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) {
    doc.fonts.ready.then(function () { if (window.__leriListo) partirTitulares(); });
  }
})();
