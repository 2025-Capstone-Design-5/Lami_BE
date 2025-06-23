#!/usr/bin/env bash
set -euo pipefail

FROM="대구광역시 남구 대명동 1013-8"
TO="대구광역시 달서구 월배로 436"
DATE="2025-06-22T09:00:00+09:00"

echo "=== 1) 경로탐색 (Transmodel) ==="
PLAN_JSON=$(cat <<EOF | curl -s -X POST http://localhost:3000/traffic/graphql/transmodel \
  -H "Content-Type: application/json" --data-binary @-
{
  "query":"query Plan($fromAddress:String!,$toAddress:String!,$dateTime:OffsetDateTime!){\
plan(fromAddress:$fromAddress,toAddress:$toAddress,dateTime:$dateTime){\
itineraries{duration transitTime legs{mode from{stop{gtfsId name}} to{stop{gtfsId name}} line{id publicCode}}}}}",
  "variables":{
    "fromAddress":"$FROM",
    "toAddress":"$TO",
    "dateTime":"$DATE"
  }
}
EOF
)

# 오류 체크
if echo "$PLAN_JSON" | jq -e '.errors' >/dev/null; then
  echo "▶ 경로탐색 오류:" >&2
  echo "$PLAN_JSON" | jq '.errors' >&2
  exit 1
fi

# 값 파싱
DURATION=$(echo "$PLAN_JSON" | jq '.data.plan.itineraries[0].duration')
TRANSIT_TIME=$(echo "$PLAN_JSON" | jq '.data.plan.itineraries[0].transitTime')

echo "총 소요 시간      : ${DURATION}초"
echo "대중교통 이용 시간: ${TRANSIT_TIME}초"
echo

echo "=== 2) 구간별 버스 번호 및 정류장 목록 ==="
echo "$PLAN_JSON" \
  | jq -c '.data.plan.itineraries[0].legs[]' \
  | while read -r leg; do
      MODE=$(echo "$leg" | jq -r '.mode')
      BUS=$(echo "$leg" | jq -r '.line.publicCode')
      ID=$(echo "$leg" | jq -r '.line.id')
      FROM_ID=$(echo "$leg" | jq -r '.from.stop.gtfsId')
      TO_ID=$(echo "$leg" | jq -r '.to.stop.gtfsId')
      FROM_NAME=$(echo "$leg" | jq -r '.from.stop.name')
      TO_NAME=$(echo "$leg" | jq -r '.to.stop.name')

      echo "[$MODE] $FROM_NAME → $TO_NAME (버스 $BUS)"
      curl -s -X POST http://localhost:3000/traffic/graphql/gtfs \
        -H "Content-Type: application/json" --data-binary @- <<EOF | jq -r '.data.routeSegment[] | "  - [\(.gtfsId)] \(.name) (\(.lat),\(.lon))"'
{
  "query":"query Segment($id:String!,$fromStopId:String!,$toStopId:String!){\
routeSegment(id:$id,fromStopId:$fromStopId,toStopId:$toStopId){gtfsId name lat lon}}",
  "variables":{
    "id":"$ID",
    "fromStopId":"$FROM_ID",
    "toStopId":"$TO_ID"
  }
}
EOF
      echo
    done