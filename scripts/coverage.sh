#!/usr/bin/env bash
# Run all backend tests with coverage and aggregate to coverage-report/.
set -euo pipefail

cd "$(dirname "$0")/.."

ROOT="$(pwd)"
OUT="$ROOT/TestResults"

rm -rf "$OUT"
mkdir -p "$OUT"

dotnet test Trsr.sln \
  --settings "$ROOT/coverage.runsettings" \
  --collect:"XPlat Code Coverage" \
  --results-directory "$OUT" \
  --logger "console;verbosity=minimal"

echo
echo "Coverage reports:"
find "$OUT" -name "coverage.cobertura.xml" -print

python3 - <<'PY'
import xml.etree.ElementTree as ET, glob, os
from collections import defaultdict

covered = defaultdict(set)
total = defaultdict(set)

for f in glob.glob("TestResults/**/coverage.cobertura.xml", recursive=True):
    root = ET.parse(f).getroot()
    for cls in root.iter("class"):
        fname = cls.get("filename")
        if not fname or "/Migrations/" in fname: continue
        for line in cls.iter("line"):
            num = int(line.get("number"))
            total[fname].add(num)
            if int(line.get("hits")) > 0:
                covered[fname].add(num)

layers = defaultdict(lambda: [0, 0])
for fname, t in total.items():
    layer = next((p for p in fname.split("/") if p.startswith("Trsr.")), "other")
    layers[layer][0] += len(covered[fname])
    layers[layer][1] += len(t)

print()
print(f"{'Layer':<25} {'Cov':>6} {'Tot':>6} {'Pct':>7}")
tc = tt = 0
for l, (c, t) in sorted(layers.items()):
    p = c/t*100 if t else 0
    print(f"{l:<25} {c:>6} {t:>6} {p:>6.1f}%")
    tc += c; tt += t
print(f"{'TOTAL':<25} {tc:>6} {tt:>6} {tc/tt*100:>6.1f}%")
PY
