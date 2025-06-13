# Stage 1: Build 단계
FROM node:20-alpine AS builder
WORKDIR /app
ENV NPM_CONFIG_LOGLEVEL=error

# package.json 설치 (reproducible, prod-only)
COPY package*.json ./
RUN npm ci --loglevel=error

# NestJS CLI 전역 설치
RUN npm install -g @nestjs/cli

# 소스 복사 및 빌드
COPY . .
RUN npm run build --silent

# Stage 2: Production 단계
FROM node:20-alpine
# slim timezone: add then remove tzdata
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
    && echo "Asia/Seoul" > /etc/timezone \
    && apk del tzdata
ENV TZ=Asia/Seoul
WORKDIR /app

# 빌드 아티팩트와 의존성 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 포트 설정 및 실행
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main"] 