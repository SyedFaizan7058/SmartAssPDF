package com.smartasspdf.api;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class JobStore {

  public enum Status { PROCESSING, DONE, ERROR }

  /** A conversion job. Input files live under dir(); once processing finishes the
   *  result (if any) is recorded on the same job so it can be downloaded later. */
  public static final class Job {
    private final String id;
    private final String tool;
    private final Path dir;
    private final Instant createdAt;
    private volatile Status status = Status.PROCESSING;
    private volatile Path resultFile;
    private volatile String resultFilename;
    private volatile String contentType;
    private volatile String errorMessage;

    Job(String id, String tool, Path dir, Instant createdAt) {
      this.id = id; this.tool = tool; this.dir = dir; this.createdAt = createdAt;
    }

    public String id() { return id; }
    public String tool() { return tool; }
    public Path dir() { return dir; }
    public Instant createdAt() { return createdAt; }
    public Status status() { return status; }
    public Path resultFile() { return resultFile; }
    public String resultFilename() { return resultFilename; }
    public String contentType() { return contentType; }
    public String errorMessage() { return errorMessage; }

    synchronized void markDone(Path resultFile, String resultFilename, String contentType) {
      this.resultFile = resultFile;
      this.resultFilename = resultFilename;
      this.contentType = contentType;
      this.status = Status.DONE;
    }

    synchronized void markError(String message) {
      this.errorMessage = message;
      this.status = Status.ERROR;
    }
  }

  private final Map<String, Job> jobs = new ConcurrentHashMap<>();

  public Job create(String tool) throws Exception {
    String id = UUID.randomUUID().toString();
    Path dir = Files.createTempDirectory("smartasspdf-" + id + "-");
    Job j = new Job(id, tool, dir, Instant.now());
    jobs.put(id, j);
    return j;
  }

  public Job get(String id) { return jobs.get(id); }
  public void remove(String id) { jobs.remove(id); }
  public Map<String, Job> all() { return jobs; }
}
