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

Cases: [curl-alias](/fuck-powershell/cases/aliases/curl-alias/) · [timeout-is-not-a-command-wrapper](/fuck-powershell/cases/aliases/timeout-is-not-a-command-wrapper/) · [ps51-vs-7-split](/fuck-powershell/cases/versions/ps51-vs-7-split/)

## AltGr is reported as Ctrl+Alt

Windows implements right Alt as Ctrl plus Alt, so a character typed with AltGr arrives carrying both modifiers and any handler treating Ctrl as a shortcut prefix silently consumes real text, but only on layouts that need AltGr to produce it.

Cases: [altgr-reports-as-ctrl-alt](/fuck-powershell/cases/parsing/altgr-reports-as-ctrl-alt/)

## app execution alias stub

A Microsoft Store App Execution Alias is a real file that resolves by name and, when run, advertises the Store instead of starting the program. Presence checks all pass and only execution disagrees.

Cases: [windowsapps-python3-stub-needs-probe](/fuck-powershell/cases/env-paths/windowsapps-python3-stub-needs-probe/)

## appexeclink

WindowsApps store aliases are zero-byte IO_REPARSE_TAG_APPEXECLINK files that pass stat probes but EPERM on spawn.

Cases: [git-merge-driver-sh-escapes](/fuck-powershell/cases/args-quoting/git-merge-driver-sh-escapes/) · [windowsapps-alias-eperm](/fuck-powershell/cases/env-paths/windowsapps-alias-eperm/)

## bom sniffing

Windows PowerShell 5.1 decides a script file's encoding by BOM presence; no BOM means the legacy ANSI code page.

Cases: [bom-less-ps1-cp949](/fuck-powershell/cases/encoding/bom-less-ps1-cp949/) · [cmd-bom-displaces-label](/fuck-powershell/cases/encoding/cmd-bom-displaces-label/)

## bun windowstyle argv reject

Bun 1.3.14 Windows spawn fails outright when powershell.exe argv contains the -WindowStyle Hidden pair.

Cases: [bun-ps-windowstyle-argv](/fuck-powershell/cases/args-quoting/bun-ps-windowstyle-argv/)

## caller chosen interpreter

On Windows the interpreter is chosen by the caller, by file association, or by PATHEXT, and none of them reads the shebang. A file can be valid in one language and executed as another.

Cases: [caller-picks-interpreter-not-shebang](/fuck-powershell/cases/env-paths/caller-picks-interpreter-not-shebang/)

## case-insensitive filesystem, case-sensitive containers

NTFS matches paths without regard to case while preserving the casing written, so two spellings name one file, but every ordinary string container treats them as distinct keys and the same lowercasing fix would be wrong on a case-sensitive filesystem.

Cases: [path-case-sensitive-map](/fuck-powershell/cases/env-paths/path-case-sensitive-map/)

## cmd bat spawn hardening

Node CVE-2024-27980 hardening: spawning .bat/.cmd without shell errors EINVAL (18.20.2/20.12.2/21.7.3+).

Cases: [spawn-npm-enoent-einval](/fuck-powershell/cases/aliases/spawn-npm-enoent-einval/)

## cmd reparse

Any command line routed through cmd.exe is re-tokenized; metacharacters and newlines inside arguments become command syntax.

Cases: [get-command-where-disagree](/fuck-powershell/cases/aliases/get-command-where-disagree/) · [cmd-shim-reparses-argv](/fuck-powershell/cases/args-quoting/cmd-shim-reparses-argv/) · [cmd-start-ampersand-splits](/fuck-powershell/cases/args-quoting/cmd-start-ampersand-splits/) · [shell-true-fallback-injects](/fuck-powershell/cases/args-quoting/shell-true-fallback-injects/)

## collection unrolling

PowerShell unrolls pipelines: zero items become null, one item loses its array, many become Object[] — types change with count.

Cases: [get-content-scalar-collapse](/fuck-powershell/cases/collections/get-content-scalar-collapse/) · [return-does-not-mean-return](/fuck-powershell/cases/collections/return-does-not-mean-return/) · [if-nativecmd-truthiness](/fuck-powershell/cases/exit-codes/if-nativecmd-truthiness/)

## CreateProcess command line capped at 32767

CreateProcess limits the whole assembled command line to 32767 characters and reports the overflow with the same Win32 code used for an over-long path, so a payload passed as an argument fails under an error that describes filenames.

Cases: [createprocess-cmdline-32767](/fuck-powershell/cases/args-quoting/createprocess-cmdline-32767/)

## comparison as filter

Comparison operators against a collection FILTER it (returning matching elements) instead of returning a boolean.

Cases: [ne-filters-instead-of-compares](/fuck-powershell/cases/collections/ne-filters-instead-of-compares/)

## console allocation

Console-subsystem binaries get a new console at CreateProcess when the parent has none — before any flag is parsed.

Cases: [windowstyle-hidden-vs-windowshide](/fuck-powershell/cases/args-quoting/windowstyle-hidden-vs-windowshide/)

## CRLF residue after LF-only splitting

Windows tools end lines with CRLF, so splitting text on LF alone leaves a trailing CR on every line; exact comparisons and anchored patterns then fail against a character that is invisible in editors, diffs, and terminal output.

Cases: [autocrlf-shebang-cr](/fuck-powershell/cases/encoding/autocrlf-shebang-cr/) · [cmd-lf-drops-first-byte](/fuck-powershell/cases/encoding/cmd-lf-drops-first-byte/) · [lf-pure-transform-mixes-eol](/fuck-powershell/cases/encoding/lf-pure-transform-mixes-eol/) · [split-n-leaves-cr](/fuck-powershell/cases/encoding/split-n-leaves-cr/)

## culture parsing

Numeric/date casts honor the host culture; comma-decimal locales parse differently than invariant culture.

Cases: [culture-comma-decimal-cast](/fuck-powershell/cases/parsing/culture-comma-decimal-cast/)

## cwd handle held

Windows holds a process's current directory as an open handle without FILE_SHARE_DELETE for as long as it is the cwd, so the directory cannot be unlinked until some process chdir()s away. POSIX keeps only an inode reference, so the name can go while the process stays inside.

Cases: [cwd-locked-cannot-unlink](/fuck-powershell/cases/env-paths/cwd-locked-cannot-unlink/)

## default encoding

5.1 cmdlets default to UTF-16LE or ANSI when writing; 7 defaults to BOM-less UTF-8 — same code, different bytes.

Cases: [bom-less-ps1-cp949](/fuck-powershell/cases/encoding/bom-less-ps1-cp949/) · [bomless-bat-oem-codepage](/fuck-powershell/cases/encoding/bomless-bat-oem-codepage/) · [oss-outfile-bom](/fuck-powershell/cases/encoding/oss-outfile-bom/) · [redirected-ps-output-mojibake](/fuck-powershell/cases/encoding/redirected-ps-output-mojibake/) · [tee-object-utf16](/fuck-powershell/cases/encoding/tee-object-utf16/) · [utf8-bom-still-breaks-grep](/fuck-powershell/cases/encoding/utf8-bom-still-breaks-grep/) · [ps51-vs-7-split](/fuck-powershell/cases/versions/ps51-vs-7-split/)

## default shell selection

CI runners pick a default shell per OS (pwsh on windows-latest); unmarked run: steps inherit it.

Cases: [actions-default-shell](/fuck-powershell/cases/ci-agents/actions-default-shell/) · [npm-script-runs-under-cmd](/fuck-powershell/cases/ci-agents/npm-script-runs-under-cmd/)

## MS-DOS device names reserved in every directory

Win32 path parsing recognizes legacy device names such as CON, NUL, and COM1 as their own path type and rewrites them into the NT device namespace before any directory applies, with or without an extension, so opening one succeeds as a device rather than creating a file.

Cases: [reserved-dos-device-names](/fuck-powershell/cases/env-paths/reserved-dos-device-names/)

## drive letter parses as a URL scheme

A Windows absolute path begins with a drive letter and colon, so any API that parses its input as a URL reads that letter as the protocol, while an absolute POSIX path coincidentally parses as root-relative and works.

Cases: [dynamic-import-needs-file-url](/fuck-powershell/cases/env-paths/dynamic-import-needs-file-url/)

## reparse point written without a print name

A mount-point reparse point stores a substitute name in the NT object namespace and a print name in Win32 form. A buffer built by hand often carries only the substitute name, so the kernel still resolves the link while Win32 path resolution through it yields nothing — and an empty directory is not an error, so every caller reports success.

Cases: [junction-empty-print-name](/fuck-powershell/cases/env-paths/junction-empty-print-name/)

## env casing

Windows env names are case-insensitive but JS objects are not; Path and PATH can coexist and fight.

Cases: [env-path-vs-PATH-casing](/fuck-powershell/cases/env-paths/env-path-vs-PATH-casing/)

## env derived identity

USERDOMAIN/USERNAME env vars are writable, unreliable identity sources; workgroup machines put the computer name in USERDOMAIN.

Cases: [env-domain-principal](/fuck-powershell/cases/env-paths/env-domain-principal/) · [wslenv-shared-with-host](/fuck-powershell/cases/env-paths/wslenv-shared-with-host/)

## errorrecord format

Formatting an ErrorRecord (Out-String) renders multi-line error views including position/script text, multiplying one line into many.

Cases: [out-string-multiplies-stderr](/fuck-powershell/cases/streams/out-string-multiplies-stderr/)

## execution policy gate

Execution policy gates script FILES (.ps1, -File) while in-memory command text bypasses it.

Cases: [npm-ps1-not-comspec](/fuck-powershell/cases/aliases/npm-ps1-not-comspec/) · [execution-policy-file-block](/fuck-powershell/cases/ci-agents/execution-policy-file-block/)

## exit code propagation

Exit codes cross process/host boundaries by convention, not guarantee: hosts, wrappers, and CI steps each apply their own rule.

Cases: [exit-code-vs-dollar-q](/fuck-powershell/cases/exit-codes/exit-code-vs-dollar-q/) · [explorer-exits-one](/fuck-powershell/cases/exit-codes/explorer-exits-one/) · [perl-alarm-raw-wait-status](/fuck-powershell/cases/exit-codes/perl-alarm-raw-wait-status/) · [pwsh-leaks-lastexitcode](/fuck-powershell/cases/exit-codes/pwsh-leaks-lastexitcode/) · [start-process-no-lastexitcode](/fuck-powershell/cases/exit-codes/start-process-no-lastexitcode/) · [startup-artifact-is-not-a-process](/fuck-powershell/cases/exit-codes/startup-artifact-is-not-a-process/)

## expression vs command mode

PowerShell chooses command or expression parsing from the first token of a line. A leading quoted string selects expression mode, so the string is a value and the argument after it is a syntax error, regardless of whether the path names an executable.

Cases: [ps-quoted-path-is-expression](/fuck-powershell/cases/args-quoting/ps-quoted-path-is-expression/)

## extension dispatch

powershell/pwsh -File dispatches on filename extension; non-.ps1 files are rejected before parsing.

Cases: [ps-file-extension-dispatch](/fuck-powershell/cases/args-quoting/ps-file-extension-dispatch/)

## file url scheme path

A file: URL's pathname keeps the leading slash and treats the drive letter as the first segment (/D:/a/...), which is a valid URL path but not a Windows filesystem path; only fileURLToPath converts and decodes it.

Cases: [file-url-pathname-drive-slash](/fuck-powershell/cases/env-paths/file-url-pathname-drive-slash/)

## flush needs write access

On Windows fsync is FlushFileBuffers, which requires a handle opened with GENERIC_WRITE; a read-only handle is refused with ERROR_ACCESS_DENIED (EPERM), where POSIX fsync accepts any descriptor for the file.

Cases: [fsync-readonly-handle-eperm](/fuck-powershell/cases/env-paths/fsync-readonly-handle-eperm/)

## exit races a closing handle

An immediate process exit tears the runtime down without waiting for libuv to finish closing handles; a handle still in the closing state trips an assertion, which Windows surfaces as a fastfail while POSIX teardown absorbs the same race silently.

Cases: [process-exit-fastfail-0xc0000409](/fuck-powershell/cases/exit-codes/process-exit-fastfail-0xc0000409/)

## host vs pipeline

Write-Host and return semantics: host output bypasses the success pipeline, and functions emit every uncaptured value.

Cases: [return-does-not-mean-return](/fuck-powershell/cases/collections/return-does-not-mean-return/) · [start-process-no-lastexitcode](/fuck-powershell/cases/exit-codes/start-process-no-lastexitcode/) · [write-host-not-success-stream](/fuck-powershell/cases/streams/write-host-not-success-stream/)

## hosted runner variance

A shared windows-latest job runs several Bun/Node pools on one machine, so identical work takes 2x or more longer from one run to the next (8.5 s vs 18.7 s measured for one three-child test). Any budget sized from a single observation, and especially from a developer laptop, is inside that spread.

Cases: [test-budget-sized-from-local-timing](/fuck-powershell/cases/ci-agents/test-budget-sized-from-local-timing/)

## iex session

Invoke-Expression runs text in the CURRENT session: exit kills the caller's host, and parameters cannot be forwarded.

Cases: [piped-iex-drops-params](/fuck-powershell/cases/args-quoting/piped-iex-drops-params/) · [irm-iex-kills-host](/fuck-powershell/cases/exit-codes/irm-iex-kills-host/)

## json depth default

ConvertTo-Json defaults to -Depth 2, replacing deeper data with type names; 5.1/7.0 truncate silently, 7.1+ warn.

Cases: [convertto-json-depth-two](/fuck-powershell/cases/parsing/convertto-json-depth-two/)

## locale preferred encoding is the ANSI codepage

Python text mode without an explicit encoding decodes with the locale preferred encoding, which on Windows is the ANSI codepage rather than UTF-8, and UTF-8 mode changes what that function reports without changing what native children emit.

Cases: [python-subprocess-locale-encoding](/fuck-powershell/cases/encoding/python-subprocess-locale-encoding/)

## localized tool output

Windows built-in command-line tools translate their column headings, status words, and error messages to the system UI language, so only structure and exit codes are stable; matching English substrings tests the machine's language rather than its state.

Cases: [localized-cli-output-parsing](/fuck-powershell/cases/parsing/localized-cli-output-parsing/)

## loose string escape layer

A loose string or config layer consumes a backslash as an escape introducer and keeps the letter after it, so a Windows path silently loses its separators. A strict parser refuses the same input instead, which is why the failure arrives late.

Cases: [config-string-eats-windows-path](/fuck-powershell/cases/parsing/config-string-eats-windows-path/)

## mandatory file locking

Windows enforces file locks at the OS level: a handle opened without FILE_SHARE_DELETE blocks deletes and renames until it closes, where POSIX unlink only removes a name and lets the data outlive its last reference.

Cases: [killed-run-contaminates-next-run](/fuck-powershell/cases/ci-agents/killed-run-contaminates-next-run/) · [async-child-holds-dir-after-stop](/fuck-powershell/cases/env-paths/async-child-holds-dir-after-stop/) · [atomic-rename-loses-to-scanner](/fuck-powershell/cases/env-paths/atomic-rename-loses-to-scanner/) · [cwd-locked-cannot-unlink](/fuck-powershell/cases/env-paths/cwd-locked-cannot-unlink/) · [unlink-while-open-ebusy](/fuck-powershell/cases/env-paths/unlink-while-open-ebusy/)

## MAX_PATH is an API ceiling, not a filesystem limit

Win32 caps a pathname at 260 characters including drive, separators, and the terminating NUL, and directory creation reserves twelve more, so a path NTFS would store is refused by the API unless the caller uses the extended-length prefix or opts in with both the registry value and a long-path-aware manifest.

Cases: [max-path-260](/fuck-powershell/cases/env-paths/max-path-260/)

## msys path conversion

MSYS2, which Git for Windows is built on, rewrites arguments that look like POSIX paths into Windows paths when launching a non-MSYS child. A lone switch such as /c is indistinguishable from a one-character root and arrives as C:/.

Cases: [msys-rewrites-slash-args](/fuck-powershell/cases/args-quoting/msys-rewrites-slash-args/)

## native argv rebuild

PowerShell historically rebuilds one command-line string for native processes, re-quoting heuristically; quotes and empty args are lost.

Cases: [backslash-quote-ends-span](/fuck-powershell/cases/args-quoting/backslash-quote-ends-span/) · [oss-native-arg-quoting](/fuck-powershell/cases/args-quoting/oss-native-arg-quoting/) · [prose-as-unknown-flags](/fuck-powershell/cases/args-quoting/prose-as-unknown-flags/)

## no POSIX process group

Windows offers termination of one process or of a live parent-PID tree, with no group you opted into, so killing a child orphans its descendants while a tree kill sweeps up any caller that happens to descend from the target.

Cases: [killed-run-contaminates-next-run](/fuck-powershell/cases/ci-agents/killed-run-contaminates-next-run/) · [kill-hits-one-pid-or-the-whole-tree](/fuck-powershell/cases/exit-codes/kill-hits-one-pid-or-the-whole-tree/)

## nonspace prefix kills label

A batch label is recognised when its colon is the first non-whitespace character of the line. Spaces and tabs are tolerated; a BOM is not whitespace, so it turns the label into a command cmd.exe must parse.

Cases: [cmd-bom-displaces-label](/fuck-powershell/cases/encoding/cmd-bom-displaces-label/)

## NTFS last-access disabled

NTFS does not update a file's last-access time on ordinary reads: client SKUs have had NtfsDisableLastAccessUpdate=1 since Vista/7, and Windows 10 1803+/Server 2019+ use a "system managed" mode (fsutil DisableLastAccess = 2/3) that enables updates only on small volumes and coalesces them to once per hour. atime is therefore not evidence that a read happened.

Cases: [ntfs-atime-disabled-by-default](/fuck-powershell/cases/env-paths/ntfs-atime-disabled-by-default/)

## output truthiness

A native command in a PowerShell expression evaluates to its captured OUTPUT; if() branches on output presence, not exit code.

Cases: [if-nativecmd-truthiness](/fuck-powershell/cases/exit-codes/if-nativecmd-truthiness/)

## path delimiter

PATH list separator is host-dependent (';' Windows, ':' POSIX); colon-joined lists corrupt drive-letter entries.

Cases: [node-path-host-delimiter](/fuck-powershell/cases/env-paths/node-path-host-delimiter/) · [path-colon-not-delimiter](/fuck-powershell/cases/env-paths/path-colon-not-delimiter/)

## pathext resolution

Windows resolves extensionless command names by walking PATH entries and PATHEXT extensions in order; results differ from POSIX execvp and between resolvers.

Cases: [get-command-where-disagree](/fuck-powershell/cases/aliases/get-command-where-disagree/) · [npm-ps1-not-comspec](/fuck-powershell/cases/aliases/npm-ps1-not-comspec/) · [spawn-npm-enoent-einval](/fuck-powershell/cases/aliases/spawn-npm-enoent-einval/) · [timeout-is-not-a-command-wrapper](/fuck-powershell/cases/aliases/timeout-is-not-a-command-wrapper/) · [path-dot-hijacks-bare-npm](/fuck-powershell/cases/env-paths/path-dot-hijacks-bare-npm/) · [pathext-bare-name-enoent](/fuck-powershell/cases/env-paths/pathext-bare-name-enoent/) · [pathext-exe-beats-cmd](/fuck-powershell/cases/env-paths/pathext-exe-beats-cmd/)

## percent-star unshifted

cmd.exe expands %* to the command tail exactly as it arrived, and shift renumbers only %1 through %9. A batch file that must drop its first argument therefore has no correct expansion, and falls back to positional forwarding with its eight-argument ceiling.

Cases: [cmd-star-ignores-shift](/fuck-powershell/cases/args-quoting/cmd-star-ignores-shift/)

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

## PATH entries may be quoted

A Windows PATH entry may be wrapped in quotes so a directory name can contain a semicolon, which forces correct parsers to be quote-aware; an unmatched quote then opens a span that swallows every later entry into one fictional path.

Cases: [path-unmatched-quote-swallows](/fuck-powershell/cases/env-paths/path-unmatched-quote-swallows/)

## registry env snapshot

Environment variables live in the registry; a process gets a merge snapshot at creation and never sees later writes.

Cases: [envpath-pollutes-user](/fuck-powershell/cases/env-paths/envpath-pollutes-user/) · [session-path-stale](/fuck-powershell/cases/env-paths/session-path-stale/)

## rem parameter substitution

REM and :: suppress command parsing, so operators and quotes inside a batch comment are inert. They do not suppress batch parameter substitution, which runs earlier, so a %~ form the parser cannot resolve aborts the script instead of being skipped.

Cases: [cmd-rem-substitutes-parameters](/fuck-powershell/cases/parsing/cmd-rem-substitutes-parameters/)

## backslash is data inside a URL path

A general-purpose URL type percent-encodes a backslash because it is an ordinary path character rather than a separator; only implementations following the WHATWG special-scheme rule convert it, so the same conversion is correct in one language and broken in another.

Cases: [file-url-encodes-backslash](/fuck-powershell/cases/env-paths/file-url-encodes-backslash/)

## config command line is parsed by sh before the program is found

Git runs commands supplied through configuration by handing them to its bundled sh, so the configured value is a shell command line rather than an argv vector. Backslashes in a Windows path are consumed as escape characters before any program lookup happens, and the resulting 'command not found' is absorbed by whatever fallback the calling feature defines.

Cases: [git-merge-driver-sh-escapes](/fuck-powershell/cases/args-quoting/git-merge-driver-sh-escapes/)

## statement terminator

';' terminates a PowerShell statement; joining fragments of ONE call with ';' splits it into broken statements.

Cases: [cmd-c-newline-not-separator](/fuck-powershell/cases/args-quoting/cmd-c-newline-not-separator/) · [join-semicolon-splits-startprocess](/fuck-powershell/cases/args-quoting/join-semicolon-splits-startprocess/)

## stream wrapping

5.1 wraps redirected native stderr lines in ErrorRecord objects, converting output into error-stream objects.

Cases: [native-stderr-errorrecord](/fuck-powershell/cases/streams/native-stderr-errorrecord/) · [out-string-multiplies-stderr](/fuck-powershell/cases/streams/out-string-multiplies-stderr/)

## strictmode contract

Set-StrictMode changes property access on missing members from returning null to throwing.

Cases: [strictmode-missing-property](/fuck-powershell/cases/versions/strictmode-missing-property/)

## string interpolation

Double-quoted PowerShell strings interpolate $tokens; backslash is not an escape — backtick is.

Cases: [dollar-backslash-vars](/fuck-powershell/cases/args-quoting/dollar-backslash-vars/) · [dq-regex-interpolates](/fuck-powershell/cases/args-quoting/dq-regex-interpolates/) · [prose-as-unknown-flags](/fuck-powershell/cases/args-quoting/prose-as-unknown-flags/)

## TCP control block outlives the socket

Windows retains the transmission control block for a closed socket so the endpoint stays unbindable, and its SO_REUSEADDR waives that state by also permitting an active listener to be hijacked, so runtimes refuse to set it and the POSIX escape hatch is unavailable rather than merely ineffective.

Cases: [tcp-tcb-survives-listener](/fuck-powershell/cases/env-paths/tcp-tcb-survives-listener/)

## cmd.exe cannot hold a UNC current directory

The current directory is drive-relative in cmd.exe's model, so a UNC path cannot be one; started in a UNC directory it warns and silently relocates to the Windows directory, and every batch shim that hops through it inherits the wrong working directory.

Cases: [cmd-unc-cwd-not-supported](/fuck-powershell/cases/env-paths/cmd-unc-cwd-not-supported/)

## a UNC path may be served by a non-NTFS provider

A UNC root can be backed by a provider with entirely different semantics from NTFS, such as the WSL 9P filesystem, so operations that assume a Windows security descriptor fail with access-denied on a path that reads and lists normally.

Cases: [wsl-unc-rejects-nt-acl](/fuck-powershell/cases/env-paths/wsl-unc-rejects-nt-acl/)

## text-mode write translates newlines

CPython text I/O applies universal newlines when writing as well as reading, so a lone line feed becomes the platform terminator wherever a TextIOWrapper sits in the path, including inside a subprocess pipe opened in text mode.

Cases: [python-textio-newline-translation](/fuck-powershell/cases/encoding/python-textio-newline-translation/)

## unowned child lifetime

A spawned child whose promise or handle is dropped keeps running after its parent decides it is finished; Windows has no process group to tie the two, so the child's open handles outlive every shutdown step the parent awaited.

Cases: [killed-run-contaminates-next-run](/fuck-powershell/cases/ci-agents/killed-run-contaminates-next-run/) · [test-budget-sized-from-local-timing](/fuck-powershell/cases/ci-agents/test-budget-sized-from-local-timing/) · [async-child-holds-dir-after-stop](/fuck-powershell/cases/env-paths/async-child-holds-dir-after-stop/)

## win32 path normalization

Win32 trims trailing dots/spaces from paths at the API boundary; different runtimes normalize differently, so existence checks disagree.

Cases: [esm-is-main-file-url](/fuck-powershell/cases/env-paths/esm-is-main-file-url/) · [test-path-trailing-whitespace](/fuck-powershell/cases/env-paths/test-path-trailing-whitespace/) · [basename-split-slash-only](/fuck-powershell/cases/parsing/basename-split-slash-only/) · [zip-entry-drive-letter-escapes](/fuck-powershell/cases/parsing/zip-entry-drive-letter-escapes/)

## wsl launcher path translation

The WSL launcher on PATH is not a POSIX shell. It starts a guest with no C: drive and consumes the backslashes of a Windows path handed to it, so the path cannot resolve. Its callers have reported it exiting 0 on that failure.

Cases: [bash-on-path-may-be-wsl](/fuck-powershell/cases/aliases/bash-on-path-may-be-wsl/)

