/* =====================================================================
   hq-swap.js — v7 主要大樓：FUTURE TECHNOLOGY HEADQUARTERS 200 m 版（由 80 m 版等比例拉高）
   規格：25 層、每層 3 m（主體 75 m）、通訊尖塔 125 m、總高 200 m、每層樓地板 100 坪
   • 1F–10F（各部門）是可展開的樓層切片；11F–25F 合成固定的上部塔身
   • 選擇樓層進入時：只留下那一層辦公室（獨立畫面），其他樓層、屋頂、尖塔、電梯井暫時隱藏，
     該層的外骨骼與結構柱也收起，辦公室完整露出；離開樓層後整棟恢復
   • 模型：Blender Python 程式化建模，切成 10 個樓層切片（models/future-hq-200p-*.gltf.json）
   • 比例：場景 1 單位 ≈ 1.67 m → 縮放 0.6；index.html 的樓層高度 H 改為 1.8（= 3 m）
   • 每個樓層切片掛在原本的樓層群組底下，所以點樓層「展開」時，滑出來的就是新大樓那一層
     （玻璃帷幕、窗框、結構柱、白色螺旋外骨骼都跟著出來），室內、員工、對話照舊
   • 原本程式產生的大樓外觀全部隱藏；原本的玻璃保留但不畫出來，點大樓選樓層照常
   • 「視角置中」改成看得到整棟 200 m 大樓；遠景霧依鏡頭距離自動調整
   API：HQSWAP.ready / HQSWAP.home()
   ===================================================================== */
(function(){
'use strict';
const S={ready:false,parts:0};
const SCALE=0.6, FILES=['models/future-hq-200p-a.gltf.json','models/future-hq-200p-b.gltf.json','models/future-hq-200p-c.gltf.json','models/future-hq-200p-u0.gltf.json','models/future-hq-200p-u1.gltf.json'];
const SKIP=/^(Base_Podium|Base_Metal_Trim|Base_Entrance_)/;         // 園區已有入口廣場
const HOME_NEW={t:[0,58,0],c:[128,150,172]};                           // 看得到整棟（總高 120 單位）
const wait=f=>{const c=window.__ct;if(c&&c.scene&&c.camera&&window.THREE&&THREE.GLTFLoader)f(c);else setTimeout(()=>wait(f),400);};
let haze=null,floors=[],roof=null,H=12.72,N=10,oldRoofKids=[],ribbonMats=[],glassAll=[],floorSlices={},base=null;
const RIB_DAY=new THREE.Color(0x8f98a3),RIB_NIGHT=new THREE.Color(0xd3d9e0);

function findTower(scene){
  scene.children.forEach(o=>{const u=o.userData||{};
    if(o.isGroup&&u.glassMat&&u.im&&u.deco)floors.push(o);
    else if(o.isGroup&&typeof u.baseY==='number'&&u.liftT!==undefined&&!u.glassMat)roof=o;});
  floors.sort((a,b)=>a.userData.baseY-b.userData.baseY);N=floors.length;
  if(N>1)H=floors[1].userData.baseY-floors[0].userData.baseY;
  if(roof)oldRoofKids=roof.children.slice();
}
/* 原本的大樓外觀：每一格都強制隱藏（玻璃只關掉繪製，保留點選） */
function hideOld(){
  floors.forEach(g=>{const u=g.userData;g.children.forEach(c=>{
    if(c.userData&&c.userData.hqNew)return;
    if(c.isMesh&&c.material===u.glassMat){u.glassMat.visible=false;return;}
    if(c===u.core||c===u.im||c===u.deco||c.isLineSegments||(c.isMesh&&!c.userData.keep))c.visible=false;});});
  oldRoofKids.forEach(o=>{o.visible=false;});
}
function prepMesh(o,perFloor){
  const T=THREE;o.raycast=()=>{};
  if(SKIP.test(o.name.replace(/^F\d\d__/,''))){o.visible=false;return;}
  if(!o.isMesh)return;
  o.castShadow=true;o.receiveShadow=true;
  const m=o.material;if(!m)return;
  if(/Glass/.test(m.name||'')){
    const lobby=/Lobby/.test(m.name);
    const g=new T.MeshStandardMaterial({name:m.name,color:lobby?0xa9c3d3:0x24405a,metalness:.7,roughness:.05,transparent:true,
      opacity:lobby?.35:.82,depthWrite:!lobby,envMapIntensity:1.7,emissive:new T.Color(0xffc56b),emissiveIntensity:0});
    g.userData.base=g.opacity;o.material=g;o.castShadow=false;glassAll.push(g);if(perFloor)perFloor.glass.push(g);
  }else if(/White_Ceramic/.test(m.name||'')){
    m.roughness=.42;m.metalness=.2;if('clearcoat' in m)m.clearcoat=0;m.envMapIntensity=.55;if(!ribbonMats.includes(m))ribbonMats.push(m);
  }
  if(perFloor&&/Main_Core$/.test(o.name))perFloor.core.push(o);
  const mats=Array.isArray(o.material)?o.material:[o.material];
  mats.forEach(mt=>{if(mt&&mt.isMeshStandardMaterial&&window.HQB&&HQB.addEnv)HQB.addEnv(mt);});
}
/* 把一個 glTF 節點掛到目標群組：目標在原點位置 (0,y0,0) 時，切片剛好落在大樓上的正確高度 */
function mount(node,target,y0){
  const w=new THREE.Group();w.userData.hqNew=true;w.scale.setScalar(SCALE);w.position.y=-y0;
  w.add(node);target.add(w);return w;
}
function onPart(gltf,c){
  const nodes=gltf.scene.children.slice();
  nodes.forEach(n=>{
    const m=/^F(\d\d)__/.exec(n.name);
    if(m){const i=+m[1],g=floors[i];if(!g)return;
      const pf=floorSlices[i]||(floorSlices[i]={glass:[],core:[]});
      n.traverse(o=>prepMesh(o,pf));
      // 每層的玻璃材質獨立一份，展開那一層時只讓那一層變透明
      n.traverse(o=>{if(o.isMesh&&o.material&&/Glass/.test(o.material.name||'')){const cl=o.material.clone();cl.userData.base=o.material.userData.base;
        pf.glass.splice(pf.glass.indexOf(o.material),1,cl);glassAll.push(cl);o.material=cl;}});
      mount(n,g,i*H);
    }else{
      n.traverse(o=>prepMesh(o,null));
      const top=/^(Spire_|Roof_)/.test(n.name);
      if(top&&roof)mount(n,roof,N*H);
      else{if(!base){base=new THREE.Group();base.name='future-hq-base';c.scene.add(base);}mount(n,base,0);}
    }
  });
  S.parts++;
}
let lastEntered=-2,tw=null,elevParts=null;
/* 獨立辦公室畫面：進入樓層時只留下那一層 */
const OPEN_UP=/__(Exo_|Main_Structural_Columns|Main_Vertical_Mullions|Main_Horizontal_Louvers)/;
function isolate(c,e){
  const solo=e>=0;
  floors.forEach((g,i)=>{g.children.forEach(w=>{if(w.userData&&w.userData.hqNew){w.visible=!solo||i===e;
      if(i===e||!solo)w.traverse(o=>{if(o.isMesh&&OPEN_UP.test(o.name))o.visible=!(solo&&i===e);});}});});
  if(roof)roof.children.forEach(w=>{if(w.userData&&w.userData.hqNew)w.visible=!solo;});
  if(base)base.visible=!solo;
  if(!elevParts){elevParts=[];c.scene.children.forEach(o=>{
    if(o.isGroup&&o.children.some(m=>m.geometry&&m.geometry.parameters&&m.geometry.parameters.width===1.4&&m.geometry.parameters.depth===1.4))elevParts.push(o);
    else if(o.isMesh&&o.geometry&&o.geometry.parameters&&o.geometry.parameters.width===.5&&o.geometry.parameters.height===2.2)elevParts.push(o);});}
  elevParts.forEach(o=>{o.visible=!solo;});
}
/* 遠景霧依鏡頭距離退遠（城市模組每格會重設霧，所以在它之後再調整一次） */
function fogFit(c){const f=c.scene.fog;if(!f)return;const d=c.camera.position.distanceTo(c.controls.target);
  f.near=Math.max(f.near,d*1.25);f.far=Math.max(f.far,d*3.2+300);}
function hookCity(c){if(!window.HQC||!HQC.update||HQC.update.__hqswap)return;const f0=HQC.update;
  const w=function(){const r=f0.apply(this,arguments);fogFit(c);return r;};w.__hqswap=1;HQC.update=w;}
function flyHome(c){
  if(c.entered&&c.entered()>=0)c.exitFloor();
  const from=c.camera.position.clone(),ft=c.controls.target.clone(),t0=performance.now(),dur=matchMedia('(prefers-reduced-motion: reduce)').matches?1:1600;
  const to=from.clone().set(...HOME_NEW.c),tt=ft.clone().set(...HOME_NEW.t);
  if(c.clearTrans)c.clearTrans();if(tw)cancelAnimationFrame(tw);
  const step=now=>{const u=Math.min(1,(now-t0)/dur),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
    c.camera.position.lerpVectors(from,to,e);c.controls.target.lerpVectors(ft,tt,e);if(c.setTarget)c.setTarget(c.controls.target.x,c.controls.target.y,c.controls.target.z);
    tw=u<1?requestAnimationFrame(step):null;};tw=requestAnimationFrame(step);}
function mountUI(c){
  const tryMount=()=>{const home=document.getElementById('btnHome');if(!home){setTimeout(tryMount,400);return;}
    home.onclick=()=>flyHome(c);home.title='回到看得到整棟 200 m 大樓的視角';};
  tryMount();}
function loop(c){
  hideOld();
  const e=c.entered?c.entered():-1;
  if(e!==lastEntered){
    Object.keys(floorSlices).forEach(k=>{const pf=floorSlices[k],on=+k===e;
      pf.core.forEach(o=>{o.visible=!on;});
      pf.glass.forEach(m=>{m.opacity=on?.08:m.userData.base;m.depthWrite=!on&&m.userData.base>.5;});});
    isolate(c,e);
    lastEntered=e;
  }
  const n=c.getNight?c.getNight():0;
  glassAll.forEach(m=>{m.emissiveIntensity=n*.14;});
  ribbonMats.forEach(m=>m.color.copy(RIB_DAY).lerp(RIB_NIGHT,n));
  // 城市低空薄霧（高度 7、19）：鏡頭飛高往下看時會把整座城市蓋白，依鏡頭高度淡出
  if(!haze){const sf=c.scene.getObjectByName('scifi');haze=[];if(sf)sf.traverse(o=>{const u=o.material&&o.material.uniforms;if(u&&u.uK&&u.uDay){haze.push([u.uK,u.uK.value]);}});}
  const hk=Math.min(1,Math.max(0,1-(c.camera.position.y-40)/70));haze.forEach(([u,k])=>{u.value=k*hk;});
  // 遠景霧：鏡頭拉遠看整棟時，霧跟著退遠
  fogFit(c);
  if(c.camera.far<6000){c.camera.far=6000;c.camera.updateProjectionMatrix();}
  requestAnimationFrame(()=>loop(c));
}
wait(c=>{
  findTower(c.scene);
  if(floors.length!==10){console.warn('hq-swap: 找不到 10 個樓層，維持原樣');return;}
  const L=new THREE.GLTFLoader();let left=FILES.length;
  FILES.forEach(fn=>L.load(fn,g=>{onPart(g,c);if(--left===0)done(c);},undefined,e=>{console.warn('hq-swap: 載入失敗',fn,e);if(--left===0)done(c);}));
});
function done(c){
  S.ready=S.parts===FILES.length;
  if(!S.parts)return;
  hookCity(c);loop(c);mountUI(c);
  if(!(c.entered&&c.entered()>=0))setTimeout(()=>flyHome(c),300);
  if(window.HQSTILL&&HQSTILL.refresh)setTimeout(()=>HQSTILL.refresh(),500);
}
S.home=()=>window.__ct&&flyHome(window.__ct);
window.HQSWAP=S;
})();
