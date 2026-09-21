export const CONFIG = {
  apiBaseUrl:
    globalThis.STUDIO_MEAN_CONFIG?.API_BASE_URL ||
    globalThis.API_BASE_URL ||
    'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec',
  /* 조회 전용 셔틀(appscript-public — init·quote·calendar-batch·slots·select-session·select-photos). 메인 2.3MB 의 요청당 3~5초 바닥을 피한다.
     실패(미승인·타임아웃·오류)하면 api-core.js readViaShuttle 이 apiBaseUrl(메인)로 되돌아간다. 제출·홀드·저장은 항상 메인. */
  readApiBaseUrl:
    globalThis.STUDIO_MEAN_CONFIG?.READ_API_BASE_URL ||
    'https://script.google.com/macros/s/AKfycbyb1y964F-MAO4-043gq3LdIg9fPqXb-My_1iV1qcjQwQIiZnfMl17i0wAnRBn6tAj6/exec',
  defaultLang: 'ko'
};
