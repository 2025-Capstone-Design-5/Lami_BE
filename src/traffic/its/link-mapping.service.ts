import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Feature } from 'geojson';
import * as RBush from 'rbush';
import * as JSONStream from 'jsonstream';
import { bbox } from '@turf/bbox';

interface LinkItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  linkId: string;
  cx: number;
  cy: number;
}

/**
 * GeoJSON 링크 피처 전체를 R-Tree에 로드한 뒤,
 * 주어진 좌표에서 가장 가까운 링크를 검색합니다.
 */
@Injectable()
export class LinkMappingService implements OnModuleInit {
  private linkTree: any = new RBush();
  private linkItemMap: Map<string, LinkItem> = new Map();
  private linkSectionMap: Map<string, string> = new Map();

  async onModuleInit() {
    // 1) 링크 R-Tree 구축
    let linkCount = 0;
    await this.loadGeojsonToTree(
      path.resolve(__dirname, '../data/moct_link.geojson'),
      (feat: Feature<any>) => {
        const props = feat.properties as Record<string, any>;
        const id = (props.LINK_ID ?? props.linkId)?.toString();
        if (!id) return;
        const [minX, minY, maxX, maxY] = bbox(feat);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const item: LinkItem = { minX, minY, maxX, maxY, linkId: id, cx, cy };
        this.linkTree.insert(item);
        this.linkItemMap.set(id, item);
        // ROAD_NO 필드를 sectionId로 매핑 (숫자가 아닌 값은 제외)
        const rawSection = (
          props.ROAD_NO ??
          props.ROADNO ??
          props.road_no
        )?.toString();
        if (rawSection && /^\d+$/.test(rawSection)) {
          this.linkSectionMap.set(id, rawSection);
        }
        linkCount++;
      },
    );
    console.log(`✔ LinkMappingService: loaded ${linkCount} link items`);
  }

  private async loadGeojsonToTree(
    filePath: string,
    inserter: (feat: Feature<any>) => void,
  ): Promise<void> {
    const parser = fs
      .createReadStream(filePath)
      .pipe(JSONStream.parse('features.*'));
    await new Promise<void>((res, rej) => {
      parser.on('data', inserter);
      parser.on('end', res);
      parser.on('error', rej);
    });
  }

  /** 좌표 → 가장 가까운 링크 ID (centroid 기반) */
  findLinkId(lon: number, lat: number): string | null {
    const buffer = 0.001;
    const envelope = {
      minX: lon - buffer,
      minY: lat - buffer,
      maxX: lon + buffer,
      maxY: lat + buffer,
    };
    const candidates = this.linkTree.search(envelope) as LinkItem[];
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const item of candidates) {
      const dx = lon - item.cx;
      const dy = lat - item.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = item.linkId;
      }
    }
    return bestId;
  }

  /** linkId → sectionId (ROAD_NO 기반) */
  findSectionIdByLinkId(linkId: string): string | null {
    return this.linkSectionMap.get(linkId) ?? null;
  }

  /**
   * linkId -> centroid 좌표 조회
   */
  getCoordinatesByLinkId(linkId: string): { lon: number; lat: number } | null {
    const item = this.linkItemMap.get(linkId);
    if (!item) return null;
    return { lon: item.cx, lat: item.cy };
  }
}
