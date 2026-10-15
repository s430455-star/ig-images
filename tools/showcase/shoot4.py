import asyncio,sys
from playwright.async_api import async_playwright
S=sys.argv[1]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':400,'height':860},device_scale_factor=2)
    await ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('file:','https://cdnjs','data:')) else r.abort())
    pg=await ctx.new_page(); await pg.goto('file://'+S+'/src/calc.html'); await pg.wait_for_timeout(800)
    await pg.click('#careToggle'); await pg.wait_for_timeout(300)
    sel=pg.locator('select:has(option:text-matches("^BA01"))').first
    sid=await sel.evaluate("s=>s.id"); print('ID',sid); sel=pg.locator('#'+sid)
    opts=await sel.evaluate("s=>[...s.options].map(o=>o.value+'|'+o.text)")
    
    for want in ['BA01','BA07','BA12','CA07']:
      v=[o.split('|')[0] for o in opts if o.split('|')[1].startswith(want)]
      if v:
        await sel.select_option(v[0], timeout=3000); await pg.click('#careAddBtn'); await pg.wait_for_timeout(200)
    await pg.evaluate("document.getElementById('transportCheck').click()")
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=S+'/shots/calc_filled.png',full_page=True)
    await pg.click('#kickoffBtn'); await pg.wait_for_timeout(500)
    if await pg.locator('#modalConfirm').is_visible(): await pg.click('#modalConfirm'); await pg.wait_for_timeout(400)
    if await pg.locator('#generateBtn').is_visible(): await pg.click('#generateBtn'); await pg.wait_for_timeout(600)
    await pg.screenshot(path=S+'/shots/calc_plan.png',full_page=True)
    await b.close()
asyncio.run(main())
