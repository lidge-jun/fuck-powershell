---
id: altgr-reports-as-ctrl-alt
title: "backslashes vanish from typed paths on German keyboards, because the terminal reports AltGr as Ctrl+Alt and your keybinding ate it"
category: parsing
versions: "both"
failure: silent
context: [interactive, agent]
source: third-party
repro: historical
refs:
  - https://github.com/lidge-jun/fuck-powershell/issues/46
  - https://github.com/openai/codex/commit/702238f0
ontology:
  affects: [env-windows]
  caused_by: [mechanism-altgr-chord]
  mitigated_by: [workaround-treat-ctrl-alt-as-literal]
---

# backslashes vanish from typed paths on German keyboards, because the terminal reports AltGr as Ctrl+Alt and your keybinding ate it

## Symptom

A user types a Windows path into your TUI and characters silently disappear:

```
typed:  C:\Users\Admin
got:    C:UsersAdmin
```

No error, no beep, no indication anything was dropped. The user retypes it,
watches carefully, and it happens again. On your machine it never reproduces.

The difference is the keyboard layout. On US and UK layouts backslash is a plain
key. On German, French, Polish and many others it requires AltGr.

## Repro

In any terminal input handler, log the raw key events while a German-layout user
types `\`:

```
KeyEvent { code: Char('\\'), modifiers: CONTROL | ALT }
```

Then look at your own dispatch:

```rust
if modifiers.contains(CONTROL) {
    return self.handle_binding(code);   // <- swallows it
}
self.insert_char(code);
```

The character never reaches the insert path, because a reasonable-looking guard
treated a modified key as a command.

## Cause

AltGr is not a distinct modifier on Windows. It is implemented as
**right Alt = Ctrl + Alt**, and terminals report the chord that way, so a
character produced by AltGr arrives with both CONTROL and ALT set.

That collides directly with the near-universal convention that Ctrl-modified keys
are shortcuts rather than text. Any handler shaped like "if Ctrl is held, this is
a binding" silently eats real characters — but only for layouts that need AltGr to
produce them.

Which characters are affected is layout-dependent, and the list is exactly the
ones that matter for developers: `\`, `@`, `{`, `}`, `[`, `]`, `|`, `~`, `€`.
On a German layout, both the backslash in a path and the pipe in a shell command
come through AltGr.

This is why it survives review: the bug is invisible on the layout every reviewer
is using, and the symptom — a path that is missing separators — looks like a
string-handling bug anywhere except the input layer.

## Workaround

Treat a Ctrl+Alt chord that carries a printable character as literal input, and
reserve bindings for Ctrl-alone:

```rust
let is_altgr = modifiers.contains(CONTROL) && modifiers.contains(ALT);
if let Char(c) = code {
    if is_altgr || !modifiers.contains(CONTROL) {
        self.insert_char(c);
        return;
    }
}
self.handle_binding(code, modifiers);
```

The cost is that genuine Ctrl+Alt+key shortcuts become unavailable — which is the
right trade, because those were never safe to bind on Windows for exactly this
reason.

Test with a non-US layout, or at minimum with a synthetic
`CONTROL | ALT | Char('\\')` event. A US-layout keyboard cannot produce the
failing input at all, so no amount of manual testing on one finds it.

---

The corpus's other input-layer cases are about how a shell re-parses text after
you send it. This one is earlier: the character never became text, because a
modifier convention that is safe on POSIX terminals is not safe on Windows.
