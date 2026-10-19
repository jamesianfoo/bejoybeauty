/* BEJOY landing — GSAP + ScrollTrigger + Lenis + three.js */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Split text (words / chars) ---------- */
  const CJK = /[㐀-鿿＀-￯]/;
  function setText(el, text) {
    if (!el.dataset.split) { el.textContent = text; return; }
    const chars = el.dataset.split === 'chars';
    const cjk = CJK.test(text);
    // Chinese has no spaces: animate per character so lines can still wrap
    const words = cjk && !chars ? [...text.trim()] : text.trim().split(/\s+/);
    el.setAttribute('aria-label', text.trim());
    el.innerHTML = words.map(w => chars
      ? `<span class="mask" aria-hidden="true">${[...w].map(c => `<span class="c">${c}</span>`).join('')}</span>`
      : `<span class="w" aria-hidden="true">${w}</span>`
    ).join(cjk ? '' : ' ');
  }

  /* ---------- Language (EN / 中文) ---------- */
  const I18N = window.I18N || { en: {}, zh: {} };
  // English lives in the HTML: capture it once so switching back restores it
  I18N.en['meta.title'] ??= document.title;
  $$('[data-i18n]').forEach(el => { I18N.en[el.dataset.i18n] ??= el.textContent.trim(); });
  $$('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(',').forEach(pair => {
    const [attr, key] = pair.split(':'); I18N.en[key] ??= el.getAttribute(attr);
  }));

  const store = { get: () => { try { return localStorage.getItem('bejoy-lang'); } catch { return null; } },
                  set: v => { try { localStorage.setItem('bejoy-lang', v); } catch {} } };
  let lang = new URLSearchParams(location.search).get('lang') || store.get() || 'en';
  if (!I18N[lang]) lang = 'en';
  const t = key => I18N[lang][key] ?? I18N.en[key] ?? '';

  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
    document.title = t('meta.title');
    $$('[data-i18n]').forEach(el => setText(el, t(el.dataset.i18n)));
    $$('[data-i18n-attr]').forEach(el => el.dataset.i18nAttr.split(',').forEach(pair => {
      const [attr, key] = pair.split(':'); el.setAttribute(attr, t(key));
    }));
    $$('.lang [data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  }
  applyLang();

  $('.footer__year').textContent = new Date().getFullYear();

  /* ---------- Newsletter ---------- */
  const news = $('.news'), newsMsg = $('.news__msg'), newsInput = $('#news-email');
  news.addEventListener('submit', e => {
    news.classList.remove('is-error');
    if (!newsInput.checkValidity()) {
      e.preventDefault();
      news.classList.add('is-error');
      newsMsg.dataset.key = 'news.invalid';
      newsMsg.textContent = t('news.invalid');
      newsInput.focus();
      return;
    }
    if (news.getAttribute('action')) return; // provider configured: submit natively
    e.preventDefault(); // preview mode: no provider yet, nothing is sent
    news.classList.add('is-done');
    newsMsg.dataset.key = 'news.ok';
    newsMsg.textContent = t('news.ok');
  });

  /* ---------- Smooth scroll ---------- */
  let lenis;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(target, { duration: 1.6 }) : target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- Hero shader (three.js) ---------- */
  const heroGL = (() => {
    const canvas = $('.hero__gl');
    if (!window.THREE) return null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); }
    catch { return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uRes: { value: new THREE.Vector2(1, 1) }, uReveal: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }',
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime, uReveal; uniform vec2 uMouse, uRes;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*n(p); p *= 2.02; a *= 0.5; } return v; }
        void main(){
          vec2 uv = vUv; float asp = uRes.x / uRes.y;
          vec2 p = vec2(uv.x * asp, uv.y);
          vec2 m = vec2(uMouse.x * asp, uMouse.y);
          float d = distance(p, m);
          float t = uTime * 0.06;
          vec2 q = vec2(fbm(p*1.6 + t), fbm(p*1.6 - t + 4.0));
          q += 0.18 * exp(-d*5.0) * normalize(p - m + 0.0001);       // cursor swirl
          float f = fbm(p*2.2 + q*1.8);
          vec3 cream = vec3(0.851, 0.824, 0.761);   // #D9D2C2
          vec3 light = vec3(0.902, 0.875, 0.816);
          vec3 sand  = vec3(0.808, 0.737, 0.655);   // #CEBCA7
          vec3 sage  = vec3(0.71, 0.78, 0.69);
          vec3 col = mix(cream, light, smoothstep(0.35, 0.8, f));
          col = mix(col, sand, smoothstep(0.55, 0.95, q.x) * 0.45);
          col = mix(col, sage, smoothstep(0.6, 1.0, q.y) * 0.18);
          // hair-like strands flowing up from the root
          float s = sin((p.x + f*0.35) * 55.0 + q.y*4.0);
          float strands = smoothstep(0.985, 1.0, s) * smoothstep(0.1, 0.9, 1.0 - uv.y) * 0.09;
          col = mix(col, vec3(0.51, 0.396, 0.29), strands * uReveal);
          // soft vignette keeps the logo area calm
          float v = smoothstep(0.0, 0.55, distance(uv, vec2(0.5)));
          col = mix(cream, col, mix(0.35, 1.0, v) * uReveal);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const size = () => {
      const { clientWidth: w, clientHeight: hgt } = canvas.parentElement;
      renderer.setSize(w, hgt, false); uniforms.uRes.value.set(w, hgt);
    };
    size(); addEventListener('resize', size);

    const target = new THREE.Vector2(0.5, 0.5);
    canvas.parentElement.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    });

    let visible = true;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
    const render = () => renderer.render(scene, camera);
    if (reduce) { uniforms.uReveal.value = 1; render(); return uniforms; }
    gsap.ticker.add(t => {
      if (!visible) return;
      uniforms.uTime.value = t;
      uniforms.uMouse.value.lerp(target, 0.05);
      render();
    });
    return uniforms;
  })();

  /* ---------- Cursor ---------- */
  if (fine && !reduce) {
    const cur = $('.cursor'), label = $('.cursor__ring em');
    const dx = gsap.quickTo('.cursor__dot', 'x', { duration: 0.12 }), dy = gsap.quickTo('.cursor__dot', 'y', { duration: 0.12 });
    const rx = gsap.quickTo('.cursor__ring', 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo('.cursor__ring', 'y', { duration: 0.5, ease: 'power3' });
    addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
    addEventListener('pointerover', e => {
      const lab = e.target.closest('[data-cursor]');
      const hov = e.target.closest('a, button');
      cur.classList.toggle('is-label', !!lab && !hov);
      cur.classList.toggle('is-hover', !!hov);
      if (lab) label.textContent = lab.dataset.cursor;
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (fine && !reduce) $$('.magnetic').forEach(el => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.35); y((e.clientY - r.top - r.height / 2) * 0.5);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });

  /* ---------- 3D tilt + sheen on product photos ---------- */
  if (fine && !reduce) $$('.tilt').forEach(el => {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3' });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry((px - 0.5) * 10); rx((0.5 - py) * 10);
      el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  /* ---------- Language switch (live, no reload) ---------- */
  // word-by-word reveal tied to scroll; re-run after text changes
  function scrub(p) {
    p._tween?.scrollTrigger?.kill(); p._tween?.kill();
    p._tween = gsap.to($$('.w', p), { opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 55%', scrub: true } });
  }
  function switchLang(next) {
    if (next === lang) return;
    lang = next; store.set(lang);
    const swap = () => {
      applyLang();
      if (!reduce) $$('.scrub').forEach(scrub);
      if (newsMsg.dataset.key) newsMsg.textContent = t(newsMsg.dataset.key);
      ScrollTrigger.refresh();
    };
    if (reduce) return swap();
    gsap.timeline()
      .to('main, footer', { autoAlpha: 0, duration: 0.25, ease: 'power1.in' })
      .add(swap)
      .to('main, footer', { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
  }
  $$('.lang [data-lang]').forEach(b => b.addEventListener('click', () => switchLang(b.dataset.lang)));

  /* ---------- Preloader + intro ---------- */
  const imgs = $$('img');
  let loaded = 0;
  const bar = $('.loader__bar span'), count = $('.loader__count');
  const progress = { v: 0 };
  const tick = () => gsap.to(progress, { v: loaded / imgs.length, duration: 0.4, overwrite: true, onUpdate: () => {
    bar.style.transform = `scaleX(${progress.v})`; count.textContent = Math.round(progress.v * 100);
  }});
  const ready = Promise.all(imgs.map(img => (img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; })).then(() => { loaded++; tick(); })));
  const minTime = new Promise(r => setTimeout(r, reduce ? 0 : 1200));
  const timeout = new Promise(r => setTimeout(r, 6000)); // never trap people behind the loader
  gsap.to('.loader__logo', { opacity: 1, duration: 0.8, ease: 'power2.out' });

  Promise.race([Promise.all([ready, minTime, document.fonts.ready]), timeout]).then(() => {
    document.body.classList.remove('is-loading');
    lenis?.start();
    ScrollTrigger.refresh();
    if (reduce) { gsap.set('.loader', { display: 'none' }); return; }

    gsap.timeline({ delay: 0.3 })
      .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' })
      .set('.loader', { display: 'none' })
      .to(heroGL ? heroGL.uReveal : {}, { value: 1, duration: 2, ease: 'power2.out' }, '-=0.6')
      .to('.hero__logo', { clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'expo.out' }, '-=1.8')
      .from('.hero__logo img', { scale: 1.12, duration: 1.8, ease: 'expo.out' }, '<')
      .from('.hero__tag .c', { yPercent: 110, duration: 1, stagger: 0.018, ease: 'expo.out' }, '-=1.1')
      .from('.hero__scroll', { autoAlpha: 0, duration: 0.8 }, '-=0.4');
  });

  const checkins = $$('.checkin');
  if (reduce) { checkins.forEach(c => c.classList.add('is-on')); return; }

  /* ---------- Scroll choreography ---------- */
  // hero content drifts away
  gsap.to('.hero__inner', { yPercent: -30, autoAlpha: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // photo opens from a framed card to full bleed
  gsap.timeline({ scrollTrigger: { trigger: '.shot', start: 'top bottom', end: 'bottom bottom', scrub: 1 } })
    .fromTo('.shot__frame', { clipPath: 'inset(16% 22% 16% 22% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none' })
    .fromTo('.shot__frame img', { scale: 1.35 }, { scale: 1, ease: 'none' }, 0);

  // Our Story
  gsap.from('.story__title .c', { yPercent: 110, duration: 1.2, stagger: 0.04, ease: 'expo.out',
    scrollTrigger: { trigger: '.story__title', start: 'top 85%' } });
  $$('.scrub').forEach(scrub);
  $$('.reveal-up').forEach(el => gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.1, ease: 'expo.out',
    scrollTrigger: { trigger: el, start: 'top 90%' } }));

  // Series
  gsap.timeline({ scrollTrigger: { trigger: '.series', start: 'top 70%' } })
    .to('.series__media', { clipPath: 'inset(0 0% 0 0)', duration: 1.6, ease: 'expo.inOut' })
    .from('.series__title .c', { yPercent: 110, duration: 1.1, stagger: 0.03, ease: 'expo.out' }, '-=0.8');
  gsap.fromTo('.series__media img', { yPercent: -6 }, { yPercent: 6, ease: 'none',
    scrollTrigger: { trigger: '.series', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Routine steps: photo wipes up, copy and key points follow
  $$('.step').forEach(step => {
    const media = $('.step__media', step);
    gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 75%' } })
      .to(media, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.inOut' })
      .from($('img', media), { scale: 1.3, duration: 1.8, ease: 'expo.out' }, '<0.2')
      .from($$('.step__body > :not(.points)', step), { y: 30, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'expo.out' }, '-=1.2');
    gsap.from($$('.point', step), { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out',
      scrollTrigger: { trigger: $('.points', step), start: 'top 85%' } });
  });

  // Scalp journey: the line grows with scroll; all three check-ins light up by 40% of it
  gsap.matchMedia().add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, ctx => {
    const prop = ctx.conditions.wide ? 'scaleX' : 'scaleY';
    gsap.fromTo('.journey__fill', { [prop]: 0 }, { [prop]: 1, ease: 'none',
      scrollTrigger: { trigger: '.journey__track', start: 'top 75%', end: 'bottom 80%', scrub: true,
        onUpdate: s => checkins.forEach((c, i) =>
          c.classList.toggle('is-on', s.progress >= Math.max(0.4 * i / (checkins.length - 1), 0.02))) } });
  });

  // Footer
  gsap.from('.footer__top > *', { y: 30, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'expo.out',
    scrollTrigger: { trigger: '.footer', start: 'top 85%' } });
})();
