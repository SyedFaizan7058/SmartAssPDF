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
     3. Centralized Global Navigation & Footer Template (Single Source of Truth)
     ========================================================================== */
  function getBasePath() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('/tools/') || path.includes('/blog/')) {
      return '../';
    }
    return '';
  }

  function initGlobalLayout() {
    const base = getBasePath();
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    const isHome = currentFile === 'index.html' || currentFile === '';

    // 1. Render Header
    const header = document.getElementById('siteHeader');
    if (header) {
      header.innerHTML = `
        <div class="container header-inner">
          <a class="brand" href="${base}index.html" aria-label="SmartAssPDF home">
            <span class="brand-mark"><img src="${base}assets/images/logo-mark.png" width="26" height="26" alt="SmartAssPDF Logo"></span>
            <span class="brand-name">SmartAss<em>PDF</em></span>
          </a>

          <nav aria-label="Main navigation">
            <ul class="nav-desktop">
              <li class="nav-item">
                <button type="button" class="nav-link" aria-expanded="false" aria-haspopup="true">
                  <span>Convert</span>
                  <i class="bi bi-chevron-down nav-chevron" aria-hidden="true"></i>
                </button>
                <div class="nav-dropdown">
                  <a class="nav-dropdown-item" href="${base}tools/ocr-pdf.html"><i class="bi bi-search"></i> <span>OCR PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/pdf-to-word.html"><i class="bi bi-file-earmark-word"></i> <span>PDF to Word</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/pdf-to-excel.html"><i class="bi bi-file-earmark-excel"></i> <span>PDF to Excel</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/pdf-to-jpg.html"><i class="bi bi-file-earmark-image"></i> <span>PDF to JPG</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/pdf-to-ppt.html"><i class="bi bi-file-earmark-ppt"></i> <span>PDF to PowerPoint</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/word-to-pdf.html"><i class="bi bi-file-earmark-text"></i> <span>Word to PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/excel-to-pdf.html"><i class="bi bi-file-earmark-spreadsheet"></i> <span>Excel to PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/image-to-webp.html"><i class="bi bi-file-earmark-image"></i> <span>Image to WebP</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/image-to-pdf.html"><i class="bi bi-images"></i> <span>Image to PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/html-to-pdf.html"><i class="bi bi-filetype-html"></i> <span>HTML to PDF</span></a>
                </div>
              </li>

              <li class="nav-item">
                <button type="button" class="nav-link" aria-expanded="false" aria-haspopup="true">
                  <span>Organize</span>
                  <i class="bi bi-chevron-down nav-chevron" aria-hidden="true"></i>
                </button>
                <div class="nav-dropdown">
                  <a class="nav-dropdown-item" href="${base}tools/repair-pdf.html"><i class="bi bi-wrench-adjustable"></i> <span>Repair PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/compare-pdf.html"><i class="bi bi-layout-split"></i> <span>Compare PDFs</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/merge-pdf.html"><i class="bi bi-plus-square"></i> <span>Merge PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/split-pdf.html"><i class="bi bi-layout-split"></i> <span>Split PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/remove-pages.html"><i class="bi bi-trash3"></i> <span>Remove Pages</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/extract-pages.html"><i class="bi bi-box-arrow-up-right"></i> <span>Extract Pages</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/rotate-pdf.html"><i class="bi bi-arrow-clockwise"></i> <span>Rotate PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/add-page-numbers.html"><i class="bi bi-123"></i> <span>Add Page Numbers</span></a>
                </div>
              </li>

              <li class="nav-item">
                <button type="button" class="nav-link" aria-expanded="false" aria-haspopup="true">
                  <span>Optimize & Security</span>
                  <i class="bi bi-chevron-down nav-chevron" aria-hidden="true"></i>
                </button>
                <div class="nav-dropdown">
                  <a class="nav-dropdown-item" href="${base}tools/sanitize-pdf.html"><i class="bi bi-shield-check"></i> <span>Sanitize PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/sign-pdf.html"><i class="bi bi-pen"></i> <span>Sign PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/compress-pdf.html"><i class="bi bi-file-earmark-zip"></i> <span>Compress PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/add-watermark.html"><i class="bi bi-shield-shaded"></i> <span>Add Watermark</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/protect-pdf.html"><i class="bi bi-shield-lock"></i> <span>Protect PDF</span></a>
                  <a class="nav-dropdown-item" href="${base}tools/unlock-pdf.html"><i class="bi bi-unlock"></i> <span>Unlock PDF</span></a>
                </div>
              </li>

              <li class="nav-item">
                <a class="nav-link ${currentFile === 'faq.html' ? 'is-active' : ''}" href="${base}faq.html" data-nav="faq">FAQ</a>
              </li>
              <li class="nav-item">
                <a class="nav-link ${currentFile === 'about.html' ? 'is-active' : ''}" href="${base}about.html" data-nav="about">About</a>
              </li>
            </ul>
          </nav>

          <div class="header-actions">
            <button type="button" class="search-trigger-btn" id="searchTriggerBtn" aria-label="Search tools">
              <i class="bi bi-search" aria-hidden="true"></i>
              <span>Search tools</span>
              <kbd class="search-kbd">⌘K</kbd>
            </button>

            <button type="button" class="theme-btn" id="themeToggle" aria-label="Toggle dark/light theme">
              <i class="bi bi-sun-fill" aria-hidden="true"></i>
            </button>

            <button type="button" class="mobile-nav-toggle" id="mobileNavToggle" aria-expanded="false" aria-controls="mobileDrawer" aria-label="Toggle navigation menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      `;
    }

    // 2. Ensure Mobile Drawer Backdrop & Drawer Exist
    let backdrop = document.getElementById('mobileDrawerBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'mobile-drawer-backdrop';
      backdrop.id = 'mobileDrawerBackdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    let drawer = document.getElementById('mobileDrawer');
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.className = 'mobile-drawer';
      drawer.id = 'mobileDrawer';
      drawer.setAttribute('aria-label', 'Mobile navigation');
      document.body.appendChild(drawer);
    }

    drawer.innerHTML = `
      <div class="mobile-drawer-header">
        <a class="brand" href="${base}index.html">
          <span class="brand-mark"><img src="${base}assets/images/logo-mark.png" width="24" height="24" alt=""></span>
          <span class="brand-name">SmartAss<em>PDF</em></span>
        </a>
        <button type="button" class="file-action-btn" id="drawerCloseBtn" aria-label="Close menu">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="mobile-drawer-nav">
        <div>
          <div class="mobile-nav-section-title">Convert Tools</div>
          <ul class="mobile-nav-list">
            <li><a href="${base}tools/ocr-pdf.html"><i class="bi bi-search"></i> OCR PDF</a></li>
            <li><a href="${base}tools/pdf-to-word.html"><i class="bi bi-file-earmark-word"></i> PDF to Word</a></li>
            <li><a href="${base}tools/pdf-to-excel.html"><i class="bi bi-file-earmark-excel"></i> PDF to Excel</a></li>
            <li><a href="${base}tools/pdf-to-jpg.html"><i class="bi bi-file-earmark-image"></i> PDF to JPG</a></li>
            <li><a href="${base}tools/pdf-to-ppt.html"><i class="bi bi-file-earmark-ppt"></i> PDF to PowerPoint</a></li>
            <li><a href="${base}tools/word-to-pdf.html"><i class="bi bi-file-earmark-text"></i> Word to PDF</a></li>
            <li><a href="${base}tools/excel-to-pdf.html"><i class="bi bi-file-earmark-spreadsheet"></i> Excel to PDF</a></li>
            <li><a href="${base}tools/image-to-webp.html"><i class="bi bi-file-earmark-image"></i> Image to WebP</a></li>
            <li><a href="${base}tools/image-to-pdf.html"><i class="bi bi-images"></i> Image to PDF</a></li>
            <li><a href="${base}tools/html-to-pdf.html"><i class="bi bi-filetype-html"></i> HTML to PDF</a></li>
          </ul>
        </div>

        <div>
          <div class="mobile-nav-section-title">Organize & Optimize</div>
          <ul class="mobile-nav-list">
            <li><a href="${base}tools/repair-pdf.html"><i class="bi bi-wrench-adjustable"></i> Repair PDF</a></li>
            <li><a href="${base}tools/compare-pdf.html"><i class="bi bi-layout-split"></i> Compare PDFs</a></li>
            <li><a href="${base}tools/sanitize-pdf.html"><i class="bi bi-shield-check"></i> Sanitize PDF</a></li>
            <li><a href="${base}tools/sign-pdf.html"><i class="bi bi-pen"></i> Sign PDF</a></li>
            <li><a href="${base}tools/merge-pdf.html"><i class="bi bi-plus-square"></i> Merge PDF</a></li>
            <li><a href="${base}tools/split-pdf.html"><i class="bi bi-layout-split"></i> Split PDF</a></li>
            <li><a href="${base}tools/remove-pages.html"><i class="bi bi-trash3"></i> Remove Pages</a></li>
            <li><a href="${base}tools/extract-pages.html"><i class="bi bi-box-arrow-up-right"></i> Extract Pages</a></li>
            <li><a href="${base}tools/compress-pdf.html"><i class="bi bi-file-earmark-zip"></i> Compress PDF</a></li>
            <li><a href="${base}tools/add-watermark.html"><i class="bi bi-shield-shaded"></i> Add Watermark</a></li>
            <li><a href="${base}tools/rotate-pdf.html"><i class="bi bi-arrow-clockwise"></i> Rotate PDF</a></li>
            <li><a href="${base}tools/add-page-numbers.html"><i class="bi bi-123"></i> Add Page Numbers</a></li>
            <li><a href="${base}tools/protect-pdf.html"><i class="bi bi-shield-lock"></i> Protect PDF</a></li>
            <li><a href="${base}tools/unlock-pdf.html"><i class="bi bi-unlock"></i> Unlock PDF</a></li>
          </ul>
        </div>

        <div>
          <div class="mobile-nav-section-title">Resources</div>
          <ul class="mobile-nav-list">
            <li><a href="${base}faq.html"><i class="bi bi-question-circle"></i> FAQ</a></li>
            <li><a href="${base}about.html"><i class="bi bi-info-circle"></i> About</a></li>
            <li><a href="${base}contact.html"><i class="bi bi-envelope"></i> Contact</a></li>
            <li><a href="${base}privacy.html"><i class="bi bi-shield-check"></i> Privacy Policy</a></li>
            <li><a href="${base}cookie-policy.html"><i class="bi bi-shield-lock"></i> Cookie Policy</a></li>
            <li><a href="${base}terms.html"><i class="bi bi-file-text"></i> Terms of Service</a></li>
          </ul>
        </div>
      </div>
    `;

    // 3. Ensure Quick Search Modal Exists
    let searchModal = document.getElementById('searchModalBackdrop');
    if (!searchModal) {
      searchModal = document.createElement('div');
      searchModal.className = 'search-modal-backdrop';
      searchModal.id = 'searchModalBackdrop';
      searchModal.setAttribute('role', 'dialog');
      searchModal.setAttribute('aria-modal', 'true');
      searchModal.setAttribute('aria-label', 'Search tools');
      document.body.appendChild(searchModal);
    }

    searchModal.innerHTML = `
      <div class="search-modal">
        <div class="search-input-wrap">
          <i class="bi bi-search" aria-hidden="true"></i>
          <input type="search" class="search-input" id="searchModalInput" placeholder="Search by tool name or format (e.g. Word, OCR, Split)..." autocomplete="off" spellcheck="false">
          <button type="button" class="file-action-btn" id="searchModalClose" aria-label="Close search">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="search-results" id="searchResults"></div>
        <div class="search-modal-footer">
          <span><kbd class="search-kbd">↑</kbd> <kbd class="search-kbd">↓</kbd> to navigate</span>
          <span><kbd class="search-kbd">↵</kbd> to select</span>
          <span><kbd class="search-kbd">ESC</kbd> to close</span>
        </div>
      </div>
    `;

    // 4. Render Global Footer
    const footer = document.querySelector('.site-footer') || document.getElementById('siteFooter');
    if (footer) {
      footer.innerHTML = `
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <a class="brand" href="${base}index.html">
                <span class="brand-mark"><img src="${base}assets/images/logo-mark.png" width="24" height="24" alt=""></span>
                <span class="brand-name">SmartAss<em>PDF</em></span>
              </a>
              <p>Free, fast, and practical document workflows built around open-source technology.</p>
              <div class="footer-social-links">
                <a href="https://www.facebook.com/profile.php?id=61580387357259" target="_blank" rel="noopener noreferrer" class="footer-social-btn" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
                <a href="https://x.com/smartasspdf_com" target="_blank" rel="noopener noreferrer" class="footer-social-btn" aria-label="Twitter X"><i class="bi bi-twitter-x"></i></a>
                <a href="https://www.linkedin.com/company/108761055/admin/dashboard/" target="_blank" rel="noopener noreferrer" class="footer-social-btn" aria-label="LinkedIn"><i class="bi bi-linkedin"></i></a>
                <a href="https://www.instagram.com/smartasspdf_official/" target="_blank" rel="noopener noreferrer" class="footer-social-btn" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
              </div>
            </div>

            <div class="footer-col">
              <h4>Convert</h4>
              <ul class="footer-col-nav">
                <li><a href="${base}tools/ocr-pdf.html">OCR PDF</a></li>
                <li><a href="${base}tools/pdf-to-word.html">PDF to Word</a></li>
                <li><a href="${base}tools/pdf-to-excel.html">PDF to Excel</a></li>
                <li><a href="${base}tools/pdf-to-jpg.html">PDF to JPG</a></li>
                <li><a href="${base}tools/word-to-pdf.html">Word to PDF</a></li>
                <li><a href="${base}tools/image-to-webp.html">Image to WebP</a></li>
              </ul>
            </div>

            <div class="footer-col">
              <h4>Organize & Protect</h4>
              <ul class="footer-col-nav">
                <li><a href="${base}tools/repair-pdf.html">Repair PDF</a></li>
                <li><a href="${base}tools/compare-pdf.html">Compare PDFs</a></li>
                <li><a href="${base}tools/sanitize-pdf.html">Sanitize PDF</a></li>
                <li><a href="${base}tools/sign-pdf.html">Sign PDF</a></li>
                <li><a href="${base}tools/merge-pdf.html">Merge PDF</a></li>
                <li><a href="${base}tools/split-pdf.html">Split PDF</a></li>
                <li><a href="${base}tools/compress-pdf.html">Compress PDF</a></li>
                <li><a href="${base}tools/protect-pdf.html">Protect PDF</a></li>
              </ul>
            </div>

            <div class="footer-col">
              <h4>Company & Legal</h4>
              <ul class="footer-col-nav">
                <li><a href="${base}blog/index.html">Blog & Guides</a></li>
                <li><a href="${base}about.html">About</a></li>
                <li><a href="${base}faq.html">FAQ</a></li>
                <li><a href="${base}contact.html">Contact</a></li>
                <li><a href="${base}privacy.html">Privacy Policy</a></li>
                <li><a href="${base}cookie-policy.html">Cookie Policy</a></li>
                <li><a href="${base}terms.html">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div class="footer-bottom">
            <small>© 2026 SmartAssPDF. Open-source powered document utilities.</small>
            <span>Free Tools • No Account Required • Temporary Storage</span>
          </div>
        </div>
      `;
    }
  }

  /* ==========================================================================
     4. Header Scroll & Mobile Navigation Drawer
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
    initGlobalLayout();
    initTheme();
    initHeaderAndDrawer();
    initSearchModal();
    initScrollAnimations();
    initToolGrid();
    markActiveNav();
  });
})();
