---
id: wsl-unc-rejects-nt-acl
title: "your ACL hardening fails on a WSL path because a wsl.localhost UNC root has no NTFS security descriptor to harden"
category: env-paths
versions: "both"
failure: hard-error
context: [script, agent, ci]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/41
  - https://github.com/openai/codex/commit/8a2bc6d9
ontology:
  affects: [env-windows, env-win32-api]
  invokes: [command-icacls]
  manifests_as: [error-eperm]
  caused_by: [mechanism-unc-provider-semantics]
  mitigated_by: [workaround-skip-acl-unsupported-roots]
---

# your ACL hardening fails on a WSL path because a wsl.localhost UNC root has no NTFS security descriptor to harden

## Symptom

A routine that locks down directories — a sandbox setting deny-write roots, an
installer securing a config directory — fails only for users who work inside WSL:

```
\\wsl.localhost\Ubuntu\home\me\project: Access is denied.
```

The path exists. Explorer opens it. `dir` lists it. Elevation does not help, and
neither does taking ownership, because there is nothing there to own.

## Repro

```
C:\> dir \\wsl.localhost\Ubuntu\home\me
 Directory of \\wsl.localhost\Ubuntu\home\me
 ... lists normally ...

C:\> icacls \\wsl.localhost\Ubuntu\home\me
 ... the security operation does not apply to this provider ...
```

The path reads and lists like any other, and the security call is the one that
refuses. Four spellings reach the same store — `\\wsl.localhost\`, the older
`\\wsl$\`, and both under the extended-length `\\?\UNC\` prefix — which is why
a skip list has to cover all four.

## Cause

`\\wsl.localhost\...` is a UNC path served by the WSL 9P filesystem provider, not
by NTFS. Its backing store is a Linux filesystem with POSIX mode bits and no
Windows security descriptors, so there is no DACL for `icacls` or
`SetNamedSecurityInfo` to read or write. The refusal is the provider correctly
reporting that the operation does not apply.

The general rule this instance teaches: on Windows, "it is a path" does not imply
"it supports the filesystem operations you know". A UNC path may be served by a
provider with entirely different semantics — WSL's 9P, a WebDAV mount, a network
redirector — and the ones that matter here fail on security operations rather
than on reads.

POSIX has no equivalent trap because a mount either supports an operation or
returns a clear `ENOTSUP`, and permission bits exist everywhere. Here the error
is `Access is denied`, which reads as a permissions problem and sends you toward
elevation — the one thing that cannot possibly help.

## Verification note

The originating commit (openai/codex `8a2bc6d9`) unit-tests the prefix matching;
it does not contain a captured `icacls` transcript, and none was produced in this
loop. What is documented independently is the architecture: WSL2 serves
`\\wsl.localhost` and `\\wsl$` through a 9P redirector backed by a Linux
filesystem, which has POSIX mode bits and no Windows security descriptors. The
exact error text a given ACL call returns, and whether WSL1's VolFs behaves
identically, are NOT established here — WSL1 uses a different provider. Hence
`repro: historical`.

## Workaround

Detect the roots that cannot carry ACLs and skip them rather than failing:

```rust
fn is_acl_unsupported_root(path: &Path) -> bool {
    let key = canonical_path_key(path);   // lowercased, forward slashes
    key.starts_with("//wsl.localhost/")
        || key.starts_with("//wsl$/")
        || key.starts_with("//?/unc/wsl.localhost/")
        || key.starts_with("//?/unc/wsl$/")
}
```

Canonicalize before matching — all four prefixes are the same root, and casing
varies — and treat the skip as a REPORTED outcome rather than a silent one. A
directory you meant to harden and could not is a security fact the caller should
see, even though failing the whole run would be worse.

Do not attempt to substitute POSIX permissions through WSL. The Windows-side
process cannot set them meaningfully, and a `chmod` through interop introduces a
dependency on a running distribution.

---

`icacls-inheritance-r-empty-dacl` is about getting the ACL sequence wrong on a
filesystem that has ACLs. This is the case where the filesystem has none at all,
and the tell is that elevation changes nothing.
