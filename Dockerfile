FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

COPY package.json ./
RUN npm install

COPY script.js /app/script.js

VOLUME /app

ENV BASIC_AUTH_USERNAME="xxxxxxxx"
ENV BASIC_AUTH_PASSWORD="xxxxxx"

ENTRYPOINT ["node", "/app/script.js", "/app/urls.json"]
