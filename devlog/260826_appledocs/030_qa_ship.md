# 030 — Browser QA + ship (aw4)

1. Build; serve dist under /fuck-powershell/ base (temp symlink root, python
   http.server).
2. browser:control-in-app-browser QA protocol:
   - open hero → console check (zero errors) → click nav "Cases" → index loads
   - click a category card case row → case page (eyebrow + At-a-glance render)
   - click mech chip → mechanisms page anchor; errors page → case link back
   - toggle dark/light on a case page (theme switcher) → badges/card legible
   - screenshot each stop; view_image inspect
3. Fix every defect found (console errors, dead links, layout breaks); re-QA
   changed states only.
4. push, deploy green, live 200 on /cases/ + spot page. Close criteria.
