#!/usr/bin/env bash
# 납품 원본 폴더를 윈도우에서 그냥 열리는 여러 개의 zip 으로 나눈다. (macOS / Linux)
#
# 왜: 이윤경(260810) 건에서 원본 약 1,800장 / 7GB대가 고객 Drive 폴더에 그대로 올라갔다.
#     Drive 웹 다운로드는 이 규모에서 압축을 만들다 실패하고, 고객 화면은 스크롤이 끝없이 내려간다.
#
# 왜 분할 압축(.zip.001)이 아닌가: 진짜 분할 볼륨은 윈도우 탐색기가 못 연다 — 받는 쪽에 7-Zip 이
#     있어야 한다. 그래서 볼륨 분할 대신 **각각 독립적으로 열리는 zip 여러 개**로 나눈다.
#     고객은 아무것도 설치하지 않고 하나씩 더블클릭하면 된다.
#
# 사용법:
#   ./split-delivery-zips.sh "/Volumes/작업/260810_이윤경" "/Volumes/작업/260810_이윤경_압축본"
#   CHUNK_MB=1000 ./split-delivery-zips.sh <원본> <대상>

set -euo pipefail

SRC="${1:-}"
DEST="${2:-}"
CHUNK_MB="${CHUNK_MB:-1500}"

if [[ -z "$SRC" || -z "$DEST" ]]; then
  echo "사용법: $0 <원본폴더> <대상폴더>   (환경변수 CHUNK_MB 로 조각 크기 조절, 기본 1500)" >&2
  exit 2
fi
[[ -d "$SRC" ]] || { echo "원본 폴더를 찾을 수 없습니다: $SRC" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip 이 필요합니다." >&2; exit 1; }

PREFIX="$(basename "$SRC")"
mkdir -p "$DEST"

# 사진만 — .DS_Store, Thumbs.db, xmp 사이드카가 섞여 들어가지 않게.
LIST="$(mktemp)"; trap 'rm -f "$LIST"' EXIT
find "$SRC" -maxdepth 1 -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \
     -o -iname '*.heif' -o -iname '*.tif' -o -iname '*.tiff' -o -iname '*.webp' \) \
  | LC_ALL=C sort > "$LIST"

COUNT=$(wc -l < "$LIST" | tr -d ' ')
[[ "$COUNT" -gt 0 ]] || { echo "원본 폴더에 사진 파일이 없습니다: $SRC" >&2; exit 1; }

# stat 플래그가 BSD(macOS)와 GNU 에서 다르다.
if stat -f%z "$SRC" >/dev/null 2>&1; then fsize() { stat -f%z "$1"; }; else fsize() { stat -c%s "$1"; }; fi

TOTAL=0
while IFS= read -r f; do TOTAL=$((TOTAL + $(fsize "$f"))); done < "$LIST"
printf '원본 %s장 · %.1fGB · 조각당 최대 %sMB\n' "$COUNT" "$(echo "$TOTAL/1073741824" | bc -l)" "$CHUNK_MB"

LIMIT=$((CHUNK_MB * 1024 * 1024))

# 1차: 조각 개수만 센다(이름에 총 개수를 넣어야 해서).
PARTS=1; ACC=0
while IFS= read -r f; do
  SZ=$(fsize "$f")
  if [[ "$ACC" -gt 0 && $((ACC + SZ)) -gt "$LIMIT" ]]; then PARTS=$((PARTS + 1)); ACC=0; fi
  ACC=$((ACC + SZ))
done < "$LIST"

PAD=${#PARTS}
MANIFEST="$DEST/목록.txt"
{
  echo "$PREFIX — 분할 압축 목록"
  echo "생성: $(date '+%Y-%m-%d %H:%M')"
  echo "원본 ${COUNT}장 · 조각 ${PARTS}개"
  echo
} > "$MANIFEST"

# 2차: 실제로 담는다. -0 은 무압축(JPEG 는 이미 압축돼 있어 재압축은 시간만 몇 배 든다),
# -j 는 경로 제거, -X 는 맥 확장속성 제외(윈도우에서 __MACOSX 쓰레기가 안 보이게).
part=1; acc=0; n=0; first=''; last=''; chunk="$(mktemp)"
flush() {
  [[ "$n" -eq 0 ]] && return 0
  local name; name="$(printf '%s_%0*dof%d.zip' "$PREFIX" "$PAD" "$part" "$PARTS")"
  local out="$DEST/$name"
  rm -f "$out"
  printf '[%d/%d] %s — %d장 압축 중...\n' "$part" "$PARTS" "$name" "$n"
  zip -0 -j -X -q "$out" -@ < "$chunk"
  local mb; mb=$(echo "$(fsize "$out")/1048576" | bc -l)
  printf '%s  |  %5d장  |  %8.1fMB  |  %s ~ %s\n' "$name" "$n" "$mb" "$first" "$last" >> "$MANIFEST"
  part=$((part + 1)); acc=0; n=0; first=''; last=''; : > "$chunk"
}
trap 'rm -f "$LIST" "$chunk"' EXIT

while IFS= read -r f; do
  SZ=$(fsize "$f")
  if [[ "$n" -gt 0 && $((acc + SZ)) -gt "$LIMIT" ]]; then flush; fi
  echo "$f" >> "$chunk"
  acc=$((acc + SZ)); n=$((n + 1))
  [[ -z "$first" ]] && first="$(basename "$f")"
  last="$(basename "$f")"
done < "$LIST"
flush

echo
echo "완료 — $DEST 에 zip ${PARTS}개 + 목록.txt"
echo "이 폴더의 파일들을 Drive 압축본 폴더에 업로드하면 됩니다."
