/**
 * Tmap Geocoding API 공식 응답의 coordinateInfo 객체
 */
export interface TmapCoordinateInfo {
  coordType: string;
  addressFlag: string;
  matchFlag: string;
  lat: string;
  lon: string;
  city_do: string;
  gu_gun: string;
  eup_myun: string;
  legalDong: string;
  legalDongCode: string;
  adminDong: string;
  adminDongCode: string;
  ri: string;
  bunji: string;
  newMatchFlag: string;
  newLat: string;
  newLon: string;
  newRoadName: string;
  newBuildngIndex: string;
  newBuildngName: string;
  newBuildngCateName: string;
  remainder: string;
}

/**
 * Tmap Geocoding API 공식 응답 타입
 */
export interface TmapGeocodingResponse {
  /** 좌표 정보 */
  coordinateInfo: TmapCoordinateInfo;
}

/**
 * Tmap 경로 API의 응답 타입
 */
export interface TmapRouteResponse {
  type: string;
  features: TmapRouteFeature[];
}

/**
 * Tmap 경로 API의 feature 객체
 */
export interface TmapRouteFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][];
  };
  properties: {
    totalDistance: number;
    totalTime: number;
    totalFare: number;
    taxiFare?: number;
    index?: number;
    pointIndex?: number;
    name?: string;
    description?: string;
    nextRoadName?: string;
    turnType?: number;
    pointType?: string;
    lineIndex?: number;
    distance?: number;
    time?: number;
    roadType?: number;
    facilityType?: number;
    categoryRoadType?: number;
  };
}
