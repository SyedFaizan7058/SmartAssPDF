/**
 * SmartAssPDF â€” Blog Registry & Knowledge Base Data
 * Static article metadata, categorization, reading times, and cross-linking associations.
 */

(function () {
  'use strict';

  const BLOG_ARTICLES = [
    {
      slug: "how-to-convert-pdf-to-word",
      title: "How to Convert PDF to Word: Step-by-Step Guide",
      metaTitle: "How to Convert PDF to Word (DOCX) Online Free | SmartAssPDF",
      metaDesc: "Learn how to convert PDF files to editable Word documents (DOCX) accurately with no software installation or registration.",
      category: "conversion",
      categoryName: "Conversion",
      icon: "bi-file-earmark-word",
      readTime: "4 min read",
      publishedDate: "2026-08-15",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Turn static PDFs into clean, editable Microsoft Word (.docx) documents without subscription barriers or desktop installations.",
      primaryTool: "pdf-to-word",
      relatedTools: ["word-to-pdf", "pdf-to-excel", "compress-pdf"],
      relatedArticles: ["pdf-vs-word", "how-to-compress-pdf-without-losing-quality"],
      aeo: {
        shortAnswer: "To convert a PDF to Word online, upload your PDF document to the SmartAssPDF PDF to Word converter, let the engine extract text and layout structures into DOCX format, and click Download.",
        highlights: [
          "Preserves text paragraphs and basic formatting",
          "Outputs native Microsoft Word .docx format",
          "100% browser-based with automatic 30-minute file cleanup"
        ]
      }
    },
    {
      slug: "how-to-compress-pdf-without-losing-quality",
      title: "How to Compress a PDF Without Losing Quality",
      metaTitle: "How to Compress PDF Without Losing Quality | SmartAssPDF",
      metaDesc: "Discover proven strategies to reduce PDF file size for email and web uploads while preserving crisp text and sharp images.",
      category: "optimization",
      categoryName: "Optimization",
      icon: "bi-arrows-collapse",
      readTime: "5 min read",
      publishedDate: "2026-08-14",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Reduce large document file sizes by optimizing embedded JPEG resources and stream dictionaries without rendering text unreadable.",
      primaryTool: "compress-pdf",
      relatedTools: ["merge-pdf", "split-pdf", "pdf-to-jpg"],
      relatedArticles: ["how-to-merge-pdf-files", "what-is-pdfa"],
      aeo: {
        shortAnswer: "PDF compression reduces file size by downsampling high-resolution images, removing redundant stream objects, and compressing embedded font metadata while maintaining readable text.",
        highlights: [
          "Optimizes raster image resolutions to 150 DPI",
          "Strips unreferenced font and stream dictionaries",
          "Ideal for email attachments and portal upload limits"
        ]
      }
    },
    {
      slug: "how-to-merge-pdf-files",
      title: "How to Merge Multiple PDF Files into One Document",
      metaTitle: "How to Merge PDF Files Online Free | SmartAssPDF",
      metaDesc: "Combine multiple PDF reports, invoices, or scanned documents into a single organized PDF file in seconds.",
      category: "organization",
      categoryName: "Organization",
      icon: "bi-files",
      readTime: "3 min read",
      publishedDate: "2026-08-12",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Combine disparate PDF files, reorder pages, and produce a single clean binder document with zero watermark limitations.",
      primaryTool: "merge-pdf",
      relatedTools: ["split-pdf", "add-page-numbers", "compress-pdf"],
      relatedArticles: ["how-to-split-pdf-pages", "how-to-compress-pdf-without-losing-quality"],
      aeo: {
        shortAnswer: "To merge PDFs, select two or more PDF files, arrange them in your preferred reading order, and process them through the PDFBox merger engine to generate a single consolidated PDF.",
        highlights: [
          "Supports multi-file drag and drop",
          "Retains original page dimensions and bookmarks",
          "Generates streamlined single-file output"
        ]
      }
    },
    {
      slug: "how-to-split-pdf-pages",
      title: "How to Split PDF Pages and Extract Specific Ranges",
      metaTitle: "How to Split PDF Pages Online | SmartAssPDF",
      metaDesc: "Extract individual pages or custom page ranges (e.g. 1-3, 5, 8-10) from large PDF documents into separate files or ZIP archives.",
      category: "organization",
      categoryName: "Organization",
      icon: "bi-scissors",
      readTime: "4 min read",
      publishedDate: "2026-08-11",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Learn how to isolate specific chapters, single invoices, or custom ranges from oversized documents with precise range notation.",
      primaryTool: "split-pdf",
      relatedTools: ["merge-pdf", "rotate-pdf", "add-page-numbers"],
      relatedArticles: ["how-to-merge-pdf-files", "pdf-vs-word"],
      aeo: {
        shortAnswer: "To split a PDF, upload your document, enter your desired page intervals (such as 1-5 or 2, 4, 6), and download either a targeted single PDF or a ZIP archive containing individual pages.",
        highlights: [
          "Flexible range syntax (e.g. 1-4, 7, 10-12)",
          "Single range exports as a direct PDF",
          "Multiple ranges packaged in a organized ZIP"
        ]
      }
    },
    {
      slug: "pdf-vs-word",
      title: "PDF vs Word: When to Use Which Document Format",
      metaTitle: "PDF vs Word (DOCX): Which Format Should You Use? | SmartAssPDF",
      metaDesc: "A practical guide comparing PDF and Microsoft Word for editing, printing, legal contracts, archiving, and collaborative workflows.",
      category: "knowledge",
      categoryName: "Knowledge",
      icon: "bi-file-earmark-diff",
      readTime: "6 min read",
      publishedDate: "2026-08-10",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Understand the core trade-offs between fixed-layout PDFs and reflowable Microsoft Word files to pick the right format every time.",
      primaryTool: "pdf-to-word",
      relatedTools: ["word-to-pdf", "html-to-pdf", "pdf-to-excel"],
      relatedArticles: ["how-to-convert-pdf-to-word", "what-is-pdfa"],
      aeo: {
        shortAnswer: "Use Microsoft Word when documents require frequent textual editing, collaborative tracked changes, and drafting. Use PDF when sharing finalized contracts, forms, resumes, or print-ready files where layout consistency is critical across all devices.",
        highlights: [
          "Word = Reflowable, editable, collaboration-first",
          "PDF = Fixed-layout, cross-platform, print-accurate",
          "Seamless bidirectional conversion with SmartAssPDF"
        ]
      }
    },
    {
      slug: "how-to-protect-pdf-with-password",
      title: "How to Password Protect a PDF with 256-Bit AES Encryption",
      metaTitle: "How to Password Protect a PDF Online | SmartAssPDF",
      metaDesc: "Secure confidential business agreements, financial statements, and sensitive tax forms with standard 256-bit AES encryption.",
      category: "security",
      categoryName: "Security",
      icon: "bi-shield-lock",
      readTime: "4 min read",
      publishedDate: "2026-08-08",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Add industry-standard encryption to confidential documents to prevent unauthorized viewing, printing, and content scraping.",
      primaryTool: "protect-pdf",
      relatedTools: ["unlock-pdf", "compress-pdf", "add-page-numbers"],
      relatedArticles: ["how-to-compress-pdf-without-losing-quality", "what-is-pdfa"],
      aeo: {
        shortAnswer: "To protect a PDF, upload your document to SmartAssPDF Protect PDF, input a strong user password, and the engine will apply 256-bit AES encryption to enforce password authorization upon opening.",
        highlights: [
          "Standard 256-bit AES encryption",
          "Restricts unauthorized viewing and extraction",
          "Files deleted automatically from processing memory"
        ]
      }
    },
    {
      slug: "how-to-convert-jpg-to-pdf",
      title: "How to Convert JPG and PNG Images to PDF Online",
      metaTitle: "How to Convert JPG to PDF Online Free | SmartAssPDF",
      metaDesc: "Transform receipts, photos, and scanned PNG/JPEG images into standard A4 PDF files with proper margins and aspect ratios.",
      category: "conversion",
      categoryName: "Conversion",
      icon: "bi-image",
      readTime: "3 min read",
      publishedDate: "2026-08-06",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Turn single or multi-image receipts, invoices, and photo scans into standardized, printable PDF pages with automatic centering.",
      primaryTool: "jpg-to-pdf",
      relatedTools: ["image-to-pdf", "pdf-to-jpg", "merge-pdf"],
      relatedArticles: ["how-to-merge-pdf-files", "how-to-compress-pdf-without-losing-quality"],
      aeo: {
        shortAnswer: "To convert JPG images to PDF, upload one or more JPG/PNG files to SmartAssPDF JPG to PDF. The engine centers each image onto standard A4 pages while preserving aspect ratio, creating an instant downloadable PDF.",
        highlights: [
          "Supports JPG, JPEG, and PNG formats",
          "Maintains original aspect ratios without distortion",
          "Batch combine multiple scans in upload order"
        ]
      }
    },
    {
      slug: "what-is-pdfa",
      title: "What Is PDF/A? Complete Guide to PDF Archiving",
      metaTitle: "What Is PDF/A? PDF Archiving Standard Explained | SmartAssPDF",
      metaDesc: "Learn what PDF/A is, why governments and enterprises require it for digital archiving, and how it differs from standard PDF.",
      category: "knowledge",
      categoryName: "Knowledge",
      icon: "bi-archive",
      readTime: "5 min read",
      publishedDate: "2026-08-04",
      modifiedDate: "2026-08-20",
      author: "SmartAssPDF Editorial Team",
      excerpt: "Discover why standard PDFs can degrade over decades and how the ISO PDF/A specification ensures long-term preservation.",
      primaryTool: "pdf-to-word",
      relatedTools: ["protect-pdf", "compress-pdf", "add-page-numbers"],
      relatedArticles: ["pdf-vs-word", "how-to-protect-pdf-with-password"],
      aeo: {
        shortAnswer: "PDF/A is an ISO-standardized version of the Portable Document Format specialized for long-term archiving and digital preservation by embedding all fonts and colors and banning external dependencies.",
        highlights: [
          "ISO standard (ISO 19005) for long-term archiving",
          "Mandates 100% self-contained fonts and color profiles",
          "Bans external references, JavaScript, and audio/video"
        ]
      }
    }
  ];

  window.SMARTASSPDF_BLOG = {
    getAllArticles: () => BLOG_ARTICLES,
    getArticle: (slug) => BLOG_ARTICLES.find(a => a.slug === slug),
    getByCategory: (cat) => cat === 'all' ? BLOG_ARTICLES : BLOG_ARTICLES.filter(a => a.category === cat),
    getRelatedArticles: (slugs) => BLOG_ARTICLES.filter(a => slugs && slugs.includes(a.slug))
  };
})();
