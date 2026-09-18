/**
 * Sarah's Magical Night Sky — Interactive Birthday Experience
 * Vanilla JS cinematic scene engine + canvas starfield
 */

(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;

  const WISHES = [
    "راحة بال",
    "أيام جميلة",
    "بدايات موفقة",
    "نجاحات تفرحك",
    "أخبار حلوة",
    "طمأنينة وسكينة",
    "مفاجآت جميلة",
    "أمنيات تتحقق",
    "سنة أخف وأجمل",
  ];

  const MEMORY_IMAGES = [
    { src: "images/sarah1.jpg", caption: "لحظة ١" },
    { src: "images/sarah2.jpg", caption: "لحظة ٢" },
    { src: "images/sarah3.jpg", caption: "لحظة ٣" },
  ];

  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, prefersReducedMotion ? Math.min(ms, 200) : ms));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function reveal(el) {
    if (!el) return;
    el.hidden = false;
    // force reflow for transition
    void el.offsetWidth;
    el.classList.add("is-visible");
  }

  function hideEl(el) {
    if (!el) return;
    el.classList.remove("is-visible");
  }

  function sparkBurst(x, y, count = 8) {
    if (prefersReducedMotion) return;
    for (let i = 0; i < count; i++) {
      const bit = document.createElement("span");
      bit.className = "spark-burst";
      const angle = (Math.PI * 2 * i) / count + rand(-0.2, 0.2);
      const dist = rand(18, 42);
      bit.style.left = `${x}px`;
      bit.style.top = `${y}px`;
      bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      bit.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      bit.style.background = pick(["#fff", "#ffe9c0", "#dce4ff"]);
      document.body.appendChild(bit);
      setTimeout(() => bit.remove(), 700);
    }
  }

  /* =========================================================
     Starfield (Canvas)
     ========================================================= */

  class Starfield {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.stars = [];
      this.particles = [];
      this.shooting = [];
      this.dpr = 1;
      this.w = 0;
      this.h = 0;
      this.t = 0;
      this.running = true;
      this.density = 0.22; // intro: sparse but visible
      this.targetDensity = 0.22;
      this.brightness = 0.62;
      this.targetBrightness = 0.62;
      this.parallax = { x: 0, y: 0 };
      this.pointer = { x: 0.5, y: 0.5 };
      this.mode = "intro"; // intro | normal | bright | dim | dark | celebrate
      this.raf = 0;

      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);

      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
      this.seed();
      this.raf = requestAnimationFrame(this.loop);
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
      this.canvas.style.width = `${this.w}px`;
      this.canvas.style.height = `${this.h}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.stars.length) this.seed();
    }

    seed() {
      const area = this.w * this.h;
      const baseCount = prefersReducedMotion
        ? Math.floor(area / 9000)
        : Math.floor(area / 4200);
      const count = clamp(baseCount, 80, isTouch ? 220 : 380);

      this.stars = Array.from({ length: count }, () => this.makeStar());
      this.particles = Array.from({ length: prefersReducedMotion ? 12 : 40 }, () => ({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: rand(0.4, 1.2),
        s: rand(0.05, 0.2),
        a: rand(0.08, 0.28),
        p: rand(0.2, 1),
      }));
    }

    makeStar() {
      const layer = Math.random();
      let size;
      if (layer > 0.96) size = rand(1.6, 2.6);
      else if (layer > 0.85) size = rand(1.1, 1.7);
      else size = rand(0.4, 1.05);

      return {
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: size,
        baseA: rand(0.25, 0.95),
        tw: rand(0.4, 2.2),
        ph: Math.random() * Math.PI * 2,
        layer: layer < 0.4 ? 0.35 : layer < 0.75 ? 0.65 : 1,
        drift: rand(-0.015, 0.015),
        revealed: Math.random() < this.density,
        revealT: Math.random(),
      };
    }

    setMode(mode) {
      this.mode = mode;
      const map = {
        intro: { d: 0.18, b: 0.5 },
        rising: { d: 0.55, b: 0.7 },
        normal: { d: 0.85, b: 0.75 },
        bright: { d: 1, b: 0.95 },
        wishes: { d: 0.7, b: 0.65 },
        calm: { d: 0.6, b: 0.55 },
        dark: { d: 0.05, b: 0.15 },
        celebrate: { d: 1, b: 1 },
      };
      const m = map[mode] || map.normal;
      this.targetDensity = m.d;
      this.targetBrightness = m.b;
    }

    convergeToCenter(duration = 1400) {
      if (prefersReducedMotion) {
        this.stars.forEach((s) => {
          s.x = this.w * 0.5 + rand(-20, 20);
          s.y = this.h * 0.5 + rand(-20, 20);
        });
        return Promise.resolve();
      }
      const start = performance.now();
      const origins = this.stars.map((s) => ({ x: s.x, y: s.y }));
      const cx = this.w * 0.5;
      const cy = this.h * 0.5;

      return new Promise((resolve) => {
        const step = (now) => {
          const p = clamp((now - start) / duration, 0, 1);
          const e = 1 - Math.pow(1 - p, 3);
          this.stars.forEach((s, i) => {
            s.x = origins[i].x + (cx - origins[i].x) * e * 0.85;
            s.y = origins[i].y + (cy - origins[i].y) * e * 0.85;
          });
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    fadeStarsOut() {
      this.setMode("dark");
    }

    onPointer(nx, ny) {
      this.pointer.x = nx;
      this.pointer.y = ny;
    }

    maybeShoot() {
      if (prefersReducedMotion) return;
      if (this.mode === "dark" || this.mode === "intro") return;
      if (this.shooting.length > 1) return;
      if (Math.random() > 0.006) return;
      this.shooting.push({
        x: rand(0, this.w * 0.8),
        y: rand(0, this.h * 0.4),
        len: rand(60, 140),
        speed: rand(6, 11),
        angle: rand(0.35, 0.7),
        life: 1,
        decay: rand(0.012, 0.02),
      });
    }

    loop(ts) {
      if (!this.running) {
        this.raf = requestAnimationFrame(this.loop);
        return;
      }

      this.t = ts * 0.001;
      this.density += (this.targetDensity - this.density) * 0.02;
      this.brightness += (this.targetBrightness - this.brightness) * 0.025;

      const targetPx = (this.pointer.x - 0.5) * 18;
      const targetPy = (this.pointer.y - 0.5) * 12;
      this.parallax.x += (targetPx - this.parallax.x) * 0.04;
      this.parallax.y += (targetPy - this.parallax.y) * 0.04;

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      // soft atmosphere wash
      const g = ctx.createRadialGradient(
        this.w * 0.5,
        this.h * 0.2,
        0,
        this.w * 0.5,
        this.h * 0.5,
        this.w * 0.7
      );
      g.addColorStop(0, `rgba(40, 50, 90, ${0.04 * this.brightness})`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);

      const revealThreshold = this.density;

      for (const s of this.stars) {
        if (s.revealT > revealThreshold && this.mode !== "celebrate") {
          // gradually allow more
          if (Math.random() < 0.002) s.revealT = Math.random() * revealThreshold;
          continue;
        }

        if (!s.revealed && s.revealT <= revealThreshold) s.revealed = true;
        if (!s.revealed) continue;

        const twinkle = 0.55 + 0.45 * Math.sin(this.t * s.tw + s.ph);
        const a = s.baseA * twinkle * this.brightness;

        if (!prefersReducedMotion) {
          s.x += s.drift * s.layer;
          if (s.x < -4) s.x = this.w + 4;
          if (s.x > this.w + 4) s.x = -4;
        }

        const px = s.x + this.parallax.x * s.layer;
        const py = s.y + this.parallax.y * s.layer;

        ctx.beginPath();
        ctx.fillStyle = `rgba(244, 241, 232, ${clamp(a, 0, 1)})`;
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (s.r > 1.4 && a > 0.4) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(220, 230, 255, ${a * 0.2})`;
          ctx.arc(px, py, s.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // dust particles
      for (const p of this.particles) {
        if (!prefersReducedMotion) {
          p.y -= p.s;
          p.x += Math.sin(this.t * 0.3 + p.y * 0.01) * 0.08;
          if (p.y < -4) {
            p.y = this.h + 4;
            p.x = Math.random() * this.w;
          }
        }
        const px = p.x + this.parallax.x * p.p * 0.4;
        const py = p.y + this.parallax.y * p.p * 0.4;
        ctx.beginPath();
        ctx.fillStyle = `rgba(230, 235, 255, ${p.a * this.brightness})`;
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      this.maybeShoot();
      for (let i = this.shooting.length - 1; i >= 0; i--) {
        const sh = this.shooting[i];
        sh.x += Math.cos(sh.angle) * sh.speed;
        sh.y += Math.sin(sh.angle) * sh.speed;
        sh.life -= sh.decay;

        const grad = ctx.createLinearGradient(
          sh.x,
          sh.y,
          sh.x - Math.cos(sh.angle) * sh.len,
          sh.y - Math.sin(sh.angle) * sh.len
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${sh.life * 0.9})`);
        grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(
          sh.x - Math.cos(sh.angle) * sh.len,
          sh.y - Math.sin(sh.angle) * sh.len
        );
        ctx.stroke();

        if (sh.life <= 0 || sh.x > this.w + 50 || sh.y > this.h + 50) {
          this.shooting.splice(i, 1);
        }
      }

      this.raf = requestAnimationFrame(this.loop);
    }

    pause() {
      this.running = false;
    }

    resume() {
      this.running = true;
    }
  }

  /* =========================================================
     Scene Manager
     ========================================================= */

  class SceneManager {
    constructor() {
      this.current = 1;
      this.busy = false;
    }

    async goTo(n) {
      if (this.busy || n === this.current) return;
      this.busy = true;

      const from = document.getElementById(`scene-${this.current}`);
      const to = document.getElementById(`scene-${n}`);
      if (!from || !to) {
        this.busy = false;
        return;
      }

      from.classList.remove("scene--active");
      from.classList.add("scene--leaving");

      to.hidden = false;
      void to.offsetWidth;
      to.classList.add("scene--active");
      to.classList.remove("scene--leaving");

      await wait(prefersReducedMotion ? 350 : 1350);

      from.hidden = true;
      from.classList.remove("scene--leaving");
      this.current = n;
      this.busy = false;
    }
  }

  /* =========================================================
     App
     ========================================================= */

  class App {
    constructor() {
      this.starfield = new Starfield(document.getElementById("starfield"));
      this.scenes = new SceneManager();
      this.moon = document.getElementById("moon");
      this.centerLight = document.getElementById("centerLight");
      this.live = document.getElementById("liveRegion");
      this.viewedMemories = new Set();
      this.memoryIndex = 0;
      this.wishStarted = false;
      this.endingDone = false;

      this.buildClouds();
      this.bindGlobal();
      this.bindAudio();
      this.startScene1();
    }

    announce(text) {
      if (this.live) this.live.textContent = text;
    }

    buildClouds() {
      const host = document.getElementById("clouds");
      if (!host) return;
      const n = prefersReducedMotion ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const c = document.createElement("div");
        c.className = "cloud";
        c.style.width = `${rand(180, 420)}px`;
        c.style.height = `${rand(60, 140)}px`;
        c.style.top = `${rand(10, 70)}%`;
        c.style.left = `${rand(-10, 80)}%`;
        c.style.animationDuration = `${rand(40, 80)}s`;
        c.style.animationDelay = `${rand(-40, 0)}s`;
        host.appendChild(c);
      }
    }

    bindGlobal() {
      const onMove = (clientX, clientY) => {
        this.starfield.onPointer(clientX / window.innerWidth, clientY / window.innerHeight);
      };

      window.addEventListener(
        "pointermove",
        (e) => onMove(e.clientX, e.clientY),
        { passive: true }
      );

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.starfield.pause();
        else this.starfield.resume();
      });

      // Keyboard: Enter/Space on focused buttons already works natively
      document.addEventListener("keydown", (e) => {
        const viewer = document.getElementById("memoryViewer");
        if (!viewer || viewer.hidden) return;
        if (e.key === "Escape") this.closeMemory();
        if (e.key === "ArrowLeft") this.showMemory(this.memoryIndex + 1);
        if (e.key === "ArrowRight") this.showMemory(this.memoryIndex - 1);
      });
    }

    bindAudio() {
      const btn = document.getElementById("audioToggle");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const on = btn.getAttribute("aria-pressed") === "true";
        btn.setAttribute("aria-pressed", String(!on));
        // Structure ready — no external audio file bundled
        this.announce(on ? "الصوت متوقف" : "الصوت جاهز عند إضافة المقطع");
      });
    }

    /* ---------- Scene 1 ---------- */

    async startScene1() {
      this.starfield.setMode("intro");
      await wait(1200);
      this.starfield.setMode("rising");
      await wait(1600);

      reveal(document.getElementById("s1-line1"));
      this.announce("في مكانٍ ما، هناك شخص بجنن يستحق أن نحتفل به اليوم..");
      await wait(2800);

      reveal(document.getElementById("s1-line2"));
      await wait(2000);

      reveal(document.getElementById("s1-btn"));
      document.getElementById("s1-btn").addEventListener("click", () => this.fromScene1(), { once: true });
    }

    async fromScene1() {
      const btn = document.getElementById("s1-btn");
      btn.classList.add("is-fading");
      hideEl(document.getElementById("s1-line1"));
      hideEl(document.getElementById("s1-line2"));

      this.centerLight.classList.add("is-on");
      await this.starfield.convergeToCenter(1300);
      this.starfield.setMode("bright");
      await wait(700);

      await this.scenes.goTo(2);
      this.centerLight.classList.remove("is-on");
      this.startScene2();
    }

    /* ---------- Scene 2 ---------- */

    async startScene2() {
      this.starfield.setMode("bright");
      const stage = document.getElementById("cakeStage");
      reveal(stage);
      this.spawnCakeDecor();

      await wait(1400);
      reveal(document.getElementById("s2-line1"));
      this.announce("كل عام وإنتِ بخير يا أحلى سارة بالدنيا!!");
      await wait(2200);
      reveal(document.getElementById("s2-btn"));
      document.getElementById("s2-btn").addEventListener("click", () => this.fromScene2(), { once: true });
    }

    spawnCakeDecor() {
      const particles = document.getElementById("cakeParticles");
      const sparkles = document.getElementById("cakeSparkles");
      if (!particles || !sparkles) return;

      const colors = ["#e8d5b5", "#c8d0f0", "#f0e8d8", "#d4b896"];
      for (let i = 0; i < (prefersReducedMotion ? 4 : 12); i++) {
        const bit = document.createElement("span");
        bit.className = "confetti-bit";
        bit.style.left = `${rand(10, 90)}%`;
        bit.style.bottom = `${rand(0, 30)}%`;
        bit.style.background = pick(colors);
        bit.style.animationDelay = `${rand(0, 4)}s`;
        bit.style.animationDuration = `${rand(4, 7)}s`;
        particles.appendChild(bit);
      }

      for (let i = 0; i < (prefersReducedMotion ? 3 : 8); i++) {
        const sp = document.createElement("span");
        sp.className = "sparkle";
        sp.style.left = `${rand(5, 95)}%`;
        sp.style.top = `${rand(0, 70)}%`;
        sp.style.animationDelay = `${rand(0, 2)}s`;
        sparkles.appendChild(sp);
      }
    }

    async fromScene2() {
      const btn = document.getElementById("s2-btn");
      btn.classList.add("is-fading");
      await wait(400);
      await this.scenes.goTo(3);
      this.startScene3();
    }

    /* ---------- Scene 3 ---------- */

    async startScene3() {
      this.starfield.setMode("normal");
      await wait(600);
      reveal(document.getElementById("s3-intro"));

      const stars = [...document.querySelectorAll(".memory-star")];
      for (let i = 0; i < stars.length; i++) {
        await wait(450);
        stars[i].classList.add("is-visible");
      }

      stars.forEach((star) => {
        star.addEventListener("click", (e) => {
          const idx = Number(star.dataset.memory);
          const rect = star.getBoundingClientRect();
          sparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 10);
          this.openMemory(idx);
        });
      });

      this.bindMemoryControls();
    }

    bindMemoryControls() {
      document.getElementById("memoryClose").addEventListener("click", () => this.closeMemory());
      document.getElementById("memoryBackdrop").addEventListener("click", () => this.closeMemory());
      document.getElementById("memoryPrev").addEventListener("click", () => this.showMemory(this.memoryIndex - 1));
      document.getElementById("memoryNext").addEventListener("click", () => this.showMemory(this.memoryIndex + 1));

      const frame = document.getElementById("memoryFrame");
      let startX = 0;
      frame.addEventListener(
        "touchstart",
        (e) => {
          startX = e.changedTouches[0].clientX;
        },
        { passive: true }
      );
      frame.addEventListener(
        "touchend",
        (e) => {
          const dx = e.changedTouches[0].clientX - startX;
          // RTL: swipe right (positive dx) = previous visually toward next content? 
          // In RTL UI, swiping left often means next. Use: swipe left (negative) -> next index+1
          if (Math.abs(dx) < 40) return;
          if (dx < 0) this.showMemory(this.memoryIndex + 1);
          else this.showMemory(this.memoryIndex - 1);
        },
        { passive: true }
      );

      const dots = document.getElementById("memoryDots");
      MEMORY_IMAGES.forEach((_, i) => {
        const d = document.createElement("span");
        d.className = "memory-dot";
        d.dataset.i = String(i);
        dots.appendChild(d);
      });
    }

    openMemory(index) {
      const star = document.querySelector(`.memory-star[data-memory="${index}"]`);
      if (star) {
        star.classList.add("is-active");
        star.style.transition =
          "left 0.85s cubic-bezier(0.22, 1, 0.36, 1), top 0.85s cubic-bezier(0.22, 1, 0.36, 1), transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), margin 0.85s ease";
        star.style.margin = "0";
        star.style.left = "50%";
        star.style.top = "42%";
        star.style.transform = "translate(-50%, -50%) scale(1.85)";
        star.style.zIndex = "25";
      }

      const viewer = document.getElementById("memoryViewer");
      viewer.hidden = false;
      void viewer.offsetWidth;

      const open = () => {
        viewer.classList.add("is-open");
        document.body.classList.add("is-blurred");
        this.showMemory(index);
        if (star) {
          setTimeout(() => {
            star.style.left = "";
            star.style.top = "";
            star.style.transform = "";
            star.style.transition = "";
            star.style.margin = "";
            star.style.zIndex = "";
          }, 450);
        }
      };

      if (prefersReducedMotion) open();
      else setTimeout(open, 650);
    }

    showMemory(index) {
      const len = MEMORY_IMAGES.length;
      this.memoryIndex = ((index % len) + len) % len;
      const data = MEMORY_IMAGES[this.memoryIndex];
      const img = document.getElementById("memoryImage");
      const caption = document.getElementById("memoryCaption");

      img.style.opacity = "0";
      img.onload = () => {
        img.style.transition = "opacity 0.6s ease";
        img.style.opacity = "1";
      };
      img.src = data.src;
      img.alt = data.caption;
      caption.textContent = data.caption;

      this.viewedMemories.add(this.memoryIndex);
      document.querySelectorAll(".memory-star").forEach((s) => {
        const i = Number(s.dataset.memory);
        s.classList.toggle("is-viewed", this.viewedMemories.has(i));
        s.classList.toggle("is-active", i === this.memoryIndex);
      });

      document.querySelectorAll(".memory-dot").forEach((d) => {
        const i = Number(d.dataset.i);
        d.classList.toggle("is-active", i === this.memoryIndex);
        d.classList.toggle("is-seen", this.viewedMemories.has(i));
      });

      if (this.viewedMemories.size === MEMORY_IMAGES.length) {
        this.afterAllMemories();
      }
    }

    closeMemory() {
      const viewer = document.getElementById("memoryViewer");
      viewer.classList.remove("is-open");
      document.body.classList.remove("is-blurred");
      setTimeout(() => {
        viewer.hidden = true;
      }, prefersReducedMotion ? 200 : 700);
    }

    async afterAllMemories() {
      if (document.getElementById("s3-btn").classList.contains("is-visible")) return;
      await wait(600);
      this.closeMemory();
      await wait(800);
      reveal(document.getElementById("s3-after"));
      await wait(1800);
      reveal(document.getElementById("s3-btn"));
      document.getElementById("s3-btn").addEventListener("click", () => this.fromScene3(), { once: true });
    }

    async fromScene3() {
      document.getElementById("s3-btn").classList.add("is-fading");
      await wait(400);
      await this.scenes.goTo(4);
      this.startScene4();
    }

    /* ---------- Scene 4 ---------- */

    async startScene4() {
      this.starfield.setMode("wishes");
      this.moon.style.opacity = "0.9";
      const layer = document.getElementById("wishLayer");
      layer.innerHTML = "";

      // Stagger flying wish stars
      for (let i = 0; i < WISHES.length; i++) {
        await wait(i === 0 ? 800 : rand(900, 1600));
        this.spawnWishStar(layer, WISHES[i], false);
      }

      await wait(2200);
      reveal(document.getElementById("s4-finale"));
      this.announce("وأمنيات كثيرة ما بتكفيها النجوم...");

      await wait(3200);
      hideEl(document.getElementById("s4-finale"));
      await wait(600);

      // Special star flies to the moon
      await this.spawnSpecialStarToMoon(layer);
      await this.scenes.goTo(5);
      this.startScene5();
    }

    spawnWishStar(layer, text, interactiveOnly) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "wish-star";
      el.setAttribute("aria-label", text);

      const size = rand(6, 11);
      el.style.setProperty("--size", `${size}px`);

      const fromLeft = Math.random() > 0.5;
      const startY = rand(12, 78);
      const endY = startY + rand(-18, 18);
      const duration = rand(9000, 15000);

      el.innerHTML = `<span class="wish-star__orb"></span><span class="wish-star__text">${text}</span>`;
      layer.appendChild(el);

      const startX = fromLeft ? -10 : 110;
      const endX = fromLeft ? 110 : -10;
      el.style.top = `${startY}%`;
      el.style.left = `${startX}%`;
      el.style.opacity = "0";

      const start = performance.now();
      let glowing = false;

      el.addEventListener("click", () => {
        glowing = true;
        el.classList.add("is-hot");
        const r = el.getBoundingClientRect();
        sparkBurst(r.left + r.width / 2, r.top + r.height / 2, 6);
        setTimeout(() => el.classList.remove("is-hot"), 500);
      });

      const animate = (now) => {
        const p = clamp((now - start) / (prefersReducedMotion ? duration * 0.4 : duration), 0, 1);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const x = startX + (endX - startX) * ease;
        const y = startY + (endY - startY) * ease + Math.sin(p * Math.PI * 2) * 2;
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;

        // fade in mid-travel, fade out near end
        let opacity = 1;
        if (p < 0.12) opacity = p / 0.12;
        else if (p > 0.82) opacity = (1 - p) / 0.18;
        if (glowing) opacity = Math.min(1, opacity + 0.2);
        el.style.opacity = String(clamp(opacity, 0, 1));

        if (p < 1) requestAnimationFrame(animate);
        else el.remove();
      };

      requestAnimationFrame(animate);
      return el;
    }

    spawnSpecialStarToMoon(layer) {
      return new Promise((resolve) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "wish-star wish-star--special";
        el.innerHTML = `<span class="wish-star__orb"></span>`;
        el.style.left = "50%";
        el.style.top = "85%";
        el.style.opacity = "0";
        layer.appendChild(el);

        const moonRect = this.moon.getBoundingClientRect();
        const targetX = ((moonRect.left + moonRect.width / 2) / window.innerWidth) * 100;
        const targetY = ((moonRect.top + moonRect.height / 2) / window.innerHeight) * 100;

        const duration = prefersReducedMotion ? 1200 : 4200;
        const start = performance.now();
        const startX = 50;
        const startY = 82;

        this.starfield.setMode("bright");

        const animate = (now) => {
          const p = clamp((now - start) / duration, 0, 1);
          const e = 1 - Math.pow(1 - p, 2.5);
          const x = startX + (targetX - startX) * e;
          const y = startY + (targetY - startY) * e;
          el.style.left = `${x}%`;
          el.style.top = `${y}%`;
          el.style.opacity = String(clamp(p < 0.1 ? p * 10 : 1, 0, 1));

          if (p > 0.55) {
            this.moon.classList.add("moon--bright");
            this.starfield.targetBrightness = 0.9 + p * 0.2;
          }

          if (p < 1) requestAnimationFrame(animate);
          else {
            sparkBurst(moonRect.left + moonRect.width / 2, moonRect.top + moonRect.height / 2, 14);
            el.remove();
            setTimeout(resolve, 500);
          }
        };

        requestAnimationFrame(animate);
      });
    }

    /* ---------- Scene 5 ---------- */

    async startScene5() {
      this.starfield.setMode("calm");
      this.moon.classList.remove("moon--bright");
      this.moon.style.opacity = "0.75";

      await wait(700);
      const letter = document.getElementById("letter");
      reveal(letter);

      const lines = ["letter-1", "letter-2", "letter-3", "letter-4"];
      for (const id of lines) {
        await wait(1400);
        reveal(document.getElementById(id));
      }

      await wait(1800);
      reveal(document.getElementById("s5-btn"));
      document.getElementById("s5-btn").addEventListener("click", () => this.fromScene5(), { once: true });
    }

    async fromScene5() {
      document.getElementById("s5-btn").classList.add("is-fading");
      await wait(500);
      await this.scenes.goTo(6);
      this.startScene6();
    }

    /* ---------- Scene 6 ---------- */

    async startScene6() {
      // Everything fades to dark
      document.body.classList.add("scene-ending-dark");
      this.starfield.fadeStarsOut();
      this.moon.style.opacity = "0";
      await wait(2200);

      const finalStar = document.getElementById("finalStar");
      reveal(finalStar);
      await wait(1600);

      finalStar.classList.add("is-bright");
      await wait(1400);

      reveal(document.getElementById("s6-line1"));
      await wait(2800);

      reveal(document.getElementById("s6-line2"));
      this.announce("عيد ميلاد سعيد يا أحلى سارة بالكون كله");
      await wait(2200);

      // Celebration returns
      document.body.classList.remove("scene-ending-dark");
      document.body.classList.add("scene-celebrate");
      this.starfield.setMode("celebrate");
      this.moon.style.opacity = "1";
      this.moon.classList.add("moon--bright");
      document.getElementById("celebration").classList.add("is-on");

      await wait(1600);
      reveal(document.getElementById("s6-signoff"));

      // Easter egg after lingering on the sky
      await wait(5000);
      this.armEasterEgg();
    }

    armEasterEgg() {
      if (this.endingDone) return;
      this.endingDone = true;

      const egg = document.getElementById("eggStar");
      this._eggFloatRaf = 0;
      this._eggFloating = false;

      // Appear near an edge, then drift organically through the sky
      const edgeStarts = [
        { x: 0.08, y: 0.18 },
        { x: 0.86, y: 0.22 },
        { x: 0.12, y: 0.72 },
        { x: 0.82, y: 0.68 },
        { x: 0.06, y: 0.45 },
        { x: 0.88, y: 0.5 },
      ];
      const start = pick(edgeStarts);
      let pos = {
        x: start.x * window.innerWidth,
        y: start.y * window.innerHeight,
      };
      let vel = {
        x: rand(-0.18, 0.18) || 0.12,
        y: rand(-0.14, 0.14) || 0.08,
      };
      let rot = rand(-8, 8);
      let rotVel = rand(-0.03, 0.03);
      let bob = Math.random() * Math.PI * 2;
      const size = Math.min(60, Math.max(52, window.innerWidth < 768 ? 52 : 58));

      const place = (x, y, r, scale = 1) => {
        egg.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${r}deg) scale(${scale})`;
      };

      place(pos.x, pos.y, rot, 0.85);
      egg.hidden = false;
      void egg.offsetWidth;
      egg.classList.add("is-ready");

      this._eggFloating = true;
      const tick = () => {
        if (!this._eggFloating) return;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const pad = 12;
        const maxX = w - size - pad;
        const maxY = h - size - pad;

        // Soft wander — occasionally nudge direction
        if (Math.random() < 0.008) {
          vel.x += rand(-0.06, 0.06);
          vel.y += rand(-0.05, 0.05);
        }
        vel.x = clamp(vel.x, -0.28, 0.28);
        vel.y = clamp(vel.y, -0.22, 0.22);

        pos.x += vel.x;
        pos.y += vel.y;
        bob += 0.012;
        rot += rotVel;

        // Gentle vertical bob
        const yDraw = pos.y + Math.sin(bob) * 10;

        // Soft edge bounce
        if (pos.x < pad) {
          pos.x = pad;
          vel.x = Math.abs(vel.x) * 0.9;
        } else if (pos.x > maxX) {
          pos.x = maxX;
          vel.x = -Math.abs(vel.x) * 0.9;
        }
        if (pos.y < pad) {
          pos.y = pad;
          vel.y = Math.abs(vel.y) * 0.9;
        } else if (pos.y > maxY) {
          pos.y = maxY;
          vel.y = -Math.abs(vel.y) * 0.9;
        }

        if (Math.abs(rot) > 14) rotVel *= -1;

        place(pos.x, yDraw, rot, 1);
        this._eggFloatRaf = requestAnimationFrame(tick);
      };

      if (!prefersReducedMotion) {
        this._eggFloatRaf = requestAnimationFrame(tick);
      } else {
        place(pos.x, pos.y, 0, 1);
      }

      egg.addEventListener(
        "click",
        async () => {
          this._eggFloating = false;
          if (this._eggFloatRaf) cancelAnimationFrame(this._eggFloatRaf);

          const rect = egg.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          sparkBurst(cx, cy, 10);

          egg.classList.add("is-caught");
          // Grow slightly in place
          place(rect.left, rect.top, 0, 1.2);
          await wait(420);

          // Drift toward center
          const targetX = window.innerWidth / 2 - size / 2;
          const targetY = window.innerHeight / 2 - size / 2 - 90;
          place(targetX, targetY, 0, 1.15);
          await wait(prefersReducedMotion ? 350 : 1100);

          egg.style.opacity = "0";
          await wait(400);
          egg.hidden = true;
          egg.classList.remove("is-ready", "is-caught");

          await this.runEasterEgg();
        },
        { once: true }
      );
    }

    async runEasterEgg() {
      const popup = document.getElementById("eggPopup");
      popup.hidden = false;
      void popup.offsetWidth;
      popup.classList.add("is-open");

      const face = document.getElementById("eggPopupEmoji");
      reveal(face);

      await wait(450);
      reveal(document.getElementById("eggTitle"));
      await wait(1400);
      reveal(document.getElementById("eggLine2"));
      await wait(900);
      reveal(document.getElementById("eggBtn"));

      document.getElementById("eggBtn").addEventListener(
        "click",
        async () => {
          hideEl(document.getElementById("eggBtn"));
          document.getElementById("eggBtn").hidden = true;
          hideEl(document.getElementById("eggLine2"));
          hideEl(document.getElementById("eggTitle"));
          await wait(400);
          reveal(document.getElementById("eggFinal"));
        },
        { once: true }
      );
    }
  }

  // Boot
  window.addEventListener("DOMContentLoaded", () => {
    new App();
  });
})();
