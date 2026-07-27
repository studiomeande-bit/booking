"use strict";
/* 수령 확인 페이지 — print.studio-mean.com/handover/
   인화앱과 같은 오리진이라 localStorage 의 스튜디오 PIN(smphoto:printListPasscode)을 그대로 쓴다.
   이 PIN 은 어드민 빠른잠금과 같은 번호이므로 세 라우트 모두 POST 로 보낸다(쿼리스트링 노출 방지).
   automation key 는 절대 클라이언트에 두지 않는다(통과 즉시 풀-어드민). */

const ERP_BASE = "https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec";
const PIN_KEY = "smphoto:printListPasscode";
const BASE_KEY = "smphoto:erpBase";

const $ = (id) => document.getElementById(id);
const elList = $("list"), elLock = $("lock"), elSub = $("hdSub"), elNote = $("note");
const elToast = $("toast"), elToastMsg = elToast.querySelector(".msg"), elToastBtn = $("toastBtn");

let items = [];
let busy = false;
let toastTimer = null;

function apiBase() {
  try { return (localStorage.getItem(BASE_KEY) || ERP_BASE || "").trim(); }
  catch (e) { return ERP_BASE; }
}
function pin() {
  try { return localStorage.getItem(PIN_KEY) || ""; } catch (e) { return ""; }
}
function setPin(v) {
  try { v ? localStorage.setItem(PIN_KEY, v) : localStorage.removeItem(PIN_KEY); } catch (e) {}
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* 세 라우트 모두 POST — PIN 이 어드민 빠른잠금과 같은 번호라 쿼리스트링(브라우저 기록·중간 로그)에
   남기지 않는다. text/plain 은 CORS 프리플라이트 회피용(인화앱 _recordPrintDone 과 같은 방식). */
async function callApi(route, payload) {
  const base = apiBase();
  if (!base) throw new Error("ERP 주소가 설정되지 않았습니다.");
  const sep = base.includes("?") ? "&" : "?";
  const r = await fetch(base + sep + "api=" + route, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ data: Object.assign({ passcode: pin() }, payload || {}) })
  });
  return r.json();
}

/* ── PIN 잠금 ── */
function showLock(msg) {
  elLock.hidden = false; elList.hidden = true; elNote.hidden = true;
  $("lockErr").textContent = msg || "";
  elSub.textContent = "잠김";
  setTimeout(() => { try { $("pin").focus(); } catch (e) {} }, 60);
}
function hideLock() { elLock.hidden = true; elList.hidden = false; elNote.hidden = false; }

async function tryUnlock(code) {
  if (!code) { showLock("PIN을 입력해 주세요."); return false; }
  setPin(code);
  const r = await load(true);
  if (r === "unauthorized") { setPin(""); showLock("PIN이 올바르지 않습니다."); return false; }
  // 네트워크 오류는 PIN 이 틀렸다는 뜻이 아니다 — 저장한 PIN 은 두고 잠금만 유지한다
  if (r !== "ok") { showLock("연결에 실패했습니다. 다시 시도해 주세요."); return false; }
  hideLock();
  return true;
}

/* ── 목록 ── */
const KIND = {
  noshow:    { cls: "b-noshow",    label: "픽업 노쇼" },
  unclaimed: { cls: "b-unclaimed", label: "미수령" },
  toship:    { cls: "b-toship",    label: "발송 대기" },
  fresh:     { cls: "b-fresh",     label: "대기 중" }
};

async function load(quiet) {
  if (!pin()) { showLock(""); return "unauthorized"; }
  if (!quiet) elSub.textContent = "불러오는 중…";
  let j;
  try { j = await callApi("select-handover-list", { limit: 60 }); }
  catch (e) { elSub.textContent = "네트워크 오류"; toast("불러오지 못했습니다. 연결을 확인해 주세요."); return "error"; }
  // 잠금 처리는 load() 안에서 한다 — 새로고침 버튼과 undo() 는 반환값을 보지 않으므로,
  // 여기서 안 잠그면 PIN 이 바뀐 뒤 화면이 "불러오는 중…"에서 멈춘 것처럼 보인다.
  if (j && j.error && j.error.code === "UNAUTHORIZED") { setPin(""); showLock("PIN을 다시 입력해 주세요."); return "unauthorized"; }
  if (!j || !j.ok) { elSub.textContent = "오류"; toast((j && j.error && j.error.message) || "불러오지 못했습니다."); return "error"; }
  const d = j.data || j;
  items = Array.isArray(d.items) ? d.items : [];
  render();
  return "ok";
}

function render() {
  const open = items.filter((it) => it.kind !== "fresh").length;
  elSub.textContent = items.length
    ? `전달 대기 ${items.length}건` + (open ? ` · 확인 필요 ${open}건` : "")
    : "모두 전달 완료";

  if (!items.length) {
    elList.innerHTML = `<div class="empty"><span class="big">✅</span>
      전달할 인화물이 없습니다.<br><span style="font-size:12.5px;">인화가 끝난 주문이 생기면 여기에 나타납니다.</span></div>`;
    return;
  }
  // 확인 필요(노쇼·미수령·발송대기) → 그다음 정상 대기. 각 그룹 안에서는 서버가 준 순서(오래된 것부터).
  const urgent = items.filter((it) => it.kind !== "fresh");
  const fresh = items.filter((it) => it.kind === "fresh");
  let html = "";
  if (urgent.length) html += `<div class="sec">확인 필요 ${urgent.length}건</div>` + urgent.map(card).join("");
  if (fresh.length) html += `<div class="sec">전달 대기 ${fresh.length}건</div>` + fresh.map(card).join("");
  elList.innerHTML = html;
}

function card(it) {
  const k = KIND[it.kind] || KIND.fresh;
  const isMail = it.method === "mail";
  const lines = [];
  lines.push(`${esc(it.product || "-")}${it.shootDate ? " · " + esc(it.shootDate) + " 촬영" : ""}`);
  if (isMail) {
    lines.push(`우편 · ${it.printDoneAt ? "인화완료 <b>" + esc(it.printDoneAt) + "</b>" : "인화 대기"}`);
    if (it.mailAddress) lines.push(esc(it.mailAddress).replace(/\n/g, "<br>"));
  } else if (it.pickupAt) {
    lines.push(`픽업 예약 <b>${esc(it.pickupAt)}</b>`);
  } else if (it.printDoneAt) {
    lines.push(`인화완료 <b>${esc(it.printDoneAt)}</b> · 고객 예약 없음`);
  } else {
    lines.push("인화 대기 중");
  }
  if (it.days) lines.push(`${it.days}일 경과`);

  const money = it.totalExtra > 0
    ? `<div class="money">추가금 €${Number(it.totalExtra).toFixed(2)}${it.extraInvoiceNumber ? " · " + esc(it.extraInvoiceNumber) : ""} — 결제 확인</div>`
    : "";

  const sid = esc(it.sessionId);
  return `<div class="card" data-sid="${sid}">
    <div class="row">
      <div style="flex:1;min-width:0;">
        <div class="nm">${esc(it.name)}</div>
        <div class="meta">${lines.join(" · ")}</div>
        ${money}
      </div>
      <span class="badge ${k.cls}">${k.label}</span>
    </div>
    <div class="acts">
      <button type="button" class="btn-main${isMail ? " btn-mail" : ""}"
        data-act="done" data-sid="${sid}" data-method="${isMail ? "우편발송" : "방문수령"}">
        ${isMail ? "📮 발송 완료" : "✅ 수령 완료"}</button>
    </div>
    <div class="more">
      ${isMail ? "" : `<button type="button" class="btn-ghost" data-act="done" data-sid="${sid}" data-method="대리수령">대리 수령</button>`}
      <button type="button" class="btn-ghost" data-act="done" data-sid="${sid}" data-method="기타" data-memo="수령포기/폐기 처리">수령포기 · 폐기</button>
    </div>
  </div>`;
}

/* ── 액션 ── */
async function markDone(sid, method, memo) {
  if (busy) return;
  const it = items.find((x) => x.sessionId === sid);
  if (!it) return;
  const name = it.name || "";
  let msg;
  if (method === "우편발송") msg = `${name}님 · 우편 발송 완료로 기록합니다.\n고객에게 발송 안내 메일이 나갑니다.\n계속할까요?`;
  else if (method === "기타") msg = `${name}님 · 수령포기/폐기로 기록합니다.\n목록에서 사라지며 고객 메일은 없습니다.\n계속할까요?`;
  // 방문/대리 수령은 서버가 '최종작업완료'까지 마감한다 — 확인창이 그 사실을 말해야 한다
  else msg = `${name}님 · ${method}으로 기록하고 최종작업완료로 마감합니다.\n(고객 메일은 발송되지 않습니다)\n계속할까요?`;
  if (!confirm(msg)) return;

  busy = true;
  // querySelector 대신 순회 — CSS.escape 는 구형 Safari 에 없고 세션ID 를 셀렉터에 넣을 이유도 없다
  let el = null;
  elList.querySelectorAll(".card").forEach((c) => { if (c.dataset.sid === sid) el = c; });
  if (el) { el.classList.add("gone"); el.querySelectorAll("button").forEach((b) => (b.disabled = true)); }
  let j;
  try { j = await callApi("select-handover-done", { sessionId: sid, method: method, memo: memo || "" }); }
  catch (e) { j = null; }
  busy = false;

  if (!j || !j.ok) {
    if (el) { el.classList.remove("gone"); el.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
    toast((j && j.error && j.error.message) || "기록하지 못했습니다. 다시 시도해 주세요.");
    return;
  }
  const d = j.data || j;
  items = items.filter((x) => x.sessionId !== sid);
  render();
  // 우편발송인데 mailSent 가 false면 메일주소가 없다는 뜻 — 확인창에서 메일을 약속했으므로 반드시 알린다
  const mailNote = method !== "우편발송" ? ""
    : (d.mailSent ? " 발송 안내 메일을 보냈습니다." : " ⚠ 메일 주소가 없어 안내를 보내지 못했습니다.");
  toast(d.alreadyDone ? `${name}님 — 이미 기록된 건입니다.`
    : `${name}님 · ${method} 기록 완료.` + mailNote,
    d.alreadyDone ? null : sid);
}

async function undo(sid) {
  hideToast();
  let j;
  try { j = await callApi("select-handover-undo", { sessionId: sid }); }
  catch (e) { j = null; }
  if (!j || !j.ok) { toast((j && j.error && j.error.message) || "되돌리지 못했습니다."); return; }
  const d = j.data || j;
  toast(d.mailAlreadySent ? "기록을 되돌렸습니다. (이미 나간 발송 안내 메일은 취소되지 않습니다)" : "기록을 되돌렸습니다.");
  load(true);
}

/* ── 토스트 ── */
function toast(msg, undoSid) {
  elToastMsg.textContent = msg;
  elToastBtn.hidden = !undoSid;
  elToastBtn.onclick = undoSid ? () => undo(undoSid) : null;
  elToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undoSid ? 9000 : 4200);
}
function hideToast() { elToast.classList.remove("show"); clearTimeout(toastTimer); }

/* ── 이벤트 ── */
elList.addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-act]");
  if (!b) return;
  if (b.dataset.act === "done") markDone(b.dataset.sid, b.dataset.method, b.dataset.memo || "");
});
$("btnReload").addEventListener("click", () => { hideToast(); load(); });
$("btnUnlock").addEventListener("click", () => tryUnlock($("pin").value.trim()));
$("pin").addEventListener("keydown", (ev) => { if (ev.key === "Enter") tryUnlock($("pin").value.trim()); });

/* ── 부팅 ── */
(async function boot() {
  if (!pin()) { showLock(""); return; }
  const r = await load();
  if (r === "unauthorized") { setPin(""); showLock(""); return; }
  hideLock();
})();
