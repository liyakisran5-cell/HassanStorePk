(function(){
  'use strict';

  /* ── Cart badge ─────────────────────────────────────── */
  function refreshCartCount() {
    var badges = [document.getElementById('cartCount'), document.getElementById('cartCountMobile')].filter(Boolean);
    if (!badges.length) return;
    fetch('/api/cart/count', { credentials: 'same-origin' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var n = (d && d.ok) ? d.count : 0;
        badges.forEach(function(badge){
          badge.textContent = n;
          if (n > 0) badge.removeAttribute('hidden');
          else badge.setAttribute('hidden', '');
        });
      })
      .catch(function(){});
  }
  refreshCartCount();
  window.refreshCartCount = refreshCartCount;

  /* ── Toasts ─────────────────────────────────────────── */
  window.toast = function(msg) {
    var box = document.getElementById('toasts');
    if (!box) { alert(msg); return; }
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span></span>';
    t.querySelector('span').textContent = msg;
    box.appendChild(t);
    setTimeout(function(){ t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function(){ t.remove(); }, 320); }, 2600);
  };

  /* ── Add to cart (AJAX, graceful fallback) ──────────── */
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-add-cart]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-add-cart');
    var qtyEl = document.querySelector('[data-qty-input]');
    var qty = qtyEl ? qtyEl.value : '1';
    btn.disabled = true;
    var body = 'id=' + encodeURIComponent(id) + '&qty=' + encodeURIComponent(qty) + '&want=json';
    fetch('/cart/add', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        btn.disabled = false;
        if (d && d.ok) {
          refreshCartCount();
          toast('Added to cart');
          if (btn.hasAttribute('data-open-cart')) openMiniCart();
        } else { toast('Could not add to cart'); }
      })
      .catch(function(){ btn.disabled = false; toast('Could not add to cart'); });
  });

  /* ── Lock body scroll when drawer / mini-cart open ── */
  var _scrollY = 0;
  function syncBodyLock() {
    var locked = !!document.querySelector('.drawer.open, .mini-cart.open');
    if (locked && document.body.style.position !== 'fixed') {
      _scrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = (-_scrollY) + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else if (!locked && document.body.style.position === 'fixed') {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, _scrollY);
    }
  }
  if (window.MutationObserver) {
    new MutationObserver(syncBodyLock).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class'] });
  }
  syncBodyLock();

  /* ── Mini cart ──────────────────────────────────────── */
  window.openMiniCart = function() {
    var mc = document.getElementById('miniCart');
    if (!mc) { location.href = '/cart'; return; }
    mc.classList.add('open');
    var box = document.getElementById('mcItems');
    if (box) box.innerHTML = '<p class="muted small">Loading…</p>';
    loadMiniCart();
  };
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function loadMiniCart() {
    var box = document.getElementById('mcItems');
    var tot = document.getElementById('mcTotal');
    fetch('/api/cart/items', { credentials: 'same-origin' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (!box) return;
        if (!d || !d.ok || !d.items.length) {
          box.innerHTML = '<p class="muted small">Your cart is empty.</p>';
          if (tot) tot.textContent = '—';
          return;
        }
        var cur = d.currency || 'PKR';
        box.innerHTML = d.items.map(function(it){
          var price = cur === 'USD' ? '$' + Number(it.priceUSDT).toFixed(2) : (cur === 'INR' ? '₹' + Number(it.priceINR || 0).toLocaleString() : 'Rs. ' + Math.round(Number(it.priceUSDT) * (d.pkrRate || 280)).toLocaleString());
          return '<div class="mc-item"><div class="ct"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>' +
            '<div class="mc-info"><b>' + esc(it.name) + '</b>' +
            '<div class="mc-qty"><button type="button" data-mc-dec="' + esc(it.id) + '" aria-label="Decrease">\u2212</button><span>' + it.qty + '</span><button type="button" data-mc-inc="' + esc(it.id) + '" aria-label="Increase">+</button></div></div>' +
            '<span class="p">' + esc(price) + '</span>' +
            '<button type="button" class="mc-rm" data-mc-rm="' + esc(it.id) + '" aria-label="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>';
        }).join('');
        var t = cur === 'USD' ? '$' + Number(d.totalUSDT).toFixed(2) : (cur === 'INR' ? '₹' + Number(d.totalINR || 0).toLocaleString() : 'Rs. ' + Number(d.totalPKR).toLocaleString());
        if (tot) tot.textContent = t;
      })
      .catch(function(){ if (box) box.innerHTML = '<p class="muted small">Could not load cart.</p>'; });
  }

  /* Mini-cart qty + remove */
  function mcPost(url, id, qty) {
    var body = 'id=' + encodeURIComponent(id) + '&want=json';
    if (qty != null) body += '&qty=' + encodeURIComponent(qty);
    fetch(url, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body: body })
      .then(function(){ loadMiniCart(); if (typeof updateCartCount === 'function') updateCartCount(); })
      .catch(function(){});
  }
  document.addEventListener('click', function(e){
    var inc = e.target.closest('[data-mc-inc]');
    var dec = e.target.closest('[data-mc-dec]');
    var rm = e.target.closest('[data-mc-rm]');
    if (inc) {
      var row = inc.closest('.mc-item');
      var q = parseInt(row.querySelector('.mc-qty span').textContent, 10) || 1;
      mcPost('/cart/update', inc.getAttribute('data-mc-inc'), q + 1);
    } else if (dec) {
      var row2 = dec.closest('.mc-item');
      var q2 = parseInt(row2.querySelector('.mc-qty span').textContent, 10) || 1;
      if (q2 <= 1) mcPost('/cart/remove', dec.getAttribute('data-mc-dec'));
      else mcPost('/cart/update', dec.getAttribute('data-mc-dec'), q2 - 1);
    } else if (rm) {
      mcPost('/cart/remove', rm.getAttribute('data-mc-rm'));
    }
  });

  /* ── Countdown timers ───────────────────────────────── */
  function pad(n){ return String(n).padStart(2, '0'); }
  function tick(){
    document.querySelectorAll('[data-countdown]').forEach(function(el){
      var target = Number(el.getAttribute('data-countdown'));
      var ms = target - Date.now();
      if (ms <= 0) { el.textContent = 'expired'; return; }
      var s = Math.floor(ms / 1000);
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s % 60);
    });
  }
  tick(); setInterval(tick, 1000);

  /* ── FAQ accordion ──────────────────────────────────── */
  document.addEventListener('click', function(e){
    var q = e.target.closest('.faq-q');
    if (!q) return;
    var item = q.closest('.faq-item');
    var ans = item.querySelector('.faq-a');
    var open = item.classList.toggle('open');
    ans.style.maxHeight = open ? ans.scrollHeight + 'px' : '0';
  });

  /* ── Payment method select highlight ────────────────── */
  document.addEventListener('change', function(e){
    if (e.target.name !== 'method') return;
    document.querySelectorAll('.pay-opt').forEach(function(o){ o.classList.remove('sel'); });
    var opt = e.target.closest('.pay-opt');
    if (opt) opt.classList.add('sel');
  });

  /* ── Qty steppers ───────────────────────────────────── */
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-qty]');
    if (!b) return;
    var wrap = b.closest('.qty');
    var input = wrap && wrap.querySelector('input');
    if (!input) return;
    var v = parseInt(input.value, 10) || 1;
    v += (b.getAttribute('data-qty') === 'inc' ? 1 : -1);
    input.value = Math.max(1, Math.min(50, v));
  });

  /* ── Buy Now (carry qty to checkout) ──────────────────── */
  document.addEventListener('click', function(e){
    var a = e.target.closest('[data-buy-now]');
    if (!a) return;
    var qtyEl = document.querySelector('[data-qty-input]');
    var qty = qtyEl ? Math.max(1, Math.min(50, parseInt(qtyEl.value, 10) || 1)) : 1;
    if (qty > 1) {
      e.preventDefault();
      var href = a.getAttribute('href');
      window.location.href = href + (href.indexOf('?') >= 0 ? '&' : '?') + 'qty=' + qty;
    }
  });

  /* ── Copy buttons ───────────────────────────────────── */
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var txt = b.getAttribute('data-copy');
    function done(){ var o = b.textContent; b.textContent = 'Copied ✓'; setTimeout(function(){ b.textContent = o; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(function(){ fallback(); });
    } else fallback();
    function fallback(){
      var ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch(_){}
      ta.remove();
    }
  });

  /* ── Scroll reveal ──────────────────────────────────── */
  (function(){
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach(function(el){ el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(function(el){ io.observe(el); });
  })();

  /* ── Show/hide password toggle ──────────────────────── */
  document.addEventListener('click', function(e) {
    var t = e.target.closest('.pw-toggle');
    if (!t) return;
    var wrap = t.closest('.pw-wrap');
    var input = wrap && wrap.querySelector('input');
    if (!input) return;
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    t.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    t.style.color = show ? 'var(--blue)' : '';
  });

  /* ── Scroll reveal (staggered) ── */
  (function(){
    var els = document.querySelectorAll('.pcard, .cat-pill, .why-card');
    els.forEach(function(el, i){ el.classList.add('reveal'); el.style.transitionDelay = Math.min(i % 8, 7) * 60 + 'ms'; });
    if (!('IntersectionObserver' in window)) { els.forEach(function(el){ el.classList.add('visible'); }); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
    els.forEach(function(el){ io.observe(el); });
  })();

  /* ── Animated count-up for balances ── */
  (function(){
    function countUp(el){
      var target = parseFloat(el.getAttribute('data-count'));
      if (isNaN(target)) return;
      var prefix = el.getAttribute('data-prefix') || '';
      var dur = 1200, start = null;
      function fmt(v){ return prefix + Math.round(v).toLocaleString('en-PK'); }
      function step(ts){
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    document.querySelectorAll('[data-count]').forEach(countUp);
  })();

  /* ── Copy credentials button ── */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.copy-btn');
    if (!btn) return;
    var target = document.getElementById(btn.getAttribute('data-copy-target'));
    if (!target) return;
    var text = target.innerText || target.textContent;
    function done() {
      var label = btn.querySelector('span');
      btn.classList.add('copied');
      if (label) label.textContent = 'Copied!';
      setTimeout(function(){ btn.classList.remove('copied'); if (label) label.textContent = 'Copy'; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function(){ fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch(err) {}
      document.body.removeChild(ta);
    }
  });
})();