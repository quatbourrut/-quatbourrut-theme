#!/bin/bash
set -euo pipefail

SRC_DIR="$HOME/Downloads/images-produits"
OUT_DIR="$HOME/Downloads/images-optimisees"

# ── Couleurs ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
human_size() {
  local bytes=$1
  if   ((bytes >= 1048576)); then awk "BEGIN {printf \"%.1f Mo\", $bytes/1048576}"
  elif ((bytes >= 1024));    then awk "BEGIN {printf \"%.1f Ko\", $bytes/1024}"
  else                            echo "${bytes} o"
  fi
}

# ── Vérifications ─────────────────────────────────────────────────────────────
if ! command -v sharp &>/dev/null; then
  echo -e "${RED}Erreur : sharp-cli introuvable. Lance : npm install -g sharp-cli${RESET}"
  exit 1
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo -e "${RED}Erreur : dossier source introuvable :${RESET} $SRC_DIR"
  exit 1
fi

mkdir -p "$OUT_DIR"

# ── Collecte des fichiers (compatible bash 3.2 / macOS) ──────────────────────
FILES=()
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(find "$SRC_DIR" -maxdepth 1 -type f \
  \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) -print0 | sort -z)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo -e "${YELLOW}Aucune image JPG/JPEG/PNG trouvée dans $SRC_DIR${RESET}"
  exit 0
fi

# ── En-tête ───────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}Compression WebP — $(date '+%d/%m/%Y %H:%M')${RESET}"
echo -e "  Source  : $SRC_DIR"
echo -e "  Sortie  : $OUT_DIR"
echo -e "  Options : WebP qualité 80 · max 1200 px de large · sans agrandissement"
echo
printf '%.0s─' {1..72}; echo

total_before=0
total_after=0
count_ok=0
count_err=0

# ── Boucle principale ─────────────────────────────────────────────────────────
for file in "${FILES[@]}"; do
  filename=$(basename "$file")
  stem="${filename%.*}"
  out_webp="$OUT_DIR/${stem}.webp"
  out_same="$OUT_DIR/${filename}"   # nom que sharp produit par défaut

  before=$(wc -c < "$file" | tr -d ' ')

  if sharp \
      -i "$file" \
      -o "$OUT_DIR" \
      -f webp \
      -q 80 \
      resize 1200 --withoutEnlargement \
      2>/dev/null
  then
    # sharp conserve l'extension d'origine — on renomme en .webp si besoin
    if [[ -f "$out_same" && "$out_same" != "$out_webp" ]]; then
      mv "$out_same" "$out_webp"
    fi

    if [[ -f "$out_webp" ]]; then
      after=$(wc -c < "$out_webp" | tr -d ' ')
      saved=$((before - after))
      pct=$(( before > 0 ? saved * 100 / before : 0 ))

      total_before=$((total_before + before))
      total_after=$((total_after + after))
      count_ok=$((count_ok + 1))

      if ((saved > 0)); then
        echo -e "  ${GREEN}✓${RESET} ${BOLD}${stem}.webp${RESET}"
        printf  "    %s → %s   ${GREEN}−%d%% (%s économisés)${RESET}\n" \
          "$(human_size "$before")" "$(human_size "$after")" "$pct" "$(human_size "$saved")"
      else
        echo -e "  ${YELLOW}~${RESET} ${BOLD}${stem}.webp${RESET}"
        printf  "    %s → %s   ${YELLOW}résultat plus lourd en WebP (conservé quand même)${RESET}\n" \
          "$(human_size "$before")" "$(human_size "$after")"
      fi
    else
      echo -e "  ${RED}✗${RESET} ${filename} — fichier de sortie introuvable"
      count_err=$((count_err + 1))
    fi
  else
    echo -e "  ${RED}✗${RESET} ${filename} — erreur sharp-cli"
    count_err=$((count_err + 1))
  fi
done

# ── Résumé ────────────────────────────────────────────────────────────────────
printf '%.0s─' {1..72}; echo

total_saved=$((total_before - total_after))
total_pct=$(( total_before > 0 ? total_saved * 100 / total_before : 0 ))

echo -e "\n${BOLD}Résumé${RESET}"
echo -e "  Images traitées : ${count_ok}   Erreurs : ${count_err}"
echo -e "  Poids avant     : $(human_size "$total_before")"
echo -e "  Poids après     : $(human_size "$total_after")"
echo -e "  ${BOLD}${GREEN}Gain total      : $(human_size "$total_saved") (${total_pct}% de réduction)${RESET}"
echo -e "\n  Fichiers WebP dans : $OUT_DIR\n"
