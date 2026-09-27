/**
 * shift-clock.mjs — `node --import` 프리로드: 시계를 N일 앞으로 민다.
 *
 * 왜 있는가: 검사 게이트의 픽스처에 고정 날짜(`'2026-07-20'`)를 박고 상대 창(`sinceDays: 60`)으로
 * 검사하면, 시간이 지나면서 그 케이스가 조용히 창 밖으로 미끄러진다. 게이트는 **빨개지지 않고
 * 그냥 아무것도 검사하지 않게** 된다(드리프트 3종 중 3번). `check-all.mjs --future N` 이 이 파일을
 * 프리로드해 미래 시점으로 전체를 돌려, 썩기 전에 드러내려는 것.
 *
 * 쓰임: CHECK_CLOCK_SHIFT_DAYS 환경변수로 일수를 받는다. 직접 부르지 말고 check-all.mjs 를 쓴다.
 */
const days = Number(process.env.CHECK_CLOCK_SHIFT_DAYS || 0);
if (Number.isFinite(days) && days !== 0) {
  const shift = days * 86400000;
  const RealDate = Date;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      // new Date() 만 민다 — 명시적 인자(new Date('2026-07-20'))는 픽스처 그대로 두어야 한다
      if (args.length === 0) super(RealDate.now() + shift);
      else super(...args);
    }
    static now() { return RealDate.now() + shift; }
  }
  ShiftedDate.parse = RealDate.parse;
  ShiftedDate.UTC = RealDate.UTC;
  globalThis.Date = ShiftedDate;
}
