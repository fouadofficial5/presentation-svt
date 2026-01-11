/* =========================================================
   La Photosynthèse — Présentation Cinématique
   Fichier: script.js
   Contrôle:
   - ESPACE  => Pause
   - ENTER   => Resume
   - R       => Restart
   - Boutons => Pause / Resume / Restart
   ========================================================= */

(() => {
  "use strict";

  /* -------------------------
     1) ELEMENTS
  ------------------------- */
  const sceneRoot   = document.getElementById("sceneRoot");
  const steps       = Array.from(document.querySelectorAll(".scene-step"));

  const captionTitle   = document.getElementById("captionTitle");
  const captionText    = document.getElementById("captionText");
  const captionBullets = document.getElementById("captionBullets");
  const sceneLabel     = document.getElementById("sceneLabel");
  const sceneTimer     = document.getElementById("sceneTimer");
  const progressBar    = document.getElementById("progressBar");

  const titleBlock = document.getElementById("titleBlock");
  const caption    = document.getElementById("caption");

  const btnPause   = document.getElementById("btnPause");
  const btnResume  = document.getElementById("btnResume");
  const btnRestart = document.getElementById("btnRestart");

  const navPills = Array.from(document.querySelectorAll(".scene-nav .pill"));

  /* -------------------------
     2) STATE
  ------------------------- */
  let currentSceneIndex = 0;
  let isPaused = false;

  let sceneStartTime = 0;      // timestamp when scene started
  let pauseStartTime = 0;      // timestamp when paused
  let pausedDuration = 0;      // total paused time in current scene

  let rafId = null;

  const totalDuration = steps.reduce(
    (sum, step) => sum + Number(step.dataset.duration || 0),
    0
  );

  /* -------------------------
     3) HELPERS
  ------------------------- */
  function qsData(step, selector) {
    const el = step.querySelector(selector);
    return el ? el.innerHTML : "";
  }

  function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function clearSceneClasses() {
    sceneRoot.classList.remove(
      "is-light",
      "show-light",
      "show-co2",
      "show-h2o",
      "show-o2",
      "show-glu",
      "is-cinematic",
      "focus-leaf",
      "is-deeper"
    );
  }

  /* -------------------------
     4) APPLY SCENE EFFECTS
     (ربط المشهد بالحركات)
  ------------------------- */
  function applySceneEffects(index) {
    clearSceneClasses();

    // حركة كاميرا خفيفة دائمًا
    sceneRoot.classList.add("is-cinematic");

    switch (index) {
      case 0: // INTRO
        // عنوان + معادلة فقط
        break;

      case 1: // INPUTS
        sceneRoot.classList.add(
          "is-light",
          "show-light",
          "show-co2",
          "show-h2o"
        );
        break;

      case 2: // LEAF FOCUS
        sceneRoot.classList.add(
          "is-light",
          "focus-leaf",
          "show-co2"
        );
        break;

      case 3: // CHLOROPLAST
        sceneRoot.classList.add(
          "is-light",
          "focus-leaf",
          "show-co2",
          "show-h2o",
          "is-deeper"
        );
        break;

      case 4: // OUTPUTS
        sceneRoot.classList.add(
          "show-o2",
          "show-glu"
        );
        break;

      case 5: // BILAN
        sceneRoot.classList.add(
          "show-light",
          "show-co2",
          "show-h2o",
          "show-o2",
          "show-glu",
          "is-deeper"
        );
        break;
    }
  }

  /* -------------------------
     5) RENDER SCENE TEXT
  ------------------------- */
  function renderScene(index) {
    const step = steps[index];

    // Animations خروج
    titleBlock.classList.remove("is-enter");
    titleBlock.classList.add("is-leave");
    caption.classList.remove("is-enter");
    caption.classList.add("is-leave");

    setTimeout(() => {
      // تحديث النصوص
      captionTitle.innerHTML = qsData(step, "[data-title]");
      captionText.innerHTML  = qsData(step, "[data-text]");
      captionBullets.innerHTML = qsData(step, "[data-bullets]");
      sceneLabel.textContent = `SCÈNE ${index + 1}`;

      // Animations دخول
      titleBlock.classList.remove("is-leave");
      caption.classList.remove("is-leave");
      titleBlock.classList.add("is-enter");
      caption.classList.add("is-enter");
    }, 250);

    applySceneEffects(index);
  }

  /* -------------------------
     6) TIMELINE LOOP
  ------------------------- */
  function timelineLoop(now) {
    if (isPaused) {
      rafId = requestAnimationFrame(timelineLoop);
      return;
    }

    const step = steps[currentSceneIndex];
    const duration = Number(step.dataset.duration) * 1000;

    const elapsed = now - sceneStartTime - pausedDuration;

    // تحديث الوقت
    sceneTimer.textContent = formatTime(elapsed);

    // تحديث Progress Bar
    const elapsedBefore = steps
      .slice(0, currentSceneIndex)
      .reduce((s, st) => s + Number(st.dataset.duration) * 1000, 0);

    const globalElapsed = elapsedBefore + Math.max(0, elapsed);
    const progress = Math.min(1, globalElapsed / (totalDuration * 1000));
    progressBar.style.width = `${progress * 100}%`;

    // الانتقال للمشهد التالي
    if (elapsed >= duration) {
      nextScene();
      return;
    }

    rafId = requestAnimationFrame(timelineLoop);
  }

  /* -------------------------
     7) SCENE CONTROL
  ------------------------- */
  function startScene(index) {
    currentSceneIndex = index;
    sceneStartTime = performance.now();
    pausedDuration = 0;

    renderScene(index);

    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(timelineLoop);
  }

  function nextScene() {
    if (currentSceneIndex < steps.length - 1) {
      startScene(currentSceneIndex + 1);
    } else {
      // انتهى العرض
      cancelAnimationFrame(rafId);
      progressBar.style.width = "100%";
    }
  }

  function pause() {
    if (isPaused) return;
    isPaused = true;
    pauseStartTime = performance.now();
  }

  function resume() {
    if (!isPaused) return;
    isPaused = false;
    pausedDuration += performance.now() - pauseStartTime;
  }

  function restart() {
    isPaused = false;
    startScene(0);
  }

  /* -------------------------
     8) EVENTS (KEYBOARD)
  ------------------------- */
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      pause();
    }
    if (e.code === "Enter") {
      resume();
    }
    if (e.key.toLowerCase() === "r") {
      restart();
    }
  });

  /* -------------------------
     9) EVENTS (BUTTONS)
  ------------------------- */
  btnPause.addEventListener("click", pause);
  btnResume.addEventListener("click", resume);
  btnRestart.addEventListener("click", restart);

  navPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const i = Number(pill.dataset.goto);
      startScene(i);
    });
  });

  /* -------------------------
     10) START
  ------------------------- */
  startScene(0);

})();
