package com.smartasspdf.api;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  @Override public void addCorsMappings(CorsRegistry registry){
    registry.addMapping("/**")
      .allowedOriginPatterns("*")
      .allowedMethods("GET","POST","PUT","DELETE","OPTIONS","HEAD")
      .allowedHeaders("*")
      .exposedHeaders("Content-Disposition", "Content-Type", "Content-Length")
      .allowCredentials(false);
  }
}
