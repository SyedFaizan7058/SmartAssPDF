/**
 * SmartAssPDF — Open-Source AI PDF Assistant (SmartAss AI)
 * 100% Free, Zero-Cost, Local Browser-Native AI Agent
 *
 * Features:
 * - Natural Language Intent Parsing & Semantic Matching
 * - Comprehensive PDF Knowledge Base & Troubleshooting
 * - 1-Click Interactive Tool Deep-Linking
 * - Streaming Typing Animation & Responsive Glassmorphism UI
 * - Zero external API keys or server costs required
 */

(function () {
  'use strict';

  // Determine relative root prefix based on current pathname
  function getPathPrefix() {
    const p = window.location.pathname.replace(/\\/g, '/');
    if (p.includes('/tools/') || p.includes('/blog/')) {
      return '../';
    }
    return '';
  }

  const prefix = getPathPrefix();

  // Knowledge Base & Semantic Intent Mappings
  const KNOWLEDGE_BASE = [
    {
      keywords: ['compress', 'shrink', 'smaller', 'size', 'reduce', 'kb', 'mb', 'heavy', 'email', 'lighten', 'optimize'],
      title: 'Compress PDF',
      badge: 'Optimization',
      tool: { name: 'Compress PDF', path: `${prefix}tools/compress-pdf.html`, icon: 'bi-file-earmark-zip' },
      reply: `To make your PDF file size smaller without sacrificing text readability:
1. Use our **Compress PDF** tool.
2. It optimizes embedded JPEG images, strips redundant metadata streams, and re-compresses objects.
3. You can achieve up to **70-80% file size reduction** while keeping fonts crisp.`,
      chips: ['How to merge PDFs?', 'Is compression lossy?']
    },
    {
      keywords: ['word', 'docx', 'doc', 'editable', 'edit text', 'convert to word', 'pdf to word'],
      title: 'PDF to Word Converter',
      badge: 'Conversion',
      tool: { name: 'PDF to Word', path: `${prefix}tools/pdf-to-word.html`, icon: 'bi-file-earmark-word' },
      reply: `To turn a static PDF into an editable Microsoft Word document:
1. Open the **PDF to Word** tool.
2. Upload your PDF file.
3. Our backend extracts text flow, paragraphs, and tables into a clean **.docx** file that opens directly in Microsoft Word, Google Docs, or LibreOffice.`,
      chips: ['Can I convert Word to PDF?', 'Does it preserve tables?']
    },
    {
      keywords: ['merge', 'combine', 'join', 'stitch', 'put together', 'unite', 'multiple pdf'],
      title: 'Merge PDF Documents',
      badge: 'Organization',
      tool: { name: 'Merge PDF', path: `${prefix}tools/merge-pdf.html`, icon: 'bi-plus-square' },
      reply: `To combine multiple PDF documents into a single unified file:
1. Head over to **Merge PDF**.
2. Select or drag up to **20 PDF files** at once (up to 50 MB total).
3. Arrange your desired page order and click **Merge**.
4. Download your bound PDF instantly with zero watermark stamps.`,
      chips: ['How to split pages?', 'How to reorder pages?']
    },
    {
      keywords: ['split', 'extract', 'cut', 'separate', 'pages', 'range', 'divide', 'single page'],
      title: 'Split PDF Pages',
      badge: 'Organization',
      tool: { name: 'Split PDF', path: `${prefix}tools/split-pdf.html`, icon: 'bi-layout-split' },
      reply: `To extract specific pages or split chapters from a PDF:
1. Use the **Split PDF** tool.
2. Specify exact page numbers or ranges (e.g. \`1-3, 5, 8-12\`).
3. Download an extracted, standalone document containing only the pages you selected.`,
      chips: ['How to merge PDFs back?', 'How to rotate pages?']
    },
    {
      keywords: ['excel', 'xlsx', 'xls', 'spreadsheet', 'csv', 'sheets', 'table to excel'],
      title: 'PDF to Excel Converter',
      badge: 'Conversion',
      tool: { name: 'PDF to Excel', path: `${prefix}tools/pdf-to-excel.html`, icon: 'bi-file-earmark-excel' },
      reply: `To convert tabular PDF data into Microsoft Excel spreadsheets:
1. Use **PDF to Excel**.
2. Upload bank statements, invoices, or data reports.
3. The engine parses tabular rows and columns into clean **.xlsx** sheets ready for formulas and analysis.`,
      chips: ['Can I convert PDF to Word?', 'PDF to JPG converter']
    },
    {
      keywords: ['webp', 'image to webp', 'png to webp', 'jpg to webp', 'compress image', 'convert to webp', 'lightweight image'],
      title: 'Image to WebP Converter',
      badge: 'Optimization',
      tool: { name: 'Image to WebP', path: `${prefix}tools/image-to-webp.html`, icon: 'bi-file-earmark-image' },
      reply: `To convert PNG, JPG, or JPEG photos into ultra-compact, high-performance WebP images:
1. Open the **Image to WebP** tool.
2. Upload single or multiple images (up to 20 files).
3. Select your quality preset (Balanced 85% recommended, Compact 65%, or Ultra Crisp 95%).
4. Download your converted WebP files individually or in an organized ZIP package with full alpha transparency support.`,
      chips: ['Convert PDF to JPG', 'How to compress PDF?']
    },
    {
      keywords: ['jpg', 'png', 'image to pdf', 'photo to pdf', 'scan to pdf', 'picture to pdf', 'jpeg'],
      title: 'Image to PDF Converter',
      badge: 'Conversion',
      tool: { name: 'Image to PDF', path: `${prefix}tools/image-to-pdf.html`, icon: 'bi-file-earmark-image' },
      reply: `To convert photos, screenshots, or receipts into standardized PDF pages:
1. Open **Image to PDF**.
2. Upload JPG, PNG, or JPEG images.
3. Automatically sets page margins, orientations, and scales each picture to crisp printable pages.`,
      chips: ['How to convert Image to WebP?', 'How to convert PDF to JPG?']
    },
    {
      keywords: ['pdf to jpg', 'pdf to image', 'pdf to photo', 'extract pictures', 'export images'],
      title: 'PDF to JPG Converter',
      badge: 'Conversion',
      tool: { name: 'PDF to JPG', path: `${prefix}tools/pdf-to-jpg.html`, icon: 'bi-file-earmark-image' },
      reply: `To convert PDF pages into high-resolution JPG images:
1. Go to **PDF to JPG**.
2. Select your document.
3. Each page is rendered at 300 DPI into crisp individual image files, perfect for sharing on social media or inserting into presentations.`,
      chips: ['Convert JPG to PDF', 'Compress images in PDF']
    },
    {
      keywords: ['password', 'lock', 'protect', 'encrypt', 'aes', 'secure', 'confidential', 'security'],
      title: 'Protect PDF with Password',
      badge: 'Security',
      tool: { name: 'Protect PDF', path: `${prefix}tools/protect-pdf.html`, icon: 'bi-shield-lock' },
      reply: `To secure confidential documents with encryption:
1. Open the **Protect PDF** tool.
2. Enter your chosen password.
3. SmartAssPDF applies **256-bit AES encryption**, restricting unauthorized viewing, printing, and extraction.
4. *Important:* We never store your password or file content.`,
      chips: ['How to unlock PDF?', 'Is 256-bit AES safe?']
    },
    {
      keywords: ['unlock', 'remove password', 'decrypt', 'unprotect', 'forgot password', 'strip password'],
      title: 'Unlock Password-Protected PDF',
      badge: 'Security',
      tool: { name: 'Unlock PDF', path: `${prefix}tools/unlock-pdf.html`, icon: 'bi-unlock' },
      reply: `To remove password restrictions from a document you own:
1. Open **Unlock PDF**.
2. Enter the valid owner/user password once.
3. Download an unrestricted version of the PDF with encryption removed for easier sharing.`,
      chips: ['How to protect PDF?', 'How to compress unlocked PDF?']
    },
    {
      keywords: ['rotate', 'sideways', 'upside down', 'orientation', 'flip', 'landscape', 'portrait'],
      title: 'Rotate PDF Pages',
      badge: 'Organization',
      tool: { name: 'Rotate PDF', path: `${prefix}tools/rotate-pdf.html`, icon: 'bi-arrow-clockwise' },
      reply: `To fix upside-down or sideways scans:
1. Go to **Rotate PDF**.
2. Choose to rotate 90°, 180°, or 270° clockwise.
3. Apply rotation to all pages or specific page subsets with one click.`,
      chips: ['How to add page numbers?', 'How to split pages?']
    },
    {
      keywords: ['page numbers', 'numbering', 'footer numbers', 'pagination', 'bates', 'header'],
      title: 'Add Page Numbers to PDF',
      badge: 'Organization',
      tool: { name: 'Add Page Numbers', path: `${prefix}tools/add-page-numbers.html`, icon: 'bi-123' },
      reply: `To add page numbers or pagination headers/footers:
1. Open **Add Page Numbers**.
2. Choose position (bottom-center, bottom-right, top-right) and format (e.g. \`Page 1 of N\`).
3. Instantly stamp clean pagination across your entire document.`,
      chips: ['How to merge PDFs?', 'How to protect PDF?']
    },
    {
      keywords: ['html', 'url', 'webpage', 'html to pdf', 'code to pdf'],
      title: 'HTML to PDF Converter',
      badge: 'Conversion',
      tool: { name: 'HTML to PDF', path: `${prefix}tools/html-to-pdf.html`, icon: 'bi-filetype-html' },
      reply: `To turn HTML markup or reports into formatted PDFs:
1. Open **HTML to PDF**.
2. Paste your raw HTML or upload files.
3. Our OpenHTMLtoPDF engine renders accurate CSS styling, tables, and typography into printable pages.`,
      chips: ['PDF to Word converter', 'Word to PDF converter']
    },
    {
      keywords: ['privacy', 'safety', 'delete', 'deleted', 'cleanup', 'storage', 'data', 'gdpr', 'confidential'],
      title: 'Privacy & Security Guarantee',
      badge: 'Privacy',
      tool: { name: 'Privacy Policy', path: `${prefix}privacy.html`, icon: 'bi-shield-check' },
      reply: `**SmartAssPDF Privacy Architecture:**
- **Zero Permanent Storage:** Documents reside in isolated temporary job directories on the server during active processing only.
- **30-Minute Auto Cleanup:** A scheduled background worker permanently deletes all temporary files after 30 minutes.
- **No User Tracking:** No accounts, no database profiles, and no document scraping.`,
      chips: ['Is SmartAssPDF free?', 'What is the file limit?']
    },
    {
      keywords: ['limit', 'max size', 'maximum', '50mb', 'file size', 'how many files', 'quota'],
      title: 'File Limits & Capacity',
      badge: 'Specifications',
      tool: { name: 'FAQ & Specs', path: `${prefix}faq.html`, icon: 'bi-question-circle' },
      reply: `**SmartAssPDF Usage Limits:**
- **Max File Size:** 50 MB per single file.
- **Multi-File Batch Operations:** Up to 20 files per merge/convert request.
- **Cost:** **100% Free** with unlimited daily conversions. No credit card or registration ever required.`,
      chips: ['Why is my upload failing?', 'Compress large PDF']
    },
    {
      keywords: ['pdfa', 'pdf/a', 'archive', 'long term', 'iso', 'preservation'],
      title: 'PDF/A Archival Guide',
      badge: 'Knowledge',
      tool: { name: 'What is PDF/A? Guide', path: `${prefix}blog/what-is-pdfa.html`, icon: 'bi-journal-richtext' },
      reply: `**PDF/A (ISO 19005)** is an ISO-standardized version of PDF designed for long-term document archiving.
- It embeds all fonts and color profiles directly inside the file.
- Disallows dynamic scripts, encryption, and external font links so the document renders identically 50 years from now.`,
      chips: ['How to convert PDF to Word?', 'Password protect PDF']
    }
  ];

  // Fallback intelligent response generator
  function findBestMatch(userInput) {
    const clean = userInput.toLowerCase().trim();

    if (!clean || clean.length < 2) {
      return {
        reply: "Hi! How can I assist you with your PDF files today? You can ask me how to convert, compress, merge, split, or secure any document.",
        chips: ['⚡ Compress PDF', '🔄 PDF to Word', '📑 Merge PDF', '🔒 Protect PDF']
      };
    }

    // Check greeting
    if (/^(hi|hello|hey|greetings|hola|namaste|sup|yo)\b/.test(clean)) {
      return {
        reply: `👋 **Hello! I'm SmartAss AI**, your open-source document assistant. What would you like to do with your PDF today?`,
        chips: ['⚡ Compress a PDF', '🔄 Convert to Word', '📑 Merge multiple PDFs', '🔒 Encrypt with password']
      };
    }

    // Score knowledge base entries
    let bestEntry = null;
    let highestScore = 0;

    for (const entry of KNOWLEDGE_BASE) {
      let score = 0;
      for (const kw of entry.keywords) {
        if (clean.includes(kw)) {
          score += kw.length;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestEntry = entry;
      }
    }

    if (bestEntry && highestScore > 0) {
      return bestEntry;
    }

    // General fallback recommendation
    return {
      reply: `I understand you're asking about **"${userInput}"**. 
SmartAssPDF offers **16 free open-source document tools** to handle conversions, optimizations, and security:
- **Conversion:** PDF to Word, Excel, JPG, PowerPoint, HTML.
- **Organization:** Merge, Split, Rotate, Add Page Numbers.
- **Optimization & Security:** Compress (up to 80% reduction), Password Protect (256-bit AES), and Unlock.

Which tool would you like to explore?`,
      chips: ['Explore All 16 Tools', '⚡ Compress PDF', '🔄 PDF to Word', '❓ Read Privacy Policy'],
      tool: { name: 'Explore All Tools', path: `${prefix}index.html#tools`, icon: 'bi-grid-fill' }
    };
  }

  // Create and Mount Chatbot UI
  function initAiAgent() {
    if (document.getElementById('smartassAiContainer')) return;

    const container = document.createElement('div');
    container.id = 'smartassAiContainer';
    container.className = 'ai-agent-container';

    container.innerHTML = `
      <!-- Floating Action Button Trigger -->
      <button type="button" class="ai-fab-btn" id="aiFabBtn" aria-label="Open SmartAss AI Assistant" title="Chat with SmartAss AI Assistant">
        <div class="ai-fab-icon-wrap">
          <img src="${prefix}assets/images/logo-mark.png" alt="SmartAss AI Mascot" class="ai-fab-avatar">
          <span class="ai-online-dot"></span>
        </div>
        <span class="ai-fab-text">Ask AI</span>
        <span class="ai-fab-badge">Free</span>
      </button>

      <!-- Chat Modal Window -->
      <div class="ai-chat-window" id="aiChatWindow" role="dialog" aria-modal="true" aria-label="SmartAss AI Chat Assistant" style="display:none;">
        <!-- Chat Header -->
        <div class="ai-chat-header">
          <div class="ai-header-left">
            <div class="ai-avatar-badge">
              <img src="${prefix}assets/images/logo-mark.png" alt="AI Mascot" width="30" height="30">
              <span class="ai-status-indicator"></span>
            </div>
            <div>
              <div class="ai-bot-name">SmartAss <em>AI</em> <span class="ai-tag">Open Source</span></div>
              <div class="ai-bot-status"><i class="bi bi-shield-check"></i> Free • Private • Local</div>
            </div>
          </div>
          <div class="ai-header-actions">
            <button type="button" class="ai-header-btn" id="aiClearBtn" title="Clear conversation" aria-label="Clear chat">
              <i class="bi bi-trash3"></i>
            </button>
            <button type="button" class="ai-header-btn" id="aiCloseBtn" title="Close AI Assistant" aria-label="Close chat">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <!-- Chat Messages Scroll Area -->
        <div class="ai-chat-body" id="aiChatBody">
          <!-- Initial Bot Greeting -->
          <div class="ai-message ai-message-bot">
            <div class="ai-msg-avatar">
              <img src="${prefix}assets/images/logo-mark.png" alt="AI">
            </div>
            <div class="ai-msg-bubble">
              <p>👋 <strong>Welcome to SmartAss AI!</strong> I am your free, open-source document assistant.</p>
              <p>Ask me how to convert, compress, merge, split, or password-protect your PDFs, or tap one of the shortcuts below:</p>
            </div>
          </div>

          <!-- Quick Suggestion Chips -->
          <div class="ai-quick-chips" id="aiQuickChips">
            <button type="button" class="ai-chip" data-query="How to compress a PDF without losing quality?">⚡ Compress PDF</button>
            <button type="button" class="ai-chip" data-query="How to convert PDF to Word document?">🔄 PDF to Word</button>
            <button type="button" class="ai-chip" data-query="How to merge multiple PDFs into one?">📑 Merge PDF</button>
            <button type="button" class="ai-chip" data-query="How to password protect a PDF?">🔒 Protect PDF</button>
            <button type="button" class="ai-chip" data-query="How are my files deleted after 30 minutes?">🗑️ Auto Cleanup</button>
          </div>
        </div>

        <!-- Chat Input Bar -->
        <form class="ai-chat-footer" id="aiChatForm">
          <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="Ask anything about PDF tools..." autocomplete="off" maxlength="500">
          <button type="submit" id="aiSendBtn" class="ai-send-btn" aria-label="Send message" title="Send message">
            <i class="bi bi-send-fill"></i>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(container);

    // Event Bindings
    const fabBtn = document.getElementById('aiFabBtn');
    const chatWindow = document.getElementById('aiChatWindow');
    const closeBtn = document.getElementById('aiCloseBtn');
    const clearBtn = document.getElementById('aiClearBtn');
    const chatForm = document.getElementById('aiChatForm');
    const chatInput = document.getElementById('aiChatInput');
    const chatBody = document.getElementById('aiChatBody');

    function toggleChat(open) {
      const isVisible = chatWindow.style.display !== 'none';
      const shouldOpen = open !== undefined ? open : !isVisible;

      if (shouldOpen) {
        chatWindow.style.display = 'flex';
        chatWindow.classList.add('is-open');
        chatInput?.focus();
        scrollChatToBottom();
      } else {
        chatWindow.classList.remove('is-open');
        setTimeout(() => {
          chatWindow.style.display = 'none';
        }, 200);
      }
    }

    fabBtn?.addEventListener('click', () => toggleChat());
    closeBtn?.addEventListener('click', () => toggleChat(false));

    clearBtn?.addEventListener('click', () => {
      chatBody.innerHTML = `
        <div class="ai-message ai-message-bot">
          <div class="ai-msg-avatar"><img src="${prefix}assets/images/logo-mark.png" alt="AI"></div>
          <div class="ai-msg-bubble">
            <p>🧹 Conversation cleared! How can I help you next?</p>
          </div>
        </div>
        <div class="ai-quick-chips" id="aiQuickChips">
          <button type="button" class="ai-chip" data-query="How to compress a PDF without losing quality?">⚡ Compress PDF</button>
          <button type="button" class="ai-chip" data-query="How to convert PDF to Word document?">🔄 PDF to Word</button>
          <button type="button" class="ai-chip" data-query="How to merge multiple PDFs into one?">📑 Merge PDF</button>
          <button type="button" class="ai-chip" data-query="How to password protect a PDF?">🔒 Protect PDF</button>
        </div>
      `;
      bindChipListeners();
    });

    function scrollChatToBottom() {
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function bindChipListeners() {
      const chips = chatBody.querySelectorAll('.ai-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          const query = chip.getAttribute('data-query');
          if (query) {
            handleUserMessage(query);
          }
        });
      });
    }

    bindChipListeners();

    function formatMarkdown(text) {
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    }

    function appendUserMessage(text) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'ai-message ai-message-user';
      msgDiv.innerHTML = `
        <div class="ai-msg-bubble">
          <p>${escapeHtml(text)}</p>
        </div>
      `;
      chatBody.appendChild(msgDiv);
      scrollChatToBottom();
    }

    function appendBotTypingIndicator() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'ai-message ai-message-bot ai-typing-indicator';
      typingDiv.id = 'aiTypingIndicator';
      typingDiv.innerHTML = `
        <div class="ai-msg-avatar"><img src="${prefix}assets/images/logo-mark.png" alt="AI"></div>
        <div class="ai-msg-bubble">
          <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
        </div>
      `;
      chatBody.appendChild(typingDiv);
      scrollChatToBottom();
      return typingDiv;
    }

    function handleUserMessage(query) {
      if (!query || !query.trim()) return;
      appendUserMessage(query);
      chatInput.value = '';

      const typingIndicator = appendBotTypingIndicator();

      // Simulated local intelligence processing delay
      setTimeout(() => {
        typingIndicator.remove();
        const result = findBestMatch(query);

        const botMsgDiv = document.createElement('div');
        botMsgDiv.className = 'ai-message ai-message-bot';

        let toolHtml = '';
        if (result.tool) {
          toolHtml = `
            <div class="ai-tool-card">
              <div class="ai-tool-card-left">
                <i class="bi ${result.tool.icon}"></i>
                <div>
                  <strong>${result.tool.name}</strong>
                  <small>Instant Open-Source Tool</small>
                </div>
              </div>
              <a href="${result.tool.path}" class="btn btn-primary btn-sm">Launch Tool <i class="bi bi-arrow-right"></i></a>
            </div>
          `;
        }

        let chipHtml = '';
        if (result.chips && result.chips.length > 0) {
          chipHtml = `
            <div class="ai-quick-chips" style="margin-top: 12px; margin-bottom: 0;">
              ${result.chips.map(c => `<button type="button" class="ai-chip" data-query="${c}">${c}</button>`).join('')}
            </div>
          `;
        }

        botMsgDiv.innerHTML = `
          <div class="ai-msg-avatar"><img src="${prefix}assets/images/logo-mark.png" alt="AI"></div>
          <div class="ai-msg-bubble">
            <p>${formatMarkdown(result.reply)}</p>
            ${toolHtml}
            ${chipHtml}
          </div>
        `;

        chatBody.appendChild(botMsgDiv);
        bindChipListeners();
        scrollChatToBottom();
      }, 350);
    }

    chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatInput.value.trim();
      if (val) {
        handleUserMessage(val);
      }
    });

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m]));
    }
  }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiAgent);
  } else {
    initAiAgent();
  }
})();
