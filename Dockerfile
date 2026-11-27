FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts metadata.json ./
COPY src ./src
COPY server.ts ./
COPY server ./server
COPY android-companion ./android-companion

RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV TZ=Asia/Kuala_Lumpur

EXPOSE 8080

CMD ["npm", "start"]
