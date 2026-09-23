#!/usr/bin/env bash
# CLI byte-parity check for devlog/260923_mcp-server/010. Run from the repo root.
# Old = scripts/ at b59324b under bun; new = working-tree scripts/ under bun and node.
# Both read the same corpus: a git archive of b59324b in separate temp trees.
set -u
BASE=b59324b
T=$(mktemp -d)
mkdir -p "$T/old" "$T/new" "$T/out"
git archive "$BASE" | tar -x -C "$T/old"
git archive "$BASE" | tar -x -C "$T/new"
cp -R scripts/. "$T/new/scripts/"
(cd "$T/old" && bun scripts/build-graph.mjs >/dev/null)   # the old CLI reads graph.json
cat > "$T/queries.txt" <<'EOF'
preflight --runtime node --operation spawn --target npm
preflight --runtime node --operation spawn --target npm --json
preflight --runtime powershell --operation encoding
preflight --runtime powershell --shell 7 --operation redirect --target python
preflight --operation ci
search iex exit terminal
search zzzz-no-hit
errors einval
errors error-enoent
errors nothing-here
case curl-alias
case not-a-case

bogus
EOF
capture() {   # capture <tree> <runtime> <label>
  local tree=$1 rt=$2 label=$3 i=0 q
  while IFS= read -r q; do
    i=$((i+1))
    eval "set -- $q"
    (cd "$T/$tree" && "$rt" scripts/fp.mjs "$@" >"$T/out/$label.$i.out" 2>"$T/out/$label.$i.err"; echo $? >"$T/out/$label.$i.code")
  done < "$T/queries.txt"
}
capture old bun old
capture new bun newbun
capture new node newnode
fail=0; n=0
for f in "$T"/out/old.*; do
  suffix=${f#"$T/out/old."}
  for label in newbun newnode; do
    n=$((n+1))
    cmp -s "$f" "$T/out/$label.$suffix" || { echo "DIFF $label $suffix"; fail=1; }
  done
done
echo "queries=$(wc -l < "$T/queries.txt") comparisons=$n fail=$fail tmp=$T"
exit $fail
