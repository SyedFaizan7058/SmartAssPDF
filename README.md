# SmartAssPDF — Complete Open-Source Document & Image Processing Suite

SmartAssPDF is a high-performance, private, zero-database document manipulation and image processing web application. It combines a modern, responsive HTML5/CSS3 frontend featuring a local browser-native AI assistant (**SmartAss AI**) with a robust Spring Boot 3.5 & Python 3 bridge engine for high-fidelity conversions.

---

## 🛠️ Complete Tool Inventory & Technology Breakdown

Below is the comprehensive matrix of all 16 live tools detailing the exact libraries, engines, and APIs utilized for each:

| #      | Tool Name             | Tool Slug          | Input → Output                             | Technology / Engine Used                                                                                         | Detailed Technical Workflow                                                                                                                                               |
| ------ | --------------------- | ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | **Scan to PDF**       | `scan-to-pdf`      | Camera / Photos → `.pdf`                   | **WebRTC `MediaDevices`**, **HTML5 Canvas 2D Filtering**, **Apache PDFBox 3.0**, **Java `ImageIO`**              | Live mobile/webcam document viewfinder with real-time Magic Color contrast enhancement, B&W thresholding, multi-page batch capture, and standard A4 PDF compilation.    |
| **2**  | **PDF to Word**       | `pdf-to-word`      | `.pdf` → `.docx`                           | **PyMuPDF (`fitz`)**, **`python-docx`**, **`pdf2docx`**, **Apache POI (`XWPFDocument`)**                         | Page-canvas layout engine that extracts exact dimensions, font styles, vector dividing rules, centered logos, and structured tables directly into Microsoft Word format.  |
| **2**  | **PDF to Excel**      | `pdf-to-excel`     | `.pdf` → `.xlsx`                           | **`tabula-py` (Lattice & Stream)**, **PyMuPDF (`find_tables`)**, **`openpyxl`**, **Apache POI (`XSSFWorkbook`)** | Detects tabular row/column boundaries from invoices, reports, and bank statements; parses numeric cells and creates auto-fitted, styled Excel spreadsheets.               |
| **3**  | **PDF to JPG**        | `pdf-to-jpg`       | `.pdf` → `.jpg` / `.zip`                   | **Apache PDFBox 3.0 (`PDFRenderer`)**, **Java `ImageIO`**                                                        | Renders vector PDF pages at customizable resolutions (100, 150, 200, 300 DPI) into crisp JPEG images, packaging multi-page results into an organized ZIP archive.         |
| **4**  | **PDF to PowerPoint** | `pdf-to-ppt`       | `.pdf` → `.pptx`                           | **Apache PDFBox (`PDFRenderer`)**, **Apache POI (`XMLSlideShow`, `XSLFPictureShape`)**                           | Sets exact slide geometry matching the PDF page aspect ratio and embeds high-DPI visual canvas layers for 100% pixel-perfect slide presentation.                          |
| **5**  | **Word to PDF**       | `word-to-pdf`      | `.docx` → `.pdf`                           | **LibreOffice Headless (`writer_pdf_Export`)**, **Apache POI**, **Apache PDFBox**                                | Compiles Microsoft Word `.docx` documents into standard PDFs, preserving 100% of formatting, custom typography, headings, tables, headers, footers, and margins.          |
| **6**  | **Excel to PDF**      | `excel-to-pdf`     | `.xlsx`, `.xls` → `.pdf`                   | **LibreOffice Headless (`calc_pdf_Export`)**, **Apache POI (`WorkbookFactory`)**, **Apache PDFBox**              | Renders genuine spreadsheet worksheets into paginated, printable PDF files with cell gridlines, formulas, borders, and auto-fitted columns.                               |
| **7**  | **Image to WebP**     | `image-to-webp`    | `.png`, `.jpg`, `.jpeg` → `.webp` / `.zip` | **Python Pillow (`PIL.Image`)**                                                                                  | Converts PNG, JPG, and JPEG images into ultra-compact, modern WebP format with configurable compression presets (65%, 85%, 95%) and full alpha transparency preservation. |
| **8**  | **Image to PDF**      | `image-to-pdf`     | `.png`, `.jpg`, `.jpeg` → `.pdf`           | **Apache PDFBox 3.0 (`JPEGFactory`, `PDPageContentStream`)**, **Java `ImageIO`**                                 | Centers and scales single or multiple images onto uniform A4 PDF pages with proportional aspect-ratio scaling.                                                            |
| **9**  | **HTML to PDF**       | `html-to-pdf`      | `.html`, `.htm` → `.pdf`                   | **LibreOffice Headless (`writer_web_pdf_Export`)**, **`OpenHtmlToPdf` (`PdfRendererBuilder`)**                   | Renders full HTML5 markup, typography, flexbox/grid alignments, background colors, and CSS print stylesheets directly into PDF.                                           |
| **10** | **Merge PDF**         | `merge-pdf`        | Multiple `.pdf` → `.pdf`                   | **Apache PDFBox 3.0 (`PDFMergerUtility`)**                                                                       | Concatenates multiple PDF documents in user-defined sequence using in-memory memory-only stream caches.                                                                   |
| **11** | **Split PDF**         | `split-pdf`        | `.pdf` → `.pdf` / `.zip`                   | **Apache PDFBox 3.0 (`PDDocument.importPage`)**, **Java `ZipOutputStream`**                                      | Parses custom page intervals (e.g. `1-3, 5, 8-12`) and exports extracted pages as standalone PDFs or an organized ZIP bundle.                                             |
| **12** | **Compress PDF**      | `compress-pdf`     | `.pdf` → `.pdf`                            | **PyMuPDF (`fitz`)**, **`pypdf`**, **Python Pillow (`PIL`)**, **Apache PDFBox 3.0**                              | Multi-stage optimization: DPI-aware image downsampling (LANCZOS) + progressive JPEG re-encoding + orphan stream garbage collection (`garbage=4`) + pypdf object deduplication and content-stream deflation. |
| **13** | **Rotate PDF**        | `rotate-pdf`       | `.pdf` → `.pdf`                            | **Apache PDFBox 3.0 (`PDPage.setRotation`)**                                                                     | Rotates all document pages clockwise by 90°, 180°, or 270° with client-side interactive preview.                                                                          |
| **14** | **Add Page Numbers**  | `add-page-numbers` | `.pdf` → `.pdf`                            | **Apache PDFBox 3.0 (`PDPageContentStream`, `Standard14Fonts.HELVETICA`)**                                       | Computes bounding box geometry and stamps clean page numbering (`X / Total`) at bottom-center, bottom-left, bottom-right, or top-center.                                  |
| **15** | **Protect PDF**       | `protect-pdf`      | `.pdf` → `.pdf`                            | **Apache PDFBox 3.0 (`StandardProtectionPolicy`, `AccessPermission`)**                                           | Enforces 256-bit AES cryptographic encryption to prevent unauthorized viewing, copying, or printing.                                                                      |
| **16** | **Unlock PDF**        | `unlock-pdf`       | `.pdf` → `.pdf`                            | **Apache PDFBox 3.0 (`PDDocument.setAllSecurityToBeRemoved`)**                                                   | Removes encryption and security locks from password-authorized PDF documents.                                                                                             |

---

## 🤖 SmartAss AI Agent (Local & Open-Source)

- **Engine**: Local Browser-Native JavaScript Engine (`frontend/assets/js/ai-agent.js`).
- **Zero Cost**: 100% open-source, runs entirely in the user's browser with **zero external API keys**, zero subscription costs, and zero server latency.
- **Capabilities**:
  - Natural language intent parsing and semantic keyword matching.
  - Deep-links directly into conversion tools with 1-click execution chips.
  - Contextual troubleshooting for corrupted PDFs, password protection, and compression tips.

---

## 🏗️ Architecture & Privacy Design

SmartAssPDF operates under a strict **Zero-Permanent-Storage Architecture**:
1. **Stateless Processing**: No user database, no account login required, no tracking cookies.
2. **Isolated Job Sandboxes**: Each request generates an isolated UUID directory under `backend/temp-jobs/`.
3. **Automated Deletion**: A scheduled background worker deletes all uploaded and processed files after **30 minutes**.
4. **Dynamic File Naming**: Preserves the original uploaded filename base (`Resume_2026.pdf` → `Resume_2026.docx`).

---

## 🚀 Where & How to Deploy

### Option 1: Deploying the Backend (Spring Boot + Python + LibreOffice)

The backend requires Java 17+, Python 3.10+, and LibreOffice for full high-fidelity rendering.

#### A. Deploying via Docker (Recommended for Render, Railway, Fly.io, AWS ECS, DigitalOcean)

Create or use the unified `Dockerfile`:

```dockerfile
# Multi-stage Dockerfile for SmartAssPDF Backend
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Install Python 3, LibreOffice headless, and Python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    default-jre-headless \
    fonts-dejavu \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install Python libraries
RUN pip3 install --no-cache-dir \
    pymupdf \
    python-docx \
    pdf2docx \
    openpyxl \
    tabula-py \
    pandas \
    pillow

COPY --from=build /app/target/smartasspdf-backend-0.0.1-SNAPSHOT.jar app.jar
COPY scripts ./scripts

ENV PORT=8080
ENV CORS_ORIGIN=*
ENV RETENTION_MINUTES=30

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### B. Free & Low-Cost Cloud Deployment Platforms:
- **Render.com**:
  1. Create a new **Web Service** from your Git repository.
  2. Select **Docker** environment.
  3. Set environment variable `CORS_ORIGIN=https://your-frontend-domain.com`.
- **Railway.app**:
  1. Click **New Project** → **Deploy from GitHub repo**.
  2. Railway automatically detects the Dockerfile and deploys the backend.
- **DigitalOcean App Platform**:
  1. Create App → Choose Dockerfile in `backend/`.
  2. Set HTTP Port to `8080`.

---

### Option 2: Deploying the Frontend (Static Hosting)

The `frontend/` directory is 100% static HTML, CSS, and JS with zero build step required.

#### A. Free Static Hosts (Vercel, Netlify, Cloudflare Pages, GitHub Pages)
- **Vercel**:
  1. Import Git repository.
  2. Set **Root Directory** to `frontend`.
  3. Deploy instantly with global edge CDN.
- **Netlify**:
  1. Drag and drop the `frontend` folder OR connect repository with base directory `frontend`.
- **Cloudflare Pages**:
  1. Connect repo → Build directory `frontend` → Deploy.

#### B. Connecting Frontend to Backend:
In `frontend/assets/js/tool.js`, the API defaults to `http://localhost:8080/api/v1` locally. For production, set:
```html
<script>
  window.SMARTASSPDF_API_ORIGIN = 'https://api.yourdomain.com';
</script>
```

---

### Option 3: Production Nginx Reverse Proxy Configuration

If hosting frontend and backend together on a single VPS (Ubuntu / Debian / AWS EC2):

```nginx
server {
    listen 80;
    server_name smartasspdf.com www.smartasspdf.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smartasspdf.com www.smartasspdf.com;

    ssl_certificate /etc/letsencrypt/live/smartasspdf.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smartasspdf.com/privkey.pem;

    # Static Frontend
    root /var/www/smartasspdf/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 60M;
    }
}
```

---

## 💻 Local Development Setup

### 1. Run the Spring Boot Backend:
```bash
cd backend
mvn spring-boot:run
```
API runs on `http://localhost:8080`.

### 2. Run the Static Frontend:
```bash
cd frontend
python -m http.server 3000
```
Open `http://localhost:3000` in your web browser.

---

## 📄 License & Open-Source Credits
- Built with Apache PDFBox (Apache-2.0), Apache POI (Apache-2.0), PyMuPDF (AGPL/Commercial), LibreOffice (MPL-2.0), Pillow (HPND), Bootstrap Icons (MIT).
- Distributed for free public use under the MIT Open Source License.
