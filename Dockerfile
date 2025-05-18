# Stage 1: Build 단계
FROM node:18-alpine AS builder
WORKDIR /app

# package.json 설치
COPY package*.json ./
RUN npm install

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# Stage 2: Production 단계
FROM node:18-alpine
# timezone 설정
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul
RUN cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime && echo "Asia/Seoul" > /etc/timezone
WORKDIR /app

# 빌드 아티팩트와 의존성 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 포트 설정 및 실행
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main"] 