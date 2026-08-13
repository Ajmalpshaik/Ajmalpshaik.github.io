# AJ Connect — published panel

`panel.ajpanel` goes here. Nothing else.

This is the tools page that AJ Connect shows people. It is **not** a web page you can open — it is a
signed file the add-in downloads, checks against Ajmal's public key, and then serves from the
computer Revit is running on.

```
this folder ──panel.ajpanel──► AJ Connect ── signature checked ──► browser
```

## Why it is a signed file and not a page

Two reasons, and both matter.

**A public page cannot reach a local address any more.** Chrome and Edge 138+ block it until the
visitor grants a *Local network* permission that almost nobody finds, and a page that has not been
granted it reports "not connected" on a setup that is working perfectly. There used to be a runnable
panel at `/aj-connector/panel/` and this is exactly why it was removed.

**The signature could not be checked otherwise.** If the browser fetched the panel itself, the
browser would be the only thing that ever saw those bytes. AJ Connect downloading it means nothing
unverified is ever shown, and a compromised website still cannot replace the panel.

The direction is the whole trick. A website reaching *in* to a computer is guarded. A program on the
computer reaching *out* to a website is ordinary. Same two parties, opposite direction.

## Publishing a change

The panel source lives in the **AJ-Connect** repository at `panel/panel.html`, not here — the add-in
compiles the same file in as its offline fallback, so keeping one copy is what stops the two
drifting apart.

```powershell
# in the AJ-Connect repo
powershell -ExecutionPolicy Bypass -File tools/publish-panel.ps1 -Local   # try it first
powershell -ExecutionPolicy Bypass -File tools/publish-panel.ps1          # build the upload
```

Then copy `dist/publish-panel/panel.ajpanel` into this folder and push. Everyone gets it on their
next **Check for updates** — nobody reinstalls anything.

Before cutting an AJ Connect release, run `tools/embed-panel.ps1` so the built-in offline copy
matches. `package-release.ps1` refuses to build if it does not.

## While this folder is empty

Nothing breaks. AJ Connect falls back to the copy compiled into the add-in, which is a complete
working panel. The first publish simply starts the updates flowing.
