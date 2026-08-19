/* /go/<업체id> — 협력업체 링크 리디렉션 + 클릭 집계.
 *
 * 왜 우리 도메인을 거치나:
 *  1) 메일 안에서는 추적 스크립트가 돌지 않는다 → 서버를 거쳐야 클릭을 셀 수 있다.
 *  2) 업체 링크가 바뀌어도 이미 보낸 메일이 안 깨진다(시트만 고치면 된다).
 *  3) 고객에게 보이는 주소가 script.google.com 이 아니라 우리 도메인이라 신뢰가 유지된다.
 *
 * 개인정보는 넘기지 않는다 — 업체id·출처만 집계한다(IP·UA·쿠키 미전송).
 * 집계 실패는 무시하고 무조건 리디렉션한다: 통계 때문에 고객을 막지 않는다.
 */
import type { Config, Context } from 'https://edge.netlify.com';

const API_BASE =
  'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';
const FALLBACK = 'https://booking.studio-mean.com/';
const TTL_MS = 10 * 60 * 1000;

let cache: { at: number; map: Record<string, string> } | null = null;

async function partnerUrls(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const res = await fetch(`${API_BASE}?api=partners`, { redirect: 'follow' });
  const json = await res.json();
  const map: Record<string, string> = {};
  for (const p of json?.data?.partners ?? []) {
    const url = String(p?.url ?? '');
    // http(s)/mailto/tel 만 허용 — 시트 오타가 javascript: 같은 스킴으로 새지 않도록
    if (p?.id && /^(https?:|mailto:|tel:)/i.test(url)) map[String(p.id).toLowerCase()] = url;
  }
  cache = { at: Date.now(), map };
  return map;
}

export default async (request: Request, context: Context): Promise<Response> => {
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.replace(/^\/go\/?/, '')).trim().toLowerCase();
  const source = (url.searchParams.get('s') || 'mail').slice(0, 20);
  if (!id) return Response.redirect(FALLBACK, 302);

  let target = FALLBACK;
  try {
    const map = await partnerUrls();
    if (map[id]) target = map[id];
  } catch {
    /* 목록을 못 읽으면 예약 홈으로 — 깨진 링크보다 낫다 */
  }

  /* 집계는 응답을 막지 않되, waitUntil 로 리디렉션 이후에도 완주시킨다.
     (그냥 띄우기만 하면 응답 반환 시점에 취소될 수 있다.) */
  context.waitUntil(
    fetch(`${API_BASE}?api=partner-click&p=${encodeURIComponent(id)}&s=${encodeURIComponent(source)}`, {
      redirect: 'follow'
    }).catch(() => {})
  );

  return new Response(null, {
    status: 302,
    headers: { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
  });
};

export const config: Config = { path: '/go/*' };
