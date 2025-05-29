import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Feature } from 'geojson';
import bbox from '@turf/bbox';

// Streaming parser for large GeoJSON
function requireJSONStream() { return require('JSONStream'); }

interface LinkItem {
  minX: number; minY: number; maxX: number; maxY: number;
  id: string; cx: number; cy: number;
}

/**
 * GeoJSON 링크 피처 전체를 R-Tree에 로드한 뒤,
 * 주어진 좌표에서 가장 가까운 링크를 검색합니다.
 */
@Injectable()
export class LinkMappingService implements OnModuleInit {
  private tree: any; // rbush instance

  async onModuleInit() {
    const JSONStream = requireJSONStream();
    const RBush = require('rbush');
    this.tree = new RBush();

    const geojsonPath = path.resolve(__dirname, '../data/moct_link.geojson');
    const stream = fs.createReadStream(geojsonPath, { encoding: 'utf8' });
    const parser = JSONStream.parse('features.*');
    stream.pipe(parser);

    let count = 0;
    await new Promise<void>((resolve, reject) => {
      parser.on('data', (feat: Feature) => {
        // GeoJSON properties에서 LINK_ID 가져오기
        const props = feat.properties as Record<string, any>;
        const linkId = props.LINK_ID ?? props.linkId;
        if (!linkId) return;
        const [minX, minY, maxX, maxY] = bbox(feat);
        const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
        this.tree.insert({ minX, minY, maxX, maxY, id: linkId.toString(), cx, cy });
        count++;
      });
      parser.on('end', () => {
        console.log(`✔ LinkMappingService: loaded ${count} link items`);
        resolve();
      });
      parser.on('error', (err: Error) => reject(err));
    });
  }

  /**
   * 주어진 위경도에서 가장 가까운 linkId를 반환합니다.
   * @param lon 경도
   * @param lat 위도
   */
  findLinkId(lon: number, lat: number): string | null {
    const buffer = 0.001;
    const envelope = { minX: lon - buffer, minY: lat - buffer, maxX: lon + buffer, maxY: lat + buffer };
    const items: LinkItem[] = this.tree.search(envelope);
    console.log(`[LinkMappingService] search for (${lon},${lat}) envelope=${JSON.stringify(envelope)}, candidates=${items.length}`);
    let bestId: string | null = null; let bestDist = Infinity;
    for (const item of items) {
      const dx = lon - item.cx; const dy = lat - item.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) { bestDist = dist; bestId = item.id; }
    }
    console.log(`[LinkMappingService] result for (${lon},${lat}) bestDist=${bestDist}, linkId=${bestId}`);
    return bestId;
  }
} 