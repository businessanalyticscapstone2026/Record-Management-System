const C = {
  primary: '#2563EB',
  primaryMid: '#3B82F6',
  primaryFade: 'rgba(37,99,235,0.12)',
  green: '#059669',
  greenFade: 'rgba(5,150,105,0.1)',
  red: '#E11D48',
  redFade: 'rgba(225,29,72,0.08)',
  amber: '#D97706',
  amberFade: 'rgba(217,119,6,0.12)',
  purple: '#6B5BD1',
  purpleFade: 'rgba(107,91,209,0.1)',
  teal: '#0D8C8C',
  rose: '#E11D48',
  grid: 'rgba(226,232,240,0.7)',
  text: '#64748B',
  tooltip: 'rgba(15,23,42,0.94)',
};
if (typeof Chart !== 'undefined') {
  try {
    Chart.defaults.font.family = "'Space Grotesk', system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = C.text;
  } catch (_err) { /* chart defaults are non-critical */ }
}   

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* Analytics data bootstrap */
const ANALYTICS_DATA = {
  Admin: {
    scopeLabel: 'Admin Scope',
    title: 'Analytics',
    subtitle: 'Municipality-wide data visualizations and performance insights',
    totalApplications: 0,
    pending: 0,
    inReview: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    idsIssued: 0,
    submitted: [],
    approvedMonthly: [],
    rejectedMonthly: [],
    barangayLabels: [],
    barangayTotal: [],
    barangayApproved: [],
    barangayPending: [],
    statusDenominator: 0,
    issuance: [],
    processing: [],
    ageDistribution: []
  },
  Staff: {
    scopeLabel: 'Staff Scope',
    title: 'Staff Analytics',
    subtitle: 'Assigned queue, review workload, and daily processing performance',
    totalApplications: 0,
    pending: 0,
    inReview: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    idsIssued: 0,
    submitted: [],
    approvedMonthly: [],
    rejectedMonthly: [],
    barangayLabels: [],
    barangayTotal: [],
    barangayApproved: [],
    barangayPending: [],
    statusDenominator: 0,
    issuance: [],
    processing: [],
    ageDistribution: []
  },
  'ID Maker': {
    scopeLabel: 'ID Maker Scope',
    title: 'Print & Issuance Analytics',
    subtitle: 'Print queue, issuance throughput, and ID production insights',
    totalApplications: 0,
    pending: 0,
    inReview: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    idsIssued: 0,
    submitted: [],
    approvedMonthly: [],
    rejectedMonthly: [],
    barangayLabels: [],
    barangayTotal: [],
    barangayApproved: [],
    barangayPending: [],
    statusDenominator: 0,
    issuance: [],
    processing: [],
    ageDistribution: []
  }
};
const SUBMITTED = ANALYTICS_DATA.Admin.submitted;
const APPROVED = ANALYTICS_DATA.Admin.approvedMonthly;
const REJECTED = ANALYTICS_DATA.Admin.rejectedMonthly;
const BRGY_LBL = ANALYTICS_DATA.Admin.barangayLabels;
const BRGY_TOT = ANALYTICS_DATA.Admin.barangayTotal;
const BRGY_APR = ANALYTICS_DATA.Admin.barangayApproved;
const BRGY_PND = ANALYTICS_DATA.Admin.barangayPending;
const CHARTS = {};


function analyticsScope() {
  return ANALYTICS_DATA[CURRENT_ROLE] || ANALYTICS_DATA.Staff;
}

const SCALE = {
  x: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.text } },
  y: { grid: { color: C.grid, drawBorder: false }, ticks: { color: C.text, precision: 0, stepSize: 1, callback: v => Number.isInteger(v) ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : null } }
};
const TIP = { backgroundColor: C.tooltip, padding: 12, cornerRadius: 10, titleFont: { weight: '700', size: 12 }, bodyFont: { size: 11 } };

function mkCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  if (typeof Chart === 'undefined') {
    canvas.closest('.chart-wrap')?.classList.add('chart-wrap--unavailable');
    return null;
  }
  // Dispose any existing chart bound to this canvas. Chart.js v4 exposes
  // getChart(element), which is authoritative even if CHARTS lost the entry
  // (e.g. re-init from a role switch) — prevents "Canvas is already in use".
  canvas.closest('.chart-wrap')?.classList.remove('chart-wrap--unavailable');
  const existing = CHARTS[id] || Chart.getChart(canvas);
  if (existing) { existing.destroy(); }
  delete CHARTS[id];
  return canvas;
}

function initTrend() {
  const ctx = mkCanvas('chart-trend'); if (!ctx) return;
  const data = analyticsScope();
  CHARTS['trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MONTHS, datasets: [
        { label: 'Submitted', data: data.submitted, borderColor: C.primary, backgroundColor: C.primaryFade, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: C.primary, pointHoverRadius: 7, fill: true, tension: 0.42 },
        { label: 'Approved', data: data.approvedMonthly, borderColor: C.green, backgroundColor: C.greenFade, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: C.green, pointHoverRadius: 7, fill: true, tension: 0.42 },
        { label: 'Rejected', data: data.rejectedMonthly, borderColor: C.red, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: C.red, pointHoverRadius: 5, fill: false, tension: 0.42, borderDash: [5, 4] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toLocaleString()}` } } }, scales: SCALE }
  });
}
function compactNum(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

function initStatus() {
  const ctx = mkCanvas('chart-status'); if (!ctx) return;
  const data = analyticsScope();
  const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = compactNum(val); };
  const statuses = [
    { key: 'approved', value: Number(data.approved) || 0 },
    { key: 'pending', value: Number(data.pending) || 0 },
    { key: 'review', value: Number(data.inReview) || 0 },
    { key: 'rejected', value: Number(data.rejected) || 0 }
  ];
  const statusSum = statuses.reduce((total, status) => total + status.value, 0);
  const statusTotal = Number(data.statusDenominator) || statusSum;
  const setStatusText = (id, text) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  };
  statuses.forEach(status => {
    setStatusText(`analytics-status-${status.key}`, status.value.toLocaleString());
    const percentage = statusTotal > 0 ? (status.value / statusTotal) * 100 : 0;
    setStatusText(`analytics-status-${status.key}-percent`, `${percentage.toFixed(1)}%`);
  });
  setStatusText('queue-mix-total', statusTotal.toLocaleString());
  setStatusText('queue-mix-sample', `n = ${statusTotal.toLocaleString()} applications`);
  setStat('analytics-kpi-pending', data.pendingReview || data.pending);
  setStat('analytics-kpi-review', data.inReview);
  setStat('analytics-kpi-ready', data.approved);
  setStat('analytics-kpi-rejected', data.rejected);
  const allZero = !data.approved && !data.pending && !data.inReview && !data.rejected;
  const emptyRing = document.getElementById('queue-mix-empty-ring');
  const chartCanvas = document.getElementById('chart-status');
  if (emptyRing) emptyRing.style.display = allZero ? 'flex' : 'none';
  if (chartCanvas) chartCanvas.style.opacity = allZero ? '0' : '1';
  CHARTS['status'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Approved', 'Rejected', 'Pending', 'In Review'], datasets: [{ data: [statuses[0].value, statuses[3].value, statuses[1].value, statuses[2].value], backgroundColor: ['#059669', '#B91C1C', '#B45309', '#1D4ED8'], hoverOffset: 8, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => { const total = c.dataset.data.reduce((sum, value) => sum + Number(value || 0), 0); const percentage = total ? (c.parsed / total) * 100 : 0; return ` ${c.label}: ${c.parsed.toLocaleString()} (${percentage.toFixed(1)}%)`; } } } } }
  });
}
function initDashboardCardClick() {
  const cards = document.querySelectorAll('.stat-card');
  if (!cards.length) return;
  cards.forEach(card => card.addEventListener('click', () => {
    cards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  }));
}
function toggleDateFilter(event) {
  event.stopPropagation();
  const menu = document.getElementById('dashboard-date-menu');
  if (!menu) return;
  menu.classList.toggle('show');
  if (menu.classList.contains('show')) {
    const seed = selectedDate ? new Date(selectedDate.year, selectedDate.month, selectedDate.day) : new Date();
    renderCalendar(seed);
  }
}
function closeDateFilter() {
  const menu = document.getElementById('dashboard-date-menu');
  if (menu) menu.classList.remove('show');
}
function renderCalendar(date = new Date()) {
  const grid = document.getElementById('calendar-grid');
  const monthYear = document.getElementById('calendar-month-year');
  if (!grid || !monthYear) return;

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  monthYear.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  grid.innerHTML = '';

  // Previous month days
  const prevLastDate = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = document.createElement('div');
    day.className = 'calendar-day disabled';
    day.textContent = prevLastDate - i;
    grid.appendChild(day);
  }

  // Current month days
  for (let i = 1; i <= lastDate; i++) {
    const day = document.createElement('div');
    day.className = 'calendar-day';
    day.textContent = i;
    day.addEventListener('click', () => selectCalendarDay(i, month, year));
    if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      day.classList.add('today');
    }
    if (selectedDate && i === selectedDate.day && month === selectedDate.month && year === selectedDate.year) {
      day.classList.add('selected');
    }
    grid.appendChild(day);
  }

  // Next month days
  const remaining = 42 - grid.children.length; // 6 rows * 7 days
  for (let i = 1; i <= remaining; i++) {
    const day = document.createElement('div');
    day.className = 'calendar-day disabled';
    day.textContent = i;
    grid.appendChild(day);
  }
}
function changeCalendarMonth(delta) {
  const monthYear = document.getElementById('calendar-month-year');
  if (!monthYear) return;
  const [monthName, yearStr] = monthYear.textContent.split(' ');
  const year = parseInt(yearStr);
  const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
  const newDate = new Date(year, monthIndex + delta, 1);
  renderCalendar(newDate);
}
let selectedDate = null;
window.getDashboardSelectedDate = function() {
  return selectedDate
    ? new Date(selectedDate.year, selectedDate.month, selectedDate.day)
    : new Date();
};
function selectCalendarDay(day, month, year) {
  selectedDate = { day, month, year };
  const date = new Date(year, month, day);
  const label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const dateLabel = document.getElementById('dashboard-date-label');
  if (dateLabel) dateLabel.textContent = label;
  renderCalendar(date);
  closeDateFilter();
  if (typeof window.applyDashboardDateFilter === 'function') {
    window.applyDashboardDateFilter(date);
    showToast('Dashboard metrics filtered for ' + label, 'success');
  } else {
    showToast('Dashboard date selected: ' + label, 'info');
  }
}
function initBarangay(stacked = false) {
  const ctx = mkCanvas('chart-barangay'); if (!ctx) return;
  const data = analyticsScope();
  CHARTS['barangay'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.barangayLabels, datasets: [
        { label: 'Total', data: data.barangayTotal, backgroundColor: 'rgba(26,79,186,0.22)', hoverBackgroundColor: 'rgba(26,79,186,0.5)', borderRadius: 5, borderSkipped: false },
        { label: 'Approved', data: data.barangayApproved, backgroundColor: 'rgba(11,158,108,0.6)', hoverBackgroundColor: C.green, borderRadius: 5, borderSkipped: false },
        { label: 'Pending Review', data: data.barangayPending, backgroundColor: 'rgba(192,122,10,0.6)', hoverBackgroundColor: C.amber, borderRadius: 5, borderSkipped: false },
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toLocaleString()}` } } }, scales: { x: { stacked, grid: { display: false }, ticks: { color: C.text } }, y: { stacked, grid: { color: C.grid, drawBorder: false }, ticks: { color: C.text, precision: 0, stepSize: 1, callback: v => Number.isInteger(v) ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : null } } } }
  });
}
function renderBarangayRegistrations() {
  const list = document.getElementById('brgy-registrations-list');
  if (!list) return;
  const year = document.getElementById('brgy-period-filter')?.value || '2026';
  const top = document.getElementById('brgy-top-filter')?.value || '6';
  const data = analyticsScope();
  const labels = data.barangayLabels || [];
  const totals = data.barangayTotal || [];
  if (!labels.length) {
    list.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:140px;color:var(--text-muted);font-size:13px;text-align:center">No registration data to display yet. It will appear here once connected to the live system.<br/>Filters: ' + year + ' · Top ' + top + '</div>';
    return;
  }
  const rows = labels.map((l, i) => ({ label: l, value: totals[i] || 0 }));
  const sorted = rows.slice().sort((a, b) => b.value - a.value);
  const shown = top === 'all' ? sorted : sorted.slice(0, parseInt(top, 10) || 6);
  const max = Math.max.apply(null, shown.map(r => r.value)) || 1;
  list.innerHTML = shown.map(r => {
    const pct = Math.max(3, Math.round((r.value / max) * 100));
    return `<div style="display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px">
        <span style="color:var(--text-primary)">${r.label}</span>
        <span style="color:var(--text-muted)">${fmt(r.value)}</span>
      </div>
      <div style="height:8px;border-radius:6px;background:var(--bg-2, rgba(0,0,0,0.06))">
        <div style="height:100%;width:${pct}%;border-radius:6px;background:var(--primary)"></div>
      </div>
    </div>`;
  }).join('');
}

function initAge() {
  const ctx = mkCanvas('chart-age'); if (!ctx) return;
  CHARTS['age'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['60–64', '65–69', '70–74', '75–79', '80–84', '85+'], datasets: [{ data: analyticsScope().ageDistribution || [0, 0, 0, 0, 0, 0], backgroundColor: ['#BFDBFE', '#60A5FA', '#2563EB', '#1A4FBA', '#1E3A8A', '#0F1F4D'], hoverOffset: 6, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => ` Age ${c.label}: ${c.parsed}` } } } }
  });
}
function initIssuance() {
  const ctx = mkCanvas('chart-issuance'); if (!ctx) return;
  const cumul = analyticsScope().issuance;
  CHARTS['issuance'] = new Chart(ctx, {
    type: 'line',
    data: { labels: MONTHS, datasets: [{ label: 'IDs Issued', data: cumul, borderColor: C.purple, backgroundColor: (context) => { const ch = context.chart; const { ctx: c, chartArea } = ch; if (!chartArea) return 'transparent'; const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); g.addColorStop(0, 'rgba(113,64,216,0.28)'); g.addColorStop(1, 'rgba(113,64,216,0.01)'); return g; }, borderWidth: 3, pointRadius: 4, pointBackgroundColor: C.purple, pointHoverRadius: 7, fill: true, tension: 0.45 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => ` Cumulative IDs: ${c.parsed.y.toLocaleString()}` } } }, scales: SCALE }
  });
}
function initProcessing() {
  const analyticsModule = document.getElementById('mod-analytics');

  if (
    !analyticsModule ||
    !analyticsModule.classList.contains('active')
  ) {
    return;
  }
  const ctx = mkCanvas('chart-processing'); if (!ctx) return;
  const vals = analyticsScope().processing;
  CHARTS['processing'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: MONTHS, datasets: [{ label: 'Avg Days', data: vals, backgroundColor: vals.map((v, i) => i >= 10 ? 'rgba(11,158,108,0.7)' : 'rgba(26,79,186,0.22)'), hoverBackgroundColor: vals.map((v, i) => i >= 10 ? C.green : C.primary), borderRadius: 4, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...TIP, callbacks: { label: c => ` Avg: ${c.parsed.y} days` } } }, scales: { x: { grid: { display: false }, ticks: { color: C.text, font: { size: 10 } } }, y: { min: 0, grid: { color: C.grid, drawBorder: false }, ticks: { color: C.text, font: { size: 10 }, precision: 0, stepSize: 1, callback: v => Number.isInteger(v) ? v + 'd' : null } } } }
  });
}
function initRadar() {
  const ctx = mkCanvas('chart-radar'); if (!ctx) return;
  CHARTS['radar'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Speed', 'Approval', 'ID Issuance', 'Coverage', 'Accuracy', 'Turnaround'], datasets: [
        // TODO(integration): populate radar metrics from the live system.
        { label: 'Q2 2026', data: [0, 0, 0, 0, 0, 0], borderColor: C.primary, backgroundColor: 'rgba(26,79,186,0.12)', borderWidth: 2.5, pointBackgroundColor: C.primary, pointRadius: 4 },
        { label: 'Q1 2026', data: [0, 0, 0, 0, 0, 0], borderColor: C.purple, backgroundColor: 'rgba(113,64,216,0.08)', borderWidth: 2, borderDash: [4, 3], pointBackgroundColor: C.purple, pointRadius: 3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11 } } }, tooltip: { ...TIP } }, scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: C.grid }, angleLines: { color: C.grid }, pointLabels: { color: C.text, font: { size: 10, weight: '600' } } } } }
  });
}
const AUTH_API_BASE = 'https://management-backend-3cij.onrender.com/api/auth';

function getAuthToken() {
  // Prefer the token restored into the active account, then inspect both
  // storage locations independently. Do not let an older empty session in
  // sessionStorage hide a valid token saved in localStorage (or vice versa).
  const candidates = [];

  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER?.token) {
    candidates.push(CURRENT_USER.token);
  }

  try {
    const sessionRaw = window.sessionStorage.getItem('senioridAuth');
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session?.token) candidates.push(session.token);
    }
  } catch (_err) { }

  try {
    const localRaw = window.localStorage.getItem('senioridAuth');
    if (localRaw) {
      const session = JSON.parse(localRaw);
      if (session?.token) candidates.push(session.token);
    }
  } catch (_err) { }

  try {
    const legacyToken = window.localStorage.getItem('authToken');
    if (legacyToken) candidates.push(legacyToken);
  } catch (_err) { }

  const token = candidates.find(value =>
    typeof value === 'string' &&
    value.trim() &&
    value.trim() !== 'null' &&
    value.trim() !== 'undefined'
  );

  return token ? token.trim() : null;
}

function getAuthHeaders() {
  const token = getAuthToken();

  return {
    'Content-Type': 'application/json',
    ...(token
      ? {
        'Authorization': `Bearer ${token}`
      }
      : {})
  };
}
/* ── ID Maker Operational Analytics ── */


let chartsReady = false;
function initAllCharts() {
  initTrend(); initStatus(); initBarangay(false); initAge(); initIssuance(); initProcessing(); initRadar();
  renderBarangayRegistrations();
  chartsReady = true;
}
function switchTrendView(btn, view) {
  btn.closest('.tab-group').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const ch = CHARTS['trend']; if (!ch) return;
  if (view === 'all') { ch.data.datasets.forEach(d => d.hidden = false); }
  else if (view === 'approved') { ch.data.datasets[0].hidden = true; ch.data.datasets[1].hidden = false; ch.data.datasets[2].hidden = true; }
  else { ch.data.datasets[0].hidden = false; ch.data.datasets[1].hidden = true; ch.data.datasets[2].hidden = true; }
  ch.update();
}
function switchBarangayView(btn, view) {
  btn.closest('.tab-group').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  initBarangay(view === 'stacked');
}
function switchPeriod(btn, p) {
  btn.closest('.tab-group').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (chartsReady) initAllCharts();
  showToast('Switched to ' + p + ' view', 'info');
}

function syncTurnaroundTimeVisibility() {
  const turnaroundTime =
    document.getElementById(
      'analytics-turnaround-time'
    );

  if (!turnaroundTime) {
    return;
  }

  const analyticsModule =
    document.getElementById(
      'mod-analytics'
    );

  turnaroundTime.style.display =
    analyticsModule &&
      analyticsModule.classList.contains('active')
      ? ''
      : 'none';
}

/* ── NAVIGATION (kept) ── */
function navigate(moduleId) {
  const p = ROLE_PERMS[CURRENT_ROLE] || ROLE_PERMS.Staff;

  // Transactional (Staff) modules are not part of the Admin portal —
  // the Administrator supervises integrity/security, not daily processing.
  const staffOnlyModules = ['applicants', 'applications', 'analytics', 'id-issuance'];
  if (CURRENT_ROLE === 'Admin' && staffOnlyModules.includes(moduleId)) {
    showToast('This transactional screen is only available to Staff accounts.', 'error');
    return;
  }

  // ID Maker Dashboard is restricted to ID Maker accounts
  if (CURRENT_ROLE !== 'ID Maker' && moduleId === 'id-maker-dashboard') {
    showToast('The ID Maker Dashboard is only available to ID Maker accounts.', 'error');
    return;
  }

  // ID Maker is restricted to ID Maker Dashboard + Analytics
  if (CURRENT_ROLE === 'ID Maker' && moduleId !== 'id-maker-dashboard' && moduleId !== 'id-maker-analytics') {
    showToast('Access restricted to ID Maker Dashboard.', 'error');
    return;
  }

  // Admin-only modules (Admin Console)
  const adminOnlyModules = ['user-mgmt', 'audit-logs', 'system-config', 'backup'];
  if (adminOnlyModules.includes(moduleId) && CURRENT_ROLE !== 'Admin') {
    showToast('This section is restricted to admin accounts.', 'error');
    return;
  }
  document.querySelectorAll('.module').forEach(m =>
    m.classList.remove('active')
  );

  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.remove('active')
  );

  const mod =
    document.getElementById(
      'mod-' + moduleId
    );

  if (mod) {
    mod.classList.add('active');
  }

  const link =
    document.querySelector(
      '[data-module="' + moduleId + '"]'
    );

  if (link) {
    link.classList.add('active');
  }


  // TURNAROUND TIME VISIBILITY
  // This card must only be visible on Analytics.

  const turnaroundTime =
    document.getElementById(
      'analytics-turnaround-time'
    );

  if (turnaroundTime) {
    turnaroundTime.style.display =
      moduleId === 'analytics'
        ? ''
        : 'none';
  }


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
  if (moduleId === 'analytics') setTimeout(initAllCharts, 80);
  if (moduleId === 'id-issuance') { if (typeof initSmallFormIssuance === 'function') initSmallFormIssuance(); }
  if (moduleId === 'replacements') { if (typeof loadReplacementRequests === 'function') {loadReplacementRequests();}
}
  if (moduleId === 'id-maker-dashboard') { if (typeof initIdMakerQueue === 'function') initIdMakerQueue(); if (typeof updateIdMakerKPIs === 'function') updateIdMakerKPIs(); }
  if (moduleId === 'id-maker-analytics') { if (typeof initIdMakerCharts === 'function') setTimeout(initIdMakerCharts, 80); }
}

/* Wire nav links */
document.querySelectorAll('.nav-link[data-module]').forEach(l => l.addEventListener('click', () => navigate(l.dataset.module)));

/* ── FILTERS (kept) ── */
function filterByStatus(el, status) {
  const tabs = el && el.closest ? el.closest('.status-tabs') : null;
  if (tabs) tabs.querySelectorAll('.status-tab').forEach(c => c.classList.remove('active'));
  if (el && el.classList) el.classList.add('active');
  if (typeof applyApplicationsModuleFilters === 'function') {
    applyApplicationsModuleFilters(status);
    updateStatusTabCounts();
    return;
  }
  // Map tab keys to actual status labels used in the table
  const statusMap = {
    all: 'all',
    pending: 'Pending',
    unverified: 'Unverified',
    review: 'Under Review',
    verified: 'Verified',
    process: 'In Process',
    release: 'Ready for Release',
    issued: 'ID Issued',
    completed: 'Completed',
    rejected: 'Rejected'
  };
  const filterStatus = statusMap[status] || 'all';
  document.querySelectorAll('#mod-applications .data-table tbody tr').forEach(row => {
    if (filterStatus === 'all') { row.style.display = ''; return; }
    const statusSelect = row.querySelector('.status-select__label');
    const rowStatus = statusSelect ? statusSelect.textContent.trim() : '';
    row.style.display = rowStatus === filterStatus ? '' : 'none';
  });
  // Update the 'All' tab count to reflect visible rows
  updateStatusTabCounts();
}

const STATUS_ICON_SVGS = {
  clock: '<path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM9.25 5v5.25l3.75 2.25.75-1.23-3-1.77V5h-1.5z"/>',
  document: '<path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5.75a1.5 1.5 0 0 1 1.06.44l2.25 2.25a1.5 1.5 0 0 1 .44 1.06V17.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 17.5v-15zM5.5 2.5V16h9V6.38L11.12 3.5H5.5zM6 7.5h8v1.5H6V7.5zm0 3.5h8v1.5H6V11zm0 3.5h5v1.5H6V14.5z"/>',
  checkmark: '<path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-10.707-1.414-1.414L9 8.586 6.707 6.293l-1.414 1.414L9 11.414l5.707-5.707z"/>',
  check: '<path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-1.293 11.293-2.5-2.5 1.414-1.414L8.707 10.586l3.793-3.793 1.414 1.414-5.207 5.207z"/>',
  truck: '<path d="M1 4.5A1.5 1.5 0 0 1 2.5 3h8A1.5 1.5 0 0 1 12 4.5V6h2.09a1.5 1.5 0 0 1 1.2.6l2.09 2.785a1.5 1.5 0 0 1 .27.885V13a1.5 1.5 0 0 1-1.5 1.5h-.578A2.75 2.75 0 0 1 12.75 17a2.75 2.75 0 0 1-2.672-2.25H5.922A2.75 2.75 0 0 1 3.25 17 2.75 2.75 0 0 1 .5 14.25V4.5zM3.25 3.75V14.5a1 1 0 0 0 1 1h.439a2.75 2.75 0 0 1 5.3 0h.861V6.75H3.25v-3zM12 7.5v6.25h.439a2.75 2.75 0 0 1 5.3 0H17.5v-3.02L15.83 7.5H12zM3.75 15.25a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm11 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
  x: '<path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-11.293-1.414-1.414L10 8.586 7.707 6.293 6.293 7.707 8.586 10l-2.293 2.293 1.414 1.414L10 11.414l2.293 2.293 1.414-1.414L11.414 10l2.293-2.293z"/>'
};

function getStatusIconSvg(iconKey) {
  return STATUS_ICON_SVGS[iconKey] || STATUS_ICON_SVGS.clock;
}

function setStatusTrigger(root, iconKey, color, label) {
  const iconWrap = root.querySelector('.status-select__icon');
  const labelEl = root.querySelector('.status-select__label');
  if (iconWrap) {
    iconWrap.innerHTML = `<svg viewBox="0 0 20 20" fill="${color}" xmlns="http://www.w3.org/2000/svg">${getStatusIconSvg(iconKey)}</svg>`;
  }
  if (labelEl) labelEl.textContent = label;
}

function positionStatusMenu(trigger, menu) {
  const rect = trigger.getBoundingClientRect();
  menu.style.left = rect.left + 'px';
  menu.style.top = (rect.bottom + 2) + 'px';
  menu.style.width = rect.width + 'px';
  // Flip up if overflowing bottom of viewport
  requestAnimationFrame(() => {
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight - 8) {
      menu.style.top = (rect.top - menuRect.height - 2) + 'px';
    }
    if (menuRect.right > window.innerWidth - 8) {
      menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
    }
  });
}

function getStatusMenuRoot(menu) {
  return menu?.__statusRoot || (menu?.dataset?.statusOwnerId
    ? document.querySelector('.status-select[data-app-id="' + menu.dataset.statusOwnerId + '"]')
    : null);
}

function restoreStatusMenu(menu) {
  const root = getStatusMenuRoot(menu);
  if (root && menu.parentElement !== root) root.appendChild(menu);
}

function closeAllStatusMenus(except) {
  document.querySelectorAll('.status-select__menu.show').forEach(m => {
    if (m !== except) {
      m.classList.remove('show');
      m.style.left = '';
      m.style.top = '';
      m.style.width = '';
      restoreStatusMenu(m);
    }
  });
}

function toggleStatusSelect(btn, event) {
  if (event && event.__statusHandled) return;
  if (event) event.__statusHandled = true;
  event?.preventDefault();
  event?.stopPropagation();
  const root = btn.closest('.status-select');
  if (!root) return;
  const menu = root.querySelector('.status-select__menu');
  if (!menu) return;
  const wasOpen = menu.classList.contains('show');
  closeAllStatusMenus(menu);
  if (wasOpen) {
    menu.classList.remove('show');
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
    restoreStatusMenu(menu);
  } else {
    menu.__statusRoot = root;
    menu.dataset.statusOwnerId = root.dataset.appId || '';
    document.body.appendChild(menu);
    menu.classList.add('show');
    positionStatusMenu(btn, menu);
  }
}

function selectStatusOption(btn, event) {
  if (event && event.__statusHandled) return;

  if (event) {
    event.__statusHandled = true;
    event.preventDefault();
    event.stopPropagation();
  }

  const menu = btn.closest('.status-select__menu');
  const root =
    btn.closest('.status-select') ||
    getStatusMenuRoot(menu);

  if (!root) return;

  // Save the previous status in case the database update fails
  const previousStatus =
    root.querySelector('.status-select__label')?.textContent.trim() ||
    'Pending';

  const status = btn.dataset.status;
  const icon = btn.dataset.icon;
  const color = btn.dataset.color;
  const appId = String(root.dataset.appId || '');

  // Eligibility and document approval are checked by the backend directly
  // against Supabase when the status request is submitted. Do not block this
  // transition using APP_DB/LIVE_APPLICATIONS, because these page-level caches
  // can be stale until the application detail modal refreshes the record.


  root
    .querySelectorAll('.status-select__option')
    .forEach(o => {
      o.classList.toggle('active', o === btn);
    });

  setStatusTrigger(
    root,
    icon,
    color,
    status
  );

  if (root.dataset.requestId) {
    updateReplacementStatus(
      root.dataset.requestId,
      root.dataset.appId,
      status,
      previousStatus,
      root
    );
  } else {
    updateTableStatus(
      root.dataset.appId,
      status,
      previousStatus
    );
  }

  closeAllStatusMenus();

  if (
    typeof applyApplicationsFilters ===
    'function'
  ) {
    applyApplicationsFilters();
  }
}

async function updateReplacementStatus(
  requestId,
  applicationId,
  newStatus,
  previousStatus,
  root
) {
  const config = statusOptionCfg(
    mapStatusForDropdown(previousStatus)
  );

  try {
    const response = await fetch(
      `https://management-backend-3cij.onrender.com/api/replacements/${encodeURIComponent(requestId)}/decision`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: newStatus
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Failed to update replacement status.'
      );
    }

    // Keep the local application record in sync when available.
    if (typeof APP_DB !== 'undefined' && APP_DB[applicationId]) {
      APP_DB[applicationId].status = newStatus;
    }

    if (
      typeof LIVE_APPLICATIONS !== 'undefined' &&
      Array.isArray(LIVE_APPLICATIONS)
    ) {
      const linkedApplication = LIVE_APPLICATIONS.find(
        item => String(item.application_id || item.id) ===
          String(applicationId)
      );

      if (linkedApplication) {
        linkedApplication.status = newStatus;
        linkedApplication.status_updated_at = new Date().toISOString();
      }
    }

    // Refresh the replacement list so the displayed status is the value returned by the database.
    if (typeof loadReplacementRequests === 'function') {
      await loadReplacementRequests();
    }

    if (typeof showToast === 'function') {
      showToast(`Request status updated to ${newStatus}.`, 'success');
    }
  } catch (error) {
    console.error('Failed to update replacement status:', error);

    // Restore the previous selection if saving fails.
    if (root) {
      setStatusTrigger(
        root,
        config[0],
        config[1],
        previousStatus
      );

      root.querySelectorAll('.status-select__option').forEach(option => {
        option.classList.toggle(
          'active',
          option.dataset.status === previousStatus
        );
      });
    }

    if (typeof showToast === 'function') {
      showToast(error.message || 'Failed to update request status.', 'error');
    }
  }
}

window.toggleStatusSelect = toggleStatusSelect;
window.selectStatusOption = selectStatusOption;

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('#applications-tbody .status-select__trigger');
  if (trigger && !e.__statusHandled) {
    toggleStatusSelect(trigger, e);
    return;
  }
  const option = e.target.closest('#applications-tbody .status-select__option');
  if (option && !e.__statusHandled) {
    selectStatusOption(option, e);
    return;
  }
  if (!e.target.closest('.status-select')) closeAllStatusMenus();
});

/* =========================================================
   APPLICANTS FILTER STATE
   Search + Barangay + Status work together.
========================================================= */

const APPLICANTS_FILTER_STATE = { search: '', barangay: [], status: [] };
function selectedFilterValues(control) {
  if (!control) return [];
  if (control instanceof HTMLSelectElement && control.multiple) return Array.from(control.selectedOptions).map(option => String(option.value || '').trim().toLowerCase()).filter(Boolean);
  const value = String(control.value || '').trim().toLowerCase();
  return value ? [value] : [];
}

// Render native multi-select controls as compact dropdowns with checkbox options.
function enhanceMultiSelectDropdowns(root = document) {
  root.querySelectorAll('select[multiple]').forEach(select => {
    if (select.dataset.multiDropdownReady === 'true') return;
    select.dataset.multiDropdownReady = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'multi-select-dropdown';
    wrapper.style.cssText = 'position:relative;display:inline-block;min-width:130px;max-width:240px;vertical-align:middle;';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.style.display = 'none';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'filter-select multi-select-dropdown__trigger';
    trigger.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:38px;padding:8px 12px;border:1px solid var(--border-color,#dbe3ef);border-radius:10px;background:var(--surface,#fff);color:var(--text-primary,#334155);font:inherit;font-size:13px;text-align:left;cursor:pointer;white-space:nowrap;';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;';
    const caret = document.createElement('span');
    caret.textContent = '▾';
    caret.setAttribute('aria-hidden', 'true');
    trigger.append(label, caret);

    // Render menus under <body> with fixed positioning so table/card overflow
    // and viewport edges cannot crop the available options.
    const menu = document.createElement('div');
    menu.className = 'multi-select-dropdown__menu';
    menu.hidden = true;
    menu.style.cssText = 'position:fixed;z-index:20000;min-width:180px;width:max-content;max-width:min(300px,calc(100vw - 24px));max-height:min(320px,calc(100vh - 24px));overflow:auto;padding:6px;border:1px solid var(--border-color,#dbe3ef);border-radius:10px;background:var(--surface,#fff);box-shadow:0 12px 28px rgba(15,23,42,.18);';
    menu._multiSelectTrigger = trigger;
    document.body.appendChild(menu);

    function refreshLabel() {
      const selected = Array.from(select.selectedOptions).filter(option => option.value && option.value !== 'all');
      const allOption = Array.from(select.options).find(option => !option.value || option.value === 'all');
      if (!selected.length) label.textContent = allOption?.textContent?.trim() || select.getAttribute('aria-label') || 'All';
      else if (selected.length <= 2) label.textContent = selected.map(option => option.textContent.trim()).join(', ');
      else label.textContent = selected.length + ' selected';
      trigger.title = selected.map(option => option.textContent.trim()).join(', ') || label.textContent;
    }

    function positionMenu() {
      const rect = trigger.getBoundingClientRect();
      const margin = 12;
      menu.style.width = 'max-content';
      menu.style.minWidth = Math.min(Math.max(rect.width, 180), window.innerWidth - margin * 2) + 'px';
      menu.style.maxWidth = (window.innerWidth - margin * 2) + 'px';
      const width = Math.min(menu.offsetWidth || rect.width, window.innerWidth - margin * 2);
      menu.style.left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)) + 'px';
      menu.style.right = 'auto';
      menu.style.top = 'auto';
      menu.style.bottom = 'auto';
      const menuHeight = Math.min(menu.scrollHeight || 280, window.innerHeight - margin * 2, 320);
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      if (spaceBelow >= Math.min(menuHeight, 180) || spaceBelow >= spaceAbove) {
        menu.style.top = Math.min(rect.bottom + 6, window.innerHeight - menuHeight - margin) + 'px';
      } else {
        menu.style.top = Math.max(margin, rect.top - menuHeight - 6) + 'px';
      }
    }

    function renderOptions() {
      menu.replaceChildren();
      const hasSelection = Array.from(select.selectedOptions).some(option => option.value && option.value !== 'all');
      Array.from(select.options).forEach(option => {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:7px;font-size:13px;cursor:pointer;white-space:nowrap;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = option.value && option.value !== 'all' ? option.selected : !hasSelection;
        checkbox.style.cssText = 'accent-color:var(--primary,#2563eb);';
        const textNode = document.createElement('span');
        textNode.textContent = option.textContent.trim();
        row.append(checkbox, textNode);
        checkbox.addEventListener('change', () => {
          if (!option.value || option.value === 'all') {
            Array.from(select.options).forEach(item => { item.selected = false; });
          } else {
            const all = Array.from(select.options).find(item => !item.value || item.value === 'all');
            if (all) all.selected = false;
            option.selected = checkbox.checked;
          }
          refreshLabel();
          select.dispatchEvent(new Event('change', { bubbles: true }));
          renderOptions();
          positionMenu();
        });
        menu.appendChild(row);
      });
    }

    menu.addEventListener('click', event => event.stopPropagation());
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      const opening = menu.hidden;
      document.querySelectorAll('.multi-select-dropdown__menu').forEach(other => {
        if (other !== menu) {
          other.hidden = true;
          if (other._multiSelectTrigger) other._multiSelectTrigger.setAttribute('aria-expanded', 'false');
        }
      });
      if (opening) {
        renderOptions();
        menu.hidden = false;
        positionMenu();
      } else {
        menu.hidden = true;
      }
      trigger.setAttribute('aria-expanded', String(opening));
    });

    wrapper.appendChild(trigger);
    select.addEventListener('change', refreshLabel);
    refreshLabel();
  });
}

function initMultiSelectDropdowns() {
  enhanceMultiSelectDropdowns(document);
  if (window.__multiSelectDropdownObserver) return;
  window.__multiSelectDropdownObserver = new MutationObserver(() => enhanceMultiSelectDropdowns(document));
  window.__multiSelectDropdownObserver.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    document.querySelectorAll('.multi-select-dropdown__menu').forEach(menu => {
      const trigger = menu._multiSelectTrigger;
      if (!menu.contains(event.target) && !trigger?.contains(event.target)) {
        menu.hidden = true;
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.multi-select-dropdown__menu:not([hidden])').forEach(menu => {
      const trigger = menu._multiSelectTrigger;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        menu.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 12)) + 'px';
      }
    });
  });
  window.addEventListener('scroll', () => {
    document.querySelectorAll('.multi-select-dropdown__menu:not([hidden])').forEach(menu => {
      menu.hidden = true;
      if (menu._multiSelectTrigger) menu._multiSelectTrigger.setAttribute('aria-expanded', 'false');
    });
  }, true);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMultiSelectDropdowns, { once: true });
} else {
  initMultiSelectDropdowns();
}

function applyApplicantsFilters() {
  const rows = document.querySelectorAll(
    '#applicants-tbody tr[data-app-id]'
  );

  const search =
    APPLICANTS_FILTER_STATE.search
      .trim()
      .toLowerCase();

  const barangays = Array.isArray(APPLICANTS_FILTER_STATE.barangay) ? APPLICANTS_FILTER_STATE.barangay : [];
  const statuses = Array.isArray(APPLICANTS_FILTER_STATE.status) ? APPLICANTS_FILTER_STATE.status : [];

  let visible = 0;

  rows.forEach(row => {
    const rowText =
      row.textContent
        .trim()
        .toLowerCase();

    const rowBarangay =
      row.children[2]
        ?.textContent
        ?.trim()
        .toLowerCase() || '';

    const statusElement =
      row.querySelector(
        '.status-select__label'
      );

    const rowStatus =
      statusElement
        ?.textContent
        ?.trim()
        .toLowerCase() || '';

    const matchesSearch =
      !search ||
      rowText.includes(search);

    const matchesBarangay = !barangays.length || barangays.includes(rowBarangay);
    const matchesStatus = !statuses.length || statuses.includes(rowStatus);

    const show =
      matchesSearch &&
      matchesBarangay &&
      matchesStatus;

    row.style.display =
      show ? '' : 'none';

    if (show) {
      visible++;
    }
  });

  const footer =
    document.querySelector(
      '#mod-applicants .table-footer__info'
    );

  if (footer) {
    footer.textContent =
      `Showing ${visible.toLocaleString()} of ${FULL_APPLICANTS.length.toLocaleString()} applicants`;
  }
}

function filterApplicants(query) {
  APPLICANTS_FILTER_STATE.search =
    query || '';

  applyApplicantsFilters();
}

function filterApplicantsByBarangay(control) {
  APPLICANTS_FILTER_STATE.barangay = selectedFilterValues(control);
  applyApplicantsFilters();
}
function filterApplicantsByStatus(control) {
  APPLICANTS_FILTER_STATE.status = selectedFilterValues(control);
  applyApplicantsFilters();
}

function filterRecentSubmissions() {
  if (
    Array.isArray(window.STAFF_RECENT_SUBMISSIONS) &&
    typeof renderRecentSubmissions === 'function'
  ) {
    renderRecentSubmissions(window.STAFF_RECENT_SUBMISSIONS);
    return;
  }

  const q = (document.getElementById('recent-submission-search')?.value || '').trim().toLowerCase();
  const barangays = Array.from(document.getElementById('recent-barangay-filter')?.selectedOptions || [])
    .map(option => String(option.value || '').trim().toLowerCase()).filter(Boolean);
  const rows = document.querySelectorAll('#recent-submissions-tbody tr');
  let visible = 0;

  rows.forEach(row => {
    const rowText = row.textContent.toLowerCase();
    const rowBarangay = row.children[2]?.textContent?.trim() || '';
    const matchesSearch = !q || rowText.includes(q);
    const matchesBarangay = !barangays.length || barangays.includes(rowBarangay.toLowerCase());
    const show = matchesSearch && matchesBarangay;
    row.style.display = show ? '' : 'none';
    if (show) visible += 1;
  });

  const footer = Array.from(document.querySelectorAll('.data-table-card')).find(card =>
    card.querySelector('.table-header__title')?.textContent?.trim() === 'Recent Submissions'
  )?.querySelector('.table-footer__info');
  if (footer) {
    const data = analyticsScope();
    footer.textContent = `Showing ${visible} of ${fmt(data.pendingReview)} pending review submissions`;
  }
}

function filterBarangayYear(year) {
  const chart = document.querySelector('.chart-card');
  if (chart) chart.dataset.year = year;
  const note = document.getElementById('barangay-empty-note');
  if (note) note.textContent = `No registration data available for ${year} yet. Connect the live system to populate this chart.`;
}

/* ───────────────────────────────────────────────────────────
   NEW: RBAC (Demo)
─────────────────────────────────────────────────────────── */
let CURRENT_ROLE = 'Staff';
let CURRENT_USER = null;

// ── Dev-only role switcher (sidebar "Quick Role Switch") ──
// Set to true ONLY in development builds. When false the trigger button,
// the switcher panel, and any user-initiated setRole() call are all gated
// off, so a live build cannot be used to escalate role client-side.
const ENABLE_DEV_ROLE_SWITCHER = false;

function readAuthSession() {
  try {
    const sessionValue = window.sessionStorage.getItem('senioridAuth');
    if (sessionValue) return sessionValue;
  } catch (_err) { }
  try {
    const localValue = window.localStorage.getItem('senioridAuth');
    if (localValue) return localValue;
  } catch (_err) { }
  // NOTE: the old window.name fallback was removed — window.name survives
  // cross-page navigations and is readable by any script on the page, so it
  // is not an acceptable session channel. Web Storage only.
  return null;
}

function writeAuthSession(value) {
  try { window.sessionStorage.setItem('senioridAuth', value); return true; }
  catch (_err) { }
  try { window.localStorage.setItem('senioridAuth', value); return true; }
  catch (_err) { }
  return false;
}

function clearAuthSession() {
  try { window.sessionStorage.removeItem('senioridAuth'); }
  catch (_err) { }
  try { window.localStorage.removeItem('senioridAuth'); }
  catch (_err) { }
}

const ROLE_PERMS = {
  Admin: { approve: true, reject: true, print: true, userMgmt: true, export: true, viewPII: true, settings: true, idMakerDashboard: true },
  Staff: { approve: true, reject: true, print: true, userMgmt: false, export: true, viewPII: true, settings: false, idMakerDashboard: false },
  "ID Maker": { approve: false, reject: false, print: true, userMgmt: false, export: false, viewPII: true, settings: false, idMakerDashboard: true }
};

/* Page detection — login is a standalone page; portals are separate pages.
   All pages share app.js, so these helpers are page-aware. */
const PAGE = (() => {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (p === 'login.html') return 'login';
  if (p === 'admin.html') return 'admin';
  if (p === 'staff.html') return 'staff';
  if (p === 'idmaker.html') return 'idmaker';
  return 'unknown';
})();

function normalizeRole(role) {
  if (!role) return 'Staff';
  const normalized = String(role).trim();
  const directMap = {
    admin: 'Admin',
    'admin user': 'Admin',
    staff: 'Staff',
    'frontline staff': 'Staff',
    'id maker': 'ID Maker',
    idmaker: 'ID Maker',
    'id-maker': 'ID Maker'
  };
  return directMap[normalized.toLowerCase()] || (normalized === 'Admin' || normalized === 'Staff' || normalized === 'ID Maker' ? normalized : 'Staff');
}

function portalFileForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'Admin') return 'admin.html';
  if (normalizedRole === 'ID Maker') return 'idmaker.html';
  return 'staff.html';
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

function showLoginPage() {
  if (PAGE === 'login') {
    document.body.classList.remove('portal-mode');
    document.body.classList.add('auth-mode');
    showScreen('login-page');
    document.getElementById('login-form')?.reset();
    return;
  }
  // On a portal page there is no login screen — bounce back to login.html.
  location.href = 'login.html';
}

function showLogoutPage() {
  // Redirect the user straight back to the Login page (no static "Logged Out" screen).
  if (PAGE === 'login') {
    document.body.classList.remove('portal-mode');
    document.body.classList.add('auth-mode');
    showScreen('login-page');
    return;
  }
  location.href = 'login.html?loggedout=1';
}

/* Flash a one-time toast/message on the standalone Login page. The message is
   carried via a URL state parameter so a full page redirect can still surface it. */
function applyLoginFlash(msg, type = 'info') {
  if (PAGE !== 'login') { location.href = 'login.html?loggedout=1'; return; }
  if (msg) { showToast(msg, type); }
  if (location.search.includes('loggedout')) {
    const url = new URL(location.href);
    url.searchParams.delete('loggedout');
    url.searchParams.delete('reason');
    history.replaceState(null, '', url.toString());
  }
}

function showPortalPage() {
  if (PAGE === 'login') {
    // Already authenticated on the login page — take them to their portal.
    location.href = portalFileForRole(CURRENT_ROLE);
    return;
  }
  document.body.classList.remove('auth-mode');
  document.body.classList.add('portal-mode');
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

  // Skeleton: shimmer KPI values and main data tables while live data loads
  if (typeof Skeleton !== 'undefined') {
    // Staff / Admin KPI cards across modules
    if (typeof Skeleton.setAllKpisLoading === 'function') {
      Skeleton.setAllKpisLoading(true);
    } else {
      Skeleton.setLoading(document.querySelectorAll('.stat-card__value'), true);
    }
    // Staff tables
    Skeleton.setTable('recent-submissions-tbody', 5);
    Skeleton.setTable('applicants-tbody', 8);
    Skeleton.setTable('applications-tbody', 8);
  }
}

function updateRoleUI() {
  const roleLabel = document.getElementById('current-role-label');
  const dashboardBadge = document.getElementById('dashboard-role-badge');
  const roleSelect = document.getElementById('role-switch-select');
  const portalBrand = document.getElementById('portal-brand-name');
  const dashboardTitle = document.getElementById('dashboard-title');
  if (roleLabel) roleLabel.textContent = CURRENT_ROLE;
  if (dashboardBadge) {
    dashboardBadge.textContent = CURRENT_ROLE === 'Admin' ? 'Admin View' : (CURRENT_ROLE === 'ID Maker' ? 'ID Maker View' : 'Staff View');
    dashboardBadge.classList.toggle('green', CURRENT_ROLE === 'Staff' || CURRENT_ROLE === 'ID Maker');
  }
  if (roleSelect) roleSelect.value = CURRENT_ROLE;
  if (portalBrand) portalBrand.textContent = CURRENT_ROLE === 'Admin' ? 'Admin Portal' : (CURRENT_ROLE === 'ID Maker' ? 'ID Maker Portal' : 'Staff Portal');
  if (dashboardTitle) dashboardTitle.textContent = CURRENT_ROLE === 'Admin' ? 'Admin Dashboard' : (CURRENT_ROLE === 'ID Maker' ? 'ID Maker Dashboard' : 'Staff Dashboard');
  applyDashboardMetrics();
  applyAnalyticsRoleView();
  if (typeof switchKPIs === 'function') switchKPIs(CURRENT_ROLE);
}

function applySessionContext() {
  ensureProfileModal();
  const displayName = CURRENT_USER?.displayName || 'Staff Account';
  const userLabel = document.getElementById('current-user-name');
  const welcome = document.getElementById('dashboard-welcome');
  if (userLabel) userLabel.textContent = displayName;
  // Sidebar avatar — always render the account's initials (no photos).
  const avatar = document.querySelector('.sidebar__avatar');
  if (avatar) {
    const initials = displayName.split(/\s+/)
      .map(w => (w.replace(/[^A-Za-z0-9]/g, '')[0] || ''))
      .filter(Boolean).join('').slice(0, 2).toUpperCase();
    avatar.innerHTML = `<span class="sidebar__avatar-initials">${initials || '—'}</span>`;
  }
  const today = new Date();
  if (welcome) {
    welcome.textContent = `Welcome back, ${displayName}`;
  }
  const dateLabel = document.getElementById('dashboard-date-label');
  if (dateLabel) {
    const shortDate = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    dateLabel.textContent = shortDate;
  }
}

/* ───────────────────────────────────────────────────────────
   USER PROFILE MODAL
   Shared by the Admin, Staff, and ID Maker portals.
─────────────────────────────────────────────────────────── */
let profileEscapeWired = false;

function profileInitials(name) {
  const initials = String(name || '')
    .split(/\s+/)
    .map(w => (w.replace(/[^A-Za-z0-9]/g, '')[0] || ''))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || '—';
}

function isStrongPasswordClient(value) {
  const text = String(value || '');
  return text.length >= 8 &&
    /[A-Z]/.test(text) &&
    /[0-9]/.test(text) &&
    /[^A-Za-z0-9]/.test(text);
}

function persistCurrentSession(token) {
  if (!CURRENT_USER) return;

  let session = {};
  try {
    const raw = readAuthSession();
    if (raw) session = JSON.parse(raw) || {};
  } catch (_err) {
    session = {};
  }

  session.id = CURRENT_USER.id ?? session.id;
  session.username = CURRENT_USER.username || session.username;
  session.full_name = CURRENT_USER.fullName || session.full_name || '';
  session.role = CURRENT_USER.role || session.role;
  session.email = CURRENT_USER.email || '';
  session.displayName = CURRENT_USER.displayName || CURRENT_USER.fullName || CURRENT_USER.username || session.displayName;

  if (token) {
    session.token = token;
    CURRENT_USER.token = token;
  }

  writeAuthSession(JSON.stringify(session));
}

function applyProfileUser(user, token) {
  if (!user) return;

  CURRENT_USER = CURRENT_USER || {};
  CURRENT_USER.id = user.id ?? CURRENT_USER.id;
  CURRENT_USER.username = user.username || CURRENT_USER.username;
  CURRENT_USER.fullName = user.full_name || CURRENT_USER.fullName || user.username || '';
  CURRENT_USER.displayName = CURRENT_USER.fullName || CURRENT_USER.username || CURRENT_USER.displayName;
  CURRENT_USER.email = user.email || '';
  CURRENT_USER.role = normalizeRole(user.role || CURRENT_USER.role);
  CURRENT_USER.accountStatus = user.account_status || 'Active';

  persistCurrentSession(token);
  applySessionContext();
}

function fillProfileForm(user) {
  const profile = user || CURRENT_USER || {};
  const displayName = profile.full_name || profile.fullName || profile.displayName || profile.username || '—';
  const role = normalizeRole(profile.role || CURRENT_ROLE);

  const avatar = document.getElementById('profile-avatar');
  if (avatar) avatar.textContent = profileInitials(displayName);

  const nameEl = document.getElementById('profile-display-name');
  if (nameEl) nameEl.textContent = displayName;

  const roleLabel = document.getElementById('profile-role-label');
  if (roleLabel) roleLabel.textContent = `${role} account`;

  const fullNameInput = document.getElementById('profile-full-name');
  if (fullNameInput) fullNameInput.value = profile.full_name || profile.fullName || '';

  const usernameInput = document.getElementById('profile-username');
  if (usernameInput) usernameInput.value = profile.username || '';

  const emailInput = document.getElementById('profile-email');
  if (emailInput) emailInput.value = profile.email || '';

  const resetEmail = document.getElementById('profile-reset-email');
  if (resetEmail) {
    resetEmail.textContent = String(profile.email || '').trim() || 'no email address on file';
  }

  const roleInput = document.getElementById('profile-role');
  if (roleInput) roleInput.value = role;

  const statusInput = document.getElementById('profile-status');
  if (statusInput) statusInput.value = profile.account_status || profile.accountStatus || 'Active';
}

function ensureProfileModal() {
  if (PAGE === 'login') return;

  if (!document.getElementById('profile-modal')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal-backdrop" id="profile-modal" aria-hidden="true">
        <div class="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
          <div class="modal__header">
            <div>
              <div class="modal__title" id="profile-modal-title">My Profile</div>
              <div class="modal__sub">View and manage your account information</div>
            </div>
            <button type="button" class="modal__close" onclick="closeProfileModal()" aria-label="Close profile">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="profile-hero">
              <div class="profile-hero__avatar" id="profile-avatar">—</div>
              <div class="profile-hero__meta">
                <div class="profile-hero__name" id="profile-display-name">—</div>
                <div class="profile-hero__role" id="profile-role-label">—</div>
              </div>
            </div>

            <div class="profile-tabs" role="tablist" aria-label="Profile sections">
              <button type="button" class="profile-tab active" id="profile-tab-info" role="tab" aria-selected="true" onclick="switchProfileTab('info')">
                Profile Information
              </button>
              <button type="button" class="profile-tab" id="profile-tab-password" role="tab" aria-selected="false" onclick="switchProfileTab('password')">
                Password &amp; Security
              </button>
            </div>

            <form id="profile-info-form" class="profile-panel active" onsubmit="saveProfile(event)">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label" for="profile-full-name">Full Name <span>*</span></label>
                  <input class="form-input" id="profile-full-name" autocomplete="name" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="profile-username">Username <span>*</span></label>
                  <input class="form-input" id="profile-username" autocomplete="username" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="profile-email">Email Address</label>
                  <input class="form-input" id="profile-email" type="email" autocomplete="email" placeholder="name@example.com" />
                </div>
                <div class="form-grid form-grid-2">
                  <div class="form-group">
                    <label class="form-label" for="profile-role">Role</label>
                    <input class="form-input" id="profile-role" readonly />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="profile-status">Account Status</label>
                    <input class="form-input" id="profile-status" readonly />
                  </div>
                </div>
              </div>
              <p class="profile-hint">Your role and account status can only be changed by an administrator.</p>
              <div class="form-actions" style="justify-content:flex-end">
                <button type="button" class="btn btn--ghost" onclick="closeProfileModal()">Cancel</button>
                <button type="submit" class="btn btn--primary" id="profile-save-btn">Save Changes</button>
              </div>
            </form>

            <form id="profile-password-form" class="profile-panel" onsubmit="saveProfilePassword(event)">
              <div class="profile-email-notice">
                A six-digit verification code will be sent to
                <strong id="profile-reset-email">—</strong>.
              </div>

              <div id="profile-password-step-request">
                <p class="profile-hint">For your security, password changes must be verified through your registered email.</p>
                <div class="form-actions" style="justify-content:flex-end">
                  <button type="button" class="btn btn--ghost" onclick="closeProfileModal()">Cancel</button>
                  <button type="button" class="btn btn--primary" id="profile-send-otp-btn" onclick="requestProfilePasswordOtp()">Send Verification Code</button>
                </div>
              </div>

              <div id="profile-password-step-verify" style="display:none">
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label" for="profile-reset-otp">Six-digit OTP <span>*</span></label>
                    <input class="form-input" id="profile-reset-otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="Enter the code from your email" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="profile-new-password">New Password <span>*</span></label>
                    <input class="form-input" id="profile-new-password" type="password" autocomplete="new-password" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="profile-confirm-password">Confirm New Password <span>*</span></label>
                    <input class="form-input" id="profile-confirm-password" type="password" autocomplete="new-password" required />
                  </div>
                </div>
                <p class="profile-hint">Must be at least 8 characters and include one capital letter, one number, and one special character.</p>
                <div class="form-actions" style="justify-content:space-between">
                  <button type="button" class="btn btn--ghost" id="profile-resend-otp-btn" onclick="requestProfilePasswordOtp()">Resend Code</button>
                  <div style="display:flex;gap:8px">
                    <button type="button" class="btn btn--ghost" onclick="closeProfileModal()">Cancel</button>
                    <button type="submit" class="btn btn--primary" id="profile-password-btn">Reset Password</button>
                  </div>
                </div>
              </div>

              <p class="profile-hint" id="profile-password-status" role="status" aria-live="polite"></p>
            </form>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrapper.firstElementChild);

    const modal = document.getElementById('profile-modal');
    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) closeProfileModal();
      });
    }

    if (!profileEscapeWired) {
      profileEscapeWired = true;
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        const profileModal = document.getElementById('profile-modal');
        if (profileModal && profileModal.classList.contains('show')) closeProfileModal();
      });
    }
  }

  const userBlock = document.querySelector('.sidebar__user');
  if (userBlock && !userBlock.dataset.profileWired) {
    userBlock.dataset.profileWired = '1';
    userBlock.setAttribute('role', 'button');
    userBlock.setAttribute('tabindex', '0');
    userBlock.setAttribute('aria-label', 'Open my profile');
    userBlock.setAttribute('aria-haspopup', 'dialog');
    userBlock.title = 'View my profile';
    userBlock.addEventListener('click', function (event) {
      if (event.target.closest('#role-switch-trigger')) return;
      openProfileModal();
    });
    userBlock.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openProfileModal();
    });
  }
}

async function refreshProfile() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch(`${AUTH_API_BASE}/me`, {
      headers: getAuthHeaders()
    });
    const result = await response.json();

    if (response.ok && result.success && result.user) {
      applyProfileUser(result.user);
      fillProfileForm(result.user);
    }
  } catch (error) {
    console.error('Profile refresh failed:', error);
  }
}

function openProfileModal() {
  ensureProfileModal();

  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  switchProfileTab('info');
  fillProfileForm(CURRENT_USER);
  resetProfilePasswordFlow();
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');

  const usernameInput = document.getElementById('profile-username');
  if (usernameInput) usernameInput.focus();

  refreshProfile();
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  resetProfilePasswordFlow();
}

function switchProfileTab(tab) {
  const isInfo = tab === 'info';
  const infoTab = document.getElementById('profile-tab-info');
  const passwordTab = document.getElementById('profile-tab-password');
  const infoPanel = document.getElementById('profile-info-form');
  const passwordPanel = document.getElementById('profile-password-form');

  if (infoTab) {
    infoTab.classList.toggle('active', isInfo);
    infoTab.setAttribute('aria-selected', String(isInfo));
  }
  if (passwordTab) {
    passwordTab.classList.toggle('active', !isInfo);
    passwordTab.setAttribute('aria-selected', String(!isInfo));
  }
  if (infoPanel) infoPanel.classList.toggle('active', isInfo);
  if (passwordPanel) passwordPanel.classList.toggle('active', !isInfo);
}

async function saveProfile(event) {
  event.preventDefault();

  const fullNameInput = document.getElementById('profile-full-name');
  const usernameInput = document.getElementById('profile-username');
  const emailInput = document.getElementById('profile-email');
  const saveBtn = document.getElementById('profile-save-btn');

  const fullName = String(fullNameInput?.value || '').trim();
  const username = String(usernameInput?.value || '').trim();
  const email = String(emailInput?.value || '').trim();

  if (!fullName) {
    showToast('Full name is required.', 'error');
    fullNameInput?.focus();
    return;
  }

  if (!username) {
    showToast('Username or email is required.', 'error');
    usernameInput?.focus();
    return;
  }

  if (saveBtn) saveBtn.disabled = true;

  try {
    const response = await fetch(`${AUTH_API_BASE}/me`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ full_name: fullName, username, email })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to update your profile.');
    }

    applyProfileUser(result.user, result.token);
    fillProfileForm(result.user);

    showToast(result.message || 'Profile updated successfully.', 'success');
  } catch (error) {
    console.error('Profile update failed:', error);
    showToast(error.message || 'Unable to update your profile.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function setProfilePasswordStatus(message, type) {
  const status = document.getElementById('profile-password-status');
  if (!status) return;

  status.textContent = message || '';
  status.style.color = type === 'error'
    ? 'var(--danger)'
    : (type === 'success' ? 'var(--success-dark)' : '');
}

function resetProfilePasswordFlow() {
  const requestStep = document.getElementById('profile-password-step-request');
  const verifyStep = document.getElementById('profile-password-step-verify');
  if (requestStep) requestStep.style.display = '';
  if (verifyStep) verifyStep.style.display = 'none';

  ['profile-reset-otp', 'profile-new-password', 'profile-confirm-password']
    .forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });

  setProfilePasswordStatus('');

  const emailEl = document.getElementById('profile-reset-email');
  const email = String(CURRENT_USER?.email || '').trim();
  if (emailEl) emailEl.textContent = email || 'no email address on file';
}

async function requestProfilePasswordOtp() {
  const email = String(CURRENT_USER?.email || '').trim();
  const requestBtn = document.getElementById('profile-send-otp-btn');
  const resendBtn = document.getElementById('profile-resend-otp-btn');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setProfilePasswordStatus('Please add a valid email address in Profile Information first.', 'error');
    switchProfileTab('info');
    document.getElementById('profile-email')?.focus();
    return;
  }

  if (requestBtn) requestBtn.disabled = true;
  if (resendBtn) resendBtn.disabled = true;
  setProfilePasswordStatus('Sending verification code...');

  try {
    const response = await fetch(`${AUTH_API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to send the verification code.');
    }

    const requestStep = document.getElementById('profile-password-step-request');
    const verifyStep = document.getElementById('profile-password-step-verify');
    if (requestStep) requestStep.style.display = 'none';
    if (verifyStep) verifyStep.style.display = '';

    setProfilePasswordStatus(
      'A six-digit verification code has been sent to your email. Check your inbox and spam folder.',
      'success'
    );

    document.getElementById('profile-reset-otp')?.focus();
  } catch (error) {
    console.error('Profile OTP request failed:', error);
    setProfilePasswordStatus(
      error.message || 'Unable to send the verification code.',
      'error'
    );
  } finally {
    if (requestBtn) requestBtn.disabled = false;
    if (resendBtn) resendBtn.disabled = false;
  }
}

async function saveProfilePassword(event) {
  event.preventDefault();

  const email = String(CURRENT_USER?.email || '').trim();
  const otpInput = document.getElementById('profile-reset-otp');
  const newInput = document.getElementById('profile-new-password');
  const confirmInput = document.getElementById('profile-confirm-password');
  const saveBtn = document.getElementById('profile-password-btn');

  const otp = String(otpInput?.value || '').trim();
  const newPassword = String(newInput?.value || '');
  const confirmPassword = String(confirmInput?.value || '');

  if (!email) {
    setProfilePasswordStatus('Please add an email address in Profile Information first.', 'error');
    switchProfileTab('info');
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    setProfilePasswordStatus('Please enter the six-digit code from your email.', 'error');
    otpInput?.focus();
    return;
  }

  if (!newPassword || !confirmPassword) {
    setProfilePasswordStatus('Please enter and confirm your new password.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    setProfilePasswordStatus('New passwords do not match.', 'error');
    confirmInput?.focus();
    return;
  }

  if (!isStrongPasswordClient(newPassword)) {
    setProfilePasswordStatus('Password must be at least 8 characters and include a capital letter, a number, and a special character.', 'error');
    newInput?.focus();
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  setProfilePasswordStatus('Verifying code and updating password...');

  try {
    const response = await fetch(`${AUTH_API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, newPassword })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to reset your password.');
    }

    setProfilePasswordStatus(result.message || 'Password reset successfully.', 'success');
    showToast(result.message || 'Password reset successfully.', 'success');

    setTimeout(() => closeProfileModal(), 900);
  } catch (error) {
    console.error('Password reset failed:', error);
    setProfilePasswordStatus(error.message || 'Unable to reset your password.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function fmt(n) {
  return Number(n).toLocaleString('en-US');
}

// One control-number format everywhere: CTRL-YY-####
function buildControlNo(appId) {
  const digits = String(appId || '').replace(/\D/g, '');
  const yy = String(new Date().getFullYear()).slice(-2);
  return 'CTRL-' + yy + '-' + (digits ? digits.slice(-4).padStart(4, '0') : '0001');
}

function applyDashboardMetrics() {
  const data = analyticsScope();
  const cards = document.querySelectorAll('#mod-dashboard > .cards-grid .stat-card');
  const isAdmin = CURRENT_ROLE === 'Admin';
  const dashboardStats = isAdmin
    ? [
      ['Total Applications', fmt(data.totalApplications), '+47 submitted today'],
      ['Pending Review', fmt(data.pendingReview), `${fmt(data.pending)} pending + ${fmt(data.inReview)} in review`],
      ['Approved', fmt(data.approved), `${((data.approved / data.totalApplications) * 100).toFixed(1)}% approval rate`],
      ['Rejected', fmt(data.rejected), `${((data.rejected / data.totalApplications) * 100).toFixed(1)}% rejection rate`]
    ]
    : [
      ['Assigned Applications', fmt(data.totalApplications), 'Current staff workload'],
      ['Needs Review', fmt(data.pendingReview), `${fmt(data.pending)} pending + ${fmt(data.inReview)} in review`],
      ['Completed', fmt(data.approved), 'Approved from assigned queue'],
      ['Returned', fmt(data.rejected), 'Returned or rejected for correction']
    ];

  cards.forEach((card, index) => {
    const stat = dashboardStats[index];
    if (!stat) return;
    const label = card.querySelector('.stat-card__label');
    const value = card.querySelector('.stat-card__value');
    const sub = card.querySelector('.stat-card__sub');
    if (label) label.textContent = stat[0];
    if (value) value.textContent = stat[1];
    if (sub) sub.textContent = stat[2];
  });

  // Dynamic admin KPI strip (5-card row)
  const adminKpiStrip = document.querySelector('#mod-dashboard > .admin-kpi-strip');
  if (adminKpiStrip) {
    const kpiCards = adminKpiStrip.querySelectorAll('.stat-card');
    // Card 0: Total Registered Citizens
    if (kpiCards[0]) {
      kpiCards[0].querySelector('.stat-card__value').textContent = fmt(data.totalApplications);
      kpiCards[0].querySelector('.stat-card__sub').textContent = 'Overall demographic volume';
    }
    // Card 1 / 2 / 3 / 4: static (Active Users, Uptime, Security Alerts, Backup) — set by admin.js
  }

  // System Metrics Panel values
  const metricReceived = document.getElementById('metric-received');
  if (metricReceived) metricReceived.textContent = fmt(SUBMITTED[SUBMITTED.length - 1] || data.totalApplications);

  const applicantsBadge = document.querySelector('[data-module="applicants"] .nav-link__badge');
  if (applicantsBadge) {
    const ongoingCount = (Array.isArray(FULL_APPLICANTS) ? FULL_APPLICANTS : []).filter(application => {
      const status = String(application.status || '').trim().toLowerCase();
      return status !== 'completed' && status !== 'rejected';
    }).length;
    applicantsBadge.textContent = fmt(ongoingCount);
    applicantsBadge.title = 'Ongoing applications: all statuses except Completed and Rejected';
  }

  document.querySelectorAll('.data-table-card').forEach(card => {
    const title = card.querySelector('.table-header__title')?.textContent?.trim();
    const footer = card.querySelector('.table-footer__info');
    if (!footer) return;
    if (title === 'Recent Submissions') {
      const visible =
        document.querySelectorAll(
          '#recent-submissions-tbody tr'
        ).length;

      footer.textContent =
        `Showing ${visible} of ${fmt(data.pendingReview)} pending review submissions`;
    }
  });
}

function applyAnalyticsRoleView() {
  const data = analyticsScope();
  const title = document.getElementById('analytics-title');
  const subtitle = document.getElementById('analytics-subtitle');
  const badge = document.getElementById('analytics-scope-badge');
  if (title) title.textContent = data.title;
  if (subtitle) subtitle.textContent = data.subtitle;
  if (badge) badge.textContent = data.scopeLabel;

  const analyticsValues = {
    'analytics-status-approved': data.approved,
    'analytics-status-pending': data.pending,
    'analytics-status-review': data.inReview,
    'analytics-status-rejected': data.rejected,
    'analytics-kpi-pending': data.pendingReview || data.pending,
    'analytics-kpi-review': data.inReview,
    'analytics-kpi-ready': data.approved,
    'analytics-kpi-rejected': data.rejected
  };
  Object.keys(analyticsValues).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = fmt(analyticsValues[id]);
  });

  document.querySelectorAll('#mod-analytics .report-controls .mini-btn').forEach(btn => {
    btn.style.display = CURRENT_ROLE === 'Admin' ? '' : 'none';
  });

  // Exports are restricted to Admin/Staff — ID Maker can view reports only
  const canExport = (ROLE_PERMS[CURRENT_ROLE] || ROLE_PERMS.Staff).export;
  document.querySelectorAll('#mod-analytics select[onchange*="exportData"]').forEach(sel => {
    sel.style.display = canExport ? '' : 'none';
  });

  if (
    chartsReady &&
    document
      .getElementById('mod-analytics')
      ?.classList
      .contains('active')
  ) {
    initAllCharts();
  }
}

function toggleRoleSwitcher() {
  if (!ENABLE_DEV_ROLE_SWITCHER) return;
  if (CURRENT_ROLE !== 'Admin') return;
  const rs = document.getElementById('role-switcher');
  if (!rs) return;
  rs.style.display = rs.style.display === 'none' ? 'block' : 'none';
}

function setRole(role, silent = false) {
  // User-initiated role changes are dev-only; internal bootstrap calls pass
  // silent=true with the role resolved from the authenticated session.
  if (!ENABLE_DEV_ROLE_SWITCHER && !silent) {
    showToast('Role switching is disabled in this build.', 'error');
    return;
  }
  const roleMap = { 'Admin': 'Admin', 'Staff': 'Staff', 'ID Maker': 'ID Maker' };
  CURRENT_ROLE = roleMap[normalizeRole(role)] || 'Staff';
  if (CURRENT_USER) CURRENT_USER.role = CURRENT_ROLE;
  updateRoleUI();
  applyRoleToUI();
  if (!silent) showToast('Role set to ' + CURRENT_ROLE + ' (demo)', 'success');
}

function applyRoleToUI() {
  const p = ROLE_PERMS[CURRENT_ROLE] || ROLE_PERMS.Staff;
  const homeModule = CURRENT_ROLE === 'ID Maker' ? 'id-maker-dashboard' : 'dashboard';

  const btnApprove = document.getElementById('btn-approve');
  const btnReject = document.getElementById('btn-reject');
  const btnSave = document.getElementById('btn-save');
  if (btnApprove) btnApprove.style.display = p.approve ? '' : 'none';
  if (btnReject) btnReject.style.display = p.reject ? '' : 'none';
  if (btnSave) btnSave.style.display = (p.approve || p.reject || p.print) ? '' : 'none';

  document.querySelectorAll('[data-export]').forEach(el => {
    el.disabled = !p.export;
    el.style.opacity = p.export ? '1' : '.55';
  });

  const adminOpsPanel = document.getElementById('admin-ops-panel');
  if (adminOpsPanel) adminOpsPanel.style.display = (CURRENT_ROLE === 'Admin') ? 'grid' : 'none';

  const aiInsightsPanel = document.getElementById('ai-insights-panel');
  if (aiInsightsPanel) aiInsightsPanel.style.display = (CURRENT_ROLE === 'Admin' || CURRENT_ROLE === 'ID Maker') ? '' : 'none';

  // Staff-only nav links: Small Form Issuance — hidden for Admin, shown for Staff
  // Staff + ID Maker nav links (Applications, ID Issuance): hidden for Admin and ID Maker
  const isPrinterRole = (CURRENT_ROLE === 'Staff');
  const staffOnlyLinks = document.querySelectorAll('.nav-link.staff-only');
  staffOnlyLinks.forEach(link => {
    link.style.display = isPrinterRole ? '' : 'none';
  });
  // ID Maker Dashboard nav: shown only to ID Maker accounts
  const idMakerOnlyLinks = document.querySelectorAll('.nav-link.id-maker-only');
  idMakerOnlyLinks.forEach(link => {
    link.style.display = (CURRENT_ROLE === 'ID Maker') ? '' : 'none';
  });
  // Admin-only nav links (Admin Console): shown only to Admin accounts
  const adminOnlyLinks = document.querySelectorAll('.nav-link.admin-only');
  adminOnlyLinks.forEach(link => {
    link.style.display = (CURRENT_ROLE === 'Admin') ? '' : 'none';
  });
  // Admin-hidden nav links (transactional screens): hidden for Admin and ID Maker, shown for Staff
  // NOTE: must set explicit 'flex' — the '.admin-hidden' CSS forces display:none,
  // so clearing inline style ('' ) would fall back to hidden. 'flex' overrides it.
  const adminHiddenLinks = document.querySelectorAll('.nav-link.admin-hidden');
  adminHiddenLinks.forEach(link => {
    link.style.display = (CURRENT_ROLE === 'Admin' || CURRENT_ROLE === 'ID Maker') ? 'none' : 'flex';
  });
  // Dashboard "View all submissions" button links to the staff-only applicants screen —
  // hide it for Admin so it doesn't attempt a blocked transaction.
  const viewAllSubBtn = document.getElementById('btn-view-all-submissions');
  if (viewAllSubBtn) viewAllSubBtn.style.display = (CURRENT_ROLE === 'Admin') ? 'none' : '';
  // Section labels visibility: "Admin Console" → Admin only; "Staff Section" → Staff only
  const adminSectionLabels = document.querySelectorAll('.sidebar__section .sidebar__section-label');
  adminSectionLabels.forEach(lbl => {
    const t = lbl.textContent.trim();
    if (t === 'Admin Console') lbl.style.display = (CURRENT_ROLE === 'Admin') ? '' : 'none';
    if (t === 'Staff Section') lbl.style.display = (CURRENT_ROLE === 'Staff') ? '' : 'none';
    if (t === 'Main Menu') lbl.style.display = (CURRENT_ROLE === 'ID Maker') ? 'none' : '';
  });
  // Redirect out of admin-only modules for non-admins
  const adminOnlyModules = ['user-mgmt', 'audit-logs', 'system-config', 'backup'];
  if (CURRENT_ROLE !== 'Admin') {
    adminOnlyModules.forEach(mod => {
      const el = document.getElementById('mod-' + mod);
      if (el && el.classList.contains('active')) navigate(homeModule);
    });
  }
  // Main Dashboard nav: hidden for ID Maker (they use the ID Maker Dashboard)
  const dashboardNav = document.querySelector('[data-module="dashboard"]');
  if (dashboardNav) dashboardNav.style.display = (CURRENT_ROLE === 'ID Maker') ? 'none' : '';

  // Redirect out of unauthorized modules
  const staffOnlyModules = ['applicants', 'applications', 'analytics', 'id-issuance'];
  if (CURRENT_ROLE === 'Admin') {
    staffOnlyModules.forEach(mod => {
      const el = document.getElementById('mod-' + mod);
      if (el && el.classList.contains('active')) navigate(homeModule);
    });
  }
  if (CURRENT_ROLE === 'ID Maker') {
    ['dashboard', 'applicants', 'applications', 'analytics', 'id-issuance'].forEach(mod => {
      const el = document.getElementById('mod-' + mod);
      if (el && el.classList.contains('active')) navigate(homeModule);
    });
  }

  const roleSwitchTrigger = document.getElementById('role-switch-trigger');
  const roleSwitcher = document.getElementById('role-switcher');
  const devSwitcherAllowed = ENABLE_DEV_ROLE_SWITCHER && p.settings;
  if (roleSwitchTrigger) roleSwitchTrigger.style.display = devSwitcherAllowed ? '' : 'none';
  if (roleSwitcher && !devSwitcherAllowed) roleSwitcher.style.display = 'none';
}

async function handleLogin(event) {
  event.preventDefault();

  const submitButton = document.getElementById('login-submit-btn');
  if (submitButton?.classList.contains('loading')) {
    return;
  }

  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const recaptchaError = document.getElementById('err-recaptcha');

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  // Clear previous errors
  clearFieldError('login-username');
  clearFieldError('login-password');

  if (recaptchaError) {
    recaptchaError.textContent = '';
    recaptchaError.classList.remove('visible');
  }

  // Basic field validation
  let hasError = false;

  if (!username) {
    showFieldError(
      'login-username',
      'Username is required.'
    );

    hasError = true;
  }

  if (!password) {
    showFieldError(
      'login-password',
      'Password is required.'
    );

    hasError = true;
  }

  if (hasError) {
    return;
  }

  // Check reCAPTCHA
  const recaptchaResponse =
    typeof grecaptcha !== 'undefined'
      ? grecaptcha.getResponse()
      : '';

  if (!recaptchaResponse) {
    if (recaptchaError) {
      recaptchaError.textContent =
        'Please complete the CAPTCHA.';
      recaptchaError.classList.add('visible');
    }

    return;
  }

  // Show spinner
  const btn =
    document.getElementById('login-submit-btn');

  if (btn) {
    btn.classList.add('loading');
  }

  try {
    // Send login request to backend
    const response = await fetch(
      'https://management-backend-3cij.onrender.com/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier: username,
          password
        })
      }
    );

    const result = await response.json();

    // Login failed
    if (!response.ok || !result.success) {
      if (btn) {
        btn.classList.remove('loading');
      }

      // Reset CAPTCHA after failed login
      if (typeof grecaptcha !== 'undefined') {
        grecaptcha.reset();
      }

      showFieldError(
        'login-password',
        result.message ||
        'Incorrect username/email or password. Please try again.'
      );

      if (passwordEl) {
        passwordEl.focus();
      }

      return;
    }

    const user = result.user;
    const token = result.token;

    // Make sure the backend actually returned a token
    if (!token) {
      console.error(
        'Login succeeded but no authentication token was returned.'
      );

      if (btn) {
        btn.classList.remove('loading');
      }

      showFieldError(
        'login-password',
        'Login succeeded, but the secure session could not be created.'
      );

      return;
    }

    // Convert database role to the role names
    let frontendRole;

    if (user.role === 'admin') {
      frontendRole = 'Admin';

    } else if (user.role === 'staff') {
      frontendRole = 'Staff';

    } else if (user.role === 'idmaker') {
      frontendRole = 'ID Maker';

    } else {
      if (btn) {
        btn.classList.remove('loading');
      }

      showFieldError(
        'login-password',
        'Invalid user role.'
      );

      return;
    }

    // Create the user object used by the existing frontend

    const authUser = {
      id: user.id,
      username: user.username,
      fullName: user.full_name || user.username,
      role: frontendRole,
      email: user.email,
      displayName: user.full_name || user.username
    };

    // Update current application session
    CURRENT_USER = authUser;

    setRole(authUser.role, true);
    applySessionContext();

    // SAVE THE JWT TOKEN WITH THE EXISTING SESSION

    const sessionData = {
      id: authUser.id,
      username: authUser.username,
      full_name: authUser.fullName,
      role: authUser.role,
      email: authUser.email,
      displayName: authUser.displayName,

      // JWT returned by the backend
      token: token
    };

    const sessionSaved = writeAuthSession(
      JSON.stringify(sessionData)
    );

    if (!sessionSaved) {
      if (btn) {
        btn.classList.remove('loading');
      }

      showFieldError(
        'login-password',
        'Unable to create a secure login session. Please try again.'
      );

      return;
    }

    // Redirect to the correct portal

    if (PAGE === 'login') {
      location.href = portalFileForRole(
        authUser.role
      );

      return;
    }

    if (btn) {
      btn.classList.remove('loading');
    }

    showPortalPage();

    navigate(
      authUser.role === 'ID Maker'
        ? 'id-maker-dashboard'
        : 'dashboard'
    );

    showToast(
      `Signed in as ${authUser.role}.`,
      'success'
    );

  } catch (error) {
    console.error(
      'Login error:',
      error
    );

    if (btn) {
      btn.classList.remove('loading');
    }

    showFieldError(
      'login-password',
      'Unable to connect to the login server. Please try again.'
    );
  }
}

// LOGIN reCAPTCHA

function handleLoginRecaptchaSuccess() {
  const error =
    document.getElementById('err-recaptcha');

  if (error) {
    error.textContent = '';
    error.classList.remove('visible');
  }
}

function handleLoginRecaptchaExpired() {
  const error =
    document.getElementById('err-recaptcha');

  if (error) {
    error.textContent =
      'CAPTCHA expired. Please complete it again.';

    error.classList.add('visible');
  }
}

/* ── Login page helpers ── */
function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const errId = 'err-' + inputId.replace('login-', '');
  const err = document.getElementById(errId);
  if (input) input.classList.add('field-invalid');
  if (err) { err.textContent = message; err.classList.add('visible'); }
}

function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  const errId = 'err-' + inputId.replace('login-', '');
  const err = document.getElementById(errId);
  if (input) input.classList.remove('field-invalid');
  if (err) { err.textContent = ''; err.classList.remove('visible'); }
}

function checkCapsLock(event) {
  const warn = document.getElementById('caps-warn');
  if (!warn) return;
  const isOn = event.getModifierState && event.getModifierState('CapsLock');
  warn.classList.toggle('visible', isOn);
}



function togglePwVis(btn) {
  const wrap = btn.closest('.auth-input-wrap');
  const input = wrap && wrap.querySelector('input');
  if (!input) return;
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  const icon = btn.querySelector('i');
  if (icon) { icon.classList.toggle('fi-rr-eye', isText); icon.classList.toggle('fi-rr-eye-crossed', !isText); }
}

/* ── Live hero clock ── */
(function initHeroClock() {
  const el = document.getElementById('auth-hero-clock');
  if (!el) return;
  function tick() {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    el.textContent = date + ' · ' + time;
  }
  tick();
  setInterval(tick, 1000);
})();

function restoreSession() {
  const raw = readAuthSession();

  const loggedOut =
    new URLSearchParams(
      location.search
    ).get('loggedout') === '1';

  // =====================================================
  // NO SESSION
  // =====================================================

  if (!raw) {

    if (PAGE === 'login') {

      showLoginPage();

      if (loggedOut) {
        const reason = new URLSearchParams(location.search).get('reason');
        applyLoginFlash(
          reason === 'inactivity'
            ? 'You were automatically signed out after 5 minutes of inactivity.'
            : 'Session ended for data privacy protection',
          'info'
        );
      }

      return;
    }

    // Protected page without login
    location.href = 'login.html';
    return;
  }


  // =====================================================
  // READ SESSION
  // =====================================================

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {

    console.error(
      'Invalid authentication session:',
      error
    );

    clearAuthSession();
    location.href = 'login.html';
    return;
  }


  // =====================================================
  // BASIC SESSION VALIDATION
  // =====================================================

  if (
    !parsed ||
    !parsed.username ||
    !parsed.role
  ) {

    console.error(
      'Authentication session is missing required fields.'
    );

    clearAuthSession();

    if (PAGE === 'login') {
      showLoginPage();
      return;
    }

    location.href = 'login.html';
    return;
  }


  // =====================================================
  // NORMALIZE ROLE
  // =====================================================

  const normalizedRole =
    normalizeRole(parsed.role);


  console.log(
    'Restoring authenticated session:',
    {
      username: parsed.username,
      storedRole: parsed.role,
      normalizedRole: normalizedRole,
      currentPage: PAGE
    }
  );


  // =====================================================
  // RESTORE USER
  // =====================================================

  CURRENT_USER = {
    id: parsed.id || null,

    username:
      parsed.username,

    fullName:
      parsed.full_name || parsed.displayName || parsed.username,

    role:
      normalizedRole,

    email:
      parsed.email || '',

    displayName:
      parsed.full_name || parsed.displayName || parsed.username,

    token:
      parsed.token || ''
  };


  // =====================================================
  // APPLY ROLE
  // =====================================================

  try {

    setRole(
      normalizedRole,
      true
    );

    applySessionContext();

  } catch (error) {

    // IMPORTANT:
    // Do NOT destroy a valid login session just
    // because a portal UI function has an error.

    console.error(
      'Portal UI initialization error while restoring session:',
      error
    );

  }


  // =====================================================
  // LOGIN PAGE
  // =====================================================

  if (PAGE === 'login') {

    location.href =
      portalFileForRole(
        normalizedRole
      );

    return;
  }


  // =====================================================
  // CHECK WHETHER THIS PAGE MATCHES THE ROLE
  // =====================================================

  const pageMatchesRole =
    (
      PAGE === 'admin' &&
      normalizedRole === 'Admin'
    ) ||
    (
      PAGE === 'staff' &&
      normalizedRole === 'Staff'
    ) ||
    (
      PAGE === 'idmaker' &&
      normalizedRole === 'ID Maker'
    );


  if (!pageMatchesRole) {

    const expectedPortal =
      portalFileForRole(
        normalizedRole
      );

    console.warn(
      'Current page does not match authenticated role.',
      {
        currentPage: PAGE,
        role: normalizedRole,
        expectedPortal: expectedPortal
      }
    );

    location.href =
      expectedPortal;

    return;
  }


  // =====================================================
  // SHOW PORTAL
  // =====================================================

  try {

    showPortalPage();

    navigate(
      normalizedRole === 'ID Maker'
        ? 'id-maker-dashboard'
        : 'dashboard'
    );

  } catch (error) {

    console.error(
      'Portal navigation error:',
      error
    );

  }
}

/* NEW: Application Detail Modal + Workflow + Docs + Audit */
const FULL_APPLICANTS = [];
const APP_DB = {};
const ID_MAKER_QUEUE = [];
let ID_MAKER_QUEUE_APPLICATION_IDS = new Set();
let ID_MAKER_QUEUE_APPLICATION_IDS_PROMISE = null;
const ID_MAKER_LOCAL_QUEUE_KEY = 'seniorid_id_maker_local_queue';

function getLocalIdMakerQueue() {
  try {
    const raw = localStorage.getItem(ID_MAKER_LOCAL_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalIdMakerQueue(queueEntry, broadcastUpdate = true) {
  try {
    const list = getLocalIdMakerQueue();
    const targetId = String(queueEntry.id || queueEntry.application_id);
    const idx = list.findIndex(item => String(item.id || item.application_id) === targetId);
    if (idx >= 0) {
      list[idx] = Object.assign({}, list[idx], queueEntry);
    } else {
      list.unshift(queueEntry);
    }
    localStorage.setItem(ID_MAKER_LOCAL_QUEUE_KEY, JSON.stringify(list));
    // Broadcast only when requested. The ID Maker page updates its own
    // table in memory after a successful API response; broadcasting from
    // that same page would make its listener reload the entire dashboard.
    if (broadcastUpdate && typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('idmaker_queue_channel');
        bc.postMessage({ type: 'QUEUE_UPDATED', entry: queueEntry, queue: list });
        bc.close();
      } catch (err) { }
    }
  } catch (e) {
    console.warn('Could not save to local ID maker queue:', e);
  }
}

let CURRENT_APP_ID = null;

function syncApplicationsToAppDB(applications) {
  if (!Array.isArray(applications)) return;

  applications.forEach(application => {
    const id =
      application.application_id ||
      application.applicationId ||
      application.id;

    if (!id) return;

    const firstName =
      application.first_name ||
      application.firstName ||
      '';

    const middleName =
      application.middle_name ||
      application.middleName ||
      '';

    const surname =
      application.surname ||
      application.last_name ||
      application.lastName ||
      '';

    const fullName =
      application.name ||
      [firstName, middleName, surname]
        .filter(Boolean)
        .join(' ');

    APP_DB[id] = {
      id: id,

      name: fullName,

      firstName: firstName,
      middleName: middleName,
      surname: surname,

      address:
        application.house_street ||
        application.houseStreet ||
        application.address ||
        '',

      barangay:
        application.barangay_district ||
        application.barangayDistrict ||
        application.barangay ||
        '',

      dob:
        application.date_of_birth ||
        application.dateOfBirth ||
        application.dob ||
        '',

      gender:
        application.sex ||
        application.gender ||
        '',

      age:
        application.age ||
        '',

      birthplace:
        application.place_of_birth ||
        application.placeOfBirth ||
        application.birthplace ||
        '',

      civilStatus:
        application.civil_status ||
        application.civilStatus ||
        '',

      education:
        application.educational_attainment ||
        application.educationalAttainment ||
        application.education ||
        '',

      religion:
        application.religion ||
        '',

      occupation:
        application.occupation ||
        '',

      contactNumber:
        application.contact_number ||
        application.contactNumber ||
        '',

      idOsca:
        application.osca_id_number ||
        application.oscaIdNumber ||
        application.idOsca ||
        '',

      idSss:
        application.sss_id_number ||
        application.sssIdNumber ||
        application.idSss ||
        '',

      idPhilhealth:
        application.philhealth_id_number ||
        application.philhealthIdNumber ||
        application.idPhilhealth ||
        '',

      idGsis:
        application.gsis_id_number ||
        application.gsisIdNumber ||
        application.idGsis ||
        '',

      idTin:
        application.tin_id_number ||
        application.tinIdNumber ||
        application.idTin ||
        '',

      status:
        application.status ||
        'Pending',

      validation_status:
        application.validation_status || null,

      documentAuthentications:
        Array.isArray(application.documentAuthentications)
          ? application.documentAuthentications
          : [],

      regDate:
        application.created_at ||
        application.createdAt ||
        application.submitted_at ||
        application.submittedAt ||
        '',

      photo:
        application.documents?.photo ||
        application.documents?.photo_url ||
        application.documents?.photoUrl ||
        application.photo ||
        application.photo_url ||
        application.photoUrl ||
        application.photo_path ||
        application.photoPath ||
        '',

      signature:
        application.documents?.signature ||
        application.documents?.signature_url ||
        application.documents?.signatureUrl ||
        application.signature ||
        application.signature_url ||
        application.signatureUrl ||
        application.signature_path ||
        application.signaturePath ||
        ''
    };
  });

  initSmallFormIssuance();

  // Skeleton: clear KPI shimmer now that live data is synced
  if (typeof Skeleton !== 'undefined') {
    if (typeof Skeleton.setAllKpisLoading === 'function') {
      Skeleton.setAllKpisLoading(false);
    } else {
      Skeleton.setLoading(document.querySelectorAll('.stat-card__value'), false);
    }
  }

  // Refresh the form if an applicant is already selected
  updatePreview();
}

function ensureExampleData(app) {
  const parts = (app.name || '').trim().replace(/\s+/g, ' ').split(' ');
  if (app.surname === undefined) {
    app.surname = parts.length > 1 ? parts[parts.length - 1] : (app.name || 'Applicant');
    app.firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : (app.name || '');
    app.middleName = '';
  }
  const age = app.age || 70;
  if (app.civilStatus === undefined) app.civilStatus = age >= 65 ? 'Widower' : 'Married';
  if (app.birthplace === undefined) app.birthplace = 'Bauan, Batangas';
  if (app.education === undefined) app.education = 'High School Graduate';
  if (app.religion === undefined) app.religion = 'Roman Catholic';
  if (app.occupation === undefined) app.occupation = 'Retired';
  if (app.applicationType === undefined) {
    if (typeof getApplicationRequestType === 'function') {
      app.applicationType = getApplicationRequestType(app);
    } else {
      const idStr = String(app.id || '');
      let hash = 0;
      for (let i = 0; i < idStr.length; i++) {
        hash = (hash * 31 + idStr.charCodeAt(i)) >>> 0;
      }
      app.applicationType = (hash % 4 === 0) ? 'Replacement' : 'New';
    }
  }
  if (app.idSss === undefined) app.idSss = '34-0000000-0';
  if (app.idPhilhealth === undefined) app.idPhilhealth = '12-000000000-0';
  if (app.idGsis === undefined) app.idGsis = '';
  if (app.idTin === undefined) app.idTin = '';
  if (app.familyComposition === undefined) {
    app.familyComposition = [
      { name: 'Son/Daughter of ' + app.surname, relationship: 'Son/Daughter', age: Math.max(35, age - 28), civilStatus: 'Married', occupation: 'Self-employed', income: 15000 }
    ];
  }
  if (app.membership === undefined) {
    app.membership = {
      associationName: (app.barangay || 'Barangay') + ' Senior Citizens Association',
      associationAddress: (app.barangay || 'Barangay') + ', Bauan, Batangas',
      associationDate: '2019-01-15',
      position: 'Member'
    };
  }
  if (app.personalBackground === undefined) {
    app.personalBackground = {
      incomeSources: ['Pension', 'Dependent Of Children/Relatives'],
      assets: ['House'],
      monthlyIncome: '3,000 - 4,999',
      livingWith: ['Children'],
      skills: [],
      involvement: ['Friendly Visits']
    };
  }
  if (app.problemsNeeds === undefined) {
    app.problemsNeeds = {
      economic: [],
      social: ['Feeling of Loneliness & Isolation'],
      health: ['High Cost of Medicines', 'Lack/No Health Insurance'],
      housing: [],
      communityService: [],
      otherNeeds: ''
    };
  }
  if (app.confirmations === undefined) app.confirmations = { consentAll: true, assistedBy: '', relationToRegistrant: '' };
  if (app.documents === undefined) {
    // TODO(integration): populated from the live system's uploaded documents.
    // Placeholder fields are empty until real document URLs are provided.
    app.documents = {
      idFront: '',
      idBack: '',
      photo: app.photo ? app.photo.replace('w=128', 'w=400') : '',
      bc: '',
      cedula: '',
      signature: ''
    };
  }
  return app;
}

async function openApplicationDetail(appId) {

  // Get the complete application information from the database
  try {
    const response = await fetch(
      `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(appId)}`,
      { headers: getAuthHeaders(), cache: 'no-store' }
    );

    if (response.ok) {
      const result = await response.json();

      if (result.success && result.application) {
        const a = result.application;
        const pb = result.personalBackground || {};
        const pn = result.problemsNeeds || {};
        const membership = result.membership || null;
        const files = result.applicationFiles || null;

        // Convert database data to the format already used by the modal
        const liveApp = {
          id: a.application_id,
          name: [
            a.first_name,
            a.middle_name,
            a.surname
          ].filter(Boolean).join(' '),

          firstName: a.first_name || '',
          middleName: a.middle_name || '',
          surname: a.surname || '',

          dob: a.date_of_birth || '',
          age: a.age,
          gender: a.sex || '',
          birthplace: a.place_of_birth || '',
          civilStatus: a.civil_status || '',
          address: a.house_street || '',
          barangay: a.barangay_district || '',
          education: a.educational_attainment || '',
          religion: a.religion || '',
          occupation: a.occupation || '',
          contactNumber: a.contact_number || '',

          idOsca: a.osca_id_number || '',
          idSss: a.sss_id_number || '',
          idPhilhealth: a.philhealth_id_number || '',
          idGsis: a.gsis_id_number || '',
          idTin: a.tin_id_number || '',

          status: result.statusHistory?.[0]?.status || 'Pending',

          // Saved validation result from database
          validation_status: a.validation_status || null,
          validation_updated_at: a.validation_updated_at || null,
          validation_notes: a.validation_notes || null,

          // Family composition
          familyComposition: (result.familyComposition || []).map(member => ({
            name: member.name || '',
            relationship: member.relationship || '',
            age: member.age ?? '',
            civilStatus: member.civil_status || '',
            occupation: member.occupation || '',
            income: Number(member.income) || 0
          })),

          // Membership
          membership: membership ? {
            associationName: membership.association_name || '',
            associationAddress: membership.association_address || '',
            associationDate: membership.association_date || '',
            position: membership.position || ''
          } : null,

          // Personal background
          personalBackground: {
            incomeSources: [
              ['income_own_earnings', 'Own Earnings'],
              ['income_own_pension', 'Pension'],
              ['income_stocks_dividends', 'Stocks / Dividends'],
              ['income_dependent_children', 'Dependent of Children/Relatives'],
              ['income_spouse_salary', 'Spouse Salary'],
              ['income_insurance', 'Insurance'],
              ['income_rentals_sharecroppings', 'Rentals / Sharecropping'],
              ['income_savings', 'Savings'],
              ['income_livestock_crop', 'Livestock / Crop'],
              ['income_other', pb.income_other_specify || 'Other Income']
            ]
              .filter(([key]) => pb[key] === true)
              .map(([, label]) => label),

            assets: [
              ['asset_house', 'House'],
              ['asset_lot', 'Lot'],
              ['asset_farmland', 'Farmland'],
              ['asset_fishponds_resorts', 'Fishponds / Resorts'],
              ['asset_commercial_building', 'Commercial Building'],
              ['asset_other', pb.asset_other_specify || 'Other']
            ]
              .filter(([key]) => pb[key] === true)
              .map(([, label]) => label),

            monthlyIncome:
              pb.monthly_income !== null &&
                pb.monthly_income !== undefined &&
                pb.monthly_income !== ''
                ? `₱${Number(pb.monthly_income).toLocaleString()}`
                : '—',

            livingWith: [
              ['living_alone', 'Alone'],
              ['living_spouse', 'Spouse'],
              ['living_care_institution', 'Care Institution'],
              ['living_children', 'Children'],
              ['living_friends', 'Friends'],
              ['living_common_law_spouse', 'Common-Law Spouse'],
              ['living_grandchildren', 'Grandchildren'],
              ['living_households', 'Household'],
              ['living_relatives', 'Relatives'],
              ['living_in_laws', 'In-Laws'],
              ['living_other', pb.living_other_specify || 'Other']
            ]
              .filter(([key]) => pb[key] === true)
              .map(([, label]) => label),

            skills: [
              ['skill_medical', 'Medical'],
              ['skill_dental', 'Dental'],
              ['skill_farming', 'Farming'],
              ['skill_arts', 'Arts'],
              ['skill_teaching', 'Teaching'],
              ['skill_counseling', 'Counseling'],
              ['skill_fishing', 'Fishing'],
              ['skill_engineering', 'Engineering'],
              ['skill_legal_services', 'Legal Services'],
              ['skill_evangelization', 'Evangelization'],
              ['skill_cooking', 'Cooking'],
              ['skill_vocational', 'Vocational'],
              ['skill_other', pb.skill_other_specify || 'Other']
            ]
              .filter(([key]) => pb[key] === true)
              .map(([, label]) => label),

            involvement: [
              ['involvement_medical', 'Medical'],
              ['involvement_dental', 'Dental'],
              ['involvement_religious', 'Religious'],
              ['involvement_sportsmanship', 'Sportsmanship'],
              ['involvement_resource_volunteer', 'Resource Volunteer'],
              ['involvement_friendly_visits', 'Friendly Visits'],
              ['involvement_counseling_referral', 'Counseling / Referral'],
              ['involvement_legal_services', 'Legal Services'],
              ['involvement_community_leader', 'Community Leader'],
              ['involvement_other', pb.involvement_other_specify || 'Other']
            ]
              .filter(([key]) => pb[key] === true)
              .map(([, label]) => label)
          },

          // Problems and needs
          problemsNeeds: {
            economic: [
              ['economic_lack_income', 'Lack of Income'],
              ['economic_skills_training', pn.economic_skills_training_specify || 'Skills Training'],
              ['economic_livelihood', pn.economic_livelihood_specify || 'Livelihood'],
              ['economic_other', pn.economic_other_specify || 'Other']
            ]
              .filter(([key]) => pn[key] === true)
              .map(([, label]) => label),

            social: [
              ['social_neglect_rejection', 'Neglect / Rejection'],
              ['social_helplessness', 'Feeling of Helplessness'],
              ['social_loneliness', 'Feeling of Loneliness & Isolation'],
              ['social_inadequate_recreation', 'Inadequate Recreation'],
              ['social_senior_friendly_environment', 'Senior-Friendly Environment'],
              ['social_other', pn.social_other_specify || 'Other']
            ]
              .filter(([key]) => pn[key] === true)
              .map(([, label]) => label),

            health: [
              ['health_high_cost_medicine', 'High Cost of Medicines'],
              ['health_lack_medical_professionals', 'Lack of Medical Professionals'],
              ['health_no_sanitation', 'No Sanitation'],
              ['health_no_insurance', 'Lack / No Health Insurance'],
              ['health_lack_hospital', 'Lack of Hospital'],
              ['health_problem', pn.health_problem_specify || 'Health Problem']
            ]
              .filter(([key]) => pn[key] === true)
              .map(([, label]) => label),

            housing: [
              ['housing_overcrowding', 'Overcrowding'],
              ['housing_no_permanent_home', 'No Permanent Home'],
              ['housing_independent_living', 'Independent Living'],
              ['housing_lost_privacy', 'Lost Privacy'],
              ['housing_squatter_area', 'Squatter Area'],
              ['housing_high_rental', 'High Rental Cost'],
              ['housing_other', pn.housing_other_specify || 'Other']
            ]
              .filter(([key]) => pn[key] === true)
              .map(([, label]) => label),

            communityService: [
              ['community_desire_participate', 'Desire to Participate'],
              ['community_skills_to_share', 'Skills to Share'],
              ['community_other', pn.community_other_specify || 'Other']
            ]
              .filter(([key]) => pn[key] === true)
              .map(([, label]) => label),

            otherNeeds: pn.other_specific_needs || ''
          },

          // Real signed document URLs from the backend
          documents: {
            idFront: files?.valid_id_signed_url || '',
            idBack: files?.valid_id_back_signed_url || '',
            photo: files?.latest_photo_signed_url || '',
            bc: files?.birth_certificate_signed_url || '',
            cedula: files?.community_tax_certificate_signed_url || '',
            signature: files?.signature_signed_url || ''
          },

          confirmations: result.confirmations || null,
          documentAuthentications: result.documentAuthentications || [],
          statusHistory: result.statusHistory || []
        };

        // Store the real database record where the existing modal expects it
        APP_DB[appId] = liveApp;
      }
    }
  } catch (error) {
    console.error('Unable to load complete application:', error);
  }

  // Existing modal logic continues from here
  const app = ensureExampleData(
    APP_DB[appId] ||
    FULL_APPLICANTS.find(a => a.id === appId) ||
    {
      id: appId,
      name: 'Unknown',
      barangay: '—',
      status: 'Pending',
      daysPending: 0,
      duplicate: null
    }
  );
  CURRENT_APP_ID = appId;

  setText('modal-title', `Application Detail — ${app.name}`);
  setText('modal-sub', `${app.id} · Barangay: ${app.barangay} · Status: ${app.status}`);

  // Applicant summary header (accurate to the registration form)
  const detailPhoto = document.getElementById('detail-photo');
  const detailFb = document.getElementById('detail-photo-fb');
  const photoSrc = app.photo || '';
  if (detailPhoto) { detailPhoto.src = photoSrc; detailPhoto.style.display = photoSrc ? 'block' : 'none'; }
  if (detailFb) { detailFb.style.display = photoSrc ? 'none' : 'flex'; detailFb.textContent = (app.name || '--').trim().replace(/\s+/g, ' ').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }
  setText('detail-name', `${app.firstName || ''} ${app.middleName || ''} ${app.surname || app.name}`.trim().replace(/\s+/g, ' ') || app.name || '—');
  setText('detail-id', app.id || '—');
  setText('detail-barangay', `Barangay: ${app.barangay || '—'}`);
  const detailStatusBadge = document.getElementById('detail-status');
  if (detailStatusBadge) {
    updateDetailStatusBadge(app.status);
  }

  // Duplicate alert
  const dup = document.getElementById('dup-alert');
  if (dup) {
    if (app.duplicate) {
      dup.style.display = '';
      const dupText = document.getElementById('dup-text');
      if (dupText) dupText.textContent =
        `AI match score ${(app.duplicate.score * 100).toFixed(0)}% with ${app.duplicate.matchName} (${app.duplicate.matchId}). Review before approval.`;
    } else {
      dup.style.display = 'none';
    }
  }

  // Set status select
  const statusSelect = document.getElementById('status-select');
  if (statusSelect) statusSelect.value = mapStatusForDropdown(app.status);

  // Update workflow UI
  renderWorkflow(app.status);

  // ── Applicant Information ──
  setText('info-fullname', `${app.firstName || ''} ${app.middleName || ''} ${app.surname || app.name}`.trim() || '—');
  setText('info-dob', app.dob || '—');
  setText('info-age', app.age ? `${app.age} years old` : '—');
  setText('info-sex', app.gender === 'M' ? 'Male' : app.gender === 'F' ? 'Female' : (app.gender || '—'));
  setText('info-birthplace', app.birthplace || '—');
  setText('info-civilstatus', app.civilStatus || '—');
  setText('info-address', app.address || '—');
  setText('info-barangay', app.barangay || '—');
  setText('info-education', app.education || '—');
  setText('info-religion', app.religion || '—');
  setText('info-occupation', app.occupation || '—');
  setText('info-contact', app.contactNumber || '—');

  // Government IDs
  setText('info-id-osca', app.idOsca || '—');
  setText('info-id-sss', app.idSss || '—');
  setText('info-id-philhealth', app.idPhilhealth || '—');
  setText('info-id-gsis', app.idGsis || '—');
  setText('info-id-tin', app.idTin || '—');

  // ── Family Composition ──
  const familyTbody = document.getElementById('family-tbody');
  if (familyTbody) {
    if (app.familyComposition && app.familyComposition.length > 0) {
      familyTbody.innerHTML = app.familyComposition.map(m => `
        <tr>
          <td><span class="cell-text">${m.name}</span></td>
          <td><span class="cell-text">${m.relationship}</span></td>
          <td><span class="cell-text">${m.age}</span></td>
          <td><span class="cell-text">${m.civilStatus}</span></td>
          <td><span class="cell-text">${m.occupation}</span></td>
          <td><span class="cell-text">₱${(m.income || 0).toLocaleString()}</span></td>
        </tr>
      `).join('');
    } else {
      familyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px">No family composition data</td></tr>';
    }
  }

  // ── Membership ──
  if (app.membership) {
    setText('info-assoc-name', app.membership.associationName || '—');
    setText('info-assoc-address', app.membership.associationAddress || '—');
    setText('info-assoc-date', app.membership.associationDate || '—');
    setText('info-assoc-position', app.membership.position || '—');
  } else {
    setText('info-assoc-name', 'No membership data');
    setText('info-assoc-address', '—');
    setText('info-assoc-date', '—');
    setText('info-assoc-position', '—');
  }

  // ── Personal Background ──
  if (app.personalBackground) {
    renderChipList('info-income-sources', app.personalBackground.incomeSources);
    renderChipList('info-assets', app.personalBackground.assets);
    setText('info-monthly-income', app.personalBackground.monthlyIncome || '—');
    renderChipList('info-living-with', app.personalBackground.livingWith);
    renderChipList('info-skills', app.personalBackground.skills);
    renderChipList('info-involvement', app.personalBackground.involvement);
  } else {
    renderChipList('info-income-sources', []);
    renderChipList('info-assets', []);
    setText('info-monthly-income', '—');
    renderChipList('info-living-with', []);
    renderChipList('info-skills', []);
    renderChipList('info-involvement', []);
  }

  // ── Problems & Needs ──
  if (app.problemsNeeds) {
    renderChipList('info-problems-economic', app.problemsNeeds.economic);
    renderChipList('info-problems-social', app.problemsNeeds.social);
    renderChipList('info-problems-health', app.problemsNeeds.health);
    renderChipList('info-problems-housing', app.problemsNeeds.housing);
    renderChipList('info-problems-community', app.problemsNeeds.communityService);
    setText('info-problems-other', app.problemsNeeds.otherNeeds || 'None specified');
  } else {
    renderChipList('info-problems-economic', []);
    renderChipList('info-problems-social', []);
    renderChipList('info-problems-health', []);
    renderChipList('info-problems-housing', []);
    renderChipList('info-problems-community', []);
    setText('info-problems-other', '—');
  }

  // ── Documents ──
  loadSavedDocStatuses(app);
  populateDocPreviews(app);
  renderSavedValidation(app);

  // Add audit entry (view)
  appendAudit('Cindy B.', 'Opened application detail', 'Admin');

  // RBAC apply
  applyRoleToUI();

  // Show modal
  document.getElementById('app-modal').classList.add('show');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderChipList(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">None</span>';
    return;
  }
  el.innerHTML = items.map(item =>
    `<span class="badge badge-review" style="font-size:11px">${item}</span>`
  ).join('');
}

function closeModal() {
  document.getElementById('app-modal')?.classList.remove('show');
  CURRENT_APP_ID = null;
}

function openPrintDetail(appId) {
  const app = APP_DB[appId] || FULL_APPLICANTS.find(a => a.id === appId);
  if (!app) { showToast('Applicant not found.', 'error'); return; }
  setText('pd-name', ((app.firstName || '') + ' ' + (app.middleName || '') + ' ' + (app.surname || app.name)).trim() || '—');
  setText('pd-dob', app.dob || '—');
  setText('pd-address', app.address || '—');
  setText('pd-sex', app.gender === 'M' ? 'Male' : app.gender === 'F' ? 'Female' : (app.gender || '—'));
  setText('pd-id', app.id || '—');
  setText('pd-barangay', app.barangay || '—');
  const photoEl = document.getElementById('pd-photo');
  const fbEl = document.getElementById('pd-photo-fb');
  const photoSrc = app.photo || '';
  if (photoEl) { photoEl.src = photoSrc; photoEl.style.display = photoSrc ? 'block' : 'none'; }
  if (fbEl) { fbEl.style.display = photoSrc ? 'none' : 'flex'; fbEl.textContent = (app.name || '--').slice(0, 2).toUpperCase(); }
  document.getElementById('print-detail-modal').classList.add('show');
}

function closePrintDetail() {
  document.getElementById('print-detail-modal').classList.remove('show');
}

function updateDetailStatusBadge(status) {
  const detailStatusBadge = document.getElementById('detail-status');
  if (!detailStatusBadge) return;
  const normalized = mapStatusForDropdown(status);
  const badgeMap = {
    'Pending': 'badge-pending',
    'Under Review': 'badge-review',
    'In Process': 'badge-processing',
    'Ready for Release': 'badge-approved',
    'Completed': 'badge-issued',
    'Rejected': 'badge-rejected'
  };
  const badgeClass = badgeMap[normalized] || 'badge-pending';
  detailStatusBadge.className = 'badge ' + badgeClass;
  detailStatusBadge.textContent = normalized;
}

function renderWorkflow(status) {
  const stepsWrap = document.getElementById('workflow-steps');
  if (!stepsWrap) return;

  const order = ['Pending', 'Under Review', 'In Process', 'Ready for Release', 'Completed', 'Rejected'];
  const matchedStatus = mapStatusForDropdown(status);
  const idx = Math.max(0, order.indexOf(matchedStatus));

  const steps = stepsWrap.querySelectorAll('.step');
  steps.forEach(s => {
    s.classList.remove('completed', 'active', 'rejected');
  });

  order.forEach((st, i) => {
    const el = stepsWrap.querySelector(`[data-step="${st}"]`);
    if (!el) return;
    if (i < idx) {
      el.classList.add('completed');
    } else if (i === idx) {
      el.classList.add('active');
      if (st === 'Rejected') {
        el.classList.add('rejected');
      }
    }
  });

  // Keep dropdown selector and status badge in sync
  const statusSelect = document.getElementById('status-select');
  if (statusSelect && statusSelect.value !== matchedStatus) {
    statusSelect.value = matchedStatus;
  }
  updateDetailStatusBadge(matchedStatus);
}

/* ── Workflow step validation ── */
const WORKFLOW_STEPS = ['Pending', 'Under Review', 'In Process', 'Ready for Release', 'Completed', 'Rejected'];
function isValidStatusTransition(current, next) {
  return WORKFLOW_STEPS.includes(next);
}

function syncRecentSubmissionsStatus(appId, newStatus) {
  if (!appId) return;

  // 1. Locate the row in #recent-submissions-tbody.
  //    The row's data-app-id may have been set from application_id (backend)
  //    or id (local APP_DB) — try both to cover both cases.
  let recentRow =
    document.querySelector('#recent-submissions-tbody tr[data-app-id="' + appId + '"]') ||
    document.querySelector('#recent-submissions-tbody tr[data-application-id="' + appId + '"]');

  if (!recentRow) {
    const btn = document.querySelector('#recent-submissions-tbody button[onclick*="' + appId + '"]');
    if (btn) recentRow = btn.closest('tr');
  }

  if (recentRow) {
    recentRow.dataset.status = newStatus;
    const statusCell = recentRow.children[3];
    if (statusCell) {
      const normalizedStatus = String(newStatus || 'Pending')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      const statusClassAliases = {
        unverified: 'pending',
        'under-review': 'review',
        'in-review': 'review',
        'in-process': 'process',
        'ready-for-release': 'ready',
        verified: 'approved',
        'id-issued': 'issued'
      };
      const statusClass = statusClassAliases[normalizedStatus] || normalizedStatus;
      let pill = statusCell.querySelector('.recent-submission-status');

      if (!pill) {
        pill = document.createElement('span');
        statusCell.replaceChildren(pill);
      }

      pill.className = `recent-submission-status recent-submission-status--${statusClass}`;
      pill.textContent = newStatus;
    }
  }

  if (Array.isArray(window.STAFF_RECENT_SUBMISSIONS)) {
    const recentApplication = window.STAFF_RECENT_SUBMISSIONS.find(item =>
      String(item.application_id || item.id) === String(appId)
    );
    if (recentApplication) recentApplication.status = newStatus;
  }

  // 2. Keep LIVE_APPLICATIONS in-memory data synchronized
  if (typeof LIVE_APPLICATIONS !== 'undefined' && Array.isArray(LIVE_APPLICATIONS)) {
    const liveApp = LIVE_APPLICATIONS.find(item =>
      String(item.application_id || item.id) === String(appId)
    );
    if (liveApp) {
      liveApp.status = newStatus;
      liveApp.status_updated_at = new Date().toISOString();
    }
  }

  // 3. Keep APP_DB synchronized
  if (typeof APP_DB !== 'undefined' && APP_DB[appId]) {
    APP_DB[appId].status = newStatus;
  }

  if (typeof filterRecentSubmissions === 'function') {
    filterRecentSubmissions();
  }
}
window.syncRecentSubmissionsStatus = syncRecentSubmissionsStatus;

function updateStatus(newStatus) {
  if (!CURRENT_APP_ID) return;
  const currentStatus = APP_DB[CURRENT_APP_ID]?.status || 'Pending';
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    showToast('Invalid transition: ' + currentStatus + ' → ' + newStatus + '. Follow the workflow sequence.', 'error');
    const sel = document.getElementById('status-select');
    if (sel) sel.value = currentStatus;
    return;
  }
  if (APP_DB[CURRENT_APP_ID]) {
    APP_DB[CURRENT_APP_ID].status = newStatus;
  }
  renderWorkflow(newStatus);
  const modalSub = document.getElementById('modal-sub');
  if (modalSub && APP_DB[CURRENT_APP_ID]) {
    modalSub.textContent =
      `${APP_DB[CURRENT_APP_ID].id} · Barangay: ${APP_DB[CURRENT_APP_ID].barangay || '—'} · Status: ${newStatus}`;
  }

  // Sync the applications table inline badge and recent submissions table
  syncApplicationsTableBadge(CURRENT_APP_ID, newStatus);
  syncRecentSubmissionsStatus(CURRENT_APP_ID, newStatus);

  // Sync with backend database when available
  if (typeof updateTableStatus === 'function') {
    updateTableStatus(CURRENT_APP_ID, newStatus, currentStatus).catch(err => {
      console.warn('Could not sync status to backend:', err);
    });
  }

  appendAudit(CURRENT_USER?.displayName || 'Staff', `Status set to: ${newStatus}`, CURRENT_ROLE);
  // updateTableStatus() owns the success/error notification after the database responds.
}

async function updateTableStatus(
  appId,
  newStatus,
  previousStatus = 'Pending'
) {
  const app =
    APP_DB[appId] ||
    { id: appId };

  // Optimistic UI update
  app.status = newStatus;
  APP_DB[appId] = app;
  syncRecentSubmissionsStatus(appId, newStatus);

  // Update the applicant row status immediately
  const applicantRow =
    document.querySelector(
      '#applicants-tbody tr[data-app-id="' +
      appId +
      '"]'
    );

  if (applicantRow) {
    applicantRow.dataset.status = newStatus;

    const applicantStatusLabel =
      applicantRow.querySelector('.status-select__label');

    if (applicantStatusLabel) {
      applicantStatusLabel.textContent = newStatus;
    }
  }

  const row =
    document.querySelector(
      '#applications-tbody tr[data-app-id="' +
      appId +
      '"]'
    ) ||
    document.querySelector(
      '#applicants-tbody tr[data-app-id="' +
      appId +
      '"]'
    );

  const statusLabel =
    row?.querySelector(
      '.status-select__label'
    );

  if (statusLabel) {
    statusLabel.textContent =
      newStatus;
  }

  // Keep ID Maker queue in sync
  const queueRow =
    document.querySelector(
      '#id-maker-queue-tbody tr[data-app-id="' +
      appId +
      '"]'
    );

  const queueBadge =
    queueRow
      ? queueRow.querySelector(
        '.queue-status-badge'
      )
      : null;

  if (queueBadge) {
    queueBadge.className =
      'badge queue-status-badge ' +
      queueBadgeClass(newStatus);

    queueBadge.textContent =
      newStatus;
  }

  updateStatusTabCounts();

  try {
    // Save status to database

    const response =
      await fetch(
        `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(
          appId
        )}/status`,
        {
          method: 'PUT',

          headers: getAuthHeaders(),

          body: JSON.stringify({
            status: newStatus
          })
        }
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        'Failed to save application status.'
      );
    }

    // Use the status confirmed by the database

    const savedStatus =
      result.status ||
      newStatus;

    app.status =
      savedStatus;

    APP_DB[appId] = app;

    // Keep the person registry, membership column, and KPI groups in sync
    // immediately after the backend confirms the status update.
    if (typeof LIVE_APPLICATIONS !== 'undefined' && Array.isArray(LIVE_APPLICATIONS)) {
      const liveApplication = LIVE_APPLICATIONS.find(item =>
        String(item.application_id || item.id) === String(appId)
      );
      if (liveApplication) {
        liveApplication.status = savedStatus;
        liveApplication.status_updated_at =
          result.statusHistory?.[0]?.updated_at || new Date().toISOString();

        // The backend automatically activates membership when an application
        // becomes Completed. Reflect that returned value without a page refresh.
        if (
          savedStatus === 'Completed' &&
          result.membershipSync?.updated &&
          result.membershipSync.membership_status
        ) {
          liveApplication.membership_status =
            result.membershipSync.membership_status;
          app.membership_status =
            result.membershipSync.membership_status;
        }
      }
      if (typeof updateApplicantSummaryCards === 'function') updateApplicantSummaryCards(LIVE_APPLICATIONS);
      if (typeof updateApplicationSummaryCards === 'function') updateApplicationSummaryCards(LIVE_APPLICATIONS);
      if (typeof renderLiveApplicants === 'function') renderLiveApplicants(LIVE_APPLICATIONS);
      if (typeof renderLiveApplications === 'function') renderLiveApplications(LIVE_APPLICATIONS);
    }
    syncRecentSubmissionsStatus(appId, savedStatus);

    // Reflect the automatically created ID Maker queue entry immediately.
    if (result.idMakerSync?.updated && result.idMakerSync?.queue) {
      const queueRecord = result.idMakerSync.queue;
      const queueEntry = {
        id: appId,
        application_id: appId,
        name: app.name || getApplicationName?.(app) || appId,
        firstName: app.firstName || '',
        middleName: app.middleName || '',
        surname: app.surname || app.name || '',
        address: app.address || '—',
        barangay: app.barangay || app.barangay_district || '—',
        dob: app.dob || app.date_of_birth || '',
        gender: app.gender || app.sex || '',
        controlNo: queueRecord.control_no || buildControlNo(appId),
        dateIssued: queueRecord.date_issued || new Date().toISOString().slice(0, 10),
        printStatus: queueRecord.print_status || 'Queued',
        updatedAt: queueRecord.updated_at || new Date().toISOString(),
        sentAt: queueRecord.sent_at || new Date().toISOString()
      };
      const queueIndex = ID_MAKER_QUEUE.findIndex(item =>
        String(item.id || item.application_id) === String(appId)
      );
      if (queueIndex >= 0) ID_MAKER_QUEUE[queueIndex] = { ...ID_MAKER_QUEUE[queueIndex], ...queueEntry };
      else ID_MAKER_QUEUE.unshift(queueEntry);
      if (typeof saveLocalIdMakerQueue === 'function') saveLocalIdMakerQueue(queueEntry, false);
      if (typeof updateIssuanceKPIs === 'function') updateIssuanceKPIs();
    }

    // Reapply the Applicants status filter without rebuilding 4,251 rows
    if (
      row &&
      row.closest('#applicants-tbody')
    ) {
      const applicantsFilters =
        document.querySelectorAll(
          '#mod-applicants .filter-select'
        );

      const statusFilter =
        applicantsFilters[1];

      if (statusFilter) {
        filterApplicantsByStatus(
          statusFilter.value
        );
      }
    }

    console.log(
      'Application status saved:',
      {
        applicationId: appId,
        status: savedStatus,
        databaseRecord:
          result.statusHistory
      }
    );

    showToast(
      result.idMakerSync?.updated
        ? `Eligibility passed. Issuance form generated and sent to ID Maker for ${appId}.`
        : `Status saved as ${savedStatus} for ${appId}`,
      'success'
    );

    // Keep the current Applicants filter after saving.
    const applicantsStatusFilter =
      document.querySelector(
        '#mod-applicants .filter-select:nth-of-type(2)'
      );

    if (applicantsStatusFilter) {
      filterApplicantsByStatus(
        applicantsStatusFilter.value
      );
    }

  } catch (error) {

    console.error(
      'Failed to save application status:',
      error
    );

    // Roll back every optimistic status change when the database rejects the save.
    app.status = previousStatus;
    APP_DB[appId] = app;
    syncApplicationsTableBadge(appId, previousStatus);
    syncRecentSubmissionsStatus(appId, previousStatus);

    if (typeof LIVE_APPLICATIONS !== 'undefined' && Array.isArray(LIVE_APPLICATIONS)) {
      const liveApplication = LIVE_APPLICATIONS.find(item =>
        String(item.application_id || item.id) === String(appId)
      );
      if (liveApplication) liveApplication.status = previousStatus;
      if (typeof updateApplicantSummaryCards === 'function') updateApplicantSummaryCards(LIVE_APPLICATIONS);
      if (typeof updateApplicationSummaryCards === 'function') updateApplicationSummaryCards(LIVE_APPLICATIONS);
      if (typeof renderLiveApplicants === 'function') renderLiveApplicants(LIVE_APPLICATIONS);
      if (typeof renderLiveApplications === 'function') renderLiveApplications(LIVE_APPLICATIONS);
    }

    const detailStatusSelect = document.getElementById('status-select');
    if (detailStatusSelect) detailStatusSelect.value = previousStatus;

    const oldConfig =
      statusOptionCfg(
        mapStatusForDropdown(
          previousStatus
        )
      );

    if (row) {
      const statusRoot =
        row.querySelector(
          '.status-select'
        );

      if (statusRoot) {
        setStatusTrigger(
          statusRoot,
          oldConfig[0],
          oldConfig[1],
          previousStatus
        );

        statusRoot
          .querySelectorAll(
            '.status-select__option'
          )
          .forEach(option => {
            option.classList.toggle(
              'active',
              option.dataset.status ===
              previousStatus
            );
          });
      }
    }

    updateStatusTabCounts();

    if (
      typeof applyApplicationsFilters ===
      'function'
    ) {
      applyApplicationsFilters();
    }

    showToast(
      'Status was not saved to the database. ' +
      (error.message || ''),
      'error'
    );
  }
}

// Dismiss the urgent-review banner without changing application data.
function dismissUrgentAlert() {
  const alert = document.getElementById('urgent-alert');
  if (alert) alert.style.display = 'none';
}

/* DIGITAL ISSUANCE FORM (Small Form Modal) */
let DI_CURRENT_APP_ID = null;
let DI_MODE = 'idmaker'; // 'staff' | 'idmaker'

async function openDigitalIssuance(appId) {
  DI_MODE = 'idmaker';
  await _populateDigitalIssuance(appId);
}

async function openIssuancePreview(appId) {
  DI_MODE = 'staff';
  await _populateDigitalIssuance(appId);
}

async function _populateDigitalIssuance(appId) {
  let app =
    ID_MAKER_QUEUE.find(
      a => String(a.id) === String(appId)
    ) ||
    APP_DB[appId] ||
    FULL_APPLICANTS.find(
      a => String(a.id) === String(appId)
    );

  if (!app) {
    showToast('Applicant not found.', 'error');
    return;
  }

  DI_CURRENT_APP_ID = appId;

  // Show the modal immediately.
  const modal =
    document.getElementById(
      'digital-issuance-modal'
    );

  if (modal) {
    modal.classList.add('show');
  }

  // Show loading state for the image areas.
  const pPhoto =
    document.getElementById(
      'di-preview-photo'
    );

  const pPhotoFb =
    document.getElementById(
      'di-preview-photo-fallback'
    );

  const pSig =
    document.getElementById(
      'di-preview-signature'
    );

  const pSigFb =
    document.getElementById(
      'di-preview-sign-fallback'
    );

  if (pPhoto) {
    pPhoto.style.display = 'none';
  }

  if (pPhotoFb) {
    pPhotoFb.style.display = 'block';
    pPhotoFb.textContent = 'Loading...';
  }

  if (pSig) {
    pSig.style.display = 'none';
  }

  if (pSigFb) {
    pSigFb.style.display = 'block';
    pSigFb.textContent = 'Loading...';
  }

  // ==================================================
  // LOAD COMPLETE APPLICATION ONLY WHEN FORM IS OPENED
  // ==================================================

  try {
    const issuanceDetailsPath = DI_MODE === 'idmaker' ? '/issuance-details' : '';
    const response = await fetch(
      'https://management-backend-3cij.onrender.com/api/applications/' +
      encodeURIComponent(appId) + issuanceDetailsPath,
      {
        method: 'GET',
        headers: getAuthHeaders(),
        cache: 'no-store'
      }
    );

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to load the applicant details needed for ID issuance.');
    }

    if (response.ok && result.success) {
      const liveApplication =
        result.application || {};

      const files =
        result.applicationFiles || {};

      app = {
        ...app,

        id:
          liveApplication.application_id ||
          app.id,

        firstName:
          liveApplication.first_name ||
          app.firstName ||
          '',

        middleName:
          liveApplication.middle_name ||
          app.middleName ||
          '',

        surname:
          liveApplication.surname ||
          app.surname ||
          '',

        address:
          liveApplication.house_street ||
          app.address ||
          '',

        barangay:
          liveApplication.barangay_district ||
          app.barangay ||
          '',

        dob:
          liveApplication.date_of_birth ||
          app.dob ||
          '',

        gender:
          liveApplication.sex ||
          app.gender ||
          '',

        photo:
          files.latest_photo_signed_url ||
          '',

        signature:
          files.signature_signed_url ||
          '',

        documents: {
          ...(app.documents || {}),

          idFront:
            files.valid_id_signed_url || '',

          idBack:
            files.valid_id_back_signed_url || '',

          photo:
            files.latest_photo_signed_url || '',

          bc:
            files.birth_certificate_signed_url || '',

          cedula:
            files.community_tax_certificate_signed_url || '',

          signature:
            files.signature_signed_url || ''
        }
      };

      // Keep the locally opened record updated.
      if (
        typeof APP_DB !== 'undefined'
      ) {
        APP_DB[appId] = {
          ...(APP_DB[appId] || {}),
          ...app
        };
      }
    }

  } catch (error) {
    console.error(
      'Unable to load complete issuance data:',
      error
    );

    // Continue using lightweight queue data.
  }

  // ==================================================
  // PREPARE FORM DATA
  // ==================================================

  const fullName =
    [
      app.firstName || '',
      app.middleName || '',
      app.surname || app.name || ''
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || '—';

  const dobFormatted =
    app.dob
      ? formatDateForForm(app.dob)
      : '________________';

  const sexVal =
    app.gender === 'M'
      ? 'Male'
      : app.gender === 'F'
        ? 'Female'
        : (
          app.gender ||
          '________________'
        );

   const controlNo =
    app.controlNo ||
    (DI_MODE === 'staff' ? buildControlNo(app.id) : 'Not assigned');

  // ==================================================
  // PHOTO
  // ==================================================

  const photoSrc =
    app.photo ||
    app.documents?.photo ||
    '';

  if (pPhoto) {
    pPhoto.onload = function () {
      pPhoto.style.display = 'block';

      if (pPhotoFb) {
        pPhotoFb.style.display = 'none';
      }
    };

    pPhoto.onerror = function () {
      pPhoto.style.display = 'none';

      if (pPhotoFb) {
        pPhotoFb.style.display = 'block';
        pPhotoFb.textContent =
          (app.name || '--')
            .slice(0, 2)
            .toUpperCase();
      }
    };

    if (photoSrc) {
      pPhoto.src = photoSrc;
    } else {
      pPhoto.style.display = 'none';

      if (pPhotoFb) {
        pPhotoFb.style.display = 'block';
        pPhotoFb.textContent =
          (app.name || '--')
            .slice(0, 2)
            .toUpperCase();
      }
    }
  }

  // ==================================================
  // FORM FIELDS
  // ==================================================

  const nameEl =
    document.getElementById(
      'di-preview-name'
    );

  const addressEl =
    document.getElementById(
      'di-preview-address'
    );

  const dobEl =
    document.getElementById(
      'di-preview-dob'
    );

  const sexEl =
    document.getElementById(
      'di-preview-sex'
    );

  const dateIssuedEl =
    document.getElementById(
      'di-preview-date-issued'
    );

  const controlNoEl =
    document.getElementById(
      'di-preview-control-no'
    );

  if (nameEl) {
    nameEl.textContent = fullName;
  }

  if (addressEl) {
    addressEl.textContent =
      app.address ||
      '________________';
  }

  if (dobEl) {
    dobEl.textContent =
      dobFormatted;
  }

  if (sexEl) {
    sexEl.textContent =
      sexVal;
  }

  if (dateIssuedEl) {
    dateIssuedEl.textContent =
      app.dateIssued
        ? formatDateForForm(
          app.dateIssued
        )
        : new Date().toLocaleDateString(
          'en-PH',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }
        );
  }

  if (controlNoEl) {
    controlNoEl.textContent =
      controlNo;
  }

  // ==================================================
  // SIGNATURE
  // ==================================================

  const sigSrc =
    app.signature ||
    app.documents?.signature ||
    '';

  if (pSig) {
    pSig.onload = function () {
      pSig.style.display = 'block';

      if (pSigFb) {
        pSigFb.style.display = 'none';
      }
    };

    pSig.onerror = function () {
      pSig.style.display = 'none';

      if (pSigFb) {
        pSigFb.style.display = 'block';
        pSigFb.textContent =
          'No signature image';
      }
    };

    if (sigSrc) {
      pSig.src = sigSrc;
    } else {
      pSig.style.display = 'none';

      if (pSigFb) {
        pSigFb.style.display = 'block';
        pSigFb.textContent =
          'No signature image';
      }
    }
  }

  // ==================================================
  // MODE-SPECIFIC UI
  // ==================================================

  const footer =
    document.getElementById(
      'di-modal-footer'
    );

  const title =
    document.getElementById(
      'di-modal-title'
    );

  const editableIds = [
    'di-preview-name',
    'di-preview-address',
    'di-preview-dob',
    'di-preview-sex',
    'di-preview-date-issued',
    'di-preview-control-no'
  ];

  if (DI_MODE === 'staff') {
    if (footer) {
      footer.style.display = '';
    }

    if (title) {
      title.textContent =
        'Generate Issuance Form';
    }

    editableIds.forEach(function (id) {
      const el =
        document.getElementById(id);

      if (el) {
        el.contentEditable = 'true';
      }
    });

  } else {

    if (footer) {
      footer.style.display = 'none';
    }

    if (title) {
      title.textContent =
        'Digital Issuance Form';
    }

    editableIds.forEach(function (id) {
      const el =
        document.getElementById(id);

      if (el) {
        el.contentEditable = 'false';
      }
    });
  }
}

function closeDigitalIssuance() {
  document.getElementById('digital-issuance-modal').classList.remove('show');
  // Reset contenteditable
  ['di-preview-name', 'di-preview-address', 'di-preview-dob', 'di-preview-sex', 'di-preview-date-issued', 'di-preview-control-no'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.contentEditable = 'false';
  });
  DI_CURRENT_APP_ID = null;
}

async function sendToIdMaker() {
  if (!DI_CURRENT_APP_ID) return;

  const appId = DI_CURRENT_APP_ID;

  const app =
    APP_DB[appId] ||
    ID_MAKER_QUEUE.find(a => a.id === appId) ||
    FULL_APPLICANTS.find(a => a.id === appId) ||
    {};

  // Get the values from the Generate Issuance Form
  const editedName =
    document.getElementById('di-preview-name')?.textContent?.trim() ||
    app.name ||
    '';

  const editedAddress =
    document.getElementById('di-preview-address')?.textContent?.trim() ||
    app.address ||
    '';

  const editedDob =
    document.getElementById('di-preview-dob')?.textContent?.trim() ||
    app.dob ||
    '';

  const editedSex =
    document.getElementById('di-preview-sex')?.textContent?.trim() ||
    app.gender ||
    '';

  const editedDateIssuedText =
    document.getElementById('di-preview-date-issued')?.textContent?.trim() ||
    '';

  let editedDateIssued = '';

  if (editedDateIssuedText) {
    const parsedDate = new Date(editedDateIssuedText);

    if (!Number.isNaN(parsedDate.getTime())) {
      editedDateIssued = parsedDate.toISOString().split('T')[0];
    }
  }

    const editedControlNo =
    document.getElementById('di-preview-control-no')?.textContent?.trim() ||
    buildControlNo(appId);

  // --------------------------------------------------
  // 1. SAVE STATUS TO BACKEND FIRST
  // --------------------------------------------------

  try {
    const queueEntry = {
      id: app.id || appId,

      name: editedName,

      firstName: app.firstName || '',
      middleName: app.middleName || '',
      surname: app.surname || editedName,

      address: editedAddress,
      barangay: app.barangay || '—',

      dob: editedDob,
      gender: editedSex,

      photo:
        app.photo ||
        app.documents?.photo ||
        fallbackMedia(editedName),

      signature:
        app.signature ||
        app.documents?.signature ||
        '',

      controlNo: editedControlNo,
      dateIssued: editedDateIssued,

      printStatus: 'Queued',

      regDate: app.regDate || ''
    };
    // Remember the current status so we can restore it if queue saving fails.
    const previousStatus =
      APP_DB[appId]?.status ||
      app.status ||
      'Under Review';

    // 1. Update the application status in the database first.
    const statusResponse = await fetch(
      `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(appId)}/status`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: 'In Process'
        })
      }
    );

    const statusResult = await statusResponse.json();

    if (!statusResponse.ok || !statusResult.success) {
      throw new Error(
        statusResult.message ||
        'Failed to update application status. The applicant was not added to the queue.'
      );
    }

    const savedStatus = statusResult.status || 'In Process';

    // 2. Save the applicant to the database queue.
    let queueResult;

    try {
      const queueResponse = await fetch(
        'https://management-backend-3cij.onrender.com/api/id-maker-queue',
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            application_id: appId,
            control_no: editedControlNo,
            date_issued: editedDateIssued,
            print_status: 'Queued'
          })
        }
      );

      queueResult = await queueResponse.json();

      if (!queueResponse.ok || !queueResult.success) {
        throw new Error(
          queueResult.message ||
          'Failed to save applicant to the ID Maker queue.'
        );
      }
    } catch (queueError) {
      // 3. Queue saving failed. Try to restore the previous database status.
      try {
        const rollbackResponse = await fetch(
          `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(appId)}/status`,
          {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              status: previousStatus
            })
          }
        );

        const rollbackResult = await rollbackResponse.json();

        if (!rollbackResponse.ok || !rollbackResult.success) {
          throw new Error(
            rollbackResult.message ||
            'The previous status could not be restored.'
          );
        }

        throw new Error(
          `${queueError.message} The application status was restored to ${previousStatus}.`
        );
      } catch (rollbackError) {
        if (
          rollbackError.message.includes(
            'The application status was restored to'
          )
        ) {
          throw rollbackError;
        }

        throw new Error(
          `${queueError.message} WARNING: The status rollback also failed. ` +
          `Please check application ${appId} in the database. ` +
          `Rollback error: ${rollbackError.message}`
        );
      }
    }

    // 4. Both database requests succeeded. Update the local queue now.
    const existingIndex = ID_MAKER_QUEUE.findIndex(
      item => String(item.id) === String(queueEntry.id)
    );

    if (existingIndex >= 0) {
      ID_MAKER_QUEUE[existingIndex] = queueEntry;
    } else {
      ID_MAKER_QUEUE.push(queueEntry);
    }

    if (APP_DB[appId]) {
      APP_DB[appId].status = savedStatus;

      renderWorkflow(savedStatus);

      const modalSub =
        document.getElementById('modal-sub');

      if (modalSub) {
        modalSub.textContent =
          `${APP_DB[appId].id || appId} · Barangay: ` +
          `${APP_DB[appId].barangay || '—'} · Status: ${savedStatus}`;
      }
    }

    if (typeof LIVE_APPLICATIONS !== 'undefined' && Array.isArray(LIVE_APPLICATIONS)) {

      const liveApplication =
        LIVE_APPLICATIONS.find(function (item) {

          return (
            String(
              item.application_id ||
              item.applicationId ||
              item.id
            ) === String(appId)
          );

        });

      if (liveApplication) {

        liveApplication.status =
          savedStatus;

        liveApplication.status_updated_at =
          new Date().toISOString();

      }
    }


    const fullApplicant =
      FULL_APPLICANTS.find(function (item) {
        return String(item.id) === String(appId);
      });

    if (fullApplicant) {
      fullApplicant.status =
        savedStatus;
    }

    if (
      typeof renderLiveApplications ===
      'function' &&
      Array.isArray(LIVE_APPLICATIONS)
    ) {
      renderLiveApplications(
        LIVE_APPLICATIONS
      );
    }

    if (
      typeof updateLiveAnalyticsData ===
      'function' &&
      Array.isArray(LIVE_APPLICATIONS)
    ) {
      updateLiveAnalyticsData(
        LIVE_APPLICATIONS
      );
    }

    updateStatusTabCounts();

    console.log('ID Maker queue saved to database:', queueResult.queue);
    
    // Update the linked ID request status in the database too.
    const requestsResponse = await fetch(
      'https://management-backend-3cij.onrender.com/api/replacements',
      { headers: getAuthHeaders(), cache: 'no-store' }
    );

    const requestsResult = await requestsResponse.json();

    if (!requestsResponse.ok || !requestsResult.success) {
      throw new Error(
        requestsResult.message ||
        'Could not load the linked ID request.'
      );
    }

    const linkedRequest = (requestsResult.requests || []).find(
      request =>
        String(request.application_id) === String(appId)
    );

    if (linkedRequest) {
      const requestStatusResponse = await fetch(
        `https://management-backend-3cij.onrender.com/api/replacements/${linkedRequest.id}/decision`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: 'In Process'
          })
        }
      );

      const requestStatusResult =
        await requestStatusResponse.json();

      if (
        !requestStatusResponse.ok ||
        !requestStatusResult.success
      ) {
        throw new Error(
          requestStatusResult.message ||
          'The ID request status could not be updated.'
        );
      }

      console.log(
        'Linked ID request status saved:',
        requestStatusResult.request
      );
    } else {
      console.warn(
        'No linked ID request found for application:',
        appId
      );
    }

    if (typeof initIdMakerQueue === 'function') {
      initIdMakerQueue();
    }

    if (typeof updateIdMakerKPIs === 'function') {
      updateIdMakerKPIs();
    }

    appendAudit(
      CURRENT_USER?.displayName || 'Staff',
      'Sent to ID Maker (In Process)',
      CURRENT_ROLE
    );

    addNotifyLog(
      appId,
      'Sent to ID Maker',
      'System',
      'Delivered'
    );

    closeDigitalIssuance();
    closeModal();

    showToast(
      `${editedName} sent to ID Maker (In Process)`,
      'success'
    );

  } catch (error) {

    console.error(
      'Error sending application to ID Maker:',
      error
    );

    showToast(
      error.message || 'Failed to send application to ID Maker.',
      'error'
    );
  }
}

function syncApplicationsTableBadge(appId, newStatus) {
  var statusRoot = document.querySelector('.status-select[data-app-id="' + appId + '"]');
  if (statusRoot) {
    var label = statusRoot.querySelector('.status-select__label');
    var icon = statusRoot.querySelector('.status-select__icon');
    if (label) label.textContent = newStatus;
    var colorMap = {
      'Pending': '#C07A0A', 'Unverified': '#D97706', 'Under Review': '#1A4FBA',
      'Verified': '#059669', 'In Process': '#0B9E6C', 'Ready for Release': '#7C3AED',
      'ID Issued': '#6B5BD1', 'Completed': '#0B9E6C', 'Rejected': '#D9233A'
    };
    if (icon) icon.style.color = colorMap[newStatus] || '#666';
  }
  // Sync recent submissions row as well
  syncRecentSubmissionsStatus(appId, newStatus);
  // Refresh tab counts after status change
  updateStatusTabCounts();
}

async function downloadDigitalIssuanceDocs() {
  if (!DI_CURRENT_APP_ID) {
    showToast(
      'No applicant selected.',
      'error'
    );

    return;
  }

  const appId =
    DI_CURRENT_APP_ID;

  const name =
    document
      .getElementById(
        'di-preview-name'
      )
      ?.textContent
      ?.trim() || '';

  const address =
    document
      .getElementById(
        'di-preview-address'
      )
      ?.textContent
      ?.trim() || '';

  const dob =
    document
      .getElementById(
        'di-preview-dob'
      )
      ?.textContent
      ?.trim() || '';

  const sex =
    document
      .getElementById(
        'di-preview-sex'
      )
      ?.textContent
      ?.trim() || '';

  const dateIssued =
    document
      .getElementById(
        'di-preview-date-issued'
      )
      ?.textContent
      ?.trim() || '';

  const controlNo =
    document
      .getElementById(
        'di-preview-control-no'
      )
      ?.textContent
      ?.trim() || '';

  try {
    showToast(
      'Preparing Word document...',
      'info'
    );

    const response =
      await fetch(
        'https://management-backend-3cij.onrender.com/api/applications/' +
        encodeURIComponent(appId) +
        '/issuance-document',
        {
          method: 'POST',

          headers: getAuthHeaders(),
          body: JSON.stringify({ name, address, dob, sex, dateIssued, controlNo })
        }
      );

    if (!response.ok) {
      let message =
        'Failed to generate Word document.';

      try {
        const result =
          await response.json();

        message =
          result.message ||
          message;

      } catch (_) { }

      throw new Error(message);
    }

    const blob =
      await response.blob();

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      'Digital_Issuance_' +
      String(appId)
        .replace(
          /[^a-zA-Z0-9-_]/g,
          '_'
        ) +
      '.docx';

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    showToast(
      'Word document downloaded successfully.',
      'success'
    );

  } catch (error) {
    console.error(
      'Error downloading issuance document:',
      error
    );

    showToast(
      error.message ||
      'Failed to download Word document.',
      'error'
    );
  }
}

/* Rule-based validation */

let CURRENT_VALIDATION_RESULT = null;


async function runValidation() {

  if (!CURRENT_APP_ID) {

    showToast(
      'No application selected.',
      'error'
    );

    return;
  }


  const app =
    APP_DB[CURRENT_APP_ID];


  if (!app) {

    showToast(
      'Application data could not be found.',
      'error'
    );

    return;
  }


  // Age

  const age =
    Number(app.age);

  const ageOk =
    !Number.isNaN(age) &&
    age >= 60;


  // Residency

  const barangay =
    String(
      app.barangay || ''
    ).trim();

  const residencyOk =
    barangay !== '' &&
    barangay !== '—';


  // Documents

  const documents =
    app.documents || {};


  const requiredDocuments = {

    idFront:
      'Valid ID (Front)',

    idBack:
      'Valid ID (Back)',

    photo:
      'Latest Photo',

    bc:
      'Birth Certificate',

    cedula:
      'Community Tax Certificate',

    signature:
      'Signature'

  };


  const missingDocuments = [];


  Object.entries(
    requiredDocuments
  ).forEach(
    ([key, label]) => {

      const documentUrl =
        documents[key];

      if (
        !documentUrl ||
        String(documentUrl).trim() === ''
      ) {

        missingDocuments.push(
          label
        );

      }

    }
  );


  const docsOk =
    missingDocuments.length === 0;


  // Duplicate

  const duplicateRisk =
    app.duplicate || null;


  const duplicateOk =
    !duplicateRisk ||
    Number(duplicateRisk.score || 0) < 0.80;


  // Overall validation

  const validationPassed =
    ageOk &&
    residencyOk &&
    docsOk &&
    duplicateOk;


  const validationStatus =
    validationPassed
      ? 'Passed'
      : 'Incomplete';


  // Validation notes

  const notes = [];


  if (ageOk) {

    notes.push(
      'Age 60+ passed.'
    );

  } else {

    notes.push(
      'Applicant is below 60 years old.'
    );

  }


  if (residencyOk) {

    notes.push(
      'Residency information is valid.'
    );

  } else {

    notes.push(
      'Residency information needs checking.'
    );

  }


  if (docsOk) {

    notes.push(
      'All required documents are uploaded.'
    );

  } else {

    notes.push(
      'Missing documents: ' +
      missingDocuments.join(', ') +
      '.'
    );

  }


  if (duplicateOk) {

    notes.push(
      'Duplicate risk is low.'
    );

  } else {

    notes.push(
      'Duplicate risk requires review.'
    );

  }


  // SAVE RESULT TEMPORARILY

  CURRENT_VALIDATION_RESULT = {

    status:
      validationStatus,

    passed:
      validationPassed,

    ageOk:
      ageOk,

    residencyOk:
      residencyOk,

    docsOk:
      docsOk,

    duplicateOk:
      duplicateOk,

    missingDocuments:
      missingDocuments,

    notes:
      notes.join(' ')

  };


  // DISPLAY RESULT

  const body =
    document.getElementById(
      'validation-body'
    );


  if (!body) {
    return;
  }


  body.innerHTML = `

    <div
      style="
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      "
    >

      <span
        class="badge ${ageOk
      ? 'badge-approved'
      : 'badge-rejected'
    }"
      >
        • AGE 60+:
        ${ageOk ? 'Pass' : 'Fail'}
      </span>


      <span
        class="badge ${residencyOk
      ? 'badge-approved'
      : 'badge-review'
    }"
      >
        • RESIDENCY:
        ${residencyOk
      ? 'Likely Valid'
      : 'Needs Check'
    }
      </span>


      <span
        class="badge ${docsOk
      ? 'badge-approved'
      : 'badge-pending'
    }"
      >
        • DOCS:
        ${docsOk
      ? 'Complete'
      : 'Incomplete'
    }
      </span>


      ${duplicateOk

      ? `
            <span
              class="badge badge-approved"
            >
              • DUPLICATE RISK: LOW
            </span>
          `

      : `
            <span
              class="badge badge-rejected"
            >
              • DUPLICATE RISK: HIGH
            </span>
          `
    }

    </div>


    <div
      style="
        margin-top:10px;
        font-size:12.5px;
        color:var(--text-muted);
        line-height:1.5;
      "
    >

      ${validationPassed

      ? `
            <strong>
              Validation Passed.
            </strong>
            All required checks passed.
          `

      : `
            <strong>
              Validation needs review.
            </strong>
            ${missingDocuments.length > 0
        ? 'Missing: ' +
        missingDocuments.join(', ')
        : 'One or more validation checks failed.'
      }
          `
    }

    </div>

  `;


  // SAVE VALIDATION RESULT TO DATABASE
  try {
    const response = await fetch(
      `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(
        CURRENT_APP_ID
      )}/validation`,
      {
        method: 'PUT',

        headers: getAuthHeaders(),

        body: JSON.stringify({
          validation_status: validationStatus,
          validation_notes: notes.join(' ')
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        'Failed to save validation result.'
      );
    }

    // Keep the saved result in the current application
    if (APP_DB[CURRENT_APP_ID]) {
      APP_DB[CURRENT_APP_ID].validation_status =
        validationStatus;

      APP_DB[CURRENT_APP_ID].validation_updated_at =
        new Date().toISOString();

      APP_DB[CURRENT_APP_ID].validation_notes =
        notes.join(' ');
    }

    appendAudit(
      CURRENT_USER?.displayName ||
      'Staff',
      'Validation run and saved',
      'System'
    );

    showToast(
      validationPassed
        ? 'Validation passed and saved.'
        : 'Validation completed and saved.',
      validationPassed
        ? 'success'
        : 'info'
    );

  } catch (error) {

    console.error(
      'Failed to save validation:',
      error
    );

    showToast(
      'Validation ran, but could not be saved: ' +
      error.message,
      'error'
    );
  }

}

function renderSavedValidation(app) {

  const body =
    document.getElementById(
      'validation-body'
    );


  if (!body) {
    return;
  }


  // No validation saved yet
  if (
    !app ||
    !app.validation_status
  ) {

    CURRENT_VALIDATION_RESULT =
      null;

    body.innerHTML = `

      <div
        style="
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        "
      >

        <span
          class="badge badge-pending"
        >
          • AGE 60+: NOT VALIDATED
        </span>

        <span
          class="badge badge-pending"
        >
          • RESIDENCY: NOT VALIDATED
        </span>

        <span
          class="badge badge-pending"
        >
          • DOCS: NOT VALIDATED
        </span>

        <span
          class="badge badge-pending"
        >
          • DUPLICATE RISK: NOT VALIDATED
        </span>

      </div>


      <div
        style="
          margin-top:10px;
          font-size:12.5px;
          color:var(--text-muted);
          line-height:1.5;
        "
      >
        Click <strong>Run Validation</strong>
        to check this application.
      </div>

    `;

    return;
  }


  // SAVED VALIDATION EXISTS

  const passed =
    app.validation_status ===
    'Passed';

  CURRENT_VALIDATION_RESULT = {
    status: app.validation_status,
    passed: passed,
    ageOk: passed,
    residencyOk: passed,
    docsOk: passed,
    duplicateOk: passed,
    missingDocuments: [],
    notes: app.validation_notes || ''
  };

  body.innerHTML = `

    <div
      style="
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      "
    >

      <span
        class="badge ${passed
      ? 'badge-approved'
      : 'badge-review'
    }"
      >
        • VALIDATION:
        ${app.validation_status}
      </span>

      <span
        class="badge badge-approved"
      >
        • SAVED
      </span>

    </div>


    <div
      style="
        margin-top:10px;
        font-size:12.5px;
        color:var(--text-muted);
        line-height:1.5;
      "
    >

      ${app.validation_notes ||
    'Validation result has been saved.'
    }

    </div>

  `;
}

/* Document status helpers */
const DOC_STATUS = { idFront: 'pending', idBack: 'pending', photo: 'pending', bc: 'pending', cedula: 'pending', signature: 'pending' };

/* Document label map for viewer */
const DOC_LABELS = {
  idFront: 'Valid ID (Front)',
  idBack: 'Valid ID (Back)',
  photo: 'Latest Photo',
  bc: 'Birth Certificate',
  cedula: 'Community Tax Certificate',
  signature: 'Signature'
};
const DOC_KEYS = ['idFront', 'idBack', 'photo', 'bc', 'cedula', 'signature'];
const DOC_PREVIEW_MAP = { idFront: 'doc-id-front-preview', idBack: 'doc-id-back-preview', photo: 'doc-photo-preview', bc: 'doc-bc-preview', cedula: 'doc-cedula-preview', signature: 'doc-signature-preview' };

/* Current viewer state */
let docViewerIndex = 0;
let docViewerDocs = [];

function resetDocStatuses() {
  Object.keys(DOC_STATUS).forEach(k => DOC_STATUS[k] = 'pending');
  DOC_KEYS.forEach(doc => {
    const el = document.getElementById('doc-' + doc.replace(/([A-Z])/g, '-$1').toLowerCase() + '-status');
    if (el) { el.className = 'doc-card__status pending'; el.textContent = 'Pending'; }
  });
  Object.values(DOC_PREVIEW_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = 'No preview';
      el.style.background = '';
      el.style.backgroundImage = '';
    }
  });
  const sum = document.getElementById('docs-summary');
  if (sum) sum.textContent = 'All documents pending review';
}

function loadSavedDocStatuses(app) {
  resetDocStatuses();

  if (
    !app ||
    !Array.isArray(
      app.documentAuthentications
    )
  ) {
    return;
  }

  const databaseToUi = {
    pending: 'pending',
    approved: 'ok',
    verified: 'ok',
    reupload: 'warn',
    rejected: 'bad'
  };

  const databaseToDoc = {
    valid_id: 'idFront',
    valid_id_back: 'idBack',
    latest_photo: 'photo',
    birth_certificate: 'bc',
    community_tax_certificate: 'cedula',
    signature: 'signature'
  };

  app.documentAuthentications.forEach(
    record => {
      const doc =
        databaseToDoc[
        record.document_type
        ];

      if (!doc) {
        return;
      }

      const state =
        databaseToUi[
        String(
          record.authentication_status ||
          'pending'
        ).toLowerCase()
        ] || 'pending';

      DOC_STATUS[doc] = state;

      const elId =
        'doc-' +
        doc
          .replace(
            /([A-Z])/g,
            '-$1'
          )
          .toLowerCase() +
        '-status';

      const statusEl =
        document.getElementById(elId);

      if (statusEl) {
        statusEl.className =
          'doc-card__status ' +
          (
            state === 'ok'
              ? 'ok'
              : state === 'warn'
                ? 'warn'
                : state === 'bad'
                  ? 'bad'
                  : 'ok'
          );

        statusEl.textContent =
          state === 'ok'
            ? 'Approved'
            : state === 'warn'
              ? 'Re-upload'
              : state === 'bad'
                ? 'Rejected'
                : 'Pending';
      }
    }
  );

  updateDocsSummary();
}

/* Populate doc previews with thumbnails from applicant data */
function populateDocPreviews(app) {
  if (!app || !app.documents) return;
  DOC_KEYS.forEach(doc => {
    const url = app.documents[doc];
    const el = document.getElementById(DOC_PREVIEW_MAP[doc]);
    if (!el) return;
    if (url) {
      el.innerHTML = '';
      el.style.background = 'none';
      el.style.backgroundImage = 'url(' + url + ')';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else {
      el.textContent = 'No document uploaded';
      el.style.background = '';
      el.style.backgroundImage = '';
    }
  });
}

/* Open the document viewer lightbox */
function viewDocument(docKey) {
  if (!CURRENT_APP_ID) return;
  const app = APP_DB[CURRENT_APP_ID] || FULL_APPLICANTS.find(a => a.id === CURRENT_APP_ID);
  const docs = (app && app.documents) || {};
  docViewerDocs = DOC_KEYS.map(k => ({ key: k, label: DOC_LABELS[k], url: docs[k] || '' }));
  docViewerIndex = Math.max(0, docViewerDocs.findIndex(d => d.key === docKey));
  renderDocViewer();
  document.getElementById('doc-viewer-backdrop').classList.add('show');
  document.body.style.overflow = 'hidden';
  appendAudit(CURRENT_USER?.displayName || 'Staff', 'Viewed document: ' + (DOC_LABELS[docKey] || docKey), CURRENT_ROLE);
}

function renderDocViewer() {
  const doc = docViewerDocs[docViewerIndex];
  if (!doc) return;
  const img = document.getElementById('doc-viewer-img');
  const empty = document.getElementById('doc-viewer-empty');
  const title = document.getElementById('doc-viewer-title');
  const counter = document.getElementById('doc-viewer-counter');
  const docname = document.getElementById('doc-viewer-docname');
  const applicant = document.getElementById('doc-viewer-applicant');
  const prevBtn = document.getElementById('doc-viewer-prev');
  const nextBtn = document.getElementById('doc-viewer-next');
  const app = APP_DB[CURRENT_APP_ID] || FULL_APPLICANTS.find(a => a.id === CURRENT_APP_ID);
  if (title) title.textContent = doc.label || 'Document Preview';
  if (counter) counter.textContent = (docViewerIndex + 1) + ' / ' + docViewerDocs.length;
  if (docname) docname.textContent = doc.label || '—';
  if (applicant) applicant.textContent = (app ? app.name : '') + ' · ' + (app ? app.id : '');
  if (prevBtn) prevBtn.disabled = docViewerIndex <= 0;
  if (nextBtn) nextBtn.disabled = docViewerIndex >= docViewerDocs.length - 1;
  if (doc.url) {
    if (img) { img.src = doc.url; img.style.display = 'block'; }
    if (empty) empty.style.display = 'none';
  } else {
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (empty) empty.style.display = 'flex';
  }
}

function navDocViewer(dir) {
  docViewerIndex = Math.max(0, Math.min(docViewerDocs.length - 1, docViewerIndex + dir));
  renderDocViewer();
}

function closeDocViewer() {
  const bd = document.getElementById('doc-viewer-backdrop');
  if (bd) bd.classList.remove('show');
  document.body.style.overflow = '';
}

/* Keyboard navigation for doc viewer */
document.addEventListener('keydown', function (e) {
  var bd = document.getElementById('doc-viewer-backdrop');
  if (!bd || !bd.classList.contains('show')) return;
  if (e.key === 'Escape') closeDocViewer();
  else if (e.key === 'ArrowLeft') navDocViewer(-1);
  else if (e.key === 'ArrowRight') navDocViewer(1);
});

async function setDocStatus(doc, state, options = {}) {
  if (!CURRENT_APP_ID) {
    showToast(
      'No application selected.',
      'error'
    );
    return false;
  }

  const statusMap = {
    ok: 'approved',
    warn: 'reupload',
    pending: 'pending'
  };

  const databaseStatus =
    statusMap[state] || 'pending';

  const documentTypeMap = {
    idFront: 'valid_id',
    idBack: 'valid_id_back',
    photo: 'latest_photo',
    bc: 'birth_certificate',
    cedula: 'community_tax_certificate',
    signature: 'signature'
  };

  const documentType =
    documentTypeMap[doc];

  if (!documentType) {
    showToast(
      'Invalid document type.',
      'error'
    );
    return false;
  }

  // Preserve the last saved state so a failed API request does not
  // leave the interface showing an approval that was never saved.
  const previousState = DOC_STATUS[doc] || 'pending';
  const previousApplicationStatus =
    String(APP_DB[CURRENT_APP_ID]?.status || 'Pending').trim();

  // Optimistically update the UI
  DOC_STATUS[doc] = state;

  const labels = {
    ok: 'Approved',
    warn: 'Re-upload',
    pending: 'Pending'
  };

  const elId =
    'doc-' +
    doc
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase() +
    '-status';

  const el =
    document.getElementById(elId);

  if (el) {
    el.className =
      'doc-card__status ' +
      (
        state === 'ok'
          ? 'ok'
          : state === 'warn'
            ? 'warn'
            : state === 'bad'
              ? 'bad'
              : 'ok'
      );

    el.textContent =
      labels[state] || state;
  }

  updateDocsSummary();

  try {
    const response = await fetch(
      `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(
        CURRENT_APP_ID
      )}/documents/${encodeURIComponent(
        documentType
      )}/authentication`,
      {
        method: 'PUT',

        headers: getAuthHeaders(),

        body: JSON.stringify({
          status: databaseStatus,

          method: 'staff_review',

          authenticated_by: null,

          remarks:
            databaseStatus === 'approved'
              ? 'Document approved by staff.'
              : databaseStatus === 'verified'
                ? 'Document verified by staff.'
                : databaseStatus === 'reupload'
                  ? 'Document requires re-upload.'
                  : databaseStatus === 'rejected'
                    ? 'Document rejected by staff.'
                    : 'Document pending review.'
        })
      }
    );

    const result =
      await response.json();

    
  if (!response.ok || !result.success) {
    console.error('Document authentication API error:', {
      httpStatus: response.status,
      message: result.message,
      databaseError: result.error
    });

    throw new Error(
      result.error ||
      result.message ||
      'Failed to save document status.'
    );
  }

    // Keep the saved authentication in the current application object
    if (APP_DB[CURRENT_APP_ID]) {
      if (!Array.isArray(
        APP_DB[CURRENT_APP_ID]
          .documentAuthentications
      )) {
        APP_DB[CURRENT_APP_ID]
          .documentAuthentications = [];
      }

      const list =
        APP_DB[CURRENT_APP_ID]
          .documentAuthentications;

      const saved =
        result.documentAuthentication;

      const existingIndex =
        list.findIndex(
          item =>
            item.document_type ===
            saved.document_type
        );

      if (existingIndex >= 0) {
        list[existingIndex] = saved;
      } else {
        list.push(saved);
      }
    }

    const savedApplicationStatus = result.application_status;
    const statusPromoted =
      databaseStatus === 'approved' &&
      previousApplicationStatus.toLowerCase() === 'pending' &&
      savedApplicationStatus === 'Under Review';

    if (savedApplicationStatus) {
      const application = APP_DB[CURRENT_APP_ID];
      if (application) application.status = savedApplicationStatus;

      syncApplicationsTableBadge(CURRENT_APP_ID, savedApplicationStatus);
      syncRecentSubmissionsStatus(CURRENT_APP_ID, savedApplicationStatus);

      if (typeof LIVE_APPLICATIONS !== 'undefined' && Array.isArray(LIVE_APPLICATIONS)) {
        const liveApplication = LIVE_APPLICATIONS.find(item =>
          String(item.application_id || item.id) === String(CURRENT_APP_ID)
        );
        if (liveApplication) liveApplication.status = savedApplicationStatus;
        if (typeof updateApplicantSummaryCards === 'function') updateApplicantSummaryCards(LIVE_APPLICATIONS);
        if (typeof updateApplicationSummaryCards === 'function') updateApplicationSummaryCards(LIVE_APPLICATIONS);
        if (typeof renderLiveApplicants === 'function') renderLiveApplicants(LIVE_APPLICATIONS);
        if (typeof renderLiveApplications === 'function') renderLiveApplications(LIVE_APPLICATIONS);
      }

      const fullApplication = FULL_APPLICANTS.find(item => String(item.id) === String(CURRENT_APP_ID));
      if (fullApplication) fullApplication.status = savedApplicationStatus;

      if (CURRENT_APP_ID && application) {
        renderWorkflow(savedApplicationStatus);
        const modalSub = document.getElementById('modal-sub');
        if (modalSub) {
          modalSub.textContent =
            `${application.id} · Barangay: ${application.barangay || '—'} · Status: ${savedApplicationStatus}`;
        }
      }
      updateStatusTabCounts();
    }

    appendAudit(
      CURRENT_USER?.displayName ||
      'Staff',
      `Document updated: ${DOC_LABELS[doc] || doc
      } → ${labels[state] || state}`,
      CURRENT_ROLE || 'Staff'
    );

    if (!options.silent) {
      if (statusPromoted) {
        showToast(
          `${DOC_LABELS[doc] || doc} approved. Application status changed to Under Review.`,
          'success'
        );
      } else if (databaseStatus === 'approved' && !savedApplicationStatus) {
        showToast(
          `${DOC_LABELS[doc] || doc} was approved, but the application status could not be updated. ${result.application_status_error || 'Refresh and verify the status.'}`,
          'error'
        );
      } else {
        showToast(
          `${DOC_LABELS[doc] || doc} saved as ${labels[state] || state}.`,
          'success'
        );
      }
    }

    return true;

  } catch (error) {
    console.error(
      'Failed to save document authentication:',
      error
    );

    // Roll back the optimistic UI change when the database rejects the update.
    DOC_STATUS[doc] = previousState;
    if (el) {
      el.className =
        'doc-card__status ' +
        (previousState === 'ok'
          ? 'ok'
          : previousState === 'warn'
            ? 'warn'
            : 'pending');
      el.textContent =
        labels[previousState] || 'Pending';
    }
    updateDocsSummary();

    if (!options.silent) {
      showToast(
        'Document status was not saved: ' +
        error.message,
        'error'
      );
    }

    return false;
  }
}

async function saveDocumentAuthentication(
  doc,
  databaseStatus
) {
  if (!CURRENT_APP_ID) {
    showToast(
      'No application selected.',
      'error'
    );
    return false;
  }

  const documentTypeMap = {
    idFront: 'valid_id',
    idBack: 'valid_id_back',
    photo: 'latest_photo',
    bc: 'birth_certificate',
    cedula: 'community_tax_certificate',
    signature: 'signature'
  };

  const documentType =
    documentTypeMap[doc];

  if (!documentType) {
    showToast(
      'Invalid document type.',
      'error'
    );
    return false;
  }

  try {
    const response = await fetch(
      `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(
        CURRENT_APP_ID
      )}/documents/${encodeURIComponent(
        documentType
      )}/authentication`,
      {
        method: 'PUT',

        headers: getAuthHeaders(),

        body: JSON.stringify({
          status: databaseStatus,

          method: 'staff_review',

          authenticated_by: null,

          remarks:
            databaseStatus === 'verified'
              ? 'Document verified by staff.'
              : databaseStatus === 'pending'
                ? 'Document returned to pending review.'
                : null
        })
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        'Failed to save document verification.'
      );
    }

    if (APP_DB[CURRENT_APP_ID]) {
      if (!Array.isArray(
        APP_DB[CURRENT_APP_ID]
          .documentAuthentications
      )) {
        APP_DB[CURRENT_APP_ID]
          .documentAuthentications = [];
      }

      const list =
        APP_DB[CURRENT_APP_ID]
          .documentAuthentications;

      const saved =
        result.documentAuthentication;

      const existingIndex =
        list.findIndex(
          item =>
            item.document_type ===
            saved.document_type
        );

      if (existingIndex >= 0) {
        list[existingIndex] = saved;
      } else {
        list.push(saved);
      }
    }

    appendAudit(
      CURRENT_USER?.displayName ||
      'Staff',
      `Document verification updated: ${DOC_LABELS[doc] || doc
      } → ${databaseStatus}`,
      CURRENT_ROLE || 'Staff'
    );

    return true;

  } catch (error) {
    console.error(
      'Failed to save document verification:',
      error
    );

    showToast(
      'Document verification was not saved: ' +
      error.message,
      'error'
    );

    return false;
  }
}

function updateDocsSummary() {
  const sum = document.getElementById('docs-summary');
  if (!sum) return; // not every portal page has the docs summary card
  const vals = Object.values(DOC_STATUS);
  const allOk = vals.every(v => v === 'ok');
  const anyReupload = vals.some(v => v === 'warn');
  const allPending = vals.every(v => v === 'pending');
  if (allPending) sum.textContent = 'All documents pending review';
  else if (allOk) sum.textContent = 'All required documents approved';
  else if (anyReupload) sum.textContent = 'Re-upload requested for some documents';
  else sum.textContent = 'Some documents pending review';
}

async function approveAllDocs() {
  if (!CURRENT_APP_ID) {
    showToast('No application selected.', 'error');
    return;
  }

  const docs = ['idFront', 'idBack', 'photo', 'bc', 'cedula', 'signature'];
  const documentTypeMap = {
    idFront: 'valid_id',
    idBack: 'valid_id_back',
    photo: 'latest_photo',
    bc: 'birth_certificate',
    cedula: 'community_tax_certificate',
    signature: 'signature'
  };
  const button = document.querySelector('[onclick="approveAllDocs()"]');
  const originalLabel = button ? button.textContent : 'Approve All';

  if (button) {
    button.disabled = true;
    button.textContent = 'Approving...';
  }

  try {
    const response = await fetch(
      `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(CURRENT_APP_ID)}/documents/approve-all`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({})
      }
    );

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to approve all documents.');
    }

    const savedRecords = Array.isArray(result.documentAuthentications)
      ? result.documentAuthentications
      : [];
    const savedByType = new Map(savedRecords.map(record => [record.document_type, record]));

    for (const doc of docs) {
      const documentType = documentTypeMap[doc];
      const saved = savedByType.get(documentType);
      if (!saved || String(saved.authentication_status || '').toLowerCase() !== 'approved') {
        throw new Error('The server did not confirm all six document approvals. Refresh the application details before continuing.');
      }

      DOC_STATUS[doc] = 'ok';
      const elId = 'doc-' + doc.replace(/([A-Z])/g, '-$1').toLowerCase() + '-status';
      const statusEl = document.getElementById(elId);
      if (statusEl) {
        statusEl.className = 'doc-card__status ok';
        statusEl.textContent = 'Approved';
      }
    }

    if (APP_DB[CURRENT_APP_ID]) {
      if (!Array.isArray(APP_DB[CURRENT_APP_ID].documentAuthentications)) {
        APP_DB[CURRENT_APP_ID].documentAuthentications = [];
      }
      const list = APP_DB[CURRENT_APP_ID].documentAuthentications;
      for (const saved of savedRecords) {
        const index = list.findIndex(item => item.document_type === saved.document_type);
        if (index >= 0) list[index] = saved;
        else list.push(saved);
      }
    }

    updateDocsSummary();
    showToast('All six documents approved and saved.', 'success');
  } catch (error) {
    console.error('Failed to approve all documents:', error);
    showToast('Approve All failed: ' + error.message, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function requestReupload() {
  const docs = ['idFront', 'idBack', 'photo', 'bc', 'cedula', 'signature'];

  let successCount = 0;

  for (const doc of docs) {
    const saved =
      await setDocStatus(
        doc,
        'warn'
      );

    if (saved) {
      successCount++;
    }
  }

  if (successCount === docs.length) {
    showToast(
      'Re-upload requested for all documents.',
      'info'
    );

    addNotifyLog(
      CURRENT_APP_ID,
      'Document Re-upload Requested',
      'SMS',
      'Queued'
    );
  } else {
    showToast(
      `${successCount} of ${docs.length} re-upload requests were saved.`,
      'info'
    );
  }
}

async function generateIssuanceForm() {
  if (!CURRENT_APP_ID) return;

  var app = APP_DB[CURRENT_APP_ID];

  if (!app) return;

  if (app.duplicate) {
    showToast(
      'Cannot generate form: duplicate risk flagged. Resolve first.',
      'error'
    );
    return;
  }

  // Block if any document was explicitly rejected
  var docVals = Object.values(DOC_STATUS);

  var anyBad = docVals.some(function (v) {
    return v === 'bad';
  });

  if (anyBad) {
    showToast(
      'Cannot generate form: one or more documents were rejected. Request re-upload first.',
      'error'
    );
    return;
  }

  // Required documents must be approved
  var requiredDocs = {
    bc: 'Birth Certificate',
    cedula: 'Community Tax Certificate'
  };

  var missingVerified = Object.keys(requiredDocs).filter(function (d) {
    return DOC_STATUS[d] !== 'ok';
  });

  if (missingVerified.length > 0) {
    var names = missingVerified
      .map(function (d) {
        return requiredDocs[d];
      })
      .join(' and ');

    showToast(
      'Approve ' + names + ' before generating the form.',
      'error'
    );

    return;
  }

  // Documents that still need to be marked approved
  const issuanceDocs = [
    'idFront',
    'idBack',
    'photo',
    'bc',
    'cedula',
    'signature'
  ];

  const docsToApprove = issuanceDocs.filter(function (doc) {
    return DOC_STATUS[doc] !== 'ok';
  });

  // Save only documents that are not already approved.
  // Run the requests in parallel and suppress individual success notifications.
  if (docsToApprove.length > 0) {
    const results = await Promise.all(
      docsToApprove.map(function (doc) {
        return setDocStatus(doc, 'ok', {
          silent: true
        });
      })
    );

    const allSaved = results.every(function (saved) {
      return saved === true;
    });

    if (!allSaved) {
      showToast(
        'Unable to save all document approvals. Issuance form was not generated.',
        'error'
      );
      return;
    }
  }

  // Make sure all document cards display Approved
  issuanceDocs.forEach(function (doc) {
    const el = document.getElementById(
      'doc-' +
      doc
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase() +
      '-status'
    );

    if (el) {
      el.className = 'doc-card__status ok';
      el.textContent = 'Approved';
    }

    DOC_STATUS[doc] = 'ok';
  });

  updateDocsSummary();

  appendAudit(
    CURRENT_USER?.displayName || 'Staff',
    'Documents approved (issuance form generated)',
    CURRENT_ROLE
  );

  // Open the issuance form immediately
  openIssuancePreview(CURRENT_APP_ID);
}

function rejectCurrent() {
  if (!CURRENT_APP_ID) return;
  updateStatus('Rejected');
  addNotifyLog(CURRENT_APP_ID, 'Status Updated: Rejected', 'SMS', 'Sent');
}

async function saveCurrent() {

  if (!CURRENT_APP_ID) {

    showToast(
      'No application selected.',
      'error'
    );

    return;
  }


  // Make sure validation was run first

  if (!CURRENT_VALIDATION_RESULT) {

    showToast(
      'Please run validation before saving.',
      'error'
    );

    return;
  }


  try {

    // Send validation result to backend

    const response =
      await fetch(
        `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(
          CURRENT_APP_ID
        )}/validation`,
        {
          method: 'PUT',

          headers: getAuthHeaders(),

          body: JSON.stringify({

            validation_status:
              CURRENT_VALIDATION_RESULT.status,

            validation_notes:
              CURRENT_VALIDATION_RESULT.notes

          })

        }
      );


    const result =
      await response.json();


    if (!response.ok || !result.success) {

      throw new Error(
        result.message ||
        'Failed to save validation.'
      );

    }


    // Update local application

    if (APP_DB[CURRENT_APP_ID]) {

      APP_DB[
        CURRENT_APP_ID
      ].validation_status =
        CURRENT_VALIDATION_RESULT.status;


      APP_DB[
        CURRENT_APP_ID
      ].validation_updated_at =
        new Date().toISOString();


      APP_DB[
        CURRENT_APP_ID
      ].validation_notes =
        CURRENT_VALIDATION_RESULT.notes;

    }


    // Audit

    appendAudit(
      CURRENT_USER?.displayName ||
      'Staff',
      'Validation result saved',
      CURRENT_ROLE || 'Staff'
    );


    // Success

    showToast(
      'Validation result saved successfully.',
      'success'
    );


  } catch (error) {

    console.error(
      'Unable to save validation:',
      error
    );


    showToast(
      'Failed to save validation: ' +
      error.message,
      'error'
    );

  }

}

/* Audit log helper (DPA) */
function appendAudit(user, action, source) {
  const tbody = document.getElementById('audit-body');
  if (!tbody) return;
  const now = new Date();
  const ts = now.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const badge = source === 'System' ? 'badge-issued' : 'badge-review';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td data-label="Time"><span class="cell-text">${ts}</span></td>
    <td data-label="User"><span class="cell-text">${user}</span></td>
    <td data-label="Action"><span class="cell-text">${action}</span></td>
    <td style="text-align:right"><span class="badge ${badge}">${source}</span></td>
  `;
  tbody.prepend(tr);
}

/* Notifications log helper */
function addNotifyLog(appId, event, channel, result) {
  const tbody = document.getElementById('notify-log-body');
  if (!tbody) return;
  const emptyRow = tbody.querySelector('.table-empty');
  if (emptyRow) emptyRow.closest('tr').remove();
  const now = new Date();
  const ts = now.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td data-label="Time"><span class="cell-text">${ts}</span></td>
    <td data-label="Application"><span class="cell-text">${appId || '—'}</span></td>
    <td data-label="Event"><span class="cell-text">${event}</span></td>
    <td data-label="Channel"><span class="badge badge-issued">${channel}</span></td>
    <td data-label="Result"><span class="badge badge-approved">${result}</span></td>
    <td style="text-align:right"><button class="row-action always-visible" onclick="openApplicationDetail('${appId}')">Open</button></td>
  `;
  tbody.prepend(tr);
}

/* Bulk reminder (AI recommendation) */
function sendBulkReminder() {
  showToast('Bulk reminders queued for 156 applicants (demo)', 'success');
  addNotifyLog('—', 'Bulk Missing Document Reminder', 'SMS', 'Queued');
}

/* Report export helpers: real CSV and PDF downloads. */
function downloadReportFile(format, title, headers, rows, filenameBase) {
  const safeBase = String(filenameBase || 'osca-report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  const dateStamp = new Date().toISOString().slice(0, 10);
  if (format === 'pdf') {
    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) throw new Error('PDF export library did not load. Refresh the page and try again.');
    const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(String(title || 'OSCA Report'), 14, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Generated: ' + new Date().toLocaleString('en-PH'), 14, 21);
    if (typeof doc.autoTable !== 'function') throw new Error('PDF table support did not load. Refresh the page and try again.');
    doc.autoTable({ head: [headers], body: rows, startY: 26, theme: 'grid', styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' }, headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, margin: { left: 14, right: 14 }, didDrawPage: function () { const page = doc.internal.getNumberOfPages(); doc.setFontSize(8); doc.text('OSCA Bauan · Page ' + page, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 7, { align: 'right' }); } });
    doc.save(safeBase + '-' + dateStamp + '.pdf'); return;
  }
  if (format !== 'csv') throw new Error('Choose PDF or CSV as the export format.');
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(staffExportCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = safeBase + '-' + dateStamp + '.csv';
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportPDF() { return exportData('pdf'); }
function exportExcel() { return exportData('excel'); }
const STAFF_EXPORT_FIELDS = {
  barangay: [
    { key: 'barangay', label: 'Barangay', checked: true, locked: true },
    { key: 'male', label: 'Male', checked: true },
    { key: 'female', label: 'Female', checked: true },
    { key: 'total', label: 'Overall Total', checked: true }
  ],
  records: [
    { key: 'application_id', label: 'Application ID', checked: true },
    { key: 'name', label: 'Applicant Name', checked: true },
    { key: 'barangay', label: 'Barangay', checked: true },
    { key: 'sex', label: 'Sex', checked: true },
    { key: 'age', label: 'Age', checked: false },
    { key: 'application_type', label: 'Application Type', checked: false },
    { key: 'status', label: 'Application Status', checked: true },
    { key: 'membership_status', label: 'Membership Status', checked: false },
    { key: 'created_at', label: 'Date Submitted', checked: false }
  ]
};

function getStaffExportApplications() {
  if (typeof LIVE_APPLICATIONS !== 'undefined' && Array.isArray(LIVE_APPLICATIONS)) {
    return LIVE_APPLICATIONS;
  }
  if (typeof FULL_APPLICANTS !== 'undefined' && Array.isArray(FULL_APPLICANTS)) {
    return FULL_APPLICANTS;
  }
  return [];
}

function staffExportEscapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function openStaffExport() {
  const modal = document.getElementById('staff-export-modal');
  if (!modal) {
    showToast('Export options are unavailable. Please refresh the page.', 'error');
    return;
  }

  const applications = getStaffExportApplications();
  const barangaySelect = document.getElementById('staff-export-barangay');
  const barangays = [...new Set(applications.map(a =>
    String(a.barangay_district || a.barangay || '').trim()
  ).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  if (barangaySelect) {
    barangaySelect.innerHTML = '<option value="">Barangay: All</option>'  +
      barangays.map(name => '<option value="' + staffExportEscapeHtml(name) + '">' + staffExportEscapeHtml(name) + '</option>').join('');
  }

  const statusSelect = document.getElementById('staff-export-status');
  const membershipSelect = document.getElementById('staff-export-membership');
  if (statusSelect) statusSelect.value = '';
  if (membershipSelect) membershipSelect.value = '';

  const typeSelect = document.getElementById('staff-export-type');
  if (typeSelect) typeSelect.value = 'barangay';
  const formatSelect = document.getElementById('staff-export-format');
  if (formatSelect) formatSelect.value = 'csv';
  updateStaffExportFormatLabel();
  updateStaffExportFields();
  const error = document.getElementById('staff-export-error');
  if (error) error.style.display = 'none';
  modal.classList.add('show');
}

function updateStaffExportFormatLabel() {
  const format = document.getElementById('staff-export-format')?.value || 'csv';
  const label = document.querySelector('#staff-export-download span');
  if (label) label.textContent = 'Export ' + format.toUpperCase();
}
function closeStaffExport() {
  document.getElementById('staff-export-modal')?.classList.remove('show');
}

function updateStaffExportFields() {
  const type = document.getElementById('staff-export-type')?.value || 'barangay';
  const container = document.getElementById('staff-export-fields');
  if (!container) return;

  const fields = STAFF_EXPORT_FIELDS[type] || STAFF_EXPORT_FIELDS.barangay;
  container.innerHTML = fields.map(field => `
    <label class="staff-export__field">
      <input type="checkbox" name="staff-export-field" value="${field.key}" ${field.checked ? 'checked' : ''} ${field.locked ? 'disabled checked' : ''}>
      <span>${field.label}</span>
    </label>
  `).join('');
}

function staffExportValue(application, key) {
  const name = [
    application.first_name || application.firstName,
    application.middle_name || application.middleName,
    application.surname || application.last_name || application.lastName
  ].filter(Boolean).join(' ').trim();
  const values = {
    application_id: application.application_id || application.id || '',
    name: name || application.name || '',
    barangay: application.barangay_district || application.barangay || '',
    sex: application.sex || application.gender || '',
    age: application.age ?? '',
    application_type: application.application_type || application.applicationType || '',
    status: application.status || '',
    membership_status: application.membership_status || '',
    created_at: application.created_at || application.submitted_at || application.application_date || ''
  };
  return values[key] ?? '';
}

function staffExportCsvCell(value) {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

function staffExportXml(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function staffPdfText(value) {
  return String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function saveStaffExport(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildAnalyticsExportReport() {
  const applications = getAnalyticsRangeApplications(getStaffExportApplications());
  const rangeLabel = document.getElementById('report-range')?.selectedOptions[0]?.textContent || 'All time';
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const reportId = `OSCA-AN-${stamp}`;
  const reportTitle = document.getElementById('analytics-title')?.textContent.trim() || 'Staff Analytics';
  const scopeLabel = document.getElementById('analytics-scope-badge')?.textContent.trim() || 'Staff Scope';
  const statusCounts = { Pending: 0, 'Under Review': 0, 'In Process': 0, Approved: 0, 'Ready for Release': 0, 'ID Issued / Completed': 0, Rejected: 0 };
  const barangayCounts = new Map();
  const weeklyCounts = new Map();
  const processingDays = [];
  let overdueCount = 0;
  const monthly = Array.from({ length: 12 }, () => ({ submitted: 0, approved: 0, rejected: 0, issued: 0, processingTotal: 0, processingCount: 0 }));
  const ageCounts = [0, 0, 0, 0, 0, 0];
  const currentYear = now.getFullYear();

  applications.forEach(application => {
    const status = normalizeApplicationStatus(application.status);
    if (status === 'pending') statusCounts.Pending++;
    else if (status === 'review') statusCounts['Under Review']++;
    else if (status === 'process') statusCounts['In Process']++;
    else if (status === 'approved') statusCounts.Approved++;
    else if (status === 'ready') statusCounts['Ready for Release']++;
    else if (status === 'issued' || status === 'completed') statusCounts['ID Issued / Completed']++;
    else if (status === 'rejected') statusCounts.Rejected++;

    const barangay = String(application.barangay_district || 'Unknown').trim() || 'Unknown';
    const barangayCount = barangayCounts.get(barangay) || { total: 0, approved: 0, pending: 0 };
    barangayCount.total++;
    if (['approved', 'ready', 'issued', 'completed'].includes(status)) barangayCount.approved++;
    if (status === 'pending' || status === 'review') barangayCount.pending++;
    barangayCounts.set(barangay, barangayCount);

    const submittedValue = application.created_at || application.submitted_at || application.application_date;
    const submitted = submittedValue ? new Date(submittedValue) : null;
    if (['pending', 'review'].includes(status)) {
      const storedPendingDays = Number(application.days_pending);
      const openDays = application.days_pending !== null && application.days_pending !== undefined && application.days_pending !== '' && Number.isFinite(storedPendingDays)
        ? Math.max(0, storedPendingDays)
        : submitted && !Number.isNaN(submitted.getTime())
          ? Math.max(0, Math.floor((now.getTime() - submitted.getTime()) / 86400000))
          : null;
      if (openDays !== null && openDays > 5) overdueCount++;
    }
    if (submitted && !Number.isNaN(submitted.getTime())) {
      const weekStart = new Date(submitted);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      weeklyCounts.set(key, (weeklyCounts.get(key) || 0) + 1);

      const statusValue = application.status_updated_at || application.updated_at;
      const statusDate = statusValue ? new Date(statusValue) : null;
      if (submitted.getFullYear() === currentYear) monthly[submitted.getMonth()].submitted++;
      if (statusDate && !Number.isNaN(statusDate.getTime()) && statusDate >= submitted && ['approved', 'ready', 'issued', 'completed', 'rejected'].includes(status)) {
        processingDays.push((statusDate - submitted) / 86400000);
      }

      const currentStatusDate = statusDate;
      if (currentStatusDate && !Number.isNaN(currentStatusDate.getTime()) && currentStatusDate >= submitted && currentStatusDate.getFullYear() === currentYear) {
        const month = monthly[currentStatusDate.getMonth()];
        if (['approved', 'ready', 'issued', 'completed'].includes(status)) month.approved++;
        if (status === 'rejected') month.rejected++;
        if (status === 'issued' || status === 'completed') month.issued++;
        if (['approved', 'ready', 'issued', 'completed', 'rejected'].includes(status)) {
          const days = Math.max(0, Math.round((currentStatusDate.getTime() - submitted.getTime()) / 86400000));
          month.processingTotal += days;
          month.processingCount++;
        }
      }
    }

    const age = Number(application.age);
    if (Number.isFinite(age)) {
      if (age >= 60 && age <= 64) ageCounts[0]++;
      else if (age >= 65 && age <= 69) ageCounts[1]++;
      else if (age >= 70 && age <= 74) ageCounts[2]++;
      else if (age >= 75 && age <= 79) ageCounts[3]++;
      else if (age >= 80 && age <= 84) ageCounts[4]++;
      else if (age >= 85) ageCounts[5]++;
    }
  });

  const statusRows = Object.entries(statusCounts).map(([status, count]) => [status, count]);
  const barangayRows = [...barangayCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => [name, count.total, count.approved, count.pending]);
  const weeklyRows = [...weeklyCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => [new Date(`${week}T00:00:00`), count]);
  const applicationFlowRows = monthly.map((month, index) => [
    new Date(currentYear, index, 1), month.submitted, month.approved, month.rejected
  ]);
  const queueRows = [
    ['Approved', statusCounts.Approved + statusCounts['Ready for Release'] + statusCounts['ID Issued / Completed']],
    ['Pending', statusCounts.Pending],
    ['In Review', statusCounts['Under Review']],
    ['Rejected', statusCounts.Rejected]
  ];
  const replacements = Array.isArray(window.LIVE_REPLACEMENT_REQUESTS) ? window.LIVE_REPLACEMENT_REQUESTS : [];
  const replacementCounts = { Pending: 0, 'In Process': 0, Completed: 0, Rejected: 0 };
  replacements.forEach(request => {
    const status = String(request.request_status || 'Pending').trim().toLowerCase();
    if (status === 'pending') replacementCounts.Pending++;
    else if (['in process', 'under review', 'ready for release'].includes(status)) replacementCounts['In Process']++;
    else if (status === 'completed') replacementCounts.Completed++;
    else if (status === 'rejected') replacementCounts.Rejected++;
  });
  const readyForHandoff = statusCounts['Ready for Release'];
  const ageTotal = ageCounts.reduce((sum, count) => sum + count, 0);
  let cumulativeIssued = 0;
  const issuanceRows = monthly.map((month, index) => {
    cumulativeIssued += month.issued;
    return [new Date(currentYear, index, 1), month.issued, cumulativeIssued];
  });
  const turnaroundRows = monthly.map((month, index) => [
    new Date(currentYear, index, 1),
    month.processingCount ? Number((month.processingTotal / month.processingCount).toFixed(1)) : 0,
    month.processingCount
  ]);
  const total = applications.length;
  const pendingReview = statusCounts.Pending + statusCounts['Under Review'];
  const averageDays = processingDays.length ? Number((processingDays.reduce((sum, days) => sum + days, 0) / processingDays.length).toFixed(1)) : null;
  const managementAttention = overdueCount
    ? `${overdueCount} open application${overdueCount === 1 ? '' : 's'} exceed the 5-day review threshold; prioritize follow-up.`
    : pendingReview
      ? `${pendingReview} application${pendingReview === 1 ? '' : 's'} await review; none exceed the 5-day threshold.`
      : 'No applications are awaiting review or overdue in this reporting cohort.';

  return {
    reportId, reportTitle, scopeLabel, rangeLabel, generatedAt: now, generated: now.toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }), generatedBy: CURRENT_ROLE || 'Staff', currentYear,
    summary: [
      ['Applications received', total],
      ['Pending review', pendingReview],
      ['Overdue pending review (>5 days)', overdueCount],
      ['IDs issued or completed', statusCounts['ID Issued / Completed']],
      ['Average days to recorded status update', averageDays ?? 'Insufficient timestamp data'],
      ['Records in processing-time average', processingDays.length],
      ['Management attention', managementAttention]
    ],
    managementAttention,
    statusChartRows: [
      ['Pending review', pendingReview],
      ['In Process', statusCounts['In Process']],
      ['Approved / ID-ready', statusCounts.Approved + statusCounts['Ready for Release']],
      ['IDs issued / completed', statusCounts['ID Issued / Completed']],
      ['Rejected', statusCounts.Rejected]
    ],
    statusRows,
    barangayRows,
    weeklyRows,
    applicationFlowRows,
    queueRows,
    replacementRows: Object.entries(replacementCounts),
    handoffRows: [
      ['Applications ready for handoff', readyForHandoff],
      ['Share of selected applications', total ? readyForHandoff / total : 0]
    ],
    ageRows: ageCounts.map((count, index) => [
      ['60–64', '65–69', '70–74', '75–79', '80–84', '85+'][index],
      count,
      ageTotal ? count / ageTotal : 0
    ]),
    issuanceRows,
    turnaroundRows,
    notes: [
      'Reporting period applies to applications by submission date (created_at, submitted_at, or application_date). Last 7/30 days are inclusive through the report date; quarter is quarter-to-date; year is year-to-date; All time includes all loaded application records.',
      'Pending review combines Pending and Under Review. Overdue counts include currently open Pending or Under Review applications more than 5 days old as of the report generation time.',
      'Average days to recorded status update is the mean number of days from submission to the latest valid status update for Approved, Ready for Release, ID Issued / Completed, or Rejected records. It is not a completion-time measure for unresolved applications.',
      'Replacement requests are all currently loaded requests; the Analytics page does not apply the application date-range filter to this panel.',
      'Weekly submissions exclude records without a valid submission date. Monthly charts show the current calendar year and use the selected applications; monthly turnaround rows show the mean recorded days and the qualifying record count.',
      'Source: currently loaded OSCA application and replacement-request records. This is an aggregate snapshot; applicant names and direct identifiers are excluded.'
    ],
    recordCount: total
  };
}

function analyticsReportSheets(report) {
  return [
    { name: 'Executive Summary', header: ['Measure', 'Value'], rows: report.summary, widths: [42, 54], pdfWidths: [250, 282], formats: { 1: 'integer' }, rowFormats: [{ 1: 'integer' }, { 1: 'integer' }, { 1: 'integer' }, { 1: 'integer' }, { 1: 'decimal' }, { 1: 'integer' }, {}] },
    { name: 'Report Details', header: ['Report information', 'Value'], rows: [
      ['Office', 'Office of the Senior Citizen Affairs (OSCA)'],
      ['Report title', report.reportTitle],
      ['Report ID', report.reportId],
      ['Reporting period', report.rangeLabel],
      ['Analytics scope', report.scopeLabel],
      ['Generated', report.generatedAt],
      ['Generated by role', report.generatedBy],
      ['Applications included', report.recordCount],
      ['Data source and privacy', report.notes[5]]
    ], widths: [25, 42], pdfWidths: [190, 342], formats: { 1: 'integer' }, rowFormats: [{}, {}, {}, {}, {}, { 1: 'datetime' }] },
    { name: 'Status Breakdown', header: ['Application status', 'Applications'], rows: report.statusRows, widths: [32, 18], pdfWidths: [370, 162], formats: { 1: 'integer' } },
    { name: 'Barangay Workload', header: ['Barangay', 'Applications', 'Approved / ID-ready', 'Pending review'], rows: report.barangayRows, widths: [34, 17, 22, 18], pdfWidths: [205, 100, 125, 102], formats: { 1: 'integer', 2: 'integer', 3: 'integer' }, wrapColumns: [0] },
    { name: 'Weekly Submissions', header: ['Week starting', 'Applications'], rows: report.weeklyRows, widths: [20, 18], pdfWidths: [370, 162], formats: { 0: 'date', 1: 'integer' } },
    { name: 'Application Flow', header: ['Month', 'Submitted', 'Approved', 'Rejected'], rows: report.applicationFlowRows, widths: [20, 16, 16, 16], pdfWidths: [205, 110, 110, 107], formats: { 0: 'month', 1: 'integer', 2: 'integer', 3: 'integer' } },
    { name: 'Queue Mix', header: ['Current status group', 'Applications'], rows: report.queueRows, widths: [32, 18], pdfWidths: [370, 162], formats: { 1: 'integer' } },
    { name: 'Replacement Requests', header: ['Request status', 'Requests'], rows: report.replacementRows, widths: [32, 18], pdfWidths: [370, 162], formats: { 1: 'integer' } },
    { name: 'Ready for Handoff', header: ['Measure', 'Value'], rows: report.handoffRows, widths: [36, 20], pdfWidths: [370, 162], formats: { 1: 'integer' }, rowFormats: [{}, { 1: 'percent' }] },
    { name: 'Age Distribution', header: ['Age group (years)', 'Seniors', 'Share of known ages'], rows: report.ageRows, widths: [24, 16, 22], pdfWidths: [235, 115, 182], formats: { 1: 'integer', 2: 'percent' } },
    { name: 'ID Issuance', header: ['Month', 'IDs issued this month', 'Cumulative IDs issued'], rows: report.issuanceRows, widths: [20, 23, 24], pdfWidths: [205, 165, 162], formats: { 0: 'month', 1: 'integer', 2: 'integer' } },
    { name: 'Turnaround Time', header: ['Month', 'Average days to status update', 'Qualifying records'], rows: report.turnaroundRows, widths: [20, 29, 20], pdfWidths: [190, 210, 132], formats: { 0: 'month', 1: 'decimal', 2: 'integer' } },
    { name: 'Report Notes', header: ['Topic', 'Explanation'], rows: [
      ['Reporting period', report.notes[0]],
      ['Pending and overdue definitions', report.notes[1]],
      ['Processing-time definition', report.notes[2]],
      ['Replacement-request scope', report.notes[3]],
      ['Submission and monthly chart scope', report.notes[4]],
      ['Source and privacy', report.notes[5]]
    ], widths: [32, 90], pdfWidths: [170, 362], wrapColumns: [0, 1] }
  ];
}

function analyticsReportCsv(report) {
  const headers = ['Report section', 'Measure', 'Period or group', 'Value', 'Notes'];
  const rows = [];
  const add = (section, measure, group = '', value = '', notes = '') => rows.push([section, measure, group, value, notes]);
  const csvCell = value => {
    const text = String(value ?? '');
    const safeText = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : value;
    return staffExportCsvCell(safeText);
  };
  add('Report details', 'Office', '', 'Office of the Senior Citizen Affairs (OSCA)');
  add('Report details', 'Report title', '', report.reportTitle);
  add('Report details', 'Report ID', '', report.reportId);
  add('Report details', 'Reporting period', '', report.rangeLabel);
  add('Report details', 'Analytics scope', '', report.scopeLabel);
  add('Report details', 'Generated', '', report.generated);
  add('Report details', 'Generated by role', '', report.generatedBy);
  add('Report details', 'Applications included', '', report.recordCount);
  add('Report details', 'Data source and privacy', '', report.notes[5]);
  report.summary.forEach(([metric, value]) => add('Executive summary', metric, '', value ?? 'Not available'));
  report.statusRows.forEach(([status, count]) => add('Status breakdown', 'Applications', status, count));
  report.barangayRows.forEach(([barangay, total, approved, pending]) => add(
    'Barangay workload', 'Applications', barangay, total, `Approved / ID-ready: ${approved}; pending review: ${pending}`
  ));
  report.weeklyRows.forEach(([week, count]) => add('Weekly submissions', 'Applications', week.toLocaleDateString('en-PH'), count));
  report.applicationFlowRows.forEach(([month, submitted, approved, rejected]) => {
    add('Application flow', 'Submitted', month.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }), submitted);
    add('Application flow', 'Approved', month.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }), approved);
    add('Application flow', 'Rejected', month.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }), rejected);
  });
  report.queueRows.forEach(([status, count]) => add('Queue mix', 'Applications', status, count));
  report.replacementRows.forEach(([status, count]) => add(
    'Replacement requests', 'Requests', status, count, 'All currently loaded requests; not limited by the application date range.'
  ));
  report.handoffRows.forEach(([metric, value]) => add(
    'Ready for handoff', metric, '', metric === 'Share of selected applications' ? `${Math.round(value * 100)}%` : value
  ));
  report.ageRows.forEach(([group, count, share]) => add('Age distribution', 'Seniors', group, count, `${(share * 100).toFixed(1)}% of known ages`));
  report.issuanceRows.forEach(([month, issued, cumulative]) => {
    const label = month.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
    add('ID issuance', 'IDs issued this month', label, issued);
    add('ID issuance', 'Cumulative IDs issued', label, cumulative);
  });
  report.turnaroundRows.forEach(([month, average, count]) => add(
    'Turnaround time', 'Average days to status update', month.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }),
    average.toFixed(1), `${count} qualifying records`
  ));
  report.notes.forEach(note => add('Notes', 'Data interpretation', '', '', note));
  return new Blob(['\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
}

function analyticsReportExcel(report) {
  const sheets = analyticsReportSheets(report);
  const columnName = number => {
    let name = '';
    while (number > 0) {
      const remainder = (number - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      number = Math.floor((number - 1) / 26);
    }
    return name;
  };
  const sheetParts = sheets.map((sheet, sheetIndex) => {
    const sourceRows = [sheet.header, ...sheet.rows];
    const maxColumns = Math.max(...sourceRows.map(row => row.length));
    const rows = sourceRows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
      const format = sheet.rowFormats?.[rowIndex - 1]?.[columnIndex] || sheet.formats?.[columnIndex];
      const style = rowIndex === 0 ? 1 : sheet.wrapColumns?.includes(columnIndex) && typeof value === 'string' ? 8 : format === 'date' ? 2 : format === 'month' ? 3 : format === 'decimal' ? 4 : format === 'percent' ? 5 : format === 'datetime' ? 6 : format === 'integer' ? 7 : 0;
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const serial = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds()) / 86400000 + 25569;
        return `<c r="${ref}" s="${style}"><v>${serial}</v></c>`;
      }
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${staffExportXml(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const lastColumn = columnName(maxColumns);
    const lastRow = sourceRows.length;
    const columns = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
    return {
      name: sheet.name,
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`,
      relationshipId: `rId${sheetIndex + 1}`
    };
  });
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetParts.map((sheet, index) => `<sheet name="${staffExportXml(sheet.name)}" sheetId="${index + 1}" r:id="${sheet.relationshipId}"/>`).join('')}</sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetParts.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheetParts.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="5"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0%"/><numFmt numFmtId="166" formatCode="mmm yyyy"/><numFmt numFmtId="167" formatCode="#,##0"/><numFmt numFmtId="168" formatCode="mmm d, yyyy h:mm AM/PM"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF19345C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7E0EA"/></left><right style="thin"><color rgb="FFD7E0EA"/></right><top style="thin"><color rgb="FFD7E0EA"/></top><bottom style="thin"><color rgb="FFD7E0EA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetParts.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;

  const encoder = new TextEncoder();
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const crc32 = bytes => {
    let crc = 0xFFFFFFFF;
    bytes.forEach(byte => { crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8); });
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
  const parts = [
    ['[Content_Types].xml', contentTypes], ['_rels/.rels', rootRels],
    ['xl/workbook.xml', workbook], ['xl/_rels/workbook.xml.rels', workbookRels], ['xl/styles.xml', styles],
    ...sheetParts.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, sheet.xml])
  ];
  const localFiles = [];
  const centralFiles = [];
  let localOffset = 0;
  parts.forEach(([path, contents]) => {
    const name = encoder.encode(path);
    const data = encoder.encode(contents);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034B50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    localFiles.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralFiles.push(central);
    localOffset += local.length;
  });
  const centralSize = centralFiles.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(8, parts.length, true);
  endView.setUint16(10, parts.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  return new Blob([...localFiles, ...centralFiles, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function analyticsReportPdf(report) {
  const pageWidth = 612;
  const contentLeft = 40;
  const contentWidth = 532;
  const bottomLimit = 54;
  const pages = [[]];
  let pageIndex = 0;
  let cursorY = 690;
  const sheets = analyticsReportSheets(report).filter(sheet => sheet.name !== 'Report Details');
  const wrapText = (value, maxCharacters) => {
    const words = staffPdfText(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach(word => {
      while (word.length > maxCharacters) {
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(word.slice(0, maxCharacters));
        word = word.slice(maxCharacters);
      }
      if (!word) return;
      if (line && `${line} ${word}`.length > maxCharacters) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    });
    if (line || !lines.length) lines.push(line);
    return lines;
  };
  const displayValue = (value, format) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return format === 'month'
        ? value.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
        : value.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (format === 'percent') return `${Math.round(value * 100)}%`;
      if (format === 'decimal') return value.toFixed(1);
      return value.toLocaleString('en-PH');
    }
    return String(value ?? '');
  };
  const startNewPage = () => {
    pages.push([]);
    pageIndex++;
    cursorY = 690;
  };
  const addSectionHeading = title => {
    pages[pageIndex].push(
      'q', '0.91 0.94 0.98 rg', `40 ${cursorY - 16} ${contentWidth} 18 re f`, 'Q',
      'BT', '/F2 11 Tf', '0.10 0.18 0.33 rg', '48', String(cursorY - 12), 'Td',
      `(${staffPdfText(title)}) Tj`, 'ET'
    );
    cursorY -= 23;
  };
  const addTableHeading = sheet => {
    let x = contentLeft;
    sheet.header.forEach((value, columnIndex) => {
      const width = sheet.pdfWidths[columnIndex];
      pages[pageIndex].push(
        'q', '0.10 0.18 0.33 rg', `${x} ${cursorY - 18} ${width} 19 re f`, 'Q',
        'BT', '/F2 9 Tf', '1 1 1 rg', `${x + 6}`, String(cursorY - 12), 'Td',
        `(${staffPdfText(value)}) Tj`, 'ET'
      );
      x += width;
    });
    cursorY -= 20;
  };
  const startSection = sheet => {
    addSectionHeading(sheet.name.toUpperCase());
    addTableHeading(sheet);
  };

  sheets.forEach(sheet => {
    if (sheet.name === 'Status Breakdown') {
      startNewPage();
      addSectionHeading('SUPPORTING APPENDIX');
    }
    if (cursorY - 45 < bottomLimit) startNewPage();
    startSection(sheet);
    const rows = sheet.rows.length ? sheet.rows : [['No records for this period', ...Array(Math.max(0, sheet.header.length - 1)).fill('')]];
    rows.forEach((row, rowIndex) => {
      const cellLines = row.map((value, columnIndex) => {
        const format = sheet.rowFormats?.[rowIndex]?.[columnIndex] || sheet.formats?.[columnIndex];
        const text = displayValue(value, format);
        return wrapText(text, Math.max(8, Math.floor((sheet.pdfWidths[columnIndex] - 12) / 4.6)));
      });
      const rowHeight = Math.max(20, Math.max(...cellLines.map(lines => lines.length)) * 11 + 8);
      if (cursorY - rowHeight < bottomLimit) {
        startNewPage();
        startSection(sheet);
      }
      const top = cursorY;
      const isAttentionRow = sheet.name === 'Executive Summary' && row[0] === 'Management attention';
      const rowFill = isAttentionRow ? '1 0.97 0.87 rg' : rowIndex % 2 ? '0.96 0.97 0.98 rg' : '1 1 1 rg';
      pages[pageIndex].push('q', rowFill, `${contentLeft} ${top - rowHeight} ${contentWidth} ${rowHeight} re f`, 'Q');
      let x = contentLeft;
      cellLines.forEach((lines, columnIndex) => {
        const width = sheet.pdfWidths[columnIndex];
        lines.forEach((line, lineIndex) => {
          pages[pageIndex].push(
            'BT', `${isAttentionRow ? '/F2' : '/F1'} 9 Tf`, isAttentionRow ? '0.35 0.25 0.05 rg' : '0.12 0.16 0.22 rg', `${x + 6}`, String(top - 13 - lineIndex * 11), 'Td',
            `(${line}) Tj`, 'ET'
          );
        });
        pages[pageIndex].push('q', '0.84 0.87 0.90 RG', '0.5 w', `${x + width} ${top - rowHeight} m`, `${x + width} ${top} l`, 'S', 'Q');
        x += width;
      });
      pages[pageIndex].push('q', '0.84 0.87 0.90 RG', '0.5 w', `${contentLeft} ${top - rowHeight} m`, `${contentLeft + contentWidth} ${top - rowHeight} l`, 'S', 'Q');
      cursorY -= rowHeight;
    });
    cursorY -= 12;

    if (sheet.name === 'Executive Summary') {
      addSectionHeading('APPLICATION STATUS SNAPSHOT');
      const maxCount = Math.max(1, ...report.statusChartRows.map(([, count]) => count));
      const colorByLabel = {
        'Pending review': '0.96 0.62 0.10',
        'In Process': '0.23 0.51 0.96',
        'Approved / ID-ready': '0.06 0.62 0.43',
        'IDs issued / completed': '0.05 0.48 0.34',
        Rejected: '0.88 0.25 0.25'
      };
      report.statusChartRows.forEach(([label, count]) => {
        const y = cursorY - 10;
        const barWidth = count ? Math.max(2, 245 * count / maxCount) : 0;
        pages[pageIndex].push(
          'BT', '/F1 9 Tf', '0.12 0.16 0.22 rg', '48', String(y), 'Td',
          `(${staffPdfText(label)}) Tj`, 'ET',
          'q', '0.91 0.94 0.97 rg', `185 ${y - 2} 250 10 re f`, 'Q'
        );
        if (barWidth) pages[pageIndex].push('q', `${colorByLabel[label] || '0.23 0.51 0.96'} rg`, `185 ${y - 2} ${barWidth} 10 re f`, 'Q');
        pages[pageIndex].push(
          'BT', '/F2 9 Tf', '0.12 0.16 0.22 rg', '448', String(y), 'Td',
          `(${count.toLocaleString('en-PH')}) Tj`, 'ET'
        );
        cursorY -= 19;
      });
      cursorY -= 5;
    }
  });

  const objects = [];
  const pageIds = pages.map((_, index) => 3 + index * 2);
  const regularFontId = 3 + pages.length * 2;
  const boldFontId = regularFontId + 1;
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = [
      'q', '0.10 0.18 0.33 rg', '36 758 540 70 re f', 'Q',
      'BT', '/F2 10 Tf', '1 1 1 rg', '50 805 Td', `(OFFICE OF THE SENIOR CITIZEN AFFAIRS - OSCA) Tj`, 'ET',
      'BT', '/F2 17 Tf', '1 1 1 rg', '50 778 Td', `(${staffPdfText(report.reportTitle.toUpperCase())} REPORT) Tj`, 'ET',
      'BT', '/F1 9 Tf', '0.12 0.16 0.22 rg', '42 740 Td', `(Report ID: ${staffPdfText(report.reportId)}) Tj`, 'ET',
      'BT', '/F1 9 Tf', '0.12 0.16 0.22 rg', '42 727 Td', `(Reporting period: ${staffPdfText(report.rangeLabel)}) Tj`, 'ET',
      'BT', '/F1 9 Tf', '0.12 0.16 0.22 rg', '42 714 Td', `(Generated: ${staffPdfText(report.generated)}) Tj`, 'ET',
      'BT', '/F1 9 Tf', '0.12 0.16 0.22 rg', '330 740 Td', `(Analytics scope: ${staffPdfText(report.scopeLabel)}) Tj`, 'ET',
      'BT', '/F1 9 Tf', '0.12 0.16 0.22 rg', '330 727 Td', `(Generated by role: ${staffPdfText(report.generatedBy)}) Tj`, 'ET'
    ];
    commands.push(...pageLines);
    commands.push('BT', '/F1 8 Tf', '0.35 0.40 0.48 rg', '42 24 Td', '(Official use - aggregate statistics; applicant identifiers are excluded.) Tj', 'ET', 'BT', '/F1 8 Tf', '0.35 0.40 0.48 rg', '505 24 Td', `(Page ${index + 1} of ${pages.length}) Tj`, 'ET');
    const stream = commands.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[regularFontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[boldFontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

async function downloadAnalyticsReport(format) {
  const report = buildAnalyticsExportReport();
  const formatCode = format === 'excel' ? 'XLSX' : format.toUpperCase();
  const formatLabel = format === 'excel' ? 'Excel' : format.toUpperCase();
  try {
    await recordStaffDataActivity('DATA_EXPORTED', `Staff operations analytics (${report.rangeLabel}; ${report.reportId})`, formatCode, report.recordCount);
  } catch (error) {
    console.error('[Analytics Export] Audit logging failed:', error);
    showToast(`Export blocked: audit log failed${error?.message ? ` (${error.message})` : ''}.`, 'error');
    return;
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const rangeSlug = report.rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const base = `osca-staff-analytics-${rangeSlug}-${dateSlug}`;
  let blob;
  let extension;
  if (format === 'pdf') {
    blob = analyticsReportPdf(report);
    extension = 'pdf';
  } else if (format === 'excel') {
    blob = analyticsReportExcel(report);
    extension = 'xlsx';
  } else {
    blob = analyticsReportCsv(report);
    extension = 'csv';
  }
  saveStaffExport(blob, `${base}.${extension}`);
  appendAudit(CURRENT_USER?.displayName || 'Staff', `Exported staff analytics (${formatLabel})`, 'System');
  showToast(`${formatLabel} analytics report downloaded. ${report.recordCount} applications included.`, 'success');
}

async function recordStaffDataActivity(action, report, format, recordCount) {
  const endpoint = 'https://management-backend-3cij.onrender.com/api/audit-logs/' +
    (action === 'DATA_IMPORTED' ? 'imports' : 'exports');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ report, format, recordCount })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Unable to save this activity to the audit log.');
  }
  return result;
}

async function downloadStaffExport() {
  const format = document.getElementById('staff-export-format')?.value || 'csv';
  const type = document.getElementById('staff-export-type')?.value || 'barangay';
  const barangayFilter = document.getElementById('staff-export-barangay')?.value || '';
  const statusFilter = document.getElementById('staff-export-status')?.value || '';
  const membershipFilter = document.getElementById('staff-export-membership')?.value || '';
  const errorEl = document.getElementById('staff-export-error');
  const selectedFields = [...document.querySelectorAll('input[name="staff-export-field"]:checked')].map(input => input.value);

  const source = getStaffExportApplications();
  const filtered = source.filter(application => {
    const barangay = String(application.barangay_district || application.barangay || '').trim();
    const status = String(application.status || '').trim().toLowerCase();
    const membership = String(application.membership_status || '').trim().toLowerCase();
    if (barangayFilter && barangay !== barangayFilter) return false;
    if (statusFilter && status !== statusFilter.toLowerCase()) return false;
    if (membershipFilter === 'Unassigned' && membership) return false;
    if (membershipFilter && membershipFilter !== 'Unassigned' && membership !== membershipFilter.toLowerCase()) return false;
    return true;
  });

  if (!filtered.length) {
    if (errorEl) {
      errorEl.textContent = 'No applicant records match the selected filters.';
      errorEl.style.display = 'block';
    }
    return;
  }

  let header = [];
  let rows = [];
  if (type === 'barangay') {
    const chosen = selectedFields.filter(key => ['male', 'female', 'total'].includes(key));
    if (!chosen.length) {
      if (errorEl) {
        errorEl.textContent = 'Select at least one count field: Male, Female, or Overall Total.';
        errorEl.style.display = 'block';
      }
      return;
    }
    const summary = new Map();
    filtered.forEach(application => {
      const barangay = String(application.barangay_district || application.barangay || 'Unknown').trim() || 'Unknown';
      if (!summary.has(barangay)) summary.set(barangay, { male: 0, female: 0, total: 0 });
      const item = summary.get(barangay);
      const sex = String(application.sex || application.gender || '').trim().toLowerCase();
      if (sex === 'male' || sex === 'm') item.male++;
      else if (sex === 'female' || sex === 'f') item.female++;
      item.total++;
    });
    header = ['Barangay', ...chosen.map(key => key === 'total' ? 'Overall Total' : key.charAt(0).toUpperCase() + key.slice(1))];
    const ordered = [...summary.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    rows = ordered.map(([barangay, counts]) => [barangay, ...chosen.map(key => counts[key])]);
    const grand = ordered.reduce((acc, [, counts]) => ({
      male: acc.male + counts.male,
      female: acc.female + counts.female,
      total: acc.total + counts.total
    }), { male: 0, female: 0, total: 0 });
    rows.push(['TOTAL', ...chosen.map(key => grand[key])]);
  } else {
    const keys = selectedFields.filter(key => STAFF_EXPORT_FIELDS.records.some(field => field.key === key));
    if (!keys.length) {
      if (errorEl) {
        errorEl.textContent = 'Select at least one field to include in the export.';
        errorEl.style.display = 'block';
      }
      return;
    }
    header = keys.map(key => STAFF_EXPORT_FIELDS.records.find(field => field.key === key).label);
    rows = filtered.map(application => keys.map(key => staffExportValue(application, key)));
  }

  try {
    await recordStaffDataActivity(
      'DATA_EXPORTED',
      type === 'barangay' ? 'Staff barangay summary' : 'Staff applicant records',
      format.toUpperCase(),
      type === 'barangay' ? rows.length - 1 : filtered.length
    );
  } catch (auditError) {
    console.error('[Staff Export] Audit logging failed:', auditError);
    if (errorEl) {
      errorEl.textContent = 'Export was not started because the audit log could not be saved. Please try again.';
      errorEl.style.display = 'block';
    }
    showToast('Unable to record export activity. Please try again.', 'error');
    return;
  }

  const reportTitle = type === 'barangay' ? 'OSCA Barangay Summary' : 'OSCA Applicant Records';
  const reportSlug = type === 'barangay' ? 'barangay-summary' : 'applicant-records';
  const dateSlug = new Date().toISOString().slice(0, 10);
  if (format === 'pdf') {
    downloadReportFile(format, reportTitle, header, rows, `osca-${reportSlug}`);
  } else {
    const csv = '\uFEFF' + [header, ...rows].map(row => row.map(staffExportCsvCell).join(',')).join('\r\n');
    saveStaffExport(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `osca-${reportSlug}-${dateSlug}.csv`);
  }
  appendAudit(CURRENT_USER?.displayName || 'Staff', `Exported ${type === 'barangay' ? 'barangay summary' : 'applicant records'} (${format.toUpperCase()})`, 'System');
  closeStaffExport();
  showToast(`${format.toUpperCase()} exported: ${filtered.length} application records included in the selected report.`, 'success');
}

function exportCSV() {
  openStaffExport();
}

function exportData(format) {
  if (!['csv', 'pdf', 'excel'].includes(format)) return;
  downloadAnalyticsReport(format);
}
function scheduleWeeklyReport() { showToast('Weekly report scheduled (every Monday 8:00 AM) — demo', 'success'); }

/* ── Small Form Issuance functions ── */
function fallbackMedia(text) {
  const initials = ((text || '--').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()) || '--';
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='90'><rect width='100%' height='100%' fill='rgb(243,244,246)'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' fill='rgb(17,24,39)' font-family='Arial' font-size='32' font-weight='700'>" + initials + "</text></svg>";
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function formatDateForForm(value) {
  if (!value) return '________________';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}
function getCurrentApplicant() {
  const sel = document.getElementById('id-applicant');
  if (!sel || !sel.value) return null;
  return APP_DB[sel.value] || null;
}
function updateIssuanceKPIs() {
  const strip = document.getElementById('issuance-kpi-strip');
  if (!strip) return;
  const cards = strip.querySelectorAll('.stat-card');
  if (!cards || cards.length < 4) return;

  const localQueue = getLocalIdMakerQueue();
  const today = new Date().toISOString().split('T')[0];

  // Card 0: Ready to Process -- In Process & not yet sent to ID Maker
  const readyToProcess = Object.values(APP_DB).filter(a =>
    a.status === 'In Process' && !a.sentToIdMaker
  ).length;

  // Card 1: Queued for Print
  const queueSet = new Set();
  ID_MAKER_QUEUE.forEach(q => {
    if (q.printStatus === 'Queued') queueSet.add(String(q.id || q.application_id));
  });
  localQueue.forEach(q => {
    if (q.printStatus === 'Queued') queueSet.add(String(q.id || q.application_id));
  });
  const queuedCount = queueSet.size;

  // Card 2: IDs Issued Today -- queue entries with dateIssued or sentAt matching today
  const issuedTodaySet = new Set();
  const allQueue = [...ID_MAKER_QUEUE, ...localQueue];
  allQueue.forEach(q => {
    const d = q.dateIssued || q.sentAt || '';
    if (d.startsWith(today)) issuedTodaySet.add(String(q.id || q.application_id));
  });
  const issuedToday = issuedTodaySet.size;

  // Card 3: Not Yet Picked Up -- Ready for Release (printed, awaiting claim)
  const notPickedUp = Object.values(APP_DB).filter(a =>
    a.status === 'Ready for Release'
  ).length;

  // Update card values
  const v0 = cards[0].querySelector('.stat-card__value');
  if (v0) v0.textContent = readyToProcess;

  const v1 = cards[1].querySelector('.stat-card__value');
  if (v1) v1.textContent = queuedCount;

  const v2 = cards[2].querySelector('.stat-card__value');
  if (v2) v2.textContent = issuedToday;

  const v3 = cards[3].querySelector('.stat-card__value');
  if (v3) v3.textContent = notPickedUp;
}

function updatePreview() {
  const select = document.getElementById('id-applicant');
  const appId = select?.value || '';
  const app = appId ? APP_DB[appId] : null;

  const nameEl = document.getElementById('id-fullname');
  const addrEl = document.getElementById('id-address');
  const dobEl = document.getElementById('id-dob');
  const sexEl = document.getElementById('id-sex');
  const dateIssuedEl = document.getElementById('id-date-issued');
  const controlNoEl = document.getElementById('id-control-no');

  // Clear fields when no applicant is selected
  if (!app) {
    if (nameEl) nameEl.value = '';
    if (addrEl) addrEl.value = '';
    if (dobEl) dobEl.value = '';
    if (sexEl) sexEl.value = '';
    if (dateIssuedEl) dateIssuedEl.value = '';
    if (controlNoEl) controlNoEl.value = '';

    updateIssuancePreview(null);
    return;
  }

  // Fill applicant information
  if (nameEl) {
    nameEl.value = app.name || '';
  }

  if (addrEl) {
    addrEl.value = app.address || '';
  }

  if (dobEl) {
    dobEl.value = app.dob || '';
  }

  if (sexEl) {
    const gender = String(app.gender || '').trim().toUpperCase();

    if (gender === 'M') {
      sexEl.value = 'Male';
    } else if (gender === 'F') {
      sexEl.value = 'Female';
    } else {
      sexEl.value = app.gender || '';
    }
  }

  // Auto-fill default date issued to today if empty
  if (dateIssuedEl && !dateIssuedEl.value) {
    dateIssuedEl.value = new Date().toISOString().split('T')[0];
  }

  // Auto-fill default control number if empty (e.g. CTRL-26-0143)
  if (controlNoEl && !controlNoEl.value) {
    controlNoEl.value = buildControlNo(app.id);
  }

  // Update the preview on the right
  updateIssuancePreview(app);
}

function updateIssuancePreview(app) {
  const pName = document.getElementById('preview-name');
  const pAddr = document.getElementById('preview-address');
  const pDob = document.getElementById('preview-dob');
  const pSex = document.getElementById('preview-sex');
  const pDateIssued = document.getElementById('preview-date-issued');
  const pControlNo = document.getElementById('preview-control-no');

  const pPhoto = document.getElementById('preview-photo');
  const pPhotoFallback = document.getElementById('preview-photo-fallback');

  const pSignature = document.getElementById('preview-signature');
  const pSignatureFallback = document.getElementById('preview-sign-fallback');

  if (!app) {
    if (pName) pName.textContent = '________________';
    if (pAddr) pAddr.textContent = '________________';
    if (pDob) pDob.textContent = '________________';
    if (pSex) pSex.textContent = '________________';

    if (pPhoto) {
      pPhoto.src = '';
      pPhoto.style.display = 'none';
    }

    if (pPhotoFallback) {
      pPhotoFallback.style.display = 'block';
      pPhotoFallback.textContent = '--';
    }

    if (pSignature) {
      pSignature.src = '';
      pSignature.style.display = 'none';
    }

    if (pSignatureFallback) {
      pSignatureFallback.style.display = 'block';
    }

    return;
  }

  // Text preview
  if (pName) {
    pName.textContent = app.name || '________________';
  }

  if (pAddr) {
    pAddr.textContent = app.address || '________________';
  }

  if (pDob) {
    pDob.textContent = app.dob
      ? formatDateForForm(app.dob)
      : '________________';
  }

  if (pSex) {
    const gender = String(app.gender || '').trim().toUpperCase();

    pSex.textContent =
      gender === 'M'
        ? 'Male'
        : gender === 'F'
          ? 'Female'
          : app.gender || '________________';
  }

  // Date issued and control number
  const dateIssued =
    document.getElementById('id-date-issued')?.value || '';

  const controlNo =
    document.getElementById('id-control-no')?.value || '';

  if (pDateIssued) {
    pDateIssued.textContent =
      dateIssued
        ? formatDateForForm(dateIssued)
        : '________________';
  }

  if (pControlNo) {
    pControlNo.textContent =
      controlNo || '________________';
  }

  // Photo
  const photoSrc = app.photo || '';

  if (pPhoto && pPhotoFallback) {
    if (photoSrc) {
      pPhoto.src = photoSrc;
      pPhoto.style.display = 'block';
      pPhotoFallback.style.display = 'none';
      pPhoto.onerror = function () {
        pPhoto.style.display = 'none';
        pPhotoFallback.style.display = 'block';
        pPhotoFallback.textContent = 'Photo unavailable';
      };
    } else {
      pPhoto.src = '';
      pPhoto.style.display = 'none';
      pPhotoFallback.style.display = 'block';
      pPhotoFallback.textContent =
        (app.name || '--').slice(0, 2).toUpperCase();
    }
  }

  // Signature
  const signatureSrc = app.signature || '';

  if (pSignature && pSignatureFallback) {
    if (signatureSrc) {
      pSignature.src = signatureSrc;
      pSignature.style.display = 'block';
      pSignatureFallback.style.display = 'none';
      pSignature.onerror = function () {
        pSignature.style.display = 'none';
        pSignatureFallback.style.display = 'block';
      };
    } else {
      pSignature.src = '';
      pSignature.style.display = 'none';
      pSignatureFallback.style.display = 'block';
    }
  }
}

async function refreshIdMakerQueueApplicationIds() {
  if (ID_MAKER_QUEUE_APPLICATION_IDS_PROMISE) {
    return ID_MAKER_QUEUE_APPLICATION_IDS_PROMISE;
  }

  ID_MAKER_QUEUE_APPLICATION_IDS_PROMISE = (async () => {
    const response = await fetch(
      'https://management-backend-3cij.onrender.com/api/id-maker-queue/application-ids',
      { headers: getAuthHeaders(), cache: 'no-store' }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success || !Array.isArray(result.application_ids)) {
      throw new Error(result.message || 'Could not verify previous ID Maker submissions.');
    }

    ID_MAKER_QUEUE_APPLICATION_IDS = new Set(
      result.application_ids
        .map(id => String(id || '').trim())
        .filter(Boolean)
    );
    return ID_MAKER_QUEUE_APPLICATION_IDS;
  })().finally(() => {
    ID_MAKER_QUEUE_APPLICATION_IDS_PROMISE = null;
  });

  return ID_MAKER_QUEUE_APPLICATION_IDS_PROMISE;
}

async function initSmallFormIssuance() {
  const select = document.getElementById('id-applicant');
  if (!select) return;

  // Prevent duplicate event listeners
  select.onchange = null;

  select.innerHTML = '<option value="">Checking ID Maker queue...</option>';
  let serverSentApplicationIds;
  try {
    serverSentApplicationIds = await refreshIdMakerQueueApplicationIds();
  } catch (error) {
    console.error('Could not verify ID Maker queue before loading issuance applicants:', error);
    select.innerHTML = '<option value="">Unable to verify ID Maker queue. Reopen this section to retry.</option>';
    return;
  }

  // Include applicants already In Process, plus Under Review applicants
  // whose eligibility validation passed and all six required documents
  // have been approved in the database.
  select.innerHTML = '<option value="">Select applicant</option>';

  const localQueue = getLocalIdMakerQueue();
  // Include replacement applicants whose linked request is in production,
  // even when their original application is already completed.
  const inProcessReplacementIds = new Set();
  const linkedReplacementRequests = Array.isArray(window.LIVE_REPLACEMENT_REQUESTS)
    ? window.LIVE_REPLACEMENT_REQUESTS
    : [];
  linkedReplacementRequests.forEach(request => {
    const replacementApp = request.application || null;
    const id = String(request.application_id || replacementApp?.application_id || '');
    if (!id || String(request.request_status || '').trim().toLowerCase() !== 'in process') return;
    inProcessReplacementIds.add(id);
    if (!APP_DB[id] && replacementApp) syncApplicationsToAppDB([replacementApp]);
  });

  const requiredDocumentTypes = [
    'valid_id',
    'valid_id_back',
    'latest_photo',
    'birth_certificate',
    'community_tax_certificate',
    'signature'
  ];

  Object.keys(APP_DB).forEach((id) => {
    const app = APP_DB[id];
    if (!app) return;
    const isInProcessReplacement = inProcessReplacementIds.has(String(id));

    // Never offer an applicant already submitted to ID Maker, including
    // replacements whose earlier queue item has since been completed.
    if (app.sentToIdMaker || serverSentApplicationIds.has(String(id))) return;
    const inMem = ID_MAKER_QUEUE.some(q => String(q.id || q.application_id) === String(id));
    if (inMem) return;
    const inLocal = localQueue.some(q => String(q.id || q.application_id) === String(id));
    if (inLocal) return;

    const status = String(app.status || '').trim().toLowerCase();
    const isInProcess = status === 'in process';

    const validationStatus = String(app.validation_status || '').trim().toLowerCase();
    const validationPassed = validationStatus === 'passed';

    const authentications = Array.isArray(app.documentAuthentications)
      ? app.documentAuthentications
      : [];

    const allDocumentsApproved = requiredDocumentTypes.every(documentType =>
      authentications.some(record =>
        String(record.document_type || '').trim().toLowerCase() === documentType &&
        String(record.authentication_status || '').trim().toLowerCase() === 'approved'
      )
    );

    const isQualifiedUnderReview =
      status === 'under review' &&
      validationPassed &&
      allDocumentsApproved;

    if (!isInProcess && !isQualifiedUnderReview && !isInProcessReplacement) return;

    const opt = document.createElement('option');
    opt.value = id;
    const queueLabel = isInProcessReplacement
      ? ' — Replacement'
      : isQualifiedUnderReview
        ? ' — Ready for ID Issuance'
        : '';
    opt.textContent = `${app.name || 'Unnamed Applicant'} (${id})${queueLabel}`;

    select.appendChild(opt);
  });

  // Autofill the form whenever the selected applicant changes
  select.onchange = async function () {
    const app = getCurrentApplicant();
    if (!app) {
      updatePreview();
      return;
    }

    // The application list may contain legacy bucket-relative paths.
    // Never assign those directly to <img src>; they are not browser URLs.
    // Clear them until the authenticated API returns short-lived signed URLs.
    app.photo = '';
    app.signature = '';
    app.documents = {
      ...(app.documents || {}),
      photo: '',
      signature: ''
    };
    updatePreview();

    try {
      const response = await fetch(
        `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(app.id)}`,
        { headers: getAuthHeaders(), cache: 'no-store' }
      );
      if (!response.ok) return;
      const result = await response.json();
      const files = result.applicationFiles || {};
      app.photo = files.latest_photo_signed_url || '';
      app.signature = files.signature_signed_url || '';
      app.documents = { ...(app.documents || {}), photo: app.photo, signature: app.signature };
      if (select.value === String(app.id)) updatePreview();
    } catch (error) {
      console.warn('Unable to load applicant photo/signature:', error);
    }
  };

  // Update immediately
  updatePreview();

  // Update issuance KPIs
  updateIssuanceKPIs();
}

/* ID Card Preview & Print */
let currentCardSide = 'front';

function openIdCardModal(appId) {
  const app = APP_DB[appId] || FULL_APPLICANTS.find(a => a.id === appId);
  if (!app) { showToast('Applicant not found.', 'error'); return; }

  const dateIssued = document.getElementById('id-date-issued')?.value || '';
  const controlNo = document.getElementById('id-control-no')?.value || '';
  const fullName = app.name || '';
  const address = app.address || '';
  const dob = app.dob ? formatDateForForm(app.dob) : '';
  const sex = app.gender === 'M' ? 'Male' : app.gender === 'F' ? 'Female' : '';
  const scbId = app.id || '';

  // Calculate validity: 5 years from date issued or today
  let validity = '';
  if (dateIssued) {
    const d = new Date(dateIssued);
    d.setFullYear(d.getFullYear() + 5);
    validity = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  } else {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    validity = d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Fill front side
  document.getElementById('idcard-name').textContent = fullName || '________________';
  document.getElementById('idcard-address').textContent = address || '________________';
  document.getElementById('idcard-dob').textContent = dob || '________________';
  document.getElementById('idcard-sex').textContent = sex || '________________';
  document.getElementById('idcard-scb-id').textContent = scbId;
  document.getElementById('idcard-validity').textContent = validity;
  document.getElementById('idcard-control-no').textContent = controlNo || '________________';

  // Photo
  const photoSrc = app.photo || fallbackMedia(fullName);
  const photoImg = document.getElementById('idcard-photo');
  const photoFb = document.getElementById('idcard-photo-fb');
  photoImg.src = photoSrc;
  photoImg.style.display = photoSrc ? 'block' : 'none';
  photoFb.style.display = photoSrc ? 'none' : 'block';
  photoFb.textContent = (fullName || '--').slice(0, 2).toUpperCase();

  // Back side barcode text
  document.getElementById('idcard-barcode-text').textContent = scbId;
  switchCardSide('front');
  document.getElementById('idcard-modal').classList.add('show');
}

function closeIdCardModal() {
  document.getElementById('idcard-modal').classList.remove('show');
}

function switchCardSide(side) {
  currentCardSide = side;
  document.getElementById('idcard-front-wrapper').style.display = side === 'front' ? 'flex' : 'none';
  document.getElementById('idcard-back-wrapper').style.display = side === 'back' ? 'flex' : 'none';
  document.getElementById('btn-card-front').classList.toggle('active', side === 'front');
  document.getElementById('btn-card-back').classList.toggle('active', side === 'back');
}

function printIdCard() {
  window.print();
}

function downloadIdCard() {
  showToast('PNG download requires html2canvas library. Use Print for now.', 'info');
}

function generateID() {
  var app = getCurrentApplicant();
  var dateIssued = document.getElementById('id-date-issued')?.value || '';
  var controlNo = document.getElementById('id-control-no')?.value || '';
  if (!app) { showToast('Please select an applicant first.', 'error'); return; }
  if (!dateIssued || !controlNo) { showToast('Date issued and control number are required.', 'error'); return; }
  updatePreview();
}

async function sendFromIssuanceToIdMaker() {
  var app = getCurrentApplicant();
  if (!app) {
    showToast('Please select an applicant first.', 'error');
    return;
  }

  var appId = app.id;
  const linkedReplacementRequest = (Array.isArray(window.LIVE_REPLACEMENT_REQUESTS)
    ? window.LIVE_REPLACEMENT_REQUESTS
    : []).find(request =>
      String(request.application_id || request.application?.application_id || '') === String(appId)
    );
  const requestType = linkedReplacementRequest || /replace/i.test(String(
    app.requestType || app.applicationType || app.application_type || app.request_type || ''
  )) ? 'Replacement' : 'New';
  app.requestType = requestType;
  var dateIssued = document.getElementById('id-date-issued')?.value || '';
  var controlNo = document.getElementById('id-control-no')?.value?.trim() || '';

  if (!dateIssued) {
    dateIssued = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('id-date-issued');
    if (dateInput) dateInput.value = dateIssued;
  }

    if (!controlNo) {
    controlNo = buildControlNo(appId);
    const ctrlInput = document.getElementById('id-control-no');
    if (ctrlInput) ctrlInput.value = controlNo;
  }

  // Visual button feedback
  const sendBtn = document.getElementById('btn-send-idmaker-issuance') ||
    document.querySelector('.content-card button[onclick="sendFromIssuanceToIdMaker()"]');
  const originalHtml = sendBtn?.innerHTML || '';
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.classList.add('is-sending');
    sendBtn.setAttribute('aria-busy', 'true');
    sendBtn.innerHTML = '<span class="btn__spinner" aria-hidden="true"></span><span>Sending to ID Maker...</span>';
  }
  const apiBase = 'https://management-backend-3cij.onrender.com/api';
  const fetchWithTimeout = (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeoutId));
  };
  try {
    // Pull this applicant's current photo and signature URLs from the database.
    const detailResponse = await fetchWithTimeout(`${apiBase}/applications/${encodeURIComponent(appId)}`, {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (!detailResponse.ok) {
      throw new Error(`Unable to load this applicant's database images (${detailResponse.status}).`);
    }
    const detail = await detailResponse.json();
    if (!detail.success) {
      throw new Error(detail.message || 'Unable to load this applicant from the database.');
    }
    const files = detail.applicationFiles || {};
    app.photo = files.latest_photo_signed_url || '';
    app.signature = files.signature_signed_url || '';

    const queueResponse = await fetchWithTimeout(`${apiBase}/id-maker-queue`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        application_id: appId,
        request_type: requestType,
        control_no: controlNo,
        date_issued: dateIssued,
        print_status: 'Queued'
      })
    });
    const queueResult = await queueResponse.json().catch(() => ({}));
    if (!queueResponse.ok || queueResult.success === false) {
      throw new Error(queueResult.message || `ID Maker rejected the request (${queueResponse.status}).`);
    }
    ID_MAKER_QUEUE_APPLICATION_IDS.add(String(appId));

    const statusResponse = await fetchWithTimeout(`${apiBase}/applications/${encodeURIComponent(appId)}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        status: 'In Process'
      })
    });
    const statusResult = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok || statusResult.success === false) {
      throw new Error(statusResult.message || `The queue accepted the form, but the application status update failed (${statusResponse.status}).`);
    }
    // Also update the linked ID request in the database.
    const requestsResponse = await fetchWithTimeout(
      `${apiBase}/replacements`,
      { cache: 'no-store' }
    );

    const requestsResult = await requestsResponse.json();

    if (!requestsResponse.ok || !requestsResult.success) {
      throw new Error(
        requestsResult.message ||
        'Unable to refresh ID requests.'
      );
    }

    const linkedRequest = (requestsResult.requests || []).find(
      request =>
        String(request.application_id) === String(appId)
    );

    if (linkedRequest) {
      const requestStatusResponse = await fetchWithTimeout(
        `${apiBase}/replacements/${linkedRequest.id}/decision`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: 'In Process'
          })
        }
      );

      const requestStatusResult =
        await requestStatusResponse.json();

      if (
        !requestStatusResponse.ok ||
        !requestStatusResult.success
      ) {
        throw new Error(
          requestStatusResult.message ||
          'Failed to update the ID request status.'
        );
      }
    }

    // Reflect and persist locally only after the server confirms both writes.
    const queueEntry = {
      id: appId, application_id: appId, name: app.name,
      firstName: app.firstName || '', middleName: app.middleName || '', surname: app.surname || app.name || '',
      address: app.address || '—', barangay: app.barangay || '—', dob: app.dob || '', gender: app.gender || '',
      photo: app.photo || '', signature: app.signature || '', controlNo, dateIssued,
      requestType,
      printStatus: 'Queued', regDate: app.regDate || new Date().toISOString(), sentAt: new Date().toISOString()
    };
    const existingIdx = ID_MAKER_QUEUE.findIndex(q => String(q.id || q.application_id) === String(appId));
    if (existingIdx >= 0) ID_MAKER_QUEUE[existingIdx] = queueEntry;
    else ID_MAKER_QUEUE.unshift(queueEntry);
    saveLocalIdMakerQueue(queueEntry);

    if (APP_DB[appId]) {
      APP_DB[appId].status = 'In Process';
      APP_DB[appId].sentToIdMaker = true;
      syncApplicationsTableBadge(appId, 'In Process');
    }
    if (typeof LIVE_APPLICATIONS !== 'undefined' && Array.isArray(LIVE_APPLICATIONS)) {
      const liveApp = LIVE_APPLICATIONS.find(item => String(item.application_id || item.id) === String(appId));
      if (liveApp) {
        liveApp.status = 'In Process';
        liveApp.sentToIdMaker = true;
        liveApp.status_updated_at = new Date().toISOString();
      }
    }
    const fullApp = FULL_APPLICANTS.find(item => String(item.id) === String(appId));
    if (fullApp) { fullApp.status = 'In Process'; fullApp.sentToIdMaker = true; }

    const select = document.getElementById('id-applicant');
    if (select) {
      Array.from(select.options).find(option => option.value === String(appId))?.remove();
      select.value = '';
    }
    clearIDForm(true);
    updateIssuanceKPIs();
    appendAudit(CURRENT_USER?.displayName || 'Staff', `Sent ${app.name} (${appId}) to ID Maker via ID Issuance`, CURRENT_ROLE);
    addNotifyLog(appId, 'Sent to ID Maker', 'System', 'Delivered');
    showToast(`${app.name} was sent to the ID Maker queue successfully.`, 'success');
    if (typeof loadReplacementRequests === 'function') {
      await loadReplacementRequests();
    }
    if (typeof initIdMakerQueue === 'function') {
      Promise.resolve(initIdMakerQueue()).catch(error => console.warn('Unable to refresh ID Maker queue:', error));
    }
    if (typeof updateIdMakerKPIs === 'function') updateIdMakerKPIs();
  } catch (err) {
    console.error('Unable to send issuance form to ID Maker:', err);
    showToast(`Could not confirm sending to ID Maker. ${err.message || 'Check your connection and try again.'}`, 'error');
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove('is-sending');
      sendBtn.removeAttribute('aria-busy');
      sendBtn.innerHTML = originalHtml;
    }
  }
}

function clearIDForm(silent = false) {
  ['id-applicant', 'id-fullname', 'id-address', 'id-dob', 'id-sex', 'id-date-issued', 'id-control-no'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = '';
    else el.value = '';
  });
  const pName = document.getElementById('preview-name');
  if (pName) pName.textContent = '________________';
  const pAddr = document.getElementById('preview-address');
  if (pAddr) pAddr.textContent = '________________';
  const pDob = document.getElementById('preview-dob');
  if (pDob) pDob.textContent = '________________';
  const pSex = document.getElementById('preview-sex');
  if (pSex) pSex.textContent = '________________';
  const pDate = document.getElementById('preview-date-issued');
  if (pDate) pDate.textContent = '________________';
  const pCtrl = document.getElementById('preview-control-no');
  if (pCtrl) pCtrl.textContent = '________________';
  const pPhoto = document.getElementById('preview-photo');
  if (pPhoto) {
    pPhoto.src = '';
    pPhoto.style.display = 'none';
  }
  const pPhotoFb = document.getElementById('preview-photo-fallback');
  if (pPhotoFb) {
    pPhotoFb.style.display = 'block';
    pPhotoFb.textContent = '--';
  }
  const pSign = document.getElementById('preview-signature');
  if (pSign) {
    pSign.src = '';
    pSign.style.display = 'none';
  }
  const pSignFb = document.getElementById('preview-sign-fallback');
  if (pSignFb) {
    pSignFb.style.display = 'block';
  }

  if (!silent) {
    showToast('Small form cleared.', 'info');
  }
}
/* ── Logout with confirmation ── */
function requestLogout() {
  const modal = document.getElementById('logout-confirm-modal');
  const userEl = document.getElementById('confirm-logout-user');
  const roleEl = document.getElementById('confirm-logout-role');
  if (userEl) userEl.textContent = CURRENT_USER?.displayName || document.getElementById('current-user-name')?.textContent || 'Current user';
  if (roleEl) roleEl.textContent = `${CURRENT_ROLE} account`;
  if (modal) modal.classList.add('show');
}

function closeLogoutConfirm() {
  document.getElementById('logout-confirm-modal')?.classList.remove('show');
}

function confirmLogout() {
  closeLogoutConfirm();
  logout();
}

let logoutInProgress = false;

async function logout(reason = 'manual') {
  if (logoutInProgress) return;
  logoutInProgress = true;

  // Record logout while the authenticated token is still available.
  let logoutRecorded = false;
  try {
    const response = await fetch(
      'https://management-backend-3cij.onrender.com/api/auth/logout',
      {
        method: 'POST',
        headers: getAuthHeaders(),
        cache: 'no-store'
      }
    );
    logoutRecorded = response.ok;
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.error('Logout audit event was not saved:', result.message || response.status);
    }
  } catch (error) {
    console.error('Unable to send logout audit event:', error);
  }

  clearAuthSession();
  CURRENT_USER = null;
  CURRENT_ROLE = 'Staff';
  closeModal();
  closeLogoutConfirm();

  if (!logoutRecorded) {
    console.warn('Session closed, but the server did not confirm the logout audit event.');
  }

  if (PAGE === 'login') {
    showLoginPage();
    showToast('Signed out successfully.', 'info');
  } else {
    location.href = reason === 'inactivity'
      ? 'login.html?loggedout=1&reason=inactivity'
      : 'login.html?loggedout=1';
  }
}

/* ── Mobile sidebar drawer toggle (shared by all portals) ── */
function toggleSidebarDrawer() {
  document.body.classList.toggle('sidebar-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) backdrop.classList.toggle('show', document.body.classList.contains('sidebar-open'));
}
function closeSidebarDrawer() {
  document.body.classList.remove('sidebar-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('show');
}

/* ── Toast (kept from your design language) ── */
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const icons = {
    success: '<svg viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z" clip-rule="evenodd"/></svg>',
    error: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>',
    info: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>'
  };
  const titles = { success: 'Success', error: 'Error', info: 'Info' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `${icons[type]}<div class="toast-body"><div class="toast-title">${titles[type]}</div><div class="toast-desc">${msg}</div></div><button class="toast-close" onclick="removeToast(this.closest('.toast'))"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg></button>`;
  c.appendChild(t);
  setTimeout(() => removeToast(t), 4000);
}
function removeToast(t) { if (!t) return; t.classList.add('removing'); setTimeout(() => t.remove(), 280); }

/* Password visibility toggle */
function togglePwVis(btn) {
  const input = btn.closest('.auth-input-wrap').querySelector('.auth-input');
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fi fi-rr-eye-crossed';
  } else {
    input.type = 'password';
    icon.className = 'fi fi-rr-eye';
  }
}

/* SESSION TIMEOUT — 5 minutes of inactivity across Admin, Staff, and ID Maker */
let inactivityTimer = null;
const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  if (!CURRENT_USER || PAGE === 'login') return;
  inactivityTimer = setTimeout(() => {
    // logout() records the logout event before clearing the authenticated session.
    logout('inactivity');
  }, INACTIVITY_MS);
}
['mousemove', 'pointerdown', 'keydown', 'click', 'scroll', 'wheel', 'touchstart', 'input', 'change'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

/* =========================================================
   APPLICATIONS MODULE — ACTIVE APPLICATIONS ONLY
   Excludes Completed and Rejected.
========================================================= */

function isActiveApplication(app) {
  const status = String(app.status || 'Pending')
    .trim()
    .toLowerCase();

  return (
    status !== 'completed' &&
    status !== 'rejected'
  );
}

/* ── Applications table dynamic renderer (frontend demo data) ── */
const APPL_AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#FDE68A,#D97706)',
  'linear-gradient(135deg,#34D399,#059669)',
  'linear-gradient(135deg,#93C5FD,#2563EB)',
  'linear-gradient(135deg,#F9A8D4,#DB2777)',
  'linear-gradient(135deg,#C4B5FD,#7C3AED)',
  'linear-gradient(135deg,#FCA5A5,#DC2626)',
  'linear-gradient(135deg,#6EE7B7,#10B981)',
  'linear-gradient(135deg,#86EFAC,#16A34A)'
];

function appInitials(name) {
  return (name || '--').trim().replace(/\s+/g, ' ').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '--';
}

function appRegDate(id) {
  const a = APP_DB[id] || FULL_APPLICANTS.find(x => x.id === id);
  if (a && a.regDate) {
    const d = new Date(a.regDate + 'T00:00:00');
    if (!isNaN(d)) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return '—';
}

/* ── Application Type pill (New / Replacement) ── */
function buildApplicationTypePill(app) {
  let type = app.applicationType || app.application_type || app.request_type || app.type;
  if (!type || !String(type).trim()) {
    if (typeof getApplicationRequestType === 'function') {
      type = getApplicationRequestType(app);
    } else {
      const idStr = String(app.application_id || app.id || '');
      let hash = 0;
      for (let i = 0; i < idStr.length; i++) {
        hash = (hash * 31 + idStr.charCodeAt(i)) >>> 0;
      }
      type = (hash % 4 === 0) ? 'Replacement' : 'New';
    }
  } else if (/replace/i.test(type)) {
    type = 'Replacement';
  } else {
    type = 'New';
  }
  app.applicationType = type;
  const isReplacement = type === 'Replacement';
  const cls = isReplacement ? 'app-type-pill app-type-pill--replacement' : 'app-type-pill app-type-pill--first';
  const icon = isReplacement ? '↻' : '★';
  const tip = isReplacement ? 'Replacement — ₱50 fee required upon claiming' : 'New Application — no fee required';
  return '<span class="' + cls + '" title="' + tip + '">' + icon + ' ' + type + '</span>';
}

/* ── Documents status pill ── */
const DOC_FIELDS = ['idFront', 'idBack', 'photo', 'bc', 'cedula', 'signature'];
function getDocsStatus(app) {
  const docs = app.documents || {};
  const uploaded = DOC_FIELDS.filter(f => docs[f] && String(docs[f]).trim() !== '');
  const missing = DOC_FIELDS.filter(f => !docs[f] || String(docs[f]).trim() === '');
  return { total: DOC_FIELDS.length, uploaded: uploaded.length, missing: missing };
}
function buildDocsStatusPill(app) {
  const s = getDocsStatus(app);
  const allDone = s.uploaded === s.total;
  if (allDone) {
    return '<span class="docs-pill docs-pill--complete" title="All documents uploaded">✓ ' + s.uploaded + '/' + s.total + ' Uploaded</span>';
  }
  const missingLabel = s.missing.map(f => DOC_LABELS[f] || f).join(', ');
  return '<span class="docs-pill docs-pill--incomplete" title="Missing: ' + missingLabel + '">⚠ ' + s.uploaded + '/' + s.total + ' Uploaded</span>';
}

function buildViewAction(appId) {
  return '<button type="button" class="row-action always-visible row-action--icon" data-tooltip="View applicant" aria-label="View applicant" onclick="event.stopPropagation();openApplicationDetail(\'' + appId + '\')">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.75"/></svg>' +
    '</button>';
}

function mapStatusForDropdown(status) {
  const s = String(status || '').trim();
  // Return exact match if it's a known status
  const known = [
    'Pending',
    'Under Review',
    'In Process',
    'Ready for Release',
    'Completed',
    'Rejected'
  ];
  if (known.includes(s)) return s;
  // Fallback mapping for legacy/variant strings

  const sl = s.toLowerCase();
  if (/reject/.test(sl)) return 'Rejected';
  if (/complete|finish|done|issue/.test(sl)) return 'Completed';
  if (/ready|release/.test(sl)) return 'Ready for Release';
  if (/under|review/.test(sl)) return 'Under Review';
  if (/process/.test(sl)) return 'In Process';
  if (/pending|unverif/.test(sl)) return 'Pending';
  return 'Pending';
}

function statusOptionCfg(status) {
  const map = {
    'Pending': ['clock', '#C07A0A'],
    'Under Review': ['document', '#1A4FBA'],
    'In Process': ['checkmark', '#0B9E6C'],
    'Ready for Release': ['truck', '#7C3AED'],
    'Completed': ['check', '#0B9E6C'],
    'Rejected': ['x', '#D9233A']
  };
  return map[status] || ['clock', '#C07A0A'];
}

function buildStatusSelect(appId, status) {
  const current = mapStatusForDropdown(status);
  const optionOrder = ['Pending', 'Under Review', 'In Process', 'Ready for Release', 'Completed', 'Rejected'];
  const opts = optionOrder.map(o => {
    const cfg = statusOptionCfg(o);
    const active = o === current ? ' active' : '';
    return '<button type="button" class="status-select__option' + active + '" data-status="' + o + '" data-icon="' + cfg[0] + '" data-color="' + cfg[1] + '" onclick="selectStatusOption(this,event)">' +
      '<span class="status-select__option-icon" style="color:' + cfg[1] + '"><svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' + getStatusIconSvg(cfg[0]) + '</svg></span>' +
      '<span>' + o + '</span></button>';
  }).join('');
  const cur = statusOptionCfg(current);
  return '<div class="status-select" data-app-id="' + appId + '">' +
    '<button type="button" class="status-select__trigger" onclick="toggleStatusSelect(this,event)">' +
    '<span class="status-select__icon" style="color:' + cur[1] + '"><svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' + getStatusIconSvg(cur[0]) + '</svg></span>' +
    '<span class="status-select__label">' + current + '</span>' +
    '<svg class="status-select__arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4l3 3 3-3"/></svg>' +
    '</button>' +
    '<div class="status-select__menu">' + opts + '</div>' +
    '</div>';
}

/* Update status tab counts based on visible table rows */
function updateStatusTabCounts() {
  const tbody = document.getElementById('applications-tbody');
  if (!tbody) return;
  const counts = { all: 0, pending: 0, review: 0, process: 0, release: 0, completed: 0, rejected: 0 };
  const labelToKey = {
    'Pending': 'pending',
    'Under Review': 'review',
    'In Process': 'process',
    'Ready for Release': 'release',
    'Completed': 'completed',
    'Rejected': 'rejected'
  };
  tbody.querySelectorAll('tr').forEach(function (row) {
    counts.all++;
    const label = row.querySelector('.status-select__label');
    if (label) {
      const key = labelToKey[label.textContent.trim()];
      if (key) counts[key]++;
    }
  });
  // Update badge counts in the status tabs
  document.querySelectorAll('#mod-applications .chip-count').forEach(function (el) {
    const key = el.dataset.countKey;
    if (key && counts[key] !== undefined) el.textContent = counts[key];
  });
  // Update the 'All' tab data-count attribute
  const allTab = document.querySelector('#mod-applications .status-tab[data-key="all"]');
  if (allTab) allTab.dataset.count = counts.all;
}

/* Add Applicant */
function openAddApplicantModal() {
  const modal = document.getElementById('add-applicant-modal');
  if (!modal) return;
  ['add-app-name', 'add-app-barangay', 'add-app-dob', 'add-app-sex', 'add-app-civil', 'add-app-occupation', 'add-app-contact'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const name = document.getElementById('add-app-name');
  if (name) { name.style.borderColor = ''; name.focus(); }
  modal.style.display = 'flex';
}

function closeAddApplicantModal() {
  const modal = document.getElementById('add-applicant-modal');
  if (modal) modal.style.display = 'none';
}

function saveApplicant() {
  const name = (document.getElementById('add-app-name')?.value || '').trim();
  const barangay = (document.getElementById('add-app-barangay')?.value || '').trim();
  const dob = (document.getElementById('add-app-dob')?.value || '').trim();
  const sex = (document.getElementById('add-app-sex')?.value || '').trim();
  const civil = (document.getElementById('add-app-civil')?.value || '').trim();
  const occupation = (document.getElementById('add-app-occupation')?.value || '').trim();
  const contact = (document.getElementById('add-app-contact')?.value || '').trim();

  const nameEl = document.getElementById('add-app-name');
  if (!name) {
    if (nameEl) nameEl.style.borderColor = '#D9233A';
    showToast('Full name is required', 'error');
    return;
  }

  const id = 'SCB-' + Date.now().toString(36).toUpperCase();
  const app = {
    id,
    name,
    surname: name.split(/\s+/).slice(-1)[0] || name,
    firstName: name.split(/\s+/).slice(0, -1).join(' ') || name,
    middleName: '',
    barangay: barangay || '—',
    age: 70,
    occupation: occupation || 'Retired',
    regDate: dob || new Date().toISOString().slice(0, 10),
    status: 'Pending',
    daysPending: 0,
    duplicate: null,
    sex,
    civilStatus: civil,
    contactNumber: contact
  };
  FULL_APPLICANTS.unshift(app);
  APP_DB[id] = app;
  closeAddApplicantModal();
  renderApplicationsTable();
  renderApplicantsTable();
  showToast('Applicant added: ' + name, 'success');
}

function renderApplicantsTable() {
  const tbody = document.getElementById('applicants-tbody');
  if (!tbody) return;
  const activeApplications = FULL_APPLICANTS.filter(isActiveApplication);
  const totalEl = document.getElementById('applicants-total');
  if (totalEl) totalEl.textContent = fmt(activeApplications.length) + ' Total';
  const rows = activeApplications.map(a => {
    const badgeClass = a.status === 'Verified' ? 'badge-approved' : a.status === 'ID Issued' ? 'badge-issued' : a.status === 'Rejected' ? 'badge-rejected' : 'badge-pending';
    return '<tr data-app-id="' + a.id + '" data-status="' + (a.status || 'Pending') + '" onclick="openApplicationDetail(\'' + a.id + '\')" style="cursor:pointer">' +
      '<td data-label="Name"><span class="cell-text applicant-name-cell">' + (a.name || '—') + '</span></td>' +
      '<td data-label="ID Number"><span class="cell-text">' + (a.id || '—') + '</span></td>' +
      '<td data-label="Barangay"><span class="cell-text">' + (a.barangay || '—') + '</span></td>' +
      '<td data-label="Civil Status"><span class="cell-text">' + (a.civilStatus || '—') + '</span></td>' +
      '<td data-label="Occupation"><span class="cell-text">' + (a.occupation || '—') + '</span></td>' +
      '<td data-label="Type">' + buildApplicationTypePill(a) + '</td>' +
      '<td data-label="Docs">' + buildDocsStatusPill(a) + '</td>' +
      '<td data-label="Status"><span class="badge ' + badgeClass + '">' + (a.status || 'Pending') + '</span></td>' +
      '<td data-label="Action" style="text-align:right">' + buildViewAction(a.id) + '</td>' +
      '</tr>';
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--text-muted)">No applicants yet.</td></tr>';
  // Skeleton: clear busy state now that real rows are inserted
  if (typeof Skeleton !== 'undefined') Skeleton.clearBusy('applicants-tbody');
  const footerInfo = document.querySelector('#mod-applicants .table-footer__info');
  if (footerInfo) footerInfo.textContent = 'Showing ' + activeApplications.length + ' of ' + fmt(activeApplications.length) + ' applicants';
}

function renderApplicationsTable() {
  const tbody = document.getElementById('applications-tbody');
  if (!tbody) return;
  const totalEl = document.getElementById('applicants-total');
  if (totalEl) totalEl.textContent = fmt(FULL_APPLICANTS.length) + ' Total';
  const urgentCount = FULL_APPLICANTS.filter(a => (a.daysPending || 0) > 5).length;
  const urgentEl = document.getElementById('urgent-count');
  if (urgentEl) urgentEl.textContent = urgentCount + ' Urgent';
  const urgentAlert = document.getElementById('urgent-alert');
  const urgentTitle = document.getElementById('urgent-alert-title');
  const urgentDesc = document.getElementById('urgent-alert-desc');
  if (urgentAlert) {
    urgentAlert.style.display = urgentCount > 0 ? '' : 'none';
    if (urgentTitle) urgentTitle.textContent = urgentCount + ' application' + (urgentCount === 1 ? '' : 's') + ' require urgent review';
    if (urgentDesc) urgentDesc.textContent = urgentCount > 0 ? 'These applications have been pending for more than 5 days and need immediate attention.' : '';
  }

  const activeApplications =
    FULL_APPLICANTS.filter(
      isActiveApplication
    );

  const rows =
    activeApplications.map((a, i) => {
      const grad = APPL_AVATAR_GRADIENTS[i % APPL_AVATAR_GRADIENTS.length];
      return '<tr data-app-id="' + a.id + '">' +
        '<td style="width:40px"><input type="checkbox" class="row-check" data-app-id="' + a.id + '" aria-label="Select ' + (a.name || '') + '" onchange="updateBatchState()" /></td>' +
        '<td data-label="Applicant"><div class="applicant-cell">' +
        '<div class="applicant-avatar" style="background:' + grad + '">' + appInitials(a.name) + '</div>' +
        '<div class="applicant-info"><span class="applicant-name">' + a.name + '</span><span class="applicant-id">' + a.id + '</span></div>' +
        '</div></td>' +
        '<td data-label="Date"><span class="cell-text">' + appRegDate(a.id) + '</span></td>' +
        '<td data-label="Type">' + buildApplicationTypePill(a) + '</td>' +
        '<td data-label="Barangay"><span class="cell-text">' + (a.barangay || '—') + '</span></td>' +
        '<td data-label="Docs">' + buildDocsStatusPill(a) + '</td>' +
        '<td data-label="Status">' + buildStatusSelect(a.id, a.status) + '</td>' +
        '<td style="text-align:right">' + buildViewAction(a.id) + '</td>' +
        '</tr>';
    }).join('');
  tbody.innerHTML = rows;
  // Skeleton: clear busy state now that real rows are inserted
  if (typeof Skeleton !== 'undefined') {
    Skeleton.clearBusy('applications-tbody');
    Skeleton.clearBusy('recent-submissions-tbody');
  }
  const footerInfo = document.querySelector('#mod-applicants .table-footer__info');
  if (footerInfo) footerInfo.textContent = 'Showing ' + rows.length + ' of ' + fmt(FULL_APPLICANTS.length) + ' applicants';
  // Update the status tab counts after rendering
  updateStatusTabCounts();
}

function runOptionalInit(label, fn) {
  try {
    if (typeof fn === 'function') fn();
  } catch (err) {
    console.error(label + ' failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Standalone login page: session restore decides whether to show the login
  // screen, the logout confirmation, or to bounce an active session to its portal.
  if (PAGE === 'login') {
    restoreSession();
    if (typeof Skeleton !== 'undefined') Skeleton.pageReady();
    return;
  }

  // Portal page initialization (admin.html / staff.html / idmaker.html)

  // Show the role dashboard first. Optional widgets below should never leave
  // the protected shell hidden if one widget has a browser-specific error.
  restoreSession();

  // Small form issuance initialization
  runOptionalInit('Small form issuance init', initSmallFormIssuance);
  runOptionalInit('Small form preview init', updatePreview);

  // ID Maker production queue initialization (only present in the ID Maker portal)
  runOptionalInit('ID Maker queue init', typeof initIdMakerQueue === 'function' ? initIdMakerQueue : null);

  // Role switcher toggle (sidebar) — dev builds only; the guarded top-level
  // toggleRoleSwitcher() handles every portal (this override previously
  // re-enabled it for all roles).

  applyRoleToUI();
  applySessionContext();

  // Enable dashboard scorecard click state so cards stay highlighted after click
  runOptionalInit('Dashboard card init', initDashboardCardClick);

  // Docs summary default
  runOptionalInit('Documents summary init', updateDocsSummary);

  // Close modal on backdrop click (guarded — modals may not exist in every role portal)
  const appModalEl = document.getElementById('app-modal');
  if (appModalEl) appModalEl.addEventListener('click', (e) => {
    if (e.target.id === 'app-modal') closeModal();
  });
  const idcardModalEl = document.getElementById('idcard-modal');
  if (idcardModalEl) idcardModalEl.addEventListener('click', (e) => {
    if (e.target.id === 'idcard-modal') closeIdCardModal();
  });
  const printDetailModalEl = document.getElementById('print-detail-modal');
  if (printDetailModalEl) printDetailModalEl.addEventListener('click', (e) => {
    if (e.target.id === 'print-detail-modal') closePrintDetail();
  });
  const applicantProfileModalEl = document.getElementById('applicant-profile-modal');
  if (applicantProfileModalEl) applicantProfileModalEl.addEventListener('click', (e) => {
    if (e.target.id === 'applicant-profile-modal') closeApplicantProfile();
  });

  // Start session inactivity timer
  runOptionalInit('Session timer init', resetInactivityTimer);

  if (typeof Skeleton !== 'undefined') Skeleton.pageReady();

});

/* ── Table Sort ── */
// Sort direction tracker per tbody:col key
const _sortState = {};

/**
 * Sort a data-table tbody by the given column index.
 * @param {string} tbodyId  – id of the <tbody>
 * @param {number} colIdx   – 0-based column index
r
 * @param {HTMLElement} thEl – the clicked <th> (for arrow toggle)
 */
function sortTable(tbodyId, colIdx, thEl) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const key = tbodyId + ':' + colIdx;
  const asc = _sortState[key] = !_sortState[key]; // toggle

  // Collect rows (skip hidden rows used by status filter)
  const rows = Array.from(tbody.querySelectorAll('tr'));

  rows.sort(function (a, b) {
    let aVal = (a.cells[colIdx] || {}).innerText || '';
    let bVal = (b.cells[colIdx] || {}).innerText || '';

    aVal = aVal.trim().toLowerCase();
    bVal = bVal.trim().toLowerCase();

    // Detect numeric values (handles commas like "1,245")
    const aNum = parseFloat(aVal.replace(/,/g, ''));
    const bNum = parseFloat(bVal.replace(/,/g, ''));
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return asc ? aNum - bNum : bNum - aNum;
    }

    // Detect dates ("Apr 7, 2026" style)
    const aDate = Date.parse(aVal);
    const bDate = Date.parse(bVal);
    if (!isNaN(aDate) && !isNaN(bDate)) {
      return asc ? aDate - bDate : bDate - aDate;
    }

    // Fall back to string comparison
    if (aVal < bVal) return asc ? -1 : 1;
    if (aVal > bVal) return asc ? 1 : -1;
    return 0;
  });

  // Re-append rows in sorted order
  rows.forEach(function (row) { tbody.appendChild(row); });

  // Update sort arrows: reset all <th> in this table, then set active one
  const table = tbody.closest('table');
  if (table) {
    table.querySelectorAll('th .sort-icon').forEach(function (icon) {
      icon.textContent = '↕';
      icon.style.opacity = '';
    });
  }
  const activeIcon = thEl.querySelector('.sort-icon');
  if (activeIcon) {
    activeIcon.textContent = asc ? '↑' : '↓';
    activeIcon.style.opacity = '1';
  }
}
