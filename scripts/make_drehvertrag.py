#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Drehvertrag(촬영/제작 계약서) 생성 파이프라인.

구조: DEAL 딕셔너리(딜 조건) + 표준 12개 조항(2025 휘슬러 계약 구조 미러) → HTML → headless Chrome PDF.
견적 PDF가 있으면 pypdf로 뒤에 합본해 [첨부]까지 한 파일로 만든다.

사용:
  python3 scripts/make_drehvertrag.py            # DEAL 기본값(휘슬러 2026)으로 생성
  python3 scripts/make_drehvertrag.py deal.json  # JSON 파일로 DEAL 덮어쓰기

출력: OUT_DIR/<파일명>.html + .pdf (+견적 합본 시 _mit_Angebot.pdf)
"""
import json
import pathlib
import subprocess
import sys

# ── 딜 조건 (기본값: 휘슬러 코리아 2026 미식투어) ─────────────────────────────
DEAL = {
    "title": "독일 미식투어 영상·사진 제작 계약서",
    "subtitle": "휘슬러코리아 – 스튜디오 민",
    "outfile": "Drehvertrag_FisslerKorea_2026_draft",
    "quote_number": "AN-260005",
    "quote_pdf": "/Users/taewoongmin/Desktop/Studio_mean/스튜디오자료/견적서/2026/AN-260005.pdf",

    "gap": {
        "company": "주식회사 휘슬러코리아",
        "address": "서울시 강남구 테헤란로 407 EK타워 13층",
        "bizno": "220-81-52076",
        "ceo": "이 경 우",
    },
    "eul": {
        "company": "스튜디오 민 (Studio mean)",
        "address": "Holzweg-Passage 3, 61440 Oberursel (Taunus), Germany",
        "vatid": "USt-IdNr. DE440009941",
        "ceo": "Taewoong Min",
        "bank": "Deutsche Bank · IBAN: DE11 5007 0010 0659 1176 00 · BIC: DEUTDEFFXXX",
    },

    "period_end": "2026년 12월 30일",
    "work_name": "쿠킹챌린지 우승자 독일투어 현장 스케치 촬영 (사진 + 영상 하이브리드)",
    "shoot_schedule": "2026년 10월 19일 – 20일 (2일, 1일 6시간 총 12시간)",
    "deliverables": [
        "사진 약 200장 (JPG, 보정 포함)",
        "클린 컷 비디오 (4K 로그, LUT 포함)",
        "하이라이트 영상 약 3분 분량 2편 (4K, 타이틀 및 무료 음원 포함)",
    ],
    "delivery_format": "MP4(영상) / JPG(사진) — 자막본·클린본 포함",
    "delivery_due": "촬영 종료 후 10일 이내 (교정 1회 포함)",
    "usage_scope": "“갑”의 웹사이트·SNS·사내 용도 사용을 포함하며, 유료 광고 집행은 사전 별도 협의로 한다. “갑”은 영상물의 클린본을 활용하여 2차 편집하여 사용할 수 있다.",

    "netto": 2700.00,
    "vat_rate": 0.19,
    "deposit": 300.00,
    "travel_note": "여행 비용은 1박 숙박·교통·식사를 포함하며, 2박 이상 체류가 필요한 경우 1박당 €100–150을 별도 협의하여 추가한다.",

    "sign_date": "2026년&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;일",
}

# ── 유틸 ──────────────────────────────────────────────────────────────────────
OUT_DIR = pathlib.Path("/Users/taewoongmin/Desktop/Studio_mean/스튜디오자료/계약서/2026")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def eur(v: float) -> str:
    s = f"{v:,.2f}"
    return f"€ {s}"


def build_html(d: dict) -> str:
    vat = round(d["netto"] * d["vat_rate"], 2)
    total = round(d["netto"] + vat, 2)
    balance = round(total - d["deposit"], 2)
    deliverables = "".join(f"<li>{x}</li>" for x in d["deliverables"])

    css = """
    @page { size: A4; margin: 20mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #222;
           font-size: 10.5pt; line-height: 1.75; }
    .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center;
             align-items: center; text-align: center; page-break-after: always; }
    .cover h1 { font-size: 24pt; letter-spacing: 0.04em; margin-bottom: 14mm; }
    .cover .sub { font-size: 13pt; font-weight: 600; color: #444; }
    h2.doc-title { font-size: 15pt; text-align: center; margin: 4mm 0 10mm; letter-spacing: 0.06em; }
    .preamble { margin-bottom: 7mm; }
    section.art { break-inside: avoid; }
    h3 { font-size: 11pt; margin: 6.5mm 0 2mm; }
    ol.cl { padding-left: 6mm; }
    ol.cl > li { margin-bottom: 1.2mm; }
    ul.inner { padding-left: 5mm; list-style: none; }
    ul.inner li::before { content: "- "; }
    ul.deliv { padding-left: 9mm; }
    .kv { padding-left: 6mm; }
    .kv div { margin-bottom: 0.8mm; }
    .kv b { display: inline-block; min-width: 26mm; }
    .amount-box { border: 1px solid #bbb; border-radius: 2mm; padding: 3mm 5mm; margin: 2.5mm 0 2.5mm 6mm;
                  width: 120mm; break-inside: avoid; }
    .amount-box div { display: flex; justify-content: space-between; }
    .amount-box .tt { border-top: 1px solid #bbb; margin-top: 1.5mm; padding-top: 1.5mm; font-weight: 700; }
    .closing-block { break-inside: avoid; }
    .sig-date { text-align: center; margin: 14mm 0 10mm; font-size: 11.5pt; }
    .sig-grid { display: flex; gap: 14mm; }
    .sig-col { flex: 1; }
    .sig-col .role { font-weight: 700; margin-bottom: 2.5mm; }
    .sig-col div { margin-bottom: 1.2mm; }
    .sig-line { margin-top: 7mm; }
    .attach { margin-top: 12mm; color: #555; }
    """

    cover = f"""
    <div class="page cover">
      <h1>{d['title']}</h1>
      <div class="sub">{d['subtitle']}</div>
    </div>"""

    body1 = f"""
    <div class="body">
      <h2 class="doc-title">영상·사진 촬영 대행 계약서</h2>
      <p class="preamble"><b>{d['gap']['company']}</b>(이하 “갑”이라 한다)와 <b>{d['eul']['company']}</b>(이하 “을”이라
      한다)는 “갑”이 제작하는 사업과 관련하여 작성 내지 촬영한 글, 음악, 사진, 동영상, 이들의 결합,
      편집물 등(이하 ‘본 저작물’이라 함)의 동영상·사진 원고 작업(이하 ‘목적물’이라 함)에 대하여
      다음과 같이 약정한다.</p>

      <section class="art"><h3>제 1 조 (목적)</h3>
      <ol class="cl">
        <li>본 계약서에서 사용하는 ‘목적물’의 정의는 다음과 같다. ‘본 저작물’의 제작에 필요한 동영상,
        사진 원고 중 “갑”이 기획한 구성안에 따라 “을”이 작업한 동영상, 사진 원고들로, 편집 등의
        후반 작업까지 완료한 영상(사진)을 말한다.</li>
        <li>“을”은 ‘최종 목적물’을 완전한 형태로 “갑”에게 인도하여야 한다.</li>
        <li>본 계약서는 “갑”이 “을”에게 의뢰한 목적물 대행 업무 위탁 운영에 관한 기본적인 사항과
        “갑”과 “을”의 책임 및 의무에 관한 사항을 규정함을 목적으로 한다.</li>
      </ol></section>

      <section class="art"><h3>제 2 조 (계약의 기간)</h3>
      <p>본 계약의 유효기간은 계약 체결일로부터 {d['period_end']}까지로 하며, 계약기간 만료 이전에 목적물
      납품이 완료되면 계약이 완료된 것으로 한다. 계약기간 이내에 목적물 납품이 완료되지 않으면 계약은
      자동으로 연장된다.</p></section>

      <section class="art"><h3>제 3 조 (업무의 범위)</h3>
      <ol class="cl">
        <li>“을”이 제공하는 촬영 및 영상 제작 업무의 내용은 다음과 같다.
          <div class="kv">
            <div><b>업무내용</b>: {d['work_name']}</div>
            <div><b>촬영일정</b>: {d['shoot_schedule']}</div>
            <div><b>목 적 물</b>:</div>
            <ul class="deliv">{deliverables}</ul>
            <div><b>납품형식</b>: {d['delivery_format']}</div>
            <div><b>납품기한</b>: {d['delivery_due']}</div>
            <div><b>업무범위</b>: 컨텐츠 기획 및 제작 전반(촬영 및 편집) 등</div>
          </div>
        </li>
        <li>“을”에게 납품받은 영상물의 소유권 및 저작권은 “갑”이 가진다. 영상물의 사용범위는
        {d['usage_scope']}</li>
        <li>“을”은 목적물을 제작함에 있어 필요한 장비, 시간, 기타 일체의 경비 등 제반 여건을 “을”의
        책임 및 비용으로 부담하며, 필요시 상호 협의하여 비용 부담에 대한 별도의 합의를 할 수 있다.</li>
      </ol></section>

      <section class="art"><h3>제 4 조 (제작금 및 지급방식)</h3>
      <ol class="cl">
        <li>제작에 따른 총 금액은 견적서({d['quote_number']})를 기준으로 하며, 다음과 같다.
          <div class="amount-box">
            <div><span>제작 금액 (순액)</span><span>{eur(d['netto'])}</span></div>
            <div><span>부가가치세 (MwSt. {int(d['vat_rate']*100)}%)</span><span>{eur(vat)}</span></div>
            <div class="tt"><span>총 금액</span><span>{eur(total)}</span></div>
          </div>
        </li>
        <li>“갑”은 제작금을 “을”의 아래 계좌로 지급한다. 계약금 {eur(d['deposit'])}은 계약 체결 후
        “을”의 인보이스 수령일 기준 월말까지, 잔금 {eur(balance)}은 최종 목적물 납품 후 “을”의
        인보이스 수령일 기준 월말까지 지급한다.
          <div class="kv"><div>{d['eul']['bank']}</div></div>
        </li>
        <li>“을”은 독일 부가가치세법에 따라 부가가치세({int(d['vat_rate']*100)}%)를 적용하며
        ({d['eul']['vatid']}), 각 지급분에 대한 인보이스(Rechnung)를 발행한다.</li>
        <li>{d['travel_note']}</li>
        <li>촬영 후 변동사항(촬영내용, 편집 등)에 따른 금액은 상호 합의하에 별도 지급하기로 한다.</li>
      </ol></section>
    </div>"""

    body2 = """
    <div class="body">
      <section class="art"><h3>제 5 조 (검수 및 수정)</h3>
      <ol class="cl">
        <li>“갑”은 “을”이 제작하여 납품한 영상물을 검수할 수 있으며, 납품 범위에는 교정 1회가
        포함된다. 검수 시 문제가 야기될 경우 사전 협의된 편집방향을 근거로 타당한 수정을 요구할 수
        있으며 “을”은 그러한 요구에 성실히 임하기로 한다.</li>
        <li>사전에 협의된 내용에서 벗어나는 요구에 대해서는 수정 요구로 여기지 않으며, 이러한 경우에
        발생되는 진행 사항은 별도의 추가 제작으로 간주하기로 한다.</li>
        <li>본 조 제2항과 같이 “갑”의 판단에 의해 추가로 제작을 해야 할 경우, 그에 따르는 발생 비용을
        “갑”이 “을”에게 별도로 지불하여 추가 제작이 진행될 수 있다.</li>
        <li>제작된 영상의 데이터 최종본을 “갑”에게 제출한 후 원본(최종본)에 대한 수정 제작이 있을
        경우 “갑”과 “을”이 충분한 협의 하에 최소 금액으로 진행한다.</li>
      </ol></section>

      <section class="art"><h3>제 6 조 (정보제공)</h3>
      <p>“을”은 업무 수행에 필요한 자료를 “갑”에게 요청할 수 있으며 “갑”은 특별한 사유가 없는 한
      이에 응하여야 한다.</p></section>

      <section class="art"><h3>제 7 조 (자료관리 및 저작권)</h3>
      <ol class="cl">
        <li>본 ‘저작물’ 및 ‘목적물’에 대한 저작재산권 일체는 “갑”에게 귀속된다.</li>
        <li>‘저작재산권’이라 함은 본 저작물 및 목적물에 대한 복제권, 공연권, 공중송신권, 전시권, 방송권,
        배포권, 대여권, 2차적 저작물작성권, 편집저작권을 말한다.</li>
        <li>‘2차적 저작물’이라 함은 본 저작물 및 목적물을 번역, 편곡, 변형, 각색, 영상제작 그 밖의
        방법으로 작성한 창작물을 말한다.</li>
        <li>‘편집저작물’이라 함은 제1항에 대한 데이터베이스를 포함하는 편집물로서 그 소재의 선택 또는
        배열이 창작성이 있는 것을 말한다.</li>
        <li>“을”은 본 계약과 관련하여 “갑”으로부터 제공받은 서류, 정보, 데이터, 기타 모든 자료를
        선량한 관리자의 주의로 보관·관리하여야 하며, “갑”의 사전 서면 동의 없이 반출하거나 본 계약
        목적 이외의 용도로 사용해서는 아니 된다.</li>
        <li>“을”은 본 계약과 관련하여 “갑”과 관련된 자료 등의 직·간접적인 유출로 인한 “갑”의 손실
        및 손해에 대해 일체의 민·형사상 책임을 부담한다.</li>
        <li>영상물이 제3조의 사용범위 외에 사용될 때에는 음원, 폰트, 이미지, 모델 등 각 요소의
        저작권자에게 이를 알리고 새로운 계약 후 사용하여야 한다.</li>
        <li>“을”의 데이터베이스를 포함한 촬영원본, 최종 마스터 영상의 보존기간은 최대 1년으로 한다.
        그 이전에 데이터를 삭제할 때에는 “갑”에게 알려줄 의무가 있다.</li>
      </ol></section>

      <section class="art"><h3>제 8 조 (양도 금지)</h3>
      <p>“갑”과 “을”은 상대방의 서면동의 없이 본 계약상의 권리나 의무를 제3자에게 양도하지 못한다.</p></section>

      <section class="art"><h3>제 9 조 (비밀유지)</h3>
      <ol class="cl">
        <li>“갑”과 “을”은 본 계약의 체결 및 이행 과정에서 취득한 상대방의 영업비밀 등 일체의 정보를
        본 계약의 목적 이외의 용도로 사용하거나 제3자에게 누설해서는 안 된다.</li>
        <li>본 조의 비밀유지의무는 본 계약이 종료, 해제, 해지 등의 사유로 실효된 이후에도 유효하다.</li>
      </ol></section>
    </div>"""

    body3 = f"""
    <div class="body">
      <section class="art"><h3>제 10 조 (계약의 해지)</h3>
      <ol class="cl">
        <li>계약 당사자 중 어느 일방에게 다음 각호의 1에 해당하는 사유가 발생하는 경우, 상대방 당사자는
        본 계약에 대하여 그 전부 또는 일부를 즉시 해제하거나 해지할 수 있다.
          <ul class="inner">
            <li>① 제3자로부터 압류, 가압류, 가처분, 강제집행, 경매처분을 받거나 받을 우려가 있어 본 계약의 이행이 어려운 경우</li>
            <li>② 파산, 기업회생, 회사정리 등이 된 경우</li>
            <li>③ 영업정지, 영업취소된 경우</li>
            <li>④ 기타 경제적 사정의 악화 등의 이유로 본 계약을 유지할 수 없는 것이 확정된 경우</li>
          </ul>
        </li>
        <li>계약 당사자는 다음 각 호의 사유가 발생한 때에는 상대방에게 서면으로 상당 기간을 정하여 그
        이행을 최고하고 그 기간 내에 이행하지 아니한 때에는 본 계약을 해지할 수 있다.
          <ul class="inner">
            <li>① “갑”이 선금의 비용지급을 지체한 경우</li>
            <li>② 기타 “갑” 또는 “을”이 본 계약의 중요한 규정을 위반한 경우</li>
            <li>③ “을”이 정당한 사유 없이 위탁받은 업무를 거부하거나 지연할 경우</li>
          </ul>
        </li>
        <li>본 조 제1항 내지 제2항에 의한 계약의 해제·해지는 상대방에 대한 서면으로 한다.</li>
        <li>본 계약에 따른 계약기간의 만료 또는 계약이 해제 또는 해지될 때에는 각 당사자는 자신의 채무에
        대하여 기한의 이익을 상실하여 지체 없이 변제하여야 한다.</li>
        <li>계약의 해제 또는 해지는 손해배상의 청구에 영향을 미치지 아니한다.</li>
        <li>계약 일방은 자신의 귀책사유로 인하여 본 계약의 전부 또는 일부가 해제·해지됨으로써 발생한
        상대방의 손해를 배상하여야 한다.</li>
      </ol></section>

      <section class="art"><h3>제 11 조 (손해배상)</h3>
      <p>본 계약의 당사자는 상대방의 계약위반이나 불법행위로 인한 손해에 대하여 손해배상을 청구할 수 있다.</p></section>

      <section class="art"><h3>제 12 조 (분쟁해결)</h3>
      <p>본 계약의 성립 및 효력과 관련하여 당사자간 분쟁이 발생할 경우 상호 합의에 의하여 해결하되,
      합의가 이루어지지 않아 분쟁이 발생하는 경우 이에 관한 소송은 “갑”의 소재지를 관할하는 법원에
      제기하기로 한다.</p></section>

      <div class="closing-block">
      <p style="margin-top:8mm;">본 계약의 성립을 입증하기 위해 계약서 2부를 기명날인 후 상호 1부씩 보관한다.</p>

      <div class="sig-date">{d['sign_date']}</div>
      <div class="sig-grid">
        <div class="sig-col">
          <div class="role">“갑”</div>
          <div>{d['gap']['address']}</div>
          <div>{d['gap']['company']}</div>
          <div>사업자등록번호: {d['gap']['bizno']}</div>
          <div class="sig-line">대 표 자&nbsp;&nbsp;&nbsp;&nbsp;{d['gap']['ceo']}&nbsp;&nbsp;&nbsp;(인)</div>
        </div>
        <div class="sig-col">
          <div class="role">“을”</div>
          <div>{d['eul']['address']}</div>
          <div>{d['eul']['company']}</div>
          <div>{d['eul']['vatid']}</div>
          <div class="sig-line">대 표 자&nbsp;&nbsp;&nbsp;&nbsp;{d['eul']['ceo']}&nbsp;&nbsp;&nbsp;(인)</div>
        </div>
      </div>

      <div class="attach">[첨부] 1. 제작견적서 ({d['quote_number']})</div>
      </div>
    </div>"""

    return (f'<!DOCTYPE html><html><head><meta charset="utf-8"><title>{d["title"]}</title>'
            f'<style>{css}</style></head><body>{cover}{body1}{body2}{body3}</body></html>')


def main():
    deal = dict(DEAL)
    if len(sys.argv) > 1:
        deal.update(json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    html_path = OUT_DIR / f"{deal['outfile']}.html"
    pdf_path = OUT_DIR / f"{deal['outfile']}.pdf"
    html_path.write_text(build_html(deal), encoding="utf-8")
    print(f"wrote {html_path}")

    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf_path}", str(html_path)], check=True, capture_output=True)
    print(f"wrote {pdf_path}")

    quote_pdf = pathlib.Path(deal.get("quote_pdf") or "")
    if quote_pdf.is_file():
        from pypdf import PdfWriter
        merged = OUT_DIR / f"{deal['outfile']}_mit_Angebot.pdf"
        w = PdfWriter()
        for p in (pdf_path, quote_pdf):
            w.append(str(p))
        with open(merged, "wb") as f:
            w.write(f)
        print(f"wrote {merged} (계약서 + 견적서 합본)")


if __name__ == "__main__":
    main()
