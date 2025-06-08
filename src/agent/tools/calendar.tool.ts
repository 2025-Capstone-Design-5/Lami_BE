import axios from 'axios';
import { DynamicTool } from 'langchain/tools';

export const CalendarTool = new DynamicTool({
  name: 'calendar_events',
  description:
    '사용자의 캘린더 이벤트를 조회합니다. 입력은 userId 프로퍼티를 가진 JSON 문자열입니다.',
  func: async (input: string) => {
    let raw = input;
    try {
      const maybe = JSON.parse(input);
      if (maybe && typeof maybe === 'object' && 'input' in maybe) {
        raw = (maybe as any).input;
      }
    } catch {}
    const { userId } = JSON.parse(raw) as { userId: string };
    const baseUrl =
      process.env.API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
    const res = await axios.get(`${baseUrl}/calendar/events`, {
      params: { userId },
    });
    return JSON.stringify(res.data);
  },
});
