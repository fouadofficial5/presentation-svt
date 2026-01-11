/* =========================================================
   CINEMATIC SCROLL PRESENTATION – script.js
   - Scenes driven by scroll position
   - Camera pan/zoom/rotate/depth
   - Keyboard: SPACE pause / ENTER resume / R restart
   ========================================================= */

(() => {
  "use strict";

  /* -------------------------
     1) ELEMENTS
  ------------------------- */
  const viewport   = document.getElementById("viewport");
  const camera     = document.getElementById("camera");
  const story      = document.getElementById("story");
  const chapters   = Array.from(document.querySelectorAll(".chapter"));

  const capKicker  = document.getElementById("capKicker");
  const capTitle   = document.getElementById("capTitle");
  const capText    = document.getElementById("capText");
  const caption    = document.getElementById("caption");

  const sun        = document.getElementById("sun");
  const lightBeams = document.getElementById("lightBeams");

  const micro      = document.getElementById("micro");

  // FX
  const fx         = document.getElementById("fx");
  const co2        = document.getElementById("co2");
  const h2o        = document.getElementById("h2o");
  const o2         = document.getElementById("o2");
  const glu        = document.getElementById("glu");

  const aLight     = document.getElementById("aLight");
  const aCO2       = document.getElementById("aCO2");
  const aH2O       = document.getElementById("aH2O");
  const aO2        = document.getElementById("aO2");
  const aGLU       = document.getElementById("aGLU");

  const restartBtn = document.getElementById("restartBtn");

  /* -------------------------
     2) STATE
  ------------------------- */
  let activeIndex = -1;
  let isPaused = false;

  // لتجنب تحديث كثير
  let rafId = null;
  let lastTick = 0;

  // إعدادات الحركة
  const CAM = {
    // zoom: 1 = عادي، >1 = تكبير
    wide:      { x: 0,   y: 0,   z: 0,  zoom: 1.00, ry: 0,  rx: 0 },
    intro:     { x: -20, y: -10, z: 0,  zoom: 1.05, ry: -1, rx: 0.4 },
    equation:  { x: -40, y: -20, z: 0,  zoom: 1.15, ry: 1.2, rx: 0.2 },

    // base values – سيتم تعديلها بناء على target
    target:    { x: 0,   y: 0,   z: 0,  zoom: 1.85, ry: -2, rx: 1.0 },
    micro:     { x: 0,   y: 0,   z: 0,  zoom: 2.20, ry: 2.5, rx: 1.5 }
  };

  // مدة انتقال الكاميرا (متوافقة مع CSS transition)
  const TRANSITION_MS = 1600;

  /* -------------------------
     3) UTILS
  ------------------------- */
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function setCaption({ kicker, title, text }) {
    capKicker.textContent = kicker || "";
    capTitle.textContent  = title  || "";
    capText.textContent   = text   || "";

    // show caption smoothly
    caption.style.opacity = "1";
    caption.style.transform = "translateY(0)";
  }

  function hideCaption() {
    caption.style.opacity = "0";
    caption.style.transform = "translateY(20px)";
  }

  function resetVisuals() {
    // hide everything by default
    sun.style.opacity = "0";
    sun.style.transform = "scale(.6)";

    lightBeams.style.opacity = "0";

    micro.style.opacity = "0";
    micro.style.pointerEvents = "none";

    // hide FX
    for (const el of fx.children) {
      el.style.opacity = "0";
      el.style.transform = "translate3d(0,0,0)";
    }
  }

  // حساب target center داخل الكاميرا
  function getTargetCenter(targetId) {
    const el = document.getElementById(targetId);
    if (!el) return null;

    // إحداثيات target داخل الكاميرا
    const camRect = camera.getBoundingClientRect();
    const tRect   = el.getBoundingClientRect();

    const cx = (tRect.left - camRect.left) + tRect.width / 2;
    const cy = (tRect.top  - camRect.top)  + tRect.height / 2;

    // نريد تحريك الكاميرا ليصبح هذا المركز في وسط الشاشة
    const camCenterX = camRect.width / 2;
    const camCenterY = camRect.height / 2;

    // الفرق (بالبكسل)
    const dx = (camCenterX - cx);
    const dy = (camCenterY - cy);

    return { dx, dy };
  }

  // تطبيق تحريك الكاميرا (Pan + Zoom + Rotate + Depth)
  function applyCameraPose(pose) {
    const x = pose.x || 0;
    const y = pose.y || 0;
    const z = pose.z || 0;
    const zoom = pose.zoom || 1;
    const ry = pose.ry || 0;
    const rx = pose.rx || 0;

    // ترتيب transforms مهم
    camera.style.transform =
      `translate3d(${x}px, ${y}px, ${z}px) ` +
      `rotateY(${ry}deg) rotateX(${rx}deg) ` +
      `scale(${zoom})`;
  }

  // pose بناء على target
  function cameraToTarget(targetId, basePose) {
    const center = getTargetCenter(targetId);
    if (!center) {
      applyCameraPose(CAM.wide);
      return;
    }

    // dx/dy نضربهم في zoom باش الزوم يبقى دقيق
    const zoom = basePose.zoom;
    const x = center.dx * zoom;
    const y = center.dy * zoom;

    applyCameraPose({
      x: clamp(x, -420, 420),
      y: clamp(y, -320, 320),
      z: basePose.z,
      zoom: basePose.zoom,
      ry: basePose.ry,
      rx: basePose.rx
    });
  }

  /* -------------------------
     4) FX POSITIONS (قابلة للتعديل)
  ------------------------- */
  function placeFX(mode) {
    // reset transforms/opacity set by previous
    resetVisuals();

    // caption always visible when active
    caption.style.opacity = "1";
    caption.style.transform = "translateY(0)";

    // default positions (يمكن تحسينها لاحقًا)
    co2.style.left = "140px";   co2.style.top = "300px";
    h2o.style.left = "520px";   h2o.style.top = "560px";
    o2.style.left  = "980px";   o2.style.top  = "260px";
    glu.style.left = "860px";   glu.style.top = "520px";

    aLight.style.left = "240px"; aLight.style.top = "210px";
    aCO2.style.left   = "180px"; aCO2.style.top   = "360px";
    aH2O.style.left   = "520px"; aH2O.style.top   = "600px";
    aO2.style.left    = "980px"; aO2.style.top    = "340px";
    aGLU.style.left   = "860px"; aGLU.style.top   = "580px";

    // Modes: intro / light / leaf / co2 / h2o / micro / outputs / bilan
    if (mode === "intro") {
      // فقط خلفية + caption
      return;
    }

    if (mode === "light") {
      sun.style.opacity = "1";
      sun.style.transform = "scale(1)";
      lightBeams.style.opacity = "1";

      aLight.style.opacity = "1";
      aLight.style.transform = "translate3d(0,0,0)";
      return;
    }

    if (mode === "leaf") {
      sun.style.opacity = "1";
      sun.style.transform = "scale(.95)";
      lightBeams.style.opacity = ".8";

      aLight.style.opacity = "1";
      aLight.style.transform = "translate3d(0,0,0)";
      return;
    }

    if (mode === "co2") {
      sun.style.opacity = "1";
      sun.style.transform = "scale(.95)";
      lightBeams.style.opacity = ".85";

      co2.style.opacity = "1";
      co2.style.transform = "translate3d(0,0,0)";

      aCO2.style.opacity = "1";
      aCO2.style.transform = "translate3d(0,0,0)";
      return;
    }

    if (mode === "h2o") {
      h2o.style.opacity = "1";
      h2o.style.transform = "translate3d(0,0,0)";

      aH2O.style.opacity = "1";
      aH2O.style.transform = "translate3d(0,0,0)";
      return;
    }

    if (mode === "micro") {
      micro.style.opacity = "1";
      micro.style.pointerEvents = "none";

      // نقدر نخبي الشمس هنا أو نخليها خفيفة
      sun.style.opacity = ".2";
      lightBeams.style.opacity = ".0";

      return;
    }

    if (mode === "outputs") {
      o2.style.opacity = "1";
      glu.style.opacity = "1";

      aO2.style.opacity = "1";
      aGLU.style.opacity = "1";
      return;
    }

    if (mode === "bilan") {
      // إظهار جميع العناصر بشكل خفيف بدون ازدحام (اختياري)
      sun.style.opacity = ".6";
      sun.style.transform = "scale(.9)";

      co2.style.opacity = ".7";
      h2o.style.opacity = ".7";
      o2.style.opacity  = ".7";
      glu.style.opacity = ".7";

      return;
    }
  }

  /* -------------------------
     5) SCENE ACTIVATION
  ------------------------- */
  function activateScene(i) {
    if (i === activeIndex) return;
    activeIndex = i;

    const chapter = chapters[i];
    if (!chapter) return;

    // data
    const kicker  = chapter.dataset.kicker || "";
    const title   = chapter.dataset.title  || "";
    const text    = chapter.dataset.text   || "";
    const target  = chapter.dataset.target || "wide";
    const mode    = chapter.dataset.mode   || "intro";

    setCaption({ kicker, title, text });
    placeFX(mode);

    // Camera logic:
    // - wide / intro / equation: predefined
    // - sun: zoom slightly to sun area
    // - t-leaf / t-stomata / t-roots / t-chloroplast: zoom to target
    if (target === "wide") {
      applyCameraPose(CAM.wide);
    } else if (target === "intro") {
      applyCameraPose(CAM.intro);
    } else if (target === "equation") {
      applyCameraPose(CAM.equation);
    } else if (target === "sun") {
      // تقريب على الشمس بدون target
      applyCameraPose({ x: 140, y: 40, z: 0, zoom: 1.35, ry: -2.5, rx: 0.6 });
    } else {
      // target zoom
      const base = (mode === "micro") ? CAM.micro : CAM.target;
      cameraToTarget(target, base);
    }
  }

  /* -------------------------
     6) SCROLL → FIND ACTIVE CHAPTER
  ------------------------- */
  function getActiveChapterIndex() {
    // نأخذ chapter الذي مركزه قريب من منتصف الشاشة
    const mid = window.innerHeight * 0.55;

    let bestIndex = 0;
    let bestDist = Infinity;

    chapters.forEach((ch, idx) => {
      const r = ch.getBoundingClientRect();
      const center = r.top + r.height / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = idx;
      }
    });

    return bestIndex;
  }

  function tick(now) {
    if (isPaused) return;

    // throttle: 30fps تقريبًا
    if (now - lastTick < 33) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastTick = now;

    const idx = getActiveChapterIndex();
    activateScene(idx);

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  /* -------------------------
     7) KEYBOARD CONTROL
  ------------------------- */
  function pause() {
    if (isPaused) return;
    isPaused = true;

    // نجمد transition مؤقتًا؟ لا، نخليها كما هي.
    // نوقف فقط تحديث المشاهد/الزوم.
  }

  function resume() {
    if (!isPaused) return;
    isPaused = false;
    startLoop();
  }

  function restart() {
    isPaused = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    // بعد شوية نضمن تفعيل اول scene
    setTimeout(() => {
      activateScene(0);
      startLoop();
    }, 400);
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      pause();
    } else if (e.code === "Enter") {
      resume();
    } else if (e.key && e.key.toLowerCase() === "r") {
      restart();
    }
  });

  restartBtn?.addEventListener("click", restart);

  /* -------------------------
     8) INITIALIZE
  ------------------------- */
  function init() {
    // caption يظهر من البداية
    caption.style.opacity = "1";
    caption.style.transform = "translateY(0)";

    // نظهر اول مشهد
    activateScene(0);

    // تشغيل loop
    startLoop();

    // لو المستخدم غيّر حجم الشاشة
    window.addEventListener("resize", () => {
      // إعادة ضبط zoom للمشهد الحالي
      if (!isPaused) activateScene(getActiveChapterIndex());
    });
  }

  init();

})();
