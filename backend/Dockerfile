# Multi-stage Dockerfile for SmartAssPDF Backend
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Install Python 3, pip, LibreOffice headless, fonts, OCR and PDF repair tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    tesseract-ocr \
    tesseract-ocr-eng \
    qpdf \
    default-jre-headless \
    fonts-dejavu \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install required Python packages for high-fidelity conversion, OCR & compression
RUN pip3 install --no-cache-dir \
    pymupdf \
    python-docx \
    pdf2docx \
    openpyxl \
    tabula-py \
    pandas \
    pillow \
    pypdf \
    pytesseract

# Copy built JAR and Python converter script
COPY --from=build /workspace/target/*.jar app.jar
COPY scripts ./scripts

ENV PORT=8080
ENV CORS_ORIGIN=*
ENV RETENTION_MINUTES=30
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx220m -XX:+UseSerialGC"

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
