# NestJS OTP GraphQL Proxy 사용 가이드

이 문서는 NestJS 기반으로 구현된 OTP(OpenTripPlanner) GraphQL Proxy 기능을 소개하고, 정적 GTFS API 및 동적 Transmodel API 사용 방법과 예시를 제공합니다.

## 환경 설정

- **OTP_BASE_URL**: OTP 서버 기본 URL (기본값: `http://localhost:8080`)
- **TmapService**: 주소 기반 지오코딩을 위해 Tmap API 키 설정 필요 (환경 변수로 관리)
- NestJS 서버 실행: `npm run start:dev`

## 공통 요청 구조

- **메서드**: `POST`
- **URL**:
  - 정적 GTFS: `http://localhost:3000/traffic/graphql/gtfs`
  - 동적 Transmodel: `http://localhost:3000/traffic/graphql/transmodel`
- **헤더**: `Content-Type: application/json`
- **바디**: JSON 객체 `{ "query": "...", "variables": { ... } }`

### cURL 예시

```bash
curl -X POST http://localhost:3000/traffic/graphql/gtfs \
  -H "Content-Type: application/json" \
  -d '{
  "query": "GRAPHQL_QUERY",
  "variables": { ... }
}'
```

---

## 1. 정적 GTFS API (`/gtfs`)

OTP의 정적 GTFS 데이터를 조회하며, `planConnection` 시에는 Transmodel API와 연계하여 GTFS 노선 정보를 병합합니다.

### 1.1 Stops by Radius (반경 내 정류소 조회)

```graphql
query StopsByRadius($lat: Float!, $lon: Float!, $radius: Int!) {
  stopsByRadius(lat: $lat, lon: $lon, radius: $radius) {
    edges {
      node {
        distance
        stop {
          gtfsId
          name
          lat
          lon
        }
      }
    }
  }
}
```

```json
{
  "address": "서울역",
  "radius": 500
}
```

### 1.2 Stops by Bbox (영역 내 정류소 조회)

```graphql
query StopsByBbox(
  $minLat: Float!
  $minLon: Float!
  $maxLat: Float!
  $maxLon: Float!
) {
  stopsByBbox(
    minLat: $minLat
    minLon: $minLon
    maxLat: $maxLat
    maxLon: $maxLon
  ) {
    gtfsId
    name
    lat
    lon
  }
}
```

```json
{
  "minLat": 37.566,
  "minLon": 126.978,
  "maxLat": 37.568,
  "maxLon": 126.982
}
```

### 1.3 Stop & Stoptimes (정류소 상세 및 시간표)

```graphql
query StopTimes($id: String!) {
  stop(id: $id) {
    name
    routes {
      shortName
      mode
    }
    stoptimesForPatterns(numberOfDepartures: 3) {
      pattern {
        headsign
        route {
          id
          shortName
          longName
          mode
        }
      }
      stoptimes {
        scheduledDeparture
        serviceDay
        trip {
          tripHeadsign
        }
      }
    }
  }
}
```

```json
{ "id": "Feed:StopId" }
```

### 1.4 Route & Patterns (노선 정보 조회)

```graphql
query RoutePatterns($id: String!) {
  route(id: $id) {
    id
    shortName
    longName
    color
    patterns {
      headsign
      stops {
        name
        lat
        lon
      }
    }
  }
}
```

```json
{ "id": "Feed:RouteId" }
```

### 1.5 Plan Connection (경로 탐색)

```graphql
query PlanConnection(
  $from: PlanCoordinateInput!
  $to: PlanCoordinateInput!
  $dateTime: PlanDateTimeInput!
) {
  planConnection(from: $from, to: $to, dateTime: $dateTime) {
    connections {
      duration
      startTime
      endTime
      from {
        name
      }
      to {
        name
      }
      legs {
        mode
        startTime
        endTime
        from {
          name
        }
        to {
          name
        }
      }
    }
  }
}
```

```json
{
  "from": { "lat": 37.5665, "lon": 126.978 },
  "to": { "lat": 35.1796, "lon": 129.0756 },
  "dateTime": { "date": "2025-06-20", "time": "08:30:00" }
}
```

---

## 2. 동적 Transmodel API (`/transmodel`)

OTP의 실시간/동적 데이터를 기반으로 다양한 GraphQL 쿼리를 지원합니다.

- `address`, `fromAddress`, `toAddress` 필드를 지정하면 내부적으로 지오코딩되어 `lat`/`lon`으로 변환됩니다.

### 2.1 Stops by Radius & Bbox

정적 GTFS와 동일한 쿼리를 사용할 수 있습니다.

### 2.2 Plan Trip (주소 기반)

```graphql
query PlanTripByAddress(
  $fromAddress: String!
  $toAddress: String!
  $dateTime: OffsetDateTime!
) {
  plan(fromAddress: $fromAddress, toAddress: $toAddress, dateTime: $dateTime) {
    itineraries {
      duration
      legs {
        mode
        startTime
        endTime
        from {
          name
        }
        to {
          name
        }
      }
    }
  }
}
```

```json
{
  "fromAddress": "서울역",
  "toAddress": "강남역",
  "dateTime": "2025-06-20T08:30:00+09:00"
}
```

### 2.3 Plan Trip (좌표 기반)

```graphql
query PlanTripByCoord(
  $from: PlanCoordinateInput!
  $to: PlanCoordinateInput!
  $dateTime: PlanDateTimeInput!
) {
  plan(from: $from, to: $to, dateTime: $dateTime) {
    itineraries {
      duration
      legs {
        mode
        startTime
        endTime
        from {
          name
        }
        to {
          name
        }
      }
    }
  }
}
```

```json
{
  "from": { "lat": 37.5665, "lon": 126.978 },
  "to": { "lat": 35.1796, "lon": 129.0756 },
  "dateTime": { "date": "2025-06-20", "time": "08:30:00" }
}
```

---

## 3. 오류 처리 및 참고

- 오류 발생 시 응답에 `errors` 필드가 포함되며, NestJS에서 `BadRequestException`으로 처리합니다.
- 추가 쿼리 및 상세 스키마는 OTP 공식 문서를 참고하세요.

## 4. Quick Trip API (`/quick`)

**URL**: `POST /traffic/graphql/quick`

**헤더**: `Content-Type: application/json`

### 요청 예시

```bash
curl -X POST http://localhost:3000/traffic/graphql/quick \
  -H "Content-Type: application/json" \
  -d '{
    "fromAddress": "대구광역시 남구 대명동 1013-8",
    "toAddress": "대구광역시 달서구 월배로 436",
    "dateTime": "2025-06-22T09:00:00+09:00"
  }'
```

### 응답 예시

```json
{
  "duration": 769,
  "transitTime": 393,
  "segments": [
    {
      "bus": "649",
      "stops": [
        {
          "gtfsId": "1:BS_TAGO_DGB7051003300",
          "name": "대명초등학교건너",
          "lat": 35.83953,
          "lon": 128.56861
        },
        {
          "gtfsId": "1:BS_TAGO_DGB7051003100",
          "name": "대명역(1번출구)",
          "lat": 35.83936,
          "lon": 128.56518
        }
        // ... 생략 ...
      ]
    }
  ]
}
```
