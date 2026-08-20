package com.smartasspdf.api;
import java.io.IOException;
import java.nio.file.*;
import java.time.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
@Service
public class FileCleanupService {
  private final JobStore store;
  @Value("${smartasspdf.retention-minutes:30}") long retentionMinutes;
  public FileCleanupService(JobStore store){this.store=store;}
  @Scheduled(fixedDelay=300000)
  public void cleanup(){
    Instant cutoff=Instant.now().minus(Duration.ofMinutes(retentionMinutes));
    store.all().values().forEach(job->{
      if(job.createdAt().isBefore(cutoff)){ deleteTree(job.dir()); store.remove(job.id()); }
    });
  }
  public void deleteTree(Path dir){
    if(dir==null)return;
    try(var walk=Files.walk(dir)){walk.sorted((a,b)->b.compareTo(a)).forEach(p->{try{Files.deleteIfExists(p);}catch(IOException ignored){}});}
    catch(IOException ignored){}
  }
}
