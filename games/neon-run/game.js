/* NEON RUN — local, self-contained Three.js edition */
const $=id=>document.getElementById(id);
const canvas=$('game');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){$('start').querySelector('p').textContent='This 3D version needs WebGL. Please enable hardware acceleration in your browser and reload.';throw e}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new THREE.Scene();scene.background=new THREE.Color('#172641');scene.fog=new THREE.FogExp2('#29354c',.013);
const camera=new THREE.PerspectiveCamera(59,innerWidth/innerHeight,.1,210);camera.position.set(0,4.2,8.7);
scene.add(new THREE.HemisphereLight('#abbaff','#40505b',.85));
const sun=new THREE.DirectionalLight('#ffe1c3',1.7);sun.position.set(-12,22,-25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:30,bottom:-25,near:1,far:85});sun.shadow.bias=-.00035;sun.shadow.normalBias=.035;sun.target.position.set(0,0,-12);scene.add(sun,sun.target);
const rim=new THREE.DirectionalLight('#70e4ff',.9);rim.position.set(9,6,5);scene.add(rim);
const mats={};function mat(name,color,roughness=.65,metalness=.05,emissive=null){let m=new THREE.MeshStandardMaterial({color,roughness,metalness,emissive:emissive||'#000000',emissiveIntensity:emissive?.85:0});m.color.convertSRGBToLinear();m.emissive.convertSRGBToLinear();mats[name]=m;return m}
const M={ground:mat('ground','#192932'),track:mat('track','#283741'),steel:mat('steel','#96afb8',.3,.8),wood:mat('wood','#52616b'),concrete:mat('concrete','#586879'),edge:mat('edge','#74dec7',.35,.1,'#1d948d'),dark:mat('dark','#132239'),train:mat('train','#62a8b9',.3,.45),trainRoof:mat('roof','#adc6c5',.4,.5),coral:mat('coral','#f79585'),glass:mat('glass','#193c59',.16,.65),light:mat('light','#fff2c8',.2,.1,'#ffe1a3'),pink:mat('pink','#ff8aca',.4,0,'#ae2e75'),gold:mat('gold','#ffd45a',.23,.7,'#b46c12'),lime:mat('lime','#b5ef65'),limeDark:mat('limeDark','#80ac45'),skin:mat('skin','#d99f7c'),hair:mat('hair','#342634'),pants:mat('pants','#303e62'),pants2:mat('pants2','#435678'),shoe:mat('shoe','#f3eddc'),sole:mat('sole','#bce97d'),bag:mat('bag','#305964'),strap:mat('strap','#203a43'),cap:mat('cap','#c784b3'),capDark:mat('capDark','#855483')};
const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,14,10),cyl=new THREE.CylinderGeometry(1,1,1,12);
function mesh(g,m,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){let o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function box(parent,m,x,y,z,w,h,d){return mesh(cube,m,parent,x,y,z,w,h,d)}
function ball(parent,m,x,y,z,w,h=w,d=w){return mesh(sphere,m,parent,x,y,z,w,h,d)}
function group(parent,x=0,y=0,z=0){let g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g}
// One continuous rail corridor, with recycled architectural sections.
box(scene,M.ground,0,-.25,-70,180,.35,210);
for(let l=-1;l<=1;l++){box(scene,M.track,l*2.5,-.035,-60,2.22,.12,180);for(let side of [-1,1])box(scene,M.steel,l*2.5+side*.65,.09,-60,.07,.12,180)}
for(let side of [-1,1]){box(scene,M.concrete,side*5.1,.1,-65,2.6,.3,180);box(scene,M.edge,side*3.86,.28,-65,.065,.04,180)}
const sleepers=new THREE.InstancedMesh(cube,M.wood,330);let dummy=new THREE.Object3D();for(let i=0;i<110;i++)for(let l=-1;l<=1;l++){dummy.position.set(l*2.5,.015,10-i*1.35);dummy.scale.set(1.65,.085,.19);dummy.updateMatrix();sleepers.setMatrixAt(i*3+l+1,dummy.matrix)}sleepers.receiveShadow=true;scene.add(sleepers);
let rng=97;function random(){rng=(rng*16807)%2147483647;return(rng-1)/2147483646}
const cityMaterials=['#34495e','#43536c','#2e445b','#576077','#3d566a'].map((c,i)=>mat('building'+i,c));
const winWarm=mat('windowWarm','#ffe1a0',.4,0,'#a87942'),winCool=mat('windowCool','#97cfde',.3,.1,'#347c9c');
const city=[];
function signTexture(text,bg,fg){let c=document.createElement('canvas');c.width=512;c.height=128;let x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,512,128);x.fillStyle=fg;x.font='900 60px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,68);let tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;return new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:.55,roughness:.5})}
const signs=[signTexture('AFTER HOURS','#252044','#ff9cdd'),signTexture('夜  NIGHT CITY','#163c44','#b6ffdf'),signTexture('KEEP MOVING ↗','#d8ef93','#20394c'),signTexture('07 • MIDNIGHT','#22354e','#b6e6ed')];
function muralMaterial(text,accent){let c=document.createElement('canvas');c.width=1024;c.height=384;let x=c.getContext('2d');x.fillStyle='#182c3b';x.fillRect(0,0,1024,384);for(let row=0;row<12;row++){x.strokeStyle='#ffffff0d';x.beginPath();x.moveTo(0,row*32);x.lineTo(1024,row*32);x.stroke();for(let col=0;col<17;col++){let bx=col*64+(row%2)*32;x.beginPath();x.moveTo(bx,row*32);x.lineTo(bx,row*32+32);x.stroke()}}x.save();x.translate(500,205);x.rotate(-.075);x.textAlign='center';x.font='italic 900 130px Arial';x.lineWidth=16;x.strokeStyle='#070f27';x.strokeText(text,8,8);x.strokeStyle=accent;x.lineWidth=5;x.strokeText(text,0,0);x.fillStyle='#dbe9df';x.fillText(text,0,0);x.strokeStyle=accent;x.lineWidth=9;x.beginPath();x.moveTo(-360,32);x.lineTo(330,20);x.stroke();x.font='bold 21px Arial';x.fillStyle=accent;x.fillText('THE CITY IS OUR PLAYGROUND  /  07',0,83);x.restore();let tex=new THREE.CanvasTexture(c);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();return new THREE.MeshStandardMaterial({map:tex,roughness:.95})}
const murals=[muralMaterial('NO SLEEP','#c0f77b'),muralMaterial('STAY GOLD','#ed95cf'),muralMaterial('RUN WILD','#8acedd')];
let gritCanvas=document.createElement('canvas');gritCanvas.width=gritCanvas.height=128;let gc=gritCanvas.getContext('2d');gc.fillStyle='#b5b5b5';gc.fillRect(0,0,128,128);for(let i=0;i<1800;i++){let v=90+Math.floor(random()*110);gc.fillStyle='rgb('+v+','+v+','+v+')';gc.fillRect(random()*128,random()*128,1+random()*3,1+random()*2)}let grit=new THREE.CanvasTexture(gritCanvas);grit.wrapS=grit.wrapT=THREE.RepeatWrapping;grit.repeat.set(2,110);grit.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());M.track.map=grit;M.track.needsUpdate=true;
for(let i=0;i<14;i++){
 let chunk=group(scene,0,0,-i*12);city.push(chunk);
 for(let side of [-1,1]){let h=6+random()*14,w=4+random()*3,x=side*(6.6+w*.5);box(chunk,cityMaterials[i%5],x,h/2,-3,w,h,10.8);box(chunk,M.dark,x,h+.15,-3,w+.15,.3,11);box(chunk,cityMaterials[(i+2)%5],x,h+1,-3,w*.55,1.8,5);
 // Visible front and inward facade windows.
 for(let row=0;row<Math.floor(h/1.45)-1;row++)for(let col=0;col<4;col++){if(random()<.25)continue;let wm=random()>.5?winWarm:winCool;box(chunk,wm,x-w*.36+col*w*.24,1.65+row*1.45,2.415,.58,.78,.025);box(chunk,wm,side*(6.6-.012),1.65+row*1.45,-6.8+col*2.1,.025,.78,.9)}
 box(chunk,murals[i%3],side*5.65,1.7,-3,.09,3.1,8);if(i%2===0){let sg=box(chunk,signs[i%4],side*5.58,3.4,1,3.5,.88,.12);sg.rotation.y=side*.12}
 // Street lamps with luminous undersides.
 box(chunk,M.steel,side*4.8,2.7,3,.09,5.4,.09);box(chunk,M.steel,side*4.3,5.35,3,1.1,.09,.09);box(chunk,M.light,side*3.95,5.28,3,.6,.06,.3);
 if(i%3===0){box(chunk,side>0?M.pink:M.edge,side*6.45,h*.53,2.5,.07,h*.65,.075)}
 }
 if(i%4===0){box(chunk,M.dark,0,6.1,-5,12,.16,.16);for(let s of [-1,1])box(chunk,M.dark,s*5.5,3.1,-5,.15,6.2,.15)}
}
// Bake static architecture by material: retain parallax without thousands of draw calls.
function bakeChunk(root){let batches=new Map();root.updateMatrixWorld(true);for(let child of [...root.children]){if(!child.isMesh)continue;child.updateMatrix();let g=child.geometry.clone();g.applyMatrix4(child.matrix);if(g.index){let flat=g.toNonIndexed();g.dispose();g=flat}if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(g);root.remove(child)}for(let [material,geometries] of batches){let merged=new THREE.BufferGeometry();for(let key of ['position','normal','uv']){let length=geometries.reduce((n,g)=>n+g.attributes[key].array.length,0),data=new Float32Array(length),offset=0;for(let g of geometries){data.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length}merged.setAttribute(key,new THREE.BufferAttribute(data,key==='uv'?2:3))}let m=new THREE.Mesh(merged,material);m.castShadow=!material.emissiveIntensity;m.receiveShadow=true;root.add(m);geometries.forEach(g=>g.dispose())}}
city.forEach(bakeChunk);
const skyCanvas=document.createElement('canvas');skyCanvas.width=64;skyCanvas.height=512;let skyCtx=skyCanvas.getContext('2d'),skyGrad=skyCtx.createLinearGradient(0,0,0,512);skyGrad.addColorStop(0,'#101c39');skyGrad.addColorStop(.52,'#293b61');skyGrad.addColorStop(1,'#997b8e');skyCtx.fillStyle=skyGrad;skyCtx.fillRect(0,0,64,512);let skyTex=new THREE.CanvasTexture(skyCanvas);skyTex.encoding=THREE.sRGBEncoding;scene.background=skyTex;
// Low-poly distant towers and a moon, all local geometry.
for(let i=0;i<26;i++){let x=(random()-.5)*160,h=10+random()*26;box(scene,cityMaterials[i%5],x,h/2,-155-random()*20,4+random()*7,h,6)}
let moon=ball(scene,new THREE.MeshBasicMaterial({color:'#ffe1b9'}),31,39,-145,4);moon.castShadow=false;
// Fully articulated runner. Feet are solved with two-bone IK rather than rotating rigid legs.
const player=group(scene);const body=group(player,0,.94,0);
ball(body,M.lime,0,.3,0,.29,.38,.19);box(body,M.limeDark,0,.055,0,.45,.11,.32);
const neck=mesh(cyl,M.skin,body,0,.67,0,.08,.16,.08);const head=group(body,0,.88,0);
ball(head,M.skin,0,0,0,.19,.215,.18);ball(head,M.hair,0,.07,.02,.197,.17,.177);ball(head,M.skin,-.195,-.01,0,.038,.06,.033);ball(head,M.skin,.195,-.01,0,.038,.06,.033);
ball(head,M.cap,0,.15,0,.215,.13,.2);box(head,M.capDark,0,.08,0,.415,.04,.35);let brim=ball(head,M.cap,0,.075,-.17,.23,.025,.15);box(head,M.capDark,0,.085,.177,.1,.038,.015);
// Face is visible on the turn lean; the camera sees the detailed backpack.
ball(head,M.skin,0,-.03,-.177,.047,.05,.037);for(let x of [-.075,.075])ball(head,M.dark,x,.022,-.164,.021,.025,.014);
for(let x of [-.18,.18]){let strap=box(body,M.strap,x,.31,.16,.045,.54,.045);strap.rotation.z=x*.6}
ball(body,M.bag,0,.31,.205,.22,.27,.105);box(body,M.strap,0,.2,.3,.32,.15,.035);box(body,M.lime,0,.43,.3,.10,.047,.019);box(body,M.steel,0,.27,.322,.24,.012,.014);
const limbs=[];
function segment(parent,material,r,length){return mesh(cyl,material,parent,0,-length/2,0,r,length,r)}
for(let side of [-1,1]){
 let hip=group(player,side*.15,.94,0),thigh=segment(hip,M.pants,.105,.44),knee=group(hip,0,-.44,0);ball(knee,M.pants,0,0,0,.104);segment(knee,M.pants2,.082,.43);let ankle=group(knee,0,-.43,0);
 box(ankle,M.shoe,0,.015,-.07,.19,.12,.34);box(ankle,M.sole,0,-.049,-.075,.20,.04,.36);box(ankle,M.pants,0,.08,.02,.14,.11,.14);box(ankle,M.cap,side*.098,.023,-.08,.016,.036,.15);
 for(let i=0;i<3;i++)box(ankle,M.dark,0,.079,-.11-i*.033,.11,.008,.01);
 let shoulder=group(body,side*.30,.54,0);ball(shoulder,M.lime,0,0,0,.115);segment(shoulder,M.lime,.087,.29);let elbow=group(shoulder,0,-.29,0);ball(elbow,M.limeDark,0,0,0,.083);segment(elbow,M.lime,.071,.27);let hand=ball(elbow,M.skin,0,-.30,0,.072,.086,.065);box(elbow,M.strap,0,-.238,0,.145,.045,.13);
 limbs.push({side,hip,knee,ankle,shoulder,elbow});
}
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;let sc=shadowCanvas.getContext('2d'),gr=sc.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'#00000099');gr.addColorStop(1,'#00000000');sc.fillStyle=gr;sc.fillRect(0,0,128,128);const contact=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.11;scene.add(contact);
let state='menu',distance=0,coins=0,best=0,lane=0,px=0,velocityX=0,jump=0,jv=0,slide=0,slidePose=0,land=0,phase=0,speed=21,time=0,spawn=0,toastTime=0,objects=[],particles=[],last=performance.now();try{best=Number(localStorage.getItem('neonrun-best'))||0}catch(e){}
const particleGeo=new THREE.IcosahedronGeometry(.05,0),dustMat=new THREE.MeshBasicMaterial({color:'#a6cfca',transparent:true,opacity:.3});
function burst(x,y,z,n,gold=false){for(let i=0;i<n;i++){let m=new THREE.Mesh(particleGeo,gold?M.gold:dustMat);m.position.set(x,y,z);scene.add(m);particles.push({m,v:new THREE.Vector3((Math.random()-.5)*3,Math.random()*2+1,Math.random()*3),life:gold?.6:.3,max:gold?.6:.3})}}
const coinGeo=new THREE.CylinderGeometry(.23,.23,.07,16),coinInner=new THREE.CylinderGeometry(.17,.17,.08,12);
function createObstacle(type,l,z){let g=group(scene,l*2.5,0,z);let o={type,l,z,g,hit:false};
 if(type==='coin'){let c=mesh(coinGeo,M.gold,g,0,1,0);c.rotation.x=Math.PI/2;let inner=mesh(coinInner,M.light,g,0,1,0,.75,1,.75);inner.rotation.x=Math.PI/2;o.spin=c;o.inner=inner;}
 if(type==='train'){
 box(g,M.dark,0,.35,-4,1.7,.4,8.8);box(g,M.train,0,1.75,-4,2.05,2.55,9);box(g,M.trainRoof,0,3.06,-4,2.12,.15,9);box(g,M.coral,0,.9,.51,2.06,.22,.04);
 for(let s of [-1,1]){box(g,M.glass,s*.46,2.34,.515,.80,.78,.028);box(g,M.light,s*.72,.63,.55,.24,.13,.07);for(let i=0;i<5;i++){box(g,M.glass,s*1.035,2.25,-.55-i*1.6,.035,.86,1.04);box(g,M.trainRoof,s*1.057,1.66,-.55-i*1.6,.035,.035,1.09)}box(g,M.coral,s*1.04,.9,-4,.03,.2,9);for(let z of [-1,-7]){let wh=mesh(cyl,M.dark,g,s*.8,.28,z,.29,.14,.29);wh.rotation.z=Math.PI/2}}
 box(g,signs[3],0,2.94,.52,1.48,.23,.03);box(g,M.dark,0,.36,.63,1.2,.16,.23);for(let s of [-1,1]){let w=box(g,M.steel,s*.44,2.10,.55,.035,.5,.025);w.rotation.z=.3}box(g,M.dark,0,3.17,-3,.85,.12,1.8);
 }
 if(type==='barrier'){for(let s of [-1,1]){box(g,M.steel,s*.77,.42,0,.1,.84,.1);box(g,M.dark,s*.77,.08,0,.40,.1,.55)}box(g,M.coral,0,.53,0,1.85,.6,.22);for(let i=0;i<6;i++){let stripe=box(g,M.dark,-.78+i*.31,.53,.119,.12,.59,.013);stripe.rotation.z=-.3}box(g,M.light,0,.85,0,1.85,.035,.22)}
 if(type==='gate'){for(let s of [-1,1])box(g,M.steel,s*.94,1.6,0,.12,3.2,.14);box(g,M.pink,0,2.35,0,2.1,1.2,.20);box(g,duckSign,0,2.35,.115,1.9,.93,.02);for(let s of [-1,1])box(g,M.dark,s*.94,.1,0,.5,.13,.6)}
 objects.push(o);return o;
}
const duckSign=signTexture('↓  SLIDE  ↓','#492b53','#ffcee8');
function clearObjects(){for(let o of objects)scene.remove(o.g);objects=[];for(let p of particles)scene.remove(p.m);particles=[]}
function menuProps(){clearObjects();createObstacle('train',1,-24);createObstacle('train',-1,-64);for(let i=0;i<9;i++)createObstacle('coin',0,-6-i*3)}menuProps();
function notify(text){$('toast').textContent=text;$('toast').style.opacity=1;toastTime=2}
function start(){clearObjects();state='playing';distance=coins=0;lane=px=velocityX=jump=jv=slide=slidePose=land=0;speed=21;spawn=1.1;for(let id of ['start','end','paused','footer'])$(id).classList.add('hidden');$('hud').style.display='flex';$('hint').style.display='block';$('mobileControls').classList.remove('hidden');$('score').textContent='0000';$('coins').textContent=0;notify('NEW DIMENSION. SAME HUSTLE.');}
function end(o){state='over';best=Math.max(best,Math.floor(distance));try{localStorage.setItem('neonrun-best',best)}catch(e){}$('finalScore').textContent=Math.floor(distance)+' m';$('finalCoins').textContent=coins;$('best').textContent=best;$('reason').textContent=o.type==='train'?'Switch lanes to avoid the trains — including their sides.':o.type==='gate'?'Get low! Press ↓ or swipe down before the sign.':'Jump the striped barriers with ↑ or Space.';$('end').classList.remove('hidden');$('hint').style.display='none';$('mobileControls').classList.add('hidden');$('toast').style.opacity=0;}
function pause(){if(state==='playing'){state='paused';$('paused').classList.remove('hidden')}else if(state==='paused'){state='playing';$('paused').classList.add('hidden')}}
function action(a){if(state!=='playing')return;if(a==='left')lane=Math.max(-1,lane-1);if(a==='right')lane=Math.min(1,lane+1);if(a==='jump'&&jump===0){jv=7.8;slide=0;burst(px,.15,0,6)}if(a==='slide'){slide=.85;if(jump>0)jv=Math.min(jv,-10)}}
addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'||e.code==='KeyP')pause();if((state==='menu'||state==='over')&&['Space','Enter'].includes(e.code)){start();return}if(state==='paused'&&e.code==='Space'){pause();return}let a={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',ArrowDown:'slide',KeyS:'slide'}[e.code];if(a&&!e.repeat)action(a)});
let touch;canvas.addEventListener('touchstart',e=>{touch={x:e.touches[0].clientX,y:e.touches[0].clientY};e.preventDefault()},{passive:false});canvas.addEventListener('touchend',e=>{if(!touch)return;let dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;action(Math.max(Math.abs(dx),Math.abs(dy))<15?'jump':Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy<0?'jump':'slide');touch=null;e.preventDefault()},{passive:false});
$('play').onclick=$('again').onclick=start;$('pause').onclick=$('resume').onclick=pause;$('home').onclick=()=>{state='menu';$('end').classList.add('hidden');$('start').classList.remove('hidden');$('hud').style.display='none';$('footer').classList.remove('hidden');lane=px=jump=slide=slidePose=0;menuProps()};document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;let stepIndex=0;
function animateRunner(dt){
 const running=state==='menu'||state==='playing';if(running)phase+=dt*(12+speed*.14);
 slidePose=lerp(slidePose,slide>0?1:0,1-Math.exp(-dt*18));land=Math.max(0,land-dt*3.5);
 let crouch=slidePose,bob=Math.cos(phase*2)*.022*(1-crouch),hipHeight=.94+bob-land*.11;
 player.position.set(px,jump,0);player.rotation.z=lerp(player.rotation.z,-velocityX*.035,1-Math.exp(-dt*12));player.rotation.y=lerp(player.rotation.y,-velocityX*.025,1-Math.exp(-dt*9));
 body.position.y=hipHeight-crouch*.49;body.rotation.x=-.075-crouch*.85+(jump>0?-.13:0);body.rotation.y=Math.sin(phase)*.07*(1-crouch);body.rotation.z=Math.cos(phase)*.025*(1-crouch);head.rotation.x=.10+crouch*.3;head.rotation.y=-player.rotation.y*.5;
 for(let limb of limbs){let p=phase+(limb.side>0?Math.PI:0),cycle=(p/(Math.PI*2)%1+1)%1;
 // Stance: shoe travels backward on the ground. Swing: knee flexes to clear the ground.
 let footZ,footY;if(cycle<.55){let q=cycle/.55;footZ=lerp(-.34,.34,q);footY=.09}else{let q=(cycle-.55)/.45;footZ=lerp(.34,-.34,q);footY=.09+Math.sin(q*Math.PI)*.30}
 let hipY=hipHeight;if(jump>0){let tuck=Math.min(1,jump);footY=.18+tuck*(limb.side>0?.30:.15);footZ=limb.side>0?-.30:.25}
 hipY-=crouch*.5;footY=lerp(footY,.085,crouch);footZ=lerp(footZ,limb.side>0?-.64:.49,crouch);
 limb.hip.position.y=hipY;let dy=hipY-footY,dz=footZ,L1=.44,L2=.43,d=clamp(Math.hypot(dy,dz),.05,L1+L2-.005);let alpha=Math.acos(clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1)),knee=Math.PI-Math.acos(clamp((L1*L1+L2*L2-d*d)/(2*L1*L2),-1,1));
 limb.hip.rotation.x=-Math.atan2(dz,dy)+alpha;limb.knee.rotation.x=-knee;limb.ankle.rotation.x=-limb.hip.rotation.x+knee+(cycle>.48&&cycle<.66?.18:0)*(1-crouch);
 let swing=Math.sin(p)*.68;limb.shoulder.rotation.x=lerp(-swing,jump>0?-.65:-.35,crouch||jump>0?.65:0);limb.shoulder.rotation.z=limb.side*(.10+crouch*.4);limb.elbow.rotation.x=-.85-Math.max(0,swing)*.35-crouch*.25;
 }
 contact.position.x=px;contact.material.opacity=1-jump*.25;contact.scale.setScalar(1+jump*.3);
 if(running&&jump===0&&slide===0){let step=Math.floor(phase/Math.PI);if(step!==stepIndex){stepIndex=step;if(state==='playing')burst(px+(step%2?.15:-.15),.14,.15,3)}}
}
function update(dt){if(state==='paused'||state==='over')return;time+=dt;let move=dt*(state==='menu'?8:speed);sleepers.position.z=(sleepers.position.z+move)%1.35;for(let c of city){c.position.z+=move;if(c.position.z>20)c.position.z-=168}
 if(state==='playing'){
 distance+=move;speed=Math.min(39,21+distance/260);let target=lane*2.5,old=px;px=lerp(px,target,1-Math.exp(-dt*13));velocityX=(px-old)/dt;
 if(jv!==0||jump>0){jump+=jv*dt;jv-=21*dt;if(jump<=0){jump=0;jv=0;land=1;burst(px,.13,0,9)}}slide=Math.max(0,slide-dt);
 spawn-=dt;if(spawn<=0){let l=Math.floor(Math.random()*3)-1,type=['train','barrier','gate'][Math.floor(Math.random()*3)];createObstacle(type,l,-125);let cl=l===1?0:l+1;for(let i=0;i<7;i++)createObstacle('coin',cl,-125-i*3.2);spawn=1.95+Math.random()*.45}
 for(let o of objects){o.z+=move;o.g.position.z=o.z;if(o.hit)continue;let close=Math.abs(px-o.l*2.5);if(o.type==='coin'){if(Math.abs(o.z)<.9&&close<.85&&jump<1.35){o.hit=true;coins++;o.g.visible=false;burst(px,1,0,7,true)}}else{let inside=o.type==='train'?o.z>-.7&&o.z<9.6:Math.abs(o.z)<.43;if(inside&&close<(o.type==='train'?1.14:1.04)){if(o.type==='train'||o.type==='barrier'&&jump<.8||o.type==='gate'&&(slidePose<.73||jump>.08)){end(o);break}}}}
 objects=objects.filter(o=>{if(o.z>20||o.hit){scene.remove(o.g);return false}return true});$('score').textContent=String(Math.floor(distance)).padStart(4,'0');$('coins').textContent=coins;
 }
 for(let o of objects)if(o.type==='coin'){o.spin.rotation.z=time*2.2;o.spin.rotation.y=Math.sin(time*2.2)*.6;o.inner.rotation.copy(o.spin.rotation);o.g.position.y=Math.sin(time*3+o.z*.1)*.08}
 for(let p of particles){p.life-=dt;p.m.position.addScaledVector(p.v,dt);p.v.y-=dt*5;p.m.scale.setScalar(Math.max(.01,p.life/p.max));p.m.rotation.x+=dt*3}particles=particles.filter(p=>{if(p.life<=0){scene.remove(p.m);return false}return true});
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').style.opacity=0}
 animateRunner(dt);
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
function frame(now){let dt=Math.min(.033,Math.max(.001,(now-last)/1000));last=now;update(dt);let mobile=innerWidth<650;camera.position.x=lerp(camera.position.x,px*.23,1-Math.exp(-dt*4));camera.position.y=lerp(camera.position.y,(mobile?4.65:4.0)+jump*.16-land*.04,1-Math.exp(-dt*5));camera.position.z=mobile?10.4:8.5;camera.fov=lerp(camera.fov,59+(speed-21)*.2,dt*2);camera.updateProjectionMatrix();camera.lookAt(px*.14,1.30,-12);renderer.render(scene,camera);requestAnimationFrame(frame)}requestAnimationFrame(frame);
