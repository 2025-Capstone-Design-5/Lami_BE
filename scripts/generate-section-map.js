const fs = require('fs');
const path = require('path');

// CSV 파일 경로
const csvPath = path.resolve(__dirname, '../nodelink/본선도로구간(sectionId) (2)(본선도로구간).csv');
// 출력될 TS 파일 경로
const outPath = path.resolve(__dirname, '../src/traffic/its/section-map.ts');

// CSV 읽기
const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.trim().split('\n').slice(1);

const map = {};
lines.forEach(line => {
  const [id, sido, sigungu] = line.split(',');
  if (!map[id]) map[id] = [];
  // 중복 방지
  if (!map[id].some(r => r.sido === sido && r.sigungu === sigungu)) {
    map[id].push({ sido, sigungu });
  }
});

// TS 파일 내용 생성
const content = `export const SECTION_INFO: Record<string, { sido: string; sigungu: string }[]> = ${JSON.stringify(map, null, 2)};\n`;

// 기존 파일 덮어쓰기
fs.writeFileSync(outPath, content, 'utf8');
console.log('✅ section-map.ts가 생성되었습니다:', outPath); 