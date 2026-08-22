---
title: Mechanisms
description: Root causes shared across cases.
---

## absent builtin noop

POSIX builtins absent in PowerShell (command -v) parse as argument noise and fail silently instead of erroring.

Cases: [command-v-noop](/fuck-powershell/cases/aliases/command-v-noop/)

## folder lookup answers empty instead of failing

A known-folder lookup verifies the directory before answering and returns an empty string rather than an error when it is absent, and that empty string is a valid argument to every path function downstream, so the failure becomes a relative path instead of an exception.

Cases: [known-folder-empty-not-error](/fuck-powershell/cases/env-paths/known-folder-empty-not-error/)

## non-atomic ACL mutation order

Windows permissions are changed by a sequence of separate mutations with no atomic replace, and removing inheritance takes effect immediately, so an interrupted restrict-then-grant order leaves an empty DACL that denies everyone including the owner.

Cases: [icacls-inheritance-r-empty-dacl](/fuck-powershell/cases/env-paths/icacls-inheritance-r-empty-dacl/)

## alias shadowing

Built-in aliases (curl, wget) and PATH shims shadow the binaries users intend to run.

Cases: [ps51-vs-7-split](/fuck-powershell/cases/versions/ps51-vs-7-split/) · [curl-alias](/fuck-powershell/cases/aliases/curl-alias/)

## appexeclink

WindowsApps store aliases are zero-byte IO_REPARSE_TAG_APPEXECLINK files that pass stat probes but EPERM on spawn.

Cases: [windowsapps-alias-eperm](/fuck-powershell/cases/env-paths/windowsapps-alias-eperm/)

## bom sniffing

Windows PowerShell 5.1 decides a script file's encoding by BOM presence; no BOM means the legacy ANSI code page.

Cases: [bom-less-ps1-cp949](/fuck-powershell/cases/encoding/bom-less-ps1-cp949/)

## bun windowstyle argv reject

Bun 1.3.14 Windows spawn fails outright when powershell.exe argv contains the -WindowStyle Hidden pair.

Cases: [bun-ps-windowstyle-argv](/fuck-powershell/cases/args-quoting/bun-ps-windowstyle-argv/)

## cmd bat spawn hardening

Node CVE-2024-27980 hardening: spawning .bat/.cmd without shell errors EINVAL (18.20.2/20.12.2/21.7.3+).

Cases: [spawn-npm-enoent-einval](/fuck-powershell/cases/aliases/spawn-npm-enoent-einval/)

## cmd reparse

Any command line routed through cmd.exe is re-tokenized; metacharacters and newlines inside arguments become command syntax.

Cases: [cmd-start-ampersand-splits](/fuck-powershell/cases/args-quoting/cmd-start-ampersand-splits/) · [cmd-shim-reparses-argv](/fuck-powershell/cases/args-quoting/cmd-shim-reparses-argv/) · [shell-true-fallback-injects](/fuck-powershell/cases/args-quoting/shell-true-fallback-injects/) · [get-command-where-disagree](/fuck-powershell/cases/aliases/get-command-where-disagree/)

## collection unrolling

PowerShell unrolls pipelines: zero items become null, one item loses its array, many become Object[] — types change with count.

Cases: [if-nativecmd-truthiness](/fuck-powershell/cases/exit-codes/if-nativecmd-truthiness/) · [get-content-scalar-collapse](/fuck-powershell/cases/collections/get-content-scalar-collapse/) · [return-does-not-mean-return](/fuck-powershell/cases/collections/return-does-not-mean-return/)

## comparison as filter

Comparison operators against a collection FILTER it (returning matching elements) instead of returning a boolean.

Cases: [ne-filters-instead-of-compares](/fuck-powershell/cases/collections/ne-filters-instead-of-compares/)

## console allocation

Console-subsystem binaries get a new console at CreateProcess when the parent has none — before any flag is parsed.

Cases: [windowstyle-hidden-vs-windowshide](/fuck-powershell/cases/args-quoting/windowstyle-hidden-vs-windowshide/)

## CRLF residue after LF-only splitting

Windows tools end lines with CRLF, so splitting text on LF alone leaves a trailing CR on every line; exact comparisons and anchored patterns then fail against a character that is invisible in editors, diffs, and terminal output.

Cases: [split-n-leaves-cr](/fuck-powershell/cases/encoding/split-n-leaves-cr/) · [lf-pure-transform-mixes-eol](/fuck-powershell/cases/encoding/lf-pure-transform-mixes-eol/)

## culture parsing

Numeric/date casts honor the host culture; comma-decimal locales parse differently than invariant culture.

Cases: [culture-comma-decimal-cast](/fuck-powershell/cases/parsing/culture-comma-decimal-cast/)

## default encoding

5.1 cmdlets default to UTF-16LE or ANSI when writing; 7 defaults to BOM-less UTF-8 — same code, different bytes.

Cases: [ps51-vs-7-split](/fuck-powershell/cases/versions/ps51-vs-7-split/) · [redirected-ps-output-mojibake](/fuck-powershell/cases/encoding/redirected-ps-output-mojibake/) · [utf8-bom-still-breaks-grep](/fuck-powershell/cases/encoding/utf8-bom-still-breaks-grep/) · [tee-object-utf16](/fuck-powershell/cases/encoding/tee-object-utf16/) · [bom-less-ps1-cp949](/fuck-powershell/cases/encoding/bom-less-ps1-cp949/) · [bomless-bat-oem-codepage](/fuck-powershell/cases/encoding/bomless-bat-oem-codepage/) · [oss-outfile-bom](/fuck-powershell/cases/encoding/oss-outfile-bom/)

## default shell selection

CI runners pick a default shell per OS (pwsh on windows-latest); unmarked run: steps inherit it.

Cases: [npm-script-runs-under-cmd](/fuck-powershell/cases/ci-agents/npm-script-runs-under-cmd/) · [actions-default-shell](/fuck-powershell/cases/ci-agents/actions-default-shell/)

## MS-DOS device names reserved in every directory

Win32 path parsing recognizes legacy device names such as CON, NUL, and COM1 as their own path type and rewrites them into the NT device namespace before any directory applies, with or without an extension, so opening one succeeds as a device rather than creating a file.

Cases: [reserved-dos-device-names](/fuck-powershell/cases/env-paths/reserved-dos-device-names/)

## drive letter parses as a URL scheme

A Windows absolute path begins with a drive letter and colon, so any API that parses its input as a URL reads that letter as the protocol, while an absolute POSIX path coincidentally parses as root-relative and works.

Cases: [dynamic-import-needs-file-url](/fuck-powershell/cases/env-paths/dynamic-import-needs-file-url/)

## env casing

Windows env names are case-insensitive but JS objects are not; Path and PATH can coexist and fight.

Cases: [env-path-vs-PATH-casing](/fuck-powershell/cases/env-paths/env-path-vs-PATH-casing/)

## env derived identity

USERDOMAIN/USERNAME env vars are writable, unreliable identity sources; workgroup machines put the computer name in USERDOMAIN.

Cases: [wslenv-shared-with-host](/fuck-powershell/cases/env-paths/wslenv-shared-with-host/) · [env-domain-principal](/fuck-powershell/cases/env-paths/env-domain-principal/)

## errorrecord format

Formatting an ErrorRecord (Out-String) renders multi-line error views including position/script text, multiplying one line into many.

Cases: [out-string-multiplies-stderr](/fuck-powershell/cases/streams/out-string-multiplies-stderr/)

## execution policy gate

Execution policy gates script FILES (.ps1, -File) while in-memory command text bypasses it.

Cases: [execution-policy-file-block](/fuck-powershell/cases/ci-agents/execution-policy-file-block/) · [npm-ps1-not-comspec](/fuck-powershell/cases/aliases/npm-ps1-not-comspec/)

## exit code propagation

Exit codes cross process/host boundaries by convention, not guarantee: hosts, wrappers, and CI steps each apply their own rule.

Cases: [pwsh-leaks-lastexitcode](/fuck-powershell/cases/exit-codes/pwsh-leaks-lastexitcode/) · [explorer-exits-one](/fuck-powershell/cases/exit-codes/explorer-exits-one/) · [start-process-no-lastexitcode](/fuck-powershell/cases/exit-codes/start-process-no-lastexitcode/) · [exit-code-vs-dollar-q](/fuck-powershell/cases/exit-codes/exit-code-vs-dollar-q/) · [startup-artifact-is-not-a-process](/fuck-powershell/cases/exit-codes/startup-artifact-is-not-a-process/)

## extension dispatch

powershell/pwsh -File dispatches on filename extension; non-.ps1 files are rejected before parsing.

Cases: [ps-file-extension-dispatch](/fuck-powershell/cases/args-quoting/ps-file-extension-dispatch/)

## exit races a closing handle

An immediate process exit tears the runtime down without waiting for libuv to finish closing handles; a handle still in the closing state trips an assertion, which Windows surfaces as a fastfail while POSIX teardown absorbs the same race silently.

Cases: [process-exit-fastfail-0xc0000409](/fuck-powershell/cases/exit-codes/process-exit-fastfail-0xc0000409/)

## host vs pipeline

Write-Host and return semantics: host output bypasses the success pipeline, and functions emit every uncaptured value.

Cases: [write-host-not-success-stream](/fuck-powershell/cases/streams/write-host-not-success-stream/) · [start-process-no-lastexitcode](/fuck-powershell/cases/exit-codes/start-process-no-lastexitcode/) · [return-does-not-mean-return](/fuck-powershell/cases/collections/return-does-not-mean-return/)

## iex session

Invoke-Expression runs text in the CURRENT session: exit kills the caller's host, and parameters cannot be forwarded.

Cases: [piped-iex-drops-params](/fuck-powershell/cases/args-quoting/piped-iex-drops-params/) · [irm-iex-kills-host](/fuck-powershell/cases/exit-codes/irm-iex-kills-host/)

## json depth default

ConvertTo-Json defaults to -Depth 2, replacing deeper data with type names; 5.1/7.0 truncate silently, 7.1+ warn.

Cases: [convertto-json-depth-two](/fuck-powershell/cases/parsing/convertto-json-depth-two/)

## localized tool output

Windows built-in command-line tools translate their column headings, status words, and error messages to the system UI language, so only structure and exit codes are stable; matching English substrings tests the machine's language rather than its state.

Cases: [localized-cli-output-parsing](/fuck-powershell/cases/parsing/localized-cli-output-parsing/)

## mandatory file locking

Windows enforces file locks at the OS level: a handle opened without FILE_SHARE_DELETE blocks deletes and renames until it closes, where POSIX unlink only removes a name and lets the data outlive its last reference.

Cases: [atomic-rename-loses-to-scanner](/fuck-powershell/cases/env-paths/atomic-rename-loses-to-scanner/) · [unlink-while-open-ebusy](/fuck-powershell/cases/env-paths/unlink-while-open-ebusy/)

## MAX_PATH is an API ceiling, not a filesystem limit

Win32 caps a pathname at 260 characters including drive, separators, and the terminating NUL, and directory creation reserves twelve more, so a path NTFS would store is refused by the API unless the caller uses the extended-length prefix or opts in with both the registry value and a long-path-aware manifest.

Cases: [max-path-260](/fuck-powershell/cases/env-paths/max-path-260/)

## native argv rebuild

PowerShell historically rebuilds one command-line string for native processes, re-quoting heuristically; quotes and empty args are lost.

Cases: [prose-as-unknown-flags](/fuck-powershell/cases/args-quoting/prose-as-unknown-flags/) · [oss-native-arg-quoting](/fuck-powershell/cases/args-quoting/oss-native-arg-quoting/) · [backslash-quote-ends-span](/fuck-powershell/cases/args-quoting/backslash-quote-ends-span/)

## output truthiness

A native command in a PowerShell expression evaluates to its captured OUTPUT; if() branches on output presence, not exit code.

Cases: [if-nativecmd-truthiness](/fuck-powershell/cases/exit-codes/if-nativecmd-truthiness/)

## path delimiter

PATH list separator is host-dependent (';' Windows, ':' POSIX); colon-joined lists corrupt drive-letter entries.

Cases: [node-path-host-delimiter](/fuck-powershell/cases/env-paths/node-path-host-delimiter/) · [path-colon-not-delimiter](/fuck-powershell/cases/env-paths/path-colon-not-delimiter/)

## pathext resolution

Windows resolves extensionless command names by walking PATH entries and PATHEXT extensions in order; results differ from POSIX execvp and between resolvers.

Cases: [path-dot-hijacks-bare-npm](/fuck-powershell/cases/env-paths/path-dot-hijacks-bare-npm/) · [pathext-exe-beats-cmd](/fuck-powershell/cases/env-paths/pathext-exe-beats-cmd/) · [pathext-bare-name-enoent](/fuck-powershell/cases/env-paths/pathext-bare-name-enoent/) · [spawn-npm-enoent-einval](/fuck-powershell/cases/aliases/spawn-npm-enoent-einval/) · [npm-ps1-not-comspec](/fuck-powershell/cases/aliases/npm-ps1-not-comspec/) · [get-command-where-disagree](/fuck-powershell/cases/aliases/get-command-where-disagree/)

## pipeline chain ops

&& and || are PowerShell 7.0+ pipeline chain operators; 5.1 treats them as parser errors.

Cases: [ps51-no-and-and](/fuck-powershell/cases/versions/ps51-no-and-and/)

## posix dev null

/dev/null is a POSIX device path; Windows treats it as a relative file path under the current drive.

Cases: [dev-null-redirect](/fuck-powershell/cases/streams/dev-null-redirect/)

## posix inline env

VAR=value cmd per-command environment is POSIX shell syntax; cmd.exe executes the literal token instead.

Cases: [cmd-posix-env-prefix](/fuck-powershell/cases/ci-agents/cmd-posix-env-prefix/)

## prose as argument

English connectors like 'and' between commands parse as positional arguments of the first command.

Cases: [english-and-not-separator](/fuck-powershell/cases/args-quoting/english-and-not-separator/)

## registry env snapshot

Environment variables live in the registry; a process gets a merge snapshot at creation and never sees later writes.

Cases: [envpath-pollutes-user](/fuck-powershell/cases/env-paths/envpath-pollutes-user/) · [session-path-stale](/fuck-powershell/cases/env-paths/session-path-stale/)

## backslash is data inside a URL path

A general-purpose URL type percent-encodes a backslash because it is an ordinary path character rather than a separator; only implementations following the WHATWG special-scheme rule convert it, so the same conversion is correct in one language and broken in another.

Cases: [file-url-encodes-backslash](/fuck-powershell/cases/env-paths/file-url-encodes-backslash/)

## statement terminator

';' terminates a PowerShell statement; joining fragments of ONE call with ';' splits it into broken statements.

Cases: [join-semicolon-splits-startprocess](/fuck-powershell/cases/args-quoting/join-semicolon-splits-startprocess/)

## stream wrapping

5.1 wraps redirected native stderr lines in ErrorRecord objects, converting output into error-stream objects.

Cases: [native-stderr-errorrecord](/fuck-powershell/cases/streams/native-stderr-errorrecord/) · [out-string-multiplies-stderr](/fuck-powershell/cases/streams/out-string-multiplies-stderr/)

## strictmode contract

Set-StrictMode changes property access on missing members from returning null to throwing.

Cases: [strictmode-missing-property](/fuck-powershell/cases/versions/strictmode-missing-property/)

## string interpolation

Double-quoted PowerShell strings interpolate $tokens; backslash is not an escape — backtick is.

Cases: [dollar-backslash-vars](/fuck-powershell/cases/args-quoting/dollar-backslash-vars/) · [prose-as-unknown-flags](/fuck-powershell/cases/args-quoting/prose-as-unknown-flags/) · [dq-regex-interpolates](/fuck-powershell/cases/args-quoting/dq-regex-interpolates/)

## TCP control block outlives the socket

Windows retains the transmission control block for a closed socket so the endpoint stays unbindable, and its SO_REUSEADDR waives that state by also permitting an active listener to be hijacked, so runtimes refuse to set it and the POSIX escape hatch is unavailable rather than merely ineffective.

Cases: [tcp-tcb-survives-listener](/fuck-powershell/cases/env-paths/tcp-tcb-survives-listener/)

## win32 path normalization

Win32 trims trailing dots/spaces from paths at the API boundary; different runtimes normalize differently, so existence checks disagree.

Cases: [esm-is-main-file-url](/fuck-powershell/cases/env-paths/esm-is-main-file-url/) · [test-path-trailing-whitespace](/fuck-powershell/cases/env-paths/test-path-trailing-whitespace/) · [basename-split-slash-only](/fuck-powershell/cases/parsing/basename-split-slash-only/) · [zip-entry-drive-letter-escapes](/fuck-powershell/cases/parsing/zip-entry-drive-letter-escapes/)

