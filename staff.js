// Wake the Record Management backend early without blocking page rendering.
fetch("https://management-backend-3cij.onrender.com/health", {
  method: "GET",
  mode: "cors",
  cache: "no-store",
  keepalive: true,
}).catch(() => {
  // Normal API requests display their own error feedback if the backend is unavailable.
});

// Staff dashboard

// Staff KPI configuration

const STAFF_KPIS = [
  {
    label: 'Total applications',
    value: '0',
    sub: 'All recorded applications',
    icon: 'fi fi-rr-apps',
    trend: '',
    trendClass: 'trend-neutral',
    iconWrap: 'blue'
  },
  {
    label: 'Pending Review',
    value: '0',
    sub: 'Pending or in review',
    icon: 'fi fi-rr-clock',
    trend: '',
    trendClass: 'trend-neutral',
    iconWrap: 'warn'
  },
  {
    label: 'Approved Today',
    value: '0',
    sub: 'Approved, ready, or issued today',
    icon: 'fi fi-rr-check-double',
    trend: '',
    trendClass: 'trend-neutral',
    iconWrap: 'green'
  },
  {
    label: 'Applications processed',
    value: '0',
    sub: 'Applications advanced this month',
    icon: 'fi fi-rr-chart-line-up',
    trend: '',
    trendClass: 'trend-neutral',
    iconWrap: 'teal'
  },
  {
    label: 'Rejected Applications',
    value: '0',
    sub: 'Rejected this month',
    icon: 'fi fi-rr-x',
    trend: '',
    trendClass: 'trend-neutral',
    iconWrap: 'red'
  }
];


// Status helpers

function normalizeApplicationStatus(status) {

  const value =
    String(status || 'Pending')
      .trim()
      .toLowerCase();

  if (
    value === 'pending' ||
    value === 'unverified'
  ) {
    return 'pending';
  }

  if (
    value === 'under review' ||
    value === 'in review'
  ) {
    return 'review';
  }

  if (
    value === 'verified'
  ) {
    return 'approved';
  }

  if (
    value === 'ready for release'
  ) {
    return 'ready';
  }

  if (
    value === 'id issued'
  ) {
    return 'issued';
  }

  if (
    value === 'completed'
  ) {
    return 'completed';
  }

  if (
    value === 'rejected'
  ) {
    return 'rejected';
  }

  if (
    value === 'in process'
  ) {
    return 'process';
  }

  return 'pending';
}


// DATE HELPERS

function isSameDay(dateValue, referenceDate = new Date()) {

  if (!dateValue) {
    return false;
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date.getFullYear() ===
    referenceDate.getFullYear() &&
    date.getMonth() ===
    referenceDate.getMonth() &&
    date.getDate() ===
    referenceDate.getDate()
  );
}


function isSameMonth(dateValue, referenceDate = new Date()) {

  if (!dateValue) {
    return false;
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date.getFullYear() ===
    referenceDate.getFullYear() &&
    date.getMonth() ===
    referenceDate.getMonth()
  );
}


// LIVE APPLICATION STORAGE

let LIVE_APPLICATIONS = [];

// Keep selected application IDs stable while the live table is re-rendered.
const STAFF_SELECTED_APP_IDS = new Set();

function getVisibleStaffApplicationCheckboxes() {
  return Array.from(document.querySelectorAll(
    '#applications-tbody .row-check[data-app-id]'
  )).filter(checkbox => {
    const row = checkbox.closest('tr');
    return row && window.getComputedStyle(row).display !== 'none';
  });
}

function toggleSelectAllApps(checked) {
  const shouldSelect = Boolean(checked);
  const visibleCheckboxes = getVisibleStaffApplicationCheckboxes();

  visibleCheckboxes.forEach(checkbox => {
    const id = String(checkbox.dataset.appId || '');
    if (!id) return;
    checkbox.checked = shouldSelect;
    if (shouldSelect) STAFF_SELECTED_APP_IDS.add(id);
    else STAFF_SELECTED_APP_IDS.delete(id);
  });

  updateBatchState();
}

function toggleApplicationSelection(checkbox) {
  if (!checkbox) return;
  const id = String(checkbox.dataset.appId || '');
  if (!id) return;
  if (checkbox.checked) STAFF_SELECTED_APP_IDS.add(id);
  else STAFF_SELECTED_APP_IDS.delete(id);
  updateBatchState();
}

function updateBatchState() {
  const checkboxes = Array.from(document.querySelectorAll(
    '#applications-tbody .row-check[data-app-id]'
  ));
  checkboxes.forEach(checkbox => {
    const id = String(checkbox.dataset.appId || '');
    checkbox.checked = STAFF_SELECTED_APP_IDS.has(id);
  });

  const visible = getVisibleStaffApplicationCheckboxes();
  const selectedVisible = visible.filter(checkbox =>
    STAFF_SELECTED_APP_IDS.has(String(checkbox.dataset.appId || ''))
  ).length;
  const selectAll = document.getElementById('select-all-apps');
  if (selectAll) {
    selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
    selectAll.disabled = visible.length === 0;
  }

  const selectedCount = STAFF_SELECTED_APP_IDS.size;
  const trigger = document.getElementById('batch-ops-trigger');
  const label = document.getElementById('batch-ops-label');
  const exportButton = document.querySelector('#batch-ops-menu [onclick="runBatchAction(\'export\')"]');
  const approveButton = document.querySelector('#batch-ops-menu [onclick="runBatchAction(\'approve\')"]');
  if (trigger) trigger.disabled = selectedCount === 0;
  if (label) label.textContent = selectedCount
    ? 'Batch Operations (' + selectedCount.toLocaleString() + ')'
    : 'Batch Operations';
  if (exportButton) exportButton.disabled = selectedCount === 0;

  const eligibleCount = Array.from(STAFF_SELECTED_APP_IDS).filter(id => {
    const app = LIVE_APPLICATIONS.find(item => String(item.application_id || item.id) === id);
    return app && ['pending', 'review', 'process'].includes(normalizeApplicationStatus(app.status));
  }).length;
  if (approveButton) approveButton.disabled = eligibleCount === 0;
}

// Delegate checkbox events from the live applications table. This remains
// reliable when renderLiveApplications replaces the table rows dynamically.
if (!window.__staffApplicationSelectionBound) {
  window.__staffApplicationSelectionBound = true;
  document.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.id === 'select-all-apps') {
      toggleSelectAllApps(target.checked);
      return;
    }

    if (target.matches('#applications-tbody .row-check[data-app-id]')) {
      toggleApplicationSelection(target);
    }
  });
}

window.toggleSelectAllApps = toggleSelectAllApps;
window.updateBatchState = updateBatchState;



// UPDATE LIVE ANALYTICS DATA

function getAnalyticsRangeApplications(applications = LIVE_APPLICATIONS) {
  if (!Array.isArray(applications)) return [];
  const range = document.getElementById('report-range')?.value || '30';
  if (range === 'all') return applications;

  const now = new Date();
  let start;
  if (range === '7' || range === '30') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (Number(range) - 1));
  } else if (range === 'quarter') {
    start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (range === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  }

  if (!start) return applications;
  return applications.filter(application => {
    const value = application.created_at || application.submitted_at || application.application_date;
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= start && date <= now;
  });
}

function applyAnalyticsDateRange(showFeedback = false) {
  const filtered = getAnalyticsRangeApplications();
  const counts = { pending: 0, review: 0, approved: 0, rejected: 0 };
  filtered.forEach(application => {
    const status = normalizeApplicationStatus(application.status);
    if (status === 'pending') counts.pending++;
    else if (status === 'review') counts.review++;
    else if (status === 'rejected') counts.rejected++;
    else if (['approved', 'ready', 'issued', 'completed'].includes(status)) counts.approved++;
  });

  if (typeof ANALYTICS_DATA !== 'undefined') {
    ['Admin', 'Staff', 'ID Maker'].forEach(role => {
      const data = ANALYTICS_DATA[role];
      if (!data) return;
      data.pending = counts.pending;
      data.inReview = counts.review;
      data.approved = counts.approved;
      data.rejected = counts.rejected;
      data.statusDenominator = filtered.length;
    });
  }

  const statusTotal = filtered.length;
  const values = {
    'analytics-status-approved': counts.approved,
    'analytics-status-pending': counts.pending,
    'analytics-status-review': counts.review,
    'analytics-status-rejected': counts.rejected,
    'analytics-status-approved-percent': statusTotal ? `${(counts.approved / statusTotal * 100).toFixed(1)}%` : '0.0%',
    'analytics-status-pending-percent': statusTotal ? `${(counts.pending / statusTotal * 100).toFixed(1)}%` : '0.0%',
    'analytics-status-review-percent': statusTotal ? `${(counts.review / statusTotal * 100).toFixed(1)}%` : '0.0%',
    'analytics-status-rejected-percent': statusTotal ? `${(counts.rejected / statusTotal * 100).toFixed(1)}%` : '0.0%',
    'queue-mix-total': statusTotal.toLocaleString(),
    'queue-mix-sample': `n = ${statusTotal.toLocaleString()} applications`,
    'analytics-kpi-pending': counts.pending + counts.review,
    'analytics-kpi-review': counts.review,
    'analytics-kpi-ready': counts.approved,
    'analytics-kpi-rejected': counts.rejected
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = typeof value === 'number' ? value.toLocaleString() : value;
  });

  updateLiveAnalyticsCharts(filtered);
  const allStatusesZero = Object.values(counts).every(count => count === 0);
  const emptyRing = document.getElementById('queue-mix-empty-ring');
  const chartCanvas = document.getElementById('chart-status');
  if (emptyRing) emptyRing.style.display = allStatusesZero ? 'flex' : 'none';
  if (chartCanvas) chartCanvas.style.opacity = allStatusesZero ? '0' : '1';
  if (showFeedback) {
    const label = document.getElementById('report-range')?.selectedOptions[0]?.textContent || 'selected period';
    showToast(`Analytics updated: ${label} (${filtered.length} applications).`, 'info');
  }
}

function updateLiveAnalyticsData(applications) {

  if (!Array.isArray(applications)) {
    return;
  }

  LIVE_APPLICATIONS =
    applications;

  const now =
    new Date();

  let pending = 0;
  let inReview = 0;
  let approved = 0;
  let rejected = 0;
  let idsIssued = 0;

  let approvedToday = 0;
  let processedThisMonth = 0;
  let rejectedThisMonth = 0;

  applications.forEach(application => {

    const status =
      normalizeApplicationStatus(
        application.status
      );

    const statusDate =
      application.status_updated_at ||
      application.created_at ||
      null;


    // CURRENT STATUS COUNTS

    if (
      status === 'pending'
    ) {
      pending++;
    }

    if (
      status === 'review'
    ) {
      inReview++;
    }

    if (
      status === 'approved' ||
      status === 'ready' ||
      status === 'issued' ||
      status === 'completed'
    ) {
      approved++;
    }

    if (
      status === 'rejected'
    ) {
      rejected++;
    }

    if (
      status === 'issued' ||
      status === 'completed'
    ) {
      idsIssued++;
    }


    // APPROVED TODAY

    if (
      (
        status === 'approved' ||
        status === 'ready' ||
        status === 'issued' ||
        status === 'completed'
      ) &&
      isSameDay(
        statusDate,
        now
      )
    ) {
      approvedToday++;
    }


    // PROCESSED THIS MONTH

    if (
      (
        status === 'process' ||
        status === 'approved' ||
        status === 'ready' ||
        status === 'issued' ||
        status === 'completed' ||
        status === 'rejected'
      ) &&
      isSameMonth(
        statusDate,
        now
      )
    ) {
      processedThisMonth++;
    }


    // REJECTED THIS MONTH

    if (
      status === 'rejected' &&
      isSameMonth(
        statusDate,
        now
      )
    ) {
      rejectedThisMonth++;
    }

  });


  const pendingReview =
    pending + inReview;


  // UPDATE ANALYTICS DATA

  if (
    typeof ANALYTICS_DATA !==
    'undefined'
  ) {

    const roles = [
      'Admin',
      'Staff',
      'ID Maker'
    ];

    roles.forEach(role => {

      if (!ANALYTICS_DATA[role]) {
        return;
      }

      ANALYTICS_DATA[role]
        .totalApplications =
        applications.length;

      ANALYTICS_DATA[role]
        .pending =
        pending;

      ANALYTICS_DATA[role]
        .inReview =
        inReview;

      ANALYTICS_DATA[role]
        .pendingReview =
        pendingReview;

      ANALYTICS_DATA[role]
        .approved =
        approved;

      ANALYTICS_DATA[role]
        .rejected =
        rejected;

      ANALYTICS_DATA[role]
        .idsIssued =
        idsIssued;

      ANALYTICS_DATA[role]
        .statusDenominator =
        applications.length;
    });
  }


  // UPDATE MAIN DASHBOARD

  if (
    typeof applyDashboardMetrics ===
    'function'
  ) {
    applyDashboardMetrics();
  }


  if (
    typeof applyAnalyticsRoleView ===
    'function'
  ) {

    try {

      applyAnalyticsRoleView();

    } catch (error) {

      console.warn(
        'Unable to refresh analytics view:',
        error
      );

    }

  }


  // UPDATE APPLICATION SUMMARY CARDS

  updateApplicationSummaryCards(
    applications
  );


  // UPDATE STAFF KPI STRIP

  updateStaffKPICards({
    total:
      applications.length,
    pendingReview,
    approvedToday,
    processedThisMonth,
    rejectedThisMonth,
    applications
  });

  // Keep analytics scoped to the selected submission period after live updates.
  applyAnalyticsDateRange();

}


// UPDATE LIVE DASHBOARD VISUALS

function updateLiveDashboardVisuals(
  applications
) {

  if (!Array.isArray(applications)) {
    return;
  }


  /*
   * 1. BARANGAY REGISTRATIONS
   */

  const yearFilter =
    document.getElementById(
      'barangay-year-filter'
    );

  const selectedYear =
    yearFilter
      ? String(
        yearFilter.value
      )
      : String(
        new Date()
          .getFullYear()
      );

  const barangayCounts = {};


  applications.forEach(
    application => {

      const dateValue =
        application.created_at ||
        application.submitted_at ||
        null;

      if (!dateValue) {
        return;
      }

      const date =
        new Date(dateValue);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return;
      }

      if (
        String(
          date.getFullYear()
        ) !== selectedYear
      ) {
        return;
      }

      const barangay =
        application.barangay_district ||
        'Unknown';

      barangayCounts[barangay] =
        (
          barangayCounts[barangay] ||
          0
        ) + 1;

    }
  );


  const barangayRows =
    Object.entries(
      barangayCounts
    )
      .sort(
        (a, b) =>
          b[1] - a[1]
      )
      .slice(0, 6);


  const barColumns =
    document.querySelectorAll(
      '.barangay-empty-card .bar-col'
    );

  const emptyNote =
    document.getElementById(
      'barangay-empty-note'
    );


  if (
    !barangayRows.length
  ) {

    if (emptyNote) {

      emptyNote.style.display =
        'flex';

      emptyNote.textContent =
        `No registration data available for ${selectedYear} yet.`;

    }

    barColumns.forEach(
      column => {

        const bar =
          column.querySelector(
            '.bar-col__bar'
          );

        if (bar) {
          bar.style.height =
            '0';
          bar.removeAttribute('title');
          bar.classList.remove('bar-col__bar--peak');
        }

        column.style.setProperty('--bar-height', '0%');
        column.classList.remove('is-peak');
        const value = column.querySelector('.bar-col__value');
        const label = column.querySelector('.bar-col__label');
        if (value) value.textContent = '0';
        if (label) {
          label.textContent = '\u2014';
          label.removeAttribute('title');
        }

      }
    );

  } else {

    if (emptyNote) {
      emptyNote.style.display =
        'none';
    }

    const maxValue =
      barangayRows[0][1] ||
      1;

    barColumns.forEach(
      (column, index) => {

        const bar =
          column.querySelector(
            '.bar-col__bar'
          );

        if (!bar) {
          return;
        }

        const row =
          barangayRows[index];

        if (!row) {

          bar.style.height =
            '0';

          column.style.setProperty('--bar-height', '0%');
          column.classList.remove('is-peak');
          bar.classList.remove('bar-col__bar--peak');
          bar.removeAttribute('title');
          const emptyValue = column.querySelector('.bar-col__value');
          const emptyLabel = column.querySelector('.bar-col__label');
          if (emptyValue) emptyValue.textContent = '0';
          if (emptyLabel) {
            emptyLabel.textContent = '\u2014';
            emptyLabel.removeAttribute('title');
          }

          return;
        }

        const barangay =
          row[0];

        const count =
          row[1];

        const height = count > 0
          ? Math.max(5, Math.round((count / maxValue) * 84))
          : 0;

        bar.style.height =
          `${height}%`;
        column.style.setProperty('--bar-height', `${height}%`);
        column.classList.toggle('is-peak', index === 0);
        bar.classList.toggle('bar-col__bar--peak', index === 0);

        bar.title =
          `${barangay}: ${count}`;

        const label =
          column.querySelector(
            '.bar-col__label'
          );

        if (label) {
          label.textContent =
            barangay;
          label.title = barangay;
        }

        const value =
          column.querySelector(
            '.bar-col__value'
          );

        if (value) {
          value.textContent =
            count;
        }

      }
    );

  }

  const donutSvg =
    document.querySelector(
      '.donut-svg'
    );

  const donutPercent =
    document.querySelector(
      '.donut-inner__pct'
    );

  const donutTag =
    document.querySelector(
      '.donut-inner__tag'
    );

  const legendValues =
    document.querySelectorAll(
      '.donut-legend__val'
    );

  let female = 0;
  let male = 0;


  applications.forEach(
    application => {

      const sex =
        String(
          application.sex ||
          application.gender ||
          application.sex_at_birth ||
          ''
        )
          .trim()
          .toLowerCase();

      if (
        sex === 'female' ||
        sex === 'f'
      ) {
        female++;
      }

      if (
        sex === 'male' ||
        sex === 'm'
      ) {
        male++;
      }

    }
  );


  const demographicTotal =
    female + male;


  if (
    demographicTotal > 0
  ) {

    const femalePercent =
      Math.round(
        (
          female /
          demographicTotal
        ) * 100
      );

    const malePercent =
      100 - femalePercent;


    if (donutSvg) {

      donutSvg.innerHTML = `
        <circle
          cx="67"
          cy="67"
          r="54"
          fill="none"
          stroke="#93C5FD"
          stroke-width="14"
          stroke-dasharray="${femalePercent * 3.393} 339.3"
          stroke-linecap="butt"
          transform="rotate(-90 67 67)"
        />

        <circle
          cx="67"
          cy="67"
          r="54"
          fill="none"
          stroke="#3D6FE8"
          stroke-width="14"
          stroke-dasharray="${malePercent * 3.393} 339.3"
          stroke-dashoffset="${-(femalePercent * 3.393)}"
          stroke-linecap="butt"
          transform="rotate(-90 67 67)"
        />
      `;

    }


    if (donutPercent) {
      donutPercent.textContent =
        '100%';
    }

    if (donutTag) {
      donutTag.textContent =
        'Total';
    }

    if (legendValues[0]) {
      legendValues[0].textContent =
        `${femalePercent}%`;
    }

    if (legendValues[1]) {
      legendValues[1].textContent =
        `${malePercent}%`;
    }

  } else {

    if (donutPercent) {
      donutPercent.textContent =
        '0%';
    }

    if (donutTag) {
      donutTag.textContent =
        'No data';
    }

    if (legendValues[0]) {
      legendValues[0].textContent =
        '0%';
    }

    if (legendValues[1]) {
      legendValues[1].textContent =
        '0%';
    }

  }

}

// ============================================================
// INITIALIZE BARANGAY YEAR FILTER
// ============================================================

function initializeBarangayYearFilter() {

  const select =
    document.getElementById(
      'barangay-year-filter'
    );

  if (!select) {
    return;
  }

  const currentYear =
    new Date().getFullYear();

  const years = [];

  for (
    let year = currentYear;
    year >= currentYear - 4;
    year--
  ) {
    years.push(year);
  }

  select.innerHTML =
    years
      .map(
        year =>
          `<option value="${year}">${year}</option>`
      )
      .join('');

  select.value =
    String(currentYear);

}

// BARANGAY YEAR FILTER

function filterBarangayYear(year) {

  const applications =
    Array.isArray(
      LIVE_APPLICATIONS
    )
      ? LIVE_APPLICATIONS
      : [];

  updateLiveDashboardVisuals(
    applications
  );

}


// UPDATE APPLICATION SUMMARY CARDS

function updateApplicationSummaryCards(
  applications
) {

  if (
    !Array.isArray(
      applications
    )
  ) {
    return;
  }

  let pending = 0;
  let underReview = 0;
  let flaggedDuplicates = 0;
  let incompleteDocs = 0;
  let readyForIdMaker = 0;


  applications.forEach(
    application => {

      const status =
        normalizeApplicationStatus(
          application.status
        );


      // PENDING

      if (
        status === 'pending'
      ) {
        pending++;
      }


      // UNDER REVIEW

      if (
        status === 'review'
      ) {
        underReview++;
      }


      // FLAGGED DUPLICATES

      const duplicate =
        application.duplicate;

      const duplicateRisk =
        application.duplicate_risk;


      if (
        duplicate === true ||
        (
          duplicate &&
          typeof duplicate ===
          'object'
        ) ||
        (
          duplicateRisk &&
          Number(
            duplicateRisk.score ||
            0
          ) >= 0.80
        )
      ) {

        flaggedDuplicates++;

      }


      // INCOMPLETE DOCUMENTS

      const documents =
        application.documents ||
        {};

      const hasPhoto =
        Boolean(
          documents.photo ||
          documents.latest_photo_signed_url
        );

      const hasBirthCertificate =
        Boolean(
          documents.bc ||
          documents.birth_certificate_signed_url
        );

      const hasCedula =
        Boolean(
          documents.cedula ||
          documents.community_tax_certificate_signed_url
        );


      if (
        !hasPhoto ||
        !hasBirthCertificate ||
        !hasCedula
      ) {
        incompleteDocs++;
      }


      // READY FOR ID MAKER

      if (
        status === 'ready'
      ) {
        readyForIdMaker++;
      }

    }
  );


  const values = {

    'summary-pending':
      pending,

    'summary-review':
      underReview,

    'summary-duplicates':
      flaggedDuplicates,

    'summary-incomplete':
      incompleteDocs,

    'summary-ready':
      readyForIdMaker

  };


  Object.entries(
    values
  ).forEach(
    ([id, value]) => {

      const element =
        document.getElementById(
          id
        );

      if (element) {

        element.textContent =
          Number(value)
            .toLocaleString();

      }

    }
  );

}


// STAFF DASHBOARD KPI CARDS

function updateStaffKPICards(metrics) {
  const strip = document.getElementById('staff-kpi-strip');
  if (!strip) return;

  const applications = Array.isArray(metrics.applications) ? metrics.applications : [];
  const now = new Date();
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7));
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const comparisonDay = Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate());
  const endOfLastMonthComparison = new Date(now.getFullYear(), now.getMonth() - 1, comparisonDay + 1);
  const getDate = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const submittedDate = application => getDate(
    application.created_at ||
    application.submitted_at ||
    application.date_submitted ||
    application.application_date ||
    application.applied_at ||
    application.submission_date ||
    application.date_created
  );
  const statusDate = application => getDate(application.status_updated_at || application.created_at);
  const processedStatuses = new Set(['process', 'approved', 'ready', 'issued', 'completed', 'rejected']);
  const isBetween = (date, start, end) => date && date >= start && date < end;

  const newThisWeek = applications.filter(application => {
    const submitted = submittedDate(application);
    return submitted && submitted >= startOfThisWeek && submitted <= now;
  }).length;
  const overduePending = applications.filter(application =>
    ['pending', 'review'].includes(normalizeApplicationStatus(application.status)) &&
    (getApplicationDaysPending(application) || 0) > 5).length;
  const processedThisMonth = applications.filter(application =>
    processedStatuses.has(normalizeApplicationStatus(application.status)) &&
    isBetween(statusDate(application), startOfThisMonth, startOfNextMonth)).length;
  const processedLastMonth = applications.filter(application =>
    processedStatuses.has(normalizeApplicationStatus(application.status)) &&
    isBetween(statusDate(application), startOfLastMonth, endOfLastMonthComparison)).length;
  const rejectedThisMonth = applications.filter(application =>
    normalizeApplicationStatus(application.status) === 'rejected' &&
    isBetween(statusDate(application), startOfThisMonth, startOfNextMonth)).length;
  const rejectedLastMonth = applications.filter(application =>
    normalizeApplicationStatus(application.status) === 'rejected' &&
    isBetween(statusDate(application), startOfLastMonth, endOfLastMonthComparison)).length;

  const values = [
    Number(metrics.total) || 0,
    Number(metrics.pendingReview) || 0,
    Number(metrics.approvedToday) || 0,
    Number(metrics.processedThisMonth) || 0,
    Number(metrics.rejectedThisMonth) || 0
  ];
  const subtitles = [
    'All recorded applications',
    'Pending or in review',
    'Approved, ready, or issued today',
    'Applications advanced this month',
    'Rejected this month'
  ];
  const processedBadge = processedLastMonth > 0
    ? (() => {
      const difference = processedThisMonth - processedLastMonth;
      return {
        text: difference === 0 ? 'No change vs last month' :
          `${difference > 0 ? '\u25B2 +' : '\u25BC '}${Math.abs(difference)} vs last month`,
        className: difference > 0 ? 'trend-good' : difference < 0 ? 'trend-down' : 'trend-neutral',
        title: `${processedThisMonth} applications were advanced this month versus ${processedLastMonth} in the same period last month (${Math.abs(difference)} difference).`
      };
    })()
    : {
      text: 'No baseline',
      className: 'trend-neutral',
      title: 'No completed prior-period comparison data is available for this metric.'
    };
  const rejectedBadge = rejectedThisMonth === 0
    ? { text: 'None', className: 'trend-neutral', title: 'No applications were rejected this month.' }
    : rejectedLastMonth > 0
      ? (() => {
        const difference = rejectedThisMonth - rejectedLastMonth;
        const percentage = Math.round(Math.abs(difference / rejectedLastMonth) * 100);
        return {
          text: difference === 0 ? 'No change vs last month' :
            `${difference > 0 ? '\u25B2' : '\u25BC'} ${percentage}% vs last month`,
          className: difference > 0 ? 'trend-up' : difference < 0 ? 'trend-good' : 'trend-neutral',
          title: `${rejectedThisMonth} applications were rejected this month versus ${rejectedLastMonth} in the same period last month.`
        };
      })()
      : {
        text: `${rejectedThisMonth} this month`,
        className: 'trend-up',
        title: `${rejectedThisMonth} applications were rejected this month; none were rejected in the comparable period last month.`
      };
  const badges = [
    { text: newThisWeek > 0 ? `+${newThisWeek} this week` : 'No new this week',
      className: 'trend-neutral',
      title: newThisWeek > 0
        ? `${newThisWeek} applications were submitted this week.`
        : 'No applications have been submitted since the start of this week.' },
    overduePending > 0
      ? { text: `${overduePending} overdue`, className: 'trend-up', title: `${overduePending} pending applications are more than 5 days old.` }
      : { text: 'On track', className: 'trend-good', title: 'No pending applications are more than 5 days old.' },
    metrics.approvedToday > 0
      ? { text: 'Target: 10', className: 'trend-neutral', title: 'Daily approval target: 10 applications.' }
      : { text: '\u2014', className: 'trend-neutral', title: 'No approvals have been recorded today yet. Daily target: 10 applications.' },
    processedBadge,
    rejectedBadge
  ];

  strip.querySelectorAll('.stat-card').forEach((card, index) => {
    const value = card.querySelector('.stat-card__value');
    const subtitle = card.querySelector('.stat-card__sub');
    const badgeElement = card.querySelector('.stat-card__trend');
    if (value) value.textContent = values[index].toLocaleString();
    if (subtitle) subtitle.textContent = subtitles[index];
    if (!badgeElement) return;

    const badge = badges[index];
    badgeElement.classList.remove('trend-good', 'trend-up', 'trend-down', 'trend-neutral');
    if (!badge) {
      badgeElement.textContent = '';
      badgeElement.removeAttribute('title');
      badgeElement.removeAttribute('aria-label');
      badgeElement.style.display = 'none';
      return;
    }

    badgeElement.textContent = badge.text;
    badgeElement.classList.add(badge.className);
    badgeElement.title = badge.title;
    badgeElement.setAttribute('aria-label', badge.title);
    badgeElement.style.display = '';
  });
}

function updateAgeDistributionLegend() {

  const container =
    document.getElementById(
      'age-distribution-legend'
    );

  if (!container) {
    return;
  }

  const data =
    analyticsScope().ageDistribution ||
    [0, 0, 0, 0, 0, 0];

  const groups = [
    {
      label: '60–64 yrs',
      value: Number(data[0]) || 0
    },
    {
      label: '65–69 yrs',
      value: Number(data[1]) || 0
    },
    {
      label: '70–74 yrs',
      value: Number(data[2]) || 0
    },
    {
      label: '75–79 yrs',
      value: Number(data[3]) || 0
    },
    {
      label: '80–84 yrs',
      value: Number(data[4]) || 0
    },
    {
      label: '85+ yrs',
      value: Number(data[5]) || 0
    }
  ];

  const total =
    groups.reduce(
      (sum, group) =>
        sum + group.value,
      0
    );

  container.innerHTML =
    groups.map(
      group => {

        const percent =
          total > 0
            ? Math.round(
              (group.value / total) * 100
            )
            : 0;

        return `
          <div
            style="
              display:flex;
              align-items:center;
              gap:8px;
              font-size:13px;
              line-height:1.3;
            "
          >
            <span
              style="
                width:10px;
                height:10px;
                border-radius:50%;
                background:var(--primary);
                flex-shrink:0;
              "
            ></span>

            <span>
              <strong style="font-size:13px">
                ${group.label}
              </strong>

              <br />

              <span
                style="
                  color:var(--text-muted);
                  font-size:12px;
                "
              >
                ${percent}% · ${group.value}
              </span>
            </span>
          </div>
        `;

      }
    )
      .join('');
}

// BUILD LIVE ANALYTICS DATA

function updateLiveAnalyticsCharts(
  applications
) {

  if (
    !Array.isArray(
      applications
    )
  ) {
    return;
  }

  const currentYear =
    new Date().getFullYear();


  // INITIAL DATA ARRAYS

  const submitted =
    Array(12).fill(0);

  const approvedMonthly =
    Array(12).fill(0);

  const rejectedMonthly =
    Array(12).fill(0);

  const issuanceMonthly =
    Array(12).fill(0);

  const processingTotals =
    Array(12).fill(0);

  const processingCounts =
    Array(12).fill(0);

  const barangays = {};

  const ageDistribution =
    Array(6).fill(0);


  // PROCESS APPLICATIONS

  applications.forEach(
    application => {

      const createdDateValue =
        application.created_at ||
        application.submitted_at ||
        application.application_date ||
        null;

      const createdDate =
        createdDateValue
          ? new Date(createdDateValue)
          : null;


      // MONTHLY SUBMISSIONS

      if (
        createdDate &&
        !Number.isNaN(
          createdDate.getTime()
        ) &&
        createdDate.getFullYear() ===
        currentYear
      ) {

        submitted[
          createdDate.getMonth()
        ]++;

      }


      // APPLICATION STATUS

      const status =
        normalizeApplicationStatus(
          application.status
        );


      // STATUS DATE

      const statusDateValue =
        application.status_updated_at ||
        application.updated_at ||
        createdDateValue;

      const statusDate =
        statusDateValue
          ? new Date(statusDateValue)
          : createdDate;


      // APPROVED / REJECTED MONTHLY

      if (
        statusDate &&
        !Number.isNaN(
          statusDate.getTime()
        ) &&
        statusDate.getFullYear() ===
        currentYear
      ) {

        const month =
          statusDate.getMonth();


        if (
          status === 'approved' ||
          status === 'ready' ||
          status === 'issued' ||
          status === 'completed'
        ) {

          approvedMonthly[
            month
          ]++;

        }


        if (
          status === 'rejected'
        ) {

          rejectedMonthly[
            month
          ]++;

        }

      }


      // BARANGAY DATA

      const barangay =
        application.barangay_district ||
        'Unknown';


      if (
        !barangays[barangay]
      ) {

        barangays[barangay] = {

          total: 0,

          approved: 0,

          pending: 0

        };

      }


      barangays[barangay]
        .total++;


      if (
        status === 'approved' ||
        status === 'ready' ||
        status === 'issued' ||
        status === 'completed'
      ) {

        barangays[barangay]
          .approved++;

      }


      if (
        status === 'pending' ||
        status === 'review'
      ) {

        barangays[barangay]
          .pending++;

      }


      // AGE DISTRIBUTION

      const age =
        Number(
          application.age
        );


      if (
        !Number.isNaN(age)
      ) {

        if (
          age >= 60 &&
          age <= 64
        ) {

          ageDistribution[0]++;

        }

        else if (
          age >= 65 &&
          age <= 69
        ) {

          ageDistribution[1]++;

        }

        else if (
          age >= 70 &&
          age <= 74
        ) {

          ageDistribution[2]++;

        }

        else if (
          age >= 75 &&
          age <= 79
        ) {

          ageDistribution[3]++;

        }

        else if (
          age >= 80 &&
          age <= 84
        ) {

          ageDistribution[4]++;

        }

        else if (
          age >= 85
        ) {

          ageDistribution[5]++;

        }

      }


      // ID ISSUANCE

      if (
        (
          status === 'issued' ||
          status === 'completed'
        ) &&
        statusDate &&
        !Number.isNaN(
          statusDate.getTime()
        ) &&
        statusDate.getFullYear() ===
        currentYear
      ) {

        issuanceMonthly[
          statusDate.getMonth()
        ]++;

      }


      // PROCESSING TIME

      if (
        createdDate &&
        statusDate &&
        !Number.isNaN(
          createdDate.getTime()
        ) &&
        !Number.isNaN(
          statusDate.getTime()
        ) &&
        (
          status === 'approved' ||
          status === 'ready' ||
          status === 'issued' ||
          status === 'completed' ||
          status === 'rejected'
        )
      ) {

        const days =
          Math.max(
            0,
            Math.round(
              (
                statusDate.getTime() -
                createdDate.getTime()
              ) /
              (
                1000 *
                60 *
                60 *
                24
              )
            )
          );


        const month =
          statusDate.getMonth();


        processingTotals[month] +=
          days;

        processingCounts[month]++;

      }

    }
  );


  // PREPARE BARANGAY DATA

  const barangayLabels =
    Object.keys(
      barangays
    );


  const barangayTotal =
    barangayLabels.map(
      barangay =>
        barangays[barangay]
          .total
    );


  const barangayApproved =
    barangayLabels.map(
      barangay =>
        barangays[barangay]
          .approved
    );


  const barangayPending =
    barangayLabels.map(
      barangay =>
        barangays[barangay]
          .pending
    );


  // CALCULATE AVERAGE PROCESSING TIME

  const processing =
    processingTotals.map(
      (total, index) => {

        if (
          processingCounts[index] ===
          0
        ) {
          return 0;
        }

        return Number(
          (
            total /
            processingCounts[index]
          ).toFixed(1)
        );

      }
    );


  // CALCULATE CUMULATIVE ID ISSUANCE

  let issuedRunningTotal =
    0;


  const issuance =
    issuanceMonthly.map(
      count => {

        issuedRunningTotal +=
          count;

        return issuedRunningTotal;

      }
    );


  // UPDATE ANALYTICS DATA

  const roles = [
    'Admin',
    'Staff',
    'ID Maker'
  ];

  roles.forEach(
    role => {

      const data =
        ANALYTICS_DATA[role];

      if (!data) {
        return;
      }


      data.submitted =
        [...submitted];

      data.approvedMonthly =
        [...approvedMonthly];

      data.rejectedMonthly =
        [...rejectedMonthly];


      data.barangayLabels =
        [...barangayLabels];

      data.barangayTotal =
        [...barangayTotal];

      data.barangayApproved =
        [...barangayApproved];

      data.barangayPending =
        [...barangayPending];


      data.ageDistribution =
        [...ageDistribution];

      updateAgeDistributionLegend();


      data.issuance =
        [...issuance];


      data.processing =
        [...processing];

    }
  );


  // REFRESH CHARTS

  if (
    typeof chartsReady !==
    'undefined' &&
    chartsReady
  ) {

    if (
      typeof CHARTS !==
      'undefined'
    ) {

      if (
        CHARTS.trend
      ) {

        if (
          CHARTS.trend.data.datasets[0]
        ) {

          CHARTS.trend.data.datasets[0]
            .data =
            submitted;

        }

        if (
          CHARTS.trend.data.datasets[1]
        ) {

          CHARTS.trend.data.datasets[1]
            .data =
            approvedMonthly;

        }

        if (
          CHARTS.trend.data.datasets[2]
        ) {

          CHARTS.trend.data.datasets[2]
            .data =
            rejectedMonthly;

        }

        CHARTS.trend.update();

      }


      if (CHARTS.status) {

        const data = analyticsScope();

        CHARTS.status.data.labels = [
          'Approved',
          'Rejected',
          'Pending',
          'In Review'
        ];

        CHARTS.status.data.datasets[0].data = [
          Number(data.approved) || 0,
          Number(data.rejected) || 0,
          Number(data.pending) || 0,
          Number(data.inReview) || 0
        ];

        CHARTS.status.update();

      }


      if (CHARTS.barangay) {

        CHARTS.barangay.data.labels =
          barangayLabels;

        if (CHARTS.barangay.data.datasets[0]) {
          CHARTS.barangay.data.datasets[0].data =
            barangayTotal;
        }

        if (CHARTS.barangay.data.datasets[1]) {
          CHARTS.barangay.data.datasets[1].data =
            barangayApproved;
        }

        if (CHARTS.barangay.data.datasets[2]) {
          CHARTS.barangay.data.datasets[2].data =
            barangayPending;
        }

        CHARTS.barangay.update();

      }


      if (
        CHARTS.age
      ) {

        CHARTS.age.data.datasets[0]
          .data =
          ageDistribution;

        CHARTS.age.update();

      }


      if (
        CHARTS.issuance
      ) {

        CHARTS.issuance.data.datasets[0]
          .data =
          issuance;

        CHARTS.issuance.update();

      }


      if (
        CHARTS.processing
      ) {

        CHARTS.processing.data.datasets[0]
          .data =
          processing;

        CHARTS.processing.update();

      }
    }
  }
  updateAnalyticsHandoff(applications);
}

function updateAnalyticsHandoff(applications) {

  if (!Array.isArray(applications)) {
    return;
  }

  const total = applications.length;

  const ready = applications.filter(
    application =>
      normalizeApplicationStatus(
        application.status
      ) === 'ready'
  ).length;

  const percent =
    total > 0
      ? Math.round(
        (ready / total) * 100
      )
      : 0;

  const percentEl =
    document.getElementById(
      'analytics-handoff-percent'
    );

  const titleEl =
    document.getElementById(
      'analytics-handoff-title'
    );

  const descriptionEl =
    document.getElementById(
      'analytics-handoff-description'
    );

  if (percentEl) {
    percentEl.textContent =
      `${percent}%`;
    percentEl.closest('.analytics-handoff__ring')?.style.setProperty(
      '--handoff-progress',
      `${percent}%`
    );
  }

  if (titleEl) {
    titleEl.textContent =
      ready > 0
        ? `${ready} application${ready === 1 ? '' : 's'} ready for handoff`
        : 'No handoff data yet';
  }

  if (descriptionEl) {
    descriptionEl.textContent =
      ready > 0
        ? 'Approved applications ready to move to the ID Maker queue.'
        : 'Applications marked Ready for Release will appear here.';
  }

}

// DASHBOARD QUICK SEARCH

function handleDashboardQuickSearch(query) {

  const value =
    String(query || '')
      .trim()
      .toLowerCase();

  const recentSearch =
    document.getElementById(
      'recent-submission-search'
    );

  if (recentSearch) {

    recentSearch.value =
      query || '';

    filterRecentSubmissions();

  }

}

// INITIALIZE CHARTS IF READY

if (
  typeof chartsReady !==
  'undefined' &&
  chartsReady
) {

  initAllCharts();

}


// ROLE-BASED KPI SWITCHER

function switchKPIs(role) {

  const adminStrip =
    document.querySelector(
      '.admin-kpi-strip'
    );

  const staffStrip =
    document.getElementById(
      'staff-kpi-strip'
    );


  if (
    role === 'Staff'
  ) {

    if (adminStrip) {

      adminStrip.style.display =
        'none';

    }


    if (!staffStrip) {

      const staffContainer =
        document.createElement(
          'div'
        );

      staffContainer.id =
        'staff-kpi-strip';

      staffContainer.className =
        'admin-kpi-strip';


      STAFF_KPIS.forEach(
        (kpi, index) => {

          const card =
            document.createElement(
              'div'
            );

          card.className =
            `stat-card${index === 1
              ? ' stat-card--warn'
              : ''
            }`;


          card.innerHTML = `
            <div class="stat-card__top">

              <div class="stat-card__icon-wrap iwrap-${kpi.iconWrap}">
                <i class="${kpi.icon}"></i>
              </div>

              <div class="stat-card__meta">
                <div class="stat-card__trend ${kpi.trendClass}">
                  ${kpi.trend}
                </div>
              </div>

            </div>

            <div class="stat-card__body">

              <div class="stat-card__label">
                ${kpi.label}
              </div>

              <div class="stat-card__value">
                ${kpi.value}
              </div>

              <div class="stat-card__sub">
                ${kpi.sub}
              </div>

            </div>
          `;


          staffContainer.appendChild(
            card
          );

        }
      );


      if (adminStrip) {

        adminStrip.parentNode.insertBefore(
          staffContainer,
          adminStrip.nextSibling
        );

      }

    } else {

      staffStrip.style.display =
        'grid';

    }


    document
      .querySelectorAll(
        '.admin-only-panel, .ai-panel'
      )
      .forEach(
        element => {

          element.style.display =
            'none';

        }
      );


    const roleBadge =
      document.getElementById(
        'dashboard-role-badge'
      );

    const dashboardTitle =
      document.getElementById(
        'dashboard-title'
      );


    if (roleBadge) {

      roleBadge.textContent =
        'Staff View';

    }

    if (dashboardTitle) {

      dashboardTitle.textContent =
        'Staff Dashboard';

    }


  } else if (
    role === 'ID Maker'
  ) {

    if (adminStrip) {

      adminStrip.style.display =
        'none';

    }


    const idMakerStaffStrip =
      document.getElementById(
        'staff-kpi-strip'
      );

    if (idMakerStaffStrip) {

      idMakerStaffStrip.style.display =
        'none';

    }


    document
      .querySelectorAll(
        '.admin-only-panel, .ai-panel'
      )
      .forEach(
        element => {

          element.style.display =
            'none';

        }
      );


    const idBadge =
      document.getElementById(
        'dashboard-role-badge'
      );

    const idTitle =
      document.getElementById(
        'dashboard-title'
      );


    if (idBadge) {

      idBadge.textContent =
        'ID Maker View';

    }

    if (idTitle) {

      idTitle.textContent =
        'ID Maker Dashboard';

    }


  } else {

    if (adminStrip) {

      adminStrip.style.display =
        'grid';

    }


    const staffStrip =
      document.getElementById(
        'staff-kpi-strip'
      );

    if (staffStrip) {

      staffStrip.remove();

    }


    document
      .querySelectorAll(
        '.admin-only-panel, .ai-panel'
      )
      .forEach(
        element => {

          element.style.display =
            '';

        }
      );


    const roleBadge =
      document.getElementById(
        'dashboard-role-badge'
      );

    const dashboardTitle =
      document.getElementById(
        'dashboard-title'
      );


    if (roleBadge) {

      roleBadge.textContent =
        'Admin View';

    }

    if (dashboardTitle) {

      dashboardTitle.textContent =
        'Dashboard';

    }

  }

}


// SET ROLE OVERRIDE

const originalSetRole =
  window.setRole ||
  (() => { });


window.setRole =
  function (
    role,
    silent = false
  ) {

    originalSetRole(
      role,
      silent
    );


    if (
      typeof CURRENT_ROLE !==
      'undefined'
    ) {

      switchKPIs(
        CURRENT_ROLE
      );

    }

  };


// RENDER LIVE APPLICANTS

function renderLiveApplicants(applications) {

  const tbody =
    document.getElementById(
      'applicants-tbody'
    );

  if (!tbody) {
    return;
  }

  const totalBadge =
    document.getElementById(
      'applicants-total-badge'
    );

  if (totalBadge) {
    totalBadge.textContent =
      `${applications.length.toLocaleString()} Total`;
  }


  if (
    !Array.isArray(
      applications
    ) ||
    applications.length === 0
  ) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="9"
          style="
            text-align:center;
            padding:32px;
            color:var(--text-muted);
          "
        >
          No applicants found.
        </td>
      </tr>
    `;

    const footer = document.querySelector(
      '#mod-applicants .table-footer__info'
    );

    if (footer) {
      footer.textContent = 'Showing 0 of 0 registered seniors';
    }

    return;
  }


  tbody.innerHTML =
    applications.map(
      application => {

        const appId =
          application.application_id ||
          application.id ||
          '';


        const fullName = [
          application.first_name,
          application.middle_name,
          application.surname
        ]
          .filter(Boolean)
          .join(' ')
          .trim() ||
          'Unnamed Applicant';


        const initials =
          fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
              part =>
                part
                  .charAt(0)
                  .toUpperCase()
            )
            .join('');


        const barangay =
          application.barangay_district ||
          application.barangay ||
          '—';


        const age =
          application.age ??
          '—';


        const occupation =
          application.occupation ||
          '—';


        const status =
          application.status ||
          'Pending';


        let docsHtml =
          '<span class="docs-pill">—</span>';


        if (
          typeof buildDocsStatusPill ===
          'function'
        ) {

          try {

            docsHtml =
              buildDocsStatusPill(
                application
              );

          } catch (error) {

            console.warn(
              'Unable to build document status:',
              error
            );

          }

        }


        let statusHtml =
          `<span class="status-select__label">
            ${escapeApplicationHtml(status)}
          </span>`;


        if (
          typeof buildStatusSelect ===
          'function'
        ) {

          try {

            statusHtml =
              buildStatusSelect(
                appId,
                status
              );

          } catch (error) {

            console.warn(
              'Unable to build applicant status:',
              error
            );

          }

        }


        return `
          <tr
            data-app-id="${escapeApplicationHtml(appId)}"
          >

            <td>
              <div class="applicant-cell">

                <div class="applicant-avatar" style="background:linear-gradient(135deg,#FDE68A,#D97706)">
                  ${escapeApplicationHtml(initials)}
                </div>

                <div class="applicant-info">

                  <span class="applicant-name">
                    ${escapeApplicationHtml(fullName)}
                  </span>

                  <span class="applicant-id">
                    ${escapeApplicationHtml(
          application.sex || 'Applicant'
        )}
                    ·
                    ${escapeApplicationHtml(
          String(age)
        )}
                    yrs
                  </span>

                </div>

              </div>
            </td>


            <td>
              <span class="cell-text">
                ${escapeApplicationHtml(appId)}
              </span>
            </td>


            <td>
              <span class="cell-text">
                ${escapeApplicationHtml(barangay)}
              </span>
            </td>


            <td>
              <span class="cell-text">
                ${escapeApplicationHtml(
          String(age)
        )}
              </span>
            </td>


            <td>
              <span class="cell-text">
                ${escapeApplicationHtml(
          occupation
        )}
              </span>
            </td>


            <td>
              ${renderApplicationTypePill(application)}
            </td>


            <td>
              ${docsHtml}
            </td>


            <td>
              ${statusHtml}
            </td>


            <td style="text-align:right">${buildViewAction(appId)}</td>

          </tr>
        `;

      }
    )
      .join('');

  const footer = document.querySelector(
    '#mod-applicants .table-footer__info'
  );

  if (footer) {
    footer.textContent =
      `Showing ${applications.length.toLocaleString()} of ${applications.length.toLocaleString()} applicants`;
  }

}

// Applicant summary cards calculation


function updateApplicantSummaryCards(applications) {
  if (!Array.isArray(applications)) return;

  const totalRegistered = applications.filter(application => {
    const status = String(application.status || '').trim().toLowerCase();
    return status === 'completed';
  }).length;

  const pending = applications.filter(application => {
    const status = String(application.status || '').trim().toLowerCase();
    return status === 'pending';
  }).length;

  const underReview = applications.filter(application => {
    const status = String(application.status || '').trim().toLowerCase();
    return status === 'under review';
  }).length;

  const inProcess = applications.filter(application => {
    const status = String(application.status || '').trim().toLowerCase();
    return status === 'in process';
  }).length;

  const readyForRelease = applications.filter(application => {
    const status = String(application.status || '').trim().toLowerCase();
    return status === 'ready for release';
  }).length;

  const rejected = applications.filter(application => {
    const status = String(application.status || '').trim().toLowerCase();
    return status === 'rejected';
  }).length;

  /*
   * Total Registered = COMPLETED applicants only.
   */
  const totalEl = document.getElementById('applicants-total-count');
  if (totalEl) {
    totalEl.textContent = totalRegistered.toLocaleString();
  }

  /*
   * These two old cards used statuses that do not exist
   * in the backend anymore.
   *
   * We repurpose them into useful workflow counts.
   */
  const verifiedEl = document.getElementById('applicants-verified-count');
  if (verifiedEl) {
    verifiedEl.textContent = (pending + underReview).toLocaleString();
  }

  const unverifiedEl = document.getElementById('applicants-unverified-count');
  if (unverifiedEl) {
    unverifiedEl.textContent = inProcess.toLocaleString();
  }

  const issuedEl = document.getElementById('applicants-issued-count');
  if (issuedEl) {
    issuedEl.textContent = readyForRelease.toLocaleString();
  }
}

// ESCAPE HTML

function escapeApplicationHtml(
  value
) {

  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


// RENDER RECENT SUBMISSIONS

function renderRecentSubmissions(
  applications
) {

  const tbody =
    document.getElementById(
      'recent-submissions-tbody'
    );

  if (!tbody) {
    return;
  }


  if (
    !Array.isArray(
      applications
    )
  ) {
    return;
  }

  window.STAFF_RECENT_SUBMISSIONS = applications.slice();

  const searchQuery = (document.getElementById('recent-submission-search')?.value || '')
    .trim()
    .toLowerCase();
  const selectedBarangays = new Set(
    Array.from(document.getElementById('recent-barangay-filter')?.selectedOptions || [])
      .map(option => String(option.value || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const matchingApplications = applications
    .filter(application => {
      const fullName = [
        application.first_name,
        application.middle_name,
        application.surname
      ].filter(Boolean).join(' ').trim();
      const barangay = application.barangay_district || application.barangay || '—';
      const status = application.status || 'Pending';
      const submittedAt = application.created_at || application.submitted_at || application.date_submitted;
      const submittedDate = submittedAt ? new Date(submittedAt) : null;
      const formattedDate = submittedDate && !Number.isNaN(submittedDate.getTime())
        ? submittedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      const searchableText = `${fullName} ${formattedDate} ${barangay} ${status}`.toLowerCase();

      return (!searchQuery || searchableText.includes(searchQuery)) &&
        (!selectedBarangays.size || selectedBarangays.has(String(barangay).trim().toLowerCase()));
    })
    .sort(
        (a, b) => {
          const dateValue = application => {
            const value = application.created_at || application.submitted_at || application.date_submitted;
            const timestamp = value ? new Date(value).getTime() : 0;
            return Number.isFinite(timestamp) ? timestamp : 0;
          };
          return dateValue(b) - dateValue(a);
        }
      );
  const recentApplications = matchingApplications.slice(0, 5);


  if (
    !recentApplications.length
  ) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          style="
            text-align:center;
            padding:24px;
            color:var(--text-muted);
          "
        >
          ${searchQuery || selectedBarangays.size ? 'No matching submissions found.' : 'No recent submissions found.'}
        </td>
      </tr>
    `;

  } else {

    tbody.innerHTML =
      recentApplications
        .map(
          application => {

            const appId =
              application.application_id ||
              application.id ||
              '';

            const fullName = [
              application.first_name,
              application.middle_name,
              application.surname
            ]
              .filter(Boolean)
              .join(' ')
              .trim() ||
              'Unnamed Applicant';


            const barangay =
              application.barangay_district ||
              application.barangay ||
              '—';


            const createdAt =
              application.created_at ||
              application.submitted_at ||
              null;


            let formattedDate =
              '—';


            if (createdAt) {

              const date =
                new Date(
                  createdAt
                );

              if (
                !Number.isNaN(
                  date.getTime()
                )
              ) {

                formattedDate =
                  date.toLocaleDateString(
                    'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }
                  );

              }

            }


            const status =
              application.status ||
              'Pending';
            const normalizedStatus = normalizeApplicationStatus(status)
              .replace(/[^a-z0-9]+/g, '-');


            return `
              <tr data-app-id="${escapeApplicationHtml(appId)}" data-status="${escapeApplicationHtml(status)}">

                <td>
                  <span class="cell-text">
                    ${escapeApplicationHtml(
              fullName
            )}
                  </span>
                </td>

                <td>
                  <span class="cell-text">
                    ${escapeApplicationHtml(
              formattedDate
            )}
                  </span>
                </td>

                <td>
                  <span class="cell-text">
                    ${escapeApplicationHtml(
              barangay
            )}
                  </span>
                </td>

                <td>
                  <span class="recent-submission-status recent-submission-status--${escapeApplicationHtml(normalizedStatus)}">
                    ${escapeApplicationHtml(
              status
            )}
                  </span>
                </td>

                <td style="text-align:right">${buildViewAction(appId)}</td>

              </tr>
            `;

          }
        )
        .join('');

  }


  // UPDATE RECENT SUBMISSIONS FOOTER

  const cards =
    document.querySelectorAll(
      '.data-table-card'
    );

  cards.forEach(
    card => {

      const title =
        card
          .querySelector(
            '.table-header__title'
          )
          ?.textContent
          ?.trim();

      if (
        title !==
        'Recent Submissions'
      ) {
        return;
      }

      const footer =
        card.querySelector(
          '.table-footer__info'
        );

      if (!footer) {
        return;
      }

      footer.textContent = searchQuery || selectedBarangays.size
        ? `Showing ${recentApplications.length} of ${matchingApplications.length} matching submissions`
        : `Showing ${recentApplications.length} latest submissions`;

    }
  );

}

// ============================================================
// STAFF DASHBOARD LOADING STATE
// ============================================================

function setStaffDashboardLoading(isLoading) {

  const strip =
    document.getElementById(
      'staff-kpi-strip'
    );

  if (strip) {

    strip.classList.toggle(
      'is-loading',
      Boolean(isLoading)
    );

  }


  const tbody =
    document.getElementById(
      'recent-submissions-tbody'
    );


  if (!tbody) return;

  if (isLoading) {
    if (typeof Skeleton !== 'undefined') {
      Skeleton.setTable('recent-submissions-tbody', 5);
    }
    return;
  }

  // Successful loads replace the skeleton in renderRecentSubmissions(). If
  // loading failed or returned invalid data, clear the busy state with a
  // useful message instead of leaving the skeleton spinning forever.
  if (tbody.querySelector('.sk-row')) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">
          Recent submissions could not be loaded.
        </td>
      </tr>
    `;
    if (typeof Skeleton !== 'undefined') {
      Skeleton.clearBusy('recent-submissions-tbody');
    }
  }

}

// LOAD APPLICATIONS FROM DATABASE

async function loadApplicationsFromDatabase() {

  // Show loading state
  if (typeof Skeleton !== 'undefined' && typeof Skeleton.setAllKpisLoading === 'function') {
    Skeleton.setAllKpisLoading(true);
  } else {
    setStaffDashboardLoading(true);
  }
  document.querySelectorAll('.data-table-card, .content-card').forEach(el => el.setAttribute('aria-busy', 'true'));
  document.querySelectorAll('.admin-kpi-strip, .cards-grid, .analytics-hero__stats, .stat-card, .analytics-kpi, .chart-card, .donut-card').forEach(el => el.classList.add('is-loading'));

  try {

    console.log(
      "Loading applications from backend..."
    );


    // --------------------------------------------------------
    // FETCH APPLICATIONS
    // --------------------------------------------------------

    const response =
      await fetch(
        "https://management-backend-3cij.onrender.com/api/applications",
        {
          method: "GET",

          headers: getAuthHeaders()
        }
      );


    console.log(
      "API response status:",
      response.status
    );


    // --------------------------------------------------------
    // CHECK RESPONSE
    // --------------------------------------------------------

    if (!response.ok) {

      throw new Error(
        `API request failed with status ${response.status}`
      );

    }


    // --------------------------------------------------------
    // READ JSON
    // --------------------------------------------------------

    const result =
      await response.json();


    console.log(
      "API result:",
      result
    );


    if (!result.success) {

      throw new Error(
        result.message ||
        "Backend returned success:false"
      );

    }


    // --------------------------------------------------------
    // GET APPLICATION ARRAY
    // --------------------------------------------------------

    const applications =
      Array.isArray(
        result.applications
      )
        ? result.applications
        : [];


    console.log(
      "Applications loaded successfully:",
      applications.length
    );


    // --------------------------------------------------------
    // SAVE LIVE APPLICATIONS
    // --------------------------------------------------------

    LIVE_APPLICATIONS =
      applications;


    // --------------------------------------------------------
    // SYNC APPLICATIONS TO APP DB
    // --------------------------------------------------------

    if (
      typeof syncApplicationsToAppDB ===
      'function'
    ) {

      syncApplicationsToAppDB(
        applications
      );

    }


    // --------------------------------------------------------
    // UPDATE LIVE ANALYTICS DATA
    // --------------------------------------------------------

    if (
      typeof updateLiveAnalyticsData ===
      "function"
    ) {

      updateLiveAnalyticsData(
        applications
      );

    }


    // --------------------------------------------------------
    // UPDATE DASHBOARD VISUALS
    // --------------------------------------------------------

    if (
      typeof updateLiveDashboardVisuals ===
      "function"
    ) {

      updateLiveDashboardVisuals(
        applications
      );

    }


    // --------------------------------------------------------
    // UPDATE ANALYTICS CHART DATA
    // --------------------------------------------------------

    if (
      typeof updateLiveAnalyticsCharts ===
      "function"
    ) {

      applyAnalyticsDateRange();

      if (typeof requestStaffAnalyticsInsights === "function") {
        scheduleStaffAnalyticsInsights(applications, "applications");
      }

    }


    // --------------------------------------------------------
    // UPDATE APPLICANTS TABLE
    // --------------------------------------------------------

    if (
      typeof renderLiveApplicants ===
      "function"
    ) {

      renderLiveApplicants(
        applications
      );

    }


    // --------------------------------------------------------
    // UPDATE APPLICANT SUMMARY CARDS
    // --------------------------------------------------------

    if (
      typeof updateApplicantSummaryCards ===
      "function"
    ) {

      updateApplicantSummaryCards(
        applications
      );

    }


    // --------------------------------------------------------
    // UPDATE RECENT SUBMISSIONS
    // --------------------------------------------------------

    if (
      typeof renderRecentSubmissions ===
      "function"
    ) {

      renderRecentSubmissions(
        applications
      );

    }


    // --------------------------------------------------------
    // UPDATE APPLICATIONS TABLE
    // --------------------------------------------------------

    if (
      typeof renderLiveApplications ===
      "function"
    ) {

      renderLiveApplications(
        applications
      );

    }


    // --------------------------------------------------------
    // RETURN DATA
    // --------------------------------------------------------

    return applications;


  } catch (error) {

    console.error(
      "ERROR LOADING APPLICATIONS:",
      error
    );


    console.error(
      "Make sure the backend is running at:",
      "https://management-backend-3cij.onrender.com"
    );


    // Show user-friendly message
    if (
      typeof showToast ===
      "function"
    ) {

      showToast(
        "Failed to load applications. Please try again.",
        "error"
      );

    }


    return [];


  } finally {

    // Always remove loading state,
    // whether loading succeeded or failed.
    if (typeof Skeleton !== 'undefined' && typeof Skeleton.setAllKpisLoading === 'function') {
      Skeleton.setAllKpisLoading(false);
    } else {
      setStaffDashboardLoading(false);
    }
    document.querySelectorAll('.data-table-card, .content-card').forEach(el => el.removeAttribute('aria-busy'));
    document.querySelectorAll('.admin-kpi-strip, .cards-grid, .analytics-hero__stats, .stat-card, .analytics-kpi, .chart-card, .donut-card').forEach(el => el.classList.remove('is-loading'));
    if (typeof Skeleton !== 'undefined' && typeof Skeleton.clearBusy === 'function') {
      Skeleton.clearBusy('recent-apps-tbody');
      Skeleton.clearBusy('recent-submissions-tbody');
    }

  }

}


// APPLICATION DETAILS

async function loadApplicationDetails(
  applicationId
) {

  try {

    const response =
      await fetch(
        `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(
          applicationId
        )}`,
        { headers: getAuthHeaders() }
      );


    if (!response.ok) {

      throw new Error(
        "Failed to fetch application details"
      );

    }


    const result =
      await response.json();


    if (!result.success) {

      throw new Error(
        result.message ||
        "Failed to load application details"
      );

    }


    console.log(
      "Complete application details:",
      result
    );


    return result;


  } catch (error) {

    console.error(
      "Error loading application details:",
      error
    );


    if (
      typeof showToast ===
      "function"
    ) {

      showToast(
        "Failed to load application details.",
        "error"
      );

    }


    return null;

  }

}


// AUTO INITIALIZATION

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "Staff dashboard loaded."
    );

    // INITIALIZE ROLE
    if (
      typeof CURRENT_ROLE !== 'undefined' &&
      CURRENT_ROLE
    ) {

      switchKPIs(
        CURRENT_ROLE
      );

    }

    // INITIALIZE BARANGAY YEAR FILTER
    initializeBarangayYearFilter();

    // INITIALIZE ANALYTICS CHARTS
    if (
      typeof initAllCharts === "function"
    ) {

      initAllCharts();

    }

    // LOAD APPLICATIONS
    if (typeof loadApplicationsFromDatabase === 'function') {
      loadApplicationsFromDatabase();
    }

    // Load replacement requests independently of the applications request.
    if (typeof loadReplacementRequests === 'function') {
      loadReplacementRequests();
    }

  }
  
);

// Registry view helpers: group request rows into one profile per senior.
var STAFF_APPLICANT_PROFILES = [];
var APPLICANTS_SORT_STATE = (() => {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  if (sort === 'oldest') return { mode: 'oldest', key: 'registration', direction: 'asc' };
  if (sort === 'name-az') return { mode: 'name-az', key: 'name', direction: 'asc' };
  if (sort === 'name-za') return { mode: 'name-za', key: 'name', direction: 'desc' };
  if (sort === 'custom') return {
    mode: 'custom',
    key: 'barangay',
    direction: params.get('order') === 'desc' ? 'desc' : 'asc'
  };
  return { mode: 'latest', key: 'registration', direction: 'desc' };
})();
var APPLICATIONS_FILTER_STATE = { search: '', barangay: [], type: 'all', status: [] };

function getApplicationName(application) {
  return [application.first_name, application.middle_name, application.surname]
    .filter(Boolean).join(' ').trim() || application.full_name || application.name || 'Unnamed Applicant';
}

function getApplicationSubmittedDate(application) {
  return application.created_at || application.submitted_at || application.date_submitted || null;
}

function formatStaffDate(value) {
  const date = value instanceof Date ? value : (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
}

function normalizeProfileIdentity(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function getProfileIdentityKey(application, fallbackIndex) {
  const name = normalizeProfileIdentity(getApplicationName(application));
  const dobValue = application.date_of_birth || application.dob || '';
  const dobDate = dobValue ? new Date(dobValue) : null;
  const dob = dobDate && !Number.isNaN(dobDate.getTime())
    ? dobDate.toISOString().slice(0, 10) : normalizeProfileIdentity(dobValue);
  if (name && dob) return 'person:' + name + '|' + dob;
  const seniorId = application.osca_id_number || application.senior_citizen_id || application.id_number;
  if (seniorId) return 'id:' + normalizeProfileIdentity(seniorId);
  return 'application:' + String(application.application_id || application.id || fallbackIndex);
}

function isProfileDuplicateFlagged(application) {
  const duplicate = application.duplicate;
  const risk = application.duplicate_risk;
  return duplicate === true || Boolean(duplicate && typeof duplicate === 'object') ||
    Boolean(risk && Number(risk.score || 0) >= 0.8);
}

function buildApplicantProfiles(applications) {
  const groups = new Map();
  (Array.isArray(applications) ? applications : []).forEach((application, index) => {
    const key = getProfileIdentityKey(application, index);
    if (!groups.has(key)) groups.set(key, { key, applications: [] });
    groups.get(key).applications.push(application);
  });

  return Array.from(groups.values()).map(profile => {
    profile.applications.sort((a, b) =>
      (new Date(getApplicationSubmittedDate(b) || 0).getTime() || 0) -
      (new Date(getApplicationSubmittedDate(a) || 0).getTime() || 0));
    profile.latestApplication = profile.applications[0];
    profile.name = getApplicationName(profile.latestApplication);
    const dobValue = profile.latestApplication.date_of_birth || profile.latestApplication.dob || '';
    const dobDate = dobValue ? new Date(dobValue) : null;
    profile.nameDobKey = dobValue
      ? normalizeProfileIdentity(profile.name) + '|' +
      (dobDate && !Number.isNaN(dobDate.getTime()) ? dobDate.toISOString().slice(0, 10) : normalizeProfileIdentity(dobValue))
      : '';
    const addressRecord = profile.applications.find(a => a.barangay_district || a.barangay) || {};
    profile.barangay = addressRecord.barangay_district || addressRecord.barangay || '';
    const birthDateValue = profile.latestApplication.date_of_birth || profile.latestApplication.dob;
    let calculatedAge = null;
    if (birthDateValue) {
      const birthDate = new Date(birthDateValue);
      if (!Number.isNaN(birthDate.getTime())) {
        const today = new Date();
        calculatedAge = today.getFullYear() - birthDate.getFullYear();
        if (today.getMonth() < birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) calculatedAge--;
      }
    }
    profile.age = profile.latestApplication.age ?? calculatedAge ?? '—';
    const idRecord = profile.applications.find(a => a.application_id || a.id || a.osca_id_number || a.senior_citizen_id || a.id_number);
    profile.seniorId = idRecord && (idRecord.application_id || idRecord.id || idRecord.osca_id_number || idRecord.senior_citizen_id || idRecord.id_number) || '';
    profile.completedApplications = profile.applications.filter(a => normalizeApplicationStatus(a.status) === 'completed');
    profile.ongoingApplications = profile.applications.filter(a =>
      !['completed', 'rejected'].includes(normalizeApplicationStatus(a.status)));
    profile.isRegistered = profile.completedApplications.length > 0;
    const registeredDates = profile.completedApplications.map(a => new Date(a.status_updated_at || a.updated_at || a.created_at || 0))
      .filter(date => !Number.isNaN(date.getTime()) && date.getTime() > 0).sort((a, b) => a - b);
    profile.registeredAt = registeredDates[0] || null;
    // Applicants module shows registered citizens only. Use their newest completed record.
    if (profile.isRegistered) profile.latestApplication = profile.completedApplications[0];
    profile.isActive = profile.ongoingApplications.length > 0;
    profile.hasDuplicateFlag = profile.applications.some(isProfileDuplicateFlagged);
    profile.status = profile.isRegistered ? 'Registered' : 'Rejected';
    return profile;
  });
}

function getProfileStatusClass(status) {
  if (status === 'Completed') return 'badge-issued';
  const normalized = normalizeApplicationStatus(status);
  if (normalized === 'rejected') return 'badge-rejected';
  if (normalized === 'review') return 'badge-review';
  if (normalized === 'pending') return 'badge-pending';
  return 'badge-approved';
}

function renderLiveApplicants(applications) {
  const tbody = document.getElementById('applicants-tbody');
  if (!tbody) return;
  // The Applicants module is the directory of registered senior citizens only.
  const allProfiles = buildApplicantProfiles(applications);
  STAFF_APPLICANT_PROFILES = allProfiles.filter(profile => profile.isRegistered);
  const profiles = STAFF_APPLICANT_PROFILES;
  const badge = document.getElementById('applicants-total-badge');
  if (badge) badge.textContent = profiles.length.toLocaleString() + ' Registered Profiles';
  // The sidebar badge remains the count of ongoing applications (all except Completed and Rejected).
  const sidebarBadge = document.getElementById('applicants-sidebar-count');
  const ongoingApplicationCount = allProfiles.reduce((count, profile) =>
    count + profile.ongoingApplications.length, 0);
  if (sidebarBadge) sidebarBadge.textContent = ongoingApplicationCount.toLocaleString();
  if (!profiles.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No registered senior citizens found.</td></tr>';
    if (typeof Skeleton !== 'undefined') Skeleton.clearBusy('applicants-tbody');
    const footer = document.querySelector('#mod-applicants .table-footer__info');
    if (footer) footer.textContent = 'Showing 0 of 0 applicants';
    return;
  }

  tbody.innerHTML = profiles.map((profile, index) => {
    const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
    const status = String(profile.status || 'Pending');
    const ids = profile.applications.map(a => a.application_id || a.id || '').join(' ');
    const searchText = [profile.name, profile.seniorId, profile.barangay, ids].join(' ').toLowerCase();
    return `<tr data-profile-index="${index}" data-status="${escapeApplicationHtml(status.toLowerCase())}"
      data-barangay="${escapeApplicationHtml(profile.barangay.toLowerCase())}" data-name="${escapeApplicationHtml(profile.name || '')}"
      data-sort-id="${escapeApplicationHtml(profile.seniorId || profile.key || '')}" data-registered-at="${profile.registeredAt ? profile.registeredAt.getTime() : 0}" data-search="${escapeApplicationHtml(searchText)}">
      <td><div class="applicant-cell"><div class="applicant-avatar">${escapeApplicationHtml(initials)}</div><div class="applicant-info">
        <span class="applicant-name">${escapeApplicationHtml(profile.name)}</span><span class="applicant-id">${profile.applications.length} linked request${profile.applications.length === 1 ? '' : 's'}</span></div></div></td>
      <td><span class="cell-text">${escapeApplicationHtml(profile.seniorId || '—')}</span>${profile.seniorId ? ` <button type="button" class="applicant-id-copy" data-copy-id="${escapeApplicationHtml(profile.seniorId)}" aria-label="Copy application ID ${escapeApplicationHtml(profile.seniorId)}" title="Copy application ID" onclick="copyApplicantApplicationId(this)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg></button>` : ''}</td>
      <td><span class="cell-text">${escapeApplicationHtml(profile.barangay || '—')}</span></td>
      <td><span class="cell-text">${escapeApplicationHtml(String(profile.age))}</span></td>
      <td><span class="cell-text">${profile.registeredAt ? escapeApplicationHtml(formatStaffDate(profile.registeredAt)) : '—'}</span></td>
      <td><span class="badge ${getProfileStatusClass(status)}"><span class="status-select__label">${escapeApplicationHtml(status)}</span></span></td>
      <td style="text-align:right"><button type="button" class="row-action always-visible" onclick="openApplicantProfile(${index})">View Profile</button></td>
    </tr>`;
  }).join('');
  if (typeof Skeleton !== 'undefined') Skeleton.clearBusy('applicants-tbody');
  applyApplicantsFilters();
}

function applyApplicantsFilters() {
  const tbody = document.getElementById('applicants-tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr[data-profile-index]'));
  const search = String(APPLICANTS_FILTER_STATE.search || '').trim().toLowerCase();
  const barangays = Array.isArray(APPLICANTS_FILTER_STATE.barangay)
    ? APPLICANTS_FILTER_STATE.barangay.map(value => String(value).trim().toLowerCase())
    : [];
  const statuses = Array.isArray(APPLICANTS_FILTER_STATE.status)
    ? APPLICANTS_FILTER_STATE.status.map(value => String(value).trim().toLowerCase())
    : [];
  const matchingRows = rows.filter(row => {
    const rowBarangay = String(row.dataset.barangay || '').trim().toLowerCase();
    const rowStatus = String(row.dataset.status || '').trim().toLowerCase();
    return (!search || (row.dataset.search || row.textContent).toLowerCase().includes(search)) &&
      (!barangays.length || barangays.includes(rowBarangay)) &&
      (!statuses.length || statuses.includes(rowStatus));
  });
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const compareIds = (a, b) => collator.compare(
    String(a.dataset.sortId || ''),
    String(b.dataset.sortId || '')
  );
  const compareStable = (a, b) => compareIds(a, b) ||
    Number(a.dataset.profileIndex) - Number(b.dataset.profileIndex);
  const orderedRows = rows.slice().sort((a, b) => {
    let comparison = 0;
    if (APPLICANTS_SORT_STATE.key === 'registration') {
      comparison = Number(a.dataset.registeredAt || 0) - Number(b.dataset.registeredAt || 0);
    } else if (APPLICANTS_SORT_STATE.key === 'name') {
      comparison = collator.compare(String(a.dataset.name || '').trim(), String(b.dataset.name || '').trim());
    } else {
      comparison = collator.compare(String(a.dataset.barangay || '').trim(), String(b.dataset.barangay || '').trim());
    }

    if (APPLICANTS_SORT_STATE.direction === 'desc') comparison *= -1;
    if (comparison) return comparison;

    if (APPLICANTS_SORT_STATE.key === 'name') {
      const byRegistrationDate = Number(b.dataset.registeredAt || 0) - Number(a.dataset.registeredAt || 0);
      if (byRegistrationDate) return byRegistrationDate;
    }
    return compareStable(a, b);
  });
  const matchingSet = new Set(matchingRows);
  orderedRows.forEach(row => {
    row.style.display = matchingSet.has(row) ? '' : 'none';
    tbody.appendChild(row);
  });

  const visible = matchingRows.length;
  const footer = document.querySelector('#mod-applicants .table-footer__info');
  if (footer) footer.textContent = `Showing ${visible.toLocaleString()} of ${rows.length.toLocaleString()} registered seniors`;
}

function filterRegisteredApplicantsByBarangay(control) {
  APPLICANTS_FILTER_STATE.barangay = control?.value
    ? [String(control.value).trim().toLowerCase()]
    : [];
  applyApplicantsFilters();
}

function resetRegisteredApplicantFilters() {
  const search = document.getElementById('applicant-search');
  const barangay = document.getElementById('applicants-barangay-filter');
  if (search) search.value = '';
  if (barangay) barangay.value = '';
  APPLICANTS_FILTER_STATE.search = '';
  APPLICANTS_FILTER_STATE.barangay = [];
  APPLICANTS_FILTER_STATE.status = [];
  applyApplicantsFilters();
}

function updateApplicantsSortUI() {
  const select = document.getElementById('applicants-sort-select');
  if (select) select.value = APPLICANTS_SORT_STATE.mode;

  const headers = [
    { key: 'name', element: document.querySelector('#mod-applicants thead th:nth-child(1)') },
    { key: 'barangay', element: document.querySelector('#mod-applicants thead th:nth-child(3)') },
    { key: 'registration', element: document.querySelector('#mod-applicants thead th:nth-child(5)') }
  ];
  headers.forEach(({ key, element }) => {
    if (!element) return;
    const icon = element.querySelector('.sort-icon');
    const active = APPLICANTS_SORT_STATE.key === key;
    if (icon) icon.textContent = active ? (APPLICANTS_SORT_STATE.direction === 'asc' ? '↑' : '↓') : '↕';
    element.setAttribute('aria-sort', active
      ? (APPLICANTS_SORT_STATE.direction === 'asc' ? 'ascending' : 'descending')
      : 'none');
  });
}

function persistApplicantsSort() {
  const url = new URL(window.location.href);
  url.searchParams.set('sort', APPLICANTS_SORT_STATE.mode);
  if (APPLICANTS_SORT_STATE.mode === 'custom') {
    url.searchParams.set('order', APPLICANTS_SORT_STATE.direction);
  } else {
    url.searchParams.delete('order');
  }
  window.history.replaceState(null, '', url);
}

function changeApplicantsSort(mode) {
  const modes = {
    latest: { key: 'registration', direction: 'desc' },
    oldest: { key: 'registration', direction: 'asc' },
    'name-az': { key: 'name', direction: 'asc' },
    'name-za': { key: 'name', direction: 'desc' }
  };
  if (!modes[mode]) return;
  APPLICANTS_SORT_STATE = { mode, ...modes[mode] };
  persistApplicantsSort();
  updateApplicantsSortUI();
  applyApplicantsFilters();
}

function sortApplicantsByColumn(key) {
  if (!['name', 'barangay', 'registration'].includes(key)) return;
  const isSameSort = APPLICANTS_SORT_STATE.key === key;
  const direction = isSameSort
    ? (APPLICANTS_SORT_STATE.direction === 'desc' ? 'asc' : 'desc')
    : (key === 'registration' ? 'desc' : 'asc');
  const mode = key === 'registration'
    ? (direction === 'desc' ? 'latest' : 'oldest')
    : key === 'name'
      ? (direction === 'asc' ? 'name-az' : 'name-za')
      : 'custom';
  APPLICANTS_SORT_STATE = { mode, key, direction };
  persistApplicantsSort();
  updateApplicantsSortUI();
  applyApplicantsFilters();
}

updateApplicantsSortUI();
function getProfileStatusPillClass(status) {
  const norm = String(status || '').trim().toLowerCase();
  if (/issued|complete|verified|approved|ready/.test(norm)) {
    return 'status-pill--success';
  }
  if (/reject|cancel|deni/.test(norm)) {
    return 'status-pill--danger';
  }
  if (/review|process|transit|in progress/.test(norm)) {
    return 'status-pill--info';
  }
  return 'status-pill--pending';
}

async function copyApplicantApplicationId(button) {
  const applicationId = button?.dataset.copyId;
  if (!applicationId) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(applicationId);
    } else {
      const input = document.createElement('textarea');
      input.value = applicationId;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('Clipboard access is unavailable.');
    }

    button.classList.add('is-copied');
    button.title = 'Copied!';
    button.setAttribute('aria-label', `Copied application ID ${applicationId}`);
    if (typeof showToast === 'function') showToast(`Copied ${applicationId}`, 'success');
    window.setTimeout(() => {
      button.classList.remove('is-copied');
      button.title = 'Copy application ID';
      button.setAttribute('aria-label', `Copy application ID ${applicationId}`);
    }, 1600);
  } catch (error) {
    console.error('Failed to copy applicant application ID:', error);
    if (typeof showToast === 'function') showToast('Could not copy the application ID.', 'error');
  }
}

function openApplicantProfile(index) {
  const profile = STAFF_APPLICANT_PROFILES[index];
  if (!profile) return;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || '—'; };
  const appsCount = Array.isArray(profile.applications) ? profile.applications.length : 0;

  setText('applicant-profile-title', profile.name);
  setText('applicant-profile-sub', `${appsCount} linked application${appsCount === 1 ? '' : 's'}`);
  setText('applicant-profile-name', profile.name);
  setText('applicant-profile-id', profile.seniorId || '—');
  setText('applicant-profile-barangay', profile.barangay || '—');

  let ageDisplay = '—';
  if (profile.age !== null && profile.age !== undefined && profile.age !== '—' && profile.age !== '') {
    ageDisplay = String(profile.age).toLowerCase().includes('year') ? String(profile.age) : `${profile.age} years`;
  }
  setText('applicant-profile-age', ageDisplay);
  setText('applicant-profile-registration-date', formatStaffDate(profile.registeredAt));

  const statusStr = profile.status || 'Pending';
  const statusPillCls = getProfileStatusPillClass(statusStr);
  const statusWrap = document.getElementById('applicant-profile-status-wrap');
  if (statusWrap) {
    statusWrap.innerHTML = `
      <span class="profile-status-pill ${statusPillCls}" id="applicant-profile-status-pill">
        <span class="status-dot"></span>
        <span id="applicant-profile-status">${escapeApplicationHtml(statusStr)}</span>
      </span>`;
  } else {
    setText('applicant-profile-status', statusStr);
  }

  const countEl = document.getElementById('applicant-profile-history-count');
  if (countEl) countEl.textContent = `${appsCount} record${appsCount === 1 ? '' : 's'}`;

  const history = document.getElementById('applicant-profile-history-list');
  if (history) {
    if (!profile.applications || profile.applications.length === 0) {
      history.innerHTML = `
        <div class="applicant-profile-history-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <p>No application history records found.</p>
        </div>`;
    } else {
      history.innerHTML = profile.applications.map(application => {
        const id = application.application_id || application.id || '—';
        const type = getApplicationRequestType(application);
        const itemStatus = application.status || 'Pending';
        const itemPillCls = getProfileStatusPillClass(itemStatus);
        const submittedDate = getApplicationSubmittedDate(application);
        const dateFormatted = formatStaffDate(submittedDate);

        return `
          <div class="applicant-profile-history__item">
            <div class="applicant-profile-history__meta">
              <span class="applicant-profile-history__id">${escapeApplicationHtml(id)}</span>
              <span class="applicant-profile-history__type">${escapeApplicationHtml(type)}</span>
              <span class="applicant-profile-history__sep" aria-hidden="true">|</span>
              <span class="applicant-profile-history__date">${escapeApplicationHtml(dateFormatted)}</span>
              <span class="profile-status-pill profile-status-pill--sm ${itemPillCls}">
                <span class="status-dot"></span>
                ${escapeApplicationHtml(itemStatus)}
              </span>
            </div>
            <button type="button" class="applicant-profile-history__btn" data-app-id="${escapeApplicationHtml(id)}" onclick="openLinkedApplication(this)">
              <span>View request</span>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
          </div>`;
      }).join('');
    }
  }

  document.getElementById('applicant-profile-modal')?.classList.add('show');
}

function closeApplicantProfile() { 
  document.getElementById('applicant-profile-modal')?.classList.remove('show'); 
}
window.closeApplicantProfile = closeApplicantProfile;
window.openApplicantProfile = openApplicantProfile;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('applicant-profile-modal');
    if (modal && modal.classList.contains('show')) {
      closeApplicantProfile();
    }
  }
});

function openLinkedApplication(button) {
  const id = button?.dataset.appId;
  if (!id) return;
  closeApplicantProfile();
  openApplicationDetail(id);
}

function getApplicationRequestType(application) {
  if (!application) return 'Unspecified';

  const typeFields = [
    application.request_category,
    application.request_kind,
    application.request_type,
    application.application_type,
    application.applicationType,
    application.type,
    application.request_for,
    application.id_request_type
  ];

  for (const value of typeFields) {
    if (
      value === null ||
      value === undefined ||
      !String(value).trim()
    ) {
      continue;
    }

    const normalized = String(value)
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ');

    if (
      /\b(id|card)\s*request\b|\brequest\s*(for\s*)?(an?\s*)?(id|card)\b|\brenewal\b|\breissuance\b/.test(normalized)
    ) {
      return 'ID Request';
    }

    if (/replace|replacement/.test(normalized)) {
      return 'Replacement';
    }

    if (/first|new application|^new$/.test(normalized)) {
      return 'New';
    }

    return String(value).trim();
  }

  // Do not guess the request type from the application ID.
  return 'Unspecified';
}

function renderApplicationTypePill(application) {
  const type = getApplicationRequestType(application);
  if (application && typeof application === 'object') {
    application.applicationType = type;
    application.application_type = type;
    application.request_type = type;
  }
  const isReplacement = type === 'Replacement';
  const cls = isReplacement ? 'app-type-pill app-type-pill--replacement' : 'app-type-pill app-type-pill--first';
  const icon = isReplacement ? '↻' : '★';
  const tip = isReplacement ? 'Replacement — ₱50 fee required upon claiming' : 'New Application — no fee required';
  return `<span class="${cls}" title="${escapeApplicationHtml(tip)}">${icon} ${escapeApplicationHtml(type)}</span>`;
}

function getApplicationDaysPending(application) {
  const status = normalizeApplicationStatus(application.status);
  if (status === 'completed' || status === 'rejected') return null;
  if (application.days_pending !== null && application.days_pending !== undefined && application.days_pending !== '' && Number.isFinite(Number(application.days_pending))) {
    return Math.max(0, Number(application.days_pending));
  }
  const submitted = getApplicationSubmittedDate(application);
  const date = submitted ? new Date(submitted) : null;
  return date && !Number.isNaN(date.getTime()) ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000)) : null;
}

async function updateMembershipStatus(applicationId, newStatus, selectEl) {
  if (!applicationId) return;

  const previousValue = selectEl ? selectEl.dataset.previousValue || '' : '';

  try {
    const response = await fetch(
      `https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(applicationId)}/membership-status`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ membership_status: newStatus })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to update membership status');
    }

    if (selectEl) {
      const savedStatus = result.membership_status || newStatus;
      setMembershipSelectValue(selectEl, savedStatus);
      selectEl.dataset.previousValue = savedStatus;
    }
    if (typeof showToast === 'function') {
      showToast(`Membership status updated to ${newStatus}`, 'success');
    }
  } catch (error) {
    console.error('Error updating membership status:', error);
    if (selectEl) setMembershipSelectValue(selectEl, previousValue);
    if (typeof showToast === 'function') {
      showToast(error.message || 'Unable to update membership status', 'error');
    } else {
      alert(error.message || 'Unable to update membership status');
    }
  }
}
window.updateMembershipStatus = updateMembershipStatus;

const MEMBERSHIP_CONFIG = {
  'Active': {
    icon: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>',
    color: '#059669'
  },
  'Deceased': {
    icon: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>',
    color: '#64748b'
  },
  '': {
    icon: '<circle cx="10" cy="10" r="4.5"/>',
    color: '#94a3b8'
  }
};

function buildMembershipSelect(appId, membershipStatus) {
  const normalizedStatus = String(membershipStatus || '').trim().toLowerCase();
  const current = normalizedStatus === 'active' ? 'Active' : (normalizedStatus === 'deceased' ? 'Deceased' : '');
  const displayLabel = current || 'Select status';
  const cfg = MEMBERSHIP_CONFIG[current] || MEMBERSHIP_CONFIG[''];

  const options = ['Active', 'Deceased'].map(opt => {
    const optCfg = MEMBERSHIP_CONFIG[opt];
    const activeCls = opt === current ? ' active' : '';
    return `<button type="button" class="status-select__option${activeCls}" data-membership="${opt}" data-color="${optCfg.color}" onclick="selectMembershipOption(this, event)">
      <span class="status-select__option-icon" style="color:${optCfg.color}">
        <svg viewBox="0 0 20 20" fill="currentColor">${optCfg.icon}</svg>
      </span>
      <span>${opt}</span>
    </button>`;
  }).join('');

  return `<div class="status-select membership-select" data-app-id="${escapeApplicationHtml(appId)}" data-previous-value="${escapeApplicationHtml(current)}">
    <button type="button" class="status-select__trigger membership-select__trigger" onclick="toggleMembershipSelect(this, event)" aria-label="Membership status: ${escapeApplicationHtml(displayLabel)}">
      <span class="status-select__icon" style="color:${cfg.color}">
        <svg viewBox="0 0 20 20" fill="currentColor">${cfg.icon}</svg>
      </span>
      <span class="status-select__label">${escapeApplicationHtml(displayLabel)}</span>
      <svg class="status-select__arrow" viewBox="0 0 12 12" fill="currentColor"><path d="M3 4l3 3 3-3"/></svg>
    </button>
    <div class="status-select__menu membership-select__menu">
      ${options}
    </div>
  </div>`;
}

function setMembershipSelectValue(root, status) {
  if (!root) return;
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const value = normalizedStatus === 'active' ? 'Active' : (normalizedStatus === 'deceased' ? 'Deceased' : '');
  const cfg = MEMBERSHIP_CONFIG[value] || MEMBERSHIP_CONFIG[''];
  const iconWrap = root.querySelector('.status-select__icon');
  const labelEl = root.querySelector('.status-select__label');
  const trigger = root.querySelector('.membership-select__trigger');
  if (iconWrap) {
    iconWrap.style.color = cfg.color;
    iconWrap.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor">${cfg.icon}</svg>`;
  }
  if (labelEl) labelEl.textContent = value || 'Select status';
  if (trigger) trigger.setAttribute('aria-label', `Membership status: ${value || 'Select status'}`);
  root.querySelectorAll('.status-select__option').forEach(option => {
    option.classList.toggle('active', option.dataset.membership === value);
  });
}

function toggleMembershipSelect(btn, event) {
  if (event) {
    event.__statusHandled = true;
    event.preventDefault();
    event.stopPropagation();
  }
  const root = btn.closest('.membership-select');
  if (!root) return;
  const menu = root.querySelector('.membership-select__menu');
  if (!menu) return;
  const wasOpen = menu.classList.contains('show');

  if (typeof closeAllStatusMenus === 'function') closeAllStatusMenus(menu);
  document.querySelectorAll('.membership-select__menu.show').forEach(m => {
    if (m !== menu) {
      m.classList.remove('show');
      m.style.left = '';
      m.style.top = '';
      m.style.width = '';
      restoreMembershipMenu(m);
    }
  });

  if (wasOpen) {
    menu.classList.remove('show');
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
    restoreMembershipMenu(menu);
  } else {
    menu.__membershipRoot = root;
    menu.dataset.membershipOwnerId = root.dataset.appId || '';
    document.body.appendChild(menu);
    menu.classList.add('show');
    if (typeof positionStatusMenu === 'function') {
      positionStatusMenu(btn, menu);
    } else {
      const rect = btn.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = (rect.bottom + 2) + 'px';
      menu.style.width = Math.max(120, rect.width) + 'px';
    }
  }
}

function restoreMembershipMenu(menu) {
  const root = menu.__membershipRoot || (menu.dataset.membershipOwnerId ? document.querySelector(`.membership-select[data-app-id="${menu.dataset.membershipOwnerId}"]`) : null);
  if (root && menu.parentElement !== root) root.appendChild(menu);
}

async function selectMembershipOption(btn, event) {
  if (event) {
    event.__statusHandled = true;
    event.preventDefault();
    event.stopPropagation();
  }

  const menu = btn.closest('.membership-select__menu');
  const root = btn.closest('.membership-select') || (menu?.__membershipRoot) || (menu?.dataset?.membershipOwnerId ? document.querySelector(`.membership-select[data-app-id="${menu.dataset.membershipOwnerId}"]`) : null);
  if (!root) return;

  const newStatus = btn.dataset.membership;
  const appId = root.dataset.appId;
  setMembershipSelectValue(root, newStatus);
  if (menu) {
    menu.querySelectorAll('.status-select__option').forEach(o => {
      o.classList.toggle('active', o.dataset.membership === newStatus);
    });
    menu.classList.remove('show');
    restoreMembershipMenu(menu);
  }

  await updateMembershipStatus(appId, newStatus, root);
}

window.toggleMembershipSelect = toggleMembershipSelect;
window.selectMembershipOption = selectMembershipOption;

document.addEventListener('click', (e) => {
  if (!e.target.closest('.membership-select')) {
    document.querySelectorAll('.membership-select__menu.show').forEach(m => {
      m.classList.remove('show');
      m.style.left = '';
      m.style.top = '';
      m.style.width = '';
      restoreMembershipMenu(m);
    });
  }
});

function renderLiveApplications(applications) {
  const tbody = document.getElementById('applications-tbody');
  if (!tbody) return;
  if (!Array.isArray(applications) || !applications.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">No applications found.</td></tr>';
    if (typeof Skeleton !== 'undefined') Skeleton.clearBusy('applications-tbody');
    const shown = document.getElementById('apps-shown');
    const total = document.getElementById('apps-total');
    if (shown) shown.textContent = '0';
    if (total) total.textContent = '0';
    updateBatchState();
    return;
  }

  tbody.innerHTML = applications.map((application, index) => {
    const id = application.application_id || application.id || '';
    const name = getApplicationName(application);
    const status = application.status || 'Pending';
    const docs = typeof buildDocsStatusPill === 'function' ? buildDocsStatusPill(application) : '—';
    const statusHtml = typeof buildStatusSelect === 'function' ? buildStatusSelect(id, status) : `<span class="status-select__label">${escapeApplicationHtml(status)}</span>`;
    const membershipStatus = application.membership_status || '';
    const membershipHtml =
      String(status).trim().toLowerCase() === 'completed'
        ? buildMembershipSelect(id, membershipStatus)
        : '<span class="cell-text">—</span>';

    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
    const barangay = application.barangay_district || application.barangay || '';
    const days = getApplicationDaysPending(application);
    return `<tr data-app-id="${escapeApplicationHtml(id)}" data-status="${escapeApplicationHtml(String(status).toLowerCase())}" data-barangay="${escapeApplicationHtml(String(barangay).toLowerCase())}" >
      <td style="width:36px;text-align:center"><input type="checkbox" class="row-check" data-app-id="${escapeApplicationHtml(id)}" aria-label="Select ${escapeApplicationHtml(name)}" ${STAFF_SELECTED_APP_IDS.has(String(id)) ? 'checked' : ''}  /></td>
      <td data-label="Applicant"><div class="applicant-cell"><div class="applicant-avatar">${escapeApplicationHtml(initials)}</div><div class="applicant-info"><span class="applicant-name">${escapeApplicationHtml(name)}</span><span class="applicant-id">${escapeApplicationHtml(id)}</span></div></div></td>
      <td data-label="Submitted"><span class="cell-text">${escapeApplicationHtml(formatStaffDate(getApplicationSubmittedDate(application)))}</span></td>
      <td data-label="Documents">${docs}</td><td data-label="Stage">${statusHtml}</td><td data-label="Membership">${membershipHtml}</td>
      <td data-label="Days Pending" style="text-align:center"><span class="cell-text">${days === null ? '—' : Math.floor(days).toLocaleString()}</span></td>
      <td style="text-align:center"><button type="button" class="row-action-eye" onclick="event.stopPropagation();openApplicationDetail('${escapeApplicationHtml(id)}')" title="View applicant" aria-label="View applicant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="10" r="3"/></svg></button></td></tr>`;
  }).join('');
  if (typeof Skeleton !== 'undefined') Skeleton.clearBusy('applications-tbody');
  const shown = document.getElementById('apps-shown');
  const total = document.getElementById('apps-total');
  const totalPill = document.getElementById('apps-total-pill');
  if (shown) shown.textContent = applications.length.toLocaleString();
  if (total) total.textContent = applications.length.toLocaleString();
  if (totalPill) totalPill.textContent = applications.length.toLocaleString();
  applyApplicationsModuleFilters();
  if (typeof updateStatusTabCounts === 'function') updateStatusTabCounts();
  const urgentCount = applications.filter(a => ['pending', 'review'].includes(normalizeApplicationStatus(a.status)) && (getApplicationDaysPending(a) || 0) > 5).length;
  const urgent = document.getElementById('urgent-count');
  if (urgent) urgent.textContent = urgentCount + ' Urgent';
  const alert = document.getElementById('urgent-alert');
  if (alert) alert.style.display = urgentCount ? '' : 'none';
  const urgentTitle = document.getElementById('urgent-alert-title');
  if (urgentTitle) urgentTitle.textContent = urgentCount ? `${urgentCount} application${urgentCount === 1 ? '' : 's'} require urgent review` : 'No urgent applications';
  const urgentDescription = document.getElementById('urgent-alert-desc');
  if (urgentDescription) urgentDescription.textContent = urgentCount ? 'These applications have been pending for more than 5 days and need immediate attention.' : 'Applications pending for more than 5 days will appear here.';
  updateBatchState();
}

function getSelectedApplicationIds() {
  return [...document.querySelectorAll('#applications-tbody .row-check:checked')]
    .map(checkbox => checkbox.dataset.appId)
    .filter(Boolean);
}

function toggleBatchMenu(button, event) {
  event?.preventDefault();
  event?.stopPropagation();
  const menu = document.getElementById('batch-ops-menu');
  const wrapper = document.getElementById('batch-ops-wrap');
  if (!menu || !wrapper || !button || button.disabled) return;
  const opening = !wrapper.classList.contains('open');
  document.querySelectorAll('.batch-ops-wrap.open').forEach(openWrap => openWrap.classList.remove('open'));
  wrapper.classList.toggle('open', opening);
  button.setAttribute('aria-expanded', String(opening));
}

function exportSelectedApplications() {
  const selectedIds = new Set(getSelectedApplicationIds().map(String));
  const selected = LIVE_APPLICATIONS.filter(app => selectedIds.has(String(app.application_id || app.id)));
  if (!selected.length) return;
  const fields = [
    ['Application ID', app => app.application_id || app.id || ''],
    ['Applicant', getApplicationName],
    ['Barangay', app => app.barangay_district || app.barangay || ''],
    ['Status', app => app.status || ''],
    ['Submitted', getApplicationSubmittedDate]
  ];
  const csvCell = value => {
    const text = String(value ?? '');
    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const csv = [fields.map(([heading]) => csvCell(heading)).join(','), ...selected.map(app =>
    fields.map(([, getValue]) => csvCell(getValue(app))).join(',')
  )].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `selected-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function approveSelectedApplications() {
  const selectedIds = new Set(getSelectedApplicationIds().map(String));
  const selected = LIVE_APPLICATIONS.filter(app => selectedIds.has(String(app.application_id || app.id)) &&
    ['pending', 'review', 'process'].includes(normalizeApplicationStatus(app.status)));
  if (!selected.length) return;

  const results = await Promise.allSettled(selected.map(async app => {
    const id = app.application_id || app.id;
    const response = await fetch(`https://management-backend-3cij.onrender.com/api/applications/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: 'Ready for Release' })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || `Could not approve application ${id}`);
    app.status = 'Ready for Release';
  }));

  const succeeded = results.filter(result => result.status === 'fulfilled').length;
  const failed = results.length - succeeded;
  if (typeof showToast === 'function') {
    showToast(failed ? `${succeeded} approved; ${failed} failed.` : `${succeeded} application${succeeded === 1 ? '' : 's'} approved.`, failed ? 'error' : 'success');
  }
  const selectAll = document.getElementById('select-all-apps');
  if (selectAll) selectAll.checked = false;
  renderLiveApplications(LIVE_APPLICATIONS);
}

async function runBatchAction(action) {
  document.getElementById('batch-ops-wrap')?.classList.remove('open');
  document.getElementById('batch-ops-trigger')?.setAttribute('aria-expanded', 'false');
  if (action === 'export') exportSelectedApplications();
  else if (action === 'approve') await approveSelectedApplications();
}

window.toggleBatchMenu = toggleBatchMenu;
window.toggleSelectAllApps = toggleSelectAllApps;
window.updateBatchState = updateBatchState;
window.runBatchAction = runBatchAction;

document.addEventListener('click', event => {
  if (event.target.closest('#batch-ops-wrap')) return;
  document.getElementById('batch-ops-wrap')?.classList.remove('open');
  document.getElementById('batch-ops-trigger')?.setAttribute('aria-expanded', 'false');
});

function applyApplicationsModuleFilters(statusKey) {
  if (statusKey) {
    APPLICATIONS_FILTER_STATE.status = statusKey === 'all' ? [] : [statusKey];
    const stageSel = document.getElementById('filter-application-stage');
    if (stageSel) Array.from(stageSel.options).forEach(opt => { opt.selected = statusKey === 'all' ? opt.value === 'all' : opt.value === statusKey; });
  }

  const rows = document.querySelectorAll('#applications-tbody tr[data-app-id]');
  
  const statusMap = {
    all: 'all',
    pending: 'pending',
    unverified: 'pending',
    review: 'review',
    'under review': 'review',
    verified: 'approved',
    approved: 'approved',
    process: 'process',
    'in process': 'process',
    release: 'ready',
    ready: 'ready',
    'ready for release': 'ready',
    issued: 'completed',
    completed: 'completed',
    rejected: 'rejected'
  };

  const selectedStatuses = Array.isArray(APPLICATIONS_FILTER_STATE.status) ? APPLICATIONS_FILTER_STATE.status : [];
  const normalizedExpectedStatuses = selectedStatuses.map(value => statusMap[String(value).trim().toLowerCase()] || normalizeApplicationStatus(value));
  const rawExpectedType = String(APPLICATIONS_FILTER_STATE.type || 'all').trim().toLowerCase();
  const searchVal = String(APPLICATIONS_FILTER_STATE.search || '').trim().toLowerCase();
  const barangayValues = Array.isArray(APPLICATIONS_FILTER_STATE.barangay) ? APPLICATIONS_FILTER_STATE.barangay.map(value => String(value).trim().toLowerCase()) : [];

  let visible = 0;
  rows.forEach(row => {
    // 1. Search text match across row
    const searchMatch = !searchVal || row.textContent.toLowerCase().includes(searchVal);

    // 2. Barangay match
    const rowBarangay = String(row.dataset.barangay || '').trim().toLowerCase();
    const barangayMatch = !barangayValues.length || barangayValues.includes(rowBarangay);

    // 3. Request Type match
    const rowType = String(row.dataset.type || row.querySelector('td[data-label="Req. Type"]')?.textContent || '').trim().toLowerCase();
    const typeMatch = rawExpectedType === 'all' || !rawExpectedType || rowType.includes(rawExpectedType);

    // 4. Stage / Status match
    const rowStatus = normalizeApplicationStatus(row.dataset.status);
    const statusMatch = !normalizedExpectedStatuses.length || normalizedExpectedStatuses.some(expected =>
      expected === 'completed' ? (rowStatus === 'completed' || rowStatus === 'issued') : rowStatus === expected
    );

    const matchesAll = searchMatch && barangayMatch && typeMatch && statusMatch;
    row.style.display = matchesAll ? '' : 'none';
    if (matchesAll) visible++;
  });

  const shown = document.getElementById('apps-shown');
  if (shown) shown.textContent = visible.toLocaleString();
  updateBatchState();
}

function filterApplicationsTable(query) { 
  APPLICATIONS_FILTER_STATE.search = query || ''; 
  applyApplicationsModuleFilters(); 
}

function filterApplicationsByType(type) {
  APPLICATIONS_FILTER_STATE.type = type || 'all';
  applyApplicationsModuleFilters();
}
window.filterApplicationsByType = filterApplicationsByType;

function filterApplicationsByStage(control) {
  APPLICATIONS_FILTER_STATE.status = control instanceof HTMLSelectElement
    ? Array.from(control.selectedOptions).map(option => option.value).filter(value => value && value !== 'all')
    : (control ? [control] : []);
  applyApplicationsModuleFilters();
}
window.filterApplicationsByStage = filterApplicationsByStage;

function filterApplicationsByBarangay(control) {
  APPLICATIONS_FILTER_STATE.barangay = control instanceof HTMLSelectElement
    ? Array.from(control.selectedOptions).map(option => option.value).filter(value => value && value !== 'all')
    : (control ? [control] : []);
  applyApplicationsModuleFilters();
}

function resetApplicationsFilters() {
  const search = document.querySelector('#mod-applications .table-search-wrap input');
  const stage = document.getElementById('filter-application-stage');
  const barangay = document.querySelector('#mod-applications .barangay-select-wrap select');

  if (search) search.value = '';
  if (stage) stage.value = 'all';
  if (barangay) barangay.value = '';

  APPLICATIONS_FILTER_STATE.search = '';
  APPLICATIONS_FILTER_STATE.barangay = [];
  APPLICATIONS_FILTER_STATE.type = 'all';
  APPLICATIONS_FILTER_STATE.status = [];
  applyApplicationsModuleFilters('all');
}
window.resetApplicationsFilters = resetApplicationsFilters;

function handleApplicationsSort(val) {
  if (typeof sortTable !== 'function') return;
  const thDate = document.querySelector('#mod-applications thead th:nth-child(4)');
  const thName = document.querySelector('#mod-applications thead th:nth-child(2)');
  if (val === 'name') {
    sortTable('applications-tbody', 1, thName);
  } else if (val === 'oldest') {
    sortTable('applications-tbody', 3, thDate);
  } else {
    sortTable('applications-tbody', 3, thDate);
  }
}
window.handleApplicationsSort = handleApplicationsSort;

function updateApplicantSummaryCards(applications) {
  if (!Array.isArray(applications)) return;
  const profiles = buildApplicantProfiles(applications);
  const ongoingProfiles = profiles.filter(profile => profile.isActive);
  const ongoingApplicationCount = applications.filter(application =>
    !['completed', 'rejected'].includes(normalizeApplicationStatus(application.status))).length;
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthComparableDay = Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate());
  const endOfLastMonthComparablePeriod = new Date(
    now.getFullYear(), now.getMonth() - 1, lastMonthComparableDay + 1
  );
  const registeredProfiles = profiles.filter(profile => profile.isRegistered);
  const newThisMonth = registeredProfiles.filter(profile =>
    profile.registeredAt && profile.registeredAt >= startOfThisMonth && profile.registeredAt <= now).length;
  const newLastMonth = registeredProfiles.filter(profile =>
    profile.registeredAt && profile.registeredAt >= startOfLastMonth &&
    profile.registeredAt < endOfLastMonthComparablePeriod).length;
  const startOfThisWeek = new Date(now.getFullYear(), now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7));
  const activeProfilesAddedThisWeek = ongoingProfiles.filter(profile =>
    profile.ongoingApplications.some(application => {
      const submittedAt = new Date(getApplicationSubmittedDate(application) || '');
      return !Number.isNaN(submittedAt.getTime()) &&
        submittedAt >= startOfThisWeek && submittedAt <= now;
    })).length;
  const identityCounts = new Map();
  profiles.forEach(profile => {
    if (!profile.nameDobKey || profile.nameDobKey.startsWith('|')) return;
    identityCounts.set(profile.nameDobKey, (identityCounts.get(profile.nameDobKey) || 0) + 1);
  });
  const duplicateProfiles = profiles.filter(profile => profile.hasDuplicateFlag ||
    (profile.nameDobKey && !profile.nameDobKey.startsWith('|') && identityCounts.get(profile.nameDobKey) > 1)).length;
  const setTrend = (id, text, trendClass) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text;
    element.classList.remove('trend-good', 'trend-up', 'trend-down', 'trend-neutral');
    element.classList.add(trendClass);
  };
  const registrationComparison = newLastMonth === 0
    ? (newThisMonth === 0 ? { text: 'No change vs last month', trendClass: 'trend-neutral' } :
      { text: `+${newThisMonth} vs last month`, trendClass: 'trend-good' })
    : newThisMonth === newLastMonth
      ? { text: 'No change vs last month', trendClass: 'trend-neutral' }
      : (() => {
        const change = Math.round(Math.abs((newThisMonth - newLastMonth) / newLastMonth) * 100);
        const increased = newThisMonth > newLastMonth;
        return {
          text: `${increased ? '\u25B2' : '\u25BC'} ${change}% vs last month`,
          trendClass: increased ? 'trend-good' : 'trend-down'
        };
      })();
  const totalRegistered = registeredProfiles.length;
  const growthPercent = totalRegistered > newThisMonth
    ? Number((newThisMonth / (totalRegistered - newThisMonth) * 100).toFixed(1))
    : null;
  setTrend('applicants-total-trend', newThisMonth
    ? (growthPercent === null ? `+${newThisMonth} this month` : `\u25B2 ${growthPercent}% this month`)
    : 'No growth this month',
    newThisMonth ? 'trend-good' : 'trend-neutral');
  setTrend('applicants-active-trend',
    activeProfilesAddedThisWeek ? `${activeProfilesAddedThisWeek} new this week` : 'No new this week',
    activeProfilesAddedThisWeek ? 'trend-good' : 'trend-neutral');
  setTrend('applicants-registrations-trend', registrationComparison.text, registrationComparison.trendClass);
  setTrend('applicants-duplicates-trend', duplicateProfiles === 0 ? 'All clear' : 'Needs review',
    duplicateProfiles === 0 ? 'trend-good' : 'trend-up');
  const counts = {
    'applicants-total-count': totalRegistered,
    'applicants-verified-count': ongoingProfiles.length,
    'applicants-unverified-count': newThisMonth,
    'applicants-issued-count': duplicateProfiles,
    'applicants-sidebar-count': ongoingApplicationCount,
    'applicants-total-badge': ongoingProfiles.length.toLocaleString() + ' Ongoing Profiles'
  };
  Object.entries(counts).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof value === 'number' ? value.toLocaleString() : value;
  });
}

function updateApplicationSummaryCards(applications) {
  if (!Array.isArray(applications)) return;
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const comparisonDay = Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate());
  const endOfLastMonthComparison = new Date(now.getFullYear(), now.getMonth() - 1, comparisonDay + 1);
  const getCompletedDate = application => {
    const value = application.status_updated_at || application.updated_at || application.created_at;
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const openReviewApplications = applications.filter(application =>
    ['pending', 'review'].includes(normalizeApplicationStatus(application.status)));
  const newReviewToday = openReviewApplications.filter(application => {
    const submittedAt = new Date(getApplicationSubmittedDate(application) || '');
    return !Number.isNaN(submittedAt.getTime()) && isSameDay(submittedAt, now);
  }).length;
  const oldestReviewAge = openReviewApplications.reduce((oldest, application) => {
    const age = getApplicationDaysPending(application);
    if (age === null) return oldest;
    return oldest === null ? Math.floor(age) : Math.max(oldest, Math.floor(age));
  }, null);
  const incompleteApplications = applications.filter(application =>
    typeof getDocsStatus === 'function' && getDocsStatus(application).missing.length > 0);
  const overdueApplications = openReviewApplications.filter(application =>
    (getApplicationDaysPending(application) || 0) > 5);
  const readyApplications = applications.filter(application =>
    normalizeApplicationStatus(application.status) === 'ready');
  const completedThisMonth = applications.filter(application => {
    if (normalizeApplicationStatus(application.status) !== 'completed') return false;
    const date = getCompletedDate(application);
    return date && date >= startOfThisMonth && date < startOfNextMonth;
  }).length;
  const completedLastMonthToDate = applications.filter(application => {
    if (normalizeApplicationStatus(application.status) !== 'completed') return false;
    const date = getCompletedDate(application);
    return date && date >= startOfLastMonth && date < endOfLastMonthComparison;
  }).length;

  const setSummaryBadge = (id, text, variant, description) => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.textContent = text;
    badge.classList.remove('trend-good', 'trend-up', 'trend-down', 'trend-neutral');
    badge.classList.add(variant);
    badge.title = description;
    badge.setAttribute('aria-label', description);
  };

  if (newReviewToday > 0) {
    setSummaryBadge('summary-pending-badge', `\u25B2 ${newReviewToday} today`, 'trend-neutral',
      `${newReviewToday} pending or in-review applications submitted today.`);
  } else if (oldestReviewAge !== null) {
    setSummaryBadge('summary-pending-badge',
      `Oldest: ${oldestReviewAge}d`, oldestReviewAge > 5 ? 'trend-up' : 'trend-neutral',
      `Oldest pending or in-review application is ${oldestReviewAge} days old.`);
  } else if (openReviewApplications.length > 0) {
    setSummaryBadge('summary-pending-badge', 'Awaiting review', 'trend-neutral',
      `${openReviewApplications.length} pending or in-review applications are awaiting staff review.`);
  } else {
    setSummaryBadge('summary-pending-badge', 'No items to review', 'trend-good',
      'There are no pending or in-review applications.');
  }

  setSummaryBadge('summary-incomplete-badge',
    incompleteApplications.length ? 'Needs follow-up' : 'All clear',
    incompleteApplications.length ? 'trend-up' : 'trend-good',
    incompleteApplications.length
      ? `${incompleteApplications.length} applications have required documents missing.`
      : 'No applications are missing required documents.');
  setSummaryBadge('summary-overdue-badge',
    overdueApplications.length ? '\u25BC Urgent' : 'None',
    overdueApplications.length ? 'trend-down' : 'trend-good',
    overdueApplications.length
      ? `${overdueApplications.length} applications have been open for more than 5 days.`
      : 'No applications are overdue by more than 5 days.');
  setSummaryBadge('summary-ready-badge',
    readyApplications.length ? 'Needs action' : 'None awaiting pickup',
    readyApplications.length ? 'trend-down' : 'trend-good',
    readyApplications.length
      ? `${readyApplications.length} approved applications are awaiting pickup.`
      : 'No approved applications are awaiting pickup.');

  if (completedLastMonthToDate === 0) {
    setSummaryBadge('summary-completed-month-badge',
      completedThisMonth > 0 ? 'First this month' : 'This month', 'trend-neutral',
      completedThisMonth > 0
        ? 'No completed applications were recorded in the comparable period last month.'
        : 'Completed application count for this month.');
  } else {
    const difference = completedThisMonth - completedLastMonthToDate;
    const percent = Math.round(Math.abs(difference / completedLastMonthToDate) * 100);
    const direction = difference > 0 ? '\u25B2' : difference < 0 ? '\u25BC' : '';
    const variant = difference > 0 ? 'trend-good' : difference < 0 ? 'trend-down' : 'trend-neutral';
    const label = difference === 0 ? 'No change vs last month' : `${direction} ${percent}% vs last month`;
    setSummaryBadge('summary-completed-month-badge', label, variant,
      `${completedThisMonth} completed this month versus ${completedLastMonthToDate} in the same period last month.`);
  }

  const count = {
    'summary-pending': applications.filter(a => normalizeApplicationStatus(a.status) === 'pending').length,
    'summary-incomplete': incompleteApplications.length,
    'summary-overdue': overdueApplications.length,
    'summary-ready': readyApplications.length,
    'summary-completed-month': completedThisMonth
  };
  Object.entries(count).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value.toLocaleString(); });
}


const REPLACEMENTS_API =
  'https://management-backend-3cij.onrender.com/api/replacements';

let replacementRequests = [];

function escapeReplacementText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatReplacementDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}


// MULTI-PROVIDER STAFF ANALYTICS INSIGHTS - BEGIN
const STAFF_ANALYTICS_INSIGHTS_API = "https://management-backend-3cij.onrender.com/api/analytics-insights";
let staffAnalyticsInsightRequest = 0;
let staffInsightsApplicationsReady = false;
let staffInsightsReplacementsReady = false;
let staffInsightsScheduleTimer = null;
let staffInsightsLatestApplications = [];

function staffAnalyticsStatus(app) {
  return typeof normalizeApplicationStatus === "function" ? normalizeApplicationStatus(app.status) : String(app.status || "pending").toLowerCase();
}
function staffAnalyticsDate(app, fields) {
  for (const field of fields) {
    if (!app?.[field]) continue;
    const d = new Date(app[field]);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
function buildStaffAnalyticsMetrics(applications) {
  const apps = Array.isArray(applications) ? applications : [];
  const now = new Date();
  const labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlySubmitted = Array(12).fill(0), monthlyIssued = Array(12).fill(0);
  const status = { pending: 0, review: 0, approved: 0, rejected: 0, total: apps.length };
  const barangays = {};
  const ages = {"60–64":0,"65–69":0,"70–74":0,"75–79":0,"80–84":0,"85+":0};
  const demographics = { female: 0, male: 0, unknown: 0 };
  let ready = 0, issued = 0, turnaroundSum = 0, turnaroundCount = 0;
  for (const app of apps) {
    const s = staffAnalyticsStatus(app);
    if (s === "pending") status.pending++;
    else if (s === "review") status.review++;
    else if (["approved","ready","issued","completed"].includes(s)) status.approved++;
    else if (s === "rejected") status.rejected++;
    if (s === "ready") ready++;
    const created = staffAnalyticsDate(app, ["created_at","submitted_at","application_date"]);
    const updated = staffAnalyticsDate(app, ["status_updated_at","updated_at"]) || created;
    if (created && created.getFullYear() === now.getFullYear()) monthlySubmitted[created.getMonth()]++;
    if (["issued","completed"].includes(s)) {
      issued++;
      if (updated && updated.getFullYear() === now.getFullYear()) monthlyIssued[updated.getMonth()]++;
    }
    if (["approved","ready","issued","completed"].includes(s) && created && updated && updated >= created) {
      turnaroundSum += (updated - created) / 86400000;
      turnaroundCount++;
    }
    const barangay = String(app.barangay_district || "Unknown").trim() || "Unknown";
    barangays[barangay] = (barangays[barangay] || 0) + 1;
    const sex = String(app.sex || app.gender || app.sex_at_birth || "").trim().toLowerCase();
    if (sex === "female" || sex === "f") demographics.female++;
    else if (sex === "male" || sex === "m") demographics.male++;
    else demographics.unknown++;
    const age = Number(app.age);
    if (Number.isFinite(age)) {
      if (age >= 60 && age <= 64) ages["60–64"]++;
      else if (age <= 69 && age >= 65) ages["65–69"]++;
      else if (age <= 74 && age >= 70) ages["70–74"]++;
      else if (age <= 79 && age >= 75) ages["75–79"]++;
      else if (age <= 84 && age >= 80) ages["80–84"]++;
      else if (age >= 85) ages["85+"]++;
    }
  }
  const requests = Array.isArray(replacementRequests) ? replacementRequests : [];
  const replacement = { total: requests.length, pending: 0, inProcess: 0, completed: 0, rejected: 0 };
  requests.forEach(r => {
    const s = String(r.request_status || "Pending").toLowerCase().trim();
    if (s === "pending") replacement.pending++;
    else if (["under review","in process","ready for release"].includes(s)) replacement.inProcess++;
    else if (s === "completed") replacement.completed++;
    else if (s === "rejected") replacement.rejected++;
  });
  return {
    applicationFlow: { submitted: monthlySubmitted.reduce((a,b)=>a+b,0), approved: status.approved, rejected: status.rejected, months: labels.map((label,i)=>({label,count:monthlySubmitted[i]})) },
    queueMix: status,
    replacementRequests: replacement,
    readyForHandoff: { ready, total: apps.length },
    barangayWorkload: { total: apps.length, barangayCount: Object.keys(barangays).length, topBarangays: Object.entries(barangays).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([label,count])=>({label,count})) },
    seniorRegistrationsByBarangay: { total: apps.length, barangayCount: Object.keys(barangays).length, topBarangays: Object.entries(barangays).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,count])=>({label,count})) },
    demographics: { ...demographics, knownTotal: demographics.female + demographics.male, unknown: demographics.unknown },
    ageDistribution: { total: Object.values(ages).reduce((a,b)=>a+b,0), groups: Object.entries(ages).map(([label,count])=>({label,count})) },
    issuanceOverTime: { issued: monthlyIssued.reduce((a,b)=>a+b,0), months: labels.map((label,i)=>({label,count:monthlyIssued[i]})) },
    turnaroundTime: { averageDays: turnaroundCount ? Math.round(turnaroundSum / turnaroundCount * 10) / 10 : null, sampleSize: turnaroundCount }
  };
}
function ensureStaffAnalyticsInsightAreas() {
  const mappings = [["Application Flow","applicationFlow"],["Queue Mix","queueMix"],["Replacement Applications Analytics","replacementRequests"],["Ready for Handoff","readyForHandoff"],["Barangay Workload","barangayWorkload"],["Age Group Distribution","ageDistribution"],["ID Issuance Over Time","issuanceOverTime"],["Turnaround Time","turnaroundTime"]];
  const cards = Array.from(document.querySelectorAll(".an-card"));
  for (const [title,key] of mappings) {
    const card = cards.find(node => node.querySelector(".an-card__title")?.textContent.trim() === title);
    if (!card || card.querySelector(`[data-ai-insight="${key}"]`)) continue;
    const box = document.createElement("div");
    box.className = "staff-ai-insight";
    box.dataset.aiInsight = key;
    box.style.cssText = "margin:0 18px 18px;padding:12px 14px;font-size:13px;line-height:1.55";
    box.innerHTML = '<div style="display:flex;gap:7px;align-items:center;font-weight:700;margin-bottom:5px"><span aria-hidden="true">✦</span> AI-Driven Insight <span data-ai-source style="margin-left:auto;font-size:10px;opacity:.7">DATA SUMMARY</span></div><div data-ai-text>Preparing insight from current analytics…</div>';
    card.appendChild(box);
  }
  const chartTargets = [
    [document.querySelector(".chart-card"), "seniorRegistrationsByBarangay"],
    [document.querySelector(".donut-card"), "demographics"]
  ];
  for (const [card,key] of chartTargets) {
    if (!card || card.querySelector(`[data-ai-insight="${key}"]`)) continue;
    const box = document.createElement("div");
    box.className = "staff-ai-insight";
    box.dataset.aiInsight = key;
    box.style.cssText = "margin:12px 0 0;padding:12px 14px;font-size:13px;line-height:1.55";
    box.innerHTML = '<div style="display:flex;gap:7px;align-items:center;font-weight:700;margin-bottom:5px"><span aria-hidden="true">✦</span> AI-Driven Insight <span data-ai-source style="margin-left:auto;font-size:10px;opacity:.7">DATA SUMMARY</span></div><div data-ai-text>Preparing insight from current analytics…</div>';
    card.appendChild(box);
  }
}
function displayStaffAnalyticsInsights(insights) {
  ensureStaffAnalyticsInsightAreas();
  for (const [key,value] of Object.entries(insights || {})) {
    const area = document.querySelector(`[data-ai-insight="${key}"]`);
    if (!area) continue;
    area.querySelector("[data-ai-text]").textContent = String(value?.text || "Insight is currently unavailable.");
    area.querySelector("[data-ai-source]").textContent = ["groq","cerebras","openrouter"].includes(value?.source) ? `${String(value.source).toUpperCase()} AI` : "DATA SUMMARY";
  }
}
function scheduleStaffAnalyticsInsights(applications, source) {
  staffInsightsLatestApplications = Array.isArray(applications) ? applications : [];
  if (source === "applications") staffInsightsApplicationsReady = true;
  if (source === "replacements") staffInsightsReplacementsReady = true;

  // Wait until both initial datasets are loaded so the first request
  // contains application and replacement-request statistics together.
  if (!staffInsightsApplicationsReady || !staffInsightsReplacementsReady) return;

  if (staffInsightsScheduleTimer) clearTimeout(staffInsightsScheduleTimer);
  staffInsightsScheduleTimer = setTimeout(() => {
    staffInsightsScheduleTimer = null;
    requestStaffAnalyticsInsights(staffInsightsLatestApplications);
  }, 350);
}

async function requestStaffAnalyticsInsights(applications) {
  ensureStaffAnalyticsInsightAreas();
  const id = ++staffAnalyticsInsightRequest;
  const metrics = buildStaffAnalyticsMetrics(applications);
  const n = (v) => Number(v || 0).toLocaleString();
  const fallback = {
    applicationFlow: {text:`The chart summarizes ${n(metrics.applicationFlow.submitted)} submissions during the current year.`,source:"fallback"},
    queueMix: {text:`The current queue contains ${n(metrics.queueMix.total)} applications, including ${n(metrics.queueMix.pending)} pending and ${n(metrics.queueMix.rejected)} rejected.`,source:"fallback"},
    replacementRequests: {text:`There are ${n(metrics.replacementRequests.total)} replacement requests: ${n(metrics.replacementRequests.pending)} pending, ${n(metrics.replacementRequests.inProcess)} in process, ${n(metrics.replacementRequests.completed)} completed, and ${n(metrics.replacementRequests.rejected)} rejected.`,source:"fallback"},
    readyForHandoff: {text:`${n(metrics.readyForHandoff.ready)} applications are currently marked ready for handoff.`,source:"fallback"},
    barangayWorkload: {text:`The chart summarizes ${n(metrics.barangayWorkload.total)} applications across ${n(metrics.barangayWorkload.barangayCount)} barangay groups.`,source:"fallback"},
    seniorRegistrationsByBarangay: {text:`The six leading barangays account for ${n(metrics.seniorRegistrationsByBarangay.topBarangays.reduce((sum,item)=>sum+item.count,0))} of ${n(metrics.seniorRegistrationsByBarangay.total)} registrations. Review the highest-volume areas when planning outreach and application-review capacity.`,source:"fallback"},
    demographics: {text:`Among ${n(metrics.demographics.knownTotal)} records with a recorded sex, ${n(metrics.demographics.female)} are female and ${n(metrics.demographics.male)} are male. Use this distribution to understand the current applicant profile and check ${n(metrics.demographics.unknown)} records with missing or unrecognized values.`,source:"fallback"},
    ageDistribution: {text:`The age distribution includes ${n(metrics.ageDistribution.total)} applications with a recorded age.`,source:"fallback"},
    issuanceOverTime: {text:`${n(metrics.issuanceOverTime.issued)} applications are counted as issued or completed in the current year's monthly chart.`,source:"fallback"},
    turnaroundTime: {text:metrics.turnaroundTime.averageDays == null ? "A processing-time summary is unavailable because there are not enough valid dates." : `The average recorded turnaround time is ${metrics.turnaroundTime.averageDays} days across ${n(metrics.turnaroundTime.sampleSize)} applications.`,source:"fallback"}
  };
  displayStaffAnalyticsInsights(fallback);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let response;

    try {
      response = await fetch(STAFF_ANALYTICS_INSIGHTS_API, {
        method: "POST",
        headers: getAuthHeaders(),
        cache: "no-store",
        body: JSON.stringify({ metrics }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const result = await response.json();
    if (id !== staffAnalyticsInsightRequest) return;
    if (!response.ok || !result.success) throw new Error(result.message || "Insight request failed");
    displayStaffAnalyticsInsights(result.insights || {});
  } catch (error) {
    console.warn("Staff analytics insights:", error.message);
  }
}
// MULTI-PROVIDER STAFF ANALYTICS INSIGHTS - END


async function loadReplacementRequests() {
  const tbody = document.getElementById(
    'replacement-requests-tbody'
  );

  const hasReplacementTable = Boolean(tbody);

  if (hasReplacementTable) {
    if (typeof Skeleton !== 'undefined') {
      Skeleton.setTable(tbody, 5);
    } else {
      tbody.setAttribute('aria-busy', 'true');
      tbody.innerHTML = Array.from({ length: 5 }, (_, row) =>
        `<tr class="sk-row" aria-hidden="true">${Array.from({ length: 6 }, (_, col) =>
          `<td><span class="skeleton sk-cell" style="width:${[62, 88, 45, 74, 56, 92][(row + col) % 6]}%"></span></td>`
        ).join('')}</tr>`
      ).join('');
    }
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(REPLACEMENTS_API, {
      headers: getAuthHeaders(),
      cache: 'no-store',
      signal: controller.signal
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Failed to load ID requests.'
      );
    }

    replacementRequests = Array.isArray(result.requests)
      ? result.requests
      : [];
    window.LIVE_REPLACEMENT_REQUESTS = replacementRequests;
    updateReplacementAnalytics(replacementRequests);

    if (typeof requestStaffAnalyticsInsights === "function") {
      scheduleStaffAnalyticsInsights(typeof LIVE_APPLICATIONS !== "undefined" ? LIVE_APPLICATIONS : [], "replacements");
    }

    // Always refresh the sidebar badge when data loads.
    const sidebarCount = document.getElementById(
      'replacements-sidebar-count'
    );

    function updateReplacementAnalytics(requests) {
      if (!Array.isArray(requests)) return;

      const counts = {
        total: requests.length,
        pending: 0,
        process: 0,
        completed: 0,
        rejected: 0
      };

      requests.forEach(request => {
        const status = String(
          request.request_status || 'Pending'
        ).trim().toLowerCase();

        if (status === 'pending') {
          counts.pending++;
        } else if (
          status === 'in process' ||
          status === 'under review' ||
          status === 'ready for release'
        ) {
          counts.process++;
        } else if (status === 'completed') {
          counts.completed++;
        } else if (status === 'rejected') {
          counts.rejected++;
        }
      });

      const elements = {
        'replacement-analytics-total': counts.total,
        'replacement-analytics-pending': counts.pending,
        'replacement-analytics-process': counts.process,
        'replacement-analytics-completed': counts.completed,
        'replacement-analytics-rejected': counts.rejected
      };

      Object.entries(elements).forEach(([id, count]) => {
        const element = document.getElementById(id);

        if (element) {
          element.textContent =
            `${count.toLocaleString()} ${count === 1 ? 'request' : 'requests'}`;
        }
      });
    }

    if (sidebarCount) {
      sidebarCount.textContent =
        replacementRequests.length.toLocaleString();
    }

    // Render the table only if it exists on this page.
    if (hasReplacementTable) {
      renderReplacementRequests();
      if (typeof Skeleton !== 'undefined') Skeleton.clearBusy(tbody);
      else tbody.removeAttribute('aria-busy');
    }
    if (typeof initSmallFormIssuance === 'function') initSmallFormIssuance();
  } catch (error) {
    console.error('Replacement requests error:', error);

    if (hasReplacementTable) {
      const message = error.name === 'AbortError'
        ? 'The request timed out. Please try again.'
        : `Unable to load requests: ${escapeReplacementText(error.message || 'Please try again.')}`;
      tbody.innerHTML =
        `<tr><td colspan="6" style="text-align:center;padding:24px;color:#dc2626">${message} ` +
        '<button type="button" class="replacement-refresh" onclick="loadReplacementRequests()">Retry</button></td></tr>';
      if (typeof Skeleton !== 'undefined') Skeleton.clearBusy(tbody);
      else tbody.removeAttribute('aria-busy');

      const badge = document.getElementById('replacement-total');

      if (badge) {
        badge.textContent = 'Load failed';
      }
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function renderReplacementRequests() {
  const tbody = document.getElementById('replacement-requests-tbody');
  if (!tbody) return;

  const search = (
    document.getElementById('replacement-search')?.value || ''
  ).trim().toLowerCase();

  const statusFilters = Array.from(
    document.getElementById('replacement-status-filter')?.selectedOptions || []
  ).map(option => String(option.value || '').trim().toLowerCase()).filter(Boolean);

  const filtered = replacementRequests.filter(request => {
    const text = [
      request.applicant_name,
      request.application_id,
      request.reason,
      request.other_reason,
      request.request_status
    ].join(' ').toLowerCase();

    const requestStatus = String(request.request_status || '').toLowerCase();
    return text.includes(search) && (!statusFilters.length || statusFilters.includes(requestStatus));
  });

  const total = document.getElementById('replacement-total');
  if (total) {
    total.textContent = `${replacementRequests.length} Requests`;
  }

  const sidebarCount = document.getElementById('replacements-sidebar-count');
  if (sidebarCount) {
    sidebarCount.textContent = replacementRequests.length.toLocaleString();
  }

  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:28px">' +
      'No matching requests found.</td></tr>';
    if (typeof Skeleton !== 'undefined') Skeleton.clearBusy(tbody);
    return;
  }

  tbody.innerHTML = filtered.map(request => {
    const id = String(request.application_id || '');
    const status = request.request_status || 'Pending';
    const applicantName = request.applicant_name || 'Applicant record not found';
    const initials = applicantName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part[0].toUpperCase()).join('') || '—';
    const reason = String(request.reason || '');
    const reasonIcon = /address/i.test(reason)
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>'
      : /damage/i.test(reason)
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z"></path><path d="M12 9v5m0 3h.01"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"></circle><path d="m16 16 5 5"></path></svg>';

    const statusHtml = typeof buildStatusSelect === 'function'
      ? buildStatusSelect(id, status)
      : escapeReplacementText(status);

    return `
      <tr
        data-request-id="${Number(request.id)}"
        data-app-id="${escapeReplacementText(id)}"
      >
        <td><div class="replacement-applicant"><span class="replacement-avatar">${escapeReplacementText(initials)}</span>
          <strong>${escapeReplacementText(applicantName)}</strong></div></td>
        <td><span class="replacement-app-id">${escapeReplacementText(id || '—')}</span>
          ${id ? `<button type="button" class="replacement-copy" data-copy-id="${escapeReplacementText(id)}" aria-label="Copy application ID ${escapeReplacementText(id)}" title="Copy application ID" onclick="copyReplacementApplicationId(this)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg></button>` : ''}</td>
        <td><span class="replacement-reason-icon">${reasonIcon}</span><span>
          ${escapeReplacementText(request.reason || '—')}</span>
          ${request.other_reason
            ? `<div style="font-size:12px;color:var(--text-muted)">
                ${escapeReplacementText(request.other_reason)}
              </div>`
            : ''}
        </td>
        <td>${formatReplacementDate(request.requested_at)}</td>
        <td>${statusHtml}</td>
        <td>
          <button
            type="button"
            class="row-action always-visible"
            onclick="openApplicationDetail('${escapeReplacementText(id)}')"
            ${id ? '' : 'disabled'}
          >View</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr[data-request-id]').forEach(row => {
    const select = row.querySelector('.status-select');
    if (select) {
      select.dataset.requestId = row.dataset.requestId;
      select.dataset.appId = row.dataset.appId;
    }
  });
  if (typeof Skeleton !== 'undefined') Skeleton.clearBusy(tbody);
}


async function copyReplacementApplicationId(button) {
  const applicationId = button?.dataset.copyId;
  if (!applicationId) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(applicationId);
    } else {
      const input = document.createElement('textarea');
      input.value = applicationId;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('Clipboard access is unavailable.');
    }

    button.classList.add('is-copied');
    button.title = 'Copied!';
    button.setAttribute('aria-label', `Copied application ID ${applicationId}`);
    if (typeof showToast === 'function') showToast(`Copied ${applicationId}`, 'success');
    window.setTimeout(() => {
      button.classList.remove('is-copied');
      button.title = 'Copy application ID';
      button.setAttribute('aria-label', `Copy application ID ${applicationId}`);
    }, 1600);
  } catch (error) {
    console.error('Failed to copy replacement application ID:', error);
    if (typeof showToast === 'function') showToast('Could not copy the application ID.', 'error');
  }
}

function filterReplacementRequests() {
  renderReplacementRequests();
}

async function exportReplacementRequests(format) {
  if (!['pdf', 'csv'].includes(format)) return;
  const search = (document.getElementById('replacement-search')?.value || '').trim().toLowerCase();
  const statusFilters = Array.from(
    document.getElementById('replacement-status-filter')?.selectedOptions || []
  ).map(option => String(option.value || '').trim().toLowerCase()).filter(Boolean);
  const filtered = (Array.isArray(replacementRequests) ? replacementRequests : []).filter(request => {
    const searchable = [request.applicant_name, request.application_id, request.reason, request.other_reason, request.request_status]
      .join(' ').toLowerCase();
    const status = String(request.request_status || '').trim().toLowerCase();
    return searchable.includes(search) && (!statusFilters.length || statusFilters.includes(status));
  });

  if (!filtered.length) {
    showToast('There are no replacement requests matching the current filters.', 'warning');
    return;
  }

  const headers = ['Applicant', 'Application ID', 'Reason', 'Other Reason', 'Request Date', 'Status'];
  const rows = filtered.map(request => [
    request.applicant_name || 'Applicant record not found',
    request.application_id || '',
    request.reason || '',
    request.other_reason || '',
    formatReplacementDate(request.requested_at),
    request.request_status || 'Pending'
  ]);

  try {
    if (typeof recordStaffDataActivity === 'function') {
      await recordStaffDataActivity('DATA_EXPORTED', 'Staff replacement requests', format.toUpperCase(), rows.length);
    }
    if (typeof downloadReportFile !== 'function') {
      throw new Error('The export service is unavailable. Refresh the page and try again.');
    }
    downloadReportFile(format, 'OSCA Replacement Requests', headers, rows, 'osca-replacement-requests');
    if (typeof appendAudit === 'function') {
      appendAudit(CURRENT_USER?.displayName || 'Staff', 'Exported replacement requests (' + format.toUpperCase() + ')', 'System');
    }
    showToast(format.toUpperCase() + ' replacement report exported (' + rows.length + ' requests).', 'success');
  } catch (error) {
    console.error('[Replacement Export]', error);
    showToast(error.message || 'Unable to export replacement requests.', 'error');
  }
}


let activeReplacementRequestId = null;

function closeReplacementRequest() {
  document.getElementById('replacement-request-modal')
    ?.classList.remove('show');

  activeReplacementRequestId = null;
}

function viewReplacementRequest(requestId) {
  const request = replacementRequests.find(
    item => Number(item.id) === Number(requestId)
  );

  if (!request) {
    if (typeof showToast === 'function') {
      showToast('Request not found. Refresh the list.', 'error');
    }
    return;
  }

  activeReplacementRequestId = Number(request.id);

  const details = document.getElementById(
    'replacement-modal-details'
  );

  details.innerHTML = `
    <div style="display:grid;gap:12px">
      <div>
        <small>Applicant</small>
        <div><strong>${escapeReplacementText(
          request.applicant_name || 'Applicant record not found'
        )}</strong></div>
      </div>
      <div>
        <small>Application ID</small>
        <div><strong>${escapeReplacementText(
          request.application_id || '—'
        )}</strong></div>
      </div>
      <div>
        <small>Reason</small>
        <div>${escapeReplacementText(request.reason || '—')}</div>
      </div>
      <div>
        <small>Additional details</small>
        <div>${escapeReplacementText(request.other_reason || '—')}</div>
      </div>
      <div>
        <small>Request date</small>
        <div>${formatReplacementDate(request.requested_at)}</div>
      </div>
      <div>
        <small>Current request status</small>
        <div><strong>${escapeReplacementText(
          request.request_status || 'Unknown'
        )}</strong></div>
      </div>
    </div>
  `;

  const select = document.getElementById(
    'replacement-decision-select'
  );

  const submit = document.getElementById(
    'replacement-decision-submit'
  );

  const isPending =
    String(request.request_status || '').toLowerCase() === 'pending';

  select.value = '';
  select.disabled = !isPending;
  submit.disabled = !isPending;
  submit.textContent = isPending ? 'Save decision' : 'Already decided';

  const error = document.getElementById('replacement-decision-error');
  error.style.display = 'none';
  error.textContent = '';

  document.getElementById('replacement-request-modal')
    ?.classList.add('show');
}

async function submitReplacementDecision() {
  if (!activeReplacementRequestId) return;

  const select = document.getElementById(
    'replacement-decision-select'
  );

  const submit = document.getElementById(
    'replacement-decision-submit'
  );

  const error = document.getElementById(
    'replacement-decision-error'
  );

  const decision = select.value;

  const allowedStatuses = [
    'Pending',
    'Under Review',
    'In Process',
    'Ready for Release',
    'Completed',
    'Rejected'
  ];

  if (!allowedStatuses.includes(decision)) {
    error.textContent = 'Please select a valid application status.';
    error.style.display = 'block';
    return;
  }

  const requestId = activeReplacementRequestId;

  submit.disabled = true;
  submit.textContent = 'Saving...';
  error.style.display = 'none';

  try {
    const response = await fetch(
      REPLACEMENTS_API + '/' +
      encodeURIComponent(requestId) + '/decision',
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: decision })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Failed to save the request decision.'
      );
    }

    closeReplacementRequest();

    if (typeof showToast === 'function') {
      showToast(result.message || 'Decision saved.', 'success');
    }

    await loadReplacementRequests();
  } catch (err) {
    error.textContent = err.message || 'Unable to save the decision.';
    error.style.display = 'block';
  } finally {
    if (document.getElementById('replacement-request-modal')
        ?.classList.contains('show')) {
      submit.disabled = false;
      submit.textContent = 'Save decision';
    }
  }
}

window.viewReplacementRequest = viewReplacementRequest;
window.closeReplacementRequest = closeReplacementRequest;
window.submitReplacementDecision = submitReplacementDecision;

/* ============================================================
   HISTORICAL APPLICANT RECORD IMPORT
   CSV + searchable PDF, flexible source-column mapping, preview,
   duplicate screening, and protected 100-row API batches.
   ============================================================ */
const APPLICANT_IMPORT_FIELDS = [
  { key: "", label: "Do not import this column", aliases: [] },
  { key: "application_id", label: "Internal Application ID (only if already assigned)", aliases: ["internal application id", "system application id", "record application id"] },
  { key: "first_name", label: "First name", aliases: ["first name", "firstname", "given name", "given names", "first", "pangalan"] },
  { key: "middle_name", label: "Middle name", aliases: ["middle name", "middlename", "middle initial", "middle", "second name"] },
  { key: "surname", label: "Surname / Last name", aliases: ["surname", "last name", "lastname", "family name", "family", "apelyido"] },
  { key: "full_name", label: "Full name (split automatically)", aliases: ["full name", "complete name", "name of applicant", "applicant name", "senior citizen name", "name"] },
  { key: "date_of_birth", label: "Date of birth", aliases: ["date of birth", "date birth", "birth date", "dob", "birthday", "birthdate"] },
  { key: "sex", label: "Sex / Gender", aliases: ["sex", "gender"] },
  { key: "age", label: "Age", aliases: ["age", "edad"] },
  { key: "house_street", label: "House / Street / Address", aliases: ["house street", "house number", "street", "street address", "address", "complete address", "residential address"] },
  { key: "barangay_district", label: "Barangay / District", aliases: ["barangay", "barangay district", "district", "baranggay", "brgy", "brgy district"] },
  { key: "contact_number", label: "Contact number", aliases: ["contact number", "contact no", "mobile number", "phone number", "telephone", "cellphone", "mobile", "phone"] },
  { key: "membership_status", label: "Membership status (Active / Deceased)", aliases: ["membership status", "member status", "senior status"] },
  { key: "registration_date", label: "Original registration date", aliases: ["registration date", "date registered", "date of registration", "date issued", "registered date", "date entered"] }
];


// Additional columns available on the applications table.
APPLICANT_IMPORT_FIELDS.push(
  { key: "place_of_birth", label: "Place of birth", aliases: ["place of birth", "birthplace"] },
  { key: "civil_status", label: "Civil status", aliases: ["civil status", "marital status"] },
  { key: "educational_attainment", label: "Educational attainment", aliases: ["educational attainment", "education", "highest education"] },
  { key: "religion", label: "Religion", aliases: ["religion", "religious affiliation"] },
  { key: "religion_specify", label: "Religion (specify)", aliases: ["religion specify", "other religion"] },
  { key: "occupation", label: "Occupation", aliases: ["occupation", "previous occupation", "work"] },
  { key: "osca_id_number", label: "Official OSCA ID number", aliases: ["osca id", "osca id number", "osca number", "senior citizen id", "senior id", "id number", "id no", "registry number", "registry no", "control number"] },
  { key: "sss_id_number", label: "SSS ID number", aliases: ["sss id", "sss number"] },
  { key: "philhealth_id_number", label: "PhilHealth ID number", aliases: ["philhealth id", "philhealth number"] },
  { key: "gsis_id_number", label: "GSIS ID number", aliases: ["gsis id", "gsis number"] },
  { key: "tin_id_number", label: "TIN ID number", aliases: ["tin id", "tin number", "tax identification number"] },
  { key: "application_type", label: "Application type", aliases: ["application type", "record type"] }
);

// Related-table fields use the real Supabase schema. They are optional and
// are inserted only when the source file provides a value.
APPLICANT_IMPORT_FIELDS.push(
  { key: "family_composition.name", label: "Name", table: "family_composition", column: "name", aliases: ["name","name"] },
  { key: "family_composition.relationship", label: "Relationship", table: "family_composition", column: "relationship", aliases: ["relationship","relationship"] },
  { key: "family_composition.age", label: "Age", table: "family_composition", column: "age", aliases: ["age","age"] },
  { key: "family_composition.civil_status", label: "Civil Status", table: "family_composition", column: "civil_status", aliases: ["civil status","civil_status"] },
  { key: "family_composition.occupation", label: "Occupation", table: "family_composition", column: "occupation", aliases: ["occupation","occupation"] },
  { key: "family_composition.income", label: "Income", table: "family_composition", column: "income", aliases: ["income","income"] },
  { key: "memberships.association_name", label: "Association Name", table: "memberships", column: "association_name", aliases: ["association name","association_name"] },
  { key: "memberships.association_address", label: "Association Address", table: "memberships", column: "association_address", aliases: ["association address","association_address"] },
  { key: "memberships.association_date", label: "Association Date", table: "memberships", column: "association_date", aliases: ["association date","association_date"] },
  { key: "memberships.position", label: "Position", table: "memberships", column: "position", aliases: ["position","position"] },
  { key: "personal_background.income_own_earnings", label: "Income Own Earnings", table: "personal_background", column: "income_own_earnings", aliases: ["income own earnings","income_own_earnings"] },
  { key: "personal_background.income_own_pension", label: "Income Own Pension", table: "personal_background", column: "income_own_pension", aliases: ["income own pension","income_own_pension"] },
  { key: "personal_background.income_stocks_dividends", label: "Income Stocks Dividends", table: "personal_background", column: "income_stocks_dividends", aliases: ["income stocks dividends","income_stocks_dividends"] },
  { key: "personal_background.income_dependent_children", label: "Income Dependent Children", table: "personal_background", column: "income_dependent_children", aliases: ["income dependent children","income_dependent_children"] },
  { key: "personal_background.income_spouse_salary", label: "Income Spouse Salary", table: "personal_background", column: "income_spouse_salary", aliases: ["income spouse salary","income_spouse_salary"] },
  { key: "personal_background.income_insurance", label: "Income Insurance", table: "personal_background", column: "income_insurance", aliases: ["income insurance","income_insurance"] },
  { key: "personal_background.income_rentals_sharecrops", label: "Income Rentals Sharecrops", table: "personal_background", column: "income_rentals_sharecrops", aliases: ["income rentals sharecrops","income_rentals_sharecrops"] },
  { key: "personal_background.income_savings", label: "Income Savings", table: "personal_background", column: "income_savings", aliases: ["income savings","income_savings"] },
  { key: "personal_background.income_livestock_crop", label: "Income Livestock Crop", table: "personal_background", column: "income_livestock_crop", aliases: ["income livestock crop","income_livestock_crop"] },
  { key: "personal_background.income_other", label: "Income Other", table: "personal_background", column: "income_other", aliases: ["income other","income_other"] },
  { key: "personal_background.asset_house", label: "Asset House", table: "personal_background", column: "asset_house", aliases: ["asset house","asset_house"] },
  { key: "personal_background.asset_lot", label: "Asset Lot", table: "personal_background", column: "asset_lot", aliases: ["asset lot","asset_lot"] },
  { key: "personal_background.asset_farmland", label: "Asset Farmland", table: "personal_background", column: "asset_farmland", aliases: ["asset farmland","asset_farmland"] },
  { key: "personal_background.asset_fishponds_resorts", label: "Asset Fishponds Resorts", table: "personal_background", column: "asset_fishponds_resorts", aliases: ["asset fishponds resorts","asset_fishponds_resorts"] },
  { key: "personal_background.asset_commercial_building", label: "Asset Commercial Building", table: "personal_background", column: "asset_commercial_building", aliases: ["asset commercial building","asset_commercial_building"] },
  { key: "personal_background.asset_other", label: "Asset Other", table: "personal_background", column: "asset_other", aliases: ["asset other","asset_other"] },
  { key: "personal_background.living_alone", label: "Living Alone", table: "personal_background", column: "living_alone", aliases: ["living alone","living_alone"] },
  { key: "personal_background.living_spouse", label: "Living Spouse", table: "personal_background", column: "living_spouse", aliases: ["living spouse","living_spouse"] },
  { key: "personal_background.living_care_institution", label: "Living Care Institution", table: "personal_background", column: "living_care_institution", aliases: ["living care institution","living_care_institution"] },
  { key: "personal_background.living_children", label: "Living Children", table: "personal_background", column: "living_children", aliases: ["living children","living_children"] },
  { key: "personal_background.living_friends", label: "Living Friends", table: "personal_background", column: "living_friends", aliases: ["living friends","living_friends"] },
  { key: "personal_background.living_common_law_spouse", label: "Living Common Law Spouse", table: "personal_background", column: "living_common_law_spouse", aliases: ["living common law spouse","living_common_law_spouse"] },
  { key: "personal_background.living_grandchildren", label: "Living Grandchildren", table: "personal_background", column: "living_grandchildren", aliases: ["living grandchildren","living_grandchildren"] },
  { key: "personal_background.living_households", label: "Living Households", table: "personal_background", column: "living_households", aliases: ["living households","living_households"] },
  { key: "personal_background.living_relatives", label: "Living Relatives", table: "personal_background", column: "living_relatives", aliases: ["living relatives","living_relatives"] },
  { key: "personal_background.living_in_laws", label: "Living In Laws", table: "personal_background", column: "living_in_laws", aliases: ["living in laws","living_in_laws"] },
  { key: "personal_background.living_other", label: "Living Other", table: "personal_background", column: "living_other", aliases: ["living other","living_other"] },
  { key: "personal_background.skill_medical", label: "Skill Medical", table: "personal_background", column: "skill_medical", aliases: ["skill medical","skill_medical"] },
  { key: "personal_background.skill_dental", label: "Skill Dental", table: "personal_background", column: "skill_dental", aliases: ["skill dental","skill_dental"] },
  { key: "personal_background.skill_farming", label: "Skill Farming", table: "personal_background", column: "skill_farming", aliases: ["skill farming","skill_farming"] },
  { key: "personal_background.skill_arts", label: "Skill Arts", table: "personal_background", column: "skill_arts", aliases: ["skill arts","skill_arts"] },
  { key: "personal_background.skill_teaching", label: "Skill Teaching", table: "personal_background", column: "skill_teaching", aliases: ["skill teaching","skill_teaching"] },
  { key: "personal_background.skill_counseling", label: "Skill Counseling", table: "personal_background", column: "skill_counseling", aliases: ["skill counseling","skill_counseling"] },
  { key: "personal_background.skill_fishing", label: "Skill Fishing", table: "personal_background", column: "skill_fishing", aliases: ["skill fishing","skill_fishing"] },
  { key: "personal_background.skill_engineering", label: "Skill Engineering", table: "personal_background", column: "skill_engineering", aliases: ["skill engineering","skill_engineering"] },
  { key: "personal_background.skill_legal_services", label: "Skill Legal Services", table: "personal_background", column: "skill_legal_services", aliases: ["skill legal services","skill_legal_services"] },
  { key: "personal_background.skill_evangelization", label: "Skill Evangelization", table: "personal_background", column: "skill_evangelization", aliases: ["skill evangelization","skill_evangelization"] },
  { key: "personal_background.skill_cooking", label: "Skill Cooking", table: "personal_background", column: "skill_cooking", aliases: ["skill cooking","skill_cooking"] },
  { key: "personal_background.skill_vocational", label: "Skill Vocational", table: "personal_background", column: "skill_vocational", aliases: ["skill vocational","skill_vocational"] },
  { key: "personal_background.skill_other", label: "Skill Other", table: "personal_background", column: "skill_other", aliases: ["skill other","skill_other"] },
  { key: "personal_background.involvement_medical", label: "Involvement Medical", table: "personal_background", column: "involvement_medical", aliases: ["involvement medical","involvement_medical"] },
  { key: "personal_background.involvement_dental", label: "Involvement Dental", table: "personal_background", column: "involvement_dental", aliases: ["involvement dental","involvement_dental"] },
  { key: "personal_background.involvement_religious", label: "Involvement Religious", table: "personal_background", column: "involvement_religious", aliases: ["involvement religious","involvement_religious"] },
  { key: "personal_background.involvement_sportsmanship", label: "Involvement Sportsmanship", table: "personal_background", column: "involvement_sportsmanship", aliases: ["involvement sportsmanship","involvement_sportsmanship"] },
  { key: "personal_background.involvement_resource_volunteer", label: "Involvement Resource Volunteer", table: "personal_background", column: "involvement_resource_volunteer", aliases: ["involvement resource volunteer","involvement_resource_volunteer"] },
  { key: "personal_background.involvement_friendly_visits", label: "Involvement Friendly Visits", table: "personal_background", column: "involvement_friendly_visits", aliases: ["involvement friendly visits","involvement_friendly_visits"] },
  { key: "personal_background.involvement_counseling_referral", label: "Involvement Counseling Referral", table: "personal_background", column: "involvement_counseling_referral", aliases: ["involvement counseling referral","involvement_counseling_referral"] },
  { key: "personal_background.involvement_legal_services", label: "Involvement Legal Services", table: "personal_background", column: "involvement_legal_services", aliases: ["involvement legal services","involvement_legal_services"] },
  { key: "personal_background.involvement_community_leader", label: "Involvement Community Leader", table: "personal_background", column: "involvement_community_leader", aliases: ["involvement community leader","involvement_community_leader"] },
  { key: "personal_background.involvement_other", label: "Involvement Other", table: "personal_background", column: "involvement_other", aliases: ["involvement other","involvement_other"] },
  { key: "personal_background.income_other_specify", label: "Income Other Specify", table: "personal_background", column: "income_other_specify", aliases: ["income other specify","income_other_specify"] },
  { key: "personal_background.asset_other_specify", label: "Asset Other Specify", table: "personal_background", column: "asset_other_specify", aliases: ["asset other specify","asset_other_specify"] },
  { key: "personal_background.monthly_income", label: "Monthly Income", table: "personal_background", column: "monthly_income", aliases: ["monthly income","monthly_income"] },
  { key: "personal_background.living_other_specify", label: "Living Other Specify", table: "personal_background", column: "living_other_specify", aliases: ["living other specify","living_other_specify"] },
  { key: "personal_background.skill_other_specify", label: "Skill Other Specify", table: "personal_background", column: "skill_other_specify", aliases: ["skill other specify","skill_other_specify"] },
  { key: "personal_background.involvement_other_specify", label: "Involvement Other Specify", table: "personal_background", column: "involvement_other_specify", aliases: ["involvement other specify","involvement_other_specify"] },
  { key: "problems_needs.economic_lack_income", label: "Economic Lack Income", table: "problems_needs", column: "economic_lack_income", aliases: ["economic lack income","economic_lack_income"] },
  { key: "problems_needs.economic_skills_training", label: "Economic Skills Training", table: "problems_needs", column: "economic_skills_training", aliases: ["economic skills training","economic_skills_training"] },
  { key: "problems_needs.economic_livelihood", label: "Economic Livelihood", table: "problems_needs", column: "economic_livelihood", aliases: ["economic livelihood","economic_livelihood"] },
  { key: "problems_needs.economic_other", label: "Economic Other", table: "problems_needs", column: "economic_other", aliases: ["economic other","economic_other"] },
  { key: "problems_needs.social_neglect_rejection", label: "Social Neglect Rejection", table: "problems_needs", column: "social_neglect_rejection", aliases: ["social neglect rejection","social_neglect_rejection"] },
  { key: "problems_needs.social_helplessness", label: "Social Helplessness", table: "problems_needs", column: "social_helplessness", aliases: ["social helplessness","social_helplessness"] },
  { key: "problems_needs.social_loneliness", label: "Social Loneliness", table: "problems_needs", column: "social_loneliness", aliases: ["social loneliness","social_loneliness"] },
  { key: "problems_needs.social_inadequate_recreation", label: "Social Inadequate Recreation", table: "problems_needs", column: "social_inadequate_recreation", aliases: ["social inadequate recreation","social_inadequate_recreation"] },
  { key: "problems_needs.social_senior_friendly_environment", label: "Social Senior Friendly Environment", table: "problems_needs", column: "social_senior_friendly_environment", aliases: ["social senior friendly environment","social_senior_friendly_environment"] },
  { key: "problems_needs.social_other", label: "Social Other", table: "problems_needs", column: "social_other", aliases: ["social other","social_other"] },
  { key: "problems_needs.health_high_cost_medicine", label: "Health High Cost Medicine", table: "problems_needs", column: "health_high_cost_medicine", aliases: ["health high cost medicine","health_high_cost_medicine"] },
  { key: "problems_needs.health_lack_medical_professionals", label: "Health Lack Medical Professionals", table: "problems_needs", column: "health_lack_medical_professionals", aliases: ["health lack medical professionals","health_lack_medical_professionals"] },
  { key: "problems_needs.health_no_sanitation", label: "Health No Sanitation", table: "problems_needs", column: "health_no_sanitation", aliases: ["health no sanitation","health_no_sanitation"] },
  { key: "problems_needs.health_no_insurance", label: "Health No Insurance", table: "problems_needs", column: "health_no_insurance", aliases: ["health no insurance","health_no_insurance"] },
  { key: "problems_needs.health_lack_hospital", label: "Health Lack Hospital", table: "problems_needs", column: "health_lack_hospital", aliases: ["health lack hospital","health_lack_hospital"] },
  { key: "problems_needs.health_problem", label: "Health Problem", table: "problems_needs", column: "health_problem", aliases: ["health problem","health_problem"] },
  { key: "problems_needs.housing_overcrowding", label: "Housing Overcrowding", table: "problems_needs", column: "housing_overcrowding", aliases: ["housing overcrowding","housing_overcrowding"] },
  { key: "problems_needs.housing_no_permanent_home", label: "Housing No Permanent Home", table: "problems_needs", column: "housing_no_permanent_home", aliases: ["housing no permanent home","housing_no_permanent_home"] },
  { key: "problems_needs.housing_independent_living", label: "Housing Independent Living", table: "problems_needs", column: "housing_independent_living", aliases: ["housing independent living","housing_independent_living"] },
  { key: "problems_needs.housing_lost_privacy", label: "Housing Lost Privacy", table: "problems_needs", column: "housing_lost_privacy", aliases: ["housing lost privacy","housing_lost_privacy"] },
  { key: "problems_needs.housing_squatter_area", label: "Housing Squatter Area", table: "problems_needs", column: "housing_squatter_area", aliases: ["housing squatter area","housing_squatter_area"] },
  { key: "problems_needs.housing_high_rental", label: "Housing High Rental", table: "problems_needs", column: "housing_high_rental", aliases: ["housing high rental","housing_high_rental"] },
  { key: "problems_needs.housing_other", label: "Housing Other", table: "problems_needs", column: "housing_other", aliases: ["housing other","housing_other"] },
  { key: "problems_needs.community_desire_participate", label: "Community Desire Participate", table: "problems_needs", column: "community_desire_participate", aliases: ["community desire participate","community_desire_participate"] },
  { key: "problems_needs.community_skills_to_share", label: "Community Skills To Share", table: "problems_needs", column: "community_skills_to_share", aliases: ["community skills to share","community_skills_to_share"] },
  { key: "problems_needs.community_other", label: "Community Other", table: "problems_needs", column: "community_other", aliases: ["community other","community_other"] },
  { key: "problems_needs.economic_skills_training_specify", label: "Economic Skills Training Specify", table: "problems_needs", column: "economic_skills_training_specify", aliases: ["economic skills training specify","economic_skills_training_specify"] },
  { key: "problems_needs.economic_livelihood_specify", label: "Economic Livelihood Specify", table: "problems_needs", column: "economic_livelihood_specify", aliases: ["economic livelihood specify","economic_livelihood_specify"] },
  { key: "problems_needs.economic_other_specify", label: "Economic Other Specify", table: "problems_needs", column: "economic_other_specify", aliases: ["economic other specify","economic_other_specify"] },
  { key: "problems_needs.social_other_specify", label: "Social Other Specify", table: "problems_needs", column: "social_other_specify", aliases: ["social other specify","social_other_specify"] },
  { key: "problems_needs.health_problem_specify", label: "Health Problem Specify", table: "problems_needs", column: "health_problem_specify", aliases: ["health problem specify","health_problem_specify"] },
  { key: "problems_needs.housing_other_specify", label: "Housing Other Specify", table: "problems_needs", column: "housing_other_specify", aliases: ["housing other specify","housing_other_specify"] },
  { key: "problems_needs.community_other_specify", label: "Community Other Specify", table: "problems_needs", column: "community_other_specify", aliases: ["community other specify","community_other_specify"] },
  { key: "problems_needs.other_specific_needs", label: "Other Specific Needs", table: "problems_needs", column: "other_specific_needs", aliases: ["other specific needs","other_specific_needs"] },
  { key: "application_files.valid_id_url", label: "Valid Id Url", table: "application_files", column: "valid_id_url", aliases: ["valid id url","valid_id_url"] },
  { key: "application_files.latest_photo_url", label: "Latest Photo Url", table: "application_files", column: "latest_photo_url", aliases: ["latest photo url","latest_photo_url"] },
  { key: "application_files.birth_certificate_url", label: "Birth Certificate Url", table: "application_files", column: "birth_certificate_url", aliases: ["birth certificate url","birth_certificate_url"] },
  { key: "application_files.community_tax_certificate_url", label: "Community Tax Certificate Url", table: "application_files", column: "community_tax_certificate_url", aliases: ["community tax certificate url","community_tax_certificate_url"] },
  { key: "application_files.signature_url", label: "Signature Url", table: "application_files", column: "signature_url", aliases: ["signature url","signature_url"] },
  { key: "application_files.application_date", label: "Application Date", table: "application_files", column: "application_date", aliases: ["application date","application_date"] },
  { key: "application_files.valid_id_back_url", label: "Valid Id Back Url", table: "application_files", column: "valid_id_back_url", aliases: ["valid id back url","valid_id_back_url"] },
  { key: "application_files.authentication_status", label: "Authentication Status", table: "application_files", column: "authentication_status", aliases: ["authentication status","authentication_status"] },
  { key: "application_files.authentication_method", label: "Authentication Method", table: "application_files", column: "authentication_method", aliases: ["authentication method","authentication_method"] },
  { key: "application_files.authentication_remarks", label: "Authentication Remarks", table: "application_files", column: "authentication_remarks", aliases: ["authentication remarks","authentication_remarks"] },
  { key: "application_files.supporting_document_type", label: "Supporting Document Type", table: "application_files", column: "supporting_document_type", aliases: ["supporting document type","supporting_document_type"] },
  { key: "application_status_history.status", label: "Application Status", table: "application_status_history", column: "status", aliases: ["application status","status","registration status","record status"] },
  { key: "application_status_history.updated_at", label: "Status Updated At", table: "application_status_history", column: "updated_at", aliases: ["status updated at","updated at","updated_at"] }
);

let APPLICANT_IMPORT_STATE = {
  fileName: "",
  headers: [],
  rows: [],
  mapping: {},
  imported: false,
  busy: false
};

function normalizeApplicantImportHeader(value) {
  return String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\\s+/g, " ");
}

function parseApplicantCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiters = [",", ";", "\t"];
  let delimiter = ",";
  let delimiterCount = -1;
  delimiters.forEach(candidate => {
    const count = firstLine.split(candidate).length - 1;
    if (count > delimiterCount) {
      delimiter = candidate;
      delimiterCount = count;
    }
  });

  const matrix = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(value => value !== "")) matrix.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(value => value !== "")) matrix.push(row);
  if (matrix.length < 2) {
    throw new Error("The CSV file must contain a header row and at least one applicant record.");
  }
  const headers = matrix[0].map((value, index) => value || ("Column " + (index + 1)));
  const rows = matrix.slice(1).map(values => headers.map((_, index) => values[index] || ""));
  return { headers, rows };
}

function loadApplicantTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (window.__applicantTesseractPromise) return window.__applicantTesseractPromise;

  window.__applicantTesseractPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => window.Tesseract
      ? resolve(window.Tesseract)
      : reject(new Error("The PDF OCR engine did not initialize."));
    script.onerror = () => reject(new Error("Unable to load the local PDF OCR engine. Please use a searchable PDF or CSV."));
    document.head.appendChild(script);
  });
  return window.__applicantTesseractPromise;
}

async function parseApplicantPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error("The PDF reader did not load. Refresh the page and try again, or save the PDF as CSV.");
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  if (pdf.numPages > 100) {
    throw new Error("This PDF has more than 100 pages. Split it into smaller PDF files before importing.");
  }

  const matrix = [];
  let extractedItemCount = 0;
  let ocrWorker = null;
  const meta = document.getElementById("applicant-import-file-meta");

  const appendTextPage = (items) => {
    const lines = [];
    items.forEach(item => {
      const x = Number(item.transform && item.transform[4] || 0);
      const y = Number(item.transform && item.transform[5] || 0);
      const fontSize = Math.max(6, Math.abs(Number(item.transform && item.transform[3] || 10)));
      let line = lines.find(candidate => Math.abs(candidate.y - y) <= Math.max(2, fontSize * 0.28));
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x, width: Number(item.width || 0), fontSize, text: String(item.str || "").trim() });
    });

    lines.sort((a, b) => b.y - a.y);
    lines.forEach(line => {
      line.items.sort((a, b) => a.x - b.x);
      const cells = [];
      let current = null;
      line.items.forEach(item => {
        if (!current) {
          current = { end: item.x + item.width, text: item.text, fontSize: item.fontSize };
          cells.push(current);
          return;
        }
        const gap = item.x - current.end;
        const threshold = Math.max(16, Math.min(38, current.fontSize * 1.8));
        if (gap > threshold) {
          current = { end: item.x + item.width, text: item.text, fontSize: item.fontSize };
          cells.push(current);
        } else {
          current.text += (gap > 2 ? " " : "") + item.text;
          current.end = Math.max(current.end, item.x + item.width);
        }
      });
      const values = cells.map(cell => cell.text.trim());
      if (values.some(Boolean)) matrix.push(values);
    });
  };

  const appendOcrPage = async (page) => {
    if (!ocrWorker) {
      const Tesseract = await loadApplicantTesseract();
      ocrWorker = await Tesseract.createWorker("eng");
    }
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const recognized = await ocrWorker.recognize(canvas);
    const lines = recognized.data.lines || [];
    lines.sort((a, b) => Number(a.bbox?.y0 || 0) - Number(b.bbox?.y0 || 0));
    lines.forEach(line => {
      const words = (line.words || [])
        .filter(word => String(word.text || "").trim())
        .sort((a, b) => Number(a.bbox?.x0 || 0) - Number(b.bbox?.x0 || 0));
      if (!words.length) {
        const text = String(line.text || "").trim();
        if (text) matrix.push([text]);
        return;
      }
      const cells = [];
      let current = null;
      words.forEach(word => {
        const x0 = Number(word.bbox?.x0 || 0);
        const x1 = Number(word.bbox?.x1 || x0);
        const wordText = String(word.text || "").trim();
        if (!current) {
          current = { x1, text: wordText };
          cells.push(current);
          return;
        }
        const gap = x0 - current.x1;
        if (gap > 55) {
          current = { x1, text: wordText };
          cells.push(current);
        } else {
          current.text += " " + wordText;
          current.x1 = Math.max(current.x1, x1);
        }
      });
      const values = cells.map(cell => cell.text.trim());
      if (values.some(Boolean)) matrix.push(values);
    });
    canvas.width = 1;
    canvas.height = 1;
  };

  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      if (meta) meta.textContent = "Reading PDF page " + pageNo + " of " + pdf.numPages + "…";
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const items = (content.items || []).filter(item => String(item.str || "").trim());
      extractedItemCount += items.length;

      // If a page contains no selectable text, OCR it locally in the browser.
      if (items.length < 8) {
        if (pdf.numPages > 30) {
          throw new Error("This scanned PDF has more than 30 pages. Split it into smaller files before OCR import.");
        }
        if (meta) meta.textContent = "Reading scanned page " + pageNo + " of " + pdf.numPages + " with local OCR…";
        await appendOcrPage(page);
      } else {
        appendTextPage(items);
      }
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
  }

  if (!extractedItemCount && matrix.length === 0) {
    throw new Error("No text could be extracted from this PDF. Please check that the scan is readable.");
  }
  if (matrix.length < 2) {
    throw new Error("The PDF text could not be arranged into a table. Please export this record list as CSV.");
  }

  const widest = Math.max.apply(null, matrix.map(row => row.length));
  const normalized = matrix.map(row => Array.from({ length: widest }, (_, index) => row[index] || ""));
  const scoreHeader = row => {
    const joined = normalizeApplicantImportHeader(row.join(" "));
    return APPLICANT_IMPORT_FIELDS.reduce((score, field) => {
      if (!field.key) return score;
      return score + field.aliases.filter(alias => joined.includes(normalizeApplicantImportHeader(alias))).length;
    }, 0);
  };

  let headerIndex = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(20, normalized.length); i += 1) {
    const score = scoreHeader(normalized[i]);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
  if (normalized.length - headerIndex < 2) {
    throw new Error("No applicant table rows were detected in this PDF. Please export it as CSV.");
  }
  const headers = normalized[headerIndex].map((value, index) => value || ("Column " + (index + 1)));
  const rows = normalized.slice(headerIndex + 1).filter(row => row.some(value => String(value).trim()));
  return { headers, rows };
}

function guessApplicantImportTarget(header) {
  const normalized = normalizeApplicantImportHeader(header);
  let best = "";
  let bestScore = 0;
  APPLICANT_IMPORT_FIELDS.forEach(field => {
    if (!field.key) return;
    const candidateAliases = [...(field.aliases || []), field.column || "", field.label || ""];
    candidateAliases.filter(Boolean).forEach(alias => {
      const value = normalizeApplicantImportHeader(alias);
      let score = 0;
      if (normalized === value) score = 100;
      else if (normalized.includes(value) || value.includes(normalized)) score = Math.min(85, value.length * 2);
      if (score > bestScore) {
        bestScore = score;
        best = field.key;
      }
    });
  });
  return bestScore >= 8 ? best : "";
}

function escapeApplicantImportHtml(value) {
  return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function hasValidApplicantImportMapping() {
  const fields = Object.values(APPLICANT_IMPORT_STATE.mapping);
  const hasFullName = fields.includes("full_name");
  return (fields.includes("first_name") && fields.includes("surname")) || hasFullName;
}

function normalizeApplicantImportDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw;

  const format = document.getElementById("applicant-import-date-format")?.value || "auto";
  const ymd = raw.match(/^(\\d{4})[/.-](\\d{1,2})[/.-](\\d{1,2})$/);
  if (ymd) {
    const date = new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
    return !Number.isNaN(date.getTime()) &&
      date.getUTCFullYear() === Number(ymd[1]) &&
      date.getUTCMonth() === Number(ymd[2]) - 1 &&
      date.getUTCDate() === Number(ymd[3])
      ? date.toISOString().slice(0, 10) : "";
  }

  const numericDate = raw.match(/^(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2,4})$/);
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    let year = Number(numericDate[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    let day, month;

    if (format === "MDY" || (format === "auto" && second > 12 && first <= 12)) {
      month = first;
      day = second;
    } else if (format === "DMY" || (format === "auto" && first > 12 && second <= 12)) {
      day = first;
      month = second;
    } else {
      // Philippine records commonly use day/month/year when ambiguous.
      day = first;
      month = second;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime()) && date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return date.toISOString().slice(0, 10);
    }
  }

  if (/^\\d+(\\.\\d+)?$/.test(raw) && Number(raw) > 15000 && Number(raw) < 90000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(Number(raw)) * 86400000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function getApplicantImportMappedRow(row) {
  const mapped = {};
  Object.entries(APPLICANT_IMPORT_STATE.mapping).forEach(([column, field]) => {
    if (!field) return;
    const value = String(row[Number(column)] === undefined ? "" : row[Number(column)]).trim();
    if (!value) return;
    if (field.includes(".")) {
      const [table, columnName] = field.split(".");
      if (!mapped._related) mapped._related = {};
      if (!mapped._related[table]) mapped._related[table] = {};
      mapped._related[table][columnName] = value;
    } else {
      mapped[field] = value;
    }
  });
  if (mapped.full_name && (!mapped.first_name || !mapped.surname)) {
    const parts = mapped.full_name.replace(/\\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!mapped.first_name && parts.length) mapped.first_name = parts.shift();
    if (!mapped.surname && parts.length) mapped.surname = parts.pop();
    if (!mapped.middle_name && parts.length) mapped.middle_name = parts.join(" ");
  }
  if (mapped.date_of_birth) {
    const originalDob = mapped.date_of_birth;
    mapped.date_of_birth = normalizeApplicantImportDate(originalDob);
    mapped._invalidDateOfBirth = !mapped.date_of_birth;
  }
  if (mapped.registration_date) {
    const originalRegistrationDate = mapped.registration_date;
    mapped.registration_date = normalizeApplicantImportDate(originalRegistrationDate);
    mapped._invalidRegistrationDate = !mapped.registration_date;
  }
  if (mapped.age) mapped.age = mapped.age.replace(/[^0-9.]/g, "");
  if (mapped.sex) {
    const sex = normalizeApplicantImportHeader(mapped.sex);
    if (["m", "male"].includes(sex)) mapped.sex = "Male";
    else if (["f", "female"].includes(sex)) mapped.sex = "Female";
  }
  if (mapped.membership_status) {
    const status = normalizeApplicantImportHeader(mapped.membership_status);
    mapped.membership_status = status.includes("deceased") || status.includes("dead") ? "Deceased" : "Active";
  }
  return mapped;
}

function getApplicantImportDuplicateKey(row) {
  const first = normalizeApplicantImportHeader(row.first_name);
  const last = normalizeApplicantImportHeader(row.surname);
  const dob = String(row.date_of_birth || "").trim();
  const barangay = normalizeApplicantImportHeader(row.barangay_district);
  return first && last && dob ? [first, last, dob, barangay].join("|") : "";
}

function isApplicantImportRepeatedHeader(row) {
  const first = normalizeApplicantImportHeader(row.first_name);
  const last = normalizeApplicantImportHeader(row.surname);
  return ["first name", "firstname", "given name", "first"].includes(first) &&
    ["surname", "last name", "lastname", "family name"].includes(last);
}

function renderApplicantImportPreview() {
  const preview = document.getElementById("applicant-import-preview");
  const summary = document.getElementById("applicant-import-summary");
  const submit = document.getElementById("applicant-import-submit");
  if (!preview) return;

  const mappedRows = APPLICANT_IMPORT_STATE.rows.map(row => getApplicantImportMappedRow(row));
  const validRows = mappedRows.filter(row =>
    row.first_name && row.surname && row.date_of_birth &&
    !row._invalidDateOfBirth &&
    !row._invalidRegistrationDate &&
    !isApplicantImportRepeatedHeader(row)
  );
  const invalid = mappedRows.length - validRows.length;
  const selectedFields = [];
  APPLICANT_IMPORT_FIELDS.forEach(field => {
    if (field.key && Object.values(APPLICANT_IMPORT_STATE.mapping).includes(field.key)) selectedFields.push(field);
  });

  const existingIds = new Set((LIVE_APPLICATIONS || [])
    .map(app => String(app.application_id || "").trim().toLowerCase()).filter(Boolean));
  const existingKeys = new Set((LIVE_APPLICATIONS || [])
    .map(app => getApplicantImportDuplicateKey(app)).filter(Boolean));
  const seenInFile = new Set();
  let possibleDuplicates = 0;
  validRows.forEach(row => {
    const id = String(row.application_id || "").trim().toLowerCase();
    const key = getApplicantImportDuplicateKey(row);
    if ((id && existingIds.has(id)) || (key && (existingKeys.has(key) || seenInFile.has(key)))) {
      possibleDuplicates += 1;
    }
    if (key) seenInFile.add(key);
  });

  const previewFields = selectedFields.length ? selectedFields : APPLICANT_IMPORT_FIELDS.filter(field =>
    ["first_name", "middle_name", "surname", "date_of_birth"].includes(field.key)
  );
  preview.innerHTML = "<thead><tr><th>Row</th>" + previewFields.map(field =>
    "<th>" + escapeApplicantImportHtml(field.label) + "</th>"
  ).join("") + "</tr></thead><tbody>" +
    validRows.slice(0, 8).map((row, index) =>
      "<tr><td>" + (index + 1) + "</td>" + previewFields.map(field =>
        "<td>" + escapeApplicantImportHtml((field.key.includes(".") ? row._related?.[field.key.split(".")[0]]?.[field.key.split(".")[1]] : row[field.key]) || "—") + "</td>"
      ).join("") + "</tr>"
    ).join("") + "</tbody>";

  if (summary) {
    summary.innerHTML =
      '<span class="applicant-import-summary-good">' + validRows.length.toLocaleString() + " rows ready</span>" +
      '<span class="applicant-import-summary-muted">' + invalid.toLocaleString() + " incomplete/repeated header rows excluded</span>" +
      (possibleDuplicates
        ? '<span class="applicant-import-summary-duplicate">' + possibleDuplicates.toLocaleString() + " possible duplicate(s) will be checked again before saving</span>"
        : "");
  }
  if (submit) submit.disabled = APPLICANT_IMPORT_STATE.busy || !hasValidApplicantImportMapping() || validRows.length === 0;
}

function renderApplicantImportMapping() {
  const list = document.getElementById("applicant-import-map-list");
  const rowCount = document.getElementById("applicant-import-row-count");
  const submit = document.getElementById("applicant-import-submit");
  if (!list) return;
  const grouped = {};
  APPLICANT_IMPORT_FIELDS.forEach(field => {
    if (!field.key) return;
    const group = field.table || "applications";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(field);
  });
  const options = '<option value="">Do not import this column</option>' + Object.entries(grouped).map(([table, fields]) =>
    '<optgroup label="' + escapeApplicantImportHtml(({applications:"Applications",family_composition:"Family Composition",personal_background:"Personal Background",problems_needs:"Problems and Needs",memberships:"Memberships",application_files:"Application Files",application_status_history:"Application Status History"})[table] || table) + '">' +
    fields.map(field => '<option value="' + field.key + '">' + escapeApplicantImportHtml(field.label) + '</option>').join("") + '</optgroup>'
  ).join("");
  list.innerHTML = APPLICANT_IMPORT_STATE.headers.map((header, index) =>
    '<label class="applicant-import-map-row"><span title="' + escapeApplicantImportHtml(header) +
    '">' + escapeApplicantImportHtml(header) + '</span><select data-import-column="' + index + '">' +
    options + "</select></label>"
  ).join("");
  list.querySelectorAll("select[data-import-column]").forEach(select => {
    select.value = APPLICANT_IMPORT_STATE.mapping[select.dataset.importColumn] || "";
    select.addEventListener("change", () => {
      const selectedValue = select.value;
      if (selectedValue) {
        list.querySelectorAll("select[data-import-column]").forEach(other => {
          if (other !== select && other.value === selectedValue) {
            other.value = "";
            APPLICANT_IMPORT_STATE.mapping[other.dataset.importColumn] = "";
          }
        });
      }
      APPLICANT_IMPORT_STATE.mapping[select.dataset.importColumn] = selectedValue;
      renderApplicantImportPreview();
    });
  });
  if (rowCount) rowCount.textContent = APPLICANT_IMPORT_STATE.rows.length.toLocaleString() + " rows";
  renderApplicantImportPreview();
  if (submit) submit.disabled = APPLICANT_IMPORT_STATE.busy || !hasValidApplicantImportMapping();
}

function setApplicantImportError(message) {
  const element = document.getElementById("applicant-import-error");
  if (!element) return;
  element.textContent = message || "";
  element.hidden = !message;
}

function resetApplicantImportModal() {
  APPLICANT_IMPORT_STATE = { fileName: "", headers: [], rows: [], mapping: {}, imported: false, busy: false };
  const input = document.getElementById("applicant-import-file");
  if (input) input.value = "";
  const documentZip = document.getElementById("applicant-document-zip");
  if (documentZip) documentZip.value = "";
  ["applicant-import-file-meta", "applicant-import-mapping", "applicant-import-progress", "applicant-import-result", "applicant-document-import", "applicant-document-result"].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.hidden = true;
  });
  const summary = document.getElementById("applicant-import-summary");
  if (summary) summary.textContent = "";
  const bar = document.getElementById("applicant-import-progress-bar");
  if (bar) bar.style.width = "0%";
  const dateFormat = document.getElementById("applicant-import-date-format");
  if (dateFormat) dateFormat.value = "auto";
  const submit = document.getElementById("applicant-import-submit");
  if (submit) { submit.disabled = true; submit.textContent = "Import records"; }
  setApplicantImportError("");
}

function openApplicantImportModal() {
  const overlay = document.getElementById("applicant-import-overlay");
  if (!overlay) return;
  resetApplicantImportModal();
  overlay.hidden = false;
  document.body.classList.add("modal-open");
}

function closeApplicantImportModal() {
  if (APPLICANT_IMPORT_STATE.busy) return;
  const overlay = document.getElementById("applicant-import-overlay");
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("modal-open");
}

async function handleApplicantImportFile(file) {
  resetApplicantImportModal();
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) {
    setApplicantImportError("The selected file is larger than 15 MB. Please split it into smaller files.");
    return;
  }
  const meta = document.getElementById("applicant-import-file-meta");
  try {
    setApplicantImportError("");
    if (meta) {
      meta.hidden = false;
      meta.textContent = "Reading " + file.name + "…";
    }
    let parsed;
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".csv") || file.type === "text/csv") {
      parsed = parseApplicantCsv(await file.text());
    } else if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
      parsed = await parseApplicantPdf(file);
    } else {
      throw new Error("Please select a CSV or PDF file.");
    }
    if (!parsed.headers.length || !parsed.rows.length) throw new Error("No table rows were found in the selected file.");
    if (parsed.headers.length > 40) throw new Error("The file contains more than 40 columns. Please simplify the source file before importing.");

    APPLICANT_IMPORT_STATE.fileName = file.name;
    APPLICANT_IMPORT_STATE.headers = parsed.headers;
    APPLICANT_IMPORT_STATE.rows = parsed.rows;
    APPLICANT_IMPORT_STATE.mapping = {};
    const guessedFields = new Set();
    parsed.headers.forEach((header, index) => {
      const guessed = guessApplicantImportTarget(header);
      APPLICANT_IMPORT_STATE.mapping[index] = guessed && !guessedFields.has(guessed) ? guessed : "";
      if (APPLICANT_IMPORT_STATE.mapping[index]) guessedFields.add(guessed);
    });
    if (meta) meta.textContent = file.name + " · " + parsed.rows.length.toLocaleString() + " rows · " + parsed.headers.length + " columns";
    const section = document.getElementById("applicant-import-mapping");
    if (section) section.hidden = false;
    renderApplicantImportMapping();
  } catch (error) {
    if (meta) meta.hidden = true;
    setApplicantImportError(error.message || "Unable to read this file.");
  }
}


async function uploadApplicantDocumentsZip() {
  const input = document.getElementById("applicant-document-zip");
  const button = document.getElementById("applicant-document-upload");
  const result = document.getElementById("applicant-document-result");
  const file = input?.files?.[0];
  if (!file) {
    if (result) { result.hidden = false; result.textContent = "Choose a ZIP file first."; }
    return;
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    if (result) { result.hidden = false; result.textContent = "Please choose a ZIP archive."; }
    return;
  }
  if (file.size > 80 * 1024 * 1024) {
    if (result) { result.hidden = false; result.textContent = "The ZIP archive exceeds the 80 MB limit. Split it into smaller archives."; }
    return;
  }
  if (button) { button.disabled = true; button.textContent = "Uploading…"; }
  if (result) { result.hidden = false; result.textContent = "Uploading and matching document folders…"; }
  try {
    const headers = { ...getAuthHeaders(), "Content-Type": "application/zip" };
    const response = await fetch(
      "https://management-backend-3cij.onrender.com/api/applications/import/documents",
      { method: "POST", headers, body: file }
    );
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || "The document import was rejected.");
    const lines = [
      "<strong>Document import finished</strong>",
      "<div class='applicant-import-result-grid'>" +
        "<span><b>" + Number(payload.uploaded || 0) + "</b> Uploaded</span>" +
        "<span><b>" + Number(payload.alreadyPresent || 0) + "</b> Already on file</span>" +
        "<span><b>" + Number(payload.matchedApplicants || 0) + "</b> Matched folders</span>" +
        "<span><b>" + Number((payload.unmatchedFolders || []).length) + "</b> Unmatched folders</span></div>"
    ];
    if ((payload.missingDocuments || []).length) {
      lines.push("<details open><summary>Missing documents (" + payload.missingDocuments.length + " folders)</summary><ul>" +
        payload.missingDocuments.map(item => "<li><strong>" + escapeApplicantImportHtml(item.folder) + "</strong>: " +
          item.missing.map(escapeApplicantImportHtml).join(", ") + "</li>").join("") + "</ul></details>");
    }
    if ((payload.unmatchedFolders || []).length) {
      lines.push("<details open><summary>Unmatched folders</summary><ul>" +
        payload.unmatchedFolders.map(item => "<li><strong>" + escapeApplicantImportHtml(item.folder) + "</strong>: " +
          escapeApplicantImportHtml(item.reason) + "</li>").join("") + "</ul></details>");
    }
    if ((payload.invalidFiles || []).length) {
      lines.push("<details><summary>Invalid files (" + payload.invalidFiles.length + ")</summary><ul>" +
        payload.invalidFiles.map(item => "<li>" + escapeApplicantImportHtml(item.file) + ": " +
          escapeApplicantImportHtml(item.reason) + "</li>").join("") + "</ul></details>");
    }
    if ((payload.failed || []).length) {
      lines.push("<details open><summary>Upload errors (" + payload.failed.length + ")</summary><ul>" +
        payload.failed.map(item => "<li>" + escapeApplicantImportHtml(item.folder) + " / " +
          escapeApplicantImportHtml(item.document || "") + ": " + escapeApplicantImportHtml(item.reason) + "</li>").join("") + "</ul></details>");
    }
    result.innerHTML = lines.join("");
    if (typeof loadApplicationsFromDatabase === "function") await loadApplicationsFromDatabase();
    if (typeof showToast === "function") showToast("Applicant document import completed.", "success");
  } catch (error) {
    if (result) result.textContent = error.message || "Unable to upload applicant documents.";
  } finally {
    if (button) { button.disabled = false; button.textContent = "Upload documents"; }
  }
}

async function submitApplicantImport() {
  if (APPLICANT_IMPORT_STATE.busy || !hasValidApplicantImportMapping()) return;
  const submit = document.getElementById("applicant-import-submit");
  const progress = document.getElementById("applicant-import-progress");
  const progressBar = document.getElementById("applicant-import-progress-bar");
  const progressLabel = document.getElementById("applicant-import-progress-label");
  const resultPanel = document.getElementById("applicant-import-result");
  const fileKey = APPLICANT_IMPORT_STATE.fileName || "legacy-import";
  const stableHash = value => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase();
  };
  const mappedRows = APPLICANT_IMPORT_STATE.rows
    .map((row, index) => {
      const mapped = getApplicantImportMappedRow(row);
      mapped._sourceRow = index + 1;
      return mapped;
    })
    .filter(row =>
      row.first_name && row.surname && row.date_of_birth &&
      !row._invalidDateOfBirth &&
      !row._invalidRegistrationDate &&
      !isApplicantImportRepeatedHeader(row)
    );
  if (!mappedRows.length) {
    setApplicantImportError("No valid rows remain. Map First name, Surname, and a valid Date of birth, then review the preview.");
    return;
  }

  APPLICANT_IMPORT_STATE.busy = true;
  if (submit) { submit.disabled = true; submit.textContent = "Importing…"; }
  if (progress) progress.hidden = false;
  if (resultPanel) resultPanel.hidden = true;
  setApplicantImportError("");

  const totals = { imported: 0, skippedDuplicates: 0, skippedInvalid: 0, failed: 0, errors: [], importedApplicants: [] };
  const batchSize = 100;
  const totalBatches = Math.ceil(mappedRows.length / batchSize);
  try {
    for (let start = 0; start < mappedRows.length; start += batchSize) {
      const batch = mappedRows.slice(start, start + batchSize).map(row => {
        const clean = { ...row };
        delete clean._sourceRow;
        delete clean._invalidDateOfBirth;
        delete clean._invalidRegistrationDate;
        return clean;
      });
      const response = await fetch(
        "https://management-backend-3cij.onrender.com/api/applications/import",
        { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ rows: batch }) }
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "The server rejected an import batch.");

      totals.imported += Number(payload.imported || 0);
      totals.skippedDuplicates += Number(payload.skippedDuplicates || 0);
      totals.skippedInvalid += Number(payload.skippedInvalid || 0);
      totals.failed += Number(payload.failed || 0);
      totals.importedApplicants.push(...(Array.isArray(payload.importedApplicants) ? payload.importedApplicants : []));
      (payload.errors || []).forEach(error => {
        if (totals.errors.length < 30) totals.errors.push({ row: Number(error.row || 0) + start, reason: error.reason });
      });

      const completed = Math.min(start + batchSize, mappedRows.length);
      const percent = Math.round((completed / mappedRows.length) * 100);
      if (progressBar) progressBar.style.width = percent + "%";
      if (progressLabel) {
        const currentBatch = Math.min(Math.ceil(completed / batchSize), totalBatches);
        progressLabel.textContent = "Imported batch " + currentBatch + " of " + totalBatches +
          " · " + completed.toLocaleString() + " of " + mappedRows.length.toLocaleString() + " rows processed";
      }
    }

    if (resultPanel) {
      resultPanel.hidden = false;
      resultPanel.innerHTML =
        "<strong>" + (totals.imported === 0 && (totals.failed + totals.skippedInvalid) > 0 ? "Import failed" : (totals.failed + totals.skippedInvalid) > 0 ? "Import partially completed" : "Import successful") + "</strong><div class='applicant-import-result-grid'>" +
        "<span><b>" + totals.imported.toLocaleString() + "</b> Imported</span>" +
        "<span><b>" + totals.skippedDuplicates.toLocaleString() + "</b> Duplicates skipped</span>" +
        "<span><b>" + (totals.skippedInvalid + totals.failed).toLocaleString() + "</b> Not imported</span></div>" +
        "<p>" + (totals.imported > 0 ? "Successfully saved records are stored as Completed profiles. Existing records were not changed." : "No records were saved. Correct the row issues before trying again.") + "</p>" +
        (totals.importedApplicants.length ? "<details class='applicant-import-reference-list'><summary>View generated applicant references (" + totals.importedApplicants.length + ")</summary><ul>" +
          totals.importedApplicants.map(item => "<li>Source row " + Number(item.sourceRow || 0) + ": <strong>" + escapeApplicantImportHtml(item.osca_id_number || item.legacy_reference || item.application_id) + "</strong></li>").join("") +
          "</ul></details>" : "") +
        (totals.errors.length ? "<details><summary>View row issues (" + totals.errors.length + ")</summary><ul>" +
          totals.errors.map(error => "<li>Source row " + (error.row + 1) + ": " + escapeApplicantImportHtml(error.reason) + "</li>").join("") +
          "</ul></details>" : "");
    }

    APPLICANT_IMPORT_STATE.imported = true;
    const documentImportPanel = document.getElementById("applicant-document-import");
    if (documentImportPanel && totals.imported > 0) documentImportPanel.hidden = false;
    if (submit) { submit.textContent = totals.imported === 0 && (totals.failed + totals.skippedInvalid) > 0 ? "Import failed" : (totals.failed + totals.skippedInvalid) > 0 ? "Import partially complete" : "Import complete"; submit.disabled = true; }
    if (typeof loadApplicationsFromDatabase === "function") {
      try {
        await loadApplicationsFromDatabase();
      } catch (refreshError) {
        console.warn("[Applicant Import] Saved records, but the Applicants list could not be refreshed:", refreshError);
        setApplicantImportError("The records were saved, but the Applicants list could not refresh. Reload the page to see the imported records.");
      }
    }
    if (typeof showToast === "function") {
      showToast(totals.imported + " historical applicant record(s) imported.", totals.failed ? "warning" : "success");
    }
  } catch (error) {
    setApplicantImportError(error.message || "The import failed.");
    if (submit) { submit.textContent = "Retry import"; submit.disabled = false; }
  } finally {
    APPLICANT_IMPORT_STATE.busy = false;
    if (submit && !APPLICANT_IMPORT_STATE.imported) submit.disabled = !hasValidApplicantImportMapping();
  }
}

function initializeApplicantImport() {
  const input = document.getElementById("applicant-import-file");
  const dropzone = document.getElementById("applicant-import-dropzone");
  const overlay = document.getElementById("applicant-import-overlay");

  if (input && !input.dataset.importBound) {
    input.dataset.importBound = "true";
    input.addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      if (file) handleApplicantImportFile(file);
    });
  }

  const documentZipInput = document.getElementById("applicant-document-zip");
  if (documentZipInput && !documentZipInput.dataset.documentImportBound) {
    documentZipInput.dataset.documentImportBound = "true";
    documentZipInput.addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      const result = document.getElementById("applicant-document-result");
      if (!file) return;
      if (result) {
        result.hidden = false;
        result.textContent = file.name + " selected. Click Upload documents to continue.";
      }
    });
  }

  const documentUploadButton = document.getElementById("applicant-document-upload");
  if (documentUploadButton && !documentUploadButton.dataset.documentImportBound) {
    documentUploadButton.dataset.documentImportBound = "true";
    documentUploadButton.addEventListener("click", uploadApplicantDocumentsZip);
  }

  const dateFormat = document.getElementById("applicant-import-date-format");
  if (dateFormat && !dateFormat.dataset.importBound) {
    dateFormat.dataset.importBound = "true";
    dateFormat.addEventListener("change", renderApplicantImportPreview);
  }

  // Listen on both the visible drop target and modal overlay. Some browsers
  // dispatch the drop on a child element rather than the label itself.
  const bindDropTarget = (target, isOverlay = false) => {
    if (!target || target.dataset.importDropBound) return;
    target.dataset.importDropBound = "true";

    ["dragenter", "dragover"].forEach(name => target.addEventListener(name, event => {
      event.preventDefault();
      event.stopPropagation();
      if (dropzone) dropzone.classList.add("is-dragover");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }));

    ["dragleave"].forEach(name => target.addEventListener(name, event => {
      event.preventDefault();
      event.stopPropagation();
      // Only clear the highlight when the pointer actually leaves this target.
      if (!event.relatedTarget || !target.contains(event.relatedTarget)) {
        if (dropzone) dropzone.classList.remove("is-dragover");
      }
    }));

    target.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
      if (dropzone) dropzone.classList.remove("is-dragover");
      const files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) {
        setApplicantImportError("No file was detected. Try choosing the file using the upload area instead.");
        return;
      }
      // Accept the drop anywhere within the visible import modal. Browser
      // drag events can retarget nested label/text elements outside the
      // dropzone's DOM subtree even when the pointer is visually over it.
      const droppedFile = files[0];
      const isZip = /\.zip$/i.test(droppedFile.name || "");
      if (isZip) {
        const documentPanel = document.getElementById("applicant-document-import");
        const zipInput = document.getElementById("applicant-document-zip");
        if (!documentPanel || documentPanel.hidden || !APPLICANT_IMPORT_STATE.imported) {
          setApplicantImportError("Import the applicant records first. The ZIP upload section will appear after the records are imported.");
          return;
        }
        if (zipInput) {
          try {
            const transfer = new DataTransfer();
            transfer.items.add(droppedFile);
            zipInput.files = transfer.files;
            const result = document.getElementById("applicant-document-result");
            if (result) { result.hidden = false; result.textContent = "ZIP selected: " + droppedFile.name; }
            uploadApplicantDocumentsZip();
          } catch (error) {
            setApplicantImportError("The ZIP was detected, but the browser could not attach it to the document uploader. Use the Choose applicant documents ZIP area instead.");
          }
        }
        return;
      }
      if (target.id === "applicant-document-import") {
        setApplicantImportError("This section accepts ZIP files only. Use the first upload area for CSV or PDF applicant records.");
        return;
      }
      // CSV and PDF files belong to the applicant-record import step.
      handleApplicantImportFile(droppedFile);
    });
  };

  bindDropTarget(dropzone);
  bindDropTarget(overlay, true);

  // Prevent the browser from opening a dropped file in the current tab while
  // the import dialog is open.
  if (!document.documentElement.dataset.applicantImportGlobalDropBound) {
    document.documentElement.dataset.applicantImportGlobalDropBound = "true";
    ["dragover", "drop"].forEach(name => document.addEventListener(name, event => {
      const currentOverlay = document.getElementById("applicant-import-overlay");
      if (currentOverlay && !currentOverlay.hidden) event.preventDefault();
    }));
  }
}
document.addEventListener("DOMContentLoaded", initializeApplicantImport);
window.openApplicantImportModal = openApplicantImportModal;
window.closeApplicantImportModal = closeApplicantImportModal;
window.submitApplicantImport = submitApplicantImport;
window.uploadApplicantDocumentsZip = uploadApplicantDocumentsZip;
