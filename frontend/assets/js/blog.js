/**
 * SmartAssPDF â€” Blog System & Article Engine
 * Provides category filtering, live search on the Blog Hub, and dynamic Table of Contents on Article pages.
 */

(function () {
  'use strict';

  // 1. Blog Listing Engine (for /blog/index.html)
  function initBlogListing() {
    const blogGrid = document.getElementById("blogArticlesGrid");
    const categoryTabs = document.querySelectorAll("[data-blog-category]");
    const searchInput = document.getElementById("blogSearchInput");

    if (!blogGrid || !window.SMARTASSPDF_BLOG) return;

    let currentCategory = "all";
    let searchQuery = "";

    function renderArticles() {
      let articles = window.SMARTASSPDF_BLOG.getAllArticles();

      if (currentCategory !== "all") {
        articles = articles.filter(a => a.category === currentCategory);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        articles = articles.filter(a =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          a.categoryName.toLowerCase().includes(q)
        );
      }

      if (articles.length === 0) {
        blogGrid.innerHTML = `
          <div class="card text-center" style="grid-column: 1 / -1; padding: 48px 24px;">
            <i class="bi bi-search" style="font-size: 2.4rem; color: var(--text-muted); margin-bottom: 12px; display: block;"></i>
            <h3 style="font-size: 1.25rem; font-weight: 750;">No guides found</h3>
            <p style="color: var(--text-secondary); max-width: 420px; margin: 0 auto 16px;">We couldn't find any articles matching "${searchQuery}". Try selecting another category.</p>
            <button class="btn btn-secondary btn-sm" id="resetBlogFilterBtn" style="margin: 0 auto;">View All Guides</button>
          </div>
        `;
        document.getElementById("resetBlogFilterBtn")?.addEventListener("click", () => {
          currentCategory = "all";
          searchQuery = "";
          if (searchInput) searchInput.value = "";
          categoryTabs.forEach(t => t.classList.toggle("is-active", t.dataset.blogCategory === "all"));
          renderArticles();
        });
        return;
      }

      blogGrid.innerHTML = articles.map(a => `
        <article class="blog-card reveal-on-scroll">
          <a href="${a.slug}.html" class="blog-card-body" aria-label="Read ${a.title}">
            <div class="blog-card-top">
              <span class="blog-badge">${a.categoryName}</span>
              <span class="blog-read-time"><i class="bi bi-clock me-1"></i> ${a.readTime}</span>
            </div>
            <h3>${a.title}</h3>
            <p>${a.excerpt}</p>
            <div class="blog-card-footer">
              <span class="blog-date"><i class="bi bi-calendar-event me-1"></i> ${a.publishedDate}</span>
              <span class="blog-cta-link">View Details <i class="bi bi-arrow-right"></i></span>
            </div>
          </a>
        </article>
      `).join("");

      if (window.initScrollAnimations) {
        window.initScrollAnimations();
      }
    }

    categoryTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        categoryTabs.forEach(t => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        currentCategory = tab.dataset.blogCategory || "all";
        renderArticles();
      });
    });

    searchInput?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderArticles();
    });

    renderArticles();
  }

  // 2. Article Table of Contents & ScrollSpy (for /blog/*.html)
  function initArticleTOC() {
    const articleBody = document.querySelector(".article-body");
    const tocContainer = document.getElementById("articleTocList");

    if (!articleBody || !tocContainer) return;

    const headings = articleBody.querySelectorAll("h2, h3");
    if (headings.length < 2) {
      const sidebar = document.querySelector(".article-toc-sidebar");
      if (sidebar) sidebar.style.display = "none";
      return;
    }

    tocContainer.innerHTML = "";
    const tocLinks = [];

    headings.forEach((heading, idx) => {
      if (!heading.id) {
        heading.id = "heading-" + idx + "-" + heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }

      const li = document.createElement("li");
      if (heading.tagName.toLowerCase() === "h3") {
        li.style.paddingLeft = "14px";
      }

      const a = document.createElement("a");
      a.href = "#" + heading.id;
      a.className = "toc-link";
      a.textContent = heading.textContent;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, null, "#" + heading.id);
      });

      li.appendChild(a);
      tocContainer.appendChild(li);
      tocLinks.push({ heading, link: a });
    });

    // ScrollSpy active state
    function updateActiveTOC() {
      const scrollY = window.scrollY + 120;
      let activeLink = null;

      for (const item of tocLinks) {
        const top = item.heading.getBoundingClientRect().top + window.scrollY;
        if (scrollY >= top) {
          activeLink = item.link;
        }
      }

      tocLinks.forEach(item => item.link.classList.remove("is-active"));
      if (activeLink) {
        activeLink.classList.add("is-active");
      }
    }

    window.addEventListener("scroll", updateActiveTOC, { passive: true });
    updateActiveTOC();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initBlogListing();
    initArticleTOC();
  });
})();
