
/**
 * SmartAssPDF â€” Professional "Scan to PDF" Studio Engine
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

    // Fixed Master PDF Settings
    pdfSettings: {
      pageSize: 'original',   // Fit to Document (Full Bleed)
      orientation: 'auto',    // Auto-Detect
      quality: 0.98           // Maximum Quality (100%)
    },

    // Result Buffer
    compiledPdfBlob: null,
    compiledPdfUrl: null,
    suggestedFilename: 'Scanned_Document.pdf',

    // Source Mode: 'camera' or 'upload'
    sourceMode: 'camera',

    // Auto-Capture State
    autoCaptureEnabled: true,
    steadyStartTime: null,
    lastDetectedCenter: null,
    isCapturing: false,

    // Live CV Detection State
    detectionAnimFrameId: null,
    smoothedCorners: null,
    latestDetectedCorners: null,
    cvOffscreenCanvas: null
  };

  // DOM Elements Cache
  let stageLauncher, stageCamera, stageCrop, stageManager, stageResult;
  let videoFeed, guidancePill, flashOverlay, cameraOverlayCanvas, cameraOverlayCtx;
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
    cameraOverlayCanvas = document.getElementById('cameraOverlayCanvas');
    if (cameraOverlayCanvas) cameraOverlayCtx = cameraOverlayCanvas.getContext('2d');
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
    if (btnStartScan) {
      btnStartScan.addEventListener('click', () => {
        state.sourceMode = 'camera';
        onStartScanningClick();
      });
    }

    const btnUploadPhotos = document.getElementById('btnUploadPhotos');
    const launcherFileInput = document.getElementById('launcherFileInput');
    if (btnUploadPhotos && launcherFileInput) {
      btnUploadPhotos.addEventListener('click', () => {
        state.sourceMode = 'upload';
        launcherFileInput.click();
      });
      launcherFileInput.addEventListener('change', handleFilePickerUpload);
    }

    // 2. Camera Viewfinder Actions
    const btnShutter = document.getElementById('btnShutter');
    if (btnShutter) btnShutter.addEventListener('click', captureCameraFrame);

    const btnFlipCamera = document.getElementById('btnFlipCamera');
    if (btnFlipCamera) btnFlipCamera.addEventListener('click', flipCamera);

    const btnTorchToggle = document.getElementById('btnTorchToggle');
    if (btnTorchToggle) btnTorchToggle.addEventListener('click', toggleTorch);

    const btnAutoCaptureToggle = document.getElementById('btnAutoCaptureToggle');
    const autoCaptureLabel = document.getElementById('autoCaptureLabel');
    if (btnAutoCaptureToggle) {
      btnAutoCaptureToggle.addEventListener('click', () => {
        state.autoCaptureEnabled = !state.autoCaptureEnabled;
        if (autoCaptureLabel) {
          autoCaptureLabel.textContent = state.autoCaptureEnabled ? 'AUTO ON' : 'MANUAL';
        }
        btnAutoCaptureToggle.style.borderColor = state.autoCaptureEnabled ? 'rgba(56,189,248,0.5)' : 'rgba(148,163,184,0.3)';
        btnAutoCaptureToggle.style.color = state.autoCaptureEnabled ? '#38bdf8' : '#94a3b8';
        if (window.SmartAssToast) {
          window.SmartAssToast.show(state.autoCaptureEnabled ? 'Auto-Capture enabled (Hands-free)' : 'Manual Capture enabled', 'info', 1500);
        }
      });
    }

    const btnCloseCamera = document.getElementById('btnCloseCamera');
    if (btnCloseCamera) {
      btnCloseCamera.addEventListener('click', () => {
        stopCamera();
        switchStage(state.pages.length > 0 ? 'manager' : 'launcher');
      });
    }

    const btnCameraBack = document.getElementById('btnCameraBack');
    if (btnCameraBack) {
      btnCameraBack.addEventListener('click', () => {
        stopCamera();
        switchStage(state.pages.length > 0 ? 'manager' : 'launcher');
      });
    }

    const btnCameraFinish = document.getElementById('btnCameraFinish');
    if (btnCameraFinish) {
      btnCameraFinish.addEventListener('click', () => {
        stopCamera();
        switchStage('manager');
      });
    }

    // 3. Crop & Perspective Stage Actions
    const btnCropRetake = document.getElementById('btnCropRetake');
    if (btnCropRetake) {
      btnCropRetake.addEventListener('click', () => {
        if (state.editingPageIndex >= 0) {
          switchStage('manager');
        } else if (state.sourceMode === 'upload') {
          const fileInput = document.getElementById('launcherFileInput');
          if (fileInput) {
            fileInput.value = "";
            fileInput.click();
          } else {
            switchStage('launcher');
          }
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

    const btnAutoDetectCorners = document.getElementById('btnAutoDetectCorners');
    if (btnAutoDetectCorners) {
      btnAutoDetectCorners.addEventListener('click', () => {
        if (!state.activeRawCanvas) return;
        const detected = detectDocumentCorners(state.activeRawCanvas);
        if (detected) {
          state.activeCorners = detected;
          renderCropCanvas();
          updateCropLivePreview();
          if (window.SmartAssToast) window.SmartAssToast.show("Document corners detected!", "success", 1500);
        } else {
          if (window.SmartAssToast) window.SmartAssToast.show("Could not find clear borders. Adjust corners manually.", "warning", 2000);
        }
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
     1. On-Demand Camera Manager & Real-Time Computer Vision Detection
     ========================================================================== */
  async function onStartScanningClick() {
    await startCamera();
  }

  async function startCamera() {
    stopCamera();
    switchStage('camera');
    updateCameraThumbnailStack();

    if (guidancePill) {
      guidancePill.innerHTML = `<span class="guidance-dot"></span> Searching doc...`;
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

      startLiveDetection();

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
    stopLiveDetection();
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

  function updateCameraThumbnailStack() {
    const btnFinish = document.getElementById('btnCameraFinish');
    const thumbImg = document.getElementById('camLastThumbImg');
    const badge = document.getElementById('camThumbCountBadge');
    const spacer = document.getElementById('camBottomSpacer');

    if (!btnFinish) return;

    if (state.pages.length > 0) {
      const lastPage = state.pages[state.pages.length - 1];
      if (thumbImg && lastPage.finalDataUrl) thumbImg.src = lastPage.finalDataUrl;
      if (badge) badge.textContent = state.pages.length;
      btnFinish.style.display = 'flex';
      if (spacer) spacer.style.display = 'none';
    } else {
      btnFinish.style.display = 'none';
      if (spacer) spacer.style.display = 'block';
    }
  }

  function startLiveDetection() {
    stopLiveDetection();
    state.smoothedCorners = null;
    state.latestDetectedCorners = null;

    let lastCvTime = 0;
    const cvInterval = 120; // 8-10 FPS CV detection for smooth 60fps rendering without CPU load

    function detectionLoop(timestamp) {
      if (state.currentStage !== 'camera' || !videoFeed || videoFeed.readyState < 2) {
        state.detectionAnimFrameId = requestAnimationFrame(detectionLoop);
        return;
      }

      if (!cameraOverlayCanvas || !cameraOverlayCtx) {
        cameraOverlayCanvas = document.getElementById('cameraOverlayCanvas');
        if (cameraOverlayCanvas) cameraOverlayCtx = cameraOverlayCanvas.getContext('2d');
      }

      if (cameraOverlayCanvas && cameraOverlayCtx) {
        const boxW = cameraOverlayCanvas.parentElement.clientWidth || 400;
        const boxH = cameraOverlayCanvas.parentElement.clientHeight || 300;
        if (cameraOverlayCanvas.width !== boxW || cameraOverlayCanvas.height !== boxH) {
          cameraOverlayCanvas.width = boxW;
          cameraOverlayCanvas.height = boxH;
        }

        // Run CV detection periodically
        if (timestamp - lastCvTime > cvInterval) {
          lastCvTime = timestamp;
          const detected = detectDocumentCorners(videoFeed);
          if (detected) {
            state.latestDetectedCorners = detected;
            if (!state.smoothedCorners) {
              state.smoothedCorners = JSON.parse(JSON.stringify(detected));
            } else {
              const alpha = 0.35;
              ['tl', 'tr', 'br', 'bl'].forEach(k => {
                state.smoothedCorners[k].x += (detected[k].x - state.smoothedCorners[k].x) * alpha;
                state.smoothedCorners[k].y += (detected[k].y - state.smoothedCorners[k].y) * alpha;
              });
            }

            // Check document stability for Auto-Capture
            const curCenterX = (detected.tl.x + detected.tr.x + detected.br.x + detected.bl.x) / 4;
            const curCenterY = (detected.tl.y + detected.tr.y + detected.br.y + detected.bl.y) / 4;

            if (state.lastDetectedCenter) {
              const moveDist = Math.hypot(curCenterX - state.lastDetectedCenter.x, curCenterY - state.lastDetectedCenter.y);
              if (moveDist < 30) {
                // Steady in frame!
                if (!state.steadyStartTime) state.steadyStartTime = timestamp;
                const steadyDuration = timestamp - state.steadyStartTime;

                if (state.autoCaptureEnabled) {
                  if (guidancePill) {
                    guidancePill.innerHTML = `<span class="guidance-dot" style="background:#10b981; box-shadow:0 0 10px #10b981;"></span> Please don't move`;
                  }

                  if (steadyDuration >= 900 && !state.isCapturing) {
                    state.isCapturing = true;
                    captureCameraFrame();
                    return;
                  }
                } else {
                  if (guidancePill) {
                    guidancePill.innerHTML = `<span class="guidance-dot" style="background:#10b981; box-shadow:0 0 8px #10b981;"></span> Please don't move â€” Tap shutter`;
                  }
                }
              } else {
                state.steadyStartTime = null;
                if (guidancePill) {
                  guidancePill.innerHTML = `<span class="guidance-dot"></span> Searching doc...`;
                }
              }
            }
            state.lastDetectedCenter = { x: curCenterX, y: curCenterY };

          } else {
            state.steadyStartTime = null;
            state.lastDetectedCenter = null;
            if (guidancePill && timestamp > 2500) {
              guidancePill.innerHTML = `<span class="guidance-dot"></span> Searching doc...`;
            }
          }
        }

        // Render overlay at 60 FPS
        cameraOverlayCtx.clearRect(0, 0, cameraOverlayCanvas.width, cameraOverlayCanvas.height);
        if (state.smoothedCorners && state.latestDetectedCorners) {
          renderCameraOverlay(cameraOverlayCanvas, cameraOverlayCtx, state.smoothedCorners, videoFeed);
        }
      }

      state.detectionAnimFrameId = requestAnimationFrame(detectionLoop);
    }

    state.detectionAnimFrameId = requestAnimationFrame(detectionLoop);
  }

  function stopLiveDetection() {
    if (state.detectionAnimFrameId) {
      cancelAnimationFrame(state.detectionAnimFrameId);
      state.detectionAnimFrameId = null;
    }
    if (cameraOverlayCanvas && cameraOverlayCtx) {
      cameraOverlayCtx.clearRect(0, 0, cameraOverlayCanvas.width, cameraOverlayCanvas.height);
    }
    state.smoothedCorners = null;
    state.latestDetectedCorners = null;
    state.steadyStartTime = null;
    state.lastDetectedCenter = null;
    state.isCapturing = false;
  }

  function renderCameraOverlay(canvas, ctx, corners, video) {
    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;
    const boxW = canvas.width;
    const boxH = canvas.height;

    const videoAspect = vw / vh;
    const boxAspect = boxW / boxH;
    let renderedW, renderedH, offsetX, offsetY;

    if (boxAspect > videoAspect) {
      renderedW = boxW;
      renderedH = boxW / videoAspect;
      offsetX = 0;
      offsetY = (boxH - renderedH) / 2;
    } else {
      renderedH = boxH;
      renderedW = boxH * videoAspect;
      offsetY = 0;
      offsetX = (boxW - renderedW) / 2;
    }

    const mapPt = (pt) => ({
      x: offsetX + (pt.x / vw) * renderedW,
      y: offsetY + (pt.y / vh) * renderedH
    });

    const tl = mapPt(corners.tl);
    const tr = mapPt(corners.tr);
    const br = mapPt(corners.br);
    const bl = mapPt(corners.bl);

    // 1. Translucent Document Highlight (OKEN Scanner Emerald Green)
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();

    // 2. Glowing Boundary Lines
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // 3. 4 Corner Target Handles
    const now = performance.now() / 1000;
    const pulseRadius = 13 + Math.sin(now * 5) * 2;

    [tl, tr, br, bl].forEach(pt => {
      // Outer translucent pulse ring
      ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pulseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Middle ring
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7.5, 0, Math.PI * 2);
      ctx.stroke();

      // White inner center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
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

    const detected = state.latestDetectedCorners || detectDocumentCorners(rawCanvas) || getDefaultCorners(vw, vh);
    const corners = JSON.parse(JSON.stringify(detected));
    const finalDataUrl = renderProcessedImage(rawCanvas, corners, state.activeFilter || 'original', 0);

    state.pages.push({
      id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      rawCanvas: rawCanvas,
      corners: corners,
      rotation: 0,
      filter: state.activeFilter || 'original',
      finalDataUrl: finalDataUrl
    });

    state.selectedPreviewIndex = state.pages.length - 1;
    updateCameraThumbnailStack();

    if (guidancePill) {
      guidancePill.innerHTML = `<span class="guidance-dot" style="background:#10b981; box-shadow:0 0 10px #10b981;"></span> Page ${state.pages.length} Captured`;
    }

    if (window.SmartAssToast) {
      window.SmartAssToast.show(`Page ${state.pages.length} scanned!`, "success", 1200);
    }

    // Reset detection state & continue live scanning for subsequent pages without stopping camera!
    setTimeout(() => {
      state.steadyStartTime = null;
      state.lastDetectedCenter = null;
      state.isCapturing = false;
      if (guidancePill && state.currentStage === 'camera') {
        guidancePill.innerHTML = `<span class="guidance-dot"></span> Searching doc...`;
      }
    }, 600);
  }  /* ==========================================================================
     Computer Vision: Complete Document Detection Hierarchy Pipeline
     ========================================================================== */

  // 1. Normalization & Point Ordering
  function orderCornerPoints(pts) {
    if (!pts || pts.length !== 4) return null;
    const sortedByY = [...pts].sort((a, b) => a.y - b.y);
    const topPoints = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottomPoints = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);
    return {
      tl: topPoints[0],
      tr: topPoints[1],
      br: bottomPoints[1],
      bl: bottomPoints[0]
    };
  }

  // 2. Corner Sub-Pixel Refinement
  function refineCornerSubpixel(corner, mag, procW, procH, scale) {
    const cx = Math.round(corner.x * scale);
    const cy = Math.round(corner.y * scale);
    const radius = 6;
    let bestX = cx, bestY = cy, maxGrad = -1;

    for (let dy = -radius; dy <= radius; dy++) {
      const y = cy + dy;
      if (y < 2 || y >= procH - 2) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        if (x < 2 || x >= procW - 2) continue;
        const g = mag[y * procW + x];
        if (g > maxGrad) {
          maxGrad = g;
          bestX = x;
          bestY = y;
        }
      }
    }

    const invScale = 1 / scale;
    return {
      x: Math.max(0, Math.round(bestX * invScale)),
      y: Math.max(0, Math.round(bestY * invScale))
    };
  }

  // 3. Geometry & Quality Evaluation with Confidence Score
  function evaluateQuadGeometry(quad, srcW, srcH, mag, procW, procH, scale) {
    if (!quad || !quad.tl || !quad.tr || !quad.br || !quad.bl) {
      return { valid: false, score: 0, quad: null };
    }
    const { tl, tr, br, bl } = quad;

    // Cross products for convexity
    const cp1 = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x);
    const cp2 = (br.x - tr.x) * (tl.y - tr.y) - (br.y - tr.y) * (tl.x - tr.x);
    const cp3 = (bl.x - br.x) * (tr.y - br.y) - (bl.y - br.y) * (tr.x - br.x);
    const cp4 = (tl.x - bl.x) * (br.y - bl.y) - (tl.y - bl.y) * (br.x - bl.x);

    const isConvex = (cp1 > 0 && cp2 > 0 && cp3 > 0 && cp4 > 0) || (cp1 < 0 && cp2 < 0 && cp3 < 0 && cp4 < 0);
    if (!isConvex) return { valid: false, score: 0, quad: null };

    // Area ratio
    const quadArea = 0.5 * Math.abs(
      (tl.x * tr.y - tl.y * tr.x) +
      (tr.x * br.y - tr.y * br.x) +
      (br.x * bl.y - br.y * bl.x) +
      (bl.x * tl.y - bl.y * tl.x)
    );
    const totalArea = srcW * srcH;
    const areaRatio = quadArea / totalArea;

    if (areaRatio < 0.06 || areaRatio > 0.96) {
      return { valid: false, score: 0, quad: null };
    }

    // Side lengths & Aspect ratio
    const topW = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const botW = Math.hypot(br.x - bl.x, br.y - bl.y);
    const leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const rightH = Math.hypot(br.x - tr.x, br.y - tr.y);

    const widthRatio = Math.max(topW, botW) / Math.max(1, Math.min(topW, botW));
    const heightRatio = Math.max(leftH, rightH) / Math.max(1, Math.min(leftH, rightH));
    if (widthRatio > 3.2 || heightRatio > 3.2) {
      return { valid: false, score: 0, quad: null };
    }

    // Edge gradient density
    let edgeGradientSum = 0;
    let sampleCount = 0;
    if (mag) {
      const sampleLine = (p1, p2) => {
        for (let t = 0.15; t <= 0.85; t += 0.1) {
          const px = Math.round((p1.x + (p2.x - p1.x) * t) * scale);
          const py = Math.round((p1.y + (p2.y - p1.y) * t) * scale);
          if (px >= 0 && px < procW && py >= 0 && py < procH) {
            edgeGradientSum += mag[py * procW + px];
            sampleCount++;
          }
        }
      };
      sampleLine(tl, tr);
      sampleLine(tr, br);
      sampleLine(br, bl);
      sampleLine(bl, tl);
    }

    const avgEdgeGrad = sampleCount > 0 ? (edgeGradientSum / sampleCount) : 40;
    let confidence = 0.60;
    if (areaRatio > 0.12 && areaRatio < 0.88) confidence += 0.15;
    if (widthRatio < 1.8 && heightRatio < 1.8) confidence += 0.12;
    if (avgEdgeGrad > 20) confidence += 0.13;

    return {
      valid: true,
      score: Math.min(0.99, confidence),
      quad: {
        tl: refineCornerSubpixel(tl, mag, procW, procH, scale),
        tr: refineCornerSubpixel(tr, mag, procW, procH, scale),
        br: refineCornerSubpixel(br, mag, procW, procH, scale),
        bl: refineCornerSubpixel(bl, mag, procW, procH, scale)
      }
    };
  }

  // 4. OpenCV Contours Detection
  function detectWithOpenCV(procCanvas, srcW, srcH, scale, mag, procW, procH) {
    if (typeof cv === 'undefined' || !cv.Mat) return null;

    let src = null, gray = null, blurred = null, edges = null, dilated = null;
    let contours = null, hierarchy = null, approx = null;

    try {
      src = cv.imread(procCanvas);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

      blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

      edges = new cv.Mat();
      cv.Canny(blurred, edges, 35, 120);

      dilated = new cv.Mat();
      const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
      cv.dilate(edges, dilated, kernel);
      kernel.delete();

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let maxArea = 0;
      let bestQuadPoints = null;
      const totalArea = procW * procH;
      approx = new cv.Mat();

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area > totalArea * 0.07 && area < totalArea * 0.98) {
          const peri = cv.arcLength(contour, true);
          cv.approxPolyDP(contour, approx, 0.025 * peri, true);

          if (approx.rows === 4 && cv.isContourConvex(approx)) {
            if (area > maxArea) {
              maxArea = area;
              bestQuadPoints = [];
              for (let j = 0; j < 4; j++) {
                bestQuadPoints.push({
                  x: approx.data32S[j * 2],
                  y: approx.data32S[j * 2 + 1]
                });
              }
            }
          }
        }
        contour.delete();
      }

      if (bestQuadPoints && bestQuadPoints.length === 4) {
        const sorted = orderCornerPoints(bestQuadPoints);
        if (sorted) {
          const invScale = 1 / scale;
          const quad = {
            tl: { x: Math.max(0, Math.min(srcW, Math.round(sorted.tl.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(sorted.tl.y * invScale))) },
            tr: { x: Math.max(0, Math.min(srcW, Math.round(sorted.tr.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(sorted.tr.y * invScale))) },
            br: { x: Math.max(0, Math.min(srcW, Math.round(sorted.br.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(sorted.br.y * invScale))) },
            bl: { x: Math.max(0, Math.min(srcW, Math.round(sorted.bl.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(sorted.bl.y * invScale))) }
          };
          const evalRes = evaluateQuadGeometry(quad, srcW, srcH, mag, procW, procH, scale);
          if (evalRes.valid && evalRes.score >= 0.65) return evalRes.quad;
        }
      }

      return null;

    } catch (e) {
      console.warn("OpenCV detection error:", e);
      return null;
    } finally {
      if (src) src.delete();
      if (gray) gray.delete();
      if (blurred) blurred.delete();
      if (edges) edges.delete();
      if (dilated) dilated.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
      if (approx) approx.delete();
    }
  }

  // 5. Hough & Boundary Intersection Fallback
  function detectWithHoughIntersection(mag, procW, procH, srcW, srcH, scale) {
    const borderX = Math.max(4, Math.round(procW * 0.04));
    const borderY = Math.max(4, Math.round(procH * 0.04));

    const projX = new Float32Array(procW);
    const projY = new Float32Array(procH);

    for (let y = borderY; y < procH - borderY; y++) {
      const row = y * procW;
      for (let x = borderX; x < procW - borderX; x++) {
        const m = mag[row + x];
        if (m > 20) {
          projX[x] += m;
          projY[y] += m;
        }
      }
    }

    // Find top and bottom bounds
    let topY = -1, botY = -1;
    const midY = Math.floor(procH / 2);
    for (let y = borderY; y < midY; y++) {
      if (projY[y] > 100 && (topY === -1 || projY[y] > projY[topY])) topY = y;
    }
    for (let y = procH - borderY - 1; y >= midY; y--) {
      if (projY[y] > 100 && (botY === -1 || projY[y] > projY[botY])) botY = y;
    }

    // Find left and right bounds
    let leftX = -1, rightX = -1;
    const midX = Math.floor(procW / 2);
    for (let x = borderX; x < midX; x++) {
      if (projX[x] > 100 && (leftX === -1 || projX[x] > projX[leftX])) leftX = x;
    }
    for (let x = procW - borderX - 1; x >= midX; x--) {
      if (projX[x] > 100 && (rightX === -1 || projX[x] > projX[rightX])) rightX = x;
    }

    if (topY !== -1 && botY !== -1 && leftX !== -1 && rightX !== -1) {
      const invScale = 1 / scale;
      const quad = {
        tl: { x: Math.max(0, Math.round(leftX * invScale)), y: Math.max(0, Math.round(topY * invScale)) },
        tr: { x: Math.min(srcW, Math.round(rightX * invScale)), y: Math.max(0, Math.round(topY * invScale)) },
        br: { x: Math.min(srcW, Math.round(rightX * invScale)), y: Math.min(srcH, Math.round(botY * invScale)) },
        bl: { x: Math.max(0, Math.round(leftX * invScale)), y: Math.min(srcH, Math.round(botY * invScale)) }
      };
      const evalRes = evaluateQuadGeometry(quad, srcW, srcH, mag, procW, procH, scale);
      if (evalRes.valid && evalRes.score >= 0.65) return evalRes.quad;
    }

    return null;
  }

  // 6. AI & Color/Saturation Segmentation Fallback
  function detectWithColorSegmentation(data, mag, procW, procH, srcW, srcH, scale) {
    const borderX = Math.max(4, Math.round(procW * 0.04));
    const borderY = Math.max(4, Math.round(procH * 0.04));
    const strongPoints = [];

    let sumX = 0, sumY = 0, count = 0;

    for (let y = borderY; y < procH - borderY; y++) {
      for (let x = borderX; x < procW - borderX; x++) {
        const idx = (y * procW + x) << 2;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const sat = maxVal > 0 ? (maxVal - minVal) / maxVal : 0;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Paper likelihood: high/medium brightness + low color saturation OR strong edge
        const isPaperLike = (lum > 75 && sat < 0.45) || (lum > 140) || (mag[y * procW + x] > 25);

        if (isPaperLike) {
          sumX += x;
          sumY += y;
          count++;
          strongPoints.push({ x, y, weight: lum * (1 - sat * 0.5) });
        }
      }
    }

    if (count < 60) return null;

    const cX = sumX / count;
    const cY = sumY / count;

    let bestTL = null, maxScoreTL = -Infinity;
    let bestTR = null, maxScoreTR = -Infinity;
    let bestBR = null, maxScoreBR = -Infinity;
    let bestBL = null, maxScoreBL = -Infinity;

    for (let i = 0; i < strongPoints.length; i++) {
      const p = strongPoints[i];
      const dx = p.x - cX;
      const dy = p.y - cY;
      const dist = Math.hypot(dx, dy);

      if (dx <= 10 && dy <= 10) {
        const s = dist * 1.5 - (p.x + p.y) * 0.5;
        if (s > maxScoreTL) { maxScoreTL = s; bestTL = p; }
      }
      if (dx >= -10 && dy <= 10) {
        const s = dist * 1.5 + (p.x - p.y) * 0.5;
        if (s > maxScoreTR) { maxScoreTR = s; bestTR = p; }
      }
      if (dx >= -10 && dy >= -10) {
        const s = dist * 1.5 + (p.x + p.y) * 0.5;
        if (s > maxScoreBR) { maxScoreBR = s; bestBR = p; }
      }
      if (dx <= 10 && dy >= -10) {
        const s = dist * 1.5 - (p.x - p.y) * 0.5;
        if (s > maxScoreBL) { maxScoreBL = s; bestBL = p; }
      }
    }

    if (!bestTL || !bestTR || !bestBR || !bestBL) return null;

    const invScale = 1 / scale;
    const quad = {
      tl: { x: Math.max(0, Math.min(srcW, Math.round(bestTL.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(bestTL.y * invScale))) },
      tr: { x: Math.max(0, Math.min(srcW, Math.round(bestTR.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(bestTR.y * invScale))) },
      br: { x: Math.max(0, Math.min(srcW, Math.round(bestBR.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(bestBR.y * invScale))) },
      bl: { x: Math.max(0, Math.min(srcW, Math.round(bestBL.x * invScale))), y: Math.max(0, Math.min(srcH, Math.round(bestBL.y * invScale))) }
    };

    const evalRes = evaluateQuadGeometry(quad, srcW, srcH, mag, procW, procH, scale);
    if (evalRes.valid && evalRes.score >= 0.60) return evalRes.quad;

    return null;
  }

  // Master Detection Orchestrator (Executes Hierarchy)
  function detectDocumentCorners(sourceElement) {
    let srcW = sourceElement.videoWidth || sourceElement.naturalWidth || sourceElement.width;
    let srcH = sourceElement.videoHeight || sourceElement.naturalHeight || sourceElement.height;
    if (!srcW || !srcH) return null;

    const maxDim = 420;
    const scale = Math.min(maxDim / srcW, maxDim / srcH, 1);
    const procW = Math.round(srcW * scale);
    const procH = Math.round(srcH * scale);

    if (!state.cvOffscreenCanvas) {
      state.cvOffscreenCanvas = document.createElement('canvas');
    }
    const procCanvas = state.cvOffscreenCanvas;
    procCanvas.width = procW;
    procCanvas.height = procH;
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

    procCtx.drawImage(sourceElement, 0, 0, procW, procH);
    const imgData = procCtx.getImageData(0, 0, procW, procH);
    const data = imgData.data;

    // Compute Multi-Channel Gradients & Blur
    const gray = new Float32Array(procW * procH);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    const blurGray = new Float32Array(procW * procH);
    for (let y = 1; y < procH - 1; y++) {
      const row = y * procW;
      for (let x = 1; x < procW - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const rOffset = (y + dy) * procW + x;
          sum += gray[rOffset - 1] + gray[rOffset] + gray[rOffset + 1];
        }
        blurGray[row + x] = sum / 9;
      }
    }

    const mag = new Float32Array(procW * procH);
    const borderX = Math.max(3, Math.round(procW * 0.035));
    const borderY = Math.max(3, Math.round(procH * 0.035));

    for (let y = 2; y < procH - 2; y++) {
      const row = y * procW;
      for (let x = 2; x < procW - 2; x++) {
        if (x < borderX || x > procW - borderX || y < borderY || y > procH - borderY) continue;
        const gx = -blurGray[row - procW + x - 1] + blurGray[row - procW + x + 1] - 2 * blurGray[row + x - 1] + 2 * blurGray[row + x + 1] - blurGray[row + procW + x - 1] + blurGray[row + procW + x + 1];
        const gy = -blurGray[row - procW + x - 1] - 2 * blurGray[row - procW + x] - blurGray[row - procW + x + 1] + blurGray[row + procW + x - 1] + 2 * blurGray[row + procW + x] + blurGray[row + procW + x + 1];
        mag[row + x] = Math.hypot(gx, gy);
      }
    }

    // Step 1: OpenCV Contours
    const cvResult = detectWithOpenCV(procCanvas, srcW, srcH, scale, mag, procW, procH);
    if (cvResult) return cvResult;

    // Step 2: Hough / Line Intersection Fallback
    const houghResult = detectWithHoughIntersection(mag, procW, procH, srcW, srcH, scale);
    if (houghResult) return houghResult;

    // Step 3: AI / Color Segmentation Fallback
    const colorResult = detectWithColorSegmentation(data, mag, procW, procH, srcW, srcH, scale);
    if (colorResult) return colorResult;

    return null;
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
            const detected = detectDocumentCorners(rawCanvas);
            openCropEditor(rawCanvas, -1, detected);
          } else {
            const detected = detectDocumentCorners(rawCanvas);
            const corners = detected || getDefaultCorners(rawCanvas.width, rawCanvas.height);
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

  function openCropEditor(rawCanvas, pageIndex = -1, preDetectedCorners = null) {
    state.activeRawCanvas = rawCanvas;
    state.editingPageIndex = pageIndex;

    if (pageIndex >= 0 && state.pages[pageIndex]) {
      const p = state.pages[pageIndex];
      state.activeCorners = JSON.parse(JSON.stringify(p.corners));
      state.activeFilter = p.filter || 'original';
      state.activeRotation = p.rotation || 0;
    } else {
      let initialCorners = preDetectedCorners;
      if (!initialCorners) {
        initialCorners = detectDocumentCorners(rawCanvas);
      }
      state.activeCorners = initialCorners || getDefaultCorners(rawCanvas.width, rawCanvas.height);
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

    cropCtx.strokeStyle = '#10b981';
    cropCtx.lineWidth = 3;
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
      cropCtx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      cropCtx.beginPath();
      cropCtx.arc(h.p.x, h.p.y, 18, 0, Math.PI * 2);
      cropCtx.fill();

      cropCtx.fillStyle = '#ffffff';
      cropCtx.strokeStyle = '#10b981';
      cropCtx.lineWidth = 3.5;
      cropCtx.beginPath();
      cropCtx.arc(h.p.x, h.p.y, 8.5, 0, Math.PI * 2);
      cropCtx.fill();
      cropCtx.stroke();
    });

    // Magnifier Loupe (Active when dragging corner on mobile / desktop)
    if (state.draggedCorner && state.activeCorners && state.activeCorners[state.draggedCorner] && state.activeRawCanvas) {
      const cornerPt = state.activeCorners[state.draggedCorner];
      const cx = cornerPt.x * scale;
      const cy = cornerPt.y * scale;

      let loupeX = cx;
      let loupeY = cy - 75;
      if (loupeY < 60) loupeY = cy + 75;
      if (loupeX < 60) loupeX = 60;
      if (loupeX > w - 60) loupeX = w - 60;

      const loupeRadius = 46;
      const zoom = 2.4;

      cropCtx.save();
      cropCtx.beginPath();
      cropCtx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      cropCtx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      cropCtx.shadowBlur = 18;
      cropCtx.strokeStyle = '#ffffff';
      cropCtx.lineWidth = 3.5;
      cropCtx.stroke();

      cropCtx.clip();

      const srcW = (loupeRadius * 2) / zoom;
      const srcH = (loupeRadius * 2) / zoom;
      const srcX = cornerPt.x - srcW / 2;
      const srcY = cornerPt.y - srcH / 2;

      cropCtx.drawImage(
        state.activeRawCanvas,
        srcX, srcY, srcW, srcH,
        loupeX - loupeRadius, loupeY - loupeRadius, loupeRadius * 2, loupeRadius * 2
      );

      // Center crosshair
      cropCtx.strokeStyle = '#10b981';
      cropCtx.lineWidth = 2;
      cropCtx.beginPath();
      cropCtx.moveTo(loupeX - 12, loupeY);
      cropCtx.lineTo(loupeX + 12, loupeY);
      cropCtx.moveTo(loupeX, loupeY - 12);
      cropCtx.lineTo(loupeX, loupeY + 12);
      cropCtx.stroke();

      cropCtx.restore();
    }
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
    const threshold = 44; // Thumb-friendly touch radius
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
  function warpPerspectiveQuad(rawCanvas, corners) {
    const c = corners || getDefaultCorners(rawCanvas.width, rawCanvas.height);
    const p0 = c.tl;
    const p1 = c.tr;
    const p2 = c.br;
    const p3 = c.bl;

    // Calculate dimensions of destination unskewed image
    const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const botW = Math.hypot(p2.x - p3.x, p2.y - p3.y);
    const outW = Math.max(100, Math.round(Math.max(topW, botW)));

    const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
    const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const outH = Math.max(100, Math.round(Math.max(leftH, rightH)));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');

    const srcW = rawCanvas.width;
    const srcH = rawCanvas.height;
    const srcCtx = rawCanvas.getContext('2d');
    const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
    const srcData = srcImgData.data;

    const outImgData = outCtx.createImageData(outW, outH);
    const outData = outImgData.data;

    // Homography project: Unit square [0,1]^2 -> Source quad (p0, p1, p2, p3)
    const x0 = p0.x, y0 = p0.y;
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;

    const dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3;

    let a, b, c_coeff, d, e, f, g, h;
    if (Math.abs(sx) < 0.0001 && Math.abs(sy) < 0.0001) {
      a = x1 - x0;
      b = x3 - x0;
      c_coeff = x0;
      d = y1 - y0;
      e = y3 - y0;
      f = y0;
      g = 0;
      h = 0;
    } else {
      const det = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(det) < 0.000001) {
        outCtx.drawImage(rawCanvas, 0, 0, srcW, srcH, 0, 0, outW, outH);
        return outCanvas;
      }
      g = (sx * dy2 - sy * dx2) / det;
      h = (dx1 * sy - dy1 * sx) / det;
      a = x1 - x0 + g * x1;
      b = x3 - x0 + h * x3;
      c_coeff = x0;
      d = y1 - y0 + g * y1;
      e = y3 - y0 + h * y3;
      f = y0;
    }

    const invW = 1 / outW;
    const invH = 1 / outH;

    let outIdx = 0;
    for (let y = 0; y < outH; y++) {
      const v = y * invH;
      for (let x = 0; x < outW; x++) {
        const u = x * invW;
        const w = g * u + h * v + 1;
        const invWeight = 1 / (w || 0.00001);

        const srcX = (a * u + b * v + c_coeff) * invWeight;
        const srcY = (d * u + e * v + f) * invWeight;

        if (srcX >= 0 && srcX < srcW - 1 && srcY >= 0 && srcY < srcH - 1) {
          const ix = srcX | 0;
          const iy = srcY | 0;
          const fx = srcX - ix;
          const fy = srcY - iy;
          const fx1 = 1 - fx;
          const fy1 = 1 - fy;

          const i00 = (iy * srcW + ix) << 2;
          const i10 = i00 + 4;
          const i01 = i00 + (srcW << 2);
          const i11 = i01 + 4;

          const w00 = fx1 * fy1;
          const w10 = fx * fy1;
          const w01 = fx1 * fy;
          const w11 = fx * fy;

          outData[outIdx]     = (srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11) | 0;
          outData[outIdx + 1] = (srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11) | 0;
          outData[outIdx + 2] = (srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11) | 0;
          outData[outIdx + 3] = 255;
        } else if (srcX >= 0 && srcX < srcW && srcY >= 0 && srcY < srcH) {
          const idx = ((srcY | 0) * srcW + (srcX | 0)) << 2;
          outData[outIdx]     = srcData[idx];
          outData[outIdx + 1] = srcData[idx + 1];
          outData[outIdx + 2] = srcData[idx + 2];
          outData[outIdx + 3] = 255;
        } else {
          outData[outIdx]     = 255;
          outData[outIdx + 1] = 255;
          outData[outIdx + 2] = 255;
          outData[outIdx + 3] = 255;
        }
        outIdx += 4;
      }
    }

    outCtx.putImageData(outImgData, 0, 0);
    return outCanvas;
  }

  function renderProcessedImage(rawCanvas, corners, filterType, rotation) {
    const outCanvas = warpPerspectiveQuad(rawCanvas, corners);

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
          <button type="button" class="deck-menu-trigger" data-index="${idx}" title="Page options" aria-label="Page options">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <div class="deck-menu-dropdown" id="deckMenu_${idx}">
            <button type="button" class="deck-menu-item" data-action="edit" data-index="${idx}">
              <i class="bi bi-crop"></i> <span>Edit</span>
            </button>
            <button type="button" class="deck-menu-item" data-action="duplicate" data-index="${idx}">
              <i class="bi bi-copy"></i> <span>Duplicate</span>
            </button>
            <button type="button" class="deck-menu-item" data-action="rotate" data-index="${idx}">
              <i class="bi bi-arrow-clockwise"></i> <span>Rotate</span>
            </button>
            <button type="button" class="deck-menu-item text-danger" data-action="delete" data-index="${idx}">
              <i class="bi bi-trash3"></i> <span>Delete</span>
            </button>
          </div>
        </div>
      `;
    });

    html += `
      <div class="deck-add-slot" id="deckAddSlot" title="Scan or add more pages">
        <i class="bi bi-plus-lg"></i>
        <span>+ Add</span>
      </div>
    `;

    pageDeckGrid.innerHTML = html;
    attachDeckEvents();
  }

  function attachDeckEvents() {
    // Tap thumbnail to open full-screen crop/perspective editor
    pageDeckGrid.querySelectorAll('.deck-thumb-wrap').forEach((wrap, idx) => {
      wrap.addEventListener('click', () => {
        state.selectedPreviewIndex = idx;
        updatePreviewPanel('manager');
        openCropEditor(state.pages[idx].rawCanvas, idx);
      });
    });

    // 3-Dots Menu Trigger
    pageDeckGrid.querySelectorAll('.deck-menu-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = trigger.dataset.index;
        const targetCard = trigger.closest('.deck-page-card');
        const targetMenu = document.getElementById(`deckMenu_${idx}`);
        const wasOpen = targetMenu && targetMenu.classList.contains('is-open');

        // Close all open menus & remove active elevation
        document.querySelectorAll('.deck-menu-dropdown').forEach(m => m.classList.remove('is-open'));
        document.querySelectorAll('.deck-page-card').forEach(c => c.classList.remove('is-active-menu'));

        if (!wasOpen && targetMenu && targetCard) {
          targetMenu.classList.add('is-open');
          targetCard.classList.add('is-active-menu');
        }
      });
    });

    // Context Menu Action Buttons
    pageDeckGrid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.deck-menu-dropdown').forEach(m => m.classList.remove('is-open'));
        document.querySelectorAll('.deck-page-card').forEach(c => c.classList.remove('is-active-menu'));
        const action = btn.dataset.action;
        const idx = Number(btn.dataset.index);

        if (action === 'edit') {
          state.selectedPreviewIndex = idx;
          openCropEditor(state.pages[idx].rawCanvas, idx);
        } else if (action === 'duplicate') {
          const p = state.pages[idx];
          state.pages.splice(idx + 1, 0, {
            id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            rawCanvas: p.rawCanvas,
            corners: JSON.parse(JSON.stringify(p.corners)),
            rotation: p.rotation,
            filter: p.filter,
            finalDataUrl: p.finalDataUrl
          });
          state.selectedPreviewIndex = idx + 1;
          renderPageDeck();
          updatePreviewPanel('manager');
          if (window.SmartAssToast) window.SmartAssToast.show("Page duplicated", "success", 1200);
        } else if (action === 'rotate') {
          const p = state.pages[idx];
          p.rotation = (p.rotation + 90) % 360;
          p.finalDataUrl = renderProcessedImage(p.rawCanvas, p.corners, p.filter, p.rotation);
          renderPageDeck();
          updatePreviewPanel('manager');
        } else if (action === 'delete') {
          state.pages.splice(idx, 1);
          state.selectedPreviewIndex = Math.max(0, idx - 1);
          renderPageDeck();
          updatePreviewPanel('manager');
          if (window.SmartAssToast) window.SmartAssToast.show("Page removed", "info", 1200);
        }
      });
    });

    // Close any open menus on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.deck-menu-dropdown').forEach(m => m.classList.remove('is-open'));
      document.querySelectorAll('.deck-page-card').forEach(c => c.classList.remove('is-active-menu'));
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

        if (state.pdfSettings.pageSize === 'original') {
          // Zero white margins: exact matching document aspect ratio and full-bleed bounds
          const page = pdfDoc.addPage([imgW, imgH]);
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: imgW,
            height: imgH
          });
        } else {
          // Standard page formats: fill page edge-to-edge without arbitrary margins
          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          const scale = Math.min(pageWidth / imgW, pageHeight / imgH);
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

    // Inject Next Suggested Tools (3 compact tools) cleanly after process completion
    const stageResult = document.getElementById('stageResult');
    if (stageResult && !stageResult.querySelector('.next-tool-suggestion')) {
      const suggestion = document.createElement('div');
      suggestion.className = 'next-tool-suggestion';
      suggestion.setAttribute('aria-label', 'Next suggested tools');
      suggestion.innerHTML =
        '<div class="next-tool-header"><i class="bi bi-stars"></i> Next Suggested Tools</div>' +
        '<div class="next-tools-list">' +
          '<a href="ocr-pdf.html" class="next-tool-item">' +
            '<div class="next-tool-item-icon"><i class="bi bi-search" aria-hidden="true"></i></div>' +
            '<div class="next-tool-item-text">' +
              '<strong>OCR PDF</strong>' +
              '<span>Make scanned PDF searchable & copyable</span>' +
            '</div>' +
            '<i class="bi bi-chevron-right next-tool-item-arrow" aria-hidden="true"></i>' +
          '</a>' +
          '<a href="compress-pdf.html" class="next-tool-item">' +
            '<div class="next-tool-item-icon"><i class="bi bi-file-earmark-zip" aria-hidden="true"></i></div>' +
            '<div class="next-tool-item-text">' +
              '<strong>Compress PDF</strong>' +
              '<span>Reduce file size for email sharing</span>' +
            '</div>' +
            '<i class="bi bi-chevron-right next-tool-item-arrow" aria-hidden="true"></i>' +
          '</a>' +
          '<a href="sign-pdf.html" class="next-tool-item">' +
            '<div class="next-tool-item-icon"><i class="bi bi-pen" aria-hidden="true"></i></div>' +
            '<div class="next-tool-item-text">' +
              '<strong>Sign PDF</strong>' +
              '<span>Add your signature or stamp to the PDF</span>' +
            '</div>' +
            '<i class="bi bi-chevron-right next-tool-item-arrow" aria-hidden="true"></i>' +
          '</a>' +
        '</div>';
      stageResult.appendChild(suggestion);
    }
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
