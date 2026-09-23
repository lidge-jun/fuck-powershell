---
title: Error signatures
description: Symptom-first reverse index.
---

Saw an error? Find the landmine.

## account-sid-mapping

'No mapping between account names and security IDs' from icacls/ACL calls with unresolvable principals.

[env-domain-principal](/fuck-powershell/cases/env-paths/env-domain-principal/)

## assertion-mismatch

expect(received).toBe(expected) with Expected/Received differing — the test ran to its assertion and the observed value was wrong, as opposed to a crash, timeout, or setup error.

[bigint-file-identity-on-windows](/fuck-powershell/cases/env-paths/bigint-file-identity-on-windows/) · [homedir-escapes-test-sandbox](/fuck-powershell/cases/env-paths/homedir-escapes-test-sandbox/) · [ntfs-atime-disabled-by-default](/fuck-powershell/cases/env-paths/ntfs-atime-disabled-by-default/)

## bad-interpreter

A POSIX exec layer reports the shebang target as missing, usually 'bad interpreter: No such file or directory', naming an interpreter that exists. A trailing carriage return inside the name is the usual cause.

[autocrlf-shebang-cr](/fuck-powershell/cases/encoding/autocrlf-shebang-cr/)

## command-not-recognized

'X is not recognized as an internal or external command' — stale PATH snapshot or wrong-shell syntax.

[npm-script-runs-under-cmd](/fuck-powershell/cases/ci-agents/npm-script-runs-under-cmd/) · [actions-default-shell](/fuck-powershell/cases/ci-agents/actions-default-shell/) · [cmd-posix-env-prefix](/fuck-powershell/cases/ci-agents/cmd-posix-env-prefix/) · [msys-rewrites-slash-args](/fuck-powershell/cases/args-quoting/msys-rewrites-slash-args/) · [session-path-stale](/fuck-powershell/cases/env-paths/session-path-stale/) · [path-unmatched-quote-swallows](/fuck-powershell/cases/env-paths/path-unmatched-quote-swallows/) · [cmd-lf-drops-first-byte](/fuck-powershell/cases/encoding/cmd-lf-drops-first-byte/) · [bomless-bat-oem-codepage](/fuck-powershell/cases/encoding/bomless-bat-oem-codepage/)

## eaddrinuse

A bind is refused because the endpoint is occupied, and on Windows the occupant may be a leftover transmission control block rather than a process, so the port appears busy while every process listing is empty.

[tcp-tcb-survives-listener](/fuck-powershell/cases/env-paths/tcp-tcb-survives-listener/)

## ebusy

Node reports EBUSY when Windows refuses a rename or delete because another handle holds the file without FILE_SHARE_DELETE; the error names neither the holder nor the reason.

[atomic-rename-loses-to-scanner](/fuck-powershell/cases/env-paths/atomic-rename-loses-to-scanner/) · [unlink-while-open-ebusy](/fuck-powershell/cases/env-paths/unlink-while-open-ebusy/) · [async-child-holds-dir-after-stop](/fuck-powershell/cases/env-paths/async-child-holds-dir-after-stop/) · [cwd-locked-cannot-unlink](/fuck-powershell/cases/env-paths/cwd-locked-cannot-unlink/)

## eftype

Wrong file type for execution — e.g. attempting to CreateProcess a .ps1 script.

[dot-sh-association-exits-zero](/fuck-powershell/cases/env-paths/dot-sh-association-exits-zero/) · [get-command-where-disagree](/fuck-powershell/cases/aliases/get-command-where-disagree/)

## einval

Invalid argument from spawn — on Windows typically the .cmd/.bat hardening or malformed argv.

[spawn-npm-enoent-einval](/fuck-powershell/cases/aliases/spawn-npm-enoent-einval/)

## enametoolong

Win32 reports a path over the API ceiling as ERROR_FILENAME_EXCED_RANGE or ERROR_BUFFER_OVERFLOW; Node surfaces both as ENAMETOOLONG while Python maps the same code to ENOENT, so one wall is reported as two different problems.

[createprocess-cmdline-32767](/fuck-powershell/cases/args-quoting/createprocess-cmdline-32767/) · [max-path-260](/fuck-powershell/cases/env-paths/max-path-260/)

## enoent

File or command not found — on Windows often a PATHEXT/extension resolution miss, not a missing file.

[test-budget-sized-from-local-timing](/fuck-powershell/cases/ci-agents/test-budget-sized-from-local-timing/) · [dev-null-redirect](/fuck-powershell/cases/streams/dev-null-redirect/) · [file-url-pathname-drive-slash](/fuck-powershell/cases/env-paths/file-url-pathname-drive-slash/) · [test-path-trailing-whitespace](/fuck-powershell/cases/env-paths/test-path-trailing-whitespace/) · [file-url-encodes-backslash](/fuck-powershell/cases/env-paths/file-url-encodes-backslash/) · [pathext-bare-name-enoent](/fuck-powershell/cases/env-paths/pathext-bare-name-enoent/) · [cmd-unc-cwd-not-supported](/fuck-powershell/cases/env-paths/cmd-unc-cwd-not-supported/) · [spawn-npm-enoent-einval](/fuck-powershell/cases/aliases/spawn-npm-enoent-einval/) · [get-command-where-disagree](/fuck-powershell/cases/aliases/get-command-where-disagree/)

## eperm

Operation not permitted — including WindowsApps appExecLink spawn denials.

[killed-run-contaminates-next-run](/fuck-powershell/cases/ci-agents/killed-run-contaminates-next-run/) · [wsl-unc-rejects-nt-acl](/fuck-powershell/cases/env-paths/wsl-unc-rejects-nt-acl/) · [windowsapps-alias-eperm](/fuck-powershell/cases/env-paths/windowsapps-alias-eperm/) · [atomic-rename-loses-to-scanner](/fuck-powershell/cases/env-paths/atomic-rename-loses-to-scanner/) · [icacls-inheritance-r-empty-dacl](/fuck-powershell/cases/env-paths/icacls-inheritance-r-empty-dacl/) · [unlink-while-open-ebusy](/fuck-powershell/cases/env-paths/unlink-while-open-ebusy/) · [fsync-readonly-handle-eperm](/fuck-powershell/cases/env-paths/fsync-readonly-handle-eperm/) · [async-child-holds-dir-after-stop](/fuck-powershell/cases/env-paths/async-child-holds-dir-after-stop/)

## exit-code-leak

A handled or meaningless exit code propagates into step/process failure.

[pwsh-leaks-lastexitcode](/fuck-powershell/cases/exit-codes/pwsh-leaks-lastexitcode/) · [explorer-exits-one](/fuck-powershell/cases/exit-codes/explorer-exits-one/) · [perl-alarm-raw-wait-status](/fuck-powershell/cases/exit-codes/perl-alarm-raw-wait-status/) · [file-url-pathname-drive-slash](/fuck-powershell/cases/env-paths/file-url-pathname-drive-slash/)

## fastfail

Windows reports a runtime that aborted itself with the fastfail code 0xC0000409, whose documented meaning is stack buffer overrun; a libuv assertion during teardown surfaces this way and misdescribes the cause.

[process-exit-fastfail-0xc0000409](/fuck-powershell/cases/exit-codes/process-exit-fastfail-0xc0000409/)

## invalid-batch-substitution

cmd.exe rejects a %~ batch-parameter substitution it cannot resolve, reports the usage as invalid and points the reader at CALL /? or FOR /?, then aborts the script with exit 255.

[cmd-rem-substitutes-parameters](/fuck-powershell/cases/parsing/cmd-rem-substitutes-parameters/)

## invalid-json

Downstream JSON parse failure after the shell shredded quoted arguments.

[backslash-quote-ends-span](/fuck-powershell/cases/args-quoting/backslash-quote-ends-span/)

## invalid-url-scheme

Node's ESM loader rejects a specifier whose scheme is not file, data, or node; on Windows an absolute path supplies its drive letter as the scheme.

[dynamic-import-needs-file-url](/fuck-powershell/cases/env-paths/dynamic-import-needs-file-url/)

## module-not-found

A runtime reports 'Cannot find module' for a path the author never wrote, because a layer between the config and the loader rewrote it.

[config-string-eats-windows-path](/fuck-powershell/cases/parsing/config-string-eats-windows-path/)

## mojibake

Corrupted text output from encoding mismatches (UTF-16/BOM/ANSI vs UTF-8).

[ps51-vs-7-split](/fuck-powershell/cases/versions/ps51-vs-7-split/) · [redirected-ps-output-mojibake](/fuck-powershell/cases/encoding/redirected-ps-output-mojibake/) · [tee-object-utf16](/fuck-powershell/cases/encoding/tee-object-utf16/) · [bom-less-ps1-cp949](/fuck-powershell/cases/encoding/bom-less-ps1-cp949/) · [python-subprocess-locale-encoding](/fuck-powershell/cases/encoding/python-subprocess-locale-encoding/) · [bomless-bat-oem-codepage](/fuck-powershell/cases/encoding/bomless-bat-oem-codepage/) · [oss-outfile-bom](/fuck-powershell/cases/encoding/oss-outfile-bom/)

## nativecommanderror

PS 5.1 wrapper around native stderr lines when redirected under strict error preference.

[native-stderr-errorrecord](/fuck-powershell/cases/streams/native-stderr-errorrecord/)

## not-a-powershell-script

-File refused a file lacking the .ps1 extension.

[ps-file-extension-dispatch](/fuck-powershell/cases/args-quoting/ps-file-extension-dispatch/)

## parameterbinding

Parameter binding failure — often an alias hijack or interpolated/mangled arguments.

[english-and-not-separator](/fuck-powershell/cases/args-quoting/english-and-not-separator/) · [piped-iex-drops-params](/fuck-powershell/cases/args-quoting/piped-iex-drops-params/) · [ps51-vs-7-split](/fuck-powershell/cases/versions/ps51-vs-7-split/) · [utf8-bom-still-breaks-grep](/fuck-powershell/cases/encoding/utf8-bom-still-breaks-grep/) · [curl-alias](/fuck-powershell/cases/aliases/curl-alias/)

## parsererror

PowerShell parser rejection — e.g. && on 5.1.

[actions-default-shell](/fuck-powershell/cases/ci-agents/actions-default-shell/) · [ps-quoted-path-is-expression](/fuck-powershell/cases/args-quoting/ps-quoted-path-is-expression/) · [ps51-no-and-and](/fuck-powershell/cases/versions/ps51-no-and-and/)

## propertynotfound

StrictMode throw on missing property access.

[strictmode-missing-property](/fuck-powershell/cases/versions/strictmode-missing-property/)

## pssecurityexception

Execution policy refused to run a script file.

[execution-policy-file-block](/fuck-powershell/cases/ci-agents/execution-policy-file-block/) · [npm-ps1-not-comspec](/fuck-powershell/cases/aliases/npm-ps1-not-comspec/)

## python-not-found

The Microsoft Store alias exits 9009 printing 'Python was not found; run without arguments to install from the Microsoft Store' instead of running an interpreter.

[windowsapps-python3-stub-needs-probe](/fuck-powershell/cases/env-paths/windowsapps-python3-stub-needs-probe/)

## syntaxerror

An interpreter reports a syntax error in a file that is valid in the language it was actually written in, because something else chose which interpreter would run it.

[caller-picks-interpreter-not-shebang](/fuck-powershell/cases/env-paths/caller-picks-interpreter-not-shebang/)

## terminal-killed

The user's interactive session terminates because script text ran in-session (iex + exit).

[irm-iex-kills-host](/fuck-powershell/cases/exit-codes/irm-iex-kills-host/)

## test-timeout

"this test timed out after N ms" from the test runner: the body was aborted, not an assertion. Children it spawned are still running until the runner reaps them at the end.

[aside-sync-resources-outlive-isolate-file](/fuck-powershell/cases/ci-agents/aside-sync-resources-outlive-isolate-file/) · [test-budget-sized-from-local-timing](/fuck-powershell/cases/ci-agents/test-budget-sized-from-local-timing/)

## unexpected-at-this-time

cmd.exe reports a token it cannot place as '<token> was unexpected at this time', naming the token rather than whatever displaced the line that produced it.

[cmd-bom-displaces-label](/fuck-powershell/cases/encoding/cmd-bom-displaces-label/)

## unhandled-rejection

"Unhandled error between tests" (Bun) or an unhandledRejection event: a promise rejected with no awaiter, typically a race branch that lost and was rejected later by a kill or teardown.

[test-budget-sized-from-local-timing](/fuck-powershell/cases/ci-agents/test-budget-sized-from-local-timing/)

## unknown-arguments

A CLI reports prose words as unknown flags because the shell split one argument into many.

[prose-as-unknown-flags](/fuck-powershell/cases/args-quoting/prose-as-unknown-flags/)

## unset-variable

StrictMode 'variable cannot be retrieved' from unintended string interpolation.

[dq-regex-interpolates](/fuck-powershell/cases/args-quoting/dq-regex-interpolates/)

## vacuous-pass

A test reports pass but its assertion cannot fail on this platform: the property it checks is never observed, so a broken implementation would pass identically. Worse than a failure because it is invisible.

[ntfs-atime-disabled-by-default](/fuck-powershell/cases/env-paths/ntfs-atime-disabled-by-default/)

