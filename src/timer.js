'use strict';

// ── Electron IPC ────────────────────────────────────────────────
const { ipcRenderer } = require('electron');

// ── Fixed cycle durations (unchanged) ───────────────────────────
const WORK_SEGMENT = 52 * 60 + 30;   // 52 min 30 s — blue
const BREAK_SEGMENT =  7 * 60 + 30;  // 7  min 30 s — red
const CYCLE_TOTAL  = WORK_SEGMENT + BREAK_SEGMENT; // 60 min exactly

// ── Helpers ──────────────────────────────────────────────────────
const H = (h, m, s = 0) => h * 3600 + m * 60 + s;

function nowSeconds() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function fmt(secs) {
  if (secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/** "08:30" → seconds from midnight */
function timeStrToSec(str) {
  const [h, m] = str.split(':').map(Number);
  return H(h, m);
}

/** seconds from midnight → "HH:MM" */
function secToTimeStr(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ── Schedule (loaded from localStorage or defaults) ──────────────
const SCHEDULE_KEY = 'wt_schedule_v1';

const DEFAULT_SCHEDULE = {
  morningStart : '08:30',
  lunchStart   : '12:30',
  lunchEnd     : '13:30',
  dayEnd       : '17:30',
};

function loadSchedule() {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveSchedule(s) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s));
}

/**
 * From a saved schedule object build all the numeric boundary
 * constants that the timer and timeline need.
 */
function buildBoundaries(s) {
  const morningStart  = timeStrToSec(s.morningStart);
  const lunchStart    = timeStrToSec(s.lunchStart);
  const lunchEnd      = timeStrToSec(s.lunchEnd);
  const dayEnd        = timeStrToSec(s.dayEnd);
  const afternoonStart = lunchEnd;
  const dayTotal      = dayEnd - morningStart;

  return { morningStart, lunchStart, lunchEnd, afternoonStart, dayEnd, dayTotal };
}

// ── Active boundaries (mutated when schedule changes) ────────────
let B = buildBoundaries(loadSchedule() || DEFAULT_SCHEDULE);

// ── DOM refs ─────────────────────────────────────────────────────
const display        = document.getElementById('timer-display');
const statusLabel    = document.getElementById('status-label');
const phaseLabel     = document.getElementById('phase-label');
const btnHide        = document.getElementById('btn-hide');
const btnClose       = document.getElementById('btn-close');
const btnSettings    = document.getElementById('btn-settings');
const timelineBar    = document.getElementById('timeline-bar');
const timelinePtr    = document.getElementById('timeline-pointer');
const tlLabelRow     = document.getElementById('timeline-label-row');
const resizeHandle   = document.getElementById('resize-handle');

// ── Setup overlay DOM refs ────────────────────────────────────────
const setupOverlay   = document.getElementById('setup-overlay');
const step1          = document.getElementById('setup-step-1');
const step2          = document.getElementById('setup-step-2');
const stepDots       = document.querySelectorAll('.step-dot');
const inpMorning     = document.getElementById('inp-morning-start');
const inpLunchStart  = document.getElementById('inp-lunch-start');
const inpLunchEnd    = document.getElementById('inp-lunch-end');
const inpDayEnd      = document.getElementById('inp-day-end');
const btnSetupSave   = document.getElementById('btn-setup-save');
const btnSetupCancel = document.getElementById('btn-setup-cancel');
const btnStep1Next   = document.getElementById('btn-step1-next');
const btnStep2Back   = document.getElementById('btn-step2-back');
const fieldMorning   = document.getElementById('field-morning');
const fieldLunchS    = document.getElementById('field-lunch-start');
const fieldLunchE    = document.getElementById('field-lunch-end');
const fieldDayEnd    = document.getElementById('field-day-end');
const prevMorning    = document.getElementById('prev-morning');
const prevLunch      = document.getElementById('prev-lunch');
const prevAfternoon  = document.getElementById('prev-afternoon');
const prevCycles     = document.getElementById('prev-cycles');

// ════════════════════════════════════════════════════════════════
//  SETUP WIZARD — 2-step navigation
// ════════════════════════════════════════════════════════════════

/** Show step 1 or step 2 and update the dot indicators. */
function showStep(n) {
  step1.classList.toggle('hidden', n !== 1);
  step2.classList.toggle('hidden', n !== 2);
  stepDots.forEach((dot, i) => {
    dot.classList.toggle('active', i === n - 1);
    dot.classList.toggle('done',   i < n - 1);
  });
  if (n === 2) updatePreview();
}

/** Populate the step-2 preview panel from current input values. */
function updatePreview() {
  const ms = timeStrToSec(inpMorning.value);
  const ls = timeStrToSec(inpLunchStart.value);
  const le = timeStrToSec(inpLunchEnd.value);
  const de = timeStrToSec(inpDayEnd.value);

  if ([ms, ls, le, de].some(isNaN)) {
    prevMorning.textContent = prevLunch.textContent =
    prevAfternoon.textContent = prevCycles.textContent = '—';
    return;
  }

  const mornSessions  = Math.floor((ls - ms) / CYCLE_TOTAL);
  const aftSessions   = Math.floor((de - le) / CYCLE_TOTAL);
  const totalCycles   = mornSessions + aftSessions;

  prevMorning.textContent   = `${secToTimeStr(ms)} – ${secToTimeStr(ls)}`;
  prevLunch.textContent     = `${secToTimeStr(ls)} – ${secToTimeStr(le)}`;
  prevAfternoon.textContent = `${secToTimeStr(le)} – ${secToTimeStr(de)}`;
  prevCycles.textContent    = `${totalCycles} × 60 min`;
}

function openSetup(isFirstRun) {
  const s = loadSchedule() || DEFAULT_SCHEDULE;
  inpMorning.value    = s.morningStart;
  inpLunchStart.value = s.lunchStart;
  inpLunchEnd.value   = s.lunchEnd;
  inpDayEnd.value     = s.dayEnd;

  setupOverlay.classList.toggle('first-run', isFirstRun);
  setupOverlay.classList.remove('hidden');
  showStep(1);
}

function closeSetup() {
  setupOverlay.classList.add('hidden');
}

/** Mark a field invalid with shake animation (independent — does NOT return false). */
function markError(fieldEl) {
  fieldEl.classList.remove('error');
  void fieldEl.offsetWidth;  // force reflow so animation restarts
  fieldEl.classList.add('error');
}

function clearErrors(...fields) {
  fields.forEach(f => f.classList.remove('error'));
}

/** Parse a time input value; returns NaN if blank or malformed. */
function parseTime(inp) {
  const v = inp.value.trim();
  if (!v || !v.includes(':')) return NaN;
  return timeStrToSec(v);
}

// ── Step 1 → Next ────────────────────────────────────────────────
btnStep1Next.addEventListener('click', () => {
  clearErrors(fieldMorning, fieldLunchS, fieldLunchE);

  const ms = parseTime(inpMorning);
  const ls = parseTime(inpLunchStart);
  const le = parseTime(inpLunchEnd);

  let ok = true;

  if (isNaN(ms)) { markError(fieldMorning); ok = false; }
  if (isNaN(ls) || (!isNaN(ms) && ls <= ms)) { markError(fieldLunchS); ok = false; }
  if (isNaN(le) || (!isNaN(ls) && le <= ls)) { markError(fieldLunchE); ok = false; }

  // Morning session must be at least one full cycle
  if (ok && (ls - ms) < CYCLE_TOTAL) { markError(fieldLunchS); ok = false; }

  if (!ok) return;
  showStep(2);
});

// ── Step 2 → Back ────────────────────────────────────────────────
btnStep2Back.addEventListener('click', () => {
  clearErrors(fieldDayEnd);
  showStep(1);
});

// ── Step 2 → Save ────────────────────────────────────────────────
btnSetupSave.addEventListener('click', () => {
  clearErrors(fieldDayEnd);

  const le = parseTime(inpLunchEnd);
  const de = parseTime(inpDayEnd);

  let ok = true;
  if (isNaN(de) || (!isNaN(le) && de <= le)) { markError(fieldDayEnd); ok = false; }
  if (ok && (de - le) < CYCLE_TOTAL)          { markError(fieldDayEnd); ok = false; }

  if (!ok) return;

  const newSchedule = {
    morningStart : inpMorning.value,
    lunchStart   : inpLunchStart.value,
    lunchEnd     : inpLunchEnd.value,
    dayEnd       : inpDayEnd.value,
  };

  saveSchedule(newSchedule);
  B = buildBoundaries(newSchedule);
  lastPhase = null;
  buildTimeline();
  closeSetup();
});

// ── Cancel (returns to timer without saving) ─────────────────────
btnSetupCancel.addEventListener('click', closeSetup);

// ── Gear button ──────────────────────────────────────────────────
btnSettings.addEventListener('click', () => openSetup(false));

// ── Live preview updates as user types on step 2 ─────────────────
inpDayEnd.addEventListener('input', updatePreview);

// ── Show setup on first launch ────────────────────────────────────
if (!loadSchedule()) {
  openSetup(true);
}

// ════════════════════════════════════════════════════════════════
//  DRAG + RESIZE
// ════════════════════════════════════════════════════════════════

let dragStart = null;
const dragBar = document.getElementById('drag-bar');

dragBar.addEventListener('mousedown', (e) => {
  if ([btnHide, btnClose, btnSettings].includes(e.target)) return;
  dragStart = { x: e.screenX, y: e.screenY };
});

// Also allow dragging via the setup overlay background
setupOverlay.addEventListener('mousedown', (e) => {
  if (e.target !== setupOverlay) return; // only the backdrop itself
  dragStart = { x: e.screenX, y: e.screenY };
});

window.addEventListener('mousemove', (e) => {
  if (dragStart) {
    const dx = e.screenX - dragStart.x;
    const dy = e.screenY - dragStart.y;
    dragStart = { x: e.screenX, y: e.screenY };
    ipcRenderer.send('move-window', { dx, dy });
  }
  if (resizeStart) {
    const w = resizeStart.w + (e.screenX - resizeStart.x);
    const h = resizeStart.h + (e.screenY - resizeStart.y);
    ipcRenderer.send('resize-window', { width: Math.round(w), height: Math.round(h) });
  }
});

window.addEventListener('mouseup', () => {
  dragStart   = null;
  resizeStart = null;
});

let resizeStart = null;

resizeHandle.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  resizeStart = {
    x: e.screenX,
    y: e.screenY,
    w: window.outerWidth,
    h: window.outerHeight,
  };
});

btnClose.addEventListener('click', () => ipcRenderer.send('quit-app'));
btnHide.addEventListener('click',  () => ipcRenderer.send('hide-window'));

// ── Double-click drag bar → compact / expand toggle ──────────────
let isCompact = false;

dragBar.addEventListener('dblclick', (e) => {
  // Ignore double-clicks that land on a button
  if ([btnHide, btnClose, btnSettings].includes(e.target)) return;

  isCompact = !isCompact;

  if (isCompact) {
    // Apply class first so the hidden elements collapse in the DOM,
    // then read the actual rendered height and ask main to match it.
    document.body.classList.add('compact');
    // scrollHeight of body now reflects only the visible rows
    const contentHeight = document.body.scrollHeight;
    ipcRenderer.send('snap-compact', { contentHeight });
  } else {
    document.body.classList.remove('compact');
    ipcRenderer.send('snap-expand');
  }
});

// ════════════════════════════════════════════════════════════════
//  PHASE / DISPLAY
// ════════════════════════════════════════════════════════════════

function setPhase(phase, label) {
  // Preserve 'compact' class while switching the phase class
  const compact = document.body.classList.contains('compact');
  document.body.className = 'phase-' + phase + (compact ? ' compact' : '');
  phaseLabel.textContent = label;
}

// ════════════════════════════════════════════════════════════════
//  ALERT CHIMES
// ════════════════════════════════════════════════════════════════

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playChime(type) {
  try {
    const ctx  = getAudioCtx();
    const now  = ctx.currentTime;
    const freqs = type === 'break' ? [880, 660, 440] : [440, 660, 880];

    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      const end   = start + 0.25;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.05);
    });
  } catch (_) {}
}

let lastPhase = null;

function checkTransition(newPhase) {
  if (lastPhase !== null && lastPhase !== newPhase) {
    if (newPhase === 'break' || newPhase === 'lunch') playChime('break');
    else if (newPhase === 'work')                     playChime('work');
  }
  lastPhase = newPhase;
}

// ════════════════════════════════════════════════════════════════
//  TIMELINE
// ════════════════════════════════════════════════════════════════

// ── Tooltip DOM refs ─────────────────────────────────────────────
const tlTooltip  = document.getElementById('tl-tooltip');
const ttType     = document.getElementById('tl-tt-type');
const ttRange    = document.getElementById('tl-tt-range');
const ttDur      = document.getElementById('tl-tt-dur');

/** Format a duration in seconds as "Xh Ym Zs" omitting zero parts. */
function fmtDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m} min`);
  if (s) parts.push(`${s} sec`);
  return parts.join(' ');
}

function buildTimeline() {
  // Remove old segments
  timelineBar.querySelectorAll('.tl-seg').forEach(el => el.remove());

  // Rebuild time labels dynamically
  tlLabelRow.innerHTML = '';
  const addLabel = (text, positionPct, alignRight = false) => {
    const span = document.createElement('span');
    span.className = 'tl-label';
    span.textContent = text;
    if (positionPct !== null) {
      span.style.position = 'absolute';
      span.style.left = positionPct + '%';
      span.style.transform = 'translateX(-50%)';
    }
    if (alignRight) span.style.marginLeft = 'auto';
    tlLabelRow.appendChild(span);
  };

  const { morningStart, lunchStart, dayEnd, dayTotal } = B;
  addLabel(secToTimeStr(morningStart), null);
  const lunchPct = ((lunchStart - morningStart) / dayTotal) * 100;
  addLabel(secToTimeStr(lunchStart), lunchPct);
  addLabel(secToTimeStr(dayEnd), null, true);

  // Build segments
  const frag = document.createDocumentFragment();

  /**
   * @param {number} startSec   - absolute start second of this segment
   * @param {number} durationSec
   * @param {string} cssClass   - tl-work | tl-break | tl-lunch
   * @param {string} label      - human name shown in tooltip type line
   */
  function addSeg(startSec, durationSec, cssClass, label) {
    const pct = (durationSec / dayTotal) * 100;
    const div = document.createElement('div');
    div.className = `tl-seg ${cssClass}`;
    div.style.width = pct + '%';

    // Store tooltip data as dataset (no native title= so no browser default tooltip)
    div.dataset.label    = label;
    div.dataset.startSec = startSec;
    div.dataset.durSec   = durationSec;
    div.dataset.ttClass  = cssClass.replace('tl-', 'tt-'); // tl-work → tt-work

    frag.appendChild(div);
  }

  // Morning cycles
  let cursor = morningStart;
  while (cursor < lunchStart) {
    const workEnd  = Math.min(cursor + WORK_SEGMENT, lunchStart);
    const breakEnd = Math.min(cursor + CYCLE_TOTAL,  lunchStart);
    addSeg(cursor,   workEnd - cursor,  'tl-work',  'Focus');
    if (workEnd < lunchStart) addSeg(workEnd, breakEnd - workEnd, 'tl-break', 'Break');
    cursor += CYCLE_TOTAL;
  }

  // Lunch
  addSeg(B.lunchStart, B.lunchEnd - B.lunchStart, 'tl-lunch', 'Lunch');

  // Afternoon cycles
  cursor = B.afternoonStart;
  while (cursor < dayEnd) {
    const workEnd  = Math.min(cursor + WORK_SEGMENT, dayEnd);
    const breakEnd = Math.min(cursor + CYCLE_TOTAL,  dayEnd);
    addSeg(cursor,   workEnd - cursor,  'tl-work',  'Focus');
    if (workEnd < dayEnd) addSeg(workEnd, breakEnd - workEnd, 'tl-break', 'Break');
    cursor += CYCLE_TOTAL;
  }

  timelineBar.insertBefore(frag, timelinePtr);
}

// ── Tooltip event delegation on the bar ──────────────────────────
timelineBar.addEventListener('mouseover', (e) => {
  const seg = e.target.closest('.tl-seg');
  if (!seg) return;

  const startSec  = Number(seg.dataset.startSec);
  const durSec    = Number(seg.dataset.durSec);
  const endSec    = startSec + durSec;

  // Fill tooltip content
  ttType.textContent  = seg.dataset.label;
  ttRange.textContent = `${secToTimeStr(startSec)} – ${secToTimeStr(endSec)}`;
  ttDur.textContent   = fmtDuration(durSec);

  // Set colour class
  tlTooltip.className = seg.dataset.ttClass;   // tt-work | tt-break | tt-lunch

  // Position: horizontally centred on the segment's midpoint within the bar
  const barRect = timelineBar.getBoundingClientRect();
  const segRect = seg.getBoundingClientRect();
  const midX    = segRect.left + segRect.width / 2 - barRect.left;
  tlTooltip.style.left = midX + 'px';

  tlTooltip.classList.remove('hidden');
});

timelineBar.addEventListener('mouseleave', () => {
  tlTooltip.classList.add('hidden');
});

function updatePointer(nowSec) {
  const { morningStart, dayEnd, dayTotal } = B;
  const clamped = Math.max(morningStart, Math.min(dayEnd, nowSec));
  const pct = ((clamped - morningStart) / dayTotal) * 100;
  timelinePtr.style.left    = pct + '%';
  timelinePtr.style.display = 'block';
}

// Build timeline on load (uses whatever B is set to)
buildTimeline();

// ════════════════════════════════════════════════════════════════
//  MAIN TICK
// ════════════════════════════════════════════════════════════════

function tick() {
  // Skip ticking while setup overlay is open
  if (!setupOverlay.classList.contains('hidden')) return;

  const now = nowSeconds();
  const { morningStart, lunchStart, lunchEnd, afternoonStart, dayEnd } = B;

  updatePointer(now);

  // Outside working hours
  if (now < morningStart || now >= dayEnd) {
    checkTransition('idle');
    setPhase('idle', 'Off hours');
    statusLabel.textContent = now < morningStart
      ? `Starts ${secToTimeStr(morningStart)}`
      : 'Day complete';
    display.textContent = '--:--';
    document.body.classList.remove('urgent');
    return;
  }

  // Lunch
  if (now >= lunchStart && now < lunchEnd) {
    const remaining = lunchEnd - now;
    checkTransition('lunch');
    setPhase('green', '🍽  Lunch Break');
    statusLabel.textContent = 'Lunch Break';
    display.textContent = fmt(remaining);
    document.body.classList.toggle('urgent', remaining <= 10);
    return;
  }

  // Work cycle (morning or afternoon)
  const sessionStart = now >= afternoonStart ? afternoonStart : morningStart;
  const elapsed      = now - sessionStart;
  const posInCycle   = elapsed % CYCLE_TOTAL;
  const cycleNum     = Math.floor(elapsed / CYCLE_TOTAL) + 1;

  if (posInCycle < WORK_SEGMENT) {
    const remaining = WORK_SEGMENT - posInCycle;
    checkTransition('work');
    setPhase('blue', `Focus · Cycle ${cycleNum}`);
    statusLabel.textContent = 'Focus Time';
    display.textContent = fmt(remaining);
    document.body.classList.toggle('urgent', remaining <= 10);
  } else {
    const remaining = BREAK_SEGMENT - (posInCycle - WORK_SEGMENT);
    checkTransition('break');
    setPhase('red', `Break · Cycle ${cycleNum}`);
    statusLabel.textContent = 'Short Break';
    display.textContent = fmt(remaining);
    document.body.classList.toggle('urgent', remaining <= 10);
  }
}

tick();
setInterval(tick, 1000);
