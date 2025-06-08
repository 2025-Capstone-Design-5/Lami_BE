import axios from 'axios';
import { DynamicTool } from 'langchain/tools';

export const SavedRouteTool = new DynamicTool({
  name: 'saved_route_info',
  description:
    '유저가 저장한 경로 ID로 실시간 상세 정보를 조회합니다. 입력은 routeId 프로퍼티를 가진 JSON 문자열입니다.',
  func: async (input: string) => {
    let raw = input;
    try {
      const maybe = JSON.parse(input);
      if (maybe && typeof maybe === 'object' && 'input' in maybe) {
        raw = (maybe as any).input;
      }
    } catch {}
    const { routeId } = JSON.parse(raw) as { routeId: string };
    const baseUrl =
      process.env.API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
    const res = await axios.get(`${baseUrl}/traffic/routes/${routeId}/details`);
    return JSON.stringify(res.data);
  },
});
