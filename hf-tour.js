(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HFTour = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LABELS = { prev: '이전', next: '다음', finish: '완료', ok: '확인', close: '닫기', start: '사용 가이드' };

  var DEFAULTS = {
    steps: [],
    type: 'default',
    mask: true,
    maskClosable: false,
    gap: 6,
    radius: 10,
    arrow: true,
    ring: true,
    indicator: 'dots',
    closable: true,
    keyboard: true,
    scrollOffset: 0,
    margin: 12,
    mobileBreakpoint: 640,
    waitFor: 1500,
    storageKey: null,
    autoStart: false,
    launcher: null,
    beacon: null,
    labels: null,
    zIndex: null,
    onStart: null,
    onChange: null,
    onClose: null,
    onFinish: null
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var ARROW_GAP = 12;
  var active = null;
  var uid = 0;

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) target[k] = src[k];
      }
    }
    return target;
  }

  function el(tag, cls, attrs) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) {
      for (var k in attrs) node.setAttribute(k, attrs[k]);
    }
    return node;
  }

  function clamp(v, min, max) {
    if (max < min) return min;
    return Math.min(Math.max(v, min), max);
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function resolveTarget(target) {
    if (!target) return null;
    if (typeof target === 'function') target = target();
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target || !target.getBoundingClientRect) return null;
    var r = target.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return target;
  }

  function waitForTarget(target, timeout) {
    return new Promise(function (resolve) {
      var found = resolveTarget(target);
      if (found || !target || typeof target === 'object' || !timeout) {
        resolve(found);
        return;
      }
      var done = false;
      var observer = new MutationObserver(function () {
        var hit = resolveTarget(target);
        if (hit) finish(hit);
      });
      var timer = setTimeout(function () { finish(resolveTarget(target)); }, timeout);
      function finish(value) {
        if (done) return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      }
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    });
  }

  function isScrollable(node) {
    if (!node || node === document.body || node === document.documentElement) return false;
    var style = getComputedStyle(node);
    return /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
  }

  function isClipped(target, r) {
    var v = visibleRect(target, r);
    return v.width <= 2 || v.height <= 2;
  }

  function visibleRect(target, r) {
    r = r || target.getBoundingClientRect();
    var x1 = r.left;
    var y1 = r.top;
    var x2 = r.right;
    var y2 = r.bottom;
    var node = target.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var style = getComputedStyle(node);
      if (/(auto|scroll|hidden|clip|overlay)/.test(style.overflowX + ' ' + style.overflowY)) {
        var c = node.getBoundingClientRect();
        x1 = Math.max(x1, c.left);
        y1 = Math.max(y1, c.top);
        x2 = Math.min(x2, c.right);
        y2 = Math.min(y2, c.bottom);
      }
      node = node.parentElement;
    }
    return { left: x1, top: y1, right: x2, bottom: y2, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) };
  }

  function isFullyShown(target, r) {
    var v = visibleRect(target, r);
    return v.width >= r.width - 1 && v.height >= r.height - 1;
  }

  function scrollContainersFirst(target, area, gap, smooth) {
    var behavior = smooth ? 'smooth' : 'auto';
    var r = target.getBoundingClientRect();
    var top = r.top - gap;
    var height = r.height + gap * 2;
    var left = r.left - gap;
    var width = r.width + gap * 2;
    var node = target.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var style = getComputedStyle(node);
      var c = null;
      var scrollY = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
      var scrollX = /(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
      if (scrollY || scrollX) c = node.getBoundingClientRect();
      if (scrollY) {
        var cTop = c.top + node.clientTop;
        var cBottom = cTop + node.clientHeight;
        if (top < cTop || top + height > cBottom) {
          var wantTop = height <= node.clientHeight ? cTop + (node.clientHeight - height) / 2 : cTop;
          var nextY = clamp(node.scrollTop + (top - wantTop), 0, node.scrollHeight - node.clientHeight);
          var dy = nextY - node.scrollTop;
          if (dy) {
            node.scrollTo({ top: nextY, behavior: behavior });
            top -= dy;
          }
        }
      }
      if (scrollX) {
        var cLeft = c.left + node.clientLeft;
        var cRight = cLeft + node.clientWidth;
        if (left < cLeft || left + width > cRight) {
          var wantLeft = width <= node.clientWidth ? cLeft + (node.clientWidth - width) / 2 : cLeft;
          var nextX = clamp(node.scrollLeft + (left - wantLeft), 0, node.scrollWidth - node.clientWidth);
          var dx = nextX - node.scrollLeft;
          if (dx) {
            node.scrollTo({ left: nextX, behavior: behavior });
            left -= dx;
          }
        }
      }
      node = node.parentElement;
    }
    var room = area.bottom - area.top;
    if (top >= area.top && top + height <= area.bottom) return;
    var desired = height <= room ? area.top + (room - height) / 2 : area.top;
    var page = document.scrollingElement || document.documentElement;
    var pageMax = page.scrollHeight - window.innerHeight;
    var pageNext = clamp(window.pageYOffset + (top - desired), 0, pageMax);
    if (pageNext !== window.pageYOffset) window.scrollTo({ top: pageNext, behavior: behavior });
  }

  function waitForSettle(target, maxMs) {
    return new Promise(function (resolve) {
      var last = null;
      var still = 0;
      var started = performance.now();
      function tick() {
        var r = target.getBoundingClientRect();
        var key = Math.round(r.top) + ':' + Math.round(r.left);
        still = key === last ? still + 1 : 0;
        last = key;
        if (still >= 3 || performance.now() - started > maxMs) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function roundedRectPath(x, y, w, h, r) {
    if (w <= 0 || h <= 0) return '';
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return 'M' + (x + r) + ' ' + y +
      'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) +
      'V' + (y + h - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) +
      'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) +
      'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z';
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) {}
  }

  var ICON_CLOSE = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var ICON_GUIDE = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.9 7.9a2.1 2.1 0 1 1 3.1 1.85c-.6.33-1 .8-1 1.5v.35" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="13.9" r=".95" fill="currentColor"/></svg>';

  function Tour(options) {
    this.id = ++uid;
    this.opts = assign({}, DEFAULTS, options);
    this.labels = assign({}, LABELS, this.opts.labels);
    this.steps = (this.opts.steps || []).slice();
    this.index = -1;
    this.open = false;
    this.hole = null;
    this.target = null;
    this.placement = null;
    this.tweenFrame = 0;
    this.followFrame = 0;
    this.token = 0;
    this.lastFocus = null;
    this.launcherEl = null;
    this.beaconEl = null;
    this.beaconTarget = null;
    this.handleKey = this.handleKey.bind(this);
    this.scheduleFollow = this.scheduleFollow.bind(this);
    this.positionBeacon = this.positionBeacon.bind(this);
    this.watch = this.watch.bind(this);
    this.build();
    this.mountHelpers();
    var auto = this.opts.autoStart;
    if (auto === true || (auto === 'once' && !this.isDone())) {
      var self = this;
      setTimeout(function () { self.start(0); }, 400);
    }
  }

  Tour.prototype.build = function () {
    var o = this.opts;
    var root = el('div', 'hft-root');
    if (o.zIndex) root.style.setProperty('--hft-z', String(o.zIndex));
    root.hidden = true;

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'hft-mask');
    svg.setAttribute('aria-hidden', 'true');
    var shade = document.createElementNS(SVG_NS, 'path');
    shade.setAttribute('class', 'hft-mask__shade');
    shade.setAttribute('fill-rule', 'evenodd');
    var ring = document.createElementNS(SVG_NS, 'path');
    ring.setAttribute('class', 'hft-mask__ring');
    var block = document.createElementNS(SVG_NS, 'path');
    block.setAttribute('class', 'hft-mask__block');
    svg.appendChild(shade);
    svg.appendChild(ring);
    svg.appendChild(block);

    var titleId = 'hft-title-' + this.id;
    var descId = 'hft-desc-' + this.id;
    var pop = el('div', 'hft-pop', { role: 'dialog', 'aria-labelledby': titleId, 'aria-describedby': descId, tabindex: '-1' });
    var arrow = el('div', 'hft-pop__arrow');
    var close = el('button', 'hft-pop__close', { type: 'button', 'aria-label': this.labels.close });
    close.innerHTML = ICON_CLOSE;
    var bar = el('div', 'hft-pop__bar');
    var barFill = el('span');
    bar.appendChild(barFill);
    var cover = el('div', 'hft-pop__cover');
    var title = el('h2', 'hft-pop__title', { id: titleId });
    var desc = el('div', 'hft-pop__desc', { id: descId });
    var foot = el('div', 'hft-pop__foot');
    var ind = el('div', 'hft-pop__ind');
    var btns = el('div', 'hft-pop__btns');
    var prev = el('button', 'hft-btn hft-btn--ghost', { type: 'button' });
    var next = el('button', 'hft-btn hft-btn--primary', { type: 'button' });
    btns.appendChild(prev);
    btns.appendChild(next);
    foot.appendChild(ind);
    foot.appendChild(btns);
    pop.appendChild(arrow);
    pop.appendChild(bar);
    pop.appendChild(cover);
    pop.appendChild(close);
    pop.appendChild(title);
    pop.appendChild(desc);
    pop.appendChild(foot);

    var live = el('div', 'hft-sr', { 'aria-live': 'polite' });

    root.appendChild(svg);
    root.appendChild(pop);
    root.appendChild(live);

    var self = this;
    close.addEventListener('click', function () { self.close('close'); });
    prev.addEventListener('click', function () { self.prev(); });
    next.addEventListener('click', function () { self.next(); });
    shade.addEventListener('click', function () {
      if (self.opts.maskClosable) self.close('mask');
    });

    this.ui = { root: root, svg: svg, shade: shade, ring: ring, block: block, pop: pop, arrow: arrow, close: close, bar: bar, barFill: barFill, cover: cover, title: title, desc: desc, ind: ind, prev: prev, next: next, live: live };
  };

  Tour.prototype.mountHelpers = function () {
    var o = this.opts;
    var self = this;
    if (o.launcher) {
      var conf = o.launcher === true ? {} : o.launcher;
      var btn = el('button', 'hft-launcher' + (conf.position === 'bottom-left' ? ' hft-launcher--left' : ''), { type: 'button' });
      btn.innerHTML = ICON_GUIDE + '<span>' + (conf.label || this.labels.start) + '</span>';
      btn.addEventListener('click', function () { self.start(0); });
      (conf.container || document.body).appendChild(btn);
      this.launcherEl = btn;
    }
    if (o.beacon) {
      var beacon = el('button', 'hft-beacon', { type: 'button', 'aria-label': (o.beacon.label || this.labels.start) + ' 시작' });
      beacon.innerHTML = '<span class="hft-beacon__pulse"></span><span class="hft-beacon__dot"></span>';
      beacon.addEventListener('click', function () { self.start(0); });
      document.body.appendChild(beacon);
      this.beaconEl = beacon;
      this.beaconSpec = o.beacon === true ? null : (o.beacon.target || o.beacon);
      window.addEventListener('scroll', this.positionBeacon, true);
      window.addEventListener('resize', this.positionBeacon);
      this.beaconTimer = setInterval(this.positionBeacon, 600);
      this.positionBeacon();
    }
  };

  Tour.prototype.positionBeacon = function () {
    var b = this.beaconEl;
    if (!b) return;
    var spec = this.beaconSpec || (this.steps[0] && this.steps[0].target);
    var target = resolveTarget(spec);
    if (!target || this.open || this.isDone()) {
      b.hidden = true;
      return;
    }
    var r = target.getBoundingClientRect();
    var outside = r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth;
    b.hidden = outside || isClipped(target, r);
    var place = (this.opts.beacon && this.opts.beacon.placement) || 'top-right';
    var left = r.right - 9;
    var top = r.top - 9;
    if (place === 'right') {
      left = r.right + 6;
      top = r.top + r.height / 2 - 9;
    } else if (place === 'left') {
      left = r.left - 24;
      top = r.top + r.height / 2 - 9;
    }
    b.style.left = Math.round(left) + 'px';
    b.style.top = Math.round(top) + 'px';
  };

  Tour.prototype.isDone = function () {
    return !!(this.opts.storageKey && storageGet(this.opts.storageKey) === 'done');
  };

  Tour.prototype.reset = function () {
    if (this.opts.storageKey) storageSet(this.opts.storageKey, null);
    this.positionBeacon();
  };

  Tour.prototype.box = function () {
    var root = this.ui.root;
    if (!root.hidden) {
      var r = root.getBoundingClientRect();
      if (r.width && r.height) return { w: r.width, h: r.height };
    }
    return { w: document.documentElement.clientWidth || window.innerWidth, h: window.innerHeight };
  };

  Tour.prototype.isMobile = function () {
    return window.innerWidth <= this.opts.mobileBreakpoint;
  };

  Tour.prototype.start = function (index) {
    if (!this.steps.length) return;
    if (active && active !== this) active.close('replaced');
    active = this;
    if (!this.open) {
      this.open = true;
      this.lastFocus = document.activeElement;
      if (!this.ui.root.parentNode) document.body.appendChild(this.ui.root);
      this.ui.root.hidden = false;
      this.ui.root.classList.remove('hft-root--leaving');
      document.addEventListener('keydown', this.handleKey, true);
      window.addEventListener('resize', this.scheduleFollow);
      window.addEventListener('scroll', this.scheduleFollow, true);
      this.watchTimer = setInterval(this.watch, 200);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(this.scheduleFollow);
      if (this.launcherEl) this.launcherEl.classList.add('hft-launcher--hidden');
      if (this.beaconEl) this.beaconEl.hidden = true;
      if (this.opts.onStart) this.opts.onStart.call(this);
    }
    this.show(typeof index === 'number' ? index : 0);
  };

  Tour.prototype.next = function () {
    if (!this.open) return;
    if (this.index >= this.steps.length - 1) {
      this.finish();
      return;
    }
    this.show(this.index + 1);
  };

  Tour.prototype.prev = function () {
    if (!this.open || this.index <= 0) return;
    this.show(this.index - 1);
  };

  Tour.prototype.goTo = function (index) {
    if (!this.open) this.start(index);
    else this.show(index);
  };

  Tour.prototype.finish = function () {
    if (this.opts.storageKey) storageSet(this.opts.storageKey, 'done');
    var index = this.index;
    this.teardown();
    if (this.opts.onFinish) this.opts.onFinish.call(this, index);
  };

  Tour.prototype.close = function (reason) {
    if (!this.open) return;
    if (this.opts.storageKey && reason !== 'replaced') storageSet(this.opts.storageKey, 'done');
    var index = this.index;
    this.teardown();
    if (this.opts.onClose) this.opts.onClose.call(this, index, reason || 'close');
  };

  Tour.prototype.teardown = function () {
    var self = this;
    this.open = false;
    this.token++;
    cancelAnimationFrame(this.tweenFrame);
    cancelAnimationFrame(this.followFrame);
    this.chasing = false;
    this.revealing = false;
    document.removeEventListener('keydown', this.handleKey, true);
    window.removeEventListener('resize', this.scheduleFollow);
    window.removeEventListener('scroll', this.scheduleFollow, true);
    clearInterval(this.watchTimer);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (active === this) active = null;
    var root = this.ui.root;
    root.classList.add('hft-root--leaving');
    var finishLeave = function () {
      if (self.open) return;
      root.hidden = true;
      root.classList.remove('hft-root--leaving');
      self.ui.pop.classList.remove('hft-pop--in');
      self.hole = null;
      self.index = -1;
    };
    if (prefersReducedMotion()) finishLeave();
    else setTimeout(finishLeave, 180);
    if (this.launcherEl) this.launcherEl.classList.remove('hft-launcher--hidden');
    this.positionBeacon();
    if (this.lastFocus && this.lastFocus.focus && document.contains(this.lastFocus)) {
      try { this.lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  };

  Tour.prototype.destroy = function () {
    if (this.open) this.teardown();
    if (this.ui.root.parentNode) this.ui.root.parentNode.removeChild(this.ui.root);
    if (this.launcherEl && this.launcherEl.parentNode) this.launcherEl.parentNode.removeChild(this.launcherEl);
    if (this.beaconEl && this.beaconEl.parentNode) this.beaconEl.parentNode.removeChild(this.beaconEl);
    clearInterval(this.beaconTimer);
    window.removeEventListener('scroll', this.positionBeacon, true);
    window.removeEventListener('resize', this.positionBeacon);
  };

  Tour.prototype.stepValue = function (step, key) {
    return step[key] !== undefined ? step[key] : this.opts[key];
  };

  Tour.prototype.show = function (index) {
    var self = this;
    var step = this.steps[index];
    if (!step) return;
    var token = ++this.token;
    var previous = this.index;
    var wasVisible = this.ui.pop.classList.contains('hft-pop--in');
    this.index = index;
    this.revealing = true;
    var ui = this.ui;
    ui.pop.classList.remove('hft-pop--in');
    ui.pop.classList.add('hft-pop--out');
    var pause = wasVisible && !prefersReducedMotion() ? 110 : 0;

    Promise.all([waitForTarget(step.target, this.opts.waitFor), new Promise(function (r) { setTimeout(r, pause); })]).then(function (res) {
      var target = res[0];
      if (token !== self.token) return;
      self.target = target;
      self.render(step, index);
      self.applyMode(step);
      self.prepareSheet();
      if (!self.hole) self.hole = self.inflate(self.goal());
      self.chase();
      return self.reveal(target).then(function () {
        if (token !== self.token) return;
        self.revealing = false;
        self.layout();
        ui.pop.classList.remove('hft-pop--out');
        void ui.pop.offsetWidth;
        ui.pop.classList.add('hft-pop--in');
        self.observe(target);
        self.focusPopover();
        if (self.opts.onChange && previous !== index) self.opts.onChange.call(self, index, step);
      });
    });
  };

  Tour.prototype.inflate = function (h) {
    if (!h.w || prefersReducedMotion()) return h;
    return { x: h.x - 28, y: h.y - 28, w: h.w + 56, h: h.h + 56, r: h.r + 14 };
  };

  Tour.prototype.prepareSheet = function () {
    var mobile = this.isMobile();
    this.ui.root.classList.toggle('hft-root--sheet', mobile);
    if (mobile) {
      var m = this.opts.margin;
      this.ui.pop.style.left = m + 'px';
      this.ui.pop.style.width = (this.box().w - 2 * m) + 'px';
    } else {
      this.ui.pop.style.width = '';
    }
  };

  Tour.prototype.applyMode = function (step) {
    var root = this.ui.root;
    var type = this.stepValue(step, 'type');
    var mask = this.stepValue(step, 'mask');
    root.classList.toggle('hft-root--primary', type === 'primary');
    root.classList.toggle('hft-root--nomask', !mask);
    root.classList.toggle('hft-root--interactive', !!step.interactive);
    root.classList.toggle('hft-root--noring', !this.stepValue(step, 'ring'));
    this.ui.pop.setAttribute('aria-modal', mask ? 'true' : 'false');
  };

  Tour.prototype.render = function (step, index) {
    var ui = this.ui;
    var total = this.steps.length;
    var last = index === total - 1;

    ui.cover.innerHTML = '';
    if (step.cover) {
      if (typeof step.cover === 'string' && /^(https?:|data:|\.{0,2}\/|[\w-]+\.(png|jpe?g|gif|svg|webp)$)/i.test(step.cover)) {
        var img = el('img', '', { src: step.cover, alt: '' });
        ui.cover.appendChild(img);
      } else if (typeof step.cover === 'string') {
        ui.cover.innerHTML = step.cover;
      } else if (step.cover.nodeType) {
        ui.cover.appendChild(step.cover);
      }
      ui.cover.hidden = false;
    } else {
      ui.cover.hidden = true;
    }

    ui.title.textContent = step.title || '';
    ui.title.hidden = !step.title;
    if (step.html) ui.desc.innerHTML = step.html;
    else ui.desc.textContent = step.description || '';
    ui.desc.hidden = !(step.html || step.description);

    ui.close.hidden = !this.opts.closable;

    ui.prev.hidden = index === 0;
    ui.prev.textContent = step.prevLabel || this.labels.prev;
    ui.next.textContent = step.nextLabel || (last ? (total === 1 ? this.labels.ok : this.labels.finish) : this.labels.next);

    var indicator = this.stepValue(step, 'indicator');
    ui.ind.innerHTML = '';
    ui.bar.hidden = true;
    if (total > 1 && indicator) {
      if (typeof indicator === 'function') {
        ui.ind.innerHTML = indicator(index, total);
      } else if (indicator === 'count') {
        ui.ind.textContent = (index + 1) + ' / ' + total;
        ui.ind.className = 'hft-pop__ind hft-pop__ind--count';
      } else if (indicator === 'bar') {
        ui.bar.hidden = false;
        ui.barFill.style.width = Math.round(((index + 1) / total) * 100) + '%';
        ui.ind.textContent = (index + 1) + ' / ' + total;
        ui.ind.className = 'hft-pop__ind hft-pop__ind--count';
      } else {
        ui.ind.className = 'hft-pop__ind';
        for (var i = 0; i < total; i++) {
          ui.ind.appendChild(el('span', 'hft-dot' + (i === index ? ' hft-dot--on' : '') + (i < index ? ' hft-dot--done' : '')));
        }
      }
    }
    ui.live.textContent = (total > 1 ? (total + '단계 중 ' + (index + 1) + '단계. ') : '') + (step.title || '');
  };

  Tour.prototype.availableArea = function () {
    var m = this.opts.margin;
    var top = m + (this.opts.scrollOffset || 0);
    var bottom = this.box().h - m;
    if (this.isMobile()) {
      var sheet = this.ui.pop.offsetHeight || 0;
      if (this.sheetAtTop) top += sheet + m;
      else bottom -= sheet + m;
    }
    return { top: top, bottom: bottom };
  };

  Tour.prototype.reveal = function (target) {
    var self = this;
    var smooth = !prefersReducedMotion();
    this.sheetAtTop = false;
    if (!target) return Promise.resolve();
    var area = this.availableArea();
    var gap = this.stepValue(this.steps[this.index], 'gap');
    var r = target.getBoundingClientRect();
    if (r.top - gap >= area.top && r.bottom + gap <= area.bottom && isFullyShown(target, r)) {
      return Promise.resolve();
    }
    scrollContainersFirst(target, area, gap, smooth);
    return waitForSettle(target, smooth ? 1200 : 60).then(function () {
      if (!self.isMobile()) return;
      var after = target.getBoundingClientRect();
      var area2 = self.availableArea();
      if (after.bottom + gap > area2.bottom) {
        var sheetH = self.ui.pop.offsetHeight || 0;
        if (after.top - gap > sheetH + 2 * self.opts.margin) self.sheetAtTop = true;
      }
    });
  };

  Tour.prototype.holeFor = function (target, step) {
    var box = this.box();
    var vw = box.w;
    var vh = box.h;
    if (!target) return { x: vw / 2, y: vh / 2, w: 0, h: 0, r: 0 };
    var gap = this.stepValue(step, 'gap');
    var radius = this.stepValue(step, 'radius');
    var r = visibleRect(target);
    if (r.width === 0 || r.height === 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: 0, h: 0, r: 0 };
    var x1 = Math.max(r.left - gap, 4);
    var y1 = Math.max(r.top - gap, 4);
    var x2 = Math.min(r.right + gap, vw - 4);
    var y2 = Math.min(r.bottom + gap, vh - 4);
    if (this.isMobile()) {
      var m = this.opts.margin;
      var sheet = this.ui.pop.offsetHeight || 0;
      if (this.sheetAtTop) y1 = Math.max(y1, m + sheet + 8);
      else y2 = Math.min(y2, vh - m - sheet - 8);
    }
    return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1), r: radius };
  };

  Tour.prototype.drawHole = function (h) {
    var box = this.box();
    var ui = this.ui;
    var outer = 'M-2 -2H' + (box.w + 2) + 'V' + (box.h + 2) + 'H-2Z';
    var inner = roundedRectPath(h.x, h.y, h.w, h.h, h.r);
    ui.shade.setAttribute('d', outer + inner);
    ui.ring.setAttribute('d', inner);
    ui.block.setAttribute('d', inner);
  };

  Tour.prototype.goal = function () {
    var target = this.target && document.contains(this.target) ? this.target : null;
    return this.holeFor(target, this.steps[this.index]);
  };

  Tour.prototype.chase = function () {
    var self = this;
    if (prefersReducedMotion() || !this.hole) {
      this.hole = this.goal();
      this.drawHole(this.hole);
      return;
    }
    if (this.chasing) return;
    this.chasing = true;
    var last = performance.now();
    function frame(now) {
      if (!self.open) {
        self.chasing = false;
        return;
      }
      var goal = self.goal();
      var dt = Math.min(1000, now - last);
      last = now;
      var k = 1 - Math.pow(0.002, dt / 340);
      var cur = self.hole;
      var next = {
        x: cur.x + (goal.x - cur.x) * k,
        y: cur.y + (goal.y - cur.y) * k,
        w: cur.w + (goal.w - cur.w) * k,
        h: cur.h + (goal.h - cur.h) * k,
        r: cur.r + (goal.r - cur.r) * k
      };
      var settled = Math.abs(goal.x - next.x) < 0.4 && Math.abs(goal.y - next.y) < 0.4 &&
        Math.abs(goal.w - next.w) < 0.4 && Math.abs(goal.h - next.h) < 0.4;
      self.hole = settled ? goal : next;
      self.drawHole(self.hole);
      if (settled && !self.revealing) {
        self.chasing = false;
        return;
      }
      self.tweenFrame = requestAnimationFrame(frame);
    }
    this.tweenFrame = requestAnimationFrame(frame);
  };

  Tour.prototype.layout = function () {
    if (!this.open) return;
    var step = this.steps[this.index];
    var target = this.target && document.contains(this.target) ? this.target : null;
    var goal = this.holeFor(target, step);
    if (!this.chasing) {
      this.hole = goal;
      this.drawHole(goal);
    }
    this.placePopover(target, step, goal);
  };

  Tour.prototype.refresh = function () {
    if (!this.open) return;
    this.prepareSheet();
    this.layout();
  };

  Tour.prototype.placePopover = function (target, step, hole) {
    var ui = this.ui;
    var pop = ui.pop;
    var m = this.opts.margin;
    var box = this.box();
    var vw = box.w;
    var vh = box.h;
    var useArrow = this.stepValue(step, 'arrow');

    pop.style.maxHeight = (vh - 2 * m) + 'px';

    if (this.isMobile()) {
      pop.style.left = m + 'px';
      pop.style.width = (vw - 2 * m) + 'px';
      var sheetH = pop.offsetHeight;
      var topPos = this.sheetAtTop ? m : vh - m - sheetH;
      pop.style.top = Math.max(m, topPos) + 'px';
      pop.setAttribute('data-placement', this.sheetAtTop ? 'sheet-top' : 'sheet');
      ui.arrow.hidden = true;
      this.placement = 'sheet';
      return;
    }

    pop.style.width = '';
    var pw = pop.offsetWidth;
    var ph = pop.offsetHeight;

    if (!target) {
      pop.style.left = Math.round((vw - pw) / 2) + 'px';
      pop.style.top = Math.round(clamp((vh - ph) / 2, m, vh - m - ph)) + 'px';
      pop.setAttribute('data-placement', 'center');
      ui.arrow.hidden = true;
      this.placement = 'center';
      return;
    }

    var t = { left: hole.x, top: hole.y, right: hole.x + hole.w, bottom: hole.y + hole.h };
    t.cx = (t.left + t.right) / 2;
    t.cy = (t.top + t.bottom) / 2;
    var gapA = useArrow ? ARROW_GAP : 8;
    var req = (step.placement || this.opts.placement || '').split('-');
    var side = req[0];
    var align = req[1] || 'center';
    var order = ['bottom', 'top', 'right', 'left'];
    var opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    var candidates = side ? [side, opposite[side]].concat(order.filter(function (s) { return s !== side && s !== opposite[side]; })) : order;

    var fits = {
      bottom: t.bottom + gapA + ph <= vh - m,
      top: t.top - gapA - ph >= m,
      right: t.right + gapA + pw <= vw - m,
      left: t.left - gapA - pw >= m
    };

    var chosen = null;
    for (var i = 0; i < candidates.length; i++) {
      if (fits[candidates[i]]) { chosen = candidates[i]; break; }
    }

    var left;
    var top;
    if (!chosen) {
      left = clamp(t.cx - pw / 2, m, vw - m - pw);
      top = vh - m - ph;
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(Math.max(m, top)) + 'px';
      pop.setAttribute('data-placement', 'inside');
      ui.arrow.hidden = true;
      this.placement = 'inside';
      return;
    }

    if (chosen === 'bottom' || chosen === 'top') {
      top = chosen === 'bottom' ? t.bottom + gapA : t.top - gapA - ph;
      if (align === 'start') left = t.left;
      else if (align === 'end') left = t.right - pw;
      else left = t.cx - pw / 2;
      left = clamp(left, m, vw - m - pw);
    } else {
      left = chosen === 'right' ? t.right + gapA : t.left - gapA - pw;
      if (align === 'start') top = t.top;
      else if (align === 'end') top = t.bottom - ph;
      else top = t.cy - ph / 2;
      top = clamp(top, m, vh - m - ph);
    }

    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
    pop.setAttribute('data-placement', chosen);
    this.placement = chosen;

    if (!useArrow) {
      ui.arrow.hidden = true;
      return;
    }
    ui.arrow.hidden = false;
    if (chosen === 'bottom' || chosen === 'top') {
      var ax = clamp(t.cx - left, 20, pw - 20);
      ui.arrow.style.left = Math.round(ax) + 'px';
      ui.arrow.style.top = '';
    } else {
      var ay = clamp(t.cy - top, 20, ph - 20);
      ui.arrow.style.top = Math.round(ay) + 'px';
      ui.arrow.style.left = '';
    }
  };

  Tour.prototype.scheduleFollow = function () {
    var self = this;
    if (!this.open) return;
    cancelAnimationFrame(this.followFrame);
    this.followFrame = requestAnimationFrame(function () {
      if (!self.open || self.revealing) return;
      self.prepareSheet();
      self.layout();
    });
  };

  Tour.prototype.watch = function () {
    if (!this.open || this.revealing || this.chasing || !this.hole) return;
    var goal = this.goal();
    var h = this.hole;
    var moved = Math.abs(goal.x - h.x) > 0.5 || Math.abs(goal.y - h.y) > 0.5 || Math.abs(goal.w - h.w) > 0.5 || Math.abs(goal.h - h.h) > 0.5;
    if (!moved) return;
    this.chase();
    var target = this.target && document.contains(this.target) ? this.target : null;
    this.placePopover(target, this.steps[this.index], goal);
  };

  Tour.prototype.observe = function (target) {
    var self = this;
    if (typeof ResizeObserver === 'undefined') return;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = new ResizeObserver(function () { self.scheduleFollow(); });
    this.resizeObserver.observe(this.ui.pop);
    if (target) this.resizeObserver.observe(target);
  };

  Tour.prototype.focusPopover = function () {
    var target = this.ui.next.hidden ? this.ui.pop : this.ui.next;
    try { target.focus({ preventScroll: true }); } catch (e) {}
  };

  Tour.prototype.handleKey = function (e) {
    if (!this.open || !this.opts.keyboard) return;
    var tag = (e.target && e.target.tagName) || '';
    var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
    if (e.key === 'Escape') {
      if (this.opts.closable) {
        e.preventDefault();
        this.close('esc');
      }
      return;
    }
    if (typing && !this.ui.pop.contains(e.target)) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.prev();
    } else if (e.key === 'Tab' && this.stepValue(this.steps[this.index], 'mask')) {
      var focusables = Array.prototype.filter.call(
        this.ui.pop.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        function (n) { return !n.hidden && !n.disabled && n.offsetParent !== null; }
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !this.ui.pop.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !this.ui.pop.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return {
    create: function (options) { return new Tour(options); },
    active: function () { return active; },
    isDone: function (key) { return storageGet(key) === 'done'; },
    reset: function (key) { storageSet(key, null); },
    version: '1.0.2'
  };
});
