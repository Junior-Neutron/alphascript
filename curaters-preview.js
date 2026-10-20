/* =====================================================================
   CURATERS — interactive layer (preview)
   Vanilla JS, no build step. Reads trip data from the data-* attributes
   on each .trip-card, so it works with whatever the server renders.
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- safe storage ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var money = function (n) {
    var whole = Math.abs(n - Math.round(n)) < 0.005;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  };
  var ICON = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    heart: '<svg viewBox="0 0 24 24" stroke-linejoin="round"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3 5 6.3 5c2 0 3.4 1.1 5.7 3.4C14.3 6.1 15.7 5 17.7 5 21 5 22.9 8.3 21.5 11.7 19.5 16.4 12 21 12 21z"/></svg>'
  };

  /* ---------- toast ---------- */
  var toastBox = $('.cur-toasts');
  function toast(msg, emoji) {
    if (!toastBox) return;
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = '<i>' + (emoji || '✨') + '</i><span></span>';
    t.lastChild.textContent = msg;
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, 3200);
  }

  function confetti() {
    if (reduce) return;
    var cols = ['#ffc531', '#ff6b4a', '#14b8b0', '#ffffff', '#ff9a5a', '#6a3fb5'];
    for (var i = 0; i < 70; i++) {
      var c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = (Math.random() * 100) + 'vw';
      c.style.background = cols[i % cols.length];
      c.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
      c.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      c.style.animationDelay = (Math.random() * .5) + 's';
      c.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      document.body.appendChild(c);
      setTimeout((function (el) { return function () { el.remove(); }; })(c), 4500);
    }
  }

  /* ---------- page chrome: progress, nav shadow, back-to-top ---------- */
  var bar = $('.cur-progress'), nav = $('.cur-nav'), topBtn = $('.cur-top');
  function onScroll() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
    if (nav) nav.classList.toggle('is-stuck', h.scrollTop > 8);
    if (topBtn) topBtn.classList.toggle('show', h.scrollTop > 700);
    var sun = $('.cur-hero-bg .sun');
    if (sun && !reduce && h.scrollTop < 900) sun.style.translate = '0 ' + (h.scrollTop * .25) + 'px';
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (topBtn) topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  /* hero: sun follows the pointer a little */
  var hero = $('.cur-hero');
  if (hero && fine && !reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5;
      var sun = $('.sun', hero); if (sun) sun.style.marginRight = (x * 40) + 'px';
    });
  }

  /* count-up numbers */
  function countUp(el) {
    var end = parseFloat(el.dataset.count), pre = el.dataset.prefix || '';
    if (isNaN(end)) return;
    if (reduce) { el.textContent = pre + end.toLocaleString(); return; }
    var t0 = performance.now(), dur = 1100;
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + Math.round(end * e).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* =====================================================================
     TRIPS (day / group / hosted)
     ===================================================================== */
  var grid = $('#grid');
  var cards = grid ? $$('.trip-card', grid) : [];
  var trips = cards.map(function (el, i) {
    var d = el.dataset;
    return {
      el: el, idx: i, id: d.id || ('t' + i), title: d.title, loc: d.loc || '', price: parseFloat(d.price) || 0,
      slots: d.slots ? parseInt(d.slots, 10) : null, min: d.min ? parseInt(d.min, 10) : null,
      max: d.max ? parseInt(d.max, 10) : null, href: d.href, type: d.type,
      img: d.img || '', video: d.video || '', desc: (el.querySelector('.tc-desc') || {}).textContent || ''
    };
  });
  var cap = function (t) { return t.slots != null ? t.slots : (t.max != null ? t.max : 99); };

  /* ----- saved (wishlist) ----- */
  var KEY = 'curaters_saved_v1';
  var saved = store.get(KEY, []);
  var isSaved = function (t) { return saved.indexOf(t.id) > -1; };
  var allTrips = trips; // on this page
  function persist() { store.set(KEY, saved); renderSaved(); }
  var countEls = $$('[data-saved-count]');
  function toggleSave(t, silent) {
    var i = saved.indexOf(t.id);
    if (i > -1) { saved.splice(i, 1); if (!silent) toast('Removed from your saved trips', '💔'); }
    else { saved.push(t.id); if (!silent) toast('Saved “' + t.title + '”', '❤️'); }
    persist(); syncHearts();
    countEls.forEach(function (c) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); });
    if (state && state.savedOnly) apply();
  }
  function syncHearts() {
    trips.forEach(function (t) {
      var b = $('.tc-save', t.el); if (b) b.setAttribute('aria-pressed', isSaved(t) ? 'true' : 'false');
    });
    var ms = $('#mSave'); if (ms && current) ms.setAttribute('aria-pressed', isSaved(current) ? 'true' : 'false');
    countEls.forEach(function (c) { c.textContent = saved.length; });
  }

  /* ----- drawer ----- */
  var drawer = $('#drawer');
  function renderSaved() {
    var list = $('#drawerList'); if (!list) return;
    var items = trips.filter(isSaved);
    var guests = state ? state.guests : 2;
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<div class="cd-empty"><svg viewBox="0 0 24 24" stroke-linejoin="round"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3 5 6.3 5c2 0 3.4 1.1 5.7 3.4C14.3 6.1 15.7 5 17.7 5 21 5 22.9 8.3 21.5 11.7 19.5 16.4 12 21 12 21z"/></svg><b>No saved trips yet</b><p>Tap the heart on any trip to keep it here.</p></div>';
    }
    var total = 0;
    items.forEach(function (t, k) {
      total += t.price * guests;
      var row = document.createElement('div'); row.className = 'cd-item'; row.style.animationDelay = (k * 60) + 'ms';
      row.innerHTML = (t.img ? '<img alt="" src="' + t.img + '">' : '<div class="ph"></div>') +
        '<div><b></b><span></span></div><button class="rm" type="button" aria-label="Remove">' + ICON.x + '</button>';
      $('b', row).textContent = t.title;
      $('span', row).textContent = (t.loc ? t.loc + ' · ' : '') + money(t.price);
      $('img', row) && $('img', row).addEventListener('click', function () { closeDrawer(); openModal(t); });
      $('b', row).style.cursor = 'pointer';
      $('b', row).addEventListener('click', function () { closeDrawer(); openModal(t); });
      $('.rm', row).addEventListener('click', function () { toggleSave(t, true); });
      list.appendChild(row);
    });
    var tot = $('#drawerTotal'), g = $('#drawerGuests'), foot = $('#drawerFoot');
    if (tot) tot.textContent = money(total);
    if (g) g.textContent = guests + (guests === 1 ? ' guest' : ' guests');
    if (foot) foot.hidden = !items.length;
  }
  function openDrawer() { if (!drawer) return; renderSaved(); drawer.hidden = false; document.body.classList.add('modal-open'); var c = $('.cd-close', drawer); c && c.focus(); }
  function closeDrawer() { if (drawer) { drawer.hidden = true; document.body.classList.remove('modal-open'); } }
  $$('[data-open-saved]').forEach(function (b) { b.addEventListener('click', openDrawer); });
  $$('[data-close-drawer]').forEach(function (b) { b.addEventListener('click', closeDrawer); });
  var clr = $('#drawerClear'); if (clr) clr.addEventListener('click', function () { saved = []; persist(); syncHearts(); if (state && state.savedOnly) apply(); toast('Cleared your saved trips', '🧹'); });

  /* ----- search / filter / sort state ----- */
  var state = grid ? { q: '', loc: 'all', date: '', guests: 2, sort: 'rec', maxPrice: Infinity, view: store.get('curaters_view', 'grid'), savedOnly: false } : null;
  var maxAvail = Math.max.apply(null, trips.map(function (t) { return t.price; }).concat([0]));

  function apply() {
    var q = state.q.trim().toLowerCase(), shown = 0;
    var vis = trips.filter(function (t) {
      var hay = (t.title + ' ' + t.loc + ' ' + t.desc + ' ' + t.type).toLowerCase();
      return (!q || hay.indexOf(q) > -1) &&
        (state.loc === 'all' || t.loc === state.loc) &&
        cap(t) >= state.guests &&
        t.price <= state.maxPrice &&
        (!state.savedOnly || isSaved(t));
    });
    var sorters = {
      rec: function (a, b) { return a.idx - b.idx; },
      lo: function (a, b) { return a.price - b.price; },
      hi: function (a, b) { return b.price - a.price; },
      az: function (a, b) { return a.title.localeCompare(b.title); }
    };
    var order = trips.slice().sort(sorters[state.sort]);
    order.forEach(function (t, i) { t.el.style.order = i; });
    trips.forEach(function (t) {
      var on = vis.indexOf(t) > -1;
      t.el.hidden = !on;
      if (on) { shown++; reveal(t.el); }
    });
    var c = $('#count');
    if (c) c.innerHTML = '<b>' + shown + '</b> ' + (shown === 1 ? 'experience' : 'experiences') + ' found' +
      (state.guests ? ' for ' + state.guests + (state.guests === 1 ? ' guest' : ' guests') : '') +
      (state.date ? ' · ' + new Date(state.date + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
    var empty = $('#empty'); if (empty) empty.hidden = shown > 0;
    grid.hidden = shown === 0;
    grid.classList.toggle('is-list', state.view === 'list');
    $$('.cur-view button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === state.view ? 'true' : 'false'); });
    $$('.chip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.loc === state.loc ? 'true' : 'false'); });
    var so = $('#savedOnly'); if (so) so.setAttribute('aria-pressed', state.savedOnly ? 'true' : 'false');
  }

  /* reveal on scroll */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .08 }) : null;
  function reveal(el) {
    if (el.classList.contains('in')) return;
    if (!io) { el.classList.add('in'); return; }
    el.classList.add('cur-pre'); io.observe(el);
  }
  $$('.step, .stat-reveal').forEach(function (el) { el.classList.add('cur-pre'); if (io) io.observe(el); });
  if (!io) $$('.cur-pre').forEach(function (el) { el.classList.add('in'); });
  $$('.step').forEach(function (el, i) { el.style.transitionDelay = (i * 90) + 'ms'; });
  // generic fade-in for .step (reuses .in)
  var css = document.createElement('style');
  css.textContent = '.step.cur-pre{opacity:0;transform:translateY(26px)}.step.in{opacity:1;transition:opacity .7s,transform .35s,box-shadow .35s,border-color .35s}';
  document.head.appendChild(css);

  var statsEl = $('.cur-stats');
  if (statsEl && io) {
    var so2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { $$('[data-count]', statsEl).forEach(countUp); so2.disconnect(); } }); });
    so2.observe(statsEl);
  } else if (statsEl) { $$('[data-count]', statsEl).forEach(countUp); }

  if (grid) {
    /* chips */
    var locs = []; trips.forEach(function (t) { if (t.loc && locs.indexOf(t.loc) < 0) locs.push(t.loc); });
    var chips = $('#chips');
    if (chips) {
      if (locs.length < 1) chips.hidden = true;
      var mk = function (label, val) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.loc = val; b.textContent = label; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { state.loc = val; apply(); }); chips.appendChild(b);
      };
      mk('All destinations', 'all'); locs.forEach(function (l) { mk(l, l); });
    }
    /* datalist */
    var dl = $('#destList');
    if (dl) { var seen = {}; locs.concat(trips.map(function (t) { return t.title; })).forEach(function (v) { if (!seen[v]) { seen[v] = 1; var o = document.createElement('option'); o.value = v; dl.appendChild(o); } }); }

    /* search form */
    var qIn = $('#qDest'), dIn = $('#qDate'), gOut = $('#qGuests');
    if (dIn) { var td = new Date(); dIn.min = td.getFullYear() + '-' + String(td.getMonth() + 1).padStart(2, '0') + '-' + String(td.getDate()).padStart(2, '0'); }
    function setGuests(n) { state.guests = Math.max(1, Math.min(60, n)); if (gOut) gOut.textContent = state.guests; }
    $$('#searchForm [data-step]').forEach(function (b) {
      b.addEventListener('click', function () { setGuests(state.guests + parseInt(b.dataset.step, 10)); apply(); renderSaved(); });
    });
    if (qIn) qIn.addEventListener('input', function () { state.q = qIn.value; apply(); });
    if (dIn) dIn.addEventListener('change', function () { state.date = dIn.value; apply(); });
    var sf = $('#searchForm');
    if (sf) sf.addEventListener('submit', function (e) {
      e.preventDefault(); state.q = qIn.value; state.date = dIn.value; apply();
      var r = $('#trips'); if (r) window.scrollTo({ top: r.getBoundingClientRect().top + scrollY - 70, behavior: reduce ? 'auto' : 'smooth' });
    });
    /* toolbar */
    var sortEl = $('#sort'); if (sortEl) sortEl.addEventListener('change', function () { state.sort = sortEl.value; apply(); });
    var pr = $('#maxPrice'), po = $('#maxPriceOut');
    if (pr) {
      var top = Math.ceil(maxAvail / 10) * 10 || 10;
      pr.max = top; pr.step = Math.max(1, Math.round(top / 100)); pr.value = top; state.maxPrice = Infinity;
      var upd = function () {
        var v = +pr.value; state.maxPrice = v >= top ? Infinity : v;
        pr.style.setProperty('--fill', (v / top * 100) + '%');
        if (po) po.textContent = v >= top ? 'Any' : money(v);
        apply();
      };
      pr.addEventListener('input', upd); pr.style.setProperty('--fill', '100%'); if (po) po.textContent = 'Any';
    }
    $$('.cur-view button').forEach(function (b) { b.addEventListener('click', function () { state.view = b.dataset.view; store.set('curaters_view', state.view); apply(); }); });
    var so3 = $('#savedOnly'); if (so3) so3.addEventListener('click', function () { state.savedOnly = !state.savedOnly; if (state.savedOnly && !saved.length) toast('Tap a heart on any trip to save it first', '💡'); apply(); });
    var rs = $('#resetFilters');
    if (rs) rs.addEventListener('click', function () {
      state.q = ''; state.loc = 'all'; state.date = ''; state.maxPrice = Infinity; state.sort = 'rec'; state.savedOnly = false; setGuests(2);
      if (qIn) qIn.value = ''; if (dIn) dIn.value = ''; if (sortEl) sortEl.value = 'rec';
      if (pr) { pr.value = pr.max; pr.style.setProperty('--fill', '100%'); if (po) po.textContent = 'Any'; }
      apply();
    });

    /* cards: hearts, quick book, tilt, video preview */
    trips.forEach(function (t) {
      var save = $('.tc-save', t.el); if (save) save.addEventListener('click', function (e) { e.stopPropagation(); toggleSave(t); });
      var qb = $('.tc-quick', t.el); if (qb) qb.addEventListener('click', function () { openModal(t); });
      var media = $('.tc-media', t.el); if (media) media.addEventListener('click', function () { openModal(t); });
      var v = $('video', t.el);
      if (v) {
        t.el.addEventListener('pointerenter', function () { v.play().catch(function () {}); });
        t.el.addEventListener('pointerleave', function () { v.pause(); });
        if (!fine && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? v.play().catch(function () {}) : v.pause(); }); }, { threshold: .6 }).observe(v);
      }
      if (fine && !reduce) {
        t.el.addEventListener('pointermove', function (e) {
          if (grid.classList.contains('is-list')) return;
          var r = t.el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
          t.el.style.setProperty('--ty', (x * 6) + 'deg'); t.el.style.setProperty('--tx', (-y * 6) + 'deg');
        });
        t.el.addEventListener('pointerleave', function () { t.el.style.setProperty('--tx', '0deg'); t.el.style.setProperty('--ty', '0deg'); });
      }
    });

    /* ----- quick-book modal ----- */
    var modal = $('#modal'), current = null, mGuests = 2, lastFocus = null;
    window.current = null;
    function recalc() {
      if (!current) return;
      var tot = current.price * mGuests, tEl = $('#mTotal');
      $('#mGuestsOut').textContent = mGuests;
      $('#mBreak').textContent = money(current.price) + ' × ' + mGuests + (mGuests === 1 ? ' guest' : ' guests');
      tEl.textContent = money(tot); tEl.classList.remove('tick'); void tEl.offsetWidth; tEl.classList.add('tick');
    }
    function openModal(t) {
      if (!modal) return;
      current = t; window.current = t; lastFocus = document.activeElement;
      var lo = t.min || 1, hi = cap(t);
      mGuests = Math.max(lo, Math.min(state.guests, hi));
      var media = $('#mMedia'); media.className = 'cm-media'; media.innerHTML = '';
      if (t.video) { var v = document.createElement('video'); v.src = t.video; v.poster = t.img; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.controls = true; media.appendChild(v); }
      else if (t.img) { var im = document.createElement('img'); im.src = t.img; im.alt = t.title; im.addEventListener('click', function () { media.classList.toggle('zoomed'); }); media.appendChild(im); }
      $('#mLoc').lastChild.textContent = t.loc || t.type;
      $('#mTitle').textContent = t.title; $('#mDesc').textContent = t.desc.trim();
      var f = $('#mFacts'); f.innerHTML = '';
      var facts = [t.type];
      if (t.slots != null) facts.push(t.slots + ' slots open');
      if (t.min != null) facts.push(t.min + '–' + t.max + ' people');
      facts.forEach(function (x) { var li = document.createElement('li'); li.textContent = x; f.appendChild(li); });
      var d = $('#mDate'); d.min = dIn ? dIn.min : ''; d.value = state.date || '';
      $('#mLink').href = t.href;
      var rg = $('#mRange'); rg.textContent = t.min != null ? 'Group size: ' + t.min + '–' + t.max : (t.slots != null ? t.slots + ' slots left' : '');
      recalc(); syncHearts();
      modal.hidden = false; document.body.classList.add('modal-open');
      $('.cm-x', modal).focus();
    }
    function closeModal() {
      if (!modal || modal.hidden) return;
      modal.hidden = true; document.body.classList.remove('modal-open');
      var v = $('video', modal); if (v) v.pause();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    window.openModal = openModal;
    if (modal) {
      $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', closeModal); });
      $$('#mStep button').forEach(function (b) {
        b.addEventListener('click', function () {
          var lo = current.min || 1, hi = cap(current), n = mGuests + parseInt(b.dataset.step, 10);
          if (n > hi) { toast('Only ' + hi + ' ' + (hi === 1 ? 'place' : 'places') + ' available', '⚠️'); return; }
          if (n < lo) { toast('Minimum group size is ' + lo, 'ℹ️'); return; }
          mGuests = n; recalc();
        });
      });
      $('#mSave').addEventListener('click', function () { toggleSave(current); });
      $('#mDate').addEventListener('change', function (e) { state.date = e.target.value; if (dIn) dIn.value = e.target.value; });
      $('#mReserve').addEventListener('click', function () {
        var date = $('#mDate').value;
        if (!date) { toast('Pick a travel date first', '📅'); $('#mDate').focus(); try { $('#mDate').showPicker(); } catch (e) {} return; }
        var pretty = new Date(date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        confetti();
        var go = function () { window.open(current.href, '_blank', 'noopener'); };
        if (window.Swal) {
          Swal.fire({
            title: 'Almost there!', icon: 'success', confirmButtonText: 'Continue on Curaters', confirmButtonColor: '#0e5666',
            showCancelButton: true, cancelButtonText: 'Keep browsing',
            html: '<b>' + current.title.replace(/</g, '&lt;') + '</b><br>' + pretty + ' · ' + mGuests + (mGuests === 1 ? ' guest' : ' guests') + '<br><b style="font-size:1.4em">' + money(current.price * mGuests) + '</b><br><small>Estimate only. Booking is completed and confirmed on the live Curaters site.</small>'
          }).then(function (r) { if (r.isConfirmed) go(); });
        } else { toast('Estimate ' + money(current.price * mGuests) + ' · opening Curaters to finish booking', '🎉'); setTimeout(go, 900); }
      });
    }
  }

  /* ---------- global keys ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { var m = $('#modal'); if (m && !m.hidden) closeModalGlobal(); closeDrawer(); }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { var q = $('#qDest'); if (q) { e.preventDefault(); q.focus(); } }
  });
  function closeModalGlobal() { var m = $('#modal'); if (m) { $('.cm-backdrop', m).click(); } }

  if (grid) { syncHearts(); apply(); renderSaved(); }
  else { syncHearts(); }
  countEls.forEach(function (c) { c.textContent = saved.length; });

  /* ---------- footer newsletter (preview-only) ---------- */
  var news = $('#news');
  if (news) news.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('input', news).value.trim();
    if (!/^\S+@\S+\.\S+$/.test(v)) { toast('Please enter a valid email', '✉️'); return; }
    toast('Preview only: nothing was sent or saved', '✅'); news.reset();
  });

  /* =====================================================================
     PRIVATE PAGE
     ===================================================================== */
  var vf = $('#vaultForm');
  if (vf) {
    var key = $('input[name=access_key]', vf), lock = $('.lock'), eye = $('.eye', vf), caps = $('#caps');
    key.addEventListener('input', function () { lock.classList.toggle('is-open', key.value.length > 0); });
    key.addEventListener('keyup', function (e) { if (caps && e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); });
    eye.addEventListener('click', function () {
      var show = key.type === 'password'; key.type = show ? 'text' : 'password';
      eye.setAttribute('aria-label', show ? 'Hide key' : 'Show key'); eye.setAttribute('aria-pressed', show);
    });
    vf.addEventListener('submit', function (e) {
      e.preventDefault();
      var old = $('#cur-preview-message'); if (old) old.remove();
      var n = document.createElement('p'); n.id = 'cur-preview-message'; n.className = 'preview-msg'; n.setAttribute('role', 'status');
      n.textContent = 'Preview only: access-key verification runs on the live Curaters server. No key was sent or saved.';
      vf.appendChild(n);
      vf.classList.remove('shake'); void vf.offsetWidth; vf.classList.add('shake');
    });
    $$('.teaser').forEach(function (t) {
      t.addEventListener('click', function () { vf.classList.remove('shake'); void vf.offsetWidth; vf.classList.add('shake'); key.focus(); toast('Enter your access key to unlock this trip', '🔒'); });
    });
  }

  var pf = $('#planner');
  if (pf) {
    var picks = [], pg = 2, sumEl = $('#planSummary'), mailBtn = $('#planMail');
    var mon = $('#planMonth'), note = $('#planNote'), gOut2 = $('#planGuests');
    function plan() {
      var when = mon.value ? new Date(mon.value + '-01T12:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'flexible dates';
      var vibes = picks.length ? picks.join(', ') : 'open to ideas';
      sumEl.innerHTML = 'Your request<br><b>Style:</b> ' + vibes.replace(/</g, '&lt;') + '<br><b>Guests:</b> ' + pg + '<br><b>When:</b> ' + when;
      var body = 'Hello Curaters,\n\nI would like to plan a private trip.\n\nStyle: ' + vibes + '\nGuests: ' + pg + '\nWhen: ' + when + (note.value.trim() ? '\n\nNotes: ' + note.value.trim() : '') + '\n\nThank you!';
      mailBtn.href = 'mailto:travelcuraters@gmail.com?subject=' + encodeURIComponent('Private trip request') + '&body=' + encodeURIComponent(body);
    }
    $$('.vibe', pf).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.v, i = picks.indexOf(v);
        if (i > -1) picks.splice(i, 1); else picks.push(v);
        b.setAttribute('aria-pressed', i < 0); plan();
      });
    });
    $$('[data-pstep]', pf).forEach(function (b) { b.addEventListener('click', function () { pg = Math.max(1, Math.min(40, pg + parseInt(b.dataset.pstep, 10))); gOut2.textContent = pg; plan(); }); });
    mon.addEventListener('input', plan); note.addEventListener('input', plan);
    mailBtn.addEventListener('click', function () { confetti(); toast('Opening your email app…', '✉️'); });
    plan();
  }
})();
