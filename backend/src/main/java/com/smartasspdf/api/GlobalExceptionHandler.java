package com.smartasspdf.api;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(Exception.class)
  public ResponseEntity<?> handle(Exception ex){
    ex.printStackTrace();
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(Map.of("code","INTERNAL_ERROR","message",ex.getMessage() == null ? "Something went wrong while processing the request." : ex.getMessage()));
  }
}
