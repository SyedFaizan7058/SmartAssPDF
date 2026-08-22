package com.smartasspdf.api;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayOutputStream;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class ToolControllerTest {

  @Autowired
  private MockMvc mockMvc;

  private byte[] samplePdfBytes;

  @BeforeEach
  void setUp() throws Exception {
    try (PDDocument doc = new PDDocument(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
      PDPage page = new PDPage();
      doc.addPage(page);
      try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        cs.newLineAtOffset(50, 700);
        cs.showText("SmartAssPDF automated test document");
        cs.endText();
      }
      doc.save(baos);
      samplePdfBytes = baos.toByteArray();
    }
  }

  @Test
  void testToolsListContainsNewTools() throws Exception {
    mockMvc.perform(get("/api/v1/tools"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tools", org.hamcrest.Matchers.hasItem("ocr-pdf")))
        .andExpect(jsonPath("$.tools", org.hamcrest.Matchers.hasItem("repair-pdf")))
        .andExpect(jsonPath("$.tools", org.hamcrest.Matchers.hasItem("compare-pdf")))
        .andExpect(jsonPath("$.tools", org.hamcrest.Matchers.hasItem("sanitize-pdf")))
        .andExpect(jsonPath("$.tools", org.hamcrest.Matchers.hasItem("sign-pdf")));
  }

  @Test
  void testOcrPdfEndpoint() throws Exception {
    MockMultipartFile file = new MockMultipartFile("files", "test-scan.pdf", "application/pdf", samplePdfBytes);
    mockMvc.perform(multipart("/api/v1/tools/ocr-pdf/jobs")
            .file(file)
            .param("language", "eng"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("done")))
        .andExpect(jsonPath("$.tool", is("ocr-pdf")));
  }

  @Test
  void testRepairPdfEndpoint() throws Exception {
    MockMultipartFile file = new MockMultipartFile("files", "corrupted.pdf", "application/pdf", samplePdfBytes);
    mockMvc.perform(multipart("/api/v1/tools/repair-pdf/jobs")
            .file(file))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("done")))
        .andExpect(jsonPath("$.tool", is("repair-pdf")));
  }

  @Test
  void testComparePdfEndpoint() throws Exception {
    MockMultipartFile file1 = new MockMultipartFile("files", "docA.pdf", "application/pdf", samplePdfBytes);
    MockMultipartFile file2 = new MockMultipartFile("files", "docB.pdf", "application/pdf", samplePdfBytes);
    mockMvc.perform(multipart("/api/v1/tools/compare-pdf/jobs")
            .file(file1)
            .file(file2))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("done")))
        .andExpect(jsonPath("$.tool", is("compare-pdf")));
  }

  @Test
  void testSanitizePdfEndpoint() throws Exception {
    MockMultipartFile file = new MockMultipartFile("files", "private.pdf", "application/pdf", samplePdfBytes);
    mockMvc.perform(multipart("/api/v1/tools/sanitize-pdf/jobs")
            .file(file))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("done")))
        .andExpect(jsonPath("$.tool", is("sanitize-pdf")));
  }

  @Test
  void testSignPdfEndpoint() throws Exception {
    MockMultipartFile file = new MockMultipartFile("files", "contract.pdf", "application/pdf", samplePdfBytes);
    mockMvc.perform(multipart("/api/v1/tools/sign-pdf/jobs")
            .file(file)
            .param("signer", "Test Signer")
            .param("position", "bottom-right"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("done")))
        .andExpect(jsonPath("$.tool", is("sign-pdf")));
  }
}
