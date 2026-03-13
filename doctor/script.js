/* =============================================================
  MediScribe — Doctor Portal Dashboard Script
  ============================================================= */

// API base path (merged into MedTrack server)
const API_BASE = '/api/doctor-panel';
const PAGE_BASE = '/doctor-panel';

// ---- Pick up token from URL (redirect from React login) ----
(function() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken) {
    sessionStorage.setItem('medidash_token', urlToken);
    // Clean the URL
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

// ---- Auth guard ----
if (!sessionStorage.getItem('medidash_token')) {
  window.location.href = PAGE_BASE + '/login.html';
}

let allPatients = [];
let enrichedPatients = [];
let currentPatientTab = 'all';
let currentSort = 'name';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  // Sync connected patients from MongoDB first
  await syncPatients();
  setGreeting();
  loadStats();
  loadAlerts();
  loadAppointments();
  loadPatients();
  loadGlance();
  loadSources();
  loadNotifications();

  // ===== SIDEBAR SECTION SWITCHING =====
  document.querySelectorAll('.menu-item[data-section]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.dataset.section;
      document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
      const target = document.querySelector(`.section-content[data-page="${section}"]`);
      if (target) target.style.display = '';

      // Load section-specific data on first visit
      if (section === 'patients') loadEnrichedPatients();
      if (section === 'alerts') loadAlertsPage();
      if (section === 'appointments') loadAppointmentsPage();
      if (section === 'sources') loadSourcesPage();
    });
  });

  // Search with live dropdown
  const searchInput = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => liveSearch(searchInput.value), 250);
  });
  searchInput.addEventListener('focus', () => { if (searchInput.value) liveSearch(searchInput.value); });
  document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) dropdown.hidden = true; });

  // Dark mode toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Notification bell
  document.getElementById('notif-btn').addEventListener('click', () => {
    const dd = document.getElementById('notif-dropdown');
    dd.hidden = !dd.hidden;
  });
  document.addEventListener('click', e => { if (!e.target.closest('#notif-wrap')) document.getElementById('notif-dropdown').hidden = true; });

  // Sign out
  document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = PAGE_BASE + '/login.html';
  });

  // Patient modal close
  document.getElementById('close-patient-modal').addEventListener('click', () => document.getElementById('patient-modal').hidden = true);
  document.getElementById('patient-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });

  // Export PDF
  document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

  // Status filter buttons (overview table)
  document.querySelectorAll('.source-tag[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-tag[data-filter]').forEach(b => b.classList.remove('source-tag--active'));
      btn.classList.add('source-tag--active');
      renderPatients(btn.dataset.filter);
    });
  });

  // ===== PATIENTS PAGE EVENT LISTENERS =====
  // Filter tabs
  document.querySelectorAll('.patients-tab[data-ptab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.patients-tab').forEach(t => t.classList.remove('patients-tab--active'));
      tab.classList.add('patients-tab--active');
      currentPatientTab = tab.dataset.ptab;
      renderPatientCards();
    });
  });

  // Search on patients page
  const pSearch = document.getElementById('patients-search');
  let pDebounce;
  pSearch.addEventListener('input', () => {
    clearTimeout(pDebounce);
    pDebounce = setTimeout(() => renderPatientCards(), 250);
  });

  // Filter dropdowns
  document.getElementById('filter-condition').addEventListener('change', () => renderPatientCards());
  document.getElementById('filter-status').addEventListener('change', () => renderPatientCards());
  document.getElementById('filter-risk').addEventListener('change', () => renderPatientCards());

  // Sort dropdown
  document.getElementById('sort-patients').addEventListener('change', e => {
    currentSort = e.target.value;
    renderPatientCards();
  });

  // Add Patient modal
  document.getElementById('btn-add-patient').addEventListener('click', () => {
    document.getElementById('add-patient-modal').hidden = false;
  });
  document.getElementById('close-add-patient').addEventListener('click', () => {
    document.getElementById('add-patient-modal').hidden = true;
  });
  document.getElementById('cancel-add-patient').addEventListener('click', () => {
    document.getElementById('add-patient-modal').hidden = true;
  });
  document.getElementById('add-patient-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
  });
  document.getElementById('add-patient-form').addEventListener('submit', handleAddPatient);

  // PWA (disabled — running as part of MedTrack)
  // if ('serviceWorker' in navigator) {
  //   navigator.serviceWorker.register('/sw.js').catch(() => {});
  // }
});

// ========== API ==========
function getToken() {
  return sessionStorage.getItem('medidash_token');
}

async function api(url, options = {}) {
  // Rewrite /api/ paths to use the doctor-panel API base
  if (url.startsWith('/api/')) url = API_BASE + url.slice(4);
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function syncPatients() {
  try {
    const token = getToken();
    if (!token) return;
    const res = await fetch(API_BASE + '/sync', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.doctor) sessionStorage.setItem('medidash_doctor', data.doctor);
      console.log(`Synced ${data.synced} connected patients, total: ${data.total}`);
    }
  } catch (err) {
    console.warn('Patient sync skipped:', err.message);
  }
}

// ========== TOAST ==========
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 3500);
}

// ========== THEME ==========
function initTheme() {
  const saved = localStorage.getItem('medidash-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('icon-sun').style.display = 'none';
    document.getElementById('icon-moon').style.display = 'block';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('medidash-theme', 'light');
    document.getElementById('icon-sun').style.display = 'block';
    document.getElementById('icon-moon').style.display = 'none';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('medidash-theme', 'dark');
    document.getElementById('icon-sun').style.display = 'none';
    document.getElementById('icon-moon').style.display = 'block';
  }
  toast(isDark ? 'Light mode enabled' : 'Dark mode enabled', 'info');
}

// ========== GREETING ==========
function setGreeting() {
  const doctor = sessionStorage.getItem('medidash_doctor') || 'Dr. Rivera';
  const hour = new Date().getHours();
  let greeting;
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';

  document.getElementById('greeting').textContent = `${greeting}, ${doctor}`;
  document.getElementById('greeting-sub').textContent = 'Quick overview of your patient panel and today\'s priorities.';
}

// ========== STATS ==========
async function loadStats() {
  const s = await api('/api/stats');
  if (!s) return;

  setStatValue('stat-patients', s.total_patients?.toLocaleString());
  setStatValue('stat-monitors', String(s.active_monitors));
  setStatValue('stat-alerts', String(s.critical_alerts));
  setStatValue('stat-sources', String(s.data_sources));
}

function setStatValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value || '—';
    el.classList.remove('skeleton-text');
  }
}

// ========== PATIENT ALERTS ==========
async function loadAlerts() {
  const alerts = await api('/api/alerts');
  const container = document.getElementById('alerts-list');
  const countBadge = document.getElementById('alerts-count');
  if (!container) return;

  countBadge.textContent = alerts.length;
  countBadge.className = 'badge ' + (alerts.some(a => a.severity === 'critical') ? 'badge-critical' : 'badge-warning');

  if (!alerts.length) {
    container.innerHTML = '<p class="empty-state">No active patient alerts</p>';
    return;
  }

  container.innerHTML = '';
  alerts.forEach(a => {
    const item = document.createElement('div');
    item.className = 'alert-item';
    item.innerHTML = `
      <span class="alert-severity ${escapeHtml(a.severity)}"></span>
      <div class="alert-body">
        <p class="alert-msg">${escapeHtml(a.message)}</p>
        <p class="alert-meta">${escapeHtml(a.patient_name)} · ${escapeHtml(a.source)} · ${escapeHtml(a.severity)}</p>
      </div>
    `;
    item.addEventListener('click', () => openPatientDetail(a.patient_id));
    container.appendChild(item);
  });
}

// ========== APPOINTMENTS ==========
function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${String(h > 12 ? h - 12 : h || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

async function loadAppointments() {
  const appts = await api('/api/appointments');
  const timeline = document.getElementById('timeline');
  if (!timeline) return;
  timeline.innerHTML = '';

  if (!appts.length) {
    timeline.innerHTML = '<p class="empty-state">No appointments today</p>';
    return;
  }

  appts.forEach(a => {
    const slot = document.createElement('div');
    slot.className = `slot${a.completed ? ' slot--done' : ''}`;
    slot.innerHTML = `
      <p class="time">${formatTime(a.time)}</p>
      <div>
        <p class="patient">${escapeHtml(a.patient_name)}</p>
        <p class="purpose">${escapeHtml(a.purpose || '')} ${a.primary_condition ? '· ' + escapeHtml(a.primary_condition) : ''}</p>
      </div>
      <div class="slot-actions">
        <span class="tag${a.priority ? ' warn' : ''}">${a.priority ? 'Priority' : escapeHtml(a.room || '')}</span>
        <button class="btn-done${a.completed ? ' btn-done--completed' : ''}" data-appt-id="${a.id}" title="${a.completed ? 'Mark undone' : 'Mark as done'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
    `;
    slot.querySelector('.btn-done').addEventListener('click', e => {
      e.stopPropagation();
      toggleAppointmentDone(a.id);
    });
    slot.addEventListener('click', () => openPatientDetail(a.patient_id));
    timeline.appendChild(slot);
  });
}

// ========== PATIENTS TABLE ==========
async function loadPatients(query) {
  const url = query ? `/api/patients?q=${encodeURIComponent(query)}` : '/api/patients';
  allPatients = await api(url);
  renderPatients('all');
}

function renderPatients(filter) {
  const tbody = document.getElementById('patients-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = filter === 'all' ? allPatients : allPatients.filter(p => p.status === filter);

  list.forEach(p => {
    const tr = document.createElement('tr');
    const statusCls = p.status === 'Critical' ? 'urgent' : p.status === 'Review' ? 'review' : 'stable';
    const date = p.last_visit ? new Date(p.last_visit + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    tr.innerHTML = `
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${p.age || '—'} / ${escapeHtml(p.gender || '—')}</td>
      <td>${escapeHtml(p.primary_condition || '')}</td>
      <td>${escapeHtml(p.blood_type || '—')}</td>
      <td><span class="pill ${statusCls}">${escapeHtml(p.status)}</span></td>
      <td>${date}</td>
      <td><button class="btn-view" data-id="${p.id}">View</button></td>
    `;
    tr.querySelector('.btn-view').addEventListener('click', e => {
      e.stopPropagation();
      openPatientDetail(p.id);
    });
    tr.addEventListener('click', () => openPatientDetail(p.id));
    tbody.appendChild(tr);
  });
}

// ========== LIVE SEARCH DROPDOWN ==========

// ========== ENRICHED PATIENTS PAGE ==========
async function loadEnrichedPatients() {
  enrichedPatients = await api('/api/patients/enriched') || [];

  // Populate condition filter dropdown
  const condSelect = document.getElementById('filter-condition');
  const conditions = [...new Set(enrichedPatients.map(p => p.primary_condition).filter(Boolean))].sort();
  condSelect.innerHTML = '<option value="">All Conditions</option>';
  conditions.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    condSelect.appendChild(opt);
  });

  document.getElementById('patients-total-badge').textContent = enrichedPatients.length;
  renderPatientCards();
}

function renderPatientCards() {
  const grid = document.getElementById('patients-grid');
  if (!grid) return;

  const query = (document.getElementById('patients-search').value || '').toLowerCase().trim();
  const condFilter = document.getElementById('filter-condition').value;
  const statusFilter = document.getElementById('filter-status').value;
  const riskFilter = document.getElementById('filter-risk').value;

  let list = [...enrichedPatients];

  // Apply tab filter
  if (currentPatientTab === 'high-risk') list = list.filter(p => p.risk === 'High');
  else if (currentPatientTab === 'active-monitors') list = list.filter(p => p.active_monitors > 0);
  else if (currentPatientTab === 'critical-alerts') list = list.filter(p => p.critical_alerts > 0);

  // Apply dropdown filters
  if (condFilter) list = list.filter(p => p.primary_condition === condFilter);
  if (statusFilter) list = list.filter(p => p.status === statusFilter);
  if (riskFilter) list = list.filter(p => p.risk === riskFilter);

  // Apply search
  if (query) list = list.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.primary_condition || '').toLowerCase().includes(query)
  );

  // Apply sort
  list.sort((a, b) => {
    if (currentSort === 'name') return a.name.localeCompare(b.name);
    if (currentSort === 'last_visit') return (b.last_visit || '').localeCompare(a.last_visit || '');
    if (currentSort === 'risk') {
      const order = { High: 0, Medium: 1, Low: 2 };
      return (order[a.risk] ?? 2) - (order[b.risk] ?? 2);
    }
    if (currentSort === 'condition') return (a.primary_condition || '').localeCompare(b.primary_condition || '');
    return 0;
  });

  if (!list.length) {
    grid.innerHTML = '<p class="empty-state">No patients match your filters</p>';
    return;
  }

  grid.innerHTML = '';
  list.forEach(p => {
    const initials = p.name.split(' ').map(w => w[0]).join('').substring(0, 2);
    const statusCls = p.status === 'Critical' ? 'urgent' : p.status === 'Review' ? 'review' : 'stable';
    const riskCls = p.risk === 'High' ? 'risk-high' : p.risk === 'Medium' ? 'risk-medium' : 'risk-low';
    const date = p.last_visit ? new Date(p.last_visit + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const appt = p.next_appointment
      ? `${new Date(p.next_appointment.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${escapeHtml(p.next_appointment.purpose || '')}`
      : 'None scheduled';

    const card = document.createElement('div');
    card.className = 'patient-card';
    card.innerHTML = `
      <div class="pc-top">
        <div class="pc-avatar">${escapeHtml(initials)}</div>
        <div class="pc-info">
          <h3 class="pc-name">${escapeHtml(p.name)}</h3>
          <p class="pc-meta">${p.age || '—'} · ${escapeHtml(p.gender || '—')} · ${escapeHtml(p.blood_type || '—')}</p>
        </div>
        <span class="risk-badge ${riskCls}">${escapeHtml(p.risk)}</span>
      </div>
      <div class="pc-details">
        <div class="pc-row">
          <span class="pc-label">Condition</span>
          <span class="pc-val">${escapeHtml(p.primary_condition || '—')}</span>
        </div>
        <div class="pc-row">
          <span class="pc-label">Status</span>
          <span class="pill ${statusCls}" style="font-size:.72rem;padding:2px 8px">${escapeHtml(p.status)}</span>
        </div>
        <div class="pc-row">
          <span class="pc-label">Last Visit</span>
          <span class="pc-val">${date}</span>
        </div>
        <div class="pc-row">
          <span class="pc-label">Next Appt</span>
          <span class="pc-val">${appt}</span>
        </div>
      </div>
      <div class="pc-bottom">
        <div class="pc-indicators">
          ${p.active_monitors > 0 ? `<span class="pc-monitor" title="${p.active_monitors} active monitors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> ${p.active_monitors}</span>` : ''}
          ${p.total_alerts > 0 ? `<span class="pc-alert-count" title="${p.total_alerts} active alerts"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${p.total_alerts}</span>` : ''}
          <span class="pc-sources">${p.data_sources.map(s => `<span class="data-source-badge ${s.toLowerCase()}">${escapeHtml(s === 'Radiology' ? 'RAD' : s)}</span>`).join('')}</span>
        </div>
        <button class="btn-view" data-id="${p.id}">View</button>
      </div>
    `;
    card.querySelector('.btn-view').addEventListener('click', e => {
      e.stopPropagation();
      openPatientDetail(p.id);
    });
    card.addEventListener('click', () => openPatientDetail(p.id));
    grid.appendChild(card);
  });
}

// ========== ADD PATIENT ==========
async function handleAddPatient(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById('ap-name').value.trim(),
    age: document.getElementById('ap-age').value,
    gender: document.getElementById('ap-gender').value,
    blood_type: document.getElementById('ap-blood').value,
    primary_condition: document.getElementById('ap-condition').value.trim(),
    status: document.getElementById('ap-status').value,
    smoking_status: document.getElementById('ap-smoking').value,
    allergies: document.getElementById('ap-allergies').value.trim(),
    medications: document.getElementById('ap-meds').value.trim(),
  };
  if (!body.name || !body.primary_condition) { toast('Name and condition are required', 'error'); return; }
  try {
    const hdrs = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) hdrs['Authorization'] = `Bearer ${token}`;
    const res = await fetch(API_BASE + '/patients', {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) { toast(data?.error || 'Failed to add patient', 'error'); return; }
    toast(`${data.name} added successfully`, 'success');
    document.getElementById('add-patient-form').reset();
    document.getElementById('add-patient-modal').hidden = true;
    loadEnrichedPatients();
    loadPatients();
    loadStats();
  } catch (err) {
    toast('Failed to add patient', 'error');
  }
}

// ========== SECTION PAGE LOADERS ==========
async function loadAlertsPage() {
  const alerts = await api('/api/alerts');
  const list = document.getElementById('alerts-page-list');
  const count = document.getElementById('alerts-page-count');
  if (!list) return;
  count.textContent = alerts.length;
  count.className = 'badge ' + (alerts.some(a => a.severity === 'critical') ? 'badge-critical' : 'badge-warning');
  if (!alerts.length) { list.innerHTML = '<p class="empty-state">No active patient alerts</p>'; return; }
  list.innerHTML = '';
  alerts.forEach(a => {
    const item = document.createElement('div');
    item.className = 'alert-item';
    item.innerHTML = `<span class="alert-severity ${escapeHtml(a.severity)}"></span><div class="alert-body"><p class="alert-msg">${escapeHtml(a.message)}</p><p class="alert-meta">${escapeHtml(a.patient_name)} · ${escapeHtml(a.source)} · ${escapeHtml(a.severity)}</p></div>`;
    item.addEventListener('click', () => openPatientDetail(a.patient_id));
    list.appendChild(item);
  });
}

async function loadAppointmentsPage() {
  const appts = await api('/api/appointments');
  const container = document.getElementById('appointments-page-list');
  if (!container) return;
  container.innerHTML = '';
  if (!appts.length) { container.innerHTML = '<p class="empty-state">No appointments today</p>'; return; }
  appts.forEach(a => {
    const slot = document.createElement('div');
    slot.className = `slot${a.completed ? ' slot--done' : ''}`;
    slot.innerHTML = `
      <p class="time">${formatTime(a.time)}</p>
      <div>
        <p class="patient">${escapeHtml(a.patient_name)}</p>
        <p class="purpose">${escapeHtml(a.purpose || '')} ${a.primary_condition ? '· ' + escapeHtml(a.primary_condition) : ''}</p>
      </div>
      <div class="slot-actions">
        <span class="tag${a.priority ? ' warn' : ''}">${a.priority ? 'Priority' : escapeHtml(a.room || '')}</span>
        <button class="btn-done${a.completed ? ' btn-done--completed' : ''}" data-appt-id="${a.id}" title="${a.completed ? 'Mark undone' : 'Mark as done'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
    `;
    slot.querySelector('.btn-done').addEventListener('click', e => {
      e.stopPropagation();
      toggleAppointmentDone(a.id, 'page');
    });
    slot.addEventListener('click', () => openPatientDetail(a.patient_id));
    container.appendChild(slot);
  });
}

async function toggleAppointmentDone(id, source) {
  try {
    const res = await fetch(`${API_BASE}/appointments/${id}/done`, { method: 'PATCH' });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) { toast(data?.error || 'Failed to update', 'error'); return; }
    toast(data.completed ? 'Appointment marked as done' : 'Appointment marked undone', 'success');
    loadAppointments();
    if (source === 'page') loadAppointmentsPage();
  } catch { toast('Failed to update appointment', 'error'); }
}

let currentSourceType = null;
let sourcesPageInitialized = false;

async function loadSourcesPage() {
  const data = await api('/api/sources');
  const grid = document.getElementById('sources-page-grid');
  if (!grid || !data.sources) return;
  grid.innerHTML = '';
  const icons = {
    EHR: { bg: '#e8f8f5', color: '#0d8a7b', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    Lab: { bg: '#eef0ff', color: '#5b6aef', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6v7l4 9H5l4-9V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg>' },
    Radiology: { bg: '#fff5e6', color: '#e8a020', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>' },
    Wearable: { bg: '#f3e8ff', color: '#8b5cf6', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  };
  data.sources.forEach(s => {
    const ic = icons[s.type] || icons.EHR;
    const card = document.createElement('div');
    card.className = `source-card${currentSourceType === s.type ? ' source-card--active' : ''}`;
    card.innerHTML = `<div class="sc-icon" style="background:${ic.bg};color:${ic.color}">${ic.svg}</div><p class="sc-name">${escapeHtml(s.name)}</p><p class="sc-count">${s.count} records</p><span class="sc-status"><span class="sc-dot"></span>${escapeHtml(s.status)}</span>`;
    card.addEventListener('click', () => openSourceDetail(s.type, s.name));
    card.style.cursor = 'pointer';
    grid.appendChild(card);
  });

  if (!sourcesPageInitialized) {
    sourcesPageInitialized = true;
    document.getElementById('btn-add-record').addEventListener('click', () => openAddRecordModal());
    document.getElementById('close-add-record').addEventListener('click', () => { document.getElementById('add-record-modal').hidden = true; });
    document.getElementById('cancel-add-record').addEventListener('click', () => { document.getElementById('add-record-modal').hidden = true; });
    document.getElementById('add-record-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
    document.getElementById('add-record-form').addEventListener('submit', handleAddRecord);
  }
}

async function openSourceDetail(type, name) {
  currentSourceType = type;
  const section = document.getElementById('source-detail-section');
  const title = document.getElementById('source-detail-title');
  const count = document.getElementById('source-detail-count');
  const body = document.getElementById('source-detail-body');
  section.style.display = '';

  // Highlight active card
  document.querySelectorAll('#sources-page-grid .source-card').forEach(c => c.classList.remove('source-card--active'));
  event.currentTarget?.classList?.add('source-card--active');

  title.textContent = name + ' — Records';
  body.innerHTML = '<p class="empty-state">Loading...</p>';

  const typeMap = { EHR: 'ehr', Lab: 'lab', Radiology: 'radiology', Wearable: 'wearable' };
  const records = await api(`/api/sources/${typeMap[type]}`);
  count.textContent = records.length;

  if (!records.length) {
    body.innerHTML = '<p class="empty-state">No records found</p>';
    return;
  }

  if (type === 'EHR') {
    body.innerHTML = `<div class="table-wrap"><table class="source-table">
      <thead><tr><th>Patient</th><th>HR</th><th>BP</th><th>SpO2</th><th>Temp</th><th>Resp</th><th>Recorded</th></tr></thead>
      <tbody>${records.map(r => `<tr>
        <td><strong>${escapeHtml(r.patient_name)}</strong></td>
        <td>${r.heart_rate ?? '—'} bpm</td>
        <td>${r.systolic ?? '—'}/${r.diastolic ?? '—'}</td>
        <td>${r.spo2 ?? '—'}%</td>
        <td>${r.temperature ?? '—'}°F</td>
        <td>${r.resp_rate ?? '—'}/min</td>
        <td>${r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } else if (type === 'Lab') {
    body.innerHTML = `<div class="table-wrap"><table class="source-table">
      <thead><tr><th>Patient</th><th>Test</th><th>Value</th><th>Reference</th><th>Flag</th><th>Date</th></tr></thead>
      <tbody>${records.map(r => `<tr>
        <td><strong>${escapeHtml(r.patient_name)}</strong></td>
        <td>${escapeHtml(r.test_name)}</td>
        <td>${r.value ?? '—'} ${escapeHtml(r.unit || '')}</td>
        <td>${r.ref_low ?? '—'} – ${r.ref_high ?? '—'} ${escapeHtml(r.unit || '')}</td>
        <td><span class="lab-flag ${escapeHtml(r.flag || 'normal')}">${escapeHtml(r.flag || 'normal')}</span></td>
        <td>${r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  } else if (type === 'Radiology') {
    body.innerHTML = `<div class="source-imaging-grid">${records.map(r => `
      <div class="imaging-card">
        <div class="img-head">
          <span class="img-modality"><span class="data-source-badge radiology">${escapeHtml(r.modality)}</span> ${escapeHtml(r.body_part || '')}</span>
          <span class="img-date">${r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</span>
        </div>
        <p class="img-patient"><strong>${escapeHtml(r.patient_name)}</strong></p>
        <p class="img-finding"><strong>Finding:</strong> ${escapeHtml(r.finding || 'N/A')}</p>
        <p class="img-impression"><strong>Impression:</strong> ${escapeHtml(r.impression || 'N/A')}</p>
        <span class="pill ${r.status === 'Final' ? 'stable' : 'review'}" style="margin-top:6px">${escapeHtml(r.status || 'Final')}</span>
      </div>
    `).join('')}</div>`;
  } else if (type === 'Wearable') {
    body.innerHTML = `<div class="table-wrap"><table class="source-table">
      <thead><tr><th>Patient</th><th>Metric</th><th>Value</th><th>Recorded</th></tr></thead>
      <tbody>${records.map(r => `<tr>
        <td><strong>${escapeHtml(r.patient_name)}</strong></td>
        <td>${escapeHtml(r.metric.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()))}</td>
        <td>${r.value ?? '—'}</td>
        <td>${r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openAddRecordModal() {
  if (!currentSourceType) return;
  const modal = document.getElementById('add-record-modal');
  const title = document.getElementById('add-record-title');
  const fields = document.getElementById('ar-fields');
  const patientSelect = document.getElementById('ar-patient');

  // Load patients for dropdown
  const patients = await api('/api/patients');
  patientSelect.innerHTML = '<option value="">Select patient...</option>';
  patients.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (#${p.id})`;
    patientSelect.appendChild(opt);
  });

  if (currentSourceType === 'EHR') {
    title.textContent = 'Add EHR Vitals Record';
    fields.innerHTML = `
      <div class="form-row"><div class="form-group"><label>Heart Rate (bpm)</label><input type="number" id="ar-hr" min="0" max="300" /></div><div class="form-group"><label>Resp Rate (/min)</label><input type="number" id="ar-resp" min="0" max="100" /></div></div>
      <div class="form-row"><div class="form-group"><label>Systolic BP</label><input type="number" id="ar-sys" min="0" max="300" /></div><div class="form-group"><label>Diastolic BP</label><input type="number" id="ar-dia" min="0" max="300" /></div></div>
      <div class="form-row"><div class="form-group"><label>SpO2 (%)</label><input type="number" id="ar-spo2" min="0" max="100" step="0.1" /></div><div class="form-group"><label>Temperature (°F)</label><input type="number" id="ar-temp" min="90" max="110" step="0.1" /></div></div>
    `;
  } else if (currentSourceType === 'Lab') {
    title.textContent = 'Add Lab Result';
    fields.innerHTML = `
      <div class="form-group"><label>Test Name *</label><input type="text" id="ar-test" required /></div>
      <div class="form-row"><div class="form-group"><label>Value</label><input type="number" id="ar-val" step="0.01" /></div><div class="form-group"><label>Unit</label><input type="text" id="ar-unit" placeholder="e.g. mg/dL" /></div></div>
      <div class="form-row"><div class="form-group"><label>Ref Low</label><input type="number" id="ar-reflow" step="0.01" /></div><div class="form-group"><label>Ref High</label><input type="number" id="ar-refhigh" step="0.01" /></div></div>
      <div class="form-group"><label>Flag</label><select id="ar-flag"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option><option value="critical">Critical</option></select></div>
    `;
  } else if (currentSourceType === 'Radiology') {
    title.textContent = 'Add Radiology Report';
    fields.innerHTML = `
      <div class="form-row"><div class="form-group"><label>Modality *</label><select id="ar-modality" required><option value="">Select...</option><option>X-Ray</option><option>CT</option><option>MRI</option><option>Ultrasound</option><option>PET</option></select></div><div class="form-group"><label>Body Part</label><input type="text" id="ar-bodypart" placeholder="e.g. Chest" /></div></div>
      <div class="form-group"><label>Finding</label><textarea id="ar-finding" rows="2"></textarea></div>
      <div class="form-group"><label>Impression</label><textarea id="ar-impression" rows="2"></textarea></div>
      <div class="form-group"><label>Status</label><select id="ar-imgstatus"><option value="Final">Final</option><option value="Preliminary">Preliminary</option></select></div>
    `;
  } else if (currentSourceType === 'Wearable') {
    title.textContent = 'Add Wearable Data';
    fields.innerHTML = `
      <div class="form-row"><div class="form-group"><label>Metric *</label><select id="ar-metric" required><option value="">Select...</option><option value="heart_rate">Heart Rate</option><option value="spo2">SpO2</option><option value="glucose">Glucose</option><option value="weight">Weight</option><option value="steps">Steps</option><option value="sleep_hours">Sleep Hours</option></select></div><div class="form-group"><label>Value *</label><input type="number" id="ar-wval" step="0.01" required /></div></div>
    `;
  }

  modal.hidden = false;
}

async function handleAddRecord(e) {
  e.preventDefault();
  const patientId = document.getElementById('ar-patient').value;
  if (!patientId) { toast('Please select a patient', 'error'); return; }

  let url, body;
  if (currentSourceType === 'EHR') {
    url = API_BASE + '/sources/ehr';
    body = {
      patient_id: patientId,
      heart_rate: document.getElementById('ar-hr').value || null,
      systolic: document.getElementById('ar-sys').value || null,
      diastolic: document.getElementById('ar-dia').value || null,
      spo2: document.getElementById('ar-spo2').value || null,
      temperature: document.getElementById('ar-temp').value || null,
      resp_rate: document.getElementById('ar-resp').value || null,
    };
  } else if (currentSourceType === 'Lab') {
    const testName = document.getElementById('ar-test').value.trim();
    if (!testName) { toast('Test name is required', 'error'); return; }
    url = API_BASE + '/sources/lab';
    body = {
      patient_id: patientId,
      test_name: testName,
      value: document.getElementById('ar-val').value || null,
      unit: document.getElementById('ar-unit').value.trim() || null,
      ref_low: document.getElementById('ar-reflow').value || null,
      ref_high: document.getElementById('ar-refhigh').value || null,
      flag: document.getElementById('ar-flag').value,
    };
  } else if (currentSourceType === 'Radiology') {
    const modality = document.getElementById('ar-modality').value;
    if (!modality) { toast('Modality is required', 'error'); return; }
    url = API_BASE + '/sources/radiology';
    body = {
      patient_id: patientId,
      modality: modality,
      body_part: document.getElementById('ar-bodypart').value.trim() || null,
      finding: document.getElementById('ar-finding').value.trim() || null,
      impression: document.getElementById('ar-impression').value.trim() || null,
      status: document.getElementById('ar-imgstatus').value,
    };
  } else if (currentSourceType === 'Wearable') {
    const metric = document.getElementById('ar-metric').value;
    const val = document.getElementById('ar-wval').value;
    if (!metric || !val) { toast('Metric and value are required', 'error'); return; }
    url = API_BASE + '/sources/wearable';
    body = { patient_id: patientId, metric, value: val };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) { toast(data?.error || 'Failed to add record', 'error'); return; }
    toast('Record added successfully', 'success');
    document.getElementById('add-record-form').reset();
    document.getElementById('add-record-modal').hidden = true;
    // Refresh the detail view and source counts
    const nameMap = { EHR: 'Electronic Health Records', Lab: 'Laboratory Systems', Radiology: 'Radiology / Imaging', Wearable: 'Wearable Devices' };
    openSourceDetail(currentSourceType, nameMap[currentSourceType]);
    loadSourcesPage();
  } catch {
    toast('Failed to add record', 'error');
  }
}
async function liveSearch(query) {
  const dropdown = document.getElementById('search-dropdown');
  if (!query.trim()) { dropdown.hidden = true; return; }

  const patients = await api(`/api/patients?q=${encodeURIComponent(query)}`);
  dropdown.innerHTML = '';

  if (!patients.length) {
    dropdown.innerHTML = '<div class="no-results">No patients found</div>';
  } else {
    patients.slice(0, 6).forEach(p => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.innerHTML = `<span class="s-name">${escapeHtml(p.name)}</span><span class="s-cond">${escapeHtml(p.primary_condition || '')}</span>`;
      item.addEventListener('click', () => {
        dropdown.hidden = true;
        openPatientDetail(p.id);
      });
      dropdown.appendChild(item);
    });
  }
  dropdown.hidden = false;
}

// ========== SIDEBAR GLANCE ==========
async function loadGlance() {
  const g = await api('/api/glance');
  const card = document.querySelector('.sidebar-card');
  if (!card) return;
  const valEl = card.querySelector('.sidebar-card-value');
  const metaEl = card.querySelector('.sidebar-card-meta');
  valEl.textContent = g.today_patients + ' patients today';
  valEl.classList.remove('skeleton-text');
  metaEl.textContent = g.critical_alerts + ' critical alerts need review';
  metaEl.classList.remove('skeleton-text');
}

// ========== DATA SOURCES ==========
async function loadSources() {
  const data = await api('/api/sources');
  const grid = document.getElementById('sources-grid');
  if (!grid || !data.sources) return;
  grid.innerHTML = '';

  const icons = {
    EHR: { bg: '#e8f8f5', color: '#0d8a7b', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' },
    Lab: { bg: '#eef0ff', color: '#5b6aef', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6v7l4 9H5l4-9V3z"/><line x1="9" y1="3" x2="15" y2="3"/></svg>' },
    Radiology: { bg: '#fff5e6', color: '#e8a020', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>' },
    Wearable: { bg: '#f3e8ff', color: '#8b5cf6', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
  };

  data.sources.forEach(s => {
    const ic = icons[s.type] || icons.EHR;
    const card = document.createElement('div');
    card.className = 'source-card';
    card.innerHTML = `
      <div class="sc-icon" style="background:${ic.bg};color:${ic.color}">${ic.svg}</div>
      <p class="sc-name">${escapeHtml(s.name)}</p>
      <p class="sc-count">${s.count} records</p>
      <span class="sc-status"><span class="sc-dot"></span>${escapeHtml(s.status)}</span>
    `;
    grid.appendChild(card);
  });
}

// ========== NOTIFICATIONS (from alerts) ==========
async function loadNotifications() {
  const alerts = await api('/api/alerts');
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');
  list.innerHTML = '';

  const critical = alerts.filter(a => a.severity === 'critical');
  badge.textContent = critical.length;
  badge.style.display = critical.length ? 'grid' : 'none';

  if (!alerts.length) {
    list.innerHTML = '<div class="notif-item">No active patient alerts</div>';
    return;
  }

  alerts.slice(0, 6).forEach(a => {
    const item = document.createElement('div');
    item.className = `notif-item${a.severity === 'critical' ? ' unread' : ''}`;
    item.innerHTML = `<div>${escapeHtml(a.message)}</div><div class="n-time">${escapeHtml(a.patient_name)} · ${escapeHtml(a.source)}</div>`;
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      document.getElementById('notif-dropdown').hidden = true;
      openPatientDetail(a.patient_id);
    });
    list.appendChild(item);
  });
}

// ========== PATIENT DETAIL MODAL (Multi-Source View) ==========
let wearableChart = null;

async function openPatientDetail(id) {
  const data = await api(`/api/patients/${id}/profile`);
  if (!data || data.error) { toast('Patient not found', 'error'); return; }

  const { patient: p, vitals, labs, images, timeline, wearable, alerts } = data;
  const body = document.getElementById('patient-modal-body');

  const statusCls = p.status === 'Critical' ? 'urgent' : p.status === 'Review' ? 'review' : 'stable';
  const initials = p.name.split(' ').map(w => w[0]).join('').substring(0, 2);

  // Allergies & Medications
  const allergies = p.allergies ? p.allergies.split(',').map(a => a.trim()) : [];
  const meds = p.medications ? p.medications.split(',').map(m => m.trim()) : [];

  // Latest vitals (first from EHR, first from Wearable)
  const latestVitals = vitals.length ? vitals[0] : null;

  body.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${escapeHtml(initials)}</div>
      <div class="profile-info">
        <h2>${escapeHtml(p.name)}</h2>
        <p class="profile-meta">${p.age}${p.gender ? ' · ' + escapeHtml(p.gender) : ''} · Blood: ${escapeHtml(p.blood_type || 'N/A')} · ID #${p.id}</p>
        <div class="profile-tags">
          <span class="data-source-badge ehr">EHR</span>
          <span class="data-source-badge lab">LAB</span>
          <span class="data-source-badge radiology">RAD</span>
          <span class="data-source-badge wearable">WEARABLE</span>
        </div>
      </div>
      <span class="profile-status pill ${statusCls}">${escapeHtml(p.status)}</span>
    </div>

    <div class="profile-tabs">
      <button class="profile-tab active" data-tab="overview">Overview</button>
      <button class="profile-tab" data-tab="labs">Lab Results</button>
      <button class="profile-tab" data-tab="imaging">Imaging</button>
      <button class="profile-tab" data-tab="timeline">Timeline</button>
      <button class="profile-tab" data-tab="wearable">Wearable</button>
    </div>

    <!-- Overview Tab -->
    <div class="tab-content active" id="tab-overview">
      <h3 style="font:600 1rem 'Syne',sans-serif;margin:0 0 10px;">Primary Condition</h3>
      <p style="margin:0 0 16px;color:var(--muted);">${escapeHtml(p.primary_condition || 'N/A')} · Smoking: ${escapeHtml(p.smoking_status || 'N/A')}</p>

      ${latestVitals ? `
      <h3 style="font:600 1rem 'Syne',sans-serif;margin:0 0 10px;">Latest Vitals <span class="data-source-badge ${latestVitals.source.toLowerCase()}" style="margin-left:6px;">${escapeHtml(latestVitals.source)}</span></h3>
      <div class="vitals-grid">
        <div class="vital-card"><p class="v-label">Heart Rate</p><p class="v-value">${latestVitals.heart_rate} bpm</p></div>
        <div class="vital-card"><p class="v-label">Blood Pressure</p><p class="v-value">${latestVitals.systolic}/${latestVitals.diastolic}</p></div>
        <div class="vital-card"><p class="v-label">SpO2</p><p class="v-value">${latestVitals.spo2}%</p></div>
        <div class="vital-card"><p class="v-label">Temperature</p><p class="v-value">${latestVitals.temperature}°F</p></div>
        <div class="vital-card"><p class="v-label">Resp Rate</p><p class="v-value">${latestVitals.resp_rate}/min</p></div>
        <div class="vital-card"><p class="v-label">Recorded</p><p class="v-value" style="font-size:.85rem">${new Date(latestVitals.recorded_at).toLocaleDateString()}</p></div>
      </div>
      ` : '<p class="empty-state">No vitals recorded</p>'}

      ${allergies.length ? `
      <h3 style="font:600 1rem 'Syne',sans-serif;margin:0 0 6px;">Allergies</h3>
      <div class="allergy-list">${allergies.map(a => `<span class="allergy-chip">${escapeHtml(a)}</span>`).join('')}</div>
      ` : ''}

      ${meds.length ? `
      <h3 style="font:600 1rem 'Syne',sans-serif;margin:16px 0 6px;">Medications</h3>
      <div class="med-list">${meds.map(m => `<span class="med-chip">${escapeHtml(m)}</span>`).join('')}</div>
      ` : ''}

      ${alerts.length ? `
      <h3 style="font:600 1rem 'Syne',sans-serif;margin:16px 0 8px;">Active Alerts</h3>
      ${alerts.map(a => `<div class="alert-item"><span class="alert-severity ${escapeHtml(a.severity)}"></span><div class="alert-body"><p class="alert-msg">${escapeHtml(a.message)}</p><p class="alert-meta">${escapeHtml(a.source)} · ${escapeHtml(a.severity)}</p></div></div>`).join('')}
      ` : ''}
    </div>

    <!-- Labs Tab -->
    <div class="tab-content" id="tab-labs">
      ${labs.length ? `
      <table class="lab-table">
        <thead><tr><th>Test</th><th>Value</th><th>Reference Range</th><th>Flag</th><th>Date</th></tr></thead>
        <tbody>
          ${labs.map(l => `<tr>
            <td>${escapeHtml(l.test_name)}</td>
            <td><strong>${l.value} ${escapeHtml(l.unit)}</strong></td>
            <td>${l.ref_low}–${l.ref_high} ${escapeHtml(l.unit)}</td>
            <td><span class="lab-flag ${escapeHtml(l.flag)}">${escapeHtml(l.flag)}</span></td>
            <td>${new Date(l.recorded_at).toLocaleDateString()}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ` : '<p class="empty-state">No lab results</p>'}
    </div>

    <!-- Imaging Tab -->
    <div class="tab-content" id="tab-imaging">
      ${images.length ? `
      <div class="imaging-list">
        ${images.map(img => `
        <div class="imaging-card">
          <div class="img-head">
            <span class="img-modality"><span class="data-source-badge radiology">${escapeHtml(img.modality)}</span> ${escapeHtml(img.body_part)}</span>
            <span class="img-date">${new Date(img.recorded_at).toLocaleDateString()}</span>
          </div>
          <p class="img-finding"><strong>Finding:</strong> ${escapeHtml(img.finding)}</p>
          <p class="img-impression"><strong>Impression:</strong> ${escapeHtml(img.impression)}</p>
          <span class="pill ${img.status === 'Final' ? 'stable' : 'review'}" style="margin-top:6px;">${escapeHtml(img.status)}</span>
        </div>
        `).join('')}
      </div>
      ` : '<p class="empty-state">No imaging studies</p>'}
    </div>

    <!-- Timeline Tab -->
    <div class="tab-content" id="tab-timeline">
      ${timeline.length ? `
      <div class="clinical-timeline">
        ${timeline.map(t => `
        <div class="tl-item tl-${escapeHtml(t.source.toLowerCase())}">
          <p class="tl-date">${new Date(t.event_date).toLocaleDateString()} · <span class="data-source-badge ${t.source.toLowerCase()}">${escapeHtml(t.source)}</span></p>
          <p class="tl-title">${escapeHtml(t.title)}</p>
          <p class="tl-detail">${escapeHtml(t.detail)}</p>
        </div>
        `).join('')}
      </div>
      ` : '<p class="empty-state">No timeline events</p>'}
    </div>

    <!-- Wearable Tab -->
    <div class="tab-content" id="tab-wearable">
      ${wearable.length ? `
      <div class="wearable-chart-wrap">
        <canvas id="wearableChartCanvas" height="200"></canvas>
      </div>
      <p style="margin-top:10px;font-size:.85rem;color:var(--muted);">${wearable.length} data points from wearable devices</p>
      ` : '<p class="empty-state">No wearable data</p>'}
    </div>
  `;

  // Tab switching
  body.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      body.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      body.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      body.querySelector(`#tab-${tab.dataset.tab}`).classList.add('active');

      // Render wearable chart on tab switch
      if (tab.dataset.tab === 'wearable' && wearable.length) {
        setTimeout(() => renderWearableChart(wearable), 50);
      }
    });
  });

  document.getElementById('patient-modal').hidden = false;
}

// ========== WEARABLE CHART ==========
function renderWearableChart(wearable) {
  const canvas = document.getElementById('wearableChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (wearableChart) wearableChart.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#8aafb5' : '#4d6e74';

  // Group by metric
  const metrics = {};
  wearable.forEach(w => {
    if (!metrics[w.metric]) metrics[w.metric] = [];
    metrics[w.metric].push(w);
  });

  const colors = {
    heart_rate: isDark ? '#2ee8c8' : '#0d8a7b',
    spo2: isDark ? '#8b96ff' : '#5b6aef',
    glucose: isDark ? '#ffc040' : '#e8a020',
    weight: isDark ? '#ff6b7f' : '#e44a5f',
  };

  const datasets = Object.entries(metrics).map(([metric, points]) => ({
    label: metric.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    data: points.map(p => ({ x: new Date(p.recorded_at).toLocaleDateString(), y: p.value })),
    borderColor: colors[metric] || (isDark ? '#2ee8c8' : '#0d8a7b'),
    backgroundColor: 'transparent',
    borderWidth: 2,
    tension: 0.4,
    pointRadius: 3,
  }));

  // Use labels from the metric with most points
  const maxPoints = Object.values(metrics).reduce((a, b) => a.length > b.length ? a : b);
  const labels = maxPoints.map(p => new Date(p.recorded_at).toLocaleDateString());

  wearableChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: textColor, usePointStyle: true } },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor } },
      },
    },
  });
}

// ========== PDF EXPORT ==========
function exportPDF() {
  toast('Generating PDF report...', 'info');
  const w = window.open('', '_blank');
  const doctor = sessionStorage.getItem('medidash_doctor') || 'Dr. Rivera';
  w.document.write(`
    <!DOCTYPE html><html><head><title>MediDash Clinical Report</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;color:#13343a}
      h1{color:#0d8a7b;border-bottom:2px solid #0d8a7b;padding-bottom:10px}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th,td{padding:10px;border:1px solid #ddd;text-align:left}
      th{background:#f0f9f7}
      .meta{color:#666;margin-bottom:20px}
      .footer{margin-top:40px;font-size:.85rem;color:#999;border-top:1px solid #ddd;padding-top:10px}
      .critical{color:#e44a5f;font-weight:700}
      .review-status{color:#9f6a10;font-weight:700}
    </style></head><body>
    <h1>MediDash — Clinical Decision Support Report</h1>
    <p class="meta">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} by ${escapeHtml(doctor)}</p>
    <p>Loading data...</p>
    <div class="footer">MediDash Clinical Decision Support — Confidential Medical Report</div>
    </body></html>
  `);

  api('/api/patients').then(patients => {
    const table = `<table><thead><tr><th>Name</th><th>Age</th><th>Condition</th><th>Blood Type</th><th>Status</th><th>Last Visit</th></tr></thead><tbody>${
      patients.map(p => {
        const cls = p.status === 'Critical' ? ' class="critical"' : p.status === 'Review' ? ' class="review-status"' : '';
        return `<tr><td>${escapeHtml(p.name)}</td><td>${p.age || '—'}</td><td>${escapeHtml(p.primary_condition||'')}</td><td>${escapeHtml(p.blood_type||'—')}</td><td${cls}>${escapeHtml(p.status)}</td><td>${p.last_visit||'—'}</td></tr>`;
      }).join('')
    }</tbody></table>`;
    const body = w.document.querySelector('body');
    body.querySelector('p:not(.meta)').innerHTML = `<strong>Total Patients:</strong> ${patients.length} &nbsp;|&nbsp; <strong>Data Sources:</strong> EHR, Lab, Radiology, Wearable` + table;
    setTimeout(() => { w.print(); }, 500);
  });
}

// ========== UTILITY ==========
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
