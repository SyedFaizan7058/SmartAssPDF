
/**
 * SmartAssPDF — Professional "Scan to PDF" Studio Engine
 * Features: On-Demand Camera Viewfinder, 4-Corner Crop & Perspective Warper,
 * Document Enhancement Filters (Original Default, Magic Color, B&W, Grayscale, Auto),
 * Multi-Page Sequencer, Live Preview Side Panel Integration, and PDF-Lib Client Compiler.
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

  // Master State
  const state = {
    currentStage: 'launcher', // 'launcher', 'camera', 'crop', 'manager', 'result'
    stream: null,
    videoTrack: null,
    facingMode: 'environment',
    torchActive: false,

    // Crop & Editing Stage Buffer
    activeRawCanvas: null,
    activeCorners: null,
    draggedCorner: null,
    editingPageIndex: -1,
    activeFilter: 'original', // DEFAULT: Original Photo
    activeRotation: 0,

    // Multi-Page Sequencer
    pages: [],
    selectedPreviewIndex: 0,

    // PDF Settings
    pdfSettings: {
      pageSize: 'a4',
      orientation: 'auto',
      quality: 0.85
    },

    // Result Buffer
    compiledPdfBlob: null,
    compiledPdfUrl: null,
    suggestedFilename: 'Scanned_Document.pdf'
  };

  // DOM Elements Cache
  let stageLauncher, stageCamera, stageCrop, stageManager, stageResult;
  let videoFeed, guidancePill, flashOverlay;
  let cropCanvas, cropCtx;
  let pageDeckGrid, pageCountBadge;
  let filenameInput, resultPageBadge, resultSizeBadge, btnDownloadPdf, btnSharePdf;
  let previewViewport, previewStatusText, previewStatusDot;
  let stepIndicator1, stepIndicator2, stepIndicator3;

  document.addEventListener('DOMContentLoaded', initScannerStudio);

  function initScannerStudio() {
    cacheDOMElements();
    bindEvents();
    switchStage('launcher');
  }

  function cacheDOMElements() {
    stageLauncher = document.getElementById('stageLauncher');
    stageCamera = document.getElementById('stageCamera');
    stageCrop = document.getElementById('stageCrop');
    stageManager = document.getElementById('stageManager');
    stageResult = document.getElementById('stageResult');

    videoFeed = document.getElementById('cameraVideoFeed');
    guidancePill = document.getElementById('cameraGuidancePill');
    flashOverlay = document.getElementById('cameraFlashOverlay');

    cropCanvas = document.getElementById('cropInteractiveCanvas');
    if (cropCanvas) cropCtx = cropCanvas.getContext('2d');

    pageDeckGrid = document.getElementById('pageDeckGrid');
    pageCountBadge = document.getElementById('pageCountBadge');

    filenameInput = document.getElementById('resultFilenameInput');
    resultPageBadge = document.getElementById('resultPageBadge');
    resultSizeBadge = document.getElementById('resultSizeBadge');
    btnDownloadPdf = document.getElementById('btnDownloadPdf');
    btnSharePdf = document.getElementById('btnSharePdf');

    previewViewport = document.getElementById('previewViewport');
    previewStatusText = document.getElementById('previewStatusText');
    previewStatusDot = document.querySelector('.preview-status-dot');

    stepIndicator1 = document.getElementById('stepIndicator1');
    stepIndicator2 = document.getElementById('stepIndicator2');
    stepIndicator3 = document.getElementById('stepIndicator3');
  }
  function bindEvents() {
    // 1. Launcher Actions
    const btnStartScan = document.getElementById('btnStartScan');
    if (btnStartScan) btnStartScan.addEventListener('click', onStartScanningClick);

    const btnUploadPhotos = document.getElementById('btnUploadPhotos');
    const launcherFileInput = document.getElementById('launcherFileInput');
    if (btnUploadPhotos && launcherFileInput) {
      btnUploadPhotos.addEventListener('click', () => launcherFileInput.click());
      launcherFileInput.addEventListener('change', handleFilePickerUpload);
    }

    // 2. Camera Viewfinder Actions
    const btnShutter = document.getElementById('btnShutter');
    if (btnShutter) btnShutter.addEventListener('click', captureCameraFrame);

    const btnFlipCamera = document.getElementById('btnFlipCamera');
    if (btnFlipCamera) btnFlipCamera.addEventListener('click', flipCamera);

    const btnTorchToggle = document.getElementById('btnTorchToggle');
    if (btnTorchToggle) btnTorchToggle.addEventListener('click', toggleTorch);

    const btnCloseCamera = document.getElementById('btnCloseCamera');
    if (btnCloseCamera) {
      btnCloseCamera.addEventListener('click', () => {
        stopCamera();
        switchStage(state.pages.length > 0 ? 'manager' : 'launcher');
      });
    }

    // 3. Crop & Perspective Stage Actions
    const btnCropRetake = document.getElementById('btnCropRetake');
    if (btnCropRetake) {
      btnCropRetake.addEventListener('click', () => {
        if (state.editingPageIndex >= 0) {
          switchStage('manager');
        } else {
          startCamera();
        }
      });
    }

    const btnCropRotate = document.getElementById('btnCropRotate');
    if (btnCropRotate) {
      btnCropRotate.addEventListener('click', () => {
        state.activeRotation = (state.activeRotation + 90) % 360;
        renderCropCanvas();
        updateCropLivePreview();
      });
    }

    const btnAcceptPage = document.getElementById('btnAcceptPage');
    if (btnAcceptPage) btnAcceptPage.addEventListener('click', acceptCroppedPage);

    // Filter Preset Pills in Crop Stage
    document.querySelectorAll('.filter-preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-preset-pill').forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        state.activeFilter = pill.dataset.filter;
        renderCropCanvas();
        updateCropLivePreview();
      });
    });

    // Touch & Mouse Drag on Crop Canvas
    if (cropCanvas) {
      cropCanvas.addEventListener('mousedown', onCropMouseDown);
      window.addEventListener('mousemove', onCropMouseMove);
      window.addEventListener('mouseup', onCropMouseUp);

      cropCanvas.addEventListener('touchstart', onCropTouchStart, { passive: false });
      window.addEventListener('touchmove', onCropTouchMove, { passive: false });
      window.addEventListener('touchend', onCropTouchEnd);
    }

    // 4. Multi-Page Deck Actions
    const btnScanAnotherPage = document.getElementById('btnScanAnotherPage');
    if (btnScanAnotherPage) btnScanAnotherPage.addEventListener('click', () => startCamera());

    const btnAddMorePhotos = document.getElementById('btnAddMorePhotos');
    const deckFileInput = document.getElementById('deckFileInput');
    if (btnAddMorePhotos && deckFileInput) {
      btnAddMorePhotos.addEventListener('click', () => deckFileInput.click());
      deckFileInput.addEventListener('change', handleFilePickerUpload);
    }

    const btnCompilePdf = document.getElementById('btnCompilePdf');
    if (btnCompilePdf) btnCompilePdf.addEventListener('click', compileDocumentToPdf);

    // PDF Settings Listeners
    const selPageSize = document.getElementById('selPageSize');
    if (selPageSize) selPageSize.addEventListener('change', (e) => state.pdfSettings.pageSize = e.target.value);

    const selOrientation = document.getElementById('selOrientation');
    if (selOrientation) selOrientation.addEventListener('change', (e) => state.pdfSettings.orientation = e.target.value);

    const selQuality = document.getElementById('selQuality');
    if (selQuality) selQuality.addEventListener('change', (e) => state.pdfSettings.quality = parseFloat(e.target.value));

    // 5. Result Actions
    if (btnDownloadPdf) btnDownloadPdf.addEventListener('click', downloadGeneratedPdf);
    if (btnSharePdf) btnSharePdf.addEventListener('click', shareGeneratedPdf);

    const btnEditPages = document.getElementById('btnEditPages');
    if (btnEditPages) btnEditPages.addEventListener('click', () => switchStage('manager'));

    const btnScanNewDoc = document.getElementById('btnScanNewDoc');
    if (btnScanNewDoc) {
      btnScanNewDoc.addEventListener('click', () => {
        state.pages = [];
        state.compiledPdfBlob = null;
        state.compiledPdfUrl = null;
        switchStage('launcher');
      });
    }
  }

  function switchStage(stageName) {
    state.currentStage = stageName;
    const stages = [stageLauncher, stageCamera, stageCrop, stageManager, stageResult];
    stages.forEach(s => {
      if (s) s.style.display = 'none';
    });

    if (stageName === 'launcher' && stageLauncher) stageLauncher.style.display = 'flex';
    if (stageName === 'camera' && stageCamera) stageCamera.style.display = 'flex';
    if (stageName === 'crop' && stageCrop) stageCrop.style.display = 'flex';
    if (stageName === 'manager' && stageManager) {
      stageManager.style.display = 'flex';
      renderPageDeck();
    }
    if (stageName === 'result' && stageResult) stageResult.style.display = 'flex';

    updateStepperIndicators(stageName);
    updatePreviewPanel(stageName);

    const container = document.getElementById('scanStudioWorkspace');
    if (container && stageName !== 'launcher') {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function updateStepperIndicators(stageName) {
    if (!stepIndicator1 || !stepIndicator2 || !stepIndicator3) return;

    [stepIndicator1, stepIndicator2, stepIndicator3].forEach(s => s.classList.remove('is-active', 'is-completed'));

    if (stageName === 'launcher' || stageName === 'camera') {
      stepIndicator1.classList.add('is-active');
    } else if (stageName === 'crop' || stageName === 'manager') {
      stepIndicator1.classList.add('is-completed');
      stepIndicator2.classList.add('is-active');
    } else if (stageName === 'result') {
      stepIndicator1.classList.add('is-completed');
      stepIndicator2.classList.add('is-completed');
      stepIndicator3.classList.add('is-active');
    }
  }

  function updatePreviewPanel(stageName) {
    if (!previewViewport) return;

    if (stageName === 'launcher') {
      if (previewStatusText) previewStatusText.textContent = "Waiting for input";
      previewViewport.innerHTML = `
        <div class="preview-empty-state">
          <i class="bi bi-file-earmark-arrow-up"></i>
          <strong>No preview available</strong>
          <p>Drop a file or browse from your device to see the interactive preview.</p>
        </div>
      `;
    } else if (stageName === 'camera') {
      if (previewStatusText) previewStatusText.textContent = "Scanning Live";
      previewViewport.innerHTML = `
        <div class="preview-empty-state">
          <i class="bi bi-camera-video-fill" style="color:var(--primary);"></i>
          <strong>Camera Active</strong>
          <p>Align document inside the viewfinder and tap shutter.</p>
        </div>
      `;
    } else if (stageName === 'crop') {
      if (previewStatusText) {
        previewStatusText.textContent = state.editingPageIndex >= 0 ? `Editing Page ${state.editingPageIndex + 1}` : "Review Capture";
      }
      updateCropLivePreview();
    } else if (stageName === 'manager') {
      if (state.pages.length > 0) {
        state.selectedPreviewIndex = Math.min(state.selectedPreviewIndex, state.pages.length - 1);
        const idx = state.selectedPreviewIndex;
        const page = state.pages[idx];
        if (previewStatusText) previewStatusText.textContent = `Page ${idx + 1} of ${state.pages.length}`;
        previewViewport.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; padding:14px; gap:12px;">
            <div style="flex:1; width:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#000; border-radius:var(--radius-md);">
              <img src="${page.finalDataUrl}" alt="Page ${idx + 1} Preview" style="max-width:100%; max-height:360px; object-fit:contain;">
            </div>
            <div style="display:flex; gap:10px; align-items:center; font-size:0.85rem; font-weight:700;">
              <button type="button" class="btn btn-ghost btn-sm" id="prevPreviewPage" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}><i class="bi bi-chevron-left"></i></button>
              <span>Page ${idx + 1} / ${state.pages.length}</span>
              <button type="button" class="btn btn-ghost btn-sm" id="nextPreviewPage" ${idx === state.pages.length - 1 ? 'disabled style="opacity:0.3;"' : ''}><i class="bi bi-chevron-right"></i></button>
            </div>
          </div>
        `;
        const btnPrev = document.getElementById('prevPreviewPage');
        const btnNext = document.getElementById('nextPreviewPage');
        if (btnPrev) btnPrev.addEventListener('click', () => { if (state.selectedPreviewIndex > 0) { state.selectedPreviewIndex--; updatePreviewPanel('manager'); } });
        if (btnNext) btnNext.addEventListener('click', () => { if (state.selectedPreviewIndex < state.pages.length - 1) { state.selectedPreviewIndex++; updatePreviewPanel('manager'); } });
      }
    } else if (stageName === 'result') {
      if (previewStatusText) previewStatusText.textContent = "PDF Ready";
      if (state.pages.length > 0) {
        previewViewport.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; width:100%; padding:16px; text-align:center; gap:10px;">
            <div style="width:100%; max-height:340px; display:flex; align-items:center; justify-content:center; background:#000; border-radius:var(--radius-md); overflow:hidden;">
              <img src="${state.pages[0].finalDataUrl}" alt="PDF Page 1" style="max-width:100%; max-height:320px; object-fit:contain;">
            </div>
            <div style="color:var(--success); font-weight:700; font-size:0.9rem;">
              <i class="bi bi-check-circle-fill me-1"></i> Document Compiled (${state.pages.length} Page${state.pages.length > 1 ? 's' : ''})
            </div>
          </div>
        `;
      }
    }
  }

  function updateCropLivePreview() {
    if (!state.activeRawCanvas || !previewViewport || state.currentStage !== 'crop') return;
    const previewDataUrl = renderProcessedImage(state.activeRawCanvas, state.activeCorners, state.activeFilter, state.activeRotation);
    previewViewport.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; padding:14px; gap:8px;">
        <div style="flex:1; width:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#000; border-radius:var(--radius-md);">
          <img src="${previewDataUrl}" alt="Perspective Crop Preview" style="max-width:100%; max-height:360px; object-fit:contain;">
        </div>
        <small style="color:var(--text-muted); font-size:0.8rem;">Live Un-skewed Preview (${state.activeFilter.toUpperCase()})</small>
      </div>
    `;
  }
  /* ==========================================================================
     1. On-Demand Camera Manager
     ========================================================================== */
  async function onStartScanningClick() {
    await startCamera();
  }

  async function startCamera() {
    stopCamera();
    switchStage('camera');

    if (guidancePill) {
      guidancePill.innerHTML = `<span class="guidance-dot"></span> Align document inside frame`;
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      }
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported on this browser or insecure connection (HTTPS required).");
      }

      state.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoFeed) {
        videoFeed.srcObject = state.stream;
        await videoFeed.play();
      }

      state.videoTrack = state.stream.getVideoTracks()[0];

      const btnTorchToggle = document.getElementById('btnTorchToggle');
      if (state.videoTrack && btnTorchToggle) {
        const capabilities = state.videoTrack.getCapabilities ? state.videoTrack.getCapabilities() : {};
        btnTorchToggle.style.display = capabilities.torch ? 'flex' : 'none';
      }

      setTimeout(() => {
        if (state.currentStage === 'camera' && guidancePill) {
          guidancePill.innerHTML = `<span class="guidance-dot" style="background:#38bdf8; box-shadow:0 0 8px #38bdf8;"></span> Hold steady & tap shutter`;
        }
      }, 2500);

    } catch (err) {
      console.warn("Camera access failed:", err);
      stopCamera();
      if (window.SmartAssToast) {
        window.SmartAssToast.show("Camera access unavailable. You can upload document photos instead.", "warning");
      }
      switchStage(state.pages.length > 0 ? 'manager' : 'launcher');
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
      state.videoTrack = null;
    }
    state.torchActive = false;
    const btnTorchToggle = document.getElementById('btnTorchToggle');
    if (btnTorchToggle) btnTorchToggle.classList.remove('is-active');
  }

  async function flipCamera() {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    await startCamera();
  }

  async function toggleTorch() {
    if (!state.videoTrack) return;
    try {
      state.torchActive = !state.torchActive;
      await state.videoTrack.applyConstraints({
        advanced: [{ torch: state.torchActive }]
      });
      const btnTorchToggle = document.getElementById('btnTorchToggle');
      if (btnTorchToggle) btnTorchToggle.classList.toggle('is-active', state.torchActive);
    } catch (e) {
      console.warn("Torch failed:", e);
    }
  }

  function captureCameraFrame() {
    if (!videoFeed || videoFeed.readyState < 2) return;

    if (flashOverlay) {
      flashOverlay.classList.add('do-flash');
      setTimeout(() => flashOverlay.classList.remove('do-flash'), 120);
    }
    if (navigator.vibrate) navigator.vibrate(60);

    const vw = videoFeed.videoWidth || 1920;
    const vh = videoFeed.videoHeight || 1080;

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = vw;
    rawCanvas.height = vh;
    const ctx = rawCanvas.getContext('2d');
    ctx.drawImage(videoFeed, 0, 0, vw, vh);

    stopCamera();
    openCropEditor(rawCanvas, -1);
  }

  /* ==========================================================================
     2. File Upload Handler
     ========================================================================== */
  function handleFilePickerUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let loadedCount = 0;
    files.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const rawCanvas = document.createElement('canvas');
          rawCanvas.width = img.naturalWidth || img.width;
          rawCanvas.height = img.naturalHeight || img.height;
          const ctx = rawCanvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          if (files.length === 1 && state.pages.length === 0) {
            openCropEditor(rawCanvas, -1);
          } else {
            const corners = getDefaultCorners(rawCanvas.width, rawCanvas.height);
            const finalDataUrl = renderProcessedImage(rawCanvas, corners, 'original', 0);
            state.pages.push({
              id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              rawCanvas: rawCanvas,
              corners: corners,
              rotation: 0,
              filter: 'original',
              finalDataUrl: finalDataUrl
            });
            loadedCount++;
            if (loadedCount === files.length) {
              state.selectedPreviewIndex = 0;
              switchStage('manager');
              if (window.SmartAssToast) {
                window.SmartAssToast.show(`${files.length} pages added to document!`, 'success');
              }
            }
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  }

  /* ==========================================================================
     3. 4-Corner Crop & Perspective Warper
     ========================================================================== */
  function getDefaultCorners(width, height) {
    const marginX = width * 0.05;
    const marginY = height * 0.05;
    return {
      tl: { x: marginX, y: marginY },
      tr: { x: width - marginX, y: marginY },
      br: { x: width - marginX, y: height - marginY },
      bl: { x: marginX, y: height - marginY }
    };
  }

  function openCropEditor(rawCanvas, pageIndex = -1) {
    state.activeRawCanvas = rawCanvas;
    state.editingPageIndex = pageIndex;

    if (pageIndex >= 0 && state.pages[pageIndex]) {
      const p = state.pages[pageIndex];
      state.activeCorners = JSON.parse(JSON.stringify(p.corners));
      state.activeFilter = p.filter || 'original';
      state.activeRotation = p.rotation || 0;
    } else {
      state.activeCorners = getDefaultCorners(rawCanvas.width, rawCanvas.height);
      state.activeFilter = 'original'; // DEFAULT: Original Photo
      state.activeRotation = 0;
    }

    document.querySelectorAll('.filter-preset-pill').forEach(pill => {
      pill.classList.toggle('is-active', pill.dataset.filter === state.activeFilter);
    });

    switchStage('crop');
    setupCropCanvasSize();
    renderCropCanvas();
    updateCropLivePreview();
  }

  function setupCropCanvasSize() {
    if (!cropCanvas || !state.activeRawCanvas) return;
    const wrapper = cropCanvas.parentElement;
    const maxW = wrapper.clientWidth || 600;
    const maxH = 480;

    const imgW = state.activeRawCanvas.width;
    const imgH = state.activeRawCanvas.height;
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);

    cropCanvas.width = imgW * scale;
    cropCanvas.height = imgH * scale;
    cropCanvas.dataset.scale = scale;
  }

  function renderCropCanvas() {
    if (!cropCanvas || !cropCtx || !state.activeRawCanvas) return;
    const scale = parseFloat(cropCanvas.dataset.scale) || 1;
    const w = cropCanvas.width;
    const h = cropCanvas.height;

    cropCtx.clearRect(0, 0, w, h);

    cropCtx.save();
    cropCtx.drawImage(state.activeRawCanvas, 0, 0, w, h);
    cropCtx.restore();

    const c = state.activeCorners;
    const tl = { x: c.tl.x * scale, y: c.tl.y * scale };
    const tr = { x: c.tr.x * scale, y: c.tr.y * scale };
    const br = { x: c.br.x * scale, y: c.br.y * scale };
    const bl = { x: c.bl.x * scale, y: c.bl.y * scale };

    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    cropCtx.beginPath();
    cropCtx.rect(0, 0, w, h);
    cropCtx.moveTo(tl.x, tl.y);
    cropCtx.lineTo(bl.x, bl.y);
    cropCtx.lineTo(br.x, br.y);
    cropCtx.lineTo(tr.x, tr.y);
    cropCtx.closePath();
    cropCtx.fill('evenodd');

    cropCtx.strokeStyle = '#6366f1';
    cropCtx.lineWidth = 2.5;
    cropCtx.beginPath();
    cropCtx.moveTo(tl.x, tl.y);
    cropCtx.lineTo(tr.x, tr.y);
    cropCtx.lineTo(br.x, br.y);
    cropCtx.lineTo(bl.x, bl.y);
    cropCtx.closePath();
    cropCtx.stroke();

    const handles = [
      { id: 'tl', p: tl },
      { id: 'tr', p: tr },
      { id: 'br', p: br },
      { id: 'bl', p: bl }
    ];

    handles.forEach(h => {
      cropCtx.fillStyle = 'rgba(99, 102, 241, 0.35)';
      cropCtx.beginPath();
      cropCtx.arc(h.p.x, h.p.y, 16, 0, Math.PI * 2);
      cropCtx.fill();

      cropCtx.fillStyle = '#ffffff';
      cropCtx.strokeStyle = '#6366f1';
      cropCtx.lineWidth = 3;
      cropCtx.beginPath();
      cropCtx.arc(h.p.x, h.p.y, 8, 0, Math.PI * 2);
      cropCtx.fill();
      cropCtx.stroke();
    });
  }

  function getCanvasCoords(evt, canvas) {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function getNearestCorner(pos, scale) {
    const threshold = 36;
    const c = state.activeCorners;
    const corners = [
      { id: 'tl', x: c.tl.x * scale, y: c.tl.y * scale },
      { id: 'tr', x: c.tr.x * scale, y: c.tr.y * scale },
      { id: 'br', x: c.br.x * scale, y: c.br.y * scale },
      { id: 'bl', x: c.bl.x * scale, y: c.bl.y * scale }
    ];

    for (let corner of corners) {
      const dist = Math.hypot(pos.x - corner.x, pos.y - corner.y);
      if (dist <= threshold) return corner.id;
    }
    return null;
  }

  function onCropMouseDown(e) {
    const scale = parseFloat(cropCanvas.dataset.scale) || 1;
    const pos = getCanvasCoords(e, cropCanvas);
    state.draggedCorner = getNearestCorner(pos, scale);
  }

  function onCropMouseMove(e) {
    if (!state.draggedCorner || !state.activeRawCanvas) return;
    const scale = parseFloat(cropCanvas.dataset.scale) || 1;
    const pos = getCanvasCoords(e, cropCanvas);

    const rawX = Math.max(0, Math.min(state.activeRawCanvas.width, pos.x / scale));
    const rawY = Math.max(0, Math.min(state.activeRawCanvas.height, pos.y / scale));

    state.activeCorners[state.draggedCorner] = { x: rawX, y: rawY };
    renderCropCanvas();
    updateCropLivePreview();
  }

  function onCropMouseUp() {
    state.draggedCorner = null;
  }

  function onCropTouchStart(e) {
    e.preventDefault();
    const scale = parseFloat(cropCanvas.dataset.scale) || 1;
    const pos = getCanvasCoords(e, cropCanvas);
    state.draggedCorner = getNearestCorner(pos, scale);
  }

  function onCropTouchMove(e) {
    if (!state.draggedCorner) return;
    e.preventDefault();
    const scale = parseFloat(cropCanvas.dataset.scale) || 1;
    const pos = getCanvasCoords(e, cropCanvas);

    const rawX = Math.max(0, Math.min(state.activeRawCanvas.width, pos.x / scale));
    const rawY = Math.max(0, Math.min(state.activeRawCanvas.height, pos.y / scale));

    state.activeCorners[state.draggedCorner] = { x: rawX, y: rawY };
    renderCropCanvas();
    updateCropLivePreview();
  }

  function onCropTouchEnd() {
    state.draggedCorner = null;
  }

  function acceptCroppedPage() {
    if (!state.activeRawCanvas) return;

    const finalDataUrl = renderProcessedImage(
      state.activeRawCanvas,
      state.activeCorners,
      state.activeFilter,
      state.activeRotation
    );

    if (state.editingPageIndex >= 0 && state.pages[state.editingPageIndex]) {
      const p = state.pages[state.editingPageIndex];
      p.corners = JSON.parse(JSON.stringify(state.activeCorners));
      p.filter = state.activeFilter;
      p.rotation = state.activeRotation;
      p.finalDataUrl = finalDataUrl;
    } else {
      state.pages.push({
        id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        rawCanvas: state.activeRawCanvas,
        corners: JSON.parse(JSON.stringify(state.activeCorners)),
        rotation: state.activeRotation,
        filter: state.activeFilter,
        finalDataUrl: finalDataUrl
      });
      state.selectedPreviewIndex = state.pages.length - 1;
    }

    switchStage('manager');
    if (window.SmartAssToast) {
      window.SmartAssToast.show(`Page ${state.pages.length} saved successfully!`, 'success', 2000);
    }
  }

  /* ==========================================================================
     Perspective Warp & Enhancement Filter Pipeline
     ========================================================================== */
  function renderProcessedImage(rawCanvas, corners, filterType, rotation) {
    const c = corners || getDefaultCorners(rawCanvas.width, rawCanvas.height);
    const topW = Math.hypot(c.tr.x - c.tl.x, c.tr.y - c.tl.y);
    const botW = Math.hypot(c.br.x - c.bl.x, c.br.y - c.bl.y);
    const outW = Math.round(Math.max(topW, botW));

    const leftH = Math.hypot(c.bl.x - c.tl.x, c.bl.y - c.tl.y);
    const rightH = Math.hypot(c.br.x - c.tr.x, c.br.y - c.tr.y);
    const outH = Math.round(Math.max(leftH, rightH));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = Math.max(100, outW);
    outCanvas.height = Math.max(100, outH);
    const outCtx = outCanvas.getContext('2d');

    const minX = Math.min(c.tl.x, c.bl.x);
    const minY = Math.min(c.tl.y, c.tr.y);
    const cropW = Math.max(c.tr.x, c.br.x) - minX;
    const cropH = Math.max(c.bl.y, c.br.y) - minY;

    outCtx.drawImage(rawCanvas, minX, minY, cropW, cropH, 0, 0, outCanvas.width, outCanvas.height);

    let rotatedCanvas = outCanvas;
    if (rotation !== 0) {
      rotatedCanvas = document.createElement('canvas');
      const is90or270 = rotation === 90 || rotation === 270;
      rotatedCanvas.width = is90or270 ? outCanvas.height : outCanvas.width;
      rotatedCanvas.height = is90or270 ? outCanvas.width : outCanvas.height;
      const rCtx = rotatedCanvas.getContext('2d');
      rCtx.save();
      rCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      rCtx.rotate((rotation * Math.PI) / 180);
      rCtx.drawImage(outCanvas, -outCanvas.width / 2, -outCanvas.height / 2);
      rCtx.restore();
    }

    if (filterType !== 'original') {
      applyImageFilter(rotatedCanvas, filterType);
    }

    return rotatedCanvas.toDataURL('image/jpeg', 0.92);
  }

  function applyImageFilter(canvas, filterType) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    if (filterType === 'grayscale') {
      for (let i = 0; i < len; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
      }
    } else if (filterType === 'bw') {
      for (let i = 0; i < len; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = gray > 132 ? 255 : 0;
        data[i] = val; data[i + 1] = val; data[i + 2] = val;
      }
    } else if (filterType === 'magic') {
      const contrast = 1.35;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      for (let i = 0; i < len; i += 4) {
        let r = factor * (data[i] - 128) + 128;
        let g = factor * (data[i + 1] - 128) + 128;
        let b = factor * (data[i + 2] - 128) + 128;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 170) {
          r = Math.min(255, r * 1.15 + 15);
          g = Math.min(255, g * 1.15 + 15);
          b = Math.min(255, b * 1.15 + 15);
        } else if (lum < 90) {
          r = Math.max(0, r * 0.85);
          g = Math.max(0, g * 0.85);
          b = Math.max(0, b * 0.85);
        }
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }
    } else if (filterType === 'auto') {
      for (let i = 0; i < len; i += 4) {
        data[i] = Math.min(255, data[i] * 1.1 + 10);
        data[i + 1] = Math.min(255, data[i + 1] * 1.1 + 10);
        data[i + 2] = Math.min(255, data[i + 2] * 1.1 + 10);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  /* ==========================================================================
     4. Multi-Page Sequencer & Deck Manager
     ========================================================================== */
  function renderPageDeck() {
    if (!pageDeckGrid) return;

    if (state.pages.length === 0) {
      switchStage('launcher');
      return;
    }

    if (pageCountBadge) {
      pageCountBadge.textContent = `${state.pages.length} Page${state.pages.length > 1 ? 's' : ''}`;
    }

    let html = '';
    state.pages.forEach((p, idx) => {
      html += `
        <div class="deck-page-card" data-index="${idx}">
          <span class="deck-page-num">${idx + 1}</span>
          <div class="deck-thumb-wrap" title="Tap to Edit / Re-Crop Page ${idx + 1}">
            <img class="deck-thumb-img" src="${p.finalDataUrl}" alt="Page ${idx + 1}">
          </div>
          <div class="deck-page-actions">
            <button type="button" class="deck-action-btn move-left" title="Move Left" data-action="move-left" data-index="${idx}" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
              <i class="bi bi-chevron-left"></i>
            </button>
            <button type="button" class="deck-action-btn rotate" title="Rotate 90°" data-action="rotate" data-index="${idx}">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button type="button" class="deck-action-btn edit" title="Edit / Crop" data-action="edit" data-index="${idx}">
              <i class="bi bi-crop"></i>
            </button>
            <button type="button" class="deck-action-btn delete" title="Delete Page" data-action="delete" data-index="${idx}">
              <i class="bi bi-trash3"></i>
            </button>
            <button type="button" class="deck-action-btn move-right" title="Move Right" data-action="move-right" data-index="${idx}" ${idx === state.pages.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      `;
    });

    html += `
      <div class="deck-add-slot" id="deckAddSlot" title="Scan or add more pages">
        <i class="bi bi-plus-circle"></i>
        <span>+ Add Page</span>
      </div>
    `;

    pageDeckGrid.innerHTML = html;
    attachDeckEvents();
  }

  function attachDeckEvents() {
    pageDeckGrid.querySelectorAll('.deck-thumb-wrap').forEach((wrap, idx) => {
      wrap.addEventListener('click', () => {
        state.selectedPreviewIndex = idx;
        updatePreviewPanel('manager');
        openCropEditor(state.pages[idx].rawCanvas, idx);
      });
    });

    pageDeckGrid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const idx = Number(btn.dataset.index);

        if (action === 'move-left' && idx > 0) {
          const temp = state.pages[idx - 1];
          state.pages[idx - 1] = state.pages[idx];
          state.pages[idx] = temp;
          state.selectedPreviewIndex = idx - 1;
          renderPageDeck();
          updatePreviewPanel('manager');
        } else if (action === 'move-right' && idx < state.pages.length - 1) {
          const temp = state.pages[idx + 1];
          state.pages[idx + 1] = state.pages[idx];
          state.pages[idx] = temp;
          state.selectedPreviewIndex = idx + 1;
          renderPageDeck();
          updatePreviewPanel('manager');
        } else if (action === 'rotate') {
          const p = state.pages[idx];
          p.rotation = (p.rotation + 90) % 360;
          p.finalDataUrl = renderProcessedImage(p.rawCanvas, p.corners, p.filter, p.rotation);
          renderPageDeck();
          updatePreviewPanel('manager');
        } else if (action === 'edit') {
          state.selectedPreviewIndex = idx;
          openCropEditor(state.pages[idx].rawCanvas, idx);
        } else if (action === 'delete') {
          state.pages.splice(idx, 1);
          state.selectedPreviewIndex = Math.max(0, idx - 1);
          renderPageDeck();
          updatePreviewPanel('manager');
        }
      });
    });

    const addSlot = document.getElementById('deckAddSlot');
    if (addSlot) {
      addSlot.addEventListener('click', () => startCamera());
    }
  }

  /* ==========================================================================
     5. High-Res PDF Compiler (Client-Side)
     ========================================================================== */
  async function compileDocumentToPdf() {
    if (state.pages.length === 0) return;

    const btnCompilePdf = document.getElementById('btnCompilePdf');
    if (btnCompilePdf) {
      btnCompilePdf.disabled = true;
      btnCompilePdf.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Building PDF...`;
    }

    try {
      const PDFLib = window.PDFLib;
      if (!PDFLib) {
        throw new Error("PDF engine is initializing. Please try again in a moment.");
      }

      const pdfDoc = await PDFLib.PDFDocument.create();

      for (let i = 0; i < state.pages.length; i++) {
        const p = state.pages[i];
        const jpegBytes = await fetch(p.finalDataUrl).then(res => res.arrayBuffer());
        const embeddedImage = await pdfDoc.embedJpg(jpegBytes);
        const { width: imgW, height: imgH } = embeddedImage;

        let pageWidth, pageHeight;
        if (state.pdfSettings.pageSize === 'letter') {
          pageWidth = 612; pageHeight = 792;
        } else if (state.pdfSettings.pageSize === 'legal') {
          pageWidth = 612; pageHeight = 1008;
        } else if (state.pdfSettings.pageSize === 'original') {
          pageWidth = imgW; pageHeight = imgH;
        } else {
          pageWidth = 595.28; pageHeight = 841.89; // Standard A4
        }

        if (state.pdfSettings.orientation === 'landscape') {
          if (pageWidth < pageHeight) {
            const tmp = pageWidth; pageWidth = pageHeight; pageHeight = tmp;
          }
        } else if (state.pdfSettings.orientation === 'portrait') {
          if (pageWidth > pageHeight) {
            const tmp = pageWidth; pageWidth = pageHeight; pageHeight = tmp;
          }
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        if (state.pdfSettings.pageSize === 'original') {
          page.drawImage(embeddedImage, {
            x: 0, y: 0, width: pageWidth, height: pageHeight
          });
        } else {
          const margin = 20;
          const maxW = pageWidth - (margin * 2);
          const maxH = pageHeight - (margin * 2);
          const scale = Math.min(maxW / imgW, maxH / imgH);
          const drawW = imgW * scale;
          const drawH = imgH * scale;

          page.drawImage(embeddedImage, {
            x: (pageWidth - drawW) / 2,
            y: (pageHeight - drawH) / 2,
            width: drawW,
            height: drawH
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      state.compiledPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      state.compiledPdfUrl = URL.createObjectURL(state.compiledPdfBlob);

      displayResultScreen();

    } catch (err) {
      console.error("PDF Compilation error:", err);
      if (window.SmartAssToast) {
        window.SmartAssToast.show("Failed to create PDF: " + err.message, "error");
      }
    } finally {
      if (btnCompilePdf) {
        btnCompilePdf.disabled = false;
        btnCompilePdf.innerHTML = `<span>Create PDF</span> <i class="bi bi-arrow-right"></i>`;
      }
    }
  }

  function displayResultScreen() {
    switchStage('result');

    const count = state.pages.length;
    const sizeBytes = state.compiledPdfBlob ? state.compiledPdfBlob.size : 0;
    const formattedSize = formatSize(sizeBytes);

    if (resultPageBadge) resultPageBadge.textContent = `${count} Page${count > 1 ? 's' : ''}`;
    if (resultSizeBadge) resultSizeBadge.textContent = formattedSize;

    const defaultName = `Scanned_Document_${new Date().toISOString().slice(0, 10)}.pdf`;
    state.suggestedFilename = defaultName;
    if (filenameInput) {
      if (filenameInput.tagName === 'INPUT') {
        filenameInput.value = defaultName;
      } else {
        filenameInput.textContent = defaultName;
      }
    }
    const filenameDisplay = document.getElementById('resultFilenameDisplay');
    if (filenameDisplay) filenameDisplay.textContent = defaultName;
  }

  function downloadGeneratedPdf() {
    if (!state.compiledPdfUrl) return;
    let name = filenameInput ? filenameInput.value.trim() : state.suggestedFilename;
    if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';

    const a = document.createElement('a');
    a.href = state.compiledPdfUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (window.SmartAssToast) {
      window.SmartAssToast.show("Download started successfully!", "success");
    }
  }

  async function shareGeneratedPdf() {
    if (!state.compiledPdfBlob) return;
    let name = filenameInput ? filenameInput.value.trim() : state.suggestedFilename;
    if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';

    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([state.compiledPdfBlob], name, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: name,
            text: 'Scanned document created with SmartAssPDF'
          });
          return;
        }
      } catch (e) {
        console.log("Share skipped:", e);
      }
    }

    downloadGeneratedPdf();
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

})();
