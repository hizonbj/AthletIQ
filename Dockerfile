# ---- build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -e -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -e -DskipTests package

# ---- runtime stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/app.jar app.jar
EXPOSE 8080
# DB_URL, DB_USER, DB_PASSWORD are injected as env vars at run time.
ENTRYPOINT ["java","-jar","/app/app.jar"]
