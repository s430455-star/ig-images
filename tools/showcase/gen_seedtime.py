"""Generate seedtime.js: ~100 FAKE timeliness records (masked names like 王O明) for screenshot demos."""
import json,random,sys
random.seed(7)
sur="王林陳張李黃吳劉蔡楊許鄭謝郭洪"; giv="明華美雄珍德芳志玉國"
mgr=["個管A","個管B","個管C","個管D"]
recs=[]
for m in range(1,11):
  for k in range(random.randint(8,14)):
    seam=random.random()<.3
    late=lambda p,t: random.randint(1,t) if random.random()>p else random.randint(t+1,t+4)
    pd=late(.12,3)
    ba=random.choice(['general','general','out','none']); c=random.choice(['general','out','none','general'])
    bd=None if ba=='none' else (None if m==10 and random.random()<.3 else late(.15,3 if ba=='out' else 5))
    cd=None if c=='none' else late(.15,3 if c=='out' else 5)
    recs.append(dict(caseType='無縫' if seam else '一般',manager=random.choice(mgr),name=random.choice(sur)+'O'+random.choice(giv),month=m,planDays=pd,planReason='-' if pd<=3 else random.choice(['家屬延後訪視','個案住院','']),baUse=ba,baDays=bd,baReason='' if not bd or bd<=5 else '單位人力不足',baAssigned='' if ba=='none' else random.choice(['系統輪派','家屬指定']),cUse=c,cDays=cd,cReason='' if not cd or cd<=5 else '個案時間無法配合',cAssigned='' if c=='none' else '系統輪派',serviceCode='BA01/BA07/CA07',multiService='',improve=''))
open(sys.argv[1] if len(sys.argv)>1 else 'seedtime.js','w').write("try{if(!localStorage.getItem('ltc_timeliness_year_115'))localStorage.setItem('ltc_timeliness_year_115',"+json.dumps(json.dumps(recs,ensure_ascii=False),ensure_ascii=False)+")}catch(e){}")
