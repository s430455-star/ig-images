(function(){
  const store={assignments:{}};
  const listeners={};
  const today=new Date(); const d=(n)=>{const x=new Date(today);x.setDate(x.getDate()-n);return x.toISOString().slice(0,10)};
  const fake=[["CA07","u001","王O明",1],["CA07","u002","林O華",2],["CB04","u003","陳O美",3],["CD02一般","u005","張O雄",4],["CB03","u001","李O珍",6],["CA07","u004","黃O德",8]];
  fake.forEach((f,i)=>store.assignments["a"+i]={code:f[0],unitId:f[1],caseName:f[2],date:d(f[3]),district:"示範區",createdAt:Date.now()-f[3]*864e5});
  const col=(n)=>store[n]||(store[n]={});
  const snapDoc=(n,id)=>({id,exists:id in col(n),data:()=>col(n)[id]?JSON.parse(JSON.stringify(col(n)[id])):undefined});
  const fire=(n)=>(listeners[n]||[]).forEach(cb=>cb(qsnap(n,()=>true)));
  const qsnap=(n,f)=>({docs:Object.keys(col(n)).filter(id=>f(col(n)[id])).map(id=>snapDoc(n,id))});
  function docRef(n,id){return{get:async()=>snapDoc(n,id),set:async(v)=>{col(n)[id]=JSON.parse(JSON.stringify(v));fire(n)},update:async(v)=>{col(n)[id]=Object.assign(col(n)[id]||{},v);fire(n)},acquire:async()=>({acquired:true})}}
  function query(n,conds){return{where:(k,op,v)=>query(n,[...conds,[k,v]]),get:async()=>qsnap(n,o=>conds.every(([k,v])=>o[k]===v))}}
  const db={collection:(n)=>Object.assign(query(n,[]),{doc:(id)=>docRef(n,id),add:async(v)=>{col(n)["x"+Math.random()]=v;fire(n)},onSnapshot:(cb)=>{(listeners[n]=listeners[n]||[]).push(cb);cb(qsnap(n,()=>true));return()=>{}}}),doc:(p)=>{const [n,id]=p.split('/');return docRef(n,id)}};
  window.claude={use:async(k)=>k==='db'?db:null};
})();
