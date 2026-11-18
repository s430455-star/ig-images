/* =====================================================================
   hq-swap.js — 主要大樓換成「FUTURE TECHNOLOGY HEADQUARTERS」Blender 模型
   • 模型：models/future-hq.gltf.json（Blender Python 程式化建模，10 層／主體 50 m／尖塔 68 m）
   • 比例：場景 1 單位 ≈ 1.67 m（每層 H=3），模型每層 5 m → 縮放 0.6，10 層剛好對齊原本 10 層
   • 從外面看：顯示新大樓，隱藏原本程式產生的大樓外觀（樓板、玻璃、緞帶、屋頂尖塔）
   • 走進某一層：自動切回原本的樓層，室內、員工、展開動畫完全照舊；離開後再換回新大樓
   • 原本的玻璃仍保留在場景中（只是不畫出來），點大樓選樓層的功能不受影響
   API：HQSWAP.on(true/false) 切換新舊外觀；HQSWAP.ready
   ===================================================================== */
(function(){
'use strict';
const S={ready:false,enabled:true,model:null};
const SCALE=0.6, FILE='models/future-hq.gltf.json';
// 原本園區已有入口廣場與道路，新模型的基座與入口門廳不放進來，保留斜撐腳與螺旋落地座
const SKIP=/^(Base_Podium|Base_Metal_Trim|Base_Entrance_)/;
const wait=f=>{const c=window.__ct;if(c&&c.scene&&c.camera&&window.THREE&&THREE.GLTFLoader)f(c);else setTimeout(()=>wait(f),400);};
let towerParts=null,saved=new Map(),mode=null,glassMats=[];

function findTower(scene){
  const floors=[],roofs=[];
  scene.children.forEach(o=>{const u=o.userData||{};
    if(o.isGroup&&u.glassMat&&u.im&&u.deco)floors.push(o);
    else if(o.isGroup&&typeof u.baseY==='number'&&u.liftT!==undefined&&!u.glassMat)roofs.push(o);});
  return {floors,roofs};
}
function hideOld(){
  towerParts.floors.forEach(g=>{const u=g.userData;g.children.forEach(c=>{
      if(c.isMesh&&c.material===u.glassMat){u.glassMat.visible=false;return;}   // 保留點選用的玻璃
      if(!saved.has(c))saved.set(c,c.visible);c.visible=false;});});
  towerParts.roofs.forEach(r=>{if(!saved.has(r))saved.set(r,r.visible);r.visible=false;});
}
function showOld(entered){
  saved.forEach((v,o)=>{o.visible=v;});saved.clear();
  towerParts.floors.forEach(g=>{g.userData.glassMat.visible=true;});
  if(entered>=0){const fd=towerParts.floors.find(g=>Math.round(g.userData.baseY/3)===entered);
    if(fd){const u=fd.userData;u.core.visible=false;u.im.visible=false;u.deco.visible=false;}}
}
function apply(c){
  if(!towerParts||!S.model)return;
  const inside=c.entered&&c.entered()>=0;
  const want=S.enabled&&!inside?'new':'old';
  if(want!==mode){
    if(want==='new'){hideOld();S.model.visible=true;}
    else{showOld(inside?c.entered():-1);S.model.visible=false;}
    mode=want;
  }
}
function prep(root){
  const T=THREE;
  root.traverse(o=>{
    if(SKIP.test(o.name)){o.visible=false;return;}
    o.raycast=()=>{};                                   // 不擋住原本大樓的點選
    if(!o.isMesh)return;
    o.castShadow=true;o.receiveShadow=true;
    const m=o.material;if(!m)return;
    if(/Glass/.test(m.name||'')){
      const lobby=/Lobby/.test(m.name);
      const g=new T.MeshStandardMaterial({name:m.name,color:lobby?0xa9c3d3:0x24405a,metalness:.7,roughness:.05,transparent:true,
        opacity:lobby?.35:.82,depthWrite:!lobby,envMapIntensity:1.7,emissive:new T.Color(0xffc56b),emissiveIntensity:0});
      o.material=g;o.castShadow=false;glassMats.push(g);m.dispose&&m.dispose();
    }
    if(/White_Ceramic/.test((o.material&&o.material.name)||'')){   // 配合本場景的光暈與調色，白色外骨骼降一點亮度
      const w=o.material;w.color.setHex(0xc4ccd5);w.roughness=.34;w.metalness=.25;if('clearcoat' in w)w.clearcoat=.3;w.envMapIntensity=.85;}
    const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach(mt=>{if(mt&&mt.isMeshStandardMaterial&&window.HQB&&HQB.addEnv)HQB.addEnv(mt);});
  });
  root.scale.setScalar(SCALE);
}
wait(c=>{
  towerParts=findTower(c.scene);
  if(!towerParts.floors.length){console.warn('hq-swap: 找不到原本的大樓樓層，維持原樣');return;}
  new THREE.GLTFLoader().load(FILE,g=>{
    const root=g.scene;root.name='future-hq';prep(root);root.visible=false;
    c.scene.add(root);S.model=root;S.ready=true;
    const loop=()=>{apply(c);
      const n=c.getNight?c.getNight():0;glassMats.forEach(m=>{m.emissiveIntensity=n*.14;});   // 夜晚室內燈光透出
      requestAnimationFrame(loop);};
    loop();
    if(window.HQSTILL&&HQSTILL.refresh)setTimeout(()=>HQSTILL.refresh(),500);
  },undefined,e=>console.warn('hq-swap: 新大樓模型載入失敗，維持原本外觀',e));
});
S.on=v=>{S.enabled=!!v;mode=null;};
window.HQSWAP=S;
})();
