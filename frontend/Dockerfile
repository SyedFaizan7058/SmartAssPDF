FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80


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