(function () {
  'use strict';

  const BADGE_VARIANTS = new Set(['success', 'warning', 'danger', 'neutral', 'info']);

  function makeTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text == null ? '' : String(text);
    return element;
  }

  function renderBadge(badge) {
    if (!badge || !String(badge.text || '').trim()) return null;

    const variant = BADGE_VARIANTS.has(badge.variant) ? badge.variant : 'neutral';
    const text = String(badge.text).trim();
    const meaning = String(badge.ariaLabel || badge.tooltip || text).trim();
    const element = makeTextElement('span', `stat-badge stat-badge--${variant}`, text);
    element.setAttribute('aria-label', meaning);
    element.setAttribute('title', String(badge.tooltip || meaning));

    if (badge.icon) {
      const icon = document.createElement('i');
      icon.className = String(badge.icon);
      icon.setAttribute('aria-hidden', 'true');
      element.prepend(icon);
    }

    return element;
  }

  function render(props) {
    const options = props || {};
    const rootTag = options.href ? 'a' : options.onClick ? 'button' : 'article';
    const card = document.createElement(rootTag);
    card.className = `stat-card stat-card--component${options.className ? ` ${options.className}` : ''}`;

    if (options.id) card.id = options.id;
    if (options.href) card.href = options.href;
    if (rootTag === 'button') {
      card.type = 'button';
      card.addEventListener('click', options.onClick);
    }
    if (options.loading) card.setAttribute('aria-busy', 'true');

    const top = document.createElement('div');
    top.className = 'stat-card__top';
    const iconWrap = document.createElement('div');
    iconWrap.className = `stat-card__icon-wrap iwrap-${options.iconTone || 'blue'}`;
    if (options.icon) {
      const icon = document.createElement('i');
      icon.className = String(options.icon);
      icon.setAttribute('aria-hidden', 'true');
      iconWrap.appendChild(icon);
    }
    top.appendChild(iconWrap);

    const meta = document.createElement('div');
    meta.className = 'stat-card__meta';
    const badge = renderBadge(options.badge);
    if (badge) meta.appendChild(badge);
    top.appendChild(meta);

    const body = document.createElement('div');
    body.className = 'stat-card__body';
    const title = makeTextElement('span', 'stat-card__label', options.title);
    title.title = String(options.title || '');
    const value = makeTextElement('strong', 'stat-card__value', options.value);
    if (options.valueId) value.id = options.valueId;
    const subtitle = makeTextElement('span', 'stat-card__sub', options.subtitle);
    subtitle.title = String(options.subtitle || '');
    body.append(title, value, subtitle);
    card.append(top, body);

    if (options.loading) setLoading(card, true);
    if (options.error) setError(card, options.error);
    return card;
  }

  function setBadge(card, badge) {
    if (!card) return;
    const meta = card.querySelector('.stat-card__meta');
    if (!meta) return;
    meta.replaceChildren();
    const element = renderBadge(badge);
    if (element) meta.appendChild(element);
  }

  function setLoading(card, loading) {
    if (!card) return;
    card.classList.toggle('is-loading', Boolean(loading));
    if (loading) {
      card.setAttribute('aria-busy', 'true');
      card.removeAttribute('aria-invalid');
    } else {
      card.removeAttribute('aria-busy');
    }
  }

  function setError(card, message) {
    if (!card) return;
    card.classList.toggle('has-error', Boolean(message));
    if (message) {
      card.setAttribute('aria-invalid', 'true');
      card.setAttribute('aria-label', `Unable to load card data: ${String(message)}`);
    } else {
      card.removeAttribute('aria-invalid');
      card.removeAttribute('aria-label');
    }
  }

  function update(card, changes) {
    if (!card || !changes) return;
    const value = card.querySelector('.stat-card__value');
    const title = card.querySelector('.stat-card__label');
    const subtitle = card.querySelector('.stat-card__sub');

    if (Object.prototype.hasOwnProperty.call(changes, 'value') && value) {
      value.textContent = changes.value == null ? '' : String(changes.value);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'title') && title) {
      title.textContent = changes.title == null ? '' : String(changes.title);
      title.title = title.textContent;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'subtitle') && subtitle) {
      subtitle.textContent = changes.subtitle == null ? '' : String(changes.subtitle);
      subtitle.title = subtitle.textContent;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'badge')) setBadge(card, changes.badge);
    if (Object.prototype.hasOwnProperty.call(changes, 'loading')) setLoading(card, changes.loading);
    if (Object.prototype.hasOwnProperty.call(changes, 'error')) setError(card, changes.error);
  }

  window.StatCard = Object.freeze({ render, update, setBadge, setLoading, setError });
})();
