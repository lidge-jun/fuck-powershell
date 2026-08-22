# 001 — Upstream verification (Luna swarm, sources opened)

All claims verified against official docs by 3 Luna lanes (proof ladder applied):

- && / || added in PowerShell 7.0 (about_Pipeline_Chain_Operators). Confirms
  ps51-no-and-and versions: "5.1".
- ConvertTo-Json depth WARNING added in 7.1 (docs). → convertto-json-depth-two
  should carry behavior-change note: silent truncation on 5.1/7.0, warning 7.1+.
  Edge material: supersedes/requires modeling later; body note for now.
- $PSNativeCommandArgumentPassing: 7.3 changed parsing; default Windows='Windows'
  (legacy carve-out list incl cmd.exe/.bat/.cmd), non-Windows='Standard'.
  Enriches oss-native-arg-quoting accuracy.
- Execution policy: client SKUs default Restricted, Server RemoteSigned
  (about_Execution_Policies). Confirms execution-policy-file-block.
- CVE-2024-27980: EINVAL for .bat/.cmd spawn without shell — 18.20.2/20.12.2/
  21.7.3; follow-up CVE-2024-36138 (18.20.4/20.15.1/22.4.1). DEP0190 deprecates
  shell+.bat spawning. Confirms spawn-npm-enoent-einval + cmd-shim-reparses-argv.
- path.delimiter host-dependent (';' win / ':' posix); path.win32 for
  cross-platform determinism. Confirms node-path-host-delimiter/path-colon.

Prior art (ontology shape benchmarks): agent-reliability-corpus (4-axis
taxonomy), AdaMAST (evidence-backed failure catalogs), llm-failure-taxonomy
(machine-readable YAML + classifier), CII FMEA OWL ontology. Our
locus→symptom→cause→remediation edge shape aligns with FMEA practice.
