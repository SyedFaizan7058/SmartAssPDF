/**
 * SmartAssPDF — Global Application Logic
 * Navigation, Theme Management, Quick Search (Cmd+K), Tool Grid & Filtering, Toasts, Smooth Scroll Animations
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. Theme Management (Zero-FOUC, LocalStorage, System Sync)
     ========================================================================== */
  const THEME_KEY = 'smartasspdf_theme';

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    applyTheme(theme);

    // Watch system changes if user hasn't explicitly chosen
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });

    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, nextTheme);
        applyTheme(nextTheme);
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'dark' 
        ? '<i class="bi bi-sun-fill" aria-hidden="true"></i>' 
        : '<i class="bi bi-moon-stars-fill" aria-hidden="true"></i>';
      themeToggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    }
  }

  /* ==========================================================================
     2. Toast Notification System
     ========================================================================== */
  let toastContainer = null;

  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(message, type = 'info', duration = 4000) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'bi-info-circle-fill';
    if (type === 'success') iconClass = 'bi-check-circle-fill';
    if (type === 'error') iconClass = 'bi-exclamation-triangle-fill';
    if (type === 'warning') iconClass = 'bi-exclamation-circle-fill';

    toast.innerHTML = `
      <div class="toast-left">
        <i class="bi ${iconClass}" aria-hidden="true"></i>
        <span>${escapeHtml(message)}</span>
      </div>
      <button type="button" class="toast-close-btn" aria-label="Close notification">&times;</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    const remove = () => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 250);
    };

    toast.querySelector('.toast-close-btn').addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);
  }

  window.SmartAssToast = { show: showToast };

  /* ==========================================================================
     3. Header Scroll & Mobile Navigation Drawer
     ========================================================================== */
  function initHeaderAndDrawer() {
    const header = document.getElementById('siteHeader');
    const toggle = document.getElementById('mobileNavToggle');
    const drawer = document.getElementById('mobileDrawer');
    const backdrop = document.getElementById('mobileDrawerBackdrop');
    const drawerCloseBtn = document.getElementById('drawerCloseBtn');

    // Header scroll shadow
    if (header) {
      const handleScroll = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 10);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
    }

    if (!toggle || !drawer || !backdrop) return;

    const openDrawer = () => {
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };

    const closeDrawer = () => {
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    toggle.addEventListener('click', () => {
      drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });

    backdrop.addEventListener('click', closeDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);

    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });
  }

  /* ==========================================================================
     4. Quick Search Modal (Cmd+K / Ctrl+K)
     ========================================================================== */
  function initSearchModal() {
    const modalBackdrop = document.getElementById('searchModalBackdrop');
    const searchInput = document.getElementById('searchModalInput');
    const resultsContainer = document.getElementById('searchResults');
    const searchTrigger = document.getElementById('searchTriggerBtn');
    const modalCloseBtn = document.getElementById('searchModalClose');

    if (!modalBackdrop || !searchInput || !resultsContainer) return;

    let selectedIndex = 0;
    let filteredTools = [];

    const getPrefix = () => {
      const p = window.location.pathname;
      if (p.includes('/tools/')) return '';
      if (p.includes('/blog/')) return '../tools/';
      return 'tools/';
    };

    const openModal = () => {
      modalBackdrop.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      searchInput.value = '';
      renderResults('');
      setTimeout(() => searchInput.focus(), 50);
    };

    const closeModal = () => {
      modalBackdrop.classList.remove('is-open');
      document.body.style.overflow = '';
    };

    if (searchTrigger) searchTrigger.addEventListener('click', openModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        modalBackdrop.classList.contains('is-open') ? closeModal() : openModal();
      } else if (e.key === 'Escape' && modalBackdrop.classList.contains('is-open')) {
        closeModal();
      }
    });

    function renderResults(query) {
      if (!window.SMARTASSPDF_TOOLS) return;
      const allTools = window.SMARTASSPDF_TOOLS.getAllTools();
      const q = query.trim().toLowerCase();

      filteredTools = allTools.filter(t => {
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.inputFormat.toLowerCase().includes(q) ||
          t.outputFormat.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      });

      selectedIndex = 0;

      if (!filteredTools.length) {
        resultsContainer.innerHTML = `
          <div style="text-align:center; padding: 32px 16px; color: var(--text-muted);">
            <i class="bi bi-search" style="font-size: 2rem; display:block; margin-bottom: 8px;"></i>
            <p>No tools found matching "<strong>${escapeHtml(query)}</strong>"</p>
          </div>
        `;
        return;
      }

      const prefix = getPrefix();
      resultsContainer.innerHTML = filteredTools.map((t, idx) => `
        <a class="search-result-item ${idx === 0 ? 'is-selected' : ''}" href="${prefix}${t.id}.html" data-index="${idx}">
          <div class="search-result-left">
            ${t.iconSvg}
            <div class="search-result-info">
              <strong>${t.name}</strong>
              <small>${t.description}</small>
            </div>
          </div>
          <span class="tool-card-badge">${t.badge}</span>
        </a>
      `).join('');

      resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
          resultsContainer.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('is-selected'));
          item.classList.add('is-selected');
          selectedIndex = Number(item.dataset.index);
        });
      });
    }

    searchInput.addEventListener('input', (e) => renderResults(e.target.value));

    searchInput.addEventListener('keydown', (e) => {
      const items = resultsContainer.querySelectorAll('.search-result-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateSelection(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) items[selectedIndex].click();
      }
    });

    function updateSelection(items) {
      items.forEach((item, idx) => {
        item.classList.toggle('is-selected', idx === selectedIndex);
        if (idx === selectedIndex) item.scrollIntoView({ block: 'nearest' });
      });
    }
  }

  /* ==========================================================================
     5. Homepage Tool Directory & Category Filters
     ========================================================================== */
  function initToolGrid() {
    const grid = document.getElementById('toolGrid');
    if (!grid || !window.SMARTASSPDF_TOOLS) return;

    const filterPills = document.querySelectorAll('.filter-pill');
    const searchFilter = document.getElementById('toolFilterInput');
    const prefix = grid.dataset.prefix || '';

    let activeCategory = 'all';
    let activeQuery = '';

    function render() {
      const allTools = window.SMARTASSPDF_TOOLS.getAllTools();
      const q = activeQuery.trim().toLowerCase();

      const matched = allTools.filter(t => {
        const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
        const matchesQuery = !q || (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.inputFormat.toLowerCase().includes(q) ||
          t.outputFormat.toLowerCase().includes(q)
        );
        return matchesCategory && matchesQuery;
      });

      if (!matched.length) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-medium);">
            <i class="bi bi-folder-x" style="font-size: 2.5rem; color: var(--text-muted); display:block; margin-bottom: 12px;"></i>
            <h3 style="margin-bottom: 6px;">No tools found</h3>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">Try searching for something else or reset the category filter.</p>
            <button type="button" class="btn btn-secondary btn-sm" id="resetToolFilters">Reset Filters</button>
          </div>
        `;
        const resetBtn = document.getElementById('resetToolFilters');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            activeCategory = 'all';
            activeQuery = '';
            if (searchFilter) searchFilter.value = '';
            filterPills.forEach(p => p.classList.toggle('is-active', p.dataset.category === 'all'));
            render();
          });
        }
        return;
      }

      grid.innerHTML = matched.map((t, idx) => `
        <a class="tool-card card-folded" data-aos="fade-up" data-aos-delay="${(idx % 4) * 50}" href="${prefix}tools/${t.id}.html">
          <div class="tool-card-top">
            <div class="tool-card-icon" style="color: ${t.accentColor}; background: ${t.accentColor}18;">
              ${t.iconSvg}
            </div>
            <span class="tool-card-badge">${t.badge}</span>
          </div>
          <h3>${t.name}</h3>
          <p>${t.description}</p>
          <div class="tool-card-cta">
            <span>Use tool</span>
            <i class="bi bi-arrow-right" aria-hidden="true"></i>
          </div>
        </a>
      `).join('');

      // Refresh AOS on dynamic render
      if (typeof AOS !== 'undefined') {
        setTimeout(() => AOS.refreshHard(), 50);
      }
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        activeCategory = pill.dataset.category || 'all';
        render();
      });
    });

    if (searchFilter) {
      searchFilter.addEventListener('input', (e) => {
        activeQuery = e.target.value;
        render();
      });
    }

    render();
  }

  /* ==========================================================================
     6. AOS (Animate On Scroll) Smooth Scrolling Animations
     ========================================================================== */
  function initScrollAnimations() {
    let retries = 0;
    const maxRetries = 20;

    function tryInitAOS() {
      if (typeof AOS !== 'undefined') {
        AOS.init({
          duration: 600,
          easing: 'ease-out-cubic',
          once: true,
          offset: 40,
          delay: 0,
          debounceDelay: 50,
          throttleDelay: 99
        });
        AOS.refresh();
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(tryInitAOS, 50);
      }
    }

    tryInitAOS();

    window.addEventListener('load', () => {
      if (typeof AOS !== 'undefined') {
        AOS.refreshHard();
      }
    });
  }

  /* ==========================================================================
     7. Utility Helpers
     ========================================================================== */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m]);
  }

  function markActiveNav() {
    const currentPath = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link[data-nav], .mobile-nav-list a[data-nav]').forEach(a => {
      const href = a.getAttribute('href').split('#')[0].split('/').pop();
      if (href === currentPath) a.classList.add('is-active');
    });
  }

  /* ==========================================================================
     8. Privacy-Friendly Analytics Event Tracking
     ========================================================================== */
  function trackEvent(eventName, eventParams = {}) {
    // Only track non-sensitive operational metrics; never send file contents
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...eventParams });
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, eventParams);
    }
    window.dispatchEvent(new CustomEvent('smartasspdf:analytics', {
      detail: { event: eventName, params: eventParams, timestamp: Date.now() }
    }));
  }

  window.SmartAssAnalytics = { track: trackEvent };
  window.initScrollAnimations = initScrollAnimations;

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initHeaderAndDrawer();
    initSearchModal();
    initScrollAnimations();
    initToolGrid();
    markActiveNav();
});
})();
