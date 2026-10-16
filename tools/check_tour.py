import argparse, asyncio, json, sys
from playwright.async_api import async_playwright

VIEWPORTS = {
    "pc": {"width": 1440, "height": 900, "mobile": False},
    "wide": {"width": 1920, "height": 1080, "mobile": False},
    "tablet": {"width": 768, "height": 1024, "mobile": True},
    "phone": {"width": 390, "height": 844, "mobile": True},
}

MEASURE = r"""() => {
  const root = [...document.querySelectorAll('.hft-root')].find(r => !r.hidden);
  if (!root) return null;
  const pop = root.querySelector('.hft-pop');
  const ring = root.querySelector('.hft-mask__ring');
  const arrow = root.querySelector('.hft-pop__arrow');
  const p = pop.getBoundingClientRect();
  let hole = null;
  try {
    const d = ring.getAttribute('d');
    if (d) { const b = ring.getBBox(); hole = { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height }; }
  } catch (e) {}
  const a = arrow && !arrow.hidden ? arrow.getBoundingClientRect() : null;
  let drift = null;
  const live = window.HFTour && HFTour.active && HFTour.active();
  if (live && ring.getAttribute('d')) {
    const want = live.holeFor(live.target && document.contains(live.target) ? live.target : null, live.steps[live.index]);
    if (want.w > 0 && want.h > 0) {
      const got = ring.getBoundingClientRect();
      drift = Math.max(Math.abs(got.left - want.x), Math.abs(got.top - want.y), Math.abs(got.right - (want.x + want.w)), Math.abs(got.bottom - (want.y + want.h)));
    }
  }
  const title = (root.querySelector('.hft-pop__title') || {}).textContent || '';
  let shown = null;
  const inst = window.HFTour && HFTour.active && HFTour.active();
  const t = inst && inst.target && document.contains(inst.target) ? inst.target : null;
  if (t) {
    const r = t.getBoundingClientRect();
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let n = t.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const st = getComputedStyle(n);
      if (/(auto|scroll|hidden|clip|overlay)/.test(st.overflowX + ' ' + st.overflowY)) {
        const c = n.getBoundingClientRect();
        x1 = Math.max(x1, c.left); y1 = Math.max(y1, c.top); x2 = Math.min(x2, c.right); y2 = Math.min(y2, c.bottom);
      }
    }
    x1 = Math.max(x1, 0); y1 = Math.max(y1, 0); x2 = Math.min(x2, innerWidth); y2 = Math.min(y2, innerHeight);
    const full = r.width * r.height;
    shown = { ratio: full ? Math.max(0, x2 - x1) * Math.max(0, y2 - y1) / full : 0, tall: r.height > innerHeight * 0.6 };
  }
  return {
    vw: document.documentElement.clientWidth, vh: innerHeight, drift,
    pop: { left: p.left, top: p.top, right: p.right, bottom: p.bottom },
    hole, placement: pop.getAttribute('data-placement'), title,
    arrow: a ? { cx: a.left + a.width / 2, cy: a.top + a.height / 2 } : null,
    shown,
    next: !!root.querySelector('.hft-btn--primary:not([hidden])')
  };
}"""


def judge(m, tol=1.0):
    problems = []
    vw, vh, p = m["vw"], m["vh"], m["pop"]
    if p["left"] < -tol or p["top"] < -tol or p["right"] > vw + tol or p["bottom"] > vh + tol:
        problems.append("설명창이 화면 밖 (%d,%d,%d,%d / %dx%d)" % (p["left"], p["top"], p["right"], p["bottom"], vw, vh))
    s = m.get("shown")
    if s and not s["tall"] and s["ratio"] < 0.9:
        problems.append("대상이 가려져 일부만 보임 (%d%%)" % round(s["ratio"] * 100))
    if m.get("drift") is not None and m["drift"] > 1.5:
        problems.append("강조 테두리가 대상에서 어긋남 (%.1fpx)" % m["drift"])
    h = m["hole"]
    if h:
        if h["bottom"] <= 0 or h["top"] >= vh or h["right"] <= 0 or h["left"] >= vw:
            problems.append("강조 대상이 화면에 안 보임")
        ox = max(0, min(p["right"], h["right"]) - max(p["left"], h["left"]))
        oy = max(0, min(p["bottom"], h["bottom"]) - max(p["top"], h["top"]))
        if ox * oy > 4 and m["placement"] != "inside":
            problems.append("설명창이 강조 대상을 가림 (%dpx²)" % (ox * oy))
        a = m["arrow"]
        if a:
            if m["placement"] in ("top", "bottom") and not (h["left"] - 2 <= a["cx"] <= h["right"] + 2):
                problems.append("꼬리가 대상을 안 가리킴")
            if m["placement"] in ("left", "right") and not (h["top"] - 2 <= a["cy"] <= h["bottom"] + 2):
                problems.append("꼬리가 대상을 안 가리킴")
    return problems


async def run_one(browser, url, vp_name, trigger, max_steps, reduced, storage=None):
    vp = VIEWPORTS[vp_name]
    kw = dict(viewport={"width": vp["width"], "height": vp["height"]}, locale="ko-KR")
    if vp["mobile"]:
        kw.update(is_mobile=True, has_touch=True, device_scale_factor=2)
    if reduced:
        kw["reduced_motion"] = "reduce"
    if storage:
        kw["storage_state"] = storage
    ctx = await browser.new_context(**kw)
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(url, wait_until="networkidle")
    await page.wait_for_timeout(500)
    if trigger.startswith("js:"):
        await page.evaluate(trigger[3:])
    else:
        loc = page.locator(trigger).first
        await loc.scroll_into_view_if_needed()
        await loc.click()
    rows = []
    for i in range(max_steps):
        try:
            await page.wait_for_selector(".hft-root:not([hidden]) .hft-pop--in", timeout=4000)
        except Exception:
            if i == 0:
                rows.append({"step": 1, "problems": ["투어가 열리지 않음"]})
            break
        await page.wait_for_timeout(450)
        m = await page.evaluate(MEASURE)
        if not m:
            break
        rows.append({"step": i + 1, "title": m["title"], "placement": m["placement"], "problems": judge(m)})
        btn = page.locator(".hft-root:not([hidden]) .hft-btn--primary")
        if await btn.count() == 0:
            break
        await btn.first.click()
        await page.wait_for_timeout(250)
        still = await page.evaluate("() => !![...document.querySelectorAll('.hft-root')].find(r => !r.hidden && !r.classList.contains('hft-root--leaving'))")
        if not still:
            break
    await ctx.close()
    return rows, errors


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("triggers", nargs="+", help="CSS 선택자 또는 js:코드 — 누르면 투어가 시작되는 것")
    ap.add_argument("--viewports", default="pc,wide,tablet,phone")
    ap.add_argument("--max-steps", type=int, default=10)
    ap.add_argument("--reduced", action="store_true")
    ap.add_argument("--json", default="")
    ap.add_argument("--storage", default="", help="로그인 상태 파일(Playwright storage_state)")
    args = ap.parse_args()
    report = []
    total = bad = 0
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True, channel="chrome", ignore_default_args=["--hide-scrollbars"])
        except Exception:
            browser = await p.chromium.launch(headless=True, ignore_default_args=["--hide-scrollbars"])
        for vp in args.viewports.split(","):
            for trig in args.triggers:
                rows, errors = await run_one(browser, args.url, vp, trig, args.max_steps, args.reduced, args.storage or None)
                for r in rows:
                    total += 1
                    if r["problems"]:
                        bad += 1
                    print("%-6s %-28s %d단계 %-10s %s" % (vp, trig[:28], r["step"], r.get("placement") or "-", "; ".join(r["problems"]) or "정상"))
                for e in errors:
                    print("%-6s %-28s 오류: %s" % (vp, trig[:28], e[:160]))
                    bad += 1
                report.append({"viewport": vp, "trigger": trig, "rows": rows, "errors": errors})
        await browser.close()
    print("합계: %d단계 확인, 문제 %d건" % (total, bad))
    if args.json:
        json.dump(report, open(args.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sys.exit(1 if bad else 0)


asyncio.run(main())
