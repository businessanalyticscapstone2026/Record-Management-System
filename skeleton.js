/* =========================================================
   SKELETON LOADER HELPERS
   Shared by staff, admin and ID Maker portals.
   Styles live in base.css (.sk-cell, .skeleton, .is-loading).
   ========================================================= */

window.Skeleton = (function () {

  const WIDTHS = [62, 88, 45, 74, 56, 92, 40, 68, 80, 50];

  function resolveEl(target) {
    return typeof target === 'string'
      ? document.getElementById(target)
      : target;
  }

  function columnCount(tbody) {
    const head = tbody?.closest('table')?.tHead;
    const count = head?.rows?.[0]?.cells?.length;
    return count && count > 0 ? count : 5;
  }

  /** Returns HTML for `rows` skeleton table rows with `cols` cells. */
  function rowsHtml(cols, rows) {
    let html = '';
    for (let r = 0; r < (rows || 5); r++) {
      html += '<tr class="sk-row" aria-hidden="true">';
      for (let c = 0; c < cols; c++) {
        const w = WIDTHS[(r + c) % WIDTHS.length];
        html +=
          '<td><span class="skeleton sk-cell" style="width:' + w + '%"></span></td>';
      }
      html += '</tr>';
    }
    return html;
  }

  /** Replaces a tbody's contents with skeleton rows. */
  function setTable(target, rows) {
    const tbody = resolveEl(target);
    if (!tbody) return;
    tbody.innerHTML = rowsHtml(columnCount(tbody), rows || 5);
    tbody.setAttribute('aria-busy', 'true');
  }

  /** True if the tbody currently shows skeleton rows. */
  function isShowing(target) {
    const tbody = resolveEl(target);
    return Boolean(tbody && tbody.querySelector('.sk-row'));
  }

  /** Toggles the loading style on one or more KPI value elements/containers. */
  function setLoading(target, isLoading) {
    const list = typeof target === 'string'
      ? document.querySelectorAll(target)
      : (target instanceof Element ? [target] : (target || []));
    list.forEach(function (el) {
      if (!el) return;
      el.classList.toggle('is-loading', Boolean(isLoading));
    });
  }

  /** Clears the busy flag set by setTable(). */
  function clearBusy(target) {
    const tbody = resolveEl(target);
    if (tbody) tbody.removeAttribute('aria-busy');
  }

  function pageReady() {
    document.body.classList.remove('skeleton-page-loading');
    document.body.removeAttribute('aria-busy');
  }

  // The page-level overlay is shared across portals, so its cleanup must not
  // depend on a portal-specific initializer succeeding. Page markup is ready
  // at DOMContentLoaded; the timeout is a last-resort guard for stalled loads.
  document.addEventListener('DOMContentLoaded', pageReady, { once: true });
  window.setTimeout(pageReady, 12000);

  /** Returns HTML for a set of KPI skeleton cards matching Staff Dashboard structure. */
  function kpiCardsHtml(count, type) {
    let html = '';
    const num = count || 4;
    for (let i = 0; i < num; i++) {
      if (type === 'analytics') {
        html +=
          '<article class="stat-card analytics-kpi analytics-kpi--skeleton is-loading animate-pulse" aria-hidden="true">' +
            '<div class="stat-card__top">' +
              '<div class="stat-card__icon-wrap skeleton" style="width: 38px; height: 38px; border-radius: 11px;"></div>' +
              '<div class="stat-card__meta"><span class="stat-card__period skeleton" style="width: 64px; height: 12px; border-radius: 4px;"></span></div>' +
            '</div>' +
            '<div class="stat-card__body">' +
              '<span class="stat-card__label analytics-kpi__label skeleton" style="width: 68%; height: 13px; border-radius: 4px; display: block;"></span>' +
              '<strong class="stat-card__value skeleton" style="width: 44%; height: 26px; border-radius: 6px; display: block; margin: 6px 0 3px;"></strong>' +
              '<span class="stat-card__sub skeleton" style="width: 58%; height: 12px; border-radius: 4px; display: block;"></span>' +
            '</div>' +
          '</article>';
      } else {
        html +=
          '<article class="stat-card stat-card--skeleton is-loading animate-pulse" aria-hidden="true">' +
            '<div class="stat-card__top">' +
              '<div class="stat-card__icon-wrap skeleton" style="width: 32px; height: 32px; border-radius: 8px;"></div>' +
              '<div class="stat-card__meta">' +
                '<div class="skeleton" style="width: 44px; height: 18px; border-radius: 6px;"></div>' +
              '</div>' +
            '</div>' +
            '<div class="stat-card__body">' +
              '<span class="stat-card__label skeleton" style="width: 68%; height: 13px; border-radius: 4px; display: block;"></span>' +
              '<span class="stat-card__value skeleton" style="width: 44%; height: 26px; border-radius: 6px; display: block; margin: 6px 0 3px;"></span>' +
              '<span class="stat-card__sub skeleton" style="width: 58%; height: 12px; border-radius: 4px; display: block;"></span>' +
            '</div>' +
          '</article>';
      }
    }
    return html;
  }

  /** Renders KPI skeleton cards into a target container. */
  function renderKpiSkeletons(target, count, type) {
    const el = resolveEl(target);
    if (!el) return;
    el.innerHTML = kpiCardsHtml(count, type);
    el.setAttribute('aria-busy', 'true');
  }

  /** Toggles loading shimmer and pulse on a KPI strip or card set. */
  function setKpiLoading(target, isLoading) {
    const list = typeof target === 'string'
      ? document.querySelectorAll(target)
      : (target instanceof Element ? [target] : (target || []));
    list.forEach(function (el) {
      if (!el) return;
      el.classList.toggle('is-loading', Boolean(isLoading));
      if (isLoading) {
        el.setAttribute('aria-busy', 'true');
      } else {
        el.removeAttribute('aria-busy');
      }
    });
  }

  function setDashboardKpisLoading(isLoading) {
    setKpiLoading('#staff-kpi-strip', isLoading);
  }

  function setApplicantKpisLoading(isLoading) {
    setKpiLoading('#applicants-kpi-strip, #mod-applicants .cards-grid', isLoading);
  }

  function setApplicationKpisLoading(isLoading) {
    setKpiLoading('#applications-kpi-strip, #mod-applications .cards-grid', isLoading);
  }

  function setIssuanceKpisLoading(isLoading) {
    setKpiLoading('#issuance-kpi-strip, #mod-id-issuance .cards-grid', isLoading);
  }

  function setAnalyticsKpisLoading(isLoading) {
    setKpiLoading('#analytics-kpi-strip, #mod-analytics .analytics-hero__stats', isLoading);
  }

  function setAllKpisLoading(isLoading) {
    setDashboardKpisLoading(isLoading);
    setApplicantKpisLoading(isLoading);
    setApplicationKpisLoading(isLoading);
    setIssuanceKpisLoading(isLoading);
    setAnalyticsKpisLoading(isLoading);
  }

  return {
    rowsHtml: rowsHtml,
    setTable: setTable,
    isShowing: isShowing,
    setLoading: setLoading,
    clearBusy: clearBusy,
    pageReady: pageReady,
    startLoading: startLoading,
    endLoading: endLoading,
    kpiCardsHtml: kpiCardsHtml,
    renderKpiSkeletons: renderKpiSkeletons,
    setKpiLoading: setKpiLoading,
    setDashboardKpisLoading: setDashboardKpisLoading,
    setApplicantKpisLoading: setApplicantKpisLoading,
    setApplicationKpisLoading: setApplicationKpisLoading,
    setIssuanceKpisLoading: setIssuanceKpisLoading,
    setAnalyticsKpisLoading: setAnalyticsKpisLoading,
    setAllKpisLoading: setAllKpisLoading
  };

  function startLoading(el) {
    const target = typeof el === 'string' ? document.querySelectorAll(el) : (el instanceof Element ? [el] : (el || []));
    target.forEach(function (e) {
      if (!e) return;
      e.classList.add('is-loading');
      if (e.tagName === 'TBODY') {
        e.setAttribute('aria-busy', 'true');
      }
    });
  }

  function endLoading(el) {
    const target = typeof el === 'string' ? document.querySelectorAll(el) : (el instanceof Element ? [el] : (el || []));
    target.forEach(function (e) {
      if (!e) return;
      e.classList.remove('is-loading');
      if (e.tagName === 'TBODY') {
        e.removeAttribute('aria-busy');
      }
    });
  }

})();
