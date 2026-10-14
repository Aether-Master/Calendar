// ===== Clarity Daily Planner =====
// Calm, simple, local-first daily planner

const STORAGE_KEY = 'clarity_events_v1';
const THEME_KEY = 'clarity_theme';

// State
let currentDate = new Date();
let events = [];
let editingId = null;

// DOM
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

// ===== Helpers =====
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date) {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return { dayName, fullDate };
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isToday(date) {
  return isSameDay(date, new Date());
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ===== Recurrence helpers =====
function occursOnDate(event, targetDate) {
  const targetKey = formatDateKey(targetDate);
  
  // Non-recurring: exact date match
  if (!event.recurrence || event.recurrence === 'none') {
    return event.date === targetKey;
  }
  
  const start = parseDateKey(event.date);
  if (targetDate < start) return false; // before start date
  
  if (event.recurrence === 'daily') {
    return true; // every day from start onward
  }
  
  if (event.recurrence === 'monthly') {
    // Same day-of-month
    return targetDate.getDate() === start.getDate();
  }
  
  return false;
}

// ===== Storage =====
function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    events = raw ? JSON.parse(raw) : [];
    // Migration: ensure new fields exist
    events = events.map(e => ({
      done: false,
      recurrence: 'none',
      ...e
    }));
  } catch (e) {
    events = [];
  }
}

function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.error('Save failed', e);
  }
}

// ===== Theme =====
function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  
  if (theme === 'dark') {
    themeIcon.innerHTML = `
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    `;
  } else {
    themeIcon.innerHTML = `
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    `;
  }
  
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0C0A09' : '#4F46E5';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ===== Rendering =====
function renderDate() {
  const { dayName, fullDate } = formatDisplayDate(currentDate);
  dayNameEl.textContent = dayName;
  fullDateEl.textContent = fullDate;
  
  if (isToday(currentDate)) {
    todayBadgeEl.classList.add('hidden');
  } else {
    todayBadgeEl.classList.remove('hidden');
  }
}

function renderWeekStrip() {
  weekStripEl.innerHTML = '';
  
  const start = new Date(currentDate);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    
    const btn = document.createElement('button');
    btn.className = 'week-day';
    btn.type = 'button';
    
    if (isSameDay(d, currentDate)) btn.classList.add('is-selected');
    if (isToday(d)) btn.classList.add('is-today');
    
    // Has any event (including recurring) on this day?
    const has = events.some(e => occursOnDate(e, d));
    if (has) btn.classList.add('has-events');
    
    btn.innerHTML = `
      <span class="wd-label">${labels[i]}</span>
      <span class="wd-num">${d.getDate()}</span>
    `;
    
    btn.addEventListener('click', () => {
      currentDate = new Date(d);
      render();
    });
    
    weekStripEl.appendChild(btn);
  }
}

function getEventsForCurrentDay() {
  return events
    .filter(e => occursOnDate(e, currentDate))
    .sort((a, b) => {
      // Incomplete first, then all-day, then by time
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      if (a.allDay && b.allDay) return 0;
      return (a.time || '').localeCompare(b.time || '');
    });
}

function renderEvents() {
  const dayEvents = getEventsForCurrentDay();
  eventsListEl.innerHTML = '';
  
  if (dayEvents.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }
  
  emptyStateEl.classList.add('hidden');
  
  dayEvents.forEach(event => {
    const card = document.createElement('div');
    card.className = 'event-card' + (event.done ? ' is-done' : '');
    card.dataset.id = event.id;
    
    const timeText = event.allDay ? 'All day' : formatTime(event.time);
    const timeClass = event.allDay ? 'event-time all-day' : 'event-time';
    
    // Recurrence badge
    let recurBadge = '';
    if (event.recurrence === 'daily') {
      recurBadge = `<span class="recur-badge">Daily</span>`;
    } else if (event.recurrence === 'monthly') {
      recurBadge = `<span class="recur-badge">Monthly</span>`;
    }
    
    card.innerHTML = `
      <button class="check-btn" aria-label="${event.done ? 'Mark as not done' : 'Mark as done'}" data-id="${event.id}">
        <svg class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
      <div class="event-content">
        <div class="${timeClass}">${timeText}${recurBadge}</div>
        <div class="event-body">
          <div class="event-title">${escapeHtml(event.title)}</div>
          ${event.note ? `<div class="event-note">${escapeHtml(event.note)}</div>` : ''}
        </div>
      </div>
    `;
    
    // Check button toggles done
    const checkBtn = card.querySelector('.check-btn');
    checkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDone(event.id);
    });
    
    // Rest of card opens edit
    card.addEventListener('click', () => openEditModal(event.id));
    
    eventsListEl.appendChild(card);
  });
}

function render() {
  renderDate();
  renderWeekStrip();
  renderEvents();
}

// ===== Done toggle =====
function toggleDone(id) {
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return;
  events[idx].done = !events[idx].done;
  saveEvents();
  render();
}

// ===== Modal =====
function openAddModal() {
  editingId = null;
  modalTitleEl.textContent = 'New Event';
  eventTitleInput.value = '';
  eventTimeInput.value = '';
  allDayCheckbox.checked = false;
  eventNoteInput.value = '';
  recurrenceSelect.value = 'none';
  deleteBtn.classList.add('hidden');
  eventTimeInput.disabled = false;
  
  modalEl.classList.remove('hidden');
  setTimeout(() => eventTitleInput.focus(), 80);
}

function openEditModal(id) {
  const event = events.find(e => e.id === id);
  if (!event) return;
  
  editingId = id;
  modalTitleEl.textContent = 'Edit Event';
  eventTitleInput.value = event.title;
  eventTimeInput.value = event.time || '';
  allDayCheckbox.checked = !!event.allDay;
  eventNoteInput.value = event.note || '';
  recurrenceSelect.value = event.recurrence || 'none';
  deleteBtn.classList.remove('hidden');
  eventTimeInput.disabled = allDayCheckbox.checked;
  
  modalEl.classList.remove('hidden');
  setTimeout(() => eventTitleInput.focus(), 80);
}

function closeModal() {
  modalEl.classList.add('hidden');
  editingId = null;
}

// ===== Actions =====
function handleSave(e) {
  e.preventDefault();
  
  const title = eventTitleInput.value.trim();
  if (!title) return;
  
  const allDay = allDayCheckbox.checked;
  const time = allDay ? null : (eventTimeInput.value || null);
  const note = eventNoteInput.value.trim() || null;
  const recurrence = recurrenceSelect.value || 'none';
  const dateKey = formatDateKey(currentDate);
  
  if (editingId) {
    const idx = events.findIndex(ev => ev.id === editingId);
    if (idx !== -1) {
      events[idx] = {
        ...events[idx],
        title,
        time,
        allDay,
        note,
        recurrence,
        date: dateKey
      };
    }
  } else {
    events.push({
      id: generateId(),
      title,
      time,
      allDay,
      note,
      recurrence,
      done: false,
      date: dateKey,
      createdAt: new Date().toISOString()
    });
  }
  
  saveEvents();
  closeModal();
  render();
}

function handleDelete() {
  if (!editingId) return;
  if (!confirm('Delete this event?')) return;
  
  events = events.filter(e => e.id !== editingId);
  saveEvents();
  closeModal();
  render();
}

function changeDay(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  render();
}

function goToToday() {
  currentDate = new Date();
  render();
}

// ===== Swipe =====
let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}

function handleTouchEnd(e) {
  const dx = e.changedTouches[0].screenX - touchStartX;
  const dy = e.changedTouches[0].screenY - touchStartY;
  
  if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
    if (dx > 0) changeDay(-1);
    else changeDay(1);
  }
}

// ===== Init =====
function init() {
  loadEvents();
  applyTheme(getPreferredTheme());
  render();
  
  document.getElementById('prevDay').addEventListener('click', () => changeDay(-1));
  document.getElementById('nextDay').addEventListener('click', () => changeDay(1));
  document.getElementById('todayBtn').addEventListener('click', goToToday);
  themeBtn.addEventListener('click', toggleTheme);
  document.getElementById('addBtn').addEventListener('click', openAddModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeModal);
  eventForm.addEventListener('submit', handleSave);
  deleteBtn.addEventListener('click', handleDelete);
  
  allDayCheckbox.addEventListener('change', () => {
    eventTimeInput.disabled = allDayCheckbox.checked;
    if (allDayCheckbox.checked) eventTimeInput.value = '';
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) {
      closeModal();
    }
  });
  
  const main = document.querySelector('.main');
  main.addEventListener('touchstart', handleTouchStart, { passive: true });
  main.addEventListener('touchend', handleTouchEnd, { passive: true });
}

init();
