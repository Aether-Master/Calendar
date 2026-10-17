// ===== Clarity Daily Planner =====
const STORAGE_KEY = 'clarity_events_v1';
const NOTES_KEY = 'clarity_day_notes_v1';
const THEME_KEY = 'clarity_theme';
const PIN_HASH_KEY = 'clarity_pin_hash';
const PIN_SALT = 'clarity_device_salt_v1';

let currentDate = new Date();
let events = [];
let dayNotes = {};
let editingId = null;
let pinBuffer = '';
let pinMode = 'unlock';
let pendingPin = '';
let unlocked = false;

const dayNameEl = document.getElementById('dayName');
const fullDateEl = document.getElementById('fullDate');
const todayBadgeEl = document.getElementById('todayBadge');
const eventsListEl = document.getElementById('eventsList');
const emptyStateEl = document.getElementById('emptyState');
const weekStripEl = document.getElementById('weekStrip');
const modalEl = document.getElementById('modal');
const modalTitleEl = document.getElementById('modalTitle');
const eventForm = document.getElementById('eventForm');
const eventTitleInput = document.getElementById('eventTitle');
const eventTimeInput = document.getElementById('eventTime');
const allDayCheckbox = document.getElementById('allDay');
const eventNoteInput = document.getElementById('eventNote');
const deleteBtn = document.getElementById('deleteBtn');
const themeBtn = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');
const recurrenceSelect = document.getElementById('recurrence');
const intervalSelect = document.getElementById('interval');
const intervalGroup = document.getElementById('intervalGroup');
const intervalUnit = document.getElementById('intervalUnit');
const futurePeakEl = document.getElementById('futurePeak');
const futurePeakListEl = document.getElementById('futurePeakList');
const dayNotesEl = document.getElementById('dayNotes');
const pinScreen = document.getElementById('pinScreen');
const pinTitle = document.getElementById('pinTitle');
const pinSub = document.getElementById('pinSub');
const pinDots = document.getElementById('pinDots');
const pinError = document.getElementById('pinError');
const miniMonthEl = document.getElementById('miniMonth');
const sidePanel = document.getElementById('sidePanel');
const sideBackdrop = document.getElementById('sideBackdrop');

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}
function formatDisplayDate(date) {
  return {
    dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
    fullDate: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  };
}
function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  const hour = parseInt(parts[0], 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return (hour % 12 || 12) + ':' + parts[1] + ' ' + ampm;
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function isToday(date) { return isSameDay(date, new Date()); }
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function parseDateKey(key) {
  const p = key.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
async function hashPin(pin) {
  const data = new TextEncoder().encode(PIN_SALT + pin);
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  var h = 0, s = PIN_SALT + pin;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return 'f' + Math.abs(h).toString(16);
}
function loadEvents() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    events = raw ? JSON.parse(raw) : [];
    events = events.map(function(e) { return Object.assign({ done: false, recurrence: 'none', interval: 1 }, e); });
  } catch (e) { events = []; }
}
function saveEvents() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch (e) { console.error(e); }
}
function loadNotes() {
  try {
    var raw = localStorage.getItem(NOTES_KEY);
    dayNotes = raw ? JSON.parse(raw) : {};
  } catch (e) { dayNotes = {}; }
}
function saveNotes() {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(dayNotes)); } catch (e) { console.error(e); }
}
function getPinHash() { return localStorage.getItem(PIN_HASH_KEY); }
function setPinHash(hash) {
  if (hash) localStorage.setItem(PIN_HASH_KEY, hash);
  else localStorage.removeItem(PIN_HASH_KEY);
}
function getPreferredTheme() {
  var saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'dark') {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
  } else {
    themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0C0A09' : '#4F46E5';
}
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
function daysBetween(a, b) {
  var ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}
function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function yearsBetween(a, b) {
  return b.getFullYear() - a.getFullYear();
}
function occursOnDate(event, targetDate) {
  var targetKey = formatDateKey(targetDate);
  if (!event.recurrence || event.recurrence === 'none') return event.date === targetKey;
  var start = parseDateKey(event.date);
  start.setHours(0,0,0,0);
  var t = new Date(targetDate);
  t.setHours(0,0,0,0);
  if (t < start) return false;
  var interval = Math.max(1, parseInt(event.interval, 10) || 1);
  var r = event.recurrence;
  if (r === 'daily') return daysBetween(start, t) % interval === 0;
  if (r === 'weekly') {
    if (t.getDay() !== start.getDay()) return false;
    return Math.floor(daysBetween(start, t) / 7) % interval === 0;
  }
  if (r === 'monthly') {
    if (t.getDate() !== start.getDate()) return false;
    return monthsBetween(start, t) % interval === 0;
  }
  if (r === 'yearly') {
    if (t.getMonth() !== start.getMonth() || t.getDate() !== start.getDate()) return false;
    return yearsBetween(start, t) % interval === 0;
  }
  return false;
}
function recurrenceLabel(event) {
  var r = event.recurrence;
  if (!r || r === 'none') return '';
  var n = Math.max(1, parseInt(event.interval, 10) || 1);
  if (n === 1) return { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[r] || r;
  var unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r] || r;
  return 'Every ' + n + ' ' + unit + 's';
}
function updateIntervalUI() {
  if (!intervalGroup || !recurrenceSelect) return;
  var r = recurrenceSelect.value;
  if (!r || r === 'none') { intervalGroup.hidden = true; return; }
  intervalGroup.hidden = false;
  if (intervalUnit) intervalUnit.textContent = { daily: 'day(s)', weekly: 'week(s)', monthly: 'month(s)', yearly: 'year(s)' }[r] || '';
}
function updatePinDots() {
  pinDots.querySelectorAll('span').forEach(function(s, i) { s.classList.toggle('filled', i < pinBuffer.length); });
}
function showPinError() {
  pinError.classList.remove('hidden');
  pinDots.classList.add('shake');
  setTimeout(function() { pinDots.classList.remove('shake'); }, 400);
}
async function handlePinDigit(n) {
  if (n === 'clear') { pinBuffer = ''; pinError.classList.add('hidden'); updatePinDots(); return; }
  if (n === 'del') { pinBuffer = pinBuffer.slice(0, -1); pinError.classList.add('hidden'); updatePinDots(); return; }
  if (pinBuffer.length >= 4) return;
  pinBuffer += n;
  updatePinDots();
  if (pinBuffer.length < 4) return;
  if (pinMode === 'unlock') {
    var hash = await hashPin(pinBuffer);
    if (hash === getPinHash()) {
      unlocked = true; pinScreen.classList.add('hidden'); pinBuffer = ''; updatePinDots(); render();
    } else { showPinError(); pinBuffer = ''; updatePinDots(); }
  } else if (pinMode === 'set') {
    pendingPin = pinBuffer; pinBuffer = ''; pinMode = 'confirm';
    pinTitle.textContent = 'Confirm PIN'; pinSub.textContent = 'Enter the same 4 digits again';
    pinError.classList.add('hidden'); updatePinDots();
  } else if (pinMode === 'confirm') {
    if (pinBuffer === pendingPin) {
      setPinHash(await hashPin(pinBuffer)); unlocked = true; pinScreen.classList.add('hidden');
      pinBuffer = ''; pendingPin = ''; pinMode = 'unlock'; updatePinDots();
      alert('PIN saved. It only works on this device.'); render();
    } else {
      showPinError(); pinBuffer = ''; pinMode = 'set';
      pinTitle.textContent = 'Set a PIN'; pinSub.textContent = 'Choose 4 digits to protect this device'; updatePinDots();
    }
  }
}
function openSetPin() {
  pinMode = 'set'; pinBuffer = ''; pendingPin = '';
  pinTitle.textContent = 'Set a PIN'; pinSub.textContent = '4 digits · stays only on this device';
  pinError.classList.add('hidden'); updatePinDots(); pinScreen.classList.remove('hidden'); closeSidePanel();
}
function requirePinIfNeeded() {
  if (getPinHash() && !unlocked) {
    pinMode = 'unlock'; pinTitle.textContent = 'Enter PIN'; pinSub.textContent = 'Your data stays on this device';
    pinBuffer = ''; updatePinDots(); pinScreen.classList.remove('hidden'); return true;
  }
  unlocked = true; return false;
}
function renderDate() {
  var d = formatDisplayDate(currentDate);
  dayNameEl.textContent = d.dayName; fullDateEl.textContent = d.fullDate;
  todayBadgeEl.classList.toggle('hidden', isToday(currentDate));
}
function renderWeekStrip() {
  weekStripEl.innerHTML = '';
  var start = new Date(currentDate);
  start.setDate(start.getDate() - start.getDay());
  var labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (var i = 0; i < 7; i++) {
    var d = new Date(start); d.setDate(start.getDate() + i);
    var btn = document.createElement('button');
    btn.className = 'week-day'; btn.type = 'button';
    if (isSameDay(d, currentDate)) btn.classList.add('is-selected');
    if (isToday(d)) btn.classList.add('is-today');
    if (events.some(function(e) { return occursOnDate(e, d); })) btn.classList.add('has-events');
    btn.innerHTML = '<span class="wd-label">' + labels[i] + '</span><span class="wd-num">' + d.getDate() + '</span>';
    (function(dd) { btn.addEventListener('click', function() { currentDate = new Date(dd); render(); }); })(d);
    weekStripEl.appendChild(btn);
  }
}
function renderMiniMonth() {
  if (!miniMonthEl) return;
  var year = currentDate.getFullYear(), month = currentDate.getMonth();
  var startDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  var html = '<div class="mm-header"><button type="button" class="mm-nav" id="mmPrev">‹</button><span class="mm-title">' + monthName + '</span><button type="button" class="mm-nav" id="mmNext">›</button></div><div class="mm-grid">';
  ['S','M','T','W','T','F','S'].forEach(function(l) { html += '<span class="mm-dow">' + l + '</span>'; });
  for (var i = 0; i < startDay; i++) html += '<span class="mm-empty"></span>';
  for (var day = 1; day <= daysInMonth; day++) {
    var d = new Date(year, month, day);
    var classes = ['mm-day'];
    if (isSameDay(d, currentDate)) classes.push('is-selected');
    if (isToday(d)) classes.push('is-today');
    if (events.some(function(e) { return occursOnDate(e, d); })) classes.push('has-events');
    html += '<button type="button" class="' + classes.join(' ') + '" data-day="' + day + '">' + day + '</button>';
  }
  html += '</div>';
  miniMonthEl.innerHTML = html;
  document.getElementById('mmPrev').addEventListener('click', function() {
    currentDate = new Date(year, month - 1, Math.min(currentDate.getDate(), 28)); render();
  });
  document.getElementById('mmNext').addEventListener('click', function() {
    currentDate = new Date(year, month + 1, Math.min(currentDate.getDate(), 28)); render();
  });
  miniMonthEl.querySelectorAll('.mm-day').forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentDate = new Date(year, month, parseInt(btn.dataset.day, 10)); render(); closeSidePanel();
    });
  });
}
function renderDayNotes() {
  dayNotesEl.value = dayNotes[formatDateKey(currentDate)] || '';
}
function getEventsForCurrentDay() {
  return events.filter(function(e) { return occursOnDate(e, currentDate); }).sort(function(a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.time || '').localeCompare(b.time || '');
  });
}
function getUpcomingEvents(limit) {
  limit = limit || 6;
  var results = [], start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);
  for (var i = 1; i <= 21 && results.length < limit; i++) {
    var d = new Date(start); d.setDate(start.getDate() + i);
    events.filter(function(e) { return occursOnDate(e, d) && !e.done; })
      .sort(function(a, b) { return (a.time || '').localeCompare(b.time || ''); })
      .forEach(function(ev) { if (results.length < limit) results.push({ event: ev, date: new Date(d) }); });
  }
  return results;
}
function renderEvents() {
  var dayEvents = getEventsForCurrentDay();
  eventsListEl.innerHTML = '';
  if (dayEvents.length === 0) { emptyStateEl.classList.remove('hidden'); return; }
  emptyStateEl.classList.add('hidden');
  dayEvents.forEach(function(event) {
    var card = document.createElement('div');
    card.className = 'event-card' + (event.done ? ' is-done' : '');
    var timeText = event.allDay ? 'All day' : formatTime(event.time);
    var timeClass = event.allDay ? 'event-time all-day' : 'event-time';
    var label = recurrenceLabel(event);
    var recurBadge = label ? '<span class="recur-badge">' + escapeHtml(label) + '</span>' : '';
    card.innerHTML = '<button class="check-btn" aria-label="Toggle done"><svg class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></button><div class="event-content"><div class="' + timeClass + '">' + timeText + recurBadge + '</div><div class="event-body"><div class="event-title">' + escapeHtml(event.title) + '</div>' + (event.note ? '<div class="event-note">' + escapeHtml(event.note) + '</div>' : '') + '</div></div>';
    card.querySelector('.check-btn').addEventListener('click', function(e) { e.stopPropagation(); toggleDone(event.id); });
    card.addEventListener('click', function() { openEditModal(event.id); });
    eventsListEl.appendChild(card);
  });
}
function renderFuturePeak() {
  var upcoming = getUpcomingEvents(6);
  futurePeakListEl.innerHTML = '';
  if (upcoming.length === 0) { futurePeakEl.classList.add('hidden'); return; }
  futurePeakEl.classList.remove('hidden');
  upcoming.forEach(function(item) {
    var el = document.createElement('div');
    el.className = 'future-item';
    var dateLabel = item.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    var timeText = item.event.allDay ? 'All day' : formatTime(item.event.time);
    el.innerHTML = '<span class="future-date">' + dateLabel + '</span><span class="future-time">' + timeText + '</span><span class="future-title">' + escapeHtml(item.event.title) + '</span>';
    el.addEventListener('click', function() { currentDate = new Date(item.date); render(); });
    futurePeakListEl.appendChild(el);
  });
}
function render() {
  if (getPinHash() && !unlocked) return;
  renderDate(); renderWeekStrip(); renderMiniMonth(); renderDayNotes(); renderEvents(); renderFuturePeak();
}
function toggleDone(id) {
  var idx = events.findIndex(function(e) { return e.id === id; });
  if (idx === -1) return;
  events[idx].done = !events[idx].done; saveEvents(); render();
}
function openAddModal() {
  editingId = null; modalTitleEl.textContent = 'New Event';
  eventTitleInput.value = ''; eventTimeInput.value = ''; allDayCheckbox.checked = false; eventNoteInput.value = '';
  recurrenceSelect.value = 'none'; if (intervalSelect) intervalSelect.value = '1'; updateIntervalUI();
  deleteBtn.classList.add('hidden'); eventTimeInput.disabled = false;
  modalEl.classList.remove('hidden'); setTimeout(function() { eventTitleInput.focus(); }, 80);
}
function openEditModal(id) {
  var event = events.find(function(e) { return e.id === id; });
  if (!event) return;
  editingId = id; modalTitleEl.textContent = 'Edit Event';
  eventTitleInput.value = event.title; eventTimeInput.value = event.time || '';
  allDayCheckbox.checked = !!event.allDay; eventNoteInput.value = event.note || '';
  recurrenceSelect.value = event.recurrence || 'none';
  if (intervalSelect) intervalSelect.value = String(event.interval || 1);
  updateIntervalUI(); deleteBtn.classList.remove('hidden');
  eventTimeInput.disabled = allDayCheckbox.checked;
  modalEl.classList.remove('hidden'); setTimeout(function() { eventTitleInput.focus(); }, 80);
}
function closeModal() { modalEl.classList.add('hidden'); editingId = null; }
function handleSave(e) {
  e.preventDefault();
  var title = eventTitleInput.value.trim();
  if (!title) return;
  var allDay = allDayCheckbox.checked;
  var time = allDay ? null : (eventTimeInput.value || null);
  var note = eventNoteInput.value.trim() || null;
  var recurrence = recurrenceSelect.value || 'none';
  var interval = 1;
  if (recurrence !== 'none' && intervalSelect) interval = Math.max(1, parseInt(intervalSelect.value, 10) || 1);
  var dateKey = formatDateKey(currentDate);
  if (editingId) {
    var idx = events.findIndex(function(ev) { return ev.id === editingId; });
    if (idx !== -1) events[idx] = Object.assign({}, events[idx], { title: title, time: time, allDay: allDay, note: note, recurrence: recurrence, interval: interval, date: dateKey });
  } else {
    events.push({ id: generateId(), title: title, time: time, allDay: allDay, note: note, recurrence: recurrence, interval: interval, done: false, date: dateKey, createdAt: new Date().toISOString() });
  }
  saveEvents(); closeModal(); render();
}
function handleDelete() {
  if (!editingId || !confirm('Delete this event?')) return;
  events = events.filter(function(e) { return e.id !== editingId; });
  saveEvents(); closeModal(); render();
}
function changeDay(delta) { currentDate.setDate(currentDate.getDate() + delta); render(); }
function goToToday() { currentDate = new Date(); render(); }
function openSidePanel() { sidePanel.classList.add('open'); sideBackdrop.classList.remove('hidden'); }
function closeSidePanel() { sidePanel.classList.remove('open'); sideBackdrop.classList.add('hidden'); }
function exportBackup() {
  var data = { version: 1, exportedAt: new Date().toISOString(), events: events, dayNotes: dayNotes };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'clarity-backup-' + formatDateKey(new Date()) + '.json'; a.click();
  URL.revokeObjectURL(url);
}
function updateLiveClock() {
  var el = document.getElementById('liveClock');
  if (!el) return;
  var now = new Date();
  el.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map(function(n) { return String(n).padStart(2, '0'); }).join(':');
}
var touchStartX = 0, touchStartY = 0;
function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY;
}
function handleTouchEnd(e) {
  var dx = e.changedTouches[0].screenX - touchStartX;
  var dy = e.changedTouches[0].screenY - touchStartY;
  if (Math.abs(dx) > 60 && Math.abs(dy) < 40) changeDay(dx > 0 ? -1 : 1);
}
function init() {
  loadEvents(); loadNotes(); applyTheme(getPreferredTheme());
  if (!requirePinIfNeeded()) render();
  updateLiveClock(); setInterval(updateLiveClock, 1000);
  document.getElementById('prevDay').addEventListener('click', function() { changeDay(-1); });
  document.getElementById('nextDay').addEventListener('click', function() { changeDay(1); });
  document.getElementById('todayBtn').addEventListener('click', goToToday);
  themeBtn.addEventListener('click', toggleTheme);
  document.getElementById('addBtn').addEventListener('click', openAddModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeModal);
  eventForm.addEventListener('submit', handleSave);
  deleteBtn.addEventListener('click', handleDelete);
  allDayCheckbox.addEventListener('change', function() {
    eventTimeInput.disabled = allDayCheckbox.checked;
    if (allDayCheckbox.checked) eventTimeInput.value = '';
  });
  if (recurrenceSelect) recurrenceSelect.addEventListener('change', updateIntervalUI);
  var notesTimer = null;
  dayNotesEl.addEventListener('input', function() {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(function() {
      var key = formatDateKey(currentDate), val = dayNotesEl.value;
      if (val.trim()) dayNotes[key] = val; else delete dayNotes[key];
      saveNotes();
    }, 400);
  });
  document.getElementById('pinPad').addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-n]');
    if (btn) handlePinDigit(btn.dataset.n);
  });
  document.getElementById('setPinBtn').addEventListener('click', openSetPin);
  document.getElementById('exportBtn').addEventListener('click', exportBackup);
  document.getElementById('menuBtn').addEventListener('click', openSidePanel);
  var closeSideBtn = document.getElementById('closeSideBtn');
  if (closeSideBtn) closeSideBtn.addEventListener('click', closeSidePanel);
  sideBackdrop.addEventListener('click', closeSidePanel);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) closeModal();
  });
  var main = document.querySelector('.main');
  main.addEventListener('touchstart', handleTouchStart, { passive: true });
  main.addEventListener('touchend', handleTouchEnd, { passive: true });
}
init();
