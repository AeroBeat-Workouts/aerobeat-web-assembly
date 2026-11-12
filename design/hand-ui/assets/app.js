/* Hand-UI iteration prototype: shared behaviour for both screens.
   No gameplay, no camera, no product imports. Static data came from
   api.beatsaver.com at build time (see assets/data.js). */

const DATA = window.AEROBEAT_PROTOTYPE;
const HOLD_MS = 520;          // feel-test knob: how long both wrists must agree
const WRIST_SPREAD = 74;      // px between the two simulated wrists

const asset = src => (src ? `assets/${src}` : '');
const allPlaylists = () => [DATA.playlistOfTheDay, ...DATA.recommended];
const findPlaylist = key => allPlaylists().find(p => p.label === key || p.id === key);

/** Playlist art: real cover when BeatSaver supplied one, otherwise the member
 *  thumbnails stand in — which is also how locally authored playlists will look. */
function artHtml(playlist, { thumbnails = 4 } = {}) {
  if (playlist.cover) return `<img src="${asset(playlist.cover)}" alt="">`;
  const covers = playlist.maps.filter(m => m.cover).slice(0, thumbnails);
  if (!covers.length) return `<div class="peek"></div>`;
  return `<div class="peek">${covers.map(m => `<img src="${asset(m.cover)}" alt="">`).join('')}</div>`;
}

/* ------------------------------------------------------------------ */
/* Two-wrist selection                                                 */
/* ------------------------------------------------------------------ */

const hands = {
  on: false,
  x: 0, y: 0,
  arming: null,        // { el, startedAt, raf }
  consumed: null,      // element already activated; must be released before re-arming
};

function targetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest('[data-hand-target]') : null;
}

function clearHover() {
  document.querySelectorAll('.target.is-hover, .chip.is-hover, .play.is-hover')
    .forEach(el => el.classList.remove('is-hover'));
  document.querySelectorAll('.wrist').forEach(el => el.classList.remove('is-hover'));
}

function cancelArming() {
  if (!hands.arming) return;
  cancelAnimationFrame(hands.arming.raf);
  hands.arming.el.classList.remove('is-arming');
  hands.arming.el.style.removeProperty('--fill');
  hands.arming = null;
}

function activate(el) {
  el.classList.add('is-select');
  setTimeout(() => el.classList.remove('is-select'), 140);
  el.click();
}

function startArming(el, now) {
  cancelArming();
  el.classList.add('is-arming');
  hands.arming = { el, startedAt: now, raf: 0 };
  const step = () => {
    if (!hands.arming || hands.arming.el !== el) return;
    const progress = Math.min(1, (performance.now() - hands.arming.startedAt) / HOLD_MS);
    el.style.setProperty('--fill', String(progress * 100));
    if (progress >= 1) {
      hands.consumed = el;
      cancelArming();
      activate(el);
      return;
    }
    hands.arming.raf = requestAnimationFrame(step);
  };
  hands.arming.raf = requestAnimationFrame(step);
}

function updateHands() {
  if (!hands.on) return;
  const left = { x: hands.x - WRIST_SPREAD / 2, y: hands.y };
  const right = { x: hands.x + WRIST_SPREAD / 2, y: hands.y };
  const wristEls = document.querySelectorAll('.wrist');
  wristEls[0].style.transform = `translate(${left.x}px, ${left.y}px)`;
  wristEls[1].style.transform = `translate(${right.x}px, ${right.y}px)`;

  const leftTarget = targetAt(left.x, left.y);
  const rightTarget = targetAt(right.x, right.y);

  // Each wrist independently lights up whatever it is over: this is the
  // "aiming is cheap, committing is deliberate" half of the interaction.
  clearHover();
  for (const [el, wrist] of [[leftTarget, wristEls[0]], [rightTarget, wristEls[1]]]) {
    if (!el) continue;
    el.classList.add('is-hover');
    wrist.classList.add('is-hover');
  }

  const agree = leftTarget && rightTarget && leftTarget === rightTarget ? leftTarget : null;

  // Release gate: after activating, both wrists must leave before it can fire again.
  if (hands.consumed) {
    if (!agree || agree !== hands.consumed) hands.consumed = null;
    else { cancelArming(); return; }
  }

  if (!agree) { cancelArming(); return; }
  if (!hands.arming || hands.arming.el !== agree) startArming(agree, performance.now());
}

function installHands() {
  const body = document.body;
  for (let i = 0; i < 2; i += 1) {
    const el = document.createElement('div');
    el.className = 'wrist';
    body.append(el);
  }
  const toggle = document.querySelector('[data-role="hands-toggle"]');
  toggle?.addEventListener('click', () => {
    hands.on = !hands.on;
    body.classList.toggle('hands-on', hands.on);
    toggle.setAttribute('aria-pressed', String(hands.on));
    if (!hands.on) { clearHover(); cancelArming(); }
  });
  addEventListener('pointermove', event => {
    hands.x = event.clientX; hands.y = event.clientY;
    updateHands();
  }, { passive: true });
  addEventListener('pointerleave', () => { clearHover(); cancelArming(); });
}

/* ------------------------------------------------------------------ */
/* Microphone affordance                                               */
/* ------------------------------------------------------------------ */

const MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-4 4.9V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.1A5 5 0 0 1 7 12a1 1 0 1 1 2 0 3 3 0 0 0 6 0 1 1 0 1 1 2 0Z"/></svg>';
const KEY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 3v2h2V8H6Zm4 0v2h2V8h-2Zm4 0v2h2V8h-2Zm4 0v2h2V8h-2ZM6 12v2h2v-2H6Zm4 0v2h8v-2h-8Zm-4 3v2h12v-2H6Z"/></svg>';

function speechSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function installSearch() {
  const button = document.querySelector('[data-role="search-action"]');
  const input = document.querySelector('[data-role="search-input"]');
  if (!button || !input) return;
  const supported = speechSupported();
  button.innerHTML = supported ? MIC_SVG : KEY_SVG;
  button.setAttribute('aria-label', supported ? 'Search by voice' : 'Open keyboard');
  button.title = supported ? 'Voice search available in this browser' : 'Voice search unavailable; keyboard instead';
  button.dataset.handTarget = '';
  button.classList.add('target');
  button.addEventListener('click', () => {
    if (supported) {
      button.classList.add('is-select');
      setTimeout(() => button.classList.remove('is-select'), 220);
      input.placeholder = 'Listening… (prototype placeholder)';
      setTimeout(() => { input.placeholder = 'Search songs and playlists'; }, 1600);
    } else {
      input.focus();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function renderHome() {
  const daily = DATA.playlistOfTheDay;
  const dailyEl = document.querySelector('[data-role="daily"]');
  dailyEl.innerHTML = `<span class="pod-badge">Playlist of the day</span>${artHtml(daily)}<span class="pod-caption">${escapeHtml(daily.name)}</span><span class="dwell-ring"></span>`;
  dailyEl.addEventListener('click', () => navigate(daily));

  const rec = document.querySelector('[data-role="recommended"]');
  rec.innerHTML = DATA.recommended.map(p => `
    <button class="target folder" data-hand-target data-playlist="${escapeAttr(p.label)}" aria-label="${escapeAttr(p.name)} playlist, ${p.maps.length} songs">
      <span class="folder-tab"></span>
      <span class="folder-body"></span>
      <span class="folder-peek">${p.maps.filter(m => m.cover).slice(0, 4).map(m => `<img src="${asset(m.cover)}" alt="">`).join('')}</span>
      <span class="folder-name">${escapeHtml(p.name)}</span>
      <span class="dwell-ring"></span>
    </button>`).join('');
  for (const el of rec.querySelectorAll('[data-playlist]')) {
    el.addEventListener('click', () => navigate(findPlaylist(el.dataset.playlist)));
  }

  document.querySelector('[data-role="library"]')?.addEventListener('click', () => {
    const hint = document.querySelector('[data-role="library-hint"]');
    if (hint) { hint.textContent = 'Library screen is not built in this prototype yet.'; hint.style.opacity = '1'; setTimeout(() => { hint.style.opacity = '0'; }, 2200); }
  });
}

function renderPlaylist() {
  const key = new URLSearchParams(location.search).get('p') || DATA.playlistOfTheDay.label;
  const playlist = findPlaylist(key) || DATA.playlistOfTheDay;

  const art = document.querySelector('[data-role="art"]');
  art.innerHTML = artHtml(playlist);
  document.querySelector('[data-role="title"]').textContent = playlist.name;

  const owners = playlist.source === 'beatsaver'
    ? `Curated by ${playlist.owner || 'a BeatSaver curator'} · BeatSaver`
    : 'AeroBeat authored';
  document.querySelector('[data-role="meta"]').textContent =
    `${playlist.maps.length} songs · ${owners}`;

  // Difficulty preference list: clicking adds it in order, so the athlete's
  // priority is visible rather than implied.
  const present = DATA.difficulties.filter(d => playlist.maps.some(m => m.diffs.includes(d)));
  const chips = document.querySelector('[data-role="difficulties"]');
  chips.innerHTML = present.map(d => {
    const count = playlist.maps.filter(m => m.diffs.includes(d)).length;
    return `<button class="chip" data-hand-target data-difficulty="${d}" aria-pressed="false" title="${count} songs offer ${d}">
      <span>${d === 'ExpertPlus' ? 'Expert+' : d}</span><span class="dwell-ring"></span>
    </button>`;
  }).join('');

  const order = [];
  for (const chip of chips.querySelectorAll('[data-difficulty]')) {
    chip.addEventListener('click', () => {
      const name = chip.dataset.difficulty;
      const at = order.indexOf(name);
      if (at >= 0) { order.splice(at, 1); chip.setAttribute('aria-pressed', 'false'); chip.removeAttribute('data-order'); }
      else { order.push(name); chip.setAttribute('aria-pressed', 'true'); }
      for (const c of chips.querySelectorAll('[data-difficulty]')) {
        const index = order.indexOf(c.dataset.difficulty);
        if (index >= 0) c.dataset.order = String(index + 1);
      }
      updatePlayHint();
    });
  }

  const modes = document.querySelector('[data-role="modes"]');
  modes.innerHTML = ['Flow', 'Boxing'].map((m, i) => `
    <button class="chip" data-hand-target data-mode="${m}" aria-pressed="${i === 0}"><span>${m}</span><span class="dwell-ring"></span></button>`).join('');
  for (const chip of modes.querySelectorAll('[data-mode]')) {
    chip.addEventListener('click', () => {
      for (const c of modes.querySelectorAll('[data-mode]')) c.setAttribute('aria-pressed', String(c === chip));
      updatePlayHint();
    });
  }

    // Seed a plausible preference so the screen shows its real shape: an athlete
  // who wants the hardest thing available first, then one step down.
  const seeded = [...present].reverse().slice(0, 2);
  for (const name of seeded) chips.querySelector(`[data-difficulty="${name}"]`)?.click();

const play = document.querySelector('[data-role="play"]');
  play.dataset.handTarget = '';
  play.addEventListener('click', () => {
    const mode = modes.querySelector('[aria-pressed="true"]')?.dataset.mode ?? 'Flow';
    document.querySelector('[data-role="play-hint"]').textContent =
      `Prototype: would start ${playlist.name} · ${order.join(' › ') || 'any difficulty'} · ${mode}`;
  });

  function updatePlayHint() {
    const mode = modes.querySelector('[aria-pressed="true"]')?.dataset.mode ?? 'Flow';
    const count = playlist.maps.filter(m => order.some(d => m.diffs.includes(d))).length;
    document.querySelector('[data-role="play-hint"]').textContent =
      order.length ? `${count} of ${playlist.maps.length} songs match · ${order.join(' › ')} · ${mode}` : 'Pick at least one difficulty';
  }
  updatePlayHint();
}

function navigate(playlist) {
  location.href = `playlist.html?p=${encodeURIComponent(playlist.label)}`;
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = escapeHtml;

installHands();
installSearch();
if (document.body.dataset.screen === 'playlist') renderPlaylist();
else renderHome();