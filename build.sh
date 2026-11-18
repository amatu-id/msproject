#!/bin/bash
# Cap versi ke index.html (?v=<hash> pada css/js; cache GitHub Pages ±10 menit) + versi.txt, periksa sintaks semua skrip.
set -e
cd "$(dirname "$0")"
for f in js/*.js; do node --check "$f"; done
H=$(cat index.src.html app.css js/*.js | shasum | cut -c1-12)
sed "s/%%VERSI%%/$H/g" index.src.html > index.html
echo "$H" > versi.txt
echo "versi $H"
