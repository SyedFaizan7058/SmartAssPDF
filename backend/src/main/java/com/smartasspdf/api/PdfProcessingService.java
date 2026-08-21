package com.smartasspdf.api;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdfwriter.compress.CompressParameters;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xslf.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

@Service
public class PdfProcessingService {

  public Path merge(List<Path> inputs, Path outDir) throws IOException {
    if (inputs.size() < 2) throw new IllegalArgumentException("Select at least two PDF files to merge.");
    inputs.forEach(this::assertPdf);
    String base = extractBaseName(inputs.get(0), "merged");
    Path out = outDir.resolve(base + "_merged.pdf");
    PDFMergerUtility merger = new PDFMergerUtility();
    for (Path p : inputs) {
      merger.addSource(p.toFile());
    }
    merger.setDestinationFileName(out.toAbsolutePath().toString());
    merger.mergeDocuments(IOUtils.createMemoryOnlyStreamCache());
    return out;
  }

  public Path split(Path input, String rangesSpec, Path outDir) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    try (PDDocument source = Loader.loadPDF(input.toFile())) {
      int pageCount = source.getNumberOfPages();
      List<int[]> ranges = parseRanges(rangesSpec, pageCount);
      if (ranges.size() == 1) {
        int[] r = ranges.get(0);
        String suffix = r[0] == r[1] ? ("_page_" + r[0]) : ("_pages_" + r[0] + "-" + r[1]);
        Path out = outDir.resolve(base + suffix + ".pdf");
        try (PDDocument result = new PDDocument()) { addRange(source, result, r); result.save(out.toFile()); }
        return out;
      }
      Path zipPath = outDir.resolve(base + "_split_pages.zip");
      try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
        for (int[] range : ranges) {
          try (PDDocument result = new PDDocument()) {
            addRange(source, result, range);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            result.save(buf);
            String name = range[0] == range[1] ? String.format("%s_page_%03d.pdf", base, range[0]) :
                String.format("%s_pages_%03d-%03d.pdf", base, range[0], range[1]);
            zos.putNextEntry(new ZipEntry(name)); zos.write(buf.toByteArray()); zos.closeEntry();
          }
        }
      }
      return zipPath;
    }
  }

  public Path compress(Path input, Path outDir, float quality) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    float q = Math.max(0.15f, Math.min(0.9f, quality));
    Path out = outDir.resolve(base + "_compressed.pdf");

    if (runBridgeConverterCompress(input, out, q)) {
      return out;
    }

    int maxDimension = q <= 0.35f ? 1000 : (q <= 0.6f ? 1400 : 1800);

    try (PDDocument doc = Loader.loadPDF(input.toFile())) {
      if (doc.getDocumentCatalog() != null) {
        doc.getDocumentCatalog().setMetadata(null);
      }

      Set<PDResources> visited = new HashSet<>();
      for (PDPage page : doc.getPages()) {
        compressResources(doc, page.getResources(), q, maxDimension, visited);
      }

      doc.save(out.toFile(), CompressParameters.DEFAULT_COMPRESSION);

      if (Files.exists(out) && Files.size(out) > Files.size(input)) {
        Files.delete(out);
        Files.copy(input, out);
      }
      return out;
    }
  }

  private boolean runBridgeConverterCompress(Path input, Path output, float quality) {
    List<String> pythonExecutables = List.of(
        "C:\\Users\\syedf\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
        "python",
        "python3",
        "py"
    );

    Path scriptPath = Path.of("scripts", "converter.py");
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("..", "backend", "scripts", "converter.py");
    }

    if (!Files.exists(scriptPath)) {
      return false;
    }

    for (String py : pythonExecutables) {
      try {
        ProcessBuilder pb = new ProcessBuilder(
            py,
            scriptPath.toAbsolutePath().toString(),
            "compress-pdf",
            input.toAbsolutePath().toString(),
            output.toAbsolutePath().toString(),
            "--quality",
            String.valueOf(quality)
        );
        pb.redirectErrorStream(true);
        Process p = pb.start();
        boolean finished = p.waitFor(60, TimeUnit.SECONDS);
        if (finished && p.exitValue() == 0 && Files.exists(output) && Files.size(output) > 0) {
          return true;
        }
      } catch (Exception ignored) {}
    }
    return false;
  }

  public Path rotate(Path input, Path outDir, int angle) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    int normalized = ((angle % 360) + 360) % 360;
    if (normalized != 90 && normalized != 180 && normalized != 270)
      throw new IllegalArgumentException("Rotation must be 90, 180 or 270 degrees.");
    try (PDDocument doc = Loader.loadPDF(input.toFile())) {
      for (PDPage page : doc.getPages()) page.setRotation((page.getRotation() + normalized) % 360);
      Path out = outDir.resolve(base + "_rotated.pdf"); doc.save(out.toFile()); return out;
    }
  }

  public Path addPageNumbers(Path input, Path outDir, String position) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    String pos = position == null ? "bottom-center" : position;
    try (PDDocument doc = Loader.loadPDF(input.toFile())) {
      int total = doc.getNumberOfPages();
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      for (int i = 0; i < total; i++) {
        PDPage page = doc.getPage(i);
        PDRectangle box = page.getMediaBox();
        float textWidth = font.getStringWidth((i + 1) + " / " + total) / 1000f * 9f;
        float x = switch (pos) {
          case "bottom-right" -> box.getWidth() - textWidth - 30;
          case "bottom-left" -> 30;
          default -> (box.getWidth() - textWidth) / 2f;
        };
        try (PDPageContentStream cs = new PDPageContentStream(doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
          cs.beginText(); cs.setFont(font, 9); cs.newLineAtOffset(x, 20);
          cs.showText((i + 1) + " / " + total); cs.endText();
        }
      }
      Path out = outDir.resolve(base + "_numbered.pdf"); doc.save(out.toFile()); return out;
    }
  }

  public Path protect(Path input, Path outDir, String password) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    if (password == null || password.isBlank()) throw new IllegalArgumentException("Enter a password.");
    try (PDDocument doc = Loader.loadPDF(input.toFile())) {
      AccessPermission permissions = new AccessPermission();
      permissions.setCanPrint(true);
      permissions.setCanExtractContent(false);
      StandardProtectionPolicy policy = new StandardProtectionPolicy(password, password, permissions);
      policy.setEncryptionKeyLength(256);
      doc.protect(policy);
      Path out = outDir.resolve(base + "_protected.pdf"); doc.save(out.toFile()); return out;
    }
  }

  public Path unlock(Path input, Path outDir, String password) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    if (password == null) throw new IllegalArgumentException("Enter the PDF password.");
    try (PDDocument doc = Loader.loadPDF(input.toFile(), password)) {
      Path out = outDir.resolve(base + "_unlocked.pdf"); doc.setAllSecurityToBeRemoved(true); doc.save(out.toFile()); return out;
    } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException e) {
      throw new IllegalArgumentException("The password is incorrect.");
    }
  }

  public Path pdfToJpg(Path input, Path outDir, int dpi) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    int safeDpi = Math.max(72, Math.min(300, dpi));
    try (PDDocument doc = Loader.loadPDF(input.toFile())) {
      PDFRenderer renderer = new PDFRenderer(doc);
      if (doc.getNumberOfPages() == 1) {
        BufferedImage image = renderer.renderImageWithDPI(0, safeDpi, ImageType.RGB);
        Path out = outDir.resolve(base + ".jpg"); ImageIO.write(image, "JPEG", out.toFile()); return out;
      }
      Path zip = outDir.resolve(base + "_jpg_pages.zip");
      try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zip))) {
        for (int i = 0; i < doc.getNumberOfPages(); i++) {
          BufferedImage image = renderer.renderImageWithDPI(i, safeDpi, ImageType.RGB);
          ByteArrayOutputStream bytes = new ByteArrayOutputStream(); ImageIO.write(image, "JPEG", bytes);
          zos.putNextEntry(new ZipEntry(String.format("%s_page_%03d.jpg", base, i + 1)));
          zos.write(bytes.toByteArray()); zos.closeEntry();
        }
      }
      return zip;
    }
  }

  public Path imagesToPdf(List<Path> inputs, Path outDir) throws IOException {
    if (inputs.isEmpty()) throw new IllegalArgumentException("Select at least one image.");
    String base = extractBaseName(inputs.get(0), "images");
    Path out = outDir.resolve(base + ".pdf");
    try (PDDocument doc = new PDDocument()) {
      for (Path input : inputs) {
        BufferedImage image;
        try { image = ImageIO.read(input.toFile()); } catch (Exception e) { image = null; }
        if (image == null) throw new IllegalArgumentException("Unsupported image: " + input.getFileName());
        PDPage page = new PDPage(PDRectangle.A4); doc.addPage(page);
        PDImageXObject x = JPEGFactory.createFromImage(doc, image, 0.92f);
        float maxW = page.getMediaBox().getWidth() - 40, maxH = page.getMediaBox().getHeight() - 40;
        float scale = Math.min(maxW / image.getWidth(), maxH / image.getHeight());
        float w = image.getWidth() * scale, h = image.getHeight() * scale;
        try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
          cs.drawImage(x, (page.getMediaBox().getWidth() - w) / 2, (page.getMediaBox().getHeight() - h) / 2, w, h);
        }
      }
      doc.save(out.toFile());
    }
    return out;
  }

  /**
   * Convert PNG/JPG/JPEG images to modern compressed WebP format
   */
  public Path imageToWebp(List<Path> inputs, Path outDir, float quality) throws IOException {
    if (inputs.isEmpty()) throw new IllegalArgumentException("Select at least one image.");
    float q = quality > 1.0f ? quality / 100.0f : quality;
    q = Math.max(0.05f, Math.min(1.0f, q));

    if (inputs.size() == 1) {
      Path input = inputs.get(0);
      assertExtension(input, ".png", ".jpg", ".jpeg");
      String base = extractBaseName(input, "image");
      Path out = outDir.resolve(base + ".webp");
      if (runBridgeConverterWebp(input, out, q)) {
        return out;
      }
      BufferedImage img = ImageIO.read(input.toFile());
      if (img == null) throw new IllegalArgumentException("Unsupported image format.");
      ImageIO.write(img, "png", out.toFile());
      return out;
    }

    String base = extractBaseName(inputs.get(0), "images");
    Path zipPath = outDir.resolve(base + "_webp_images.zip");
    try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
      for (int i = 0; i < inputs.size(); i++) {
        Path input = inputs.get(i);
        assertExtension(input, ".png", ".jpg", ".jpeg");
        String imgBase = extractBaseName(input, "image_" + (i + 1));
        Path tempWebp = outDir.resolve(UUID.randomUUID() + "-" + imgBase + ".webp");
        if (runBridgeConverterWebp(input, tempWebp, q)) {
          zos.putNextEntry(new ZipEntry(imgBase + ".webp"));
          zos.write(Files.readAllBytes(tempWebp));
          zos.closeEntry();
          Files.deleteIfExists(tempWebp);
        } else {
          BufferedImage img = ImageIO.read(input.toFile());
          if (img != null) {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            zos.putNextEntry(new ZipEntry(imgBase + ".webp"));
            zos.write(baos.toByteArray());
            zos.closeEntry();
          }
        }
      }
    }
    return zipPath;
  }

  public Path pdfToWord(Path input, Path outDir) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + ".docx");

    if (runBridgeConverter("pdf-to-word", input, out)) {
      return out;
    }

    PDFTextStripper stripper = new PDFTextStripper();
    try (PDDocument doc = Loader.loadPDF(input.toFile()); XWPFDocument word = new XWPFDocument()) {
      for (int p = 1; p <= doc.getNumberOfPages(); p++) {
        stripper.setStartPage(p); stripper.setEndPage(p);
        String text = stripper.getText(doc);
        for (String line : text.split("\\R")) if (!line.isBlank()) word.createParagraph().createRun().setText(line);
        if (p < doc.getNumberOfPages()) word.createParagraph().createRun().addBreak(BreakType.PAGE);
      }
      try (var os = Files.newOutputStream(out)) { word.write(os); }
    }
    return out;
  }

  public Path pdfToExcel(Path input, Path outDir) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + ".xlsx");

    if (runBridgeConverter("pdf-to-excel", input, out)) {
      return out;
    }

    PDFTextStripper stripper = new PDFTextStripper();
    try (PDDocument doc = Loader.loadPDF(input.toFile()); Workbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
      Sheet sheet = wb.createSheet("PDF text");
      int rowNo = 0;
      for (int p = 1; p <= doc.getNumberOfPages(); p++) {
        stripper.setStartPage(p); stripper.setEndPage(p);
        for (String line : stripper.getText(doc).split("\\R")) {
          if (line.isBlank()) continue;
          Row row = sheet.createRow(rowNo++); row.createCell(0).setCellValue(line);
        }
      }
      sheet.autoSizeColumn(0);
      try (var os = Files.newOutputStream(out)) { wb.write(os); }
    }
    return out;
  }

  public Path pdfToPpt(Path input, Path outDir) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + ".pptx");

    try (PDDocument doc = Loader.loadPDF(input.toFile()); XMLSlideShow ppt = new XMLSlideShow()) {
      PDFRenderer renderer = new PDFRenderer(doc);

      for (int p = 0; p < doc.getNumberOfPages(); p++) {
        PDPage page = doc.getPage(p);
        float w = page.getMediaBox().getWidth();
        float h = page.getMediaBox().getHeight();

        ppt.setPageSize(new java.awt.Dimension((int) w, (int) h));
        XSLFSlide slide = ppt.createSlide();

        BufferedImage pageImage = renderer.renderImageWithDPI(p, 150, ImageType.RGB);
        ByteArrayOutputStream imgBytes = new ByteArrayOutputStream();
        ImageIO.write(pageImage, "PNG", imgBytes);

        XSLFPictureData picData = ppt.addPicture(imgBytes.toByteArray(), org.apache.poi.sl.usermodel.PictureData.PictureType.PNG);
        XSLFPictureShape picShape = slide.createPicture(picData);
        picShape.setAnchor(new Rectangle2D.Double(0, 0, w, h));
      }

      try (var os = Files.newOutputStream(out)) {
        ppt.write(os);
      }
    }
    return out;
  }

  public Path wordToPdf(Path input, Path outDir) throws IOException {
    assertExtension(input, ".docx");
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + ".pdf");

    if (runBridgeConverter("word-to-pdf", input, out)) {
      return out;
    }

    try (XWPFDocument word = new XWPFDocument(Files.newInputStream(input)); PDDocument pdf = new PDDocument()) {
      PDPage page = new PDPage(PDRectangle.A4); pdf.addPage(page);
      PDPageContentStream cs = new PDPageContentStream(pdf, page);
      float y = 760;
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      for (IBodyElement el : word.getBodyElements()) {
        String text = el instanceof XWPFParagraph p ? p.getText() : el instanceof XWPFTable t ? tableText(t) : "";
        if (text.isBlank()) continue;
        for (String line : wrap(text, 95)) {
          if (y < 45) { cs.close(); page = new PDPage(PDRectangle.A4); pdf.addPage(page); cs = new PDPageContentStream(pdf, page); y = 760; }
          cs.beginText(); cs.setFont(font, 10); cs.newLineAtOffset(40, y); cs.showText(safePdfText(line)); cs.endText(); y -= 16;
        }
        y -= 5;
      }
      cs.close(); pdf.save(out.toFile());
    }
    return out;
  }

  public Path excelToPdf(Path input, Path outDir) throws IOException {
    assertExtension(input, ".xlsx", ".xls");
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + ".pdf");

    if (runBridgeConverter("excel-to-pdf", input, out)) {
      return out;
    }

    try (Workbook wb = WorkbookFactory.create(input.toFile()); PDDocument pdf = new PDDocument()) {
      for (Sheet sheet : wb) {
        PDPage page = new PDPage(PDRectangle.A4); pdf.addPage(page);
        PDPageContentStream cs = new PDPageContentStream(pdf, page);
        PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        float y = 760;
        for (Row row : sheet) {
          StringBuilder line = new StringBuilder();
          for (Cell cell : row) { if (line.length() > 0) line.append(" | "); line.append(cell.toString()); }
          for (String part : wrap(line.toString(), 95)) {
            if (y < 45) { cs.close(); page = new PDPage(PDRectangle.A4); pdf.addPage(page); cs = new PDPageContentStream(pdf, page); y = 760; }
            cs.beginText(); cs.setFont(font, 9); cs.newLineAtOffset(35, y); cs.showText(safePdfText(part)); cs.endText(); y -= 14;
          }
        }
        cs.close();
      }
      pdf.save(out.toFile());
    }
    return out;
  }

  public Path htmlToPdf(Path input, Path outDir) throws IOException {
    assertExtension(input, ".html", ".htm");
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + ".pdf");

    if (runBridgeConverter("html-to-pdf", input, out)) {
      return out;
    }

    try (var os = Files.newOutputStream(out)) {
      com.openhtmltopdf.pdfboxout.PdfRendererBuilder builder = new com.openhtmltopdf.pdfboxout.PdfRendererBuilder();
      builder.useFastMode();
      builder.withFile(input.toFile());
      builder.toStream(os);
      builder.run();
      if (Files.exists(out) && Files.size(out) > 0) {
        return out;
      }
    } catch (Exception ignored) {}

    return out;
  }

  public Path addWatermark(Path input, Path outDir, String text, Float opacity, Integer rotation, Integer fontSize, String color) throws IOException {
    assertPdf(input);
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + "-watermarked.pdf");

    String watermarkText = (text == null || text.isBlank()) ? "CONFIDENTIAL" : text.trim();
    float op = opacity == null ? 0.3f : Math.max(0.05f, Math.min(1.0f, opacity));
    int rot = rotation == null ? 45 : rotation;
    int size = fontSize == null ? 40 : Math.max(10, Math.min(120, fontSize));
    String col = (color == null || color.isBlank()) ? "gray" : color.trim();

    if (runBridgeConverterWatermark(input, out, watermarkText, op, rot, size, col)) {
      return out;
    }

    try (PDDocument doc = Loader.loadPDF(input.toFile())) {
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
      for (PDPage page : doc.getPages()) {
        try (PDPageContentStream cs = new PDPageContentStream(doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
          cs.setNonStrokingColor(0.6f, 0.6f, 0.6f);
          cs.beginText();
          cs.setFont(font, size);
          float x = page.getMediaBox().getWidth() / 4;
          float y = page.getMediaBox().getHeight() / 2;
          cs.setTextMatrix(org.apache.pdfbox.util.Matrix.getRotateInstance(Math.toRadians(rot), x, y));
          cs.showText(safePdfText(watermarkText));
          cs.endText();
        }
      }
      doc.save(out.toFile());
    }
    return out;
  }

  public Path removePages(Path input, Path outDir, String pages) throws IOException {
    assertPdf(input);
    if (pages == null || pages.isBlank()) throw new IllegalArgumentException("Specify page numbers to remove (e.g. 1,3,5-7).");
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + "-pages-removed.pdf");

    if (runBridgeConverterPages("remove-pages", input, out, pages)) {
      return out;
    }

    try (PDDocument src = Loader.loadPDF(input.toFile()); PDDocument result = new PDDocument()) {
      int total = src.getNumberOfPages();
      List<int[]> ranges = parseRanges(pages, total);
      Set<Integer> deleteSet = new HashSet<>();
      for (int[] r : ranges) {
        for (int p = r[0]; p <= r[1]; p++) deleteSet.add(p);
      }
      if (deleteSet.size() >= total) {
        throw new IllegalArgumentException("Cannot remove all pages from PDF. At least one page must remain.");
      }
      for (int p = 1; p <= total; p++) {
        if (!deleteSet.contains(p)) {
          result.importPage(src.getPage(p - 1));
        }
      }
      result.save(out.toFile());
    }
    return out;
  }

  public Path extractPages(Path input, Path outDir, String pages) throws IOException {
    assertPdf(input);
    if (pages == null || pages.isBlank()) throw new IllegalArgumentException("Specify page numbers to extract (e.g. 1-3,5).");
    String base = extractBaseName(input, "document");
    Path out = outDir.resolve(base + "-extracted.pdf");

    if (runBridgeConverterPages("extract-pages", input, out, pages)) {
      return out;
    }

    try (PDDocument src = Loader.loadPDF(input.toFile()); PDDocument result = new PDDocument()) {
      int total = src.getNumberOfPages();
      List<int[]> ranges = parseRanges(pages, total);
      for (int[] r : ranges) {
        addRange(src, result, r);
      }
      result.save(out.toFile());
    }
    return out;
  }

  private boolean runBridgeConverterWatermark(Path input, Path output, String text, float opacity, int rotation, int fontSize, String color) {
    List<String> pythonExecutables = List.of(
        "C:\\Users\\syedf\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
        "python",
        "python3",
        "py"
    );

    Path scriptPath = Path.of("scripts", "converter.py");
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("..", "backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      return false;
    }

    for (String py : pythonExecutables) {
      try {
        ProcessBuilder pb = new ProcessBuilder(
            py,
            scriptPath.toAbsolutePath().toString(),
            "add-watermark",
            input.toAbsolutePath().toString(),
            output.toAbsolutePath().toString(),
            "--text", text,
            "--opacity", String.valueOf(opacity),
            "--rotation", String.valueOf(rotation),
            "--fontsize", String.valueOf(fontSize),
            "--color", color
        );
        pb.redirectErrorStream(true);
        Process p = pb.start();
        boolean finished = p.waitFor(30, TimeUnit.SECONDS);
        if (finished && p.exitValue() == 0 && Files.exists(output) && Files.size(output) > 0) {
          return true;
        }
      } catch (Exception ignored) {}
    }
    return false;
  }

  private boolean runBridgeConverterPages(String mode, Path input, Path output, String pages) {
    List<String> pythonExecutables = List.of(
        "C:\\Users\\syedf\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
        "python",
        "python3",
        "py"
    );

    Path scriptPath = Path.of("scripts", "converter.py");
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("..", "backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      return false;
    }

    for (String py : pythonExecutables) {
      try {
        ProcessBuilder pb = new ProcessBuilder(
            py,
            scriptPath.toAbsolutePath().toString(),
            mode,
            input.toAbsolutePath().toString(),
            output.toAbsolutePath().toString(),
            "--pages", pages
        );
        pb.redirectErrorStream(true);
        Process p = pb.start();
        boolean finished = p.waitFor(30, TimeUnit.SECONDS);
        if (finished && p.exitValue() == 0 && Files.exists(output) && Files.size(output) > 0) {
          return true;
        }
      } catch (Exception ignored) {}
    }
    return false;
  }

  private boolean runBridgeConverterWebp(Path input, Path output, float quality) {
    List<String> pythonExecutables = List.of(
        "C:\\Users\\syedf\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
        "python",
        "python3",
        "py"
    );

    Path scriptPath = Path.of("scripts", "converter.py");
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("..", "backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      return false;
    }

    for (String py : pythonExecutables) {
      try {
        ProcessBuilder pb = new ProcessBuilder(
            py,
            scriptPath.toAbsolutePath().toString(),
            "image-to-webp",
            input.toAbsolutePath().toString(),
            output.toAbsolutePath().toString(),
            "--quality",
            String.valueOf((int) (quality * 100))
        );
        pb.redirectErrorStream(true);
        Process p = pb.start();
        boolean finished = p.waitFor(30, TimeUnit.SECONDS);
        if (finished && p.exitValue() == 0 && Files.exists(output) && Files.size(output) > 0) {
          return true;
        }
      } catch (Exception ignored) {}
    }
    return false;
  }

  private boolean runBridgeConverter(String mode, Path input, Path output) {
    List<String> pythonExecutables = List.of(
        "C:\\Users\\syedf\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
        "python",
        "python3",
        "py"
    );

    Path scriptPath = Path.of("scripts", "converter.py");
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("backend", "scripts", "converter.py");
    }
    if (!Files.exists(scriptPath)) {
      scriptPath = Path.of("..", "backend", "scripts", "converter.py");
    }

    if (!Files.exists(scriptPath)) {
      return false;
    }

    for (String py : pythonExecutables) {
      try {
        ProcessBuilder pb = new ProcessBuilder(
            py,
            scriptPath.toAbsolutePath().toString(),
            mode,
            input.toAbsolutePath().toString(),
            output.toAbsolutePath().toString()
        );
        pb.redirectErrorStream(true);
        Process p = pb.start();
        boolean finished = p.waitFor(60, TimeUnit.SECONDS);
        if (finished && p.exitValue() == 0 && Files.exists(output) && Files.size(output) > 0) {
          return true;
        }
      } catch (Exception ignored) {}
    }
    return false;
  }

  private String extractBaseName(Path input, String fallback) {
    if (input == null) return fallback;
    String name = input.getFileName().toString();
    if (name.length() > 37 && name.charAt(36) == '-') {
      String possibleUuid = name.substring(0, 36);
      if (possibleUuid.matches("^[0-9a-fA-F\\-]{36}$")) {
        name = name.substring(37);
      }
    }
    int dot = name.lastIndexOf('.');
    if (dot > 0) name = name.substring(0, dot);
    return name.isBlank() ? fallback : name;
  }

  private String tableText(XWPFTable t) {
    StringBuilder s = new StringBuilder();
    for (XWPFTableRow r : t.getRows()) { for (XWPFTableCell c : r.getTableCells()) { if (s.length() > 0) s.append(" | "); s.append(c.getText()); } s.append('\n'); }
    return s.toString();
  }

  private List<String> wrap(String text, int max) {
    List<String> lines = new ArrayList<>();
    for (String paragraph : text.split("\\R")) {
      String[] words = paragraph.trim().split("\\s+"); StringBuilder line = new StringBuilder();
      for (String word : words) {
        if (line.length() + word.length() + 1 > max && line.length() > 0) { lines.add(line.toString()); line.setLength(0); }
        if (line.length() > 0) line.append(' '); line.append(word);
      }
      if (line.length() > 0) lines.add(line.toString());
    }
    return lines;
  }

  private String safePdfText(String s) { return s.replaceAll("[^\\x20-\\x7E]", "?"); }

  private void addRange(PDDocument source, PDDocument result, int[] range) throws IOException {
    for (int i = range[0] - 1; i <= range[1] - 1; i++) result.importPage(source.getPage(i));
  }

  private List<int[]> parseRanges(String spec, int pageCount) {
    List<int[]> result = new ArrayList<>();
    if (spec == null || spec.isBlank()) { for (int p = 1; p <= pageCount; p++) result.add(new int[]{p,p}); return result; }
    for (String part : spec.split(",")) {
      part = part.trim(); if (part.isEmpty()) continue;
      int start, end;
      try { if (part.contains("-")) { String[] b=part.split("-",2); start=Integer.parseInt(b[0].trim()); end=Integer.parseInt(b[1].trim()); } else start=end=Integer.parseInt(part); }
      catch(NumberFormatException e){ throw new IllegalArgumentException("Invalid page range: \""+part+"\""); }
      if(start<1 || end>pageCount || start>end) throw new IllegalArgumentException("Invalid page range: \""+part+"\" (document has "+pageCount+" pages)");
      result.add(new int[]{start,end});
    }
    if(result.isEmpty()) throw new IllegalArgumentException("No valid page ranges provided.");
    return result;
  }

  private void compressResources(PDDocument doc, PDResources resources, float quality, int maxDimension, Set<PDResources> visited) throws IOException {
    if (resources == null || !visited.add(resources)) return;
    List<COSName> names = new ArrayList<>();
    resources.getXObjectNames().forEach(names::add);

    for (COSName name : names) {
      PDXObject xobj;
      try { xobj = resources.getXObject(name); } catch (IOException e) { continue; }

      if (xobj instanceof PDImageXObject img) {
        if ((long) img.getWidth() * img.getHeight() < 1024) continue;
        try {
          BufferedImage buffered = img.getImage();
          int w = buffered.getWidth();
          int h = buffered.getHeight();

          if (w > maxDimension || h > maxDimension) {
            float scale = Math.min((float) maxDimension / w, (float) maxDimension / h);
            int newW = Math.max(1, Math.round(w * scale));
            int newH = Math.max(1, Math.round(h * scale));

            BufferedImage resized = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = resized.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(buffered, 0, 0, newW, newH, null);
            g.dispose();
            buffered = resized;
          }

          PDImageXObject newImg = JPEGFactory.createFromImage(doc, buffered, quality);
          resources.put(name, newImg);
        } catch (Exception ignored) {}
      } else if (xobj instanceof PDFormXObject form) {
        compressResources(doc, form.getResources(), quality, maxDimension, visited);
      }
    }
  }

  private void assertPdf(Path p){ assertExtension(p, ".pdf"); }
  private void assertExtension(Path p, String... exts){
    String name=p.getFileName().toString().toLowerCase(Locale.ROOT);
    for(String ext:exts) if(name.endsWith(ext)) return;
    throw new IllegalArgumentException("\""+p.getFileName()+"\" has an unsupported file type.");
  }
}
