package com.smartasspdf.api;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class ToolController {
  private static final Set<String> TOOLS = Set.of(
      "pdf-to-word","pdf-to-excel","pdf-to-jpg","pdf-to-ppt","word-to-pdf","excel-to-pdf",
      "image-to-webp","image-to-pdf","html-to-pdf","merge-pdf","split-pdf","compress-pdf",
      "rotate-pdf","add-page-numbers","protect-pdf","unlock-pdf");

  private static final Set<String> LIVE_TOOLS = TOOLS;

  private final JobStore jobs;
  private final PdfProcessingService pdf;

  public ToolController(JobStore jobs, PdfProcessingService pdf) {
    this.jobs = jobs; this.pdf = pdf;
  }

  @GetMapping("/tools")
  public Map<String,Object> tools(){ return Map.of("tools", TOOLS, "live", LIVE_TOOLS); }

  @PostMapping("/tools/{tool}/jobs")
  public ResponseEntity<?> create(
      @PathVariable String tool,
      @RequestParam("files") List<MultipartFile> files,
      @RequestParam(value="pages", required=false) String pages,
      @RequestParam(value="quality", required=false) Float quality,
      @RequestParam(value="angle", required=false) Integer angle,
      @RequestParam(value="position", required=false) String position,
      @RequestParam(value="password", required=false) String password,
      @RequestParam(value="dpi", required=false) Integer dpi) {

    if(!TOOLS.contains(tool)) return error(HttpStatus.NOT_FOUND,"TOOL_NOT_FOUND","Unknown tool: " + tool);
    if(files==null || files.isEmpty()) return error(HttpStatus.BAD_REQUEST,"NO_FILE","Please upload at least one file.");
    if(files.size()>20) return error(HttpStatus.BAD_REQUEST,"TOO_MANY_FILES","A maximum of 20 files is supported.");

    JobStore.Job job;
    List<Path> saved = new ArrayList<>();
    try{
      job=jobs.create(tool);
      for(MultipartFile f:files){
        if(f.isEmpty()) throw new IllegalArgumentException("Empty files are not supported.");
        if(f.getSize()>50L*1024*1024) throw new IllegalArgumentException("A file exceeds the 50 MB limit.");
        String name=safeName(f.getOriginalFilename());
        Path dest=job.dir().resolve(UUID.randomUUID()+"-"+name);
        f.transferTo(dest); saved.add(dest);
      }
    }catch(IllegalArgumentException e){ return error(HttpStatus.BAD_REQUEST,"INVALID_FILE",e.getMessage()); }
    catch(Exception e){ return error(HttpStatus.INTERNAL_SERVER_ERROR,"PROCESSING_ERROR","The file could not be accepted."); }

    try{
      Path result;
      switch(tool){
        case "merge-pdf" -> result=pdf.merge(saved,job.dir());
        case "split-pdf" -> { requireCount(saved,1,"Split PDF accepts exactly one file."); result=pdf.split(saved.get(0),pages,job.dir()); }
        case "compress-pdf" -> { requireCount(saved,1,"Compress PDF accepts exactly one file."); result=pdf.compress(saved.get(0),job.dir(),quality==null?.5f:quality); }
        case "rotate-pdf" -> { requireCount(saved,1,"Rotate PDF accepts exactly one file."); result=pdf.rotate(saved.get(0),job.dir(),angle==null?90:angle); }
        case "add-page-numbers" -> { requireCount(saved,1,"Add Page Numbers accepts exactly one file."); result=pdf.addPageNumbers(saved.get(0),job.dir(),position); }
        case "protect-pdf" -> { requireCount(saved,1,"Protect PDF accepts exactly one file."); result=pdf.protect(saved.get(0),job.dir(),password); }
        case "unlock-pdf" -> { requireCount(saved,1,"Unlock PDF accepts exactly one file."); result=pdf.unlock(saved.get(0),job.dir(),password); }
        case "pdf-to-jpg" -> { requireCount(saved,1,"PDF to JPG accepts exactly one file."); result=pdf.pdfToJpg(saved.get(0),job.dir(),dpi==null?150:dpi); }
        case "image-to-pdf" -> result=pdf.imagesToPdf(saved,job.dir());
        case "image-to-webp" -> result=pdf.imageToWebp(saved,job.dir(),quality==null?0.85f:quality);
        case "pdf-to-word" -> { requireCount(saved,1,"PDF to Word accepts exactly one file."); result=pdf.pdfToWord(saved.get(0),job.dir()); }
        case "pdf-to-excel" -> { requireCount(saved,1,"PDF to Excel accepts exactly one file."); result=pdf.pdfToExcel(saved.get(0),job.dir()); }
        case "pdf-to-ppt" -> { requireCount(saved,1,"PDF to PowerPoint accepts exactly one file."); result=pdf.pdfToPpt(saved.get(0),job.dir()); }
        case "word-to-pdf" -> { requireCount(saved,1,"Word to PDF accepts exactly one file."); result=pdf.wordToPdf(saved.get(0),job.dir()); }
        case "excel-to-pdf" -> { requireCount(saved,1,"Excel to PDF accepts exactly one file."); result=pdf.excelToPdf(saved.get(0),job.dir()); }
        case "html-to-pdf" -> { requireCount(saved,1,"HTML to PDF accepts exactly one file."); result=pdf.htmlToPdf(saved.get(0),job.dir()); }
        default -> throw new IllegalStateException("Unhandled tool: "+tool);
      }
      String filename=result.getFileName().toString();
      job.markDone(result,filename,contentType(filename));
      return ResponseEntity.ok(Map.of("jobId",job.id(),"tool",tool,"status","done","filename",filename,
          "downloadUrl","/api/v1/jobs/"+job.id()+"/download","previewUrl","/api/v1/jobs/"+job.id()+"/download"));
    }catch(IllegalArgumentException e){
      job.markError(e.getMessage()); return error(HttpStatus.BAD_REQUEST,"INVALID_FILE",e.getMessage());
    }catch(Exception e){
      job.markError("Processing failed.");
      return error(HttpStatus.INTERNAL_SERVER_ERROR,"PROCESSING_ERROR",
          e.getMessage()!=null ? e.getMessage() : "The file could not be processed.");
    }
  }

  @GetMapping("/jobs/{jobId}/download")
  public ResponseEntity<?> download(@PathVariable String jobId){
    JobStore.Job job=jobs.get(jobId);
    if(job==null) return error(HttpStatus.NOT_FOUND,"JOB_NOT_FOUND","This job no longer exists.");
    if(job.status()!=JobStore.Status.DONE || job.resultFile()==null || !Files.exists(job.resultFile()))
      return error(HttpStatus.NOT_FOUND,"RESULT_NOT_READY","No result is available for this job.");
    FileSystemResource resource=new FileSystemResource(job.resultFile());
    return ResponseEntity.ok().contentType(MediaType.parseMediaType(job.contentType()))
        .header(HttpHeaders.CONTENT_DISPOSITION,"inline; filename=\""+job.resultFilename()+"\"")
        .body(resource);
  }

  private void requireCount(List<Path> files,int count,String message){
    if(files.size()!=count) throw new IllegalArgumentException(message);
  }
  private String contentType(String filename){
    String n=filename.toLowerCase(Locale.ROOT);
    if(n.endsWith(".pdf")) return MediaType.APPLICATION_PDF_VALUE;
    if(n.endsWith(".jpg")||n.endsWith(".jpeg")) return MediaType.IMAGE_JPEG_VALUE;
    if(n.endsWith(".png")) return MediaType.IMAGE_PNG_VALUE;
    if(n.endsWith(".webp")) return "image/webp";
    if(n.endsWith(".zip")) return "application/zip";
    if(n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if(n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if(n.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    return MediaType.APPLICATION_OCTET_STREAM_VALUE;
  }
  private ResponseEntity<Map<String,String>> error(HttpStatus status,String code,String message){
    return ResponseEntity.status(status).body(Map.of("code",code,"message",message==null?"Processing failed.":message));
  }
  private String safeName(String name){
    String n=name==null?"file":name.replace("\\","/");
    n=n.substring(n.lastIndexOf('/')+1);
    return n.replaceAll("[^a-zA-Z0-9._-]","_");
  }
}
