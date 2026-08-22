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
    if (toolId === "image-to-pdf" && !isImage(file)) {
      return `Image to PDF accepts JPG, JPEG, and PNG images only. ("${file.name}" is unsupported).`;
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
    } else if (toolId === "extract-pages") {
      toolOptions.innerHTML = `
        <div class="tool-options-card">
          <div class="options-heading">Pages to Extract</div>
          <label class="form-label" for="pagesInput">Page numbers or ranges to save into new PDF</label>
          <input id="pagesInput" class="form-control" placeholder="e.g. 1-3, 5, 8-10" required>
          <div class="form-hint">Enter the page numbers you wish to isolate and export.</div>
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
        <div class="tool-options-card">
          <div class="options-heading">Digital Signature Details</div>
          <label class="form-label" for="signerNameInput">Signer Full Name</label>
          <input id="signerNameInput" class="form-control" placeholder="e.g. John Doe, Sarah Connor" value="Authorized Signer">
          
          <label class="form-label" style="margin-top:14px;">Signature Stamp Position</label>
          <div class="options-grid">
            <button type="button" class="option-chip-btn is-active" data-pos="bottom-right">Bottom Right</button>
            <button type="button" class="option-chip-btn" data-pos="bottom-left">Bottom Left</button>
            <button type="button" class="option-chip-btn" data-pos="bottom-center">Bottom Center</button>
            <button type="button" class="option-chip-btn" data-pos="top-right">Top Right</button>
          </div>
          <input type="hidden" id="positionInput" value="bottom-right">
          <div class="form-hint" style="margin-top:10px;">Tip: You can optionally upload a 2nd file (PNG signature image) to embed your actual signature.</div>
        </div>
      `;
      const posChips = toolOptions.querySelectorAll("[data-pos]");
      const posInput = document.getElementById("positionInput");
      posChips.forEach(chip => {
        chip.addEventListener("click", () => {
          posChips.forEach(c => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          if (posInput) posInput.value = chip.dataset.pos;
        });
      });
    } else {
      toolOptions.innerHTML = "";
    }
  }

  /* ==========================================================================
     4. Live Interactive Preview Panel
     ========================================================================== */
  function renderLivePreview(resultUrl = null, resultFilename = null) {
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

  /* ==========================================================================
     5. Staged Progress & Processing
     ========================================================================== */
  function showStatusProcessing() {
    if (!statusContainer) return;
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
    const downloadUrl = data.downloadUrl.startsWith("http") ? data.downloadUrl : `${API_ORIGIN}${data.downloadUrl}`;
    const filename = data.filename || "converted_document";
    const fullUrl = downloadUrl;

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
            <span>Download ${escapeHtml(toolConfig.outputFormat)}</span>
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="resetToolBtn">
            <i class="bi bi-arrow-counterclockwise"></i>
            <span>Process another document</span>
          </button>
        </div>
      </div>
    `;

    const downloadBtn = document.getElementById("downloadResultBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => downloadResult(fullUrl, filename, downloadBtn));
    }

    const resetBtn = document.getElementById("resetToolBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        files = [];
        clearStatus();
        renderFileList();
        updateProcessButtonState();
        renderLivePreview();
        renderToolOptions();
      });
    }

    renderLivePreview(fullUrl, filename);
    statusContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearStatus() {
    if (statusContainer) statusContainer.innerHTML = "";
  }

  /* ==========================================================================
     6. Direct Download Stream Handler
     ========================================================================== */
  async function downloadResult(url, filename, button) {
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Downloading...`;

    try {
      window.SmartAssAnalytics?.track('download_clicked', { tool: toolId, filename: filename });
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
  async function handleProcess() {
    if (!files.length || isProcessing) return;

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
    if ((toolId === "remove-pages" || toolId === "extract-pages") && !pagesInput?.value.trim()) {
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
