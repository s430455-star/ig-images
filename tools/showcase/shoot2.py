import asyncio,sys
from playwright.async_api import async_playwright
S=sys.argv[1]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':1100,'height':900},device_scale_factor=2)
    await ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('file:','https://cdnjs','data:')) else r.abort())
    await ctx.add_init_script(path=S+'/seedtime.js')
    pg=await ctx.new_page(); await pg.goto('file://'+S+'/src/timeliness.html'); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=S+'/shots/time_home.png',full_page=True)
    for i,t in enumerate(['個案清單','超時追蹤','年度成果']):
      await pg.get_by_text(t,exact=False).first.click(); await pg.wait_for_timeout(800)
      await pg.screenshot(path=S+f'/shots/time_tab{i}.png',full_page=True)
    await b.close()
asyncio.run(main())
