import axios from 'axios';
import { DynamicTool } from 'langchain/tools';

export const TrafficTool = new DynamicTool({
  name: 'traffic_routes',
  description:
    '교통 경로를 조회합니다. 입력은 fromAddress, toAddress, date, time 프로퍼티를 가진 JSON 문자열입니다.',
  func: async (input: string) => {
    // DynamicTool이 { input: string } 형태로 감싸서 전달할 수 있으므로, 실제 JSON 문자열을 추출
    let raw = input;
    try {
      const maybe = JSON.parse(input);
      if (maybe && typeof maybe === 'object' && 'input' in maybe) {
        raw = (maybe as any).input;
      }
    } catch {
      // 그대로 사용
    }
    // 파라미터를 JSON 문자열로 전달받아 파싱 (출발 시간 기준으로만 조회)
    const { fromAddress, toAddress, date, time } = JSON.parse(raw) as {
      fromAddress: string;
      toAddress: string;
      date?: string;
      time?: string;
    };
    const params = { fromAddress, toAddress, date, time };
    const baseUrl =
      process.env.API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
    try {
      const res = await axios.post(`${baseUrl}/traffic/routes`, params, {
        headers: { 'Content-Type': 'application/json' },
      });
      return JSON.stringify(res.data);
    } catch (err: any) {
      // 오류 발생 시 빈 결과 대신 메시지 반환
      return JSON.stringify({
        error: '교통 경로 조회 중 오류가 발생했습니다.',
      });
    }
  },
});
