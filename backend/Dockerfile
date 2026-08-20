# SmartAssPDF backend - simple production image
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests clean package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
ENV PORT=8080
ENV RETENTION_MINUTES=30
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
