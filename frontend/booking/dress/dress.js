/* 웨딩드레스 무료대여 — 문구는 site-dress/copy-3lang.json 이 원본(번역·원어민 검수 완료).
 * 여기 인라인한 사본이 렌더에 쓰인다. 문구 수정은 반드시 원본 JSON 을 고친 뒤 다시 인라인할 것.
 * 손으로 HTML 에 문자열을 나열하지 않는 이유: 언어 전환에서 한 줄씩 빠진다(HANDOFF §3-5).
 * 비번들 페이지 — ES import 금지, IIFE. */
(function () {
  'use strict';

  var COPY = {"ko":{"ui":{"eyebrow":"Studio mean · Oberursel","h1":"스튜디오에 있는 웨딩드레스 여섯 벌","sub":"Six dresses to borrow with your session","lede":"촬영을 예약하신 분께는 대여료 없이 빌려드립니다. 예약 전에 미리 보실 수 있도록 여섯 벌을 같은 자리에서 찍어 정리했습니다. 마음에 드는 번호를 알려 주시면 촬영 날 준비해 두겠습니다. 베일과 머리클립도 함께 쓰실 수 있습니다.","fact_fee_label":"대여료","fact_fee":"없음","fact_count_label":"보유","fact_count":"여섯 벌 · 각 한 벌","fact_size_label":"사이즈","fact_size":"S–L · 55~66","cap_full":"전체","cap_detail":"디테일","props_h":"함께 쓰실 수 있는 소품","props_lede":"드레스와 같이 빌려드립니다. 따로 받는 금액은 없습니다.","prop_veil":"흰색 베일","prop_clip":"웨딩 리본 머리클립","props_note":"두 가지는 아직 사진을 찍어 두지 않았습니다. 준비되는 대로 이 페이지에 올려 두겠습니다. 그전에 보고 싶으시면 스튜디오에 오셨을 때 함께 보여 드리겠습니다.","guide_h":"입으시기 전에 안내드립니다","g_fee_h":"대여료","g_fee_p":"촬영을 예약하신 분께는 대여료를 받지 않습니다. 촬영 당일 스튜디오에서 갈아입으시면 됩니다.","g_size_h":"사이즈","g_size_p1":"표시된 사이즈는 옷에 붙어 있는 기준을 그대로 옮긴 것입니다. 옷마다 표기 방식이 달라 한국 사이즈(55·66)로 적힌 것도 있습니다. 여섯 벌 모두 한 벌씩만 있어서, 같은 옷을 다른 치수로 준비해 드리기는 어렵습니다.","g_size_p2":"촬영을 예약하신 뒤에 스튜디오에 오시면 미리 입어 보실 수 있습니다. 방문은 꼭 미리 약속을 잡아 주시고, 주말은 촬영이 있어 어려울 수 있으니 평일에 와 주시면 좋습니다.","g_color_h":"색에 대해","g_color_p1":"여섯 벌을 같은 조명에서 찍었습니다. 01번과 02번이 아이보리에 가깝고, 나머지 네 벌은 흰색에 가깝습니다. 보시는 화면에 따라 조금 다르게 보일 수 있습니다.","g_color_p2":"02번은 비치는 레이스라 안에 입으신 옷 색이 그대로 보입니다. 아이보리나 살구색으로 준비해 오시면 좋습니다.","g_book_h":"예약","g_book_p":"드레스 번호를 함께 남겨 주시면 촬영 날 준비해 두겠습니다. 베일이나 머리클립이 필요하시면 같이 적어 주세요.","foot_addr":"Holzweg-Passage 3, 61440 Oberursel (Taunus)","foot_note":"실제 보유 중인 드레스를 찍은 사진입니다. 드레스와 소품은 계속 늘려 가고 있습니다."},"dresses":[{"no":"01","name":"튤 셔링 뷔스티에 롱드레스","sub":"Tulle slip, shirred bodice","spec":[{"label":"소재","value":"얇은 튤 여러 겹"},{"label":"색","value":"샴페인 아이보리"},{"label":"넥라인","value":"일자 · 셔링 밴드"},{"label":"어깨","value":"가는 끈, 길이 조절"},{"label":"기장","value":"발등"},{"label":"사이즈","value":"S"}],"note":"여섯 벌 가운데 색이 가장 아이보리에 가깝습니다. 튤이 얇고 겹이 많아 걸을 때 자연스럽게 흔들립니다."},{"no":"02","name":"레이스 7부소매 드레스","sub":"Sheer lace, three-quarter sleeve","spec":[{"label":"소재","value":"비치는 레이스"},{"label":"색","value":"아이보리"},{"label":"넥라인","value":"라운드"},{"label":"소매","value":"7부"},{"label":"기장","value":"종아리 아래"},{"label":"사이즈","value":"free (~66)"}],"note":"전체가 비치는 레이스입니다. 안에 입으신 옷 색이 그대로 보이니 아이보리나 살구색으로 준비해 오시면 좋습니다. 허리에는 구멍이 뚫린 레이스 띠가 둘러져 있습니다."},{"no":"03","name":"러플 숄더 롱 가운","sub":"Ruffled shoulder, with train","spec":[{"label":"소재","value":"무광 크레이프"},{"label":"색","value":"흰색"},{"label":"넥라인","value":"러플 스트랩"},{"label":"어깨","value":"주름 잡힌 러플"},{"label":"기장","value":"바닥 · 뒷자락 있음"},{"label":"사이즈","value":"M"}],"note":"뒤로 끌리는 자락이 있습니다. 스튜디오 안에서 가장 잘 살고, 야외에서는 자락이 쉽게 더러워질 수 있습니다."},{"no":"04","name":"롱슬리브 벨티드 드레스","sub":"Long sleeve, tie waist","spec":[{"label":"소재","value":"무광 크레이프"},{"label":"색","value":"흰색"},{"label":"넥라인","value":"라운드"},{"label":"소매","value":"긴소매"},{"label":"기장","value":"발목 위"},{"label":"사이즈","value":"M"}],"note":"팔이 덮이는 형이라 쌀쌀한 날이나 야외 촬영에 편합니다. 허리끈은 뒤에서 묶습니다."},{"no":"05","name":"새틴 U넥 가운","sub":"Satin, U-neck front and back","spec":[{"label":"소재","value":"광택 있는 새틴"},{"label":"색","value":"흰색"},{"label":"넥라인","value":"U넥 · 앞뒤 모두"},{"label":"어깨","value":"민소매"},{"label":"기장","value":"바닥"},{"label":"사이즈","value":"55–66"}],"note":"등이 U자로 깊게 파여 있어 뒷모습이 잘 나옵니다. 광택이 있어 빛을 그대로 받습니다."},{"no":"06","name":"퍼프 소매 스퀘어넥 드레스","sub":"Square neck, puff sleeve","spec":[{"label":"소재","value":"무광 크레이프"},{"label":"색","value":"흰색"},{"label":"넥라인","value":"스퀘어"},{"label":"소매","value":"반팔 퍼프"},{"label":"기장","value":"종아리 아래"},{"label":"사이즈","value":"L"}],"note":"여섯 벌 중 가장 짧고 가볍습니다. 걸어 다니며 찍는 야외 스냅에 편합니다."}]},"en":{"ui":{"eyebrow":"Studio mean · Oberursel","h1":"Six wedding dresses at the studio","sub":"Free to borrow when you book a session","lede":"If you have booked a session with us, you can borrow a dress at no charge. We photographed all six in the same spot so you can look through them before you book. Tell us the number you like and we will have it ready on the day of the shoot. A veil and a hair clip are available as well.","fact_fee_label":"Rental fee","fact_fee":"None","fact_count_label":"Available","fact_count":"Six dresses · one of each","fact_size_label":"Sizes","fact_size":"S–L · KR 55–66","cap_full":"Full view","cap_detail":"Detail","props_h":"Accessories you can use","props_lede":"We lend these with the dress. There is no separate charge.","prop_veil":"White veil","prop_clip":"Wedding ribbon hair clip","props_note":"We have not photographed these two yet. The pictures will go on this page as soon as they are ready. If you would like to see them sooner, we can show them to you when you come to the studio.","guide_h":"A few things to know before you wear one","g_fee_h":"Rental fee","g_fee_p":"There is no rental fee once your session is booked. You can get changed at the studio on the day of the shoot.","g_size_h":"Sizes","g_size_p1":"The sizes listed are taken straight from the label in each dress. The labelling is not consistent across the six, and some of them use Korean sizing (55 · 66). We hold one of each dress, so we cannot offer the same dress in a different size.","g_size_p2":"Once your session is booked, you are welcome to come to the studio and try a dress on beforehand. Please arrange the visit with us in advance. Weekends are usually taken up with shoots, so a weekday is easier.","g_color_h":"About the colours","g_color_p1":"All six were photographed under the same lighting. Numbers 01 and 02 are closer to ivory, the other four closer to white. Colours may look a little different on your screen.","g_color_p2":"Number 02 is sheer lace, so whatever you wear underneath shows through. Ivory or apricot works best.","g_book_h":"Booking","g_book_p":"Leave the dress number with your booking and we will have it ready on the day. Add the veil or the hair clip if you would like those too.","foot_addr":"Holzweg-Passage 3, 61440 Oberursel (Taunus)","foot_note":"These photographs show the dresses we actually hold. We are adding more dresses and accessories over time."},"dresses":[{"no":"01","name":"Shirred tulle bustier gown","spec":[{"label":"Fabric","value":"Fine tulle, several layers"},{"label":"Colour","value":"Champagne ivory"},{"label":"Neckline","value":"Straight · shirred band"},{"label":"Shoulders","value":"Thin straps, adjustable"},{"label":"Length","value":"To the top of the foot"},{"label":"Size","value":"S"}],"note":"The closest to ivory of the six. The tulle is fine and layered, so it moves softly as you walk.","sub":""},{"no":"02","name":"Lace dress with three-quarter sleeves","spec":[{"label":"Fabric","value":"Sheer lace"},{"label":"Colour","value":"Ivory"},{"label":"Neckline","value":"Round"},{"label":"Sleeves","value":"Three-quarter"},{"label":"Length","value":"Below the calf"},{"label":"Size","value":"Free (~66)"}],"note":"Sheer lace throughout. Whatever you wear underneath shows through, so ivory or apricot works best. A band of openwork lace runs around the waist.","sub":""},{"no":"03","name":"Ruffled-shoulder gown","spec":[{"label":"Fabric","value":"Matte crepe"},{"label":"Colour","value":"White"},{"label":"Neckline","value":"Ruffled straps"},{"label":"Shoulders","value":"Gathered ruffles"},{"label":"Length","value":"Floor-length · with a train"},{"label":"Size","value":"M"}],"note":"The train trails behind you. It looks its best in the studio; outdoors the train picks up dirt easily.","sub":""},{"no":"04","name":"Long-sleeve belted dress","spec":[{"label":"Fabric","value":"Matte crepe"},{"label":"Colour","value":"White"},{"label":"Neckline","value":"Round"},{"label":"Sleeves","value":"Long"},{"label":"Length","value":"Above the ankle"},{"label":"Size","value":"M"}],"note":"The long sleeves cover the arms, which is comfortable on cool days and for outdoor shoots. The waist tie fastens at the back.","sub":""},{"no":"05","name":"Satin U-neck gown","spec":[{"label":"Fabric","value":"Satin with a sheen"},{"label":"Colour","value":"White"},{"label":"Neckline","value":"U-neck · front and back"},{"label":"Shoulders","value":"Sleeveless"},{"label":"Length","value":"Floor-length"},{"label":"Size","value":"55–66"}],"note":"The back is cut in a deep U, which photographs well from behind. The satin has a sheen and catches the light directly.","sub":""},{"no":"06","name":"Square-neck dress with puff sleeves","spec":[{"label":"Fabric","value":"Matte crepe"},{"label":"Colour","value":"White"},{"label":"Neckline","value":"Square"},{"label":"Sleeves","value":"Short puff"},{"label":"Length","value":"Below the calf"},{"label":"Size","value":"L"}],"note":"The shortest and lightest of the six. Comfortable for outdoor shots where you are walking around.","sub":""}],"terminologyNotes":["The schema has no en_sub field, so each dress's Korean name and English subtitle were merged into one English name (e.g. 01 'Shirred tulle bustier gown' carries both 튤 셔링 뷔스티에 and 'shirred bodice'). No information from either line was dropped.","Korean sizes kept verbatim as figures: 'Free (~66)' and '55–66'. No UK/US equivalent invented. The g_size_p1 paragraph carries the one brief explanation that some labels use Korean sizing, so the spec rows stay clean.","'기장: 발등' rendered 'To the instep' rather than floor-length — the Korean specifies the hem falls at the top of the foot, and 05 uses '바닥' (floor-length) as a distinct value that had to stay distinguishable.","'뒷자락 있음' → 'with a train'; the note keeps 'train' for 자락 so the spec and the note read as the same feature.","British spelling used throughout for a UK-neutral read: 'Colour', 'colours', 'Matte crepe' (kept 'matte' as the standard textile term rather than 'mat').","'광택 있는 새틴' → 'Satin with a sheen' and 'takes the light directly' — avoids the glossy/shiny register, which reads promotional.","'보유' → 'Available' for the fact label, since 'In stock' would sound retail.","'입으시기 전에 안내드립니다' → 'A few things to know before you wear one' — kept as guidance rather than a 'Please note' notice-board tone.","The free-with-booking condition is stated three times in the Korean (sub-position, lede, g_fee_p) and is stated three times in English, each phrasing tying the free rental to a booked session rather than to the studio generally.","'살구색' → 'apricot' rather than 'nude' or 'skin tone' — the Korean names a colour, not a skin match."]},"de":{"ui":{"eyebrow":"Studio mean · Oberursel","h1":"Sechs Brautkleider im Studio","sub":"Sechs Kleider, die Sie sich für Ihr Shooting ausleihen können","lede":"Wenn Sie ein Shooting bei uns buchen, leihen wir Ihnen die Kleider ohne Leihgebühr. Damit Sie sich schon vor der Buchung ein Bild machen können, haben wir alle sechs an derselben Stelle fotografiert. Sagen Sie uns die Nummer, die Ihnen gefällt, dann liegt das Kleid am Tag des Shootings bereit. Schleier und Haarspange können Sie ebenfalls dazu tragen.","fact_fee_label":"Leihgebühr","fact_fee":"keine","fact_count_label":"Bestand","fact_count":"sechs Kleider · je einmal vorhanden","fact_size_label":"Größen","fact_size":"S–L · kor. 55–66","cap_full":"Gesamtansicht","cap_detail":"Detail","props_h":"Accessoires zum Ausleihen","props_lede":"Wir leihen sie zusammen mit dem Kleid aus. Dafür berechnen wir nichts zusätzlich.","prop_veil":"Weißer Schleier","prop_clip":"Braut-Haarspange mit Schleife","props_note":"Von diesen beiden Stücken haben wir noch keine Fotos. Sobald sie vorliegen, stellen wir sie hier ein. Wenn Sie die Stücke vorher sehen möchten, zeigen wir sie Ihnen bei Ihrem Besuch im Studio.","guide_h":"Was Sie vor dem Anziehen wissen sollten","g_fee_h":"Leihgebühr","g_fee_p":"Für gebuchte Shootings berechnen wir keine Leihgebühr. Umziehen können Sie sich am Tag des Shootings bei uns im Studio.","g_size_h":"Größen","g_size_p1":"Die angegebenen Größen sind unverändert vom Etikett des jeweiligen Kleides übernommen. Die Kennzeichnung ist nicht einheitlich, bei einigen Kleidern steht die koreanische Größenangabe (55 bzw. 66). Jedes der sechs Kleider gibt es nur einmal, dasselbe Modell in einer anderen Größe können wir daher nicht bereitlegen.","g_size_p2":"Nach Ihrer Buchung können Sie die Kleider im Studio vorab anprobieren. Bitte vereinbaren Sie dafür vorher einen Termin. An Wochenenden haben wir meist Shootings, unter der Woche lässt sich ein Termin leichter einrichten.","g_color_h":"Zu den Farben","g_color_p1":"Alle sechs Kleider wurden im selben Licht fotografiert. Nr. 01 und Nr. 02 gehen ins Elfenbein, die übrigen vier sind eher weiß. Je nach Bildschirm kann die Farbe etwas anders wirken.","g_color_p2":"Nr. 02 ist aus durchscheinender Spitze, die Farbe der Kleidung darunter scheint durch. Am besten bringen Sie dafür etwas in Elfenbein oder Apricot mit.","g_book_h":"Buchung","g_book_p":"Geben Sie bei der Buchung die Nummer des Kleides mit an, dann liegt es am Tag des Shootings bereit. Wenn Sie Schleier oder Haarspange möchten, schreiben Sie es bitte dazu.","foot_addr":"Holzweg-Passage 3, 61440 Oberursel (Taunus)","foot_note":"Die Fotos zeigen die Kleider, die tatsächlich bei uns im Studio hängen. Unseren Bestand an Kleidern und Accessoires bauen wir weiter aus."},"dresses":[{"no":"01","name":"Langes Tüllkleid mit gerafftem Bustier","spec":[{"label":"Material","value":"mehrere Lagen feiner Tüll"},{"label":"Farbe","value":"Champagner-Elfenbein"},{"label":"Ausschnitt","value":"gerader Ausschnitt · gerafftes Band"},{"label":"Schulter","value":"schmale Träger, längenverstellbar"},{"label":"Länge","value":"bis zum Spann"},{"label":"Größe","value":"S"}],"note":"Von den sechs Kleidern kommt dieses dem Elfenbein farblich am nächsten. Der Tüll ist fein und liegt in vielen Lagen, dadurch schwingt er beim Gehen leicht mit.","sub":"Tüll, gerafftes Oberteil"},{"no":"02","name":"Spitzenkleid mit Dreiviertelarm","spec":[{"label":"Material","value":"durchscheinende Spitze"},{"label":"Farbe","value":"Elfenbein"},{"label":"Ausschnitt","value":"Rundhalsausschnitt"},{"label":"Ärmel","value":"Dreiviertelarm"},{"label":"Länge","value":"unterhalb der Wade"},{"label":"Größe","value":"Einheitsgröße (kor. bis 66)"}],"note":"Das Kleid ist durchgehend aus durchscheinender Spitze. Die Farbe der Kleidung darunter scheint durch, am besten bringen Sie dafür etwas in Elfenbein oder Apricot mit. An der Taille verläuft ein durchbrochenes Spitzenband.","sub":"Durchscheinende Spitze, Dreiviertelarm"},{"no":"03","name":"Lange Robe mit Rüschenschulter","spec":[{"label":"Material","value":"matter Crêpe"},{"label":"Farbe","value":"Weiß"},{"label":"Ausschnitt","value":"Träger mit Rüschen"},{"label":"Schulter","value":"in Falten gelegte Rüschen"},{"label":"Länge","value":"bodenlang · mit Schleppe"},{"label":"Größe","value":"M"}],"note":"Das Kleid hat eine Schleppe, die hinten nachschleift. Im Studio kommt es am besten zur Geltung, draußen kann die Schleppe schnell schmutzig werden.","sub":"Rüschenschulter, mit Schleppe"},{"no":"04","name":"Langärmliges Kleid mit Bindegürtel","spec":[{"label":"Material","value":"matter Crêpe"},{"label":"Farbe","value":"Weiß"},{"label":"Ausschnitt","value":"Rundhalsausschnitt"},{"label":"Ärmel","value":"lang"},{"label":"Länge","value":"knöchelfrei"},{"label":"Größe","value":"M"}],"note":"Die Arme sind bedeckt, dadurch ist das Kleid an kühlen Tagen und bei Aufnahmen im Freien angenehm. Der Bindegürtel wird hinten gebunden.","sub":"Langarm, Bindegürtel"},{"no":"05","name":"Satinrobe mit U-Ausschnitt","spec":[{"label":"Material","value":"glänzender Satin"},{"label":"Farbe","value":"Weiß"},{"label":"Ausschnitt","value":"U-Ausschnitt · vorn und hinten"},{"label":"Schulter","value":"ärmellos"},{"label":"Länge","value":"bodenlang"},{"label":"Größe","value":"kor. 55–66"}],"note":"Der Rücken ist tief U-förmig ausgeschnitten, die Rückansicht kommt dadurch gut zur Geltung. Der Satin glänzt und reflektiert das Licht direkt.","sub":"Satin, U-Ausschnitt vorn und hinten"},{"no":"06","name":"Kleid mit Puffärmeln und Karree-Ausschnitt","spec":[{"label":"Material","value":"matter Crêpe"},{"label":"Farbe","value":"Weiß"},{"label":"Ausschnitt","value":"Karree-Ausschnitt"},{"label":"Ärmel","value":"kurze Puffärmel"},{"label":"Länge","value":"unterhalb der Wade"},{"label":"Größe","value":"L"}],"note":"Von den sechs Kleidern ist dieses das kürzeste und leichteste. Für Außenaufnahmen, bei denen Sie in Bewegung sind, ist es angenehm.","sub":"Karree-Ausschnitt, Puffärmel"}],"terminologyNotes":["The schema has no field for the subtitle (en_sub), so the German subtitle is appended to \"name\" after \" · \" — split on that separator if you need the two fields apart.","Garment terms: 튤 → Tüll, 레이스 → Spitze, 크레이프 → Crêpe, 새틴 → Satin, 넥라인 → Ausschnitt, 러플 → Rüschen, 퍼프 소매 → Puffärmel, 7부 소매 → Dreiviertelarm, 뒷자락 → Schleppe. 스퀘어넥 is Karree-Ausschnitt (not \"quadratischer Ausschnitt\"), 라운드 is Rundhalsausschnitt, U넥 is U-Ausschnitt, 일자 넥라인 is gerader Ausschnitt.","셔링 rendered as gerafft/Raffung, the standard German bridal term; \"gesmokt\" would imply a different (smocked) technique.","Spec labels are translated consistently across all six dresses: 소재 Material, 색 Farbe, 넥라인 Ausschnitt, 어깨 Schulter, 소매 Ärmel, 기장 Länge, 사이즈 Größe. 어깨 is Schulter everywhere even where the value names the straps, so the label set stays uniform.","Lengths: 발등 → \"bis zum Spann\", 발목 위 → \"knöchelfrei\", 종아리 아래 → \"wadenlang, unterhalb der Wade\", 바닥 → \"bodenlang\". No measurements invented.","Korean sizing kept as figures with a marker instead of an invented EU number: \"kor. 55–66\", \"Einheitsgröße (kor. bis 66)\", and \"S–L · kor. 55–66\" in the fact strip. The size guidance paragraph explains that these are Korean labels taken straight from the garment tag.","무료대여 is never rendered as a bare \"kostenlos\": the condition is stated each time — \"Wenn Sie ein Shooting bei uns buchen, leihen wir Ihnen die Kleider ohne Leihgebühr\" and \"Für gebuchte Shootings berechnen wir keine Leihgebühr\".","촬영 → Shooting throughout (standard usage for a German photo studio), 스튜디오 → Studio, 소품 → Accessoires (Requisiten would read as film props).","Colours: 아이보리 → Elfenbein, 샴페인 아이보리 → Champagner-Elfenbein, 살구색 → Apricot.","Formal \"Sie\" throughout, no exclamation marks, no added promises, prices or measurements."]},"slugs":{"01":"ivory-tulle","02":"ivory-lace","03":"ruffle-shoulder","04":"longsleeve-bow","05":"satin-slip","06":"puff-square"}};

  /* 사진 규칙: {no}-main-1/2, {no}-detail-1(·2), {no}-thumb — 03·06 은 detail 1장 */
  var DETAIL_COUNT = { '01': 2, '02': 2, '03': 1, '04': 2, '05': 2, '06': 1 };
  var P = '/dress/photos/';

  var LANG_KEY = 'studio-mean-lang';   // booking.js·promo.js 와 공유 — 예약 페이지에서 고른 언어가 이어진다

  function getInitialLang() {
    var params = new URLSearchParams(window.location.search);
    var q = String(params.get('lang') || '').trim().toLowerCase();
    if (q === 'en' || q === 'de' || q === 'ko') return q;
    try {
      var saved = window.localStorage.getItem(LANG_KEY) || 'ko';
      if (saved === 'en' || saved === 'de' || saved === 'ko') return saved;
    } catch (_) {}
    return 'ko';
  }
  function setSavedLang(lang) {
    try { window.localStorage.getItem && window.localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  }

  var lang = getInitialLang();

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function t(key) { return (COPY[lang] && COPY[lang].ui && COPY[lang].ui[key]) || ''; }

  function img(src, alt, w, h, cls) {
    return '<img src="' + src + '" alt="' + esc(alt) + '" width="' + w + '" height="' + h + '" loading="lazy"' + (cls ? ' class="' + cls + '"' : '') + '>';
  }

  function renderHead() {
    document.getElementById('pageHead').innerHTML =
      '<p class="eyebrow">' + esc(t('eyebrow')) + '</p>' +
      '<h1>' + esc(t('h1')) + '</h1>' +
      '<p class="head-sub">' + esc(t('sub')) + '</p>' +
      '<p class="lede">' + esc(t('lede')) + '</p>' +
      '<dl class="facts">' +
        ['count', 'size', 'fee'].map(function (k) {
          return '<div><dt>' + esc(t('fact_' + k + '_label')) + '</dt><dd>' + esc(t('fact_' + k)) + '</dd></div>';
        }).join('') +
      '</dl>';
  }

  function renderIndex() {
    var dresses = COPY[lang].dresses;
    document.getElementById('indexStrip').innerHTML = dresses.map(function (d) {
      return '<a href="#d' + d.no + '">' +
        img(P + d.no + '-thumb.jpg', d.name, 360, 540) +
        '<span>' + d.no + '</span></a>';
    }).join('');
  }

  function renderRecords() {
    var dresses = COPY[lang].dresses;
    document.getElementById('records').innerHTML = dresses.map(function (d) {
      var plates = [];
      ['-main-1', '-main-2'].forEach(function (sfx) {
        plates.push({ src: P + d.no + sfx + '.jpg', cap: t('cap_full') });
      });
      for (var i = 1; i <= (DETAIL_COUNT[d.no] || 2); i++) {
        plates.push({ src: P + d.no + '-detail-' + i + '.jpg', cap: t('cap_detail') });
      }
      return '<article class="record" id="d' + d.no + '">' +
        '<div class="rec">' +
          '<p class="num">' + d.no + '</p>' +
          '<h2>' + esc(d.name) + '</h2>' +
          (String(d.sub || '').trim() ? '<p class="rec-sub">' + esc(d.sub) + '</p>' : '') +
          '<dl class="spec">' + d.spec.map(function (row) {
            return '<div><dt>' + esc(row.label) + '</dt><dd>' + esc(row.value) + '</dd></div>';
          }).join('') + '</dl>' +
          (String(d.note || '').trim() ? '<p class="note">' + esc(d.note) + '</p>' : '') +
        '</div>' +
        '<div class="plates">' + plates.map(function (pl) {
          return '<figure class="plate"><button type="button" data-full="' + pl.src + '" aria-label="' + esc(d.name + ' — ' + pl.cap) + '">' +
            img(pl.src, d.name + ' — ' + pl.cap, 1000, 1500) +
            '</button><figcaption>' + esc(pl.cap) + '</figcaption></figure>';
        }).join('') + '</div>' +
      '</article>';
    }).join('');
  }

  function renderProps() {
    document.getElementById('propsSec').innerHTML =
      '<h2>' + esc(t('props_h')) + '</h2>' +
      '<p class="props-lede">' + esc(t('props_lede')) + '</p>' +
      '<ul class="proplist"><li>' + esc(t('prop_veil')) + '</li><li>' + esc(t('prop_clip')) + '</li></ul>' +
      '<p class="props-note">' + esc(t('props_note')) + '</p>';
  }

  function renderGuide() {
    var blocks = [
      { h: 'g_fee_h', ps: ['g_fee_p'] },
      { h: 'g_size_h', ps: ['g_size_p1', 'g_size_p2'] },
      { h: 'g_color_h', ps: ['g_color_p1', 'g_color_p2'] },
      { h: 'g_book_h', ps: ['g_book_p'], cta: true }
    ];
    document.getElementById('guideSec').innerHTML =
      '<h2>' + esc(t('guide_h')) + '</h2>' +
      '<div class="cols">' + blocks.map(function (b) {
        return '<section><h3>' + esc(t(b.h)) + '</h3>' +
          b.ps.map(function (k) { return t(k) ? '<p>' + esc(t(k)) + '</p>' : ''; }).join('') +
          (b.cta ? '<a class="cta" href="https://booking.studio-mean.com/?lang=' + lang + '">booking.studio-mean.com</a>' : '') +
        '</section>';
      }).join('') + '</div>';
  }

  function renderFoot() {
    document.getElementById('footNote').textContent = t('foot_note');
  }

  function renderAll() {
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    renderHead(); renderIndex(); renderRecords(); renderProps(); renderGuide(); renderFoot();
  }

  /* 라이트박스 */
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-full]');
    if (btn) {
      lbImg.src = btn.dataset.full;
      lbImg.alt = btn.getAttribute('aria-label') || '';
      lb.classList.add('open');
      return;
    }
    if (e.target === lb || e.target.id === 'lbClose') {
      lb.classList.remove('open');
      lbImg.removeAttribute('src');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { lb.classList.remove('open'); lbImg.removeAttribute('src'); }
  });

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.lang === lang) return;
      lang = btn.dataset.lang;
      setSavedLang(lang);
      renderAll();
    });
  });

  renderAll();
})();
