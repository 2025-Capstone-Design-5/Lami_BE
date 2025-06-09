import axios from 'axios';
import { DynamicTool } from 'langchain/tools';

export const FavoritesListTool = new DynamicTool({
  name: 'favorite_routes',
  description:
    '유저가 저장한 즐겨찾기 경로 목록을 조회합니다. 입력은 googleId 프로퍼티를 가진 JSON 문자열입니다.',
  func: async (input: string) => {
    // Parse input JSON to extract googleId
    let raw = input;
    try {
      const maybe = JSON.parse(input);
      if (maybe && typeof maybe === 'object' && 'input' in maybe) {
        raw = (maybe as any).input;
      }
    } catch {}
    let { googleId } = JSON.parse(raw) as { googleId: string };
    // Fallback to environment variable if placeholder or missing
    if (!googleId || googleId === 'your_google_id') {
      googleId = process.env.LANGCHAIN_USER_ID || googleId;
    }
    const baseUrl =
      process.env.SERVER_BASE_URL?.replace(/\/+$/, '') ||
      'http://localhost:3000';
    const res = await axios.get(
      `${baseUrl}/traffic/routes/favorites?googleId=${googleId}`,
    );
    // Return the JSON-serialized list of favorites
    return JSON.stringify(res.data);
  },
});
