export interface OtpPlanResponse {
  plan: OtpPlan;
}

export interface OtpPlan {
  itineraries: Itinerary[];
}

export interface Itinerary {
  duration: number;
  legs: Leg[];
}

export interface Leg {
  mode: string;
  duration: number;
  transitLeg: boolean;
  interlineWithPreviousLeg?: boolean;
  routeShortName?: string;
  routeId?: string;
  from: {
    name: string;
    stopId?: string;
    departure?: number;
    lat: number;
    lon: number;
  };
  to: {
    name: string;
    arrival?: number;
    endTime?: number;
  };
  startTime?: number;
  legGeometry: unknown;
  steps: unknown[];
  /**
   * OTP showIntermediateStops=true 시 제공되는 경유 정류소 목록
   */
  intermediateStops?: Array<{
    name: string;
    lat: number;
    lon: number;
    stopId?: string;
    departure?: number;
    arrival?: number;
  }>;
}
