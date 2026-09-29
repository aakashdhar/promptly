(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap;
  // Every plugin registered below must have loaded; if a CDN file didn't, the page shows its
  // still end states instead of stopping on a missing name.
  const motion = !!(G && window.ScrollTrigger && window.SplitText && window.Flip &&
    window.MotionPathPlugin && window.DrawSVGPlugin && !reduce);
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ====================================================================
     Windows visitors: the Windows copy is already in the HTML (hidden, or in data-win-* attributes),
     so the page without JS, and every non-Windows visitor, gets the Mac download exactly as before.
     This runs before SplitText and the motion setup so they split and measure the Windows text.
     ==================================================================== */
  const onWindows = navigator.userAgentData?.platform === 'Windows' || /Windows/.test(navigator.userAgent);
  if (onWindows) {
    $$('[data-win-href]').forEach((a) => { a.href = a.dataset.winHref; });
    $$('[data-win-text]').forEach((el) => { el.textContent = el.dataset.winText; });
    $$('[data-os="mac"]').forEach((el) => { el.hidden = true; });
    $$('[data-os="win"]').forEach((el) => { el.hidden = false; });
  }

  /* ====================================================================
     Mac downloads come in two builds, one per chip. Every button defaults to Apple Silicon (every
     Mac sold since 2020) with an "Intel Mac?" line under it. Safari can't tell which chip a Mac
     has, but Chrome and Edge can: on an Intel Mac they get the Intel build on the buttons and the
     line under them offers Apple Silicon instead.
     ==================================================================== */
  if (!onWindows && navigator.userAgentData?.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['architecture']).then(({ architecture }) => {
      if (architecture !== 'x86') return;
      const size = (el) => (el.textContent.match(/\((\d+) MB\)/) || [])[1];
      // The footer shows both sizes: the button's (Apple Silicon) and its line's (Intel).
      const footBtn = $('.foot-dl [data-intel-href]');
      const footAlt = $('.foot-dl [data-chip-link]');
      const armMB = footBtn && size(footBtn);
      const intelMB = footAlt && size(footAlt);
      let armHref = '';
      $$('[data-intel-href]').forEach((btn) => {
        armHref = btn.getAttribute('href');
        btn.setAttribute('href', btn.dataset.intelHref);
      });
      if (footBtn && armMB && intelMB) footBtn.textContent = footBtn.textContent.replace(`(${armMB} MB)`, `(${intelMB} MB)`);
      $$('[data-chip-link]').forEach((link) => {
        link.setAttribute('href', armHref);
        link.textContent = size(link) && armMB ? `Apple Silicon version (${armMB} MB)` : 'Download the Apple Silicon version';
        link.closest('[data-chip-other]').firstChild.textContent = 'On an Apple Silicon Mac? ';
      });
    }).catch(() => { /* keep the Apple Silicon default */ });
  }

  if (motion) {
    G.registerPlugin(ScrollTrigger, SplitText, Flip, MotionPathPlugin, DrawSVGPlugin);
    document.documentElement.classList.add('motion');
  }

  /* ====================================================================
     Smooth scroll (Lenis) driving ScrollTrigger
     ==================================================================== */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -64, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    if (id === '#try') setTimeout(() => $('#talk').focus({ preventScroll: true }), 900);
  }));

  // Header turns solid once you leave the top.
  const bar = $('#top-bar');
  const solid = () => bar.classList.toggle('is-solid', window.scrollY > 40);
  window.addEventListener('scroll', solid, { passive: true });
  solid();

  /* ====================================================================
     The console: hold, talk, let go, and the line travels down a lane
     ==================================================================== */
  const SUPPORT = 'so for the support dashboard, um, I want it to pull tickets from zendesk every five minutes, group them by product area, and flag anything that’s been waiting more than like four hours, and the support lead wants a summary email at 9';
  const LANES = {
    dictation: { name: 'Dictation', color: '#7C8677', said: SUPPORT, landed: 'Typed into Notes exactly as you said it.' },
    prompt: { name: 'Prompt', color: '#2A3FC9', said: SUPPORT, landed: 'Landed as a structured prompt. Score 58 to 86.' },
    code: { name: 'Code', color: '#4B6F8F', said: SUPPORT, landed: 'Landed as a task brief for Claude Code.' },
    workflow: { name: 'Workflow', color: '#3D7A1F', said: 'when someone fills in the typeform add a row to google sheets and post in slack', landed: 'Landed as an n8n workflow: Typeform Trigger, Append to Google Sheets, Post to Slack.' },
    video: { name: 'Video', color: '#B89400', said: 'a boat leaving the harbour at dawn, slow push in, warm light, and you can hear the gulls', landed: 'Landed as a Veo 3.1 video prompt.' },
    harness: { name: 'Harness', color: '#E0569A', said: 'every night fix the failing tests one at a time and never touch the migrations', landed: 'Landed as a nightly harness that runs every day at 02:00.' },
  };

  const stage = $('#stage');
  const wires = $('#wires');
  const talk = $('#talk');
  const talkLabel = $('#talkLabel');
  const line = $('#line');
  const lineText = $('#lineText');
  const dock = $('#dock');
  const packet = $('#packet');
  const packetText = $('#packetText');
  const status = $('#status');
  const thumb = $('#swThumb');
  const switches = $$('.sw', stage);
  const promptHTML = dock.innerHTML;
  const templateFor = (lane) => {
    if (lane === 'prompt') { const t = document.createElement('template'); t.innerHTML = promptHTML; return t; }
    return document.getElementById('t-' + lane);
  };

  let lane = 'prompt';
  let state = 'landed';
  let op = 0;
  let streamTimer = null;
  const NS = 'http://www.w3.org/2000/svg';
  let livePath = null;

  const rel = (el) => {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  };

  function drawWires(lit) {
    const w = stage.clientWidth, h = stage.clientHeight;
    wires.setAttribute('viewBox', `0 0 ${w} ${h}`);
    wires.textContent = '';
    const t = rel(talk), c = rel($('.console', stage)), d = rel(dock);
    const ox = t.x + t.w / 2, oy = c.y + c.h;
    let live = '', ex = 0;
    switches.forEach((sw) => {
      const dot = rel(sw.querySelector('.sw-dot')), b = rel(sw);
      const tx = dot.x + dot.w / 2, ty = b.y, mid = oy + (ty - oy) * 0.55;
      const curve = `M${ox},${oy} C${ox},${mid} ${tx},${mid} ${tx},${ty}`;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', curve); p.setAttribute('class', 'w-idle');
      wires.appendChild(p);
      if (sw.dataset.lane === lane) { live = `${curve} M${tx},${b.y + b.h} L${tx},${d.y}`; ex = tx; }
    });
    livePath = document.createElementNS(NS, 'path');
    livePath.setAttribute('d', live); livePath.setAttribute('class', 'w-live');
    wires.appendChild(livePath);
    const end = document.createElementNS(NS, 'circle');
    end.setAttribute('cx', ex); end.setAttribute('cy', d.y); end.setAttribute('r', 3.5);
    end.setAttribute('class', 'w-end');
    wires.appendChild(end);
    if (motion) {
      G.set(livePath, { drawSVG: lit ? '100%' : '0%' });
      G.set(end, { scale: lit ? 1 : 0, transformOrigin: '50% 50%' });
    } else if (!lit) { livePath.style.opacity = 0; end.style.opacity = 0; }
  }

  function moveThumb(animate) {
    const active = switches.find((s) => s.dataset.lane === lane);
    const s = rel(active), box = active.parentElement.getBoundingClientRect(), st = stage.getBoundingClientRect();
    const x = s.x - (box.left - st.left), y = s.y - (box.top - st.top);
    const props = { x, y, width: s.w, height: s.h };
    stage.style.setProperty('--lane', LANES[lane].color);
    if (motion && animate) G.to(thumb, { ...props, duration: 0.7, ease: 'elastic.out(1, 0.72)' });
    else if (motion) G.set(thumb, props);
    else Object.assign(thumb.style, { transform: `translate(${x}px, ${y}px)`, width: s.w + 'px', height: s.h + 'px' });
  }

  const setLine = (text, live) => { lineText.textContent = text; line.scrollLeft = live ? line.scrollWidth : 0; };

  function stream(text, id, perWord = 70) {
    const words = text.split(' ');
    let n = 0;
    clearInterval(streamTimer);
    streamTimer = setInterval(() => {
      if (id !== op) { clearInterval(streamTimer); return; }
      n += 1;
      setLine(words.slice(0, n).join(' '), true);
      if (n >= words.length) clearInterval(streamTimer);
    }, perWord);
  }

  function begin() {
    if (state === 'listening') return;
    const id = ++op;
    state = 'listening';
    stage.classList.add('is-live');
    talkLabel.textContent = 'Listening… let go to send';
    dock.style.minHeight = dock.offsetHeight + 'px';
    swapDock(`<div class="dock-wait">Listening. Let go and it goes down the ${LANES[lane].name} lane.</div>`);
    drawWires(false);
    if (!motion) setLine(LANES[lane].said, true);
    else { setLine('', true); stream(LANES[lane].said, id); }
    if (motion) G.to(talk, { scale: 0.95, duration: 0.25, ease: 'power3.out' });
  }

  function end() {
    if (state !== 'listening') return;
    clearInterval(streamTimer);
    stage.classList.remove('is-live');
    talkLabel.textContent = 'Hold to talk';
    if (motion) G.to(talk, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    setLine(LANES[lane].said, true);
    route(++op);
  }

  function swapDock(html) {
    dock.innerHTML = html;
    if (motion) G.from(dock.firstElementChild, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.out' });
  }

  function route(id) {
    state = 'routing';
    drawWires(false);
    packetText.textContent = '“' + LANES[lane].said.split(' ').slice(0, 4).join(' ') + '…”';
    if (!motion) { land(id, false); return; }
    packet.classList.add('is-on');
    const endDot = wires.querySelector('.w-end');
    const tl = G.timeline({ onComplete: () => { if (id === op) land(id, true); } });
    tl.set(packet, { scale: 0.6, opacity: 0 })
      .to(packet, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' })
      .to(livePath, { drawSVG: '100%', duration: 1.05, ease: 'power2.inOut' }, 0)
      .to(packet, {
        duration: 1.05, ease: 'power2.inOut',
        motionPath: { path: livePath, align: livePath, alignOrigin: [0.5, 0.5] },
      }, 0)
      .to(packet, { scale: 0.4, opacity: 0, duration: 0.2, ease: 'power2.in' }, '-=0.18')
      .to(endDot, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' }, '-=0.1')
      .add(() => packet.classList.remove('is-on'));
  }

  function land(id, animate) {
    if (id !== op) return;
    const tpl = templateFor(lane);
    dock.innerHTML = '';
    dock.appendChild(tpl.content.cloneNode(true));
    const art = dock.querySelector('.art');
    dock.style.minHeight = '';
    state = 'landed';
    setLine(LANES[lane].said, false);
    status.textContent = LANES[lane].landed;
    if (!animate || !motion) { drawWires(true); finishTyping(art); return; }
    const parts = $$('.art-head, .ln, .node, .loop li', art);
    G.timeline()
      .from(art, { y: 28, opacity: 0, scale: 0.97, duration: 0.7, ease: 'expo.out', transformOrigin: '50% 0%' })
      .from(parts, { opacity: 0, x: -14, clipPath: 'inset(0 100% 0 0)', duration: 0.6, stagger: 0.055, ease: 'power3.out', clearProps: 'clipPath' }, 0.1);
    const chip = art.querySelector('.score-chip .s-now');
    if (chip) { const o = { v: 58 }; G.to(o, { v: 86, duration: 1.2, delay: 0.4, ease: 'power2.out', onUpdate: () => { chip.textContent = Math.round(o.v); } }); }
    typeOut(art, id);
  }

  function typeOut(art, id) {
    const el = art.querySelector('.typed');
    if (!el) return;
    const full = el.dataset.full;
    let n = 0;
    const timer = setInterval(() => {
      if (id !== op) { clearInterval(timer); return; }
      n = Math.min(full.length, n + 3);
      el.textContent = full.slice(0, n);
      if (n >= full.length) clearInterval(timer);
    }, 16);
  }
  const finishTyping = (art) => { const el = art && art.querySelector('.typed'); if (el) el.textContent = el.dataset.full; };

  function pick(next, reroute) {
    if (next === lane && !reroute) return;
    lane = next;
    switches.forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.lane === lane)));
    moveThumb(true);
    const id = ++op;
    const out = dock.firstElementChild;
    const go = () => {
      if (id !== op) return;
      if (motion) { setLine('', true); stream(LANES[lane].said, id, 28); }
      setTimeout(() => { if (id === op) { setLine(LANES[lane].said, true); route(id); } }, motion ? Math.min(900, LANES[lane].said.split(' ').length * 28 + 120) : 0);
    };
    if (motion && out) G.to(out, { opacity: 0, x: -24, filter: 'blur(6px)', duration: 0.3, ease: 'power2.in', onComplete: go });
    else go();
  }

  talk.addEventListener('pointerdown', (e) => { e.preventDefault(); talk.setPointerCapture?.(e.pointerId); begin(); });
  talk.addEventListener('pointerup', end);
  talk.addEventListener('pointercancel', end);
  talk.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); } });
  talk.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); end(); } });
  switches.forEach((s) => s.addEventListener('click', () => pick(s.dataset.lane, false)));

  const layoutStage = () => { moveThumb(false); drawWires(state === 'landed'); };
  window.addEventListener('resize', layoutStage);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(layoutStage);

  /* ====================================================================
     Films: play muted on a loop while on screen, pause when scrolled away. With reduced motion
     they wait for the button. Works with or without the motion libraries.
     ==================================================================== */
  const player = (video, toggle, box) => {
    let userPaused = reduce;
    const sync = () => {
      toggle.textContent = video.paused ? 'Play' : 'Pause';
      toggle.setAttribute('aria-pressed', String(video.paused));
      if (box) box.classList.toggle('is-paused', video.paused);
    };
    toggle.addEventListener('click', () => { if (video.paused) { userPaused = false; video.play(); } else { userPaused = true; video.pause(); } });
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    sync();
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !userPaused) video.play().catch(() => {});
      else if (!e.isIntersecting) video.pause();
    }, { threshold: 0.35 }).observe(video);
  };
  const reelVideo = $('#reelVideo');
  // Autoplay starts on frame 0 (a dot on the line), so that's the poster. Anyone who asked for less
  // motion sees the headline frame instead until they press Play.
  if (reduce) reelVideo.poster = 'site/assets/reel-still.jpg';
  else reelVideo.preload = 'auto';
  player(reelVideo, $('#reelToggle'), $('#reel'));
  player($('#filmVideo'), $('#filmToggle'));

  if (!motion) return;

  /* ====================================================================
     Everything below is motion only
     ==================================================================== */
  G.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // Magnetic buttons
  if (hover) $$('.magnetic').forEach((b) => {
    const xTo = G.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = G.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35);
      yTo((e.clientY - r.top - r.height / 2) * 0.45);
    });
    b.addEventListener('pointerleave', () => { G.to(b, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }); });
  });

  document.fonts.ready.then(() => {
    /* ---------- hero: the film is already running; the bar under it rises in ---------- */
    G.timeline({ defaults: { ease: 'expo.out' } })
      .from('.top', { yPercent: -100, duration: 0.9 }, 0)
      .from('[data-rise]', { y: 26, opacity: 0, filter: 'blur(10px)', duration: 1.1, stagger: 0.09 }, 0.35);

    /* ---------- section headings: lines rise out of a mask ---------- */
    $$('.split-head').forEach((h) => {
      const s = SplitText.create(h, { type: 'lines,words', mask: 'lines', linesClass: 'split-line' });
      G.from(s.words, { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: 0.035, scrollTrigger: { trigger: h, start: 'top 86%' } });
    });

    /* ---------- try: first visit plays a demo on its own ---------- */
    ScrollTrigger.create({
      trigger: '#stage', start: 'top 70%', once: true,
      onEnter: () => { if (state === 'landed' && op === 0) { begin(); setTimeout(end, 2600); } },
    });
    G.from('.stage .console, .stage .sw, .stage .dock', { y: 30, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '#stage', start: 'top 85%' } });

    /* ---------- ticker: two rows sliding, speed follows your scroll ---------- */
    $$('.tick-row').forEach((row) => {
      const track = row.querySelector('.tick-track');
      while (row.scrollWidth < innerWidth * 2.2) row.appendChild(track.cloneNode(true));
      row.appendChild(track.cloneNode(true));
      const tracks = $$('.tick-track', row);
      const dir = Number(row.dataset.dir);
      const width = track.offsetWidth;
      const loop = G.fromTo(tracks, { x: dir < 0 ? 0 : -width }, { x: dir < 0 ? -width : 0, duration: width / 70, ease: 'none', repeat: -1 });
      ScrollTrigger.create({
        trigger: '.ticker', start: 'top bottom', end: 'bottom top',
        onUpdate: (self) => {
          const v = G.utils.clamp(-6, 6, self.getVelocity() / 250);
          G.to(loop, { timeScale: (1 + Math.abs(v)) * (self.direction || 1), duration: 0.2, overwrite: true });
          G.to(loop, { timeScale: self.direction || 1, duration: 1.2, delay: 0.2, ease: 'power2.out' });
        },
      });
    });

    /* ---------- what it makes: pinned horizontal lanes ---------- */
    const mm = G.matchMedia();
    mm.add('(min-width: 1024px) and (min-height: 680px)', () => {
      const track = $('#track');
      const panels = $$('.panel', track);
      const rail = $$('.rail span');
      const skewTo = G.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3.out' });
      const dist = () => track.scrollWidth - innerWidth + 64;
      const slide = G.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '.makes', pin: '.makes-pin', start: 'top top', end: () => '+=' + dist() * 1.1,
          scrub: 1, invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress * rail.length;
            rail.forEach((r, i) => r.style.setProperty('--p', G.utils.clamp(0, 1, p - i)));
            skewTo(G.utils.clamp(-4, 4, self.getVelocity() / -600));
          },
        },
      });
      panels.forEach((p) => {
        G.from(p, { opacity: 0.2, y: 60, rotation: 2.5, scale: 0.94, ease: 'power2.out', scrollTrigger: { trigger: p, containerAnimation: slide, start: 'left 95%', end: 'left 55%', scrub: true } });
        G.from($$('.ln, .node, .art-quote', p), { opacity: 0, x: 30, stagger: 0.06, ease: 'power3.out', duration: 0.8, scrollTrigger: { trigger: p, containerAnimation: slide, start: 'left 70%' } });
      });
      return () => G.set(track, { clearProps: 'all' });
    });
    mm.add('(max-width: 1023px), (max-height: 679px)', () => {
      ScrollTrigger.batch('.panel', { start: 'top 88%', once: true, onEnter: (b) => G.from(b, { y: 50, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }) });
    });

    /* ---------- film: the frame grows to fill the page ---------- */
    G.fromTo('#filmFrame', { scale: 0.74, y: 80, borderRadius: 40 }, { scale: 1, y: 0, borderRadius: 20, ease: 'none', scrollTrigger: { trigger: '.film', start: 'top 90%', end: 'top top', scrub: true } });

    /* ---------- proof: scrubbed score ---------- */
    $$('.db').forEach((db) => { const b = db.querySelector('.db-b'); b.style.left = `calc(${getComputedStyle(db).getPropertyValue('--a')} * 1%)`; });
    const nums = $$('.db .n');
    nums.forEach((n) => { n.dataset.from = n.parentElement.firstElementChild.textContent; n.textContent = n.dataset.from; });
    const total = $('#totalNow'); total.textContent = '58';
    const score = { v: 58 };
    const proofTl = G.timeline({ defaults: { ease: 'power2.inOut' } })
      .fromTo('.total-arrow span', { scaleX: 0 }, { scaleX: 1, duration: 0.3 })
      .to(score, { v: 86, duration: 1, onUpdate: () => { total.textContent = Math.round(score.v); } }, 0.1)
      .from('.db-seg', { scaleX: 0, duration: 0.8, stagger: 0.1 }, 0.2)
      .to('.db-b', { left: (i, el) => `calc(${getComputedStyle(el.closest('.db')).getPropertyValue('--b')} * 1%)`, duration: 0.8, stagger: 0.1 }, 0.2)
      .to(nums.map((n) => ({ n, v: +n.dataset.from })), { v: (i) => +nums[i].dataset.to, duration: 0.8, stagger: 0.1, onUpdate() { this.targets().forEach((t) => { t.n.textContent = Math.round(t.v); }); } }, 0.2)
      .from('.missing', { y: 30, opacity: 0, duration: 0.4 }, 0.9)
      .from('.shot', { y: 120, rotation: -3, opacity: 0.3, duration: 1.2 }, 0);
    const pm = G.matchMedia();
    pm.add('(min-width: 1040px) and (min-height: 700px)', () => {
      ScrollTrigger.create({ animation: proofTl, trigger: '.proof', pin: '.proof-pin', start: 'top top', end: '+=110%', scrub: 1 });
    });
    pm.add('(max-width: 1039px), (max-height: 699px)', () => {
      ScrollTrigger.create({ animation: proofTl, trigger: '.proof', start: 'top 60%', toggleActions: 'play none none none' });
    });

    /* ---------- privacy: audio loops inside the Mac, text travels out ---------- */
    const svg = $('#flowSvg');
    const mk = (g, cls, r) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', r); c.setAttribute('class', cls); $(g, svg).appendChild(c); return c; };
    const audio = [0, 1, 2, 3, 4].map(() => mk('#audioDots', 'a-dot', 3.5));
    const text = [0, 1].map(() => mk('#textDots', 't-dot', 4.5));
    const flowTl = G.timeline({ paused: true });
    audio.forEach((d, i) => {
      flowTl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.2, repeat: -1, repeatDelay: 1.8, delay: i * 0.4 }, 0);
      flowTl.to(d, { duration: 2, ease: 'none', repeat: -1, delay: i * 0.4, motionPath: { path: '#pAudio', align: '#pAudio', alignOrigin: [0.5, 0.5] } }, 0);
    });
    text.forEach((d, i) => {
      flowTl.to(d, { duration: 2.4, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.6, delay: 0.8 + i * 1.5, motionPath: { path: 'M270 190 L 336 190 C 420 190, 440 130, 488 130', alignOrigin: [0.5, 0.5] } }, 0);
    });
    ScrollTrigger.create({ trigger: '.flow', start: 'top 85%', end: 'bottom top', onToggle: (self) => (self.isActive ? flowTl.play() : flowTl.pause()) });
    G.from('.flow-svg .wire', { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut', stagger: 0.2, scrollTrigger: { trigger: '.flow', start: 'top 80%' } });
    G.from('.flow-svg .node', { opacity: 0, scale: 0.6, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(2)', stagger: 0.12, scrollTrigger: { trigger: '.flow', start: 'top 80%' } });
    G.from('.readout div', { opacity: 0, x: 24, duration: 0.7, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.readout', start: 'top 90%' } });

    /* ---------- setup: the line draws as you scroll ---------- */
    G.from('.steps-line path', { drawSVG: '0%', ease: 'none', scrollTrigger: { trigger: '.steps-wrap', start: 'top 80%', end: 'bottom 55%', scrub: true } });
    G.from('.steps li', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.15, scrollTrigger: { trigger: '.steps-wrap', start: 'top 80%' } });

    /* ---------- how it's made: the pipeline draws, stages light up, numbers count ---------- */
    G.from('.pipe-line path', { drawSVG: '0%', ease: 'none', scrollTrigger: { trigger: '.pipe-wrap', start: 'top 80%', end: 'bottom 50%', scrub: true } });
    G.from('.pipe li', { y: 36, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.pipe-wrap', start: 'top 80%' } });
    G.from('.pipe-dot', { scale: 0, duration: 0.7, ease: 'back.out(3)', stagger: 0.12, scrollTrigger: { trigger: '.pipe-wrap', start: 'top 78%' } });
    $$('.made-stats dd').forEach((dd) => {
      const to = +dd.dataset.count, o = { v: 0 };
      dd.textContent = '0';
      G.to(o, { v: to, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: '.made-stats', start: 'top 85%' }, onUpdate: () => { dd.textContent = Math.round(o.v); } });
    });
    G.from('.made-stats div', { y: 24, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: '.made-stats', start: 'top 85%' } });

    /* ---------- FAQ: smooth open and close ---------- */
    $$('.qa details').forEach((d) => {
      const sum = d.querySelector('summary'), body = d.querySelector('p');
      sum.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.open) G.to(body, { height: 0, opacity: 0, duration: 0.35, ease: 'power2.inOut', onComplete: () => { d.open = false; G.set(body, { clearProps: 'all' }); } });
        else { d.open = true; G.from(body, { height: 0, opacity: 0, duration: 0.5, ease: 'expo.out', clearProps: 'all' }); }
      });
    });
    G.from('.qa details', { opacity: 0, y: 20, stagger: 0.06, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: '.qa', start: 'top 85%' } });

    /* ---------- footer: the wordmark rises letter by letter ---------- */
    const mark = SplitText.create('.wordmark', { type: 'chars', charsClass: 'char' });
    G.from(mark.chars, { yPercent: 100, opacity: 0, rotate: 6, duration: 1.3, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.wordmark', start: 'top 95%' } });
    G.fromTo(mark.chars, { color: '#E6EFD9' }, { color: '#D3DDC6', stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top 60%', end: 'bottom bottom', scrub: true } });

    ScrollTrigger.refresh();
  });

  /* ---------- Install: copy the Terminal line (works with or without motion) ---------- */
  $$('.cmd-copy').forEach((btn) => {
    let timer = null;
    btn.addEventListener('click', async () => {
      const text = $(btn.dataset.copy)?.textContent.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
      } catch {
        // No clipboard access (older browser or insecure context): select it for ⌘C instead.
        const range = document.createRange();
        range.selectNodeContents($(btn.dataset.copy));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = 'Press ⌘C';
      }
      clearTimeout(timer);
      timer = setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
})();
