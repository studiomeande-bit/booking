#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMP_DIR="$(mktemp -d /private/tmp/studio-portfolio-refresh.XXXXXX)"
OUT_JSON="$SCRIPT_DIR/portfolio-data.json"

ROOT_ID="1OPRMHbnh6ctci8jmLjlOb7dlHMReG1jT"
FOLDER_IDS=(
  "15K1jTxDEqRBAvJEgFV4c2wQXw4g1_C-b"
  "1YE5NfObgc_8FFOBcdAgfAziUOLLuk8V6"
  "1WuXFBBepxPLbr0L0eBVX4Y5ysRb8mq3N"
  "1xtUATMeWyZi47wf5zgT25459urlnU_hi"
  "1kOF4NvB887x7bXbngcyPE-64NL3vLmiT"
  "17Lcj2wb107iLpvn1UMEu_wb0gJiv0lws"
)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Downloading Drive folder HTML…"
curl -L -A "Mozilla/5.0" "https://drive.google.com/drive/folders/$ROOT_ID" -o "$TMP_DIR/root.html"
for id in "${FOLDER_IDS[@]}"; do
  curl -L -A "Mozilla/5.0" "https://drive.google.com/drive/folders/$id" -o "$TMP_DIR/$id.html"
done

python3 "$SCRIPT_DIR/generate-portfolio-data.py" "$TMP_DIR" "$OUT_JSON"
echo "Portfolio data refreshed: $OUT_JSON"
