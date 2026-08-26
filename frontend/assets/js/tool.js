/**
 * SmartAssPDF — Interactive Tool Workspace Engine
 * Handles Drag & Drop, File Validation, Multi-file Management, Options UI,
 * Staged Progress, Live Previews, API Communication & Result Downloads.
 */

(function () {
  'use strict';

  const isLocal = location.hostname === "localhost" || 
                  location.hostname === "127.0.0.1" || 
                  location.hostname === "" || 
                  location.protocol === "file:" ||
                  location.hostname.startsWith("192.168.") ||
                  location.hostname.startsWith("10.") ||
                  location.port !== "";
  const defaultOrigin = isLocal ? "http://localhost:8080" : "https://smartasspdf-backend-35ya.onrender.com";
  const API_ORIGIN = (window.SMARTASSPDF_API_ORIGIN || document.querySelector('meta[name="api-origin"]')?.content || defaultOrigin).replace(/\/$/, "");
  const API_BASE_URL = `${API_ORIGIN}/api/v1`;

  const toolId = document.body.dataset.tool || new URLSearchParams(location.search).get("tool") || "merge-pdf";
  const toolConfig = (window.SMARTASSPDF_TOOLS && window.SMARTASSPDF_TOOLS.getTool(toolId)) || {
    id: toolId,
    name: "PDF Tool",
    title: "PDF Tool",
    category: "organize-pdf",
    badge: "PDF Workflow",
    inputFormat: "PDF",
    outputFormat: "PDF",
    description: "Process your document with SmartAssPDF.",
    longDescription: "Secure, client-validated document processing.",
    accept: ".pdf,application/pdf",
    extensions: [".pdf"],
    multiple: false,
    maxFiles: 1,
    optionsType: "none"
  };

  // State
  let files = [];
  let isProcessing = false;

  // DOM Elements (Queried dynamically to avoid timing / null issues)
  let dropzone, fileInput, browseBtn, fileList, toolOptions, processBtn, statusContainer, previewViewport, previewFilename, previewStatus;

  function queryDOMElements() {
    dropzone = document.getElementById("dropzone");
    fileInput = document.getElementById("fileInput");
    browseBtn = document.getElementById("browseBtn");
    fileList = document.getElementById("fileList");
    toolOptions = document.getElementById("toolOptions");
    processBtn = document.getElementById("processBtn");
    statusContainer = document.getElementById("statusContainer");
    previewViewport = document.getElementById("previewViewport");
    previewFilename = document.getElementById("previewFilename");
    previewStatus = document.getElementById("previewStatus");
  }

  // Format Helper Utilities
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[m]);
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function getFileExt(file) {
    return (file.name.split(".").pop() || "").toLowerCase();
  }

  function isPdf(f) {
    return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  }

  function isJpg(f) {
    return /^image\/jpe?g$/i.test(f.type) || /\.(jpe?g)$/i.test(f.name);
  }

  function isPng(f) {
    return f.type === "image/png" || /\.png$/i.test(f.name);
  }

  function isImage(f) {
    return isJpg(f) || isPng(f) || f.type.startsWith("image/") || /\.(webp|bmp|gif|tiff|svg)$/i.test(f.name);
  }

  function isDocx(f) {
    return f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(f.name);
  }

  function isXlsx(f) {
    return f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || /\.(xlsx|xls)$/i.test(f.name);
  }

  function isHtml(f) {
    return f.type === "text/html" || /\.html?$/i.test(f.name);
  }

  /* ==========================================================================
     1. Client-Side File Validation
     ========================================================================== */
  function validateSingleFile(file) {
    if (!file) return "No file selected.";
    if (file.size === 0) return `File "${file.name}" is empty (0 bytes).`;
    if (file.size > 50 * 1024 * 1024) return `File "${file.name}" exceeds the 50 MB limit (${formatSize(file.size)}).`;

    if (toolId === "image-to-webp" && !isImage(file)) {
      return `Image to WebP accepts PNG, JPG, and JPEG images only. ("${file.name}" is unsupported).`;
    }
    if ((toolId === "image-to-pdf" || toolId === "scan-to-pdf") && !isImage(file)) {
      return `${toolConfig.name} accepts JPG, JPEG, and PNG images only. ("${file.name}" is unsupported).`;
    }
    if (toolId === "word-to-pdf" && !isDocx(file)) {
      return `Word to PDF accepts DOCX documents only. ("${file.name}" is unsupported).`;
    }
    if (toolId === "excel-to-pdf" && !isXlsx(file)) {
      return `Excel to PDF accepts XLSX spreadsheets only. ("${file.name}" is unsupported).`;
    }
    if (toolId === "html-to-pdf" && !isHtml(file)) {
      return `HTML to PDF accepts HTML files only. ("${file.name}" is unsupported).`;
    }
    if (
      toolId.startsWith("pdf-") ||
      ["merge-pdf", "split-pdf", "compress-pdf", "rotate-pdf", "add-page-numbers", "protect-pdf", "unlock-pdf"].includes(toolId)
    ) {
      if (!isPdf(file)) {
        return `${toolConfig.name} accepts PDF files only. ("${file.name}" is unsupported).`;
      }
    }
    return null;
  }

  /* ==========================================================================
     2. File Management & Dropzone
     ========================================================================== */
  function setFiles(newFiles, append = false) {
    let candidate = append ? [...files, ...newFiles] : newFiles;

    if (!toolConfig.multiple) {
      candidate = candidate.slice(0, 1);
    } else if (candidate.length > (toolConfig.maxFiles || 20)) {
      if (window.SmartAssToast) window.SmartAssToast.show(`A maximum of ${toolConfig.maxFiles || 20} files can be processed at once.`, "warning");
      candidate = candidate.slice(0, toolConfig.maxFiles || 20);
    }

    // Validate files
    for (const file of candidate) {
      const errorMsg = validateSingleFile(file);
      if (errorMsg) {
        if (window.SmartAssToast) window.SmartAssToast.show(errorMsg, "error");
        showStatusError(errorMsg);
        return;
      }
    }

    files = candidate;
    clearStatus();
    updateWorkflowProgress(files.length > 0 ? 2 : 1);
    renderFileList();
    updateProcessButtonState();
    renderLivePreview();
  }

  function formatDisplayName(name, maxLen = 20) {
    if (!name || name.length <= maxLen) return name;
    const lastDot = name.lastIndexOf(".");
    if (lastDot > 0 && name.length - lastDot <= 6) {
      const ext = name.slice(lastDot);
      const base = name.slice(0, lastDot);
      const keep = maxLen - ext.length - 3;
      if (keep > 3) {
        return base.slice(0, keep) + "..." + ext;
      }
    }
    return name.slice(0, maxLen - 3) + "...";
  }

  function renderFileList() {
    if (!fileList) return;

    if (!files.length) {
      fileList.innerHTML = "";
      fileList.style.display = "none";
      if (dropzone) {
        dropzone.style.display = "";
      }
      return;
    }

    if (dropzone) {
      dropzone.style.display = "none";
    }

    fileList.style.display = "grid";
    let html = files.map((file, index) => {
      const ext = getFileExt(file).toUpperCase();
      const displayName = formatDisplayName(file.name, 20);
      return `
        <div class="file-item" data-index="${index}">
          <div class="file-item-left">
            <span class="file-type-badge">${escapeHtml(ext)}</span>
            <div class="file-meta-info">
              <strong title="${escapeHtml(file.name)}">${escapeHtml(displayName)}</strong>
              <small>${formatSize(file.size)}</small>
            </div>
          </div>
          <div class="file-item-actions">
            ${toolConfig.multiple && files.length > 1 ? `
              <button type="button" class="file-action-btn move-up-btn" data-action="up" data-index="${index}" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>
                <i class="bi bi-chevron-up"></i>
              </button>
              <button type="button" class="file-action-btn move-down-btn" data-action="down" data-index="${index}" title="Move Down" ${index === files.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
                <i class="bi bi-chevron-down"></i>
              </button>
            ` : ''}
            <button type="button" class="file-action-btn change-file-btn" data-action="change" data-index="${index}" title="Change file">
              <i class="bi bi-arrow-repeat"></i>
            </button>
            <button type="button" class="file-action-btn delete-btn" data-action="remove" data-index="${index}" title="Remove file">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    if (toolConfig.multiple && files.length < (toolConfig.maxFiles || 20)) {
      html += `
        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
          <button type="button" id="addMoreFilesBtn" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            <i class="bi bi-plus-lg"></i>
            <span>Add More Files</span>
          </button>
          <small style="color: var(--text-muted);">${files.length} of ${toolConfig.maxFiles || 20}</small>
        </div>
      `;
    }

    fileList.innerHTML = html;

    // Bind "Add More Files" button
    const addMoreBtn = fileList.querySelector("#addMoreFilesBtn");
    if (addMoreBtn && fileInput) {
      addMoreBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    // Bind action events
    fileList.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const idx = Number(btn.dataset.index);

        if (action === "change") {
          fileInput?.click();
        } else if (action === "remove") {
          files.splice(idx, 1);
          setFiles(files);
        } else if (action === "up" && idx > 0) {
          const temp = files[idx];
          files[idx] = files[idx - 1];
          files[idx - 1] = temp;
          setFiles(files);
        } else if (action === "down" && idx < files.length - 1) {
          const temp = files[idx];
          files[idx] = files[idx + 1];
          files[idx + 1] = temp;
          setFiles(files);
        }
      });
    });
  }

  function updateProcessButtonState() {
    if (!processBtn) return;
    if (isProcessing) {
      processBtn.disabled = true;
      return;
    }

    if (!files.length) {
      processBtn.disabled = true;
      processBtn.innerHTML = `<span>Select file to continue</span>`;
      return;
    }

    if (toolId === "merge-pdf" && files.length < 2) {
      processBtn.disabled = true;
      processBtn.innerHTML = `<span>Select at least 2 PDF files to merge</span>`;
      return;
    }

    if (toolId === "sign-pdf") {
      processBtn.disabled = false;
      if (signStudioState.workflowStep === 1) {
        processBtn.innerHTML = `<span>Place Signature on PDF</span> <i class="bi bi-arrow-down-right"></i>`;
      } else {
        processBtn.innerHTML = `<span><i class="bi bi-pen-fill"></i> Sign PDF Now (Page ${signStudioState.currentPage})</span> <i class="bi bi-arrow-right"></i>`;
      }
      return;
    }

    processBtn.disabled = false;
    processBtn.innerHTML = `<span>Process ${toolConfig.name}</span> <i class="bi bi-arrow-right"></i>`;
  }

  /* ==========================================================================
     3. Dynamic Tool Options Builder
     ========================================================================== */
  function renderToolOptions() {
    if (!toolOptions) return;

    if (toolId === "split-pdf") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Split Options</div>
          <label class="form-label" for="pagesInput">Page numbers or ranges to extract</label>
          <input id="pagesInput" class="form-control" placeholder="e.g. 1-3, 5, 8-10">
          <div class="form-hint">Leave blank to split every page into individual PDF files.</div>
        </div>
      `;
    } else if (toolId === "compress-pdf") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Compression Level</div>
          <div class="options-grid">
            <button type="button" class="option-chip-btn" data-quality="0.3">Extreme<br><small style="font-weight:normal;opacity:0.8;">Smallest size</small></button>
            <button type="button" class="option-chip-btn is-active" data-quality="0.5">Balanced<br><small style="font-weight:normal;opacity:0.8;">Recommended</small></button>
            <button type="button" class="option-chip-btn" data-quality="0.8">High Quality<br><small style="font-weight:normal;opacity:0.8;">Light compress</small></button>
          </div>
          <input type="hidden" id="qualityInput" value="0.5">
        </div>
      `;
      const chips = toolOptions.querySelectorAll("[data-quality]");
      const input = document.getElementById("qualityInput");
      chips.forEach(chip => {
        chip.addEventListener("click", () => {
          chips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (input) input.value = chip.dataset.quality;
        });
      });
    } else if (toolId === "image-to-webp") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">WebP Compression Quality</div>
          <div class="options-grid">
            <button type="button" class="option-chip-btn" data-quality="0.65">Compact<br><small style="font-weight:normal;opacity:0.8;">65% Quality</small></button>
            <button type="button" class="option-chip-btn is-active" data-quality="0.85">Balanced<br><small style="font-weight:normal;opacity:0.8;">85% (Recommended)</small></button>
            <button type="button" class="option-chip-btn" data-quality="0.95">Ultra Crisp<br><small style="font-weight:normal;opacity:0.8;">95% Quality</small></button>
          </div>
          <input type="hidden" id="qualityInput" value="0.85">
        </div>
      `;
      const chips = toolOptions.querySelectorAll("[data-quality]");
      const input = document.getElementById("qualityInput");
      chips.forEach(chip => {
        chip.addEventListener("click", () => {
          chips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (input) input.value = chip.dataset.quality;
        });
      });
    } else if (toolId === "rotate-pdf") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Rotation Angle</div>
          <div class="options-grid">
            <button type="button" class="option-chip-btn is-active" data-angle="90">90° Clockwise</button>
            <button type="button" class="option-chip-btn" data-angle="180">180° Flip</button>
            <button type="button" class="option-chip-btn" data-angle="270">270° Counter-CW</button>
          </div>
          <input type="hidden" id="angleInput" value="90">
        </div>
      `;
      const chips = toolOptions.querySelectorAll("[data-angle]");
      const input = document.getElementById("angleInput");
      chips.forEach(chip => {
        chip.addEventListener("click", () => {
          chips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (input) input.value = chip.dataset.angle;
        });
      });
    } else if (toolId === "add-page-numbers") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Page Number Placement</div>
          <div class="options-grid">
            <button type="button" class="option-chip-btn is-active" data-pos="bottom-center">Bottom Center</button>
            <button type="button" class="option-chip-btn" data-pos="bottom-left">Bottom Left</button>
            <button type="button" class="option-chip-btn" data-pos="bottom-right">Bottom Right</button>
            <button type="button" class="option-chip-btn" data-pos="top-center">Top Center</button>
          </div>
          <input type="hidden" id="positionInput" value="bottom-center">
        </div>
      `;
      const chips = toolOptions.querySelectorAll("[data-pos]");
      const input = document.getElementById("positionInput");
      chips.forEach(chip => {
        chip.addEventListener("click", () => {
          chips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (input) input.value = chip.dataset.pos;
        });
      });
    } else if (toolId === "protect-pdf" || toolId === "unlock-pdf") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">${toolId === "protect-pdf" ? "Set Password Security" : "Enter Document Password"}</div>
          <label class="form-label" for="passwordInput">${toolId === "protect-pdf" ? "Document Password" : "Password to Unlock"}</label>
          <div style="position:relative;">
            <input id="passwordInput" type="password" class="form-control" autocomplete="${toolId === 'protect-pdf' ? 'new-password' : 'current-password'}" placeholder="Enter password...">
            <button type="button" id="togglePasswordBtn" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem;" title="Show/Hide Password">
              <i class="bi bi-eye"></i>
            </button>
          </div>
          <div class="form-hint">${toolId === "protect-pdf" ? "Remember your password; passwords cannot be recovered." : "Enter the password authorized for this document."}</div>
        </div>
      `;
      const passInput = document.getElementById("passwordInput");
      const toggleBtn = document.getElementById("togglePasswordBtn");
      if (toggleBtn && passInput) {
        toggleBtn.addEventListener("click", () => {
          const isPass = passInput.type === "password";
          passInput.type = isPass ? "text" : "password";
          toggleBtn.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });
      }
    } else if (toolId === "pdf-to-jpg") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Output Image Resolution</div>
          <div class="options-grid">
            <button type="button" class="option-chip-btn" data-dpi="100">100 DPI<br><small style="font-weight:normal;opacity:0.8;">Web / Small</small></button>
            <button type="button" class="option-chip-btn is-active" data-dpi="150">150 DPI<br><small style="font-weight:normal;opacity:0.8;">Standard</small></button>
            <button type="button" class="option-chip-btn" data-dpi="200">200 DPI<br><small style="font-weight:normal;opacity:0.8;">High Res</small></button>
            <button type="button" class="option-chip-btn" data-dpi="300">300 DPI<br><small style="font-weight:normal;opacity:0.8;">Print Quality</small></button>
          </div>
          <input type="hidden" id="dpiInput" value="150">
        </div>
      `;
      const dpiChips = toolOptions.querySelectorAll("[data-dpi]");
      const dpiInput = document.getElementById("dpiInput");
      dpiChips.forEach(chip => {
        chip.addEventListener("click", () => {
          dpiChips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (dpiInput) dpiInput.value = chip.dataset.dpi;
        });
      });
    } else if (toolId === "remove-pages") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Pages to Remove</div>
          <label class="form-label" for="pagesInput">Page numbers or ranges to permanently delete</label>
          <input id="pagesInput" class="form-control" placeholder="e.g. 1, 3, 5-7" required>
          <div class="form-hint">Enter the page numbers you wish to remove from the document.</div>
        </div>
      `;
    } else if (toolId === "add-watermark") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Watermark Settings</div>
          <label class="form-label" for="watermarkTextInput">Watermark Text</label>
          <input id="watermarkTextInput" class="form-control" placeholder="e.g. CONFIDENTIAL, DRAFT, DO NOT COPY" value="CONFIDENTIAL">
          
          <label class="form-label" style="margin-top:14px;">Watermark Angle</label>
          <div class="options-grid">
            <button type="button" class="option-chip-btn is-active" data-rotation="45">45° Diagonal</button>
            <button type="button" class="option-chip-btn" data-rotation="0">0° Horizontal</button>
            <button type="button" class="option-chip-btn" data-rotation="90">90° Vertical</button>
          </div>
          <input type="hidden" id="rotationInput" value="45">

          <label class="form-label" style="margin-top:14px;">Color & Tone</label>
          <div class="options-grid">
            <button type="button" class="option-chip-btn is-active" data-color="gray">Subtle Gray</button>
            <button type="button" class="option-chip-btn" data-color="red">Urgent Red</button>
            <button type="button" class="option-chip-btn" data-color="blue">Corporate Blue</button>
            <button type="button" class="option-chip-btn" data-color="black">Solid Black</button>
          </div>
          <input type="hidden" id="colorInput" value="gray">
          <input type="hidden" id="opacityInput" value="0.3">
          <input type="hidden" id="fontSizeInput" value="40">
        </div>
      `;
      const rotChips = toolOptions.querySelectorAll("[data-rotation]");
      const rotInput = document.getElementById("rotationInput");
      rotChips.forEach(chip => {
        chip.addEventListener("click", () => {
          rotChips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (rotInput) rotInput.value = chip.dataset.rotation;
        });
      });

      const colChips = toolOptions.querySelectorAll("[data-color]");
      const colInput = document.getElementById("colorInput");
      colChips.forEach(chip => {
        chip.addEventListener("click", () => {
          colChips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (colInput) colInput.value = chip.dataset.color;
        });
      });
    } else if (toolId === "ocr-pdf") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">OCR Recognition Language</div>
          <div class="options-grid">
            <button type="button" class="option-chip-btn is-active" data-lang="eng">English (eng)</button>
            <button type="button" class="option-chip-btn" data-lang="spa">Spanish (spa)</button>
            <button type="button" class="option-chip-btn" data-lang="fra">French (fra)</button>
            <button type="button" class="option-chip-btn" data-lang="deu">German (deu)</button>
          </div>
          <input type="hidden" id="languageInput" value="eng">
          <div class="form-hint" style="margin-top:10px;">Select the primary language of the text within your scanned document.</div>
        </div>
      `;
      const langChips = toolOptions.querySelectorAll("[data-lang]");
      const langInput = document.getElementById("languageInput");
      langChips.forEach(chip => {
        chip.addEventListener("click", () => {
          langChips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (langInput) langInput.value = chip.dataset.lang;
        });
      });
    } else if (toolId === "sign-pdf") {
      toolOptions.innerHTML = `
        <div class="sign-studio-card">
          <div class="options-heading" style="display:flex; justify-content:space-between; align-items:center;">
            <span>Create Your Signature</span>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">100% Free & Private</span>
          </div>

          <div class="sign-tabs-nav">
            <button type="button" class="sign-tab-btn is-active" data-sign-tab="draw"><i class="bi bi-pen"></i> Draw</button>
            <button type="button" class="sign-tab-btn" data-sign-tab="type"><i class="bi bi-type"></i> Type</button>
            <button type="button" class="sign-tab-btn" data-sign-tab="upload"><i class="bi bi-upload"></i> Upload</button>
          </div>

          <!-- Draw Tab -->
          <div class="sign-tab-panel is-active" id="signTabDraw">
            <div class="signature-pad-container">
              <canvas id="signDrawCanvas" class="signature-canvas"></canvas>
            </div>
            <div class="sign-draw-toolbar">
              <div class="sign-colors-group">
                <span class="sign-color-dot is-active" data-color="#0f172a" style="background:#0f172a;" title="Black"></span>
                <span class="sign-color-dot" data-color="#1d4ed8" style="background:#1d4ed8;" title="Blue"></span>
                <span class="sign-color-dot" data-color="#047857" style="background:#047857;" title="Green"></span>
                <span class="sign-color-dot" data-color="#b91c1c" style="background:#b91c1c;" title="Red"></span>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" id="clearSignCanvasBtn"><i class="bi bi-eraser"></i> Clear</button>
            </div>
          </div>

          <!-- Type Tab -->
          <div class="sign-tab-panel" id="signTabType">
            <div class="sign-type-input-wrap">
              <input type="text" id="signNameInput" class="form-control" placeholder="Type your name here..." value="Your Signature">
              <div class="sign-cursive-preview" id="signCursivePreview" style="font-family:'Dancing Script', cursive;">Your Signature</div>
              <div class="sign-font-selector">
                <button type="button" class="sign-font-chip is-active" data-font="'Dancing Script', cursive">Dancing Script</button>
                <button type="button" class="sign-font-chip" data-font="'Caveat', cursive">Caveat</button>
                <button type="button" class="sign-font-chip" data-font="'Great Vibes', cursive">Great Vibes</button>
              </div>
            </div>
          </div>

          <!-- Upload Tab -->
          <div class="sign-tab-panel" id="signTabUpload">
            <div id="signUploadDropzone" class="dropzone" style="min-height: 200px; padding: 24px 16px; margin: 0; box-sizing: border-box; width: 100%;">
              <div class="drop-icon-box" style="width: 50px; height: 50px; font-size: 1.4rem; margin-bottom: 10px;">
                <i class="bi bi-cloud-arrow-up"></i>
              </div>
              <h2 style="font-size: 1.08rem; font-weight: 750; margin-bottom: 6px; color: var(--text-primary);">Drop your signature image here</h2>
              <p class="dropzone-hint" style="font-size: 0.82rem; margin-bottom: 14px; max-width: 300px;">
                PNG, JPG, or WebP. Transparent PNG signature works best.
              </p>
              <button type="button" class="btn btn-primary btn-md" id="signBrowseImageBtn" style="pointer-events: none;">
                <i class="bi bi-folder2-open"></i>
                <span>Choose signature image</span>
              </button>
              <input type="file" id="signImageFileInput" accept="image/png,image/jpeg,image/webp" style="display:none;">
              <div class="dropzone-specs" style="margin-top: 10px;">
                <span>Accepted: <strong>PNG, JPG, WebP</strong></span>
              </div>
            </div>

            <!-- Uploaded File Card -->
            <div id="signUploadedFileItem" class="file-item" style="display:none; width:100%; box-sizing:border-box;">
              <div class="file-item-left">
                <span class="file-type-badge" id="signUploadExtBadge">PNG</span>
                <div class="file-meta-info">
                  <strong id="signUploadName" title="signature.png">signature.png</strong>
                  <small id="signUploadSize">24.5 KB</small>
                </div>
              </div>
              <div class="file-item-actions">
                <button type="button" class="file-action-btn" id="signUploadChangeBtn" title="Change signature image">
                  <i class="bi bi-arrow-repeat"></i>
                </button>
                <button type="button" class="file-action-btn delete-btn" id="signUploadDeleteBtn" title="Remove signature image">
                  <i class="bi bi-trash3"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Dynamic Printed Name Addon -->
          <div class="sign-name-addon" style="margin-top: 4px; padding: 12px 14px; background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: var(--text-primary); cursor: pointer; margin: 0;">
              <input type="checkbox" id="includePrintedNameCheck" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--primary);">
              <span>Add printed name below signature</span>
            </label>
            <div id="signerNameInputWrapper" style="display: none; margin-top: 10px;">
              <input type="text" id="signerPrintedNameInput" class="form-control" placeholder="e.g. John Doe, Director" value="">
              <small style="color: var(--text-muted); font-size: 0.75rem; display: block; margin-top: 4px;">Dynamic scale: Automatically adjusts font size as you resize the signature.</small>
            </div>
          </div>
        </div>
      `;

      initSignStudioLogic();
    } else {
      toolOptions.innerHTML = "";
    }
  }

  /* --------------------------------------------------------------------------
     Sign Studio State & Logic
     -------------------------------------------------------------------------- */
  let signStudioState = {
    activeTab: 'draw',
    penColor: '#0f172a',
    activeFont: "'Dancing Script', cursive",
    rawSignatureDataUrl: null,
    includeName: false,
    printedName: "",
    pdfDoc: null,
    pdfBytes: null,
    currentPage: 1,
    totalPages: 1,
    sigX: 60,
    sigY: 60,
    sigWidth: 160,
    sigHeight: 65,
    isPlaced: false,
    scaleFactor: 1,
    hasInteracted: false,
    workflowStep: 1
  };

  function updateWorkflowProgress(stepNum) {
    if (toolId === "sign-pdf") {
      signStudioState.workflowStep = stepNum;
    }

    const ind1 = document.getElementById("stepIndicator1");
    const ind2 = document.getElementById("stepIndicator2");
    const ind3 = document.getElementById("stepIndicator3");

    if (stepNum === 1) {
      if (ind1) ind1.className = "workflow-step-indicator sign-step-indicator is-active";
      if (ind2) ind2.className = "workflow-step-indicator sign-step-indicator";
      if (ind3) ind3.className = "workflow-step-indicator sign-step-indicator";
    } else if (stepNum === 2) {
      if (ind1) ind1.className = "workflow-step-indicator sign-step-indicator is-complete";
      if (ind2) ind2.className = "workflow-step-indicator sign-step-indicator is-active";
      if (ind3) ind3.className = "workflow-step-indicator sign-step-indicator";
    } else if (stepNum === 3) {
      if (ind1) ind1.className = "workflow-step-indicator sign-step-indicator is-complete";
      if (ind2) ind2.className = "workflow-step-indicator sign-step-indicator is-complete";
      if (ind3) ind3.className = "workflow-step-indicator sign-step-indicator is-active";
    }

    updateProcessButtonState();
  }

  function updateSignWorkflowUI(stepNum) {
    updateWorkflowProgress(stepNum);
  }

  function renderWorkflowStepper() {
    let stepperDiv = document.getElementById("workflowStepper") || document.getElementById("signWorkflowStepper");
    if (stepperDiv) return;

    const toolGrid = document.querySelector(".tool-workspace-grid");
    if (!toolGrid) return;

    let step1Title = "1. Select File";
    let step1Desc = "Upload & verify";
    let step1Icon = "bi-file-earmark-arrow-up";

    let step2Title = `2. ${toolConfig.name || "Process Document"}`;
    let step2Desc = "Configure & convert";
    let step2Icon = "bi-gear-fill";

    let step3Title = "3. Download";
    let step3Desc = `${toolConfig.outputFormat || "Result"} document`;
    let step3Icon = "bi-check-circle-fill";

    if (toolId.startsWith("pdf-to-")) {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = `2. Convert to ${toolConfig.outputFormat || "Format"}`;
      step2Desc = "Extract & convert";
      step2Icon = "bi-arrow-repeat";
    } else if (toolId.endsWith("-to-pdf")) {
      const inFmt = (toolConfig.inputFormat || "File").split("/")[0].trim();
      step1Title = `1. Select ${inFmt}`;
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-arrow-up";
      step2Title = "2. Convert to PDF";
      step2Desc = "Format & convert";
      step2Icon = "bi-file-earmark-pdf";
    } else if (toolId === "merge-pdf") {
      step1Title = "1. Select PDFs";
      step1Desc = "Upload 2+ files";
      step1Icon = "bi-files";
      step2Title = "2. Merge Documents";
      step2Desc = "Order & combine";
      step2Icon = "bi-intersect";
    } else if (toolId === "split-pdf") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Split Pages";
      step2Desc = "Select ranges";
      step2Icon = "bi-scissors";
    } else if (toolId === "compress-pdf") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Compress PDF";
      step2Desc = "Optimize size";
      step2Icon = "bi-file-earmark-zip";
    } else if (toolId === "ocr-pdf") {
      step1Title = "1. Select Scanned PDF";
      step1Desc = "Upload scan";
      step1Icon = "bi-file-earmark-text";
      step2Title = "2. Recognize Text";
      step2Desc = "Build searchable layer";
      step2Icon = "bi-eye";
    } else if (toolId === "sign-pdf") {
      step1Title = "1. PDF & Signature";
      step1Desc = "Upload & create";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Place on PDF";
      step2Desc = "Position & resize";
      step2Icon = "bi-arrows-move";
    } else if (toolId === "protect-pdf") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Set Password";
      step2Desc = "AES-256 encrypt";
      step2Icon = "bi-shield-lock";
    } else if (toolId === "unlock-pdf") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Unlock Document";
      step2Desc = "Remove password";
      step2Icon = "bi-unlock";
    } else if (toolId === "add-watermark") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Add Watermark";
      step2Desc = "Text & angle";
      step2Icon = "bi-stamp";
    } else if (toolId === "add-page-numbers") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Number Pages";
      step2Desc = "Position & format";
      step2Icon = "bi-123";
    } else if (toolId === "rotate-pdf") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Rotate Pages";
      step2Desc = "Select orientation";
      step2Icon = "bi-arrow-clockwise";
    } else if (toolId === "remove-pages") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Remove Pages";
      step2Desc = "Choose page range";
      step2Icon = "bi-trash";
    } else if (toolId === "compare-pdf") {
      step1Title = "1. Select 2 PDFs";
      step1Desc = "Doc A & Doc B";
      step1Icon = "bi-files";
      step2Title = "2. Compare Content";
      step2Desc = "Detect differences";
      step2Icon = "bi-layout-split";
    } else if (toolId === "repair-pdf") {
      step1Title = "1. Select PDF";
      step1Desc = "Corrupted document";
      step1Icon = "bi-file-earmark-medical";
      step2Title = "2. Repair PDF";
      step2Desc = "Rebuild structure";
      step2Icon = "bi-tools";
    } else if (toolId === "sanitize-pdf") {
      step1Title = "1. Select PDF";
      step1Desc = "Upload document";
      step1Icon = "bi-file-earmark-pdf";
      step2Title = "2. Sanitize PDF";
      step2Desc = "Scrub metadata";
      step2Icon = "bi-shield-check";
    } else if (toolId === "image-to-webp") {
      step1Title = "1. Select Images";
      step1Desc = "JPG / PNG photos";
      step1Icon = "bi-file-earmark-image";
      step2Title = "2. Convert to WebP";
      step2Desc = "Next-gen compression";
      step2Icon = "bi-lightning-charge";
    } else if (toolId === "scan-to-pdf") {
      step1Title = "1. Scan or Add Pages";
      step1Desc = "Camera or photos";
      step1Icon = "bi-camera";
      step2Title = "2. Crop & Enhance";
      step2Desc = "Perspective & filters";
      step2Icon = "bi-crop";
      step3Title = "3. Download PDF";
      step3Desc = "Multi-page document";
      step3Icon = "bi-check-circle-fill";
    }

    stepperDiv = document.createElement("div");
    stepperDiv.className = "workflow-stepper sign-workflow-stepper";
    stepperDiv.id = "workflowStepper";
    stepperDiv.setAttribute("data-aos", "fade-up");
    stepperDiv.innerHTML = `
      <div class="workflow-step-indicator sign-step-indicator is-active" id="stepIndicator1">
        <span class="step-num"><i class="bi ${step1Icon}"></i></span>
        <div class="step-info">
          <strong>${escapeHtml(step1Title)}</strong>
          <small>${escapeHtml(step1Desc)}</small>
        </div>
      </div>
      <div class="workflow-step-arrow sign-step-arrow"><i class="bi bi-chevron-right"></i></div>
      <div class="workflow-step-indicator sign-step-indicator" id="stepIndicator2">
        <span class="step-num"><i class="bi ${step2Icon}"></i></span>
        <div class="step-info">
          <strong>${escapeHtml(step2Title)}</strong>
          <small>${escapeHtml(step2Desc)}</small>
        </div>
      </div>
      <div class="workflow-step-arrow sign-step-arrow"><i class="bi bi-chevron-right"></i></div>
      <div class="workflow-step-indicator sign-step-indicator" id="stepIndicator3">
        <span class="step-num"><i class="bi ${step3Icon}"></i></span>
        <div class="step-info">
          <strong>${escapeHtml(step3Title)}</strong>
          <small>${escapeHtml(step3Desc)}</small>
        </div>
      </div>
    `;

    toolGrid.parentNode.insertBefore(stepperDiv, toolGrid);
  }

  function scrollToPdfPlacementArea() {
    const previewEl = document.getElementById("previewPanel") || document.getElementById("pdfPageCanvasWrapper");
    if (previewEl) {
      previewEl.scrollIntoView({ behavior: "smooth", block: "start" });
      const canvasWrap = document.getElementById("pdfPageCanvasWrapper");
      if (canvasWrap) {
        canvasWrap.classList.add("pulse-highlight");
        setTimeout(() => canvasWrap.classList.remove("pulse-highlight"), 1400);
      }
    }
    updateSignWorkflowUI(2);
  }

  function initSignStudioLogic() {
    const tabBtns = toolOptions.querySelectorAll("[data-sign-tab]");
    const panels = {
      draw: document.getElementById("signTabDraw"),
      type: document.getElementById("signTabType"),
      upload: document.getElementById("signTabUpload")
    };

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        signStudioState.activeTab = btn.dataset.signTab;
        Object.keys(panels).forEach(k => {
          if (panels[k]) panels[k].classList.toggle("is-active", k === signStudioState.activeTab);
        });
        updateActiveSignature();
      });
    });

    // Drawing Canvas
    const canvas = document.getElementById("signDrawCanvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = (rect.width || 400) * dpr;
      canvas.height = (rect.height || 140) * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = signStudioState.penColor;
      ctx.lineWidth = 2.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      let drawing = false;

      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
      };

      const startDraw = (e) => {
        drawing = true;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      };

      const drawMove = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      };

      const stopDraw = () => {
        if (!drawing) return;
        drawing = false;
        ctx.closePath();
        signStudioState.rawSignatureDataUrl = canvas.toDataURL("image/png");
        updateDraggableSignatureOverlay();
      };

      canvas.addEventListener("mousedown", startDraw);
      canvas.addEventListener("mousemove", drawMove);
      window.addEventListener("mouseup", stopDraw);

      canvas.addEventListener("touchstart", startDraw, { passive: false });
      canvas.addEventListener("touchmove", drawMove, { passive: false });
      canvas.addEventListener("touchend", stopDraw);

      const clearBtn = document.getElementById("clearSignCanvasBtn");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          signStudioState.rawSignatureDataUrl = null;
          updateDraggableSignatureOverlay();
        });
      }

      const colorDots = toolOptions.querySelectorAll(".sign-color-dot");
      colorDots.forEach(dot => {
        dot.addEventListener("click", () => {
          colorDots.forEach(d => d.classList.remove("is-active"));
          dot.classList.add("is-active");
          signStudioState.penColor = dot.dataset.color;
          ctx.strokeStyle = signStudioState.penColor;
          updateActiveSignature();
        });
      });
    }

    // Type Tab
    const nameInput = document.getElementById("signNameInput");
    const cursivePreview = document.getElementById("signCursivePreview");
    const fontChips = toolOptions.querySelectorAll(".sign-font-chip");

    const updateTypeSignature = () => {
      const text = (nameInput?.value || "").trim() || "Your Signature";
      if (cursivePreview) {
        cursivePreview.textContent = text;
        cursivePreview.style.fontFamily = signStudioState.activeFont;
        cursivePreview.style.color = signStudioState.penColor;
      }
      // Render text to offscreen canvas
      const offCanvas = document.createElement("canvas");
      offCanvas.width = 440;
      offCanvas.height = 130;
      const offCtx = offCanvas.getContext("2d");
      offCtx.font = `48px ${signStudioState.activeFont}`;
      offCtx.fillStyle = signStudioState.penColor;
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.fillText(text, 220, 65);
      signStudioState.rawSignatureDataUrl = offCanvas.toDataURL("image/png");
      updateDraggableSignatureOverlay();
    };

    if (nameInput) nameInput.addEventListener("input", updateTypeSignature);
    fontChips.forEach(chip => {
      chip.addEventListener("click", () => {
        fontChips.forEach(c => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        signStudioState.activeFont = chip.dataset.font;
        updateTypeSignature();
      });
    });

    // Upload Tab Handlers
    const imgInput = document.getElementById("signImageFileInput");
    const dropzone = document.getElementById("signUploadDropzone");
    const uploadedCard = document.getElementById("signUploadedFileItem");
    const extBadge = document.getElementById("signUploadExtBadge");
    const fileNameEl = document.getElementById("signUploadName");
    const fileSizeEl = document.getElementById("signUploadSize");
    const changeBtn = document.getElementById("signUploadChangeBtn");
    const deleteBtn = document.getElementById("signUploadDeleteBtn");

    const processSignatureImageFile = (file) => {
      if (!file || !file.type.startsWith("image/")) {
        if (window.SmartAssToast) window.SmartAssToast.show("Please select a valid PNG or JPG image.", "error");
        return;
      }
      if (extBadge) extBadge.textContent = getFileExt(file).toUpperCase();
      if (fileNameEl) {
        fileNameEl.textContent = formatDisplayName(file.name, 22);
        fileNameEl.title = file.name;
      }
      if (fileSizeEl) fileSizeEl.textContent = formatSize(file.size);

      if (dropzone) dropzone.style.display = "none";
      if (uploadedCard) uploadedCard.style.display = "flex";

      const reader = new FileReader();
      reader.onload = (evt) => {
        signStudioState.rawSignatureDataUrl = evt.target.result;
        updateDraggableSignatureOverlay();
      };
      reader.readAsDataURL(file);
    };

    if (dropzone) {
      dropzone.addEventListener("click", () => imgInput?.click());

      ["dragenter", "dragover"].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add("is-dragover");
        });
      });

      ["dragleave", "dragend"].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove("is-dragover");
        });
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("is-dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          processSignatureImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (imgInput) {
      imgInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          processSignatureImageFile(e.target.files[0]);
        }
      });
    }

    if (changeBtn && imgInput) {
      changeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        imgInput.click();
      });
    }

    if (deleteBtn && imgInput) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        imgInput.value = "";
        if (uploadedCard) uploadedCard.style.display = "none";
        if (dropzone) dropzone.style.display = "flex";
        signStudioState.rawSignatureDataUrl = null;
        updateDraggableSignatureOverlay();
      });
    }

    // Dynamic Printed Name Handlers
    const nameCheck = document.getElementById("includePrintedNameCheck");
    const nameInputWrapper = document.getElementById("signerNameInputWrapper");
    const printedNameInput = document.getElementById("signerPrintedNameInput");

    if (nameCheck) {
      nameCheck.addEventListener("change", () => {
        signStudioState.includeName = nameCheck.checked;
        if (nameInputWrapper) {
          nameInputWrapper.style.display = nameCheck.checked ? "block" : "none";
        }
        if (nameCheck.checked && printedNameInput && !printedNameInput.value.trim()) {
          printedNameInput.focus();
        }
        updateDraggableSignatureOverlay();
      });
    }

    if (printedNameInput) {
      printedNameInput.addEventListener("input", () => {
        signStudioState.printedName = printedNameInput.value;
        updateDraggableSignatureOverlay();
      });
    }

    function updateActiveSignature() {
      if (signStudioState.activeTab === "type") {
        updateTypeSignature();
      } else if (signStudioState.activeTab === "draw") {
        const c = document.getElementById("signDrawCanvas");
        if (c) {
          signStudioState.rawSignatureDataUrl = c.toDataURL("image/png");
        }
        updateDraggableSignatureOverlay();
      } else if (signStudioState.activeTab === "upload") {
        updateDraggableSignatureOverlay();
      }
    }

    // Default initial signature
    setTimeout(updateActiveSignature, 100);
  }

  function updateDraggableSignatureOverlay() {
    const overlay = document.getElementById("draggableSigOverlay");
    const overlayImg = document.getElementById("sigOverlayImg");
    const nameEl = document.getElementById("sigPrintedNameText");
    if (!overlay || !overlayImg) return;

    if (!signStudioState.rawSignatureDataUrl) {
      overlay.style.display = "none";
      return;
    }

    overlay.style.display = "flex";
    overlayImg.src = signStudioState.rawSignatureDataUrl;
    overlay.style.left = `${signStudioState.sigX}px`;
    overlay.style.top = `${signStudioState.sigY}px`;
    overlay.style.width = `${signStudioState.sigWidth}px`;
    overlay.style.height = `${signStudioState.sigHeight}px`;

    // Dynamic Printed Name calculation
    if (nameEl) {
      if (signStudioState.includeName && signStudioState.printedName && signStudioState.printedName.trim()) {
        nameEl.style.display = "block";
        nameEl.textContent = signStudioState.printedName.trim();
        nameEl.style.color = signStudioState.penColor || "#0f172a";

        // Proportional dynamic font size: clamp based on signature width and height
        let fontSize = Math.round(Math.min(signStudioState.sigWidth * 0.08, signStudioState.sigHeight * 0.28));
        fontSize = Math.max(9, Math.min(36, fontSize));

        // Overflow protection for long names
        const textLen = signStudioState.printedName.trim().length;
        const approxWidth = textLen * (fontSize * 0.58);
        if (approxWidth > (signStudioState.sigWidth * 0.95)) {
          fontSize = Math.max(8, Math.floor((signStudioState.sigWidth * 0.95) / (textLen * 0.58)));
        }

        nameEl.style.fontSize = `${fontSize}px`;
        nameEl.style.marginTop = `${Math.max(2, Math.round(fontSize * 0.2))}px`;
      } else {
        nameEl.style.display = "none";
      }
    }

    signStudioState.isPlaced = true;
  }

  /* ==========================================================================
     4. Live Interactive Preview Panel
     ========================================================================== */
  async function renderLivePreview(resultUrl = null, resultFilename = null) {
    if (!previewViewport) return;

    if (resultUrl && resultFilename) {
      if (previewFilename) previewFilename.textContent = resultFilename;
      if (previewStatus) {
        previewStatus.innerHTML = `<span class="preview-status-dot" style="background:var(--success); box-shadow:0 0 8px var(--success);"></span> Ready`;
      }

      if (/\.pdf$/i.test(resultFilename)) {
        previewViewport.innerHTML = `<iframe class="preview-frame" title="PDF Result Preview" src="${resultUrl}#page=1&view=FitH"></iframe>`;
      } else if (/\.(jpe?g|png|webp)$/i.test(resultFilename)) {
        previewViewport.innerHTML = `<img class="preview-img" alt="Converted result" src="${resultUrl}">`;
      } else {
        previewViewport.innerHTML = `
          <div class="preview-format-card animate-fade-in">
            <div class="preview-format-icon" style="background:var(--success-subtle); color:var(--success);"><i class="bi bi-file-earmark-check"></i></div>
            <strong style="display:block; font-size:1.1rem; margin-bottom:6px;">Result Ready</strong>
            <p style="font-size:0.85rem; color:var(--text-secondary);">Your ${escapeHtml(toolConfig.outputFormat)} document has been generated and is ready to download.</p>
          </div>
        `;
      }
      return;
    }

    if (!files.length) {
      if (previewFilename) previewFilename.textContent = "No document selected";
      if (previewStatus) {
        previewStatus.innerHTML = `<span class="preview-status-dot" style="background:var(--text-muted); box-shadow:none;"></span> Waiting for input`;
      }
      previewViewport.innerHTML = `
        <div class="preview-empty-state">
          <i class="bi bi-file-earmark-arrow-up"></i>
          <strong>No preview available</strong>
          <p>Drop a file or browse from your device to see the interactive preview.</p>
        </div>
      `;
      return;
    }

    const firstFile = files[0];
    const objectUrl = URL.createObjectURL(firstFile);

    if (previewFilename) previewFilename.textContent = firstFile.name;
    if (previewStatus) {
      previewStatus.innerHTML = `<span class="preview-status-dot"></span> Validated (${formatSize(firstFile.size)})`;
    }

    // Special Visual Signing Canvas for sign-pdf
    if (toolId === "sign-pdf" && isPdf(firstFile) && typeof pdfjsLib !== "undefined") {
      previewViewport.innerHTML = `
        <div class="pdf-sign-stage">
          <div class="pdf-sign-controls-bar">
            <button type="button" class="btn btn-secondary btn-sm" id="prevPdfPageBtn"><i class="bi bi-chevron-left"></i> Prev</button>
            <span class="pdf-page-counter" id="pdfPageCounter">Page 1 of 1</span>
            <button type="button" class="btn btn-secondary btn-sm" id="nextPdfPageBtn">Next <i class="bi bi-chevron-right"></i></button>
          </div>
          <div class="pdf-page-canvas-wrapper" id="pdfPageCanvasWrapper">
            <canvas id="pdfSignCanvas" class="pdf-page-canvas"></canvas>
            <div class="draggable-signature-overlay" id="draggableSigOverlay" style="display:none;">
              <div class="placement-guide-banner" id="placementGuideBanner">
                <i class="bi bi-arrows-move"></i>
                <span>Drag to place signature</span>
              </div>
              <div class="sig-group-container" id="sigGroupContainer">
                <img id="sigOverlayImg" class="sig-overlay-img" alt="Signature">
                <div id="sigPrintedNameText" class="sig-printed-name-text" style="display:none;"></div>
              </div>
              <div class="sig-handle-delete" id="sigDeleteBtn" title="Remove signature">✕</div>
              <div class="sig-handle-resize" id="sigResizeBtn" title="Drag to resize"></div>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-lg btn-block" id="pdfStageSignBtn" style="max-width:680px; font-weight:700;">
            <i class="bi bi-pen-fill"></i>
            <span>Sign PDF Now</span>
            <i class="bi bi-arrow-right"></i>
          </button>
        </div>
      `;

      loadAndRenderPdfSignPage(firstFile);
      updateSignWorkflowUI(1);
      return;
    }

    if (isPdf(firstFile)) {
      previewViewport.innerHTML = `<iframe class="preview-frame" title="PDF Document Preview" src="${objectUrl}#page=1&view=FitH"></iframe>`;
    } else if (isImage(firstFile)) {
      previewViewport.innerHTML = `<img class="preview-img" alt="Image Preview" src="${objectUrl}">`;
    } else if (isHtml(firstFile)) {
      previewViewport.innerHTML = `<iframe class="preview-frame" sandbox title="HTML Preview" src="${objectUrl}"></iframe>`;
    } else {
      const ext = getFileExt(firstFile).toUpperCase();
      previewViewport.innerHTML = `
        <div class="preview-format-card animate-fade-in">
          <div class="preview-format-icon">${escapeHtml(ext)}</div>
          <strong style="display:block; font-size:1.05rem; margin-bottom:6px;">${escapeHtml(toolConfig.outputFormat)} Workflow</strong>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">File verified successfully. Ready for secure server-side conversion.</p>
          <div style="font-size:0.78rem; color:var(--text-muted); padding:8px; background:var(--bg-subtle); border-radius:var(--radius-sm);">
            ${escapeHtml(firstFile.name)} (${formatSize(firstFile.size)})
          </div>
        </div>
      `;
    }
  }

  async function loadAndRenderPdfSignPage(file) {
    try {
      if (typeof pdfjsLib === "undefined") return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      
      signStudioState.pdfBytes = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: signStudioState.pdfBytes.slice(0) });
      signStudioState.pdfDoc = await loadingTask.promise;
      signStudioState.totalPages = signStudioState.pdfDoc.numPages;
      signStudioState.currentPage = 1;

      renderCurrentPdfSignPage();
      bindDragAndDropEvents();
    } catch (err) {
      console.error("PDF preview error:", err);
    }
  }

  async function renderCurrentPdfSignPage() {
    if (!signStudioState.pdfDoc) return;
    const pageCounter = document.getElementById("pdfPageCounter");
    const prevBtn = document.getElementById("prevPdfPageBtn");
    const nextBtn = document.getElementById("nextPdfPageBtn");
    const canvas = document.getElementById("pdfSignCanvas");
    if (!canvas) return;

    if (pageCounter) pageCounter.textContent = `Page ${signStudioState.currentPage} of ${signStudioState.totalPages}`;
    if (prevBtn) prevBtn.disabled = signStudioState.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = signStudioState.currentPage >= signStudioState.totalPages;

    const page = await signStudioState.pdfDoc.getPage(signStudioState.currentPage);
    const viewport = page.getViewport({ scale: 1 });
    
    // Fit canvas width to container (max ~640px)
    const containerWidth = Math.min(640, window.innerWidth - 48);
    const scale = containerWidth / viewport.width;
    signStudioState.scaleFactor = scale;
    const scaledViewport = page.getViewport({ scale: scale });

    const ctx = canvas.getContext("2d");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    updateDraggableSignatureOverlay();

    if (prevBtn) {
      prevBtn.onclick = () => {
        if (signStudioState.currentPage > 1) {
          signStudioState.currentPage--;
          renderCurrentPdfSignPage();
          updateSignWorkflowUI(2);
        }
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (signStudioState.currentPage < signStudioState.totalPages) {
          signStudioState.currentPage++;
          renderCurrentPdfSignPage();
          updateSignWorkflowUI(2);
        }
      };
    }
  }

  function bindDragAndDropEvents() {
    const overlay = document.getElementById("draggableSigOverlay");
    const wrapper = document.getElementById("pdfPageCanvasWrapper");
    const deleteBtn = document.getElementById("sigDeleteBtn");
    const resizeBtn = document.getElementById("sigResizeBtn");
    const stageSignBtn = document.getElementById("pdfStageSignBtn");
    if (!overlay || !wrapper) return;

    if (stageSignBtn) {
      stageSignBtn.onclick = handleProcess;
    }

    let isDragging = false;
    let isResizing = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let startW = 0, startH = 0;

    const getEventPos = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX, y: clientY };
    };

    const notifyUserInteraction = () => {
      if (!signStudioState.hasInteracted) {
        signStudioState.hasInteracted = true;
        const banner = document.getElementById("placementGuideBanner");
        if (banner) banner.style.opacity = "0";
      }
      updateSignWorkflowUI(2);
    };

    // Drag start
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === deleteBtn || e.target === resizeBtn) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = overlay.offsetLeft;
      startTop = overlay.offsetTop;
      notifyUserInteraction();
      e.preventDefault();
    });

    overlay.addEventListener("touchstart", (e) => {
      if (e.target === deleteBtn || e.target === resizeBtn) return;
      isDragging = true;
      const p = getEventPos(e);
      startX = p.x;
      startY = p.y;
      startLeft = overlay.offsetLeft;
      startTop = overlay.offsetTop;
      notifyUserInteraction();
    }, { passive: true });

    // Resize start
    if (resizeBtn) {
      resizeBtn.addEventListener("mousedown", (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = overlay.offsetWidth;
        startH = overlay.offsetHeight;
        notifyUserInteraction();
        e.stopPropagation();
        e.preventDefault();
      });

      resizeBtn.addEventListener("touchstart", (e) => {
        isResizing = true;
        const p = getEventPos(e);
        startX = p.x;
        startY = p.y;
        startW = overlay.offsetWidth;
        startH = overlay.offsetHeight;
        notifyUserInteraction();
        e.stopPropagation();
      }, { passive: true });
    }

    // Delete
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        overlay.style.display = "none";
        signStudioState.isPlaced = false;
        signStudioState.rawSignatureDataUrl = null;
      });
    }

    // Move & Resize Handlers
    const onMove = (e) => {
      if (!isDragging && !isResizing) return;
      const p = getEventPos(e);
      const wrapperRect = wrapper.getBoundingClientRect();

      if (isDragging) {
        const dx = p.x - startX;
        const dy = p.y - startY;
        let newX = Math.max(0, Math.min(wrapperRect.width - overlay.offsetWidth, startLeft + dx));
        let newY = Math.max(0, Math.min(wrapperRect.height - overlay.offsetHeight, startTop + dy));
        overlay.style.left = `${newX}px`;
        overlay.style.top = `${newY}px`;
        signStudioState.sigX = newX;
        signStudioState.sigY = newY;
      } else if (isResizing) {
        const dx = p.x - startX;
        const dy = p.y - startY;
        let newW = Math.max(60, Math.min(wrapperRect.width - overlay.offsetLeft, startW + dx));
        let newH = Math.max(30, Math.min(wrapperRect.height - overlay.offsetTop, startH + dy));
        overlay.style.width = `${newW}px`;
        overlay.style.height = `${newH}px`;
        signStudioState.sigWidth = newW;
        signStudioState.sigHeight = newH;

        // Dynamic printed name live resize
        const nameEl = document.getElementById("sigPrintedNameText");
        if (nameEl && signStudioState.includeName && signStudioState.printedName && signStudioState.printedName.trim()) {
          let fontSize = Math.round(Math.min(newW * 0.08, newH * 0.28));
          fontSize = Math.max(9, Math.min(36, fontSize));
          const textLen = signStudioState.printedName.trim().length;
          const approxWidth = textLen * (fontSize * 0.58);
          if (approxWidth > (newW * 0.95)) {
            fontSize = Math.max(8, Math.floor((newW * 0.95) / (textLen * 0.58)));
          }
          nameEl.style.fontSize = `${fontSize}px`;
          nameEl.style.marginTop = `${Math.max(2, Math.round(fontSize * 0.2))}px`;
        }
      }
    };

    const onEnd = () => {
      isDragging = false;
      isResizing = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  /* ==========================================================================
     5. Staged Progress & Processing
     ========================================================================== */
  function showStatusProcessing() {
    if (!statusContainer) return;
    if (toolOptions) toolOptions.style.display = "none";
    if (processBtn) processBtn.style.display = "none";
    if (fileList) fileList.style.display = "none";
    if (dropzone) dropzone.style.display = "none";

    statusContainer.innerHTML = `
      <div class="processing-card animate-fade-in">
        <div class="processing-spinner"></div>
        <h3 id="processingStepText">Processing your document...</h3>
        <p id="processingDetailText">Applying ${escapeHtml(toolConfig.name)} transformations securely.</p>
        <div class="staged-progress-bar">
          <div class="staged-progress-fill" id="progressFill" style="width: 30%;"></div>
        </div>
      </div>
    `;
    statusContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateProcessingStep(percent, stepText, detailText) {
    const fill = document.getElementById("progressFill");
    const step = document.getElementById("processingStepText");
    const detail = document.getElementById("processingDetailText");
    if (fill) fill.style.width = `${percent}%`;
    if (step && stepText) step.textContent = stepText;
    if (detail && detailText) detail.textContent = detailText;
  }

  function showStatusError(message) {
    if (!statusContainer) return;
    if (files.length > 0) {
      if (fileList) fileList.style.display = "grid";
      if (dropzone) dropzone.style.display = "none";
    } else {
      if (fileList) fileList.style.display = "none";
      if (dropzone) dropzone.style.display = "";
    }
    if (toolOptions) toolOptions.style.display = "";
    if (processBtn) processBtn.style.display = "";

    statusContainer.innerHTML = `
      <div class="error-card animate-fade-in">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <div>
          <h4>Unable to process document</h4>
          <p>${escapeHtml(message)}</p>
          <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px;" id="retryActionBtn">Try Again</button>
        </div>
      </div>
    `;
    const retryBtn = document.getElementById("retryActionBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        clearStatus();
      });
    }
    statusContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showStatusSuccess(data) {
    if (!statusContainer) return;
    const isBlobOrHttp = data.downloadUrl && (data.downloadUrl.startsWith("http") || data.downloadUrl.startsWith("blob:"));
    const downloadUrl = isBlobOrHttp ? data.downloadUrl : `${API_ORIGIN}${data.downloadUrl}`;
    const filename = data.filename || "converted_document";
    const fullUrl = downloadUrl;

    // Hide options and processing button so only the Success Result card is shown
    if (toolOptions) toolOptions.style.display = "none";
    if (processBtn) processBtn.style.display = "none";
    if (fileList) fileList.style.display = "none";
    if (dropzone) dropzone.style.display = "none";

    statusContainer.innerHTML = `
      <div class="success-card animate-fade-in">
        <div class="success-header">
          <div class="success-icon"><i class="bi bi-check-lg"></i></div>
          <div>
            <h3>Processing Complete!</h3>
            <p>Your document has been processed with 100% data integrity.</p>
          </div>
        </div>
        <div class="result-file-badge">
          <i class="bi bi-file-earmark-check"></i>
          <span>${escapeHtml(filename)}</span>
        </div>
        <div class="result-actions-group">
          <button type="button" class="btn btn-primary btn-lg" id="downloadResultBtn">
            <i class="bi bi-download"></i>
            <span>Download ${escapeHtml(toolConfig.outputFormat || "PDF")}</span>
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="resetToolBtn">
            <i class="bi bi-arrow-counterclockwise"></i>
            <span>Process another document</span>
          </button>
        </div>
      </div>
    `;

    updateWorkflowProgress(3);

    const downloadBtn = document.getElementById("downloadResultBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => downloadResult(fullUrl, filename, downloadBtn));
    }

    const resetBtn = document.getElementById("resetToolBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        files = [];
        clearStatus();
        updateWorkflowProgress(1);
        if (toolOptions) toolOptions.style.display = "";
        if (processBtn) processBtn.style.display = "";
        if (dropzone) dropzone.style.display = "";
        renderFileList();
        updateProcessButtonState();
        renderLivePreview();
        renderToolOptions();
      });
    }

    renderLivePreview(fullUrl, filename);
    injectNextToolSuggestion();
    statusContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearStatus() {
    if (statusContainer) statusContainer.innerHTML = "";
    if (files.length > 0) {
      if (fileList) fileList.style.display = "grid";
      if (dropzone) dropzone.style.display = "none";
    } else {
      if (fileList) fileList.style.display = "none";
      if (dropzone) dropzone.style.display = "";
    }
    if (toolOptions) toolOptions.style.display = "";
    if (processBtn) processBtn.style.display = "";
  }

  /* ==========================================================================
     6. Direct Download Stream Handler
     ========================================================================== */
  // Next-tool suggestion map (2-3 related tools per workflow)
  const NEXT_TOOL_MAP = {
    'scan-to-pdf': [
      { name: 'OCR PDF', desc: 'Make scanned PDF searchable', icon: 'bi-search', path: 'ocr-pdf.html' },
      { name: 'Compress PDF', desc: 'Reduce file size for sharing', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Sign PDF', desc: 'Add visual or digital signature', icon: 'bi-pen', path: 'sign-pdf.html' }
    ],
    'pdf-to-word': [
      { name: 'Protect PDF', desc: 'Password-encrypt document', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'PDF to Excel', desc: 'Extract tables into XLSX', icon: 'bi-file-earmark-spreadsheet', path: 'pdf-to-excel.html' },
      { name: 'Compress PDF', desc: 'Reduce file size for email', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'compress-pdf': [
      { name: 'Sign PDF', desc: 'Add signature to PDF', icon: 'bi-pen', path: 'sign-pdf.html' },
      { name: 'Protect PDF', desc: 'Password-protect document', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Sanitize PDF', desc: 'Strip hidden metadata', icon: 'bi-shield-check', path: 'sanitize-pdf.html' }
    ],
    'ocr-pdf': [
      { name: 'PDF to Word', desc: 'Export text to editable DOCX', icon: 'bi-file-earmark-word', path: 'pdf-to-word.html' },
      { name: 'Compress PDF', desc: 'Reduce searchable PDF size', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Sanitize PDF', desc: 'Strip hidden metadata', icon: 'bi-shield-check', path: 'sanitize-pdf.html' }
    ],
    'merge-pdf': [
      { name: 'Compress PDF', desc: 'Reduce merged file size', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Add Page Numbers', desc: 'Insert formatted page numbers', icon: 'bi-123', path: 'add-page-numbers.html' },
      { name: 'Protect PDF', desc: 'Password-encrypt merged file', icon: 'bi-shield-lock', path: 'protect-pdf.html' }
    ],
    'protect-pdf': [
      { name: 'Sign PDF', desc: 'Sign document before sharing', icon: 'bi-pen', path: 'sign-pdf.html' },
      { name: 'Unlock PDF', desc: 'Verify decryption & remove locks', icon: 'bi-unlock', path: 'unlock-pdf.html' },
      { name: 'Sanitize PDF', desc: 'Strip metadata before publishing', icon: 'bi-shield-check', path: 'sanitize-pdf.html' }
    ],
    'sign-pdf': [
      { name: 'Protect PDF', desc: 'Encrypt your signed document', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Sanitize PDF', desc: 'Wipe author and revision tags', icon: 'bi-shield-check', path: 'sanitize-pdf.html' },
      { name: 'Compress PDF', desc: 'Reduce file size for email', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'split-pdf': [
      { name: 'Compress PDF', desc: 'Reduce size of split pages', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Merge PDF', desc: 'Recombine select pages', icon: 'bi-files', path: 'merge-pdf.html' },
      { name: 'Protect PDF', desc: 'Password-encrypt split files', icon: 'bi-shield-lock', path: 'protect-pdf.html' }
    ],
    'pdf-to-jpg': [
      { name: 'Image to WebP', desc: 'Convert JPG to smaller WebP', icon: 'bi-file-earmark-image', path: 'image-to-webp.html' },
      { name: 'Image to PDF', desc: 'Bundle images into a new PDF', icon: 'bi-images', path: 'image-to-pdf.html' },
      { name: 'Compress PDF', desc: 'Compress original PDF', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'word-to-pdf': [
      { name: 'Protect PDF', desc: 'Add password encryption', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Sign PDF', desc: 'Sign your new PDF document', icon: 'bi-pen', path: 'sign-pdf.html' },
      { name: 'Compress PDF', desc: 'Optimize PDF file size', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'excel-to-pdf': [
      { name: 'Protect PDF', desc: 'Password-protect spreadsheet PDF', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Merge PDF', desc: 'Combine with other reports', icon: 'bi-files', path: 'merge-pdf.html' },
      { name: 'Compress PDF', desc: 'Reduce file size for email', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'image-to-pdf': [
      { name: 'OCR PDF', desc: 'Make image PDF searchable', icon: 'bi-search', path: 'ocr-pdf.html' },
      { name: 'Compress PDF', desc: 'Reduce compiled PDF size', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Protect PDF', desc: 'Password-encrypt document', icon: 'bi-shield-lock', path: 'protect-pdf.html' }
    ],
    'image-to-webp': [
      { name: 'Image to PDF', desc: 'Bundle WebP images into a PDF', icon: 'bi-images', path: 'image-to-pdf.html' },
      { name: 'PDF to JPG', desc: 'Render PDF pages to images', icon: 'bi-file-earmark-image', path: 'pdf-to-jpg.html' },
      { name: 'Compress PDF', desc: 'Reduce document size', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'html-to-pdf': [
      { name: 'Compress PDF', desc: 'Optimize HTML-rendered PDF', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Protect PDF', desc: 'Password-encrypt document', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Add Page Numbers', desc: 'Insert formatted page numbers', icon: 'bi-123', path: 'add-page-numbers.html' }
    ],
    'rotate-pdf': [
      { name: 'Compress PDF', desc: 'Reduce size after rotating', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Merge PDF', desc: 'Combine with other documents', icon: 'bi-files', path: 'merge-pdf.html' },
      { name: 'Protect PDF', desc: 'Password-protect rotated PDF', icon: 'bi-shield-lock', path: 'protect-pdf.html' }
    ],
    'add-page-numbers': [
      { name: 'Protect PDF', desc: 'Password-protect numbered PDF', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Compress PDF', desc: 'Reduce file size for sharing', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Sign PDF', desc: 'Sign your numbered document', icon: 'bi-pen', path: 'sign-pdf.html' }
    ],
    'remove-pages': [
      { name: 'Compress PDF', desc: 'Compress clean document', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Merge PDF', desc: 'Combine with other files', icon: 'bi-files', path: 'merge-pdf.html' },
      { name: 'Add Page Numbers', desc: 'Renumber remaining pages', icon: 'bi-123', path: 'add-page-numbers.html' }
    ],
    'unlock-pdf': [
      { name: 'Compress PDF', desc: 'Optimize unlocked PDF size', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'PDF to Word', desc: 'Convert to editable Word', icon: 'bi-file-earmark-word', path: 'pdf-to-word.html' },
      { name: 'Sanitize PDF', desc: 'Strip metadata before sharing', icon: 'bi-shield-check', path: 'sanitize-pdf.html' }
    ],
    'add-watermark': [
      { name: 'Protect PDF', desc: 'Encrypt watermarked PDF', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Compress PDF', desc: 'Optimize document size', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Sign PDF', desc: 'Sign watermarked document', icon: 'bi-pen', path: 'sign-pdf.html' }
    ],
    'compare-pdf': [
      { name: 'Merge PDF', desc: 'Combine compared versions', icon: 'bi-files', path: 'merge-pdf.html' },
      { name: 'OCR PDF', desc: 'Run OCR on diff report', icon: 'bi-search', path: 'ocr-pdf.html' },
      { name: 'Sanitize PDF', desc: 'Strip metadata before sharing', icon: 'bi-shield-check', path: 'sanitize-pdf.html' }
    ],
    'repair-pdf': [
      { name: 'Compress PDF', desc: 'Optimize repaired document', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Sanitize PDF', desc: 'Clean corrupted metadata', icon: 'bi-shield-check', path: 'sanitize-pdf.html' },
      { name: 'Protect PDF', desc: 'Password-encrypt repaired PDF', icon: 'bi-shield-lock', path: 'protect-pdf.html' }
    ],
    'sanitize-pdf': [
      { name: 'Protect PDF', desc: 'Encrypt sanitized document', icon: 'bi-shield-lock', path: 'protect-pdf.html' },
      { name: 'Sign PDF', desc: 'Sign document before sharing', icon: 'bi-pen', path: 'sign-pdf.html' },
      { name: 'Compress PDF', desc: 'Reduce file size for email', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'pdf-to-excel': [
      { name: 'PDF to Word', desc: 'Also extract text to Word', icon: 'bi-file-earmark-word', path: 'pdf-to-word.html' },
      { name: 'Excel to PDF', desc: 'Convert modified sheets to PDF', icon: 'bi-file-earmark-pdf', path: 'excel-to-pdf.html' },
      { name: 'Compress PDF', desc: 'Compress original PDF', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' }
    ],
    'pdf-to-ppt': [
      { name: 'Compress PDF', desc: 'Compress original PDF', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'PDF to Word', desc: 'Extract text to Word DOCX', icon: 'bi-file-earmark-word', path: 'pdf-to-word.html' },
      { name: 'Merge PDF', desc: 'Combine multiple decks', icon: 'bi-files', path: 'merge-pdf.html' }
    ]
  };

  function injectNextToolSuggestion() {
    if (!statusContainer) return;
    if (statusContainer.querySelector('.next-tool-suggestion')) return; // inject only once
    const tools = NEXT_TOOL_MAP[toolId] || [
      { name: 'Compress PDF', desc: 'Reduce file size for sharing', icon: 'bi-file-earmark-zip', path: 'compress-pdf.html' },
      { name: 'Protect PDF', desc: 'Password-encrypt document', icon: 'bi-shield-lock', path: 'protect-pdf.html' }
    ];
    if (!tools || !tools.length) return;

    const el = document.createElement('div');
    el.className = 'next-tool-suggestion';
    el.setAttribute('aria-label', 'Next suggested tools');

    let listHtml = '';
    tools.slice(0, 3).forEach(t => {
      listHtml +=
        '<a href="' + escapeHtml(t.path) + '" class="next-tool-item">' +
          '<div class="next-tool-item-icon"><i class="bi ' + escapeHtml(t.icon) + '" aria-hidden="true"></i></div>' +
          '<div class="next-tool-item-text">' +
            '<strong>' + escapeHtml(t.name) + '</strong>' +
            '<span>' + escapeHtml(t.desc) + '</span>' +
          '</div>' +
          '<i class="bi bi-chevron-right next-tool-item-arrow" aria-hidden="true"></i>' +
        '</a>';
    });

    el.innerHTML =
      '<div class="next-tool-header"><i class="bi bi-stars"></i> Next Suggested Tools</div>' +
      '<div class="next-tools-list">' +
        listHtml +
      '</div>';

    const card = statusContainer.querySelector('.success-card');
    if (card) {
      card.appendChild(el);
    } else {
      statusContainer.appendChild(el);
    }
  }

  async function downloadResult(url, filename, button) {
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Downloading...`;

    try {
      window.SmartAssAnalytics?.track('download_clicked', { tool: toolId, filename: filename });

      if (url.startsWith("blob:")) {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        button.innerHTML = `<i class="bi bi-check2-circle"></i> Downloaded!`;
        if (window.SmartAssToast) window.SmartAssToast.show("Download started successfully!", "success");

        // Inject next-tool suggestion after successful download
        injectNextToolSuggestion();

        setTimeout(() => {
          button.disabled = false;
          button.innerHTML = originalText;
        }, 2000);
        return;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("The processed result could not be downloaded.");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      button.innerHTML = `<i class="bi bi-check2-circle"></i> Downloaded!`;
      if (window.SmartAssToast) window.SmartAssToast.show("Download started successfully!", "success");

      // Inject next-tool suggestion after successful download
      injectNextToolSuggestion();

      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = originalText;
      }, 2000);
    } catch (err) {
      button.disabled = false;
      button.innerHTML = originalText;
      if (window.SmartAssToast) window.SmartAssToast.show(err.message, "error");
    }
  }

  /* ==========================================================================
     7. Process Submission
     ========================================================================== */
  async function buildDynamicSignatureGroupCanvas(rawSigUrl, printedName, shouldInclude, targetW, targetH, penColor) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          // High-resolution 3x scale multiplier for vector-grade sharp PDF embedding
          const scale = 3;
          c.width = Math.max(300, Math.round(targetW * scale));
          c.height = Math.max(100, Math.round(targetH * scale));
          const ctx = c.getContext("2d");
          ctx.clearRect(0, 0, c.width, c.height);

          if (!shouldInclude || !printedName || !printedName.trim()) {
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/png"));
            return;
          }

          // Proportional dynamic font size: derived from rendered target dimensions
          let fontSize = Math.round(Math.min(targetW * 0.08, targetH * 0.28)) * scale;
          fontSize = Math.max(9 * scale, Math.min(36 * scale, fontSize));

          // Overflow protection for long names
          const textLen = printedName.trim().length;
          const approxWidth = textLen * (fontSize * 0.58);
          if (approxWidth > (c.width * 0.95)) {
            fontSize = Math.max(8 * scale, Math.floor((c.width * 0.95) / (textLen * 0.58)));
          }

          const textSpacing = Math.round(fontSize * 0.2);
          const textHeight = fontSize + textSpacing;
          const imgHeight = Math.max(10, c.height - textHeight);

          // Draw signature graphic centered in top section
          ctx.drawImage(img, 0, 0, c.width, imgHeight);

          // Draw printed name centered directly below signature
          ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
          ctx.fillStyle = penColor || "#0f172a";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(printedName.trim(), c.width / 2, imgHeight + textSpacing);

          resolve(c.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Unable to read signature graphic format."));
      img.src = rawSigUrl;
    });
  }

  async function handleClientSideSignPdf() {
    if (!files.length || isProcessing) return;
    const file = files[0];
    if (!isPdf(file)) {
      showStatusError("Please select a valid PDF document to sign.");
      return;
    }

    if (!signStudioState.rawSignatureDataUrl) {
      showStatusError("Please draw, type, or upload a signature before signing.");
      return;
    }

    if (typeof PDFLib === "undefined") {
      showStatusError("PDF signing engine is loading. Please try again in a few seconds.");
      return;
    }

    isProcessing = true;
    updateProcessButtonState();
    showStatusProcessing();
    updateProcessingStep(25, "Reading document...", "Preparing high-resolution PDF document.");

    try {
      // Always fetch a fresh untransferred arrayBuffer from the File
      const freshBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(freshBuffer);
      updateProcessingStep(50, "Embedding signature...", "Placing signature at your exact coordinates.");

      const pages = pdfDoc.getPages();
      const pageIndex = Math.max(0, Math.min(pages.length - 1, (signStudioState.currentPage || 1) - 1));
      const targetPage = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();

      const canvas = document.getElementById("pdfSignCanvas");
      const canvasW = canvas && canvas.offsetWidth ? canvas.offsetWidth : (pageWidth * (signStudioState.scaleFactor || 1));
      const canvasH = canvas && canvas.offsetHeight ? canvas.offsetHeight : (pageHeight * (signStudioState.scaleFactor || 1));

      // Scale coordinates from canvas display space to original PDF points space
      const scaleX = pageWidth / (canvasW || pageWidth);
      const scaleY = pageHeight / (canvasH || pageHeight);

      const sigDisplayX = signStudioState.sigX || 50;
      const sigDisplayY = signStudioState.sigY || 50;
      const sigDisplayW = signStudioState.sigWidth || 150;
      const sigDisplayH = signStudioState.sigHeight || 60;

      const pdfX = sigDisplayX * scaleX;
      const pdfY = pageHeight - ((sigDisplayY + sigDisplayH) * scaleY);
      const pdfW = sigDisplayW * scaleX;
      const pdfH = sigDisplayH * scaleY;

      // Generate composite signature graphic with dynamic proportional printed name
      const cleanPngDataUrl = await buildDynamicSignatureGroupCanvas(
        signStudioState.rawSignatureDataUrl,
        signStudioState.printedName,
        signStudioState.includeName,
        signStudioState.sigWidth,
        signStudioState.sigHeight,
        signStudioState.penColor
      );
      const pngImage = await pdfDoc.embedPng(cleanPngDataUrl);

      targetPage.drawImage(pngImage, {
        x: Math.max(0, pdfX),
        y: Math.max(0, pdfY),
        width: Math.max(10, pdfW),
        height: Math.max(10, pdfH)
      });

      updateProcessingStep(85, "Finalizing PDF...", "Generating signed document.");
      const signedBytes = await pdfDoc.save();
      const blob = new Blob([signedBytes], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(blob);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const outputFilename = `${baseName}_signed.pdf`;

      updateProcessingStep(100, "Done!", "Document signed successfully.");
      updateSignWorkflowUI(3);
      setTimeout(() => {
        showStatusSuccess({
          downloadUrl: downloadUrl,
          filename: outputFilename
        });
      }, 300);
    } catch (err) {
      console.error("Client sign error:", err);
      showStatusError("Failed to sign document: " + (err.message || "Unknown error"));
    } finally {
      isProcessing = false;
      updateProcessButtonState();
    }
  }

  async function handleProcess() {
    if (!files.length || isProcessing) return;

    if (toolId === "sign-pdf") {
      if (signStudioState.workflowStep === 1) {
        scrollToPdfPlacementArea();
        return;
      }
      await handleClientSideSignPdf();
      return;
    }

    if (toolId === "merge-pdf" && files.length < 2) {
      showStatusError("Merge PDF requires at least two PDF files.");
      return;
    }

    if (toolId === "compare-pdf" && files.length < 2) {
      showStatusError("Compare PDFs requires two PDF files (Document A and Document B) to compare.");
      return;
    }

    const passwordInput = document.getElementById("passwordInput");
    if ((toolId === "protect-pdf" || toolId === "unlock-pdf") && !passwordInput?.value.trim()) {
      showStatusError("Please enter the PDF password before processing.");
      passwordInput?.focus();
      return;
    }

    const pagesInput = document.getElementById("pagesInput");
    if (toolId === "remove-pages" && !pagesInput?.value.trim()) {
      showStatusError("Please specify the page numbers or ranges (e.g. 1, 3, 5-7).");
      pagesInput?.focus();
      return;
    }

    if (pagesInput?.value.trim() && !/^\d+(?:-\d+)?(?:\s*,\s*\d+(?:-\d+)?)*$/.test(pagesInput.value.trim())) {
      showStatusError("Please use valid page numbers or ranges (e.g. 1-3, 5, 8-10).");
      pagesInput.focus();
      return;
    }

    const fd = new FormData();
    files.forEach(f => fd.append("files", f));

    if (pagesInput?.value.trim()) fd.append("pages", pagesInput.value.trim());

    const qualityInput = document.getElementById("qualityInput");
    if (qualityInput) fd.append("quality", qualityInput.value);

    const angleInput = document.getElementById("angleInput");
    if (angleInput) fd.append("angle", angleInput.value);

    const positionInput = document.getElementById("positionInput");
    if (positionInput) fd.append("position", positionInput.value);

    const watermarkTextInput = document.getElementById("watermarkTextInput");
    if (watermarkTextInput?.value) fd.append("text", watermarkTextInput.value);

    const opacityInput = document.getElementById("opacityInput");
    if (opacityInput) fd.append("opacity", opacityInput.value);

    const rotationInput = document.getElementById("rotationInput");
    if (rotationInput) fd.append("rotation", rotationInput.value);

    const fontSizeInput = document.getElementById("fontSizeInput");
    if (fontSizeInput) fd.append("fontSize", fontSizeInput.value);

    const colorInput = document.getElementById("colorInput");
    if (colorInput) fd.append("color", colorInput.value);

    const languageInput = document.getElementById("languageInput");
    if (languageInput?.value) fd.append("language", languageInput.value);

    const signerNameInput = document.getElementById("signerNameInput");
    if (signerNameInput?.value) fd.append("signer", signerNameInput.value);

    if (passwordInput?.value) fd.append("password", passwordInput.value);

    const dpiInput = document.getElementById("dpiInput");
    if (dpiInput) fd.append("dpi", dpiInput.value);

    isProcessing = true;
    updateProcessButtonState();
    showStatusProcessing();
    window.SmartAssAnalytics?.track('conversion_started', { tool: toolId, fileCount: files.length });

    // Simulated progress stage transitions
    setTimeout(() => { if (isProcessing) updateProcessingStep(55, "Applying transformations...", "Spring Boot processing engine working on document structure."); }, 400);
    setTimeout(() => { if (isProcessing) updateProcessingStep(85, "Finalizing output...", "Optimizing output file and preparing download stream."); }, 900);

    try {
      const res = await fetch(`${API_BASE_URL}/tools/${encodeURIComponent(toolId)}/jobs`, {
        method: "POST",
        body: fd
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "The server could not process this document.");
      }

      window.SmartAssAnalytics?.track('conversion_completed', { tool: toolId });
      updateProcessingStep(100, "Done!", "Your file is ready.");
      setTimeout(() => {
        showStatusSuccess(data);
      }, 300);
    } catch (err) {
      window.SmartAssAnalytics?.track('conversion_failed', { tool: toolId, error: err.message });
      showStatusError(err.message || "Processing failed. Please check the file and try again.");
      if (window.SmartAssToast) window.SmartAssToast.show(err.message, "error");
    } finally {
      isProcessing = false;
      updateProcessButtonState();
    }
  }

  /* ==========================================================================
     8. Initialization & Event Binding
     ========================================================================== */
  function init() {
    queryDOMElements();

    if (fileInput) {
      fileInput.accept = toolConfig.accept || ".pdf";
      fileInput.multiple = Boolean(toolConfig.multiple);
      fileInput.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length) {
          setFiles(Array.from(e.target.files), Boolean(toolConfig.multiple));
        }
        fileInput.value = "";
      });
    }

    if (browseBtn) {
      browseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput?.click();
      });
    }

    if (dropzone) {
      dropzone.addEventListener("click", (e) => {
        if (e.target !== browseBtn && !browseBtn?.contains(e.target)) {
          fileInput?.click();
        }
      });

      ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add("is-dragover");
        });
      });

      ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove("is-dragover");
        });
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer?.files?.length) {
          setFiles(Array.from(e.dataTransfer.files), Boolean(toolConfig.multiple));
        }
      });
    }

    if (processBtn) {
      processBtn.addEventListener("click", handleProcess);
    }

    renderWorkflowStepper();
    renderToolOptions();
    renderLivePreview();
    updateProcessButtonState();
  }

  // Ensure init runs regardless of when script is loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
