export interface LegDto {
  /** 이동 수단 (예: BUS, SUBWAY, WALK) */
  mode: string;
  /** 구간 시작 시간 (epoch 밀리초) */
  startTime: number;
  /** 구간 종료 시간 (epoch 밀리초) */
  endTime: number;
  /** 이동 거리 (미터 단위) */
  distance: number;
  /** 출발지 정보 (이름 및 위도/경도) */
  from: { name: string; lat: number; lon: number };
  /** 도착지 정보 (이름 및 위도/경도) */
  to: { name: string; lat: number; lon: number };
}

export interface PlanRouteResponse {
  /** 전체 여정 기준 날짜 (epoch 밀리초) */
  date: number;
  /** 전체 여정 소요 시간 (밀리초) */
  duration: number;
  /** 여정 구간(legs) 리스트 */
  legs: LegDto[];
}
