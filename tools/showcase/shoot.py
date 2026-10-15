import asyncio,sys
from playwright.async_api import async_playwright
S=sys.argv[1]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    async def page(w,h,init=None):
      ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2)
      await ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('file:','https://cdnjs','data:')) else r.abort())
      if init: await ctx.add_init_script(path=init)
      return await ctx.new_page()
    pg=await page(400,860,S+'/mockdb.js'); await pg.goto('file://'+S+'/src/dispatch.html'); await pg.wait_for_timeout(2500)
    await pg.screenshot(path=S+'/shots/dispatch_full.png',full_page=True)
    pg=await page(400,860); await pg.goto('file://'+S+'/src/calc.html'); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=S+'/shots/calc_full.png',full_page=True)
    pg=await page(1280,860); await pg.goto('file://'+S+'/src/timeliness.html'); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=S+'/shots/time_full.png',full_page=True)
    await b.close()
asyncio.run(main())
