export const CONFIG = {
  apiBaseUrl:
    globalThis.STUDIO_MEAN_CONFIG?.API_BASE_URL ||
    globalThis.API_BASE_URL ||
    'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec',
  defaultLang: 'ko'
};
