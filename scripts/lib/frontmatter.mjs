// Shared indent-aware frontmatter parser (audit B3). Handles flat keys,
// inline arrays, dash lists, and ONE level of nesting (the ontology block).
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const root = {};
  let ctx = root;          // current object receiving keys
  let ctxKey = null;       // key in root that ctx is nested under
  let listKey = null;      // key receiving dash-list items
  for (const raw of m[1].split(/\r?\n/)) {
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const item = line.match(/^-\s+(.+)$/);
    if (item && listKey) {
      (Array.isArray(ctx[listKey]) ? ctx[listKey] : (ctx[listKey] = [])).push(strip(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    if (indent === 0) { ctx = root; ctxKey = null; }
    const [, key, rawVal] = kv;
    const val = rawVal.trim();
    if (val === "") {
      // could be a nested object or an upcoming dash list
      if (indent === 0) { root[key] = {}; ctx = root[key]; ctxKey = key; listKey = null; }
      else { ctx[key] = []; listKey = key; }
      continue;
    }
    listKey = (val === "") ? key : null;
    if (val.startsWith("[")) {
      ctx[key] = val.slice(1, val.lastIndexOf("]")).split(",").map(s => strip(s)).filter(Boolean);
    } else {
      ctx[key] = strip(val);
    }
    if (indent === 0 && typeof ctx[key] !== "object") listKey = null;
    if (indent === 0) listKey = Array.isArray(root[key]) ? key : listKey;
    if (indent === 0 && val === "") listKey = key;
  }
  // normalize: nested objects whose only content is arrays stay as-is
  return root;
}
function strip(s) {
  s = s.trim();
  const c = s.match(/^#/) ? s : s.replace(/\s+#.*$/, "");
  return c.replace(/^["']|["']$/g, "").trim();
}

export function parseCaseFile(text) {
  const fm = parseFrontmatter(text);
  if (!fm) return null;
  // top-level dash lists (refs:) are captured by the nested-object path when
  // value empty at indent 0; normalize {} → [] where all children are items
  if (fm.refs && !Array.isArray(fm.refs) && typeof fm.refs === "object") {
    fm.refs = Object.values(fm.refs);
  }
  return fm;
}
