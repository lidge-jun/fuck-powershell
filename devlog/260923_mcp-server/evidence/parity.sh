#!/usr/bin/env bash
# CLI parity check for devlog/260923_mcp-server/010. Run from the repo root.
# Old = scripts/ at b59324b under bun; new = working-tree scripts/ under bun and node.
# Both read the same corpus: a git archive of b59324b in separate temp trees.
# Contract (010 "Tie order" amendment):
#   new bun vs new node: stdout, stderr and exit code byte-identical.
#   old vs new: stderr and exit code byte-identical; stdout identical, or differing only
#   among equal scores: the sequence of scores (and the risk line) must match exactly.
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
# score sequence of a CLI stdout: leading integers of ranked lines, "score": values in
# JSON, and the risk line. Two outputs with equal sequences differ only among ties.
scores() {
  node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8");
    const s=[...t.matchAll(/^\s*(\d+)  \S/gm)].map(m=>m[1]).concat([...t.matchAll(/"score": (\d+)/g)].map(m=>m[1]));
    const r=(t.match(/^risk: \w+|"risk": "\w+"/m)||[""])[0]; console.log(r+"|"+s.join(","))' "$1"
}
fail=0; n=0; ties=0
for f in "$T"/out/newbun.*; do
  suffix=${f#"$T/out/newbun."}
  n=$((n+1))
  cmp -s "$f" "$T/out/newnode.$suffix" || { echo "DIFF bun-vs-node $suffix"; fail=1; }
done
for f in "$T"/out/old.*; do
  suffix=${f#"$T/out/old."}
  n=$((n+1))
  cmp -s "$f" "$T/out/newbun.$suffix" && continue
  case "$suffix" in
    *.out)
      if [ "$(scores "$f")" = "$(scores "$T/out/newbun.$suffix")" ]; then
        echo "TIE-ORDER $suffix"; ties=$((ties+1))
      else
        echo "DIFF old-vs-new $suffix (score sequence changed)"; fail=1
      fi ;;
    *) echo "DIFF old-vs-new $suffix"; fail=1 ;;
  esac
done
echo "queries=$(wc -l < "$T/queries.txt") comparisons=$n tie_order_only=$ties fail=$fail tmp=$T"
exit $fail
