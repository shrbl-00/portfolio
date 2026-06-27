/* ============================================================
   CUSTOM CURSOR
============================================================ */
const cursor       = document.getElementById('cursor');
const cursorFollow = document.getElementById('cursor-follower');

let mouseX = 0, mouseY = 0;
let followX = 0, followY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursor.style.left = mouseX + 'px';
  cursor.style.top  = mouseY + 'px';
});

(function animateFollower() {
  followX += (mouseX - followX) * 0.12;
  followY += (mouseY - followY) * 0.12;
  cursorFollow.style.left = followX + 'px';
  cursorFollow.style.top  = followY + 'px';
  requestAnimationFrame(animateFollower);
})();

function setCursorState(state) {
  document.body.classList.remove('cursor--hover', 'cursor--play');
  if (state) document.body.classList.add('cursor--' + state);
}

function bindCursor(el, state) {
  el.addEventListener('mouseenter', () => setCursorState(state));
  el.addEventListener('mouseleave', () => setCursorState(null));
}


/* ============================================================
   INTRO ANIMATION
============================================================ */
const intro     = document.getElementById('intro');
const introName = document.getElementById('intro-name');
const site      = document.getElementById('site');

function runIntro() {
  const letters = introName.querySelectorAll('.intro-word span, .intro-space');

  setTimeout(() => {
    introName.classList.add('animate');
    letters.forEach((el, i) => {
      el.style.animationDelay = (i * 52) + 'ms';
    });
  }, 150);

  // Hold after last letter, then reveal site
  const revealAt = 150 + (letters.length * 52) + 650;

  setTimeout(() => {
    intro.classList.add('fade-out');
    site.style.opacity    = '1';
    site.style.transition = 'opacity .5s ease';

    document.querySelectorAll('[data-reveal]').forEach((el, i) => {
      setTimeout(() => el.classList.add('revealed'), i * 160);
    });

    setTimeout(() => intro.remove(), 700);
  }, revealAt);
}


/* ============================================================
   THUMBNAIL GENERATION
   Uses a dedicated hidden <video> per thumbnail so that hover
   interactions on the card's playback video never interfere
   with the seek/draw sequence.
============================================================ */

// Serial queue — one thumbnail rendered at a time to keep memory sane
const thumbQueue  = [];
let   thumbActive = false;

function queueThumbnail(src, canvas) {
  thumbQueue.push({ src, canvas });
  if (!thumbActive) drainQueue();
}

function drainQueue() {
  if (!thumbQueue.length) { thumbActive = false; return; }
  thumbActive = true;
  const { src, canvas } = thumbQueue.shift();
  renderThumbnail(src, canvas).then(drainQueue);
}

function renderThumbnail(src, canvas) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted       = true;
    v.playsInline = true;
    v.preload     = 'auto';
    v.src         = src;
    // Must be in the DOM for some browsers to begin loading
    v.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px';
    document.body.appendChild(v);

    let settled = false;
    const done = (drew) => {
      if (settled) return;
      settled = true;
      if (!drew) drawFallback(canvas);
      v.pause();
      v.src = '';
      v.remove();
      resolve();
    };

    // Catch codec / network errors early
    v.addEventListener('error', () => {
      console.warn('Thumbnail load error for', src, v.error?.code, v.error?.message);
      done(false);
    });

    const captureFrame = () => {
      if (!v.videoWidth || !v.videoHeight) { done(false); return; }

      canvas.width  = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(v, 0, 0);

      // Sample center pixel — if black, the frame didn't decode yet
      const mid = ctx.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
      if (mid[0] + mid[1] + mid[2] > 12) {
        done(true); // real frame captured
      } else {
        // Try the 1-second mark as a last resort before giving up
        v.currentTime = 1;
        v.addEventListener('seeked', () => {
          requestAnimationFrame(() => {
            ctx.drawImage(v, 0, 0);
            done(true); // take whatever we have
          });
        }, { once: true });
      }
    };

    const seekRandom = () => {
      const dur = v.duration;
      const t   = (dur && isFinite(dur) && dur > 1)
                  ? dur * (0.1 + Math.random() * 0.8)
                  : 0.5;
      v.currentTime = t;
      // requestAnimationFrame after seeked ensures the frame is painted
      v.addEventListener('seeked', () => requestAnimationFrame(captureFrame), { once: true });
    };

    if (v.readyState >= 2) {        // HAVE_CURRENT_DATA — can seek immediately
      seekRandom();
    } else {
      v.addEventListener('loadeddata', () => seekRandom(), { once: true });
    }

    // Absolute timeout — never leave a black box
    setTimeout(() => done(false), 10000);

    v.load();
  });
}

// Fallback canvas — subtle hatched texture, visually distinct from black
function drawFallback(canvas) {
  canvas.width  = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, 320, 180);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = -180; x < 320; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 180, 180);
    ctx.stroke();
  }
}


/* ============================================================
   BACKGROUND VIDEO AMBIENCE
============================================================ */
const bgVideo    = document.getElementById('bg-video');
let bgCurrentSrc = '';

function showBgVideo(src) {
  if (window.matchMedia('(hover: none)').matches) return;

  if (bgCurrentSrc !== src) {
    bgCurrentSrc = src;
    bgVideo.src  = src;
    bgVideo.load();
    bgVideo.play().catch(() => {});
  }
  bgVideo.style.transition = 'opacity 0.4s ease';
  bgVideo.style.opacity    = '0.1';
}

function hideBgVideo() {
  bgVideo.style.transition = 'opacity 0.6s ease';
  bgVideo.style.opacity    = '0';
}


/* ============================================================
   SCROLL REVEAL
============================================================ */
function initScrollReveal() {
  const slideObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        slideObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('[data-scroll-slide], [data-scroll-fade]').forEach(el => {
    slideObserver.observe(el);
  });
}

function initCardGridObserver(gridEl) {
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const cards = entry.target.querySelectorAll('.video-card');
        cards.forEach((card, i) => {
          setTimeout(() => card.classList.add('card-in'), i * 50);
        });
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  cardObserver.observe(gridEl);
}


/* ============================================================
   VIDEO CARD
   Playback video is separate from the thumbnail video.
   preload="none" — loads only when the user actually hovers.
============================================================ */
let activeSound  = null; // the one video currently un-muted
let activeSoundFrame = null;

function createVideoCard(videoData) {
  const card = document.createElement('div');
  card.className        = 'video-card';
  card.dataset.category = videoData.category;
  if (videoData.category === 'Short Form') card.classList.add('video-card--portrait');

  const frame = document.createElement('div');
  frame.className = 'video-frame';

  const canvas = document.createElement('canvas');

  // Playback video — completely independent of thumbnail generation
  const video = document.createElement('video');
  video.src        = videoData.path;
  video.muted      = true;
  video.loop       = true;
  video.preload    = 'none'; // don't load until hover
  video.playsInline = true;

  video.addEventListener('error', () => {
    console.warn('Playback error:', videoData.title, video.error?.code, video.error?.message);
  });

  const tag = document.createElement('span');
  tag.className   = 'cat-tag';
  tag.textContent = videoData.category;

  const hint = document.createElement('div');
  hint.className   = 'sound-hint';
  hint.textContent = 'TAP FOR SOUND';

  frame.append(canvas, video, tag, hint);

  card.append(frame);

  // Queue thumbnail (uses its own isolated video element)
  queueThumbnail(videoData.path, canvas);

  // Cursor
  frame.addEventListener('mouseenter', () => setCursorState('play'));
  frame.addEventListener('mouseleave', () => setCursorState(null));

  // ---- HOVER: play muted + bg ambience ----
  frame.addEventListener('mouseenter', () => {
    frame.classList.add('is-playing');
    video.muted = true;
    frame.classList.remove('has-sound');
    video.play().catch(() => {});
    showBgVideo(videoData.path);
  });

  frame.addEventListener('mouseleave', () => {
    video.pause();
    video.currentTime = 0;
    video.muted = true;
    frame.classList.remove('is-playing', 'has-sound');
    if (activeSound === video) { activeSound = null; activeSoundFrame = null; }
    hideBgVideo();
  });

  // ---- CLICK: toggle sound (timer to distinguish from dblclick) ----
  let clickTimer = null;

  frame.addEventListener('click', () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      if (!frame.classList.contains('is-playing')) return;

      // Silence the previously un-muted video
      if (activeSound && activeSound !== video) {
        activeSound.muted = true;
        activeSoundFrame?.classList.remove('has-sound');
      }

      if (video.muted) {
        video.muted = false;
        frame.classList.add('has-sound');
        activeSound      = video;
        activeSoundFrame = frame;
      } else {
        video.muted = true;
        frame.classList.remove('has-sound');
        activeSound      = null;
        activeSoundFrame = null;
      }
    }, 230); // wait to see if a second click follows
  });

  // ---- DOUBLE-CLICK: fullscreen modal ----
  frame.addEventListener('dblclick', () => {
    clearTimeout(clickTimer); // cancel the single-click sound toggle
    openModal(videoData);
  });

  return card;
}


/* ============================================================
   FULLSCREEN MODAL
============================================================ */
const modal      = document.getElementById('video-modal');
const modalVideo = document.getElementById('modal-video');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');

function openModal(videoData) {
  modalVideo.src         = videoData.path;
  modalTitle.textContent = videoData.title + ' — ' + videoData.category;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  modalVideo.play().catch(() => {});
}

function closeModal() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modalVideo.pause();
  modalVideo.src = '';
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
bindCursor(modalClose, 'hover');


/* ============================================================
   CATEGORY FILTER — wired independently of video loading
============================================================ */
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-tab');
  const workGrid   = document.getElementById('work-grid');

  filterBtns.forEach(btn => {
    bindCursor(btn, 'hover');

    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const chosen = btn.dataset.filter;
      workGrid.querySelectorAll('.video-card').forEach(card => {
        const matches = chosen === 'all' || card.dataset.category === chosen;
        card.classList.toggle('is-hidden', !matches);
      });
    });
  });
}


/* ============================================================
   HELPER — pick a spread of videos for the hero grid
============================================================ */
function pickHeroVideos(videos, n) {
  const eligible = videos.filter(v => v.category !== 'Short Form');
  const seen = {};
  const result = [];
  for (const v of eligible) {
    if (!seen[v.category] && result.length < n) { seen[v.category] = true; result.push(v); }
  }
  for (const v of eligible) {
    if (result.length >= n) break;
    if (!result.includes(v)) result.push(v);
  }
  return result.slice(0, n);
}


/* ============================================================
   MAIN INIT
============================================================ */
async function init() {
  document.querySelectorAll('.nav__link, .contact__link').forEach(el => bindCursor(el, 'hover'));

  let videos = [];
  try {
    const res = await fetch('/api/videos');
    if (!res.ok) throw new Error('API returned ' + res.status);
    videos = await res.json();
    console.log('[Portfolio] Loaded', videos.length, 'videos:', videos.map(v => v.title).join(', '));
  } catch (err) {
    console.error('[Portfolio] Could not load /api/videos:', err.message);
    return;
  }

  if (!videos.length) { console.warn('[Portfolio] No videos found.'); return; }

  const heroGrid = document.getElementById('hero-grid');
  pickHeroVideos(videos, 4).forEach(v => heroGrid.appendChild(createVideoCard(v)));

  const workGrid = document.getElementById('work-grid');
  videos.forEach(v => workGrid.appendChild(createVideoCard(v)));

  // Stagger cards in when the grid scrolls into view
  initCardGridObserver(workGrid);
}


/* ============================================================
   BOOT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  runIntro();
  initFilters();
  initScrollReveal();
  init();
});
