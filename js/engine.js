// ================= Renderer / Scene =================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.010);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.xr.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);

function buildEnvTexture(){
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,128);
  grad.addColorStop(0, '#0b2a38');
  grad.addColorStop(0.45, '#123448');
  grad.addColorStop(0.55, '#1c4a5c');
  grad.addColorStop(0.75, '#08131c');
  grad.addColorStop(1, '#02050a');
  ctx.fillStyle = grad; ctx.fillRect(0,0,256,128);
  ctx.fillStyle = 'rgba(63,208,255,0.55)';
  for(let i=0;i<40;i++){ ctx.fillRect(Math.random()*256, 55+Math.random()*18, 2+Math.random()*10, 1); }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}
scene.environment = buildEnvTexture();

scene.add(new THREE.AmbientLight(0x3a5568, 0.6));
const key = new THREE.DirectionalLight(0xdff6ff, 1.55);
key.position.set(8, 12, 6); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1; key.shadow.camera.far = 40;
key.shadow.bias = -0.0015;
scene.add(key);
const rimLight = new THREE.PointLight(0x22d9ff, 1.3, 40);
rimLight.position.set(-8, 4, -6); scene.add(rimLight);
const fillLight = new THREE.PointLight(0xff9a4a, 0.5, 30);
fillLight.position.set(0, -3, 8); scene.add(fillLight);
const rimLight2 = new THREE.PointLight(0x3fd0ff, 0.6, 25);
rimLight2.position.set(6, 2, -8); scene.add(rimLight2);

const ground = new THREE.Mesh(new THREE.CircleGeometry(20,64), new THREE.MeshStandardMaterial({ color:0x050a10, roughness:0.85, metalness:0.2 }));
ground.rotation.x = -Math.PI/2; ground.position.y = -2.3; ground.receiveShadow = true;
scene.add(ground);
const floorDecorations = [ground];
[3.4, 5.2].forEach(r=>{
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r+0.02, 64), new THREE.MeshBasicMaterial({ color:0x0fd0ff, transparent:true, opacity:0.18, side:THREE.DoubleSide }));
  ring.rotation.x = -Math.PI/2; ring.position.y = -2.29; scene.add(ring); floorDecorations.push(ring);
});

// ================= Base materials (templates — cloned per part) =================
const baseMats = {
  block:   new THREE.MeshStandardMaterial({ color:0x3d434c, metalness:0.8, roughness:0.32, side:THREE.DoubleSide }),
  head:    new THREE.MeshStandardMaterial({ color:0x9aa2ae, metalness:0.9, roughness:0.22, side:THREE.DoubleSide }),
  cover:   new THREE.MeshPhysicalMaterial({ color:0x0d1013, metalness:0.5, roughness:0.35, clearcoat:0.6, clearcoatRoughness:0.25, side:THREE.DoubleSide }),
  intake:  new THREE.MeshStandardMaterial({ color:0x1c2a33, metalness:0.35, roughness:0.5 }),
  exhaust: new THREE.MeshStandardMaterial({ color:0x8a5a3f, metalness:0.92, roughness:0.42 }),
  turbo:   new THREE.MeshPhysicalMaterial({ color:0xc3c9d1, metalness:1.0, roughness:0.12, clearcoat:0.4 }),
  turboHot:new THREE.MeshStandardMaterial({ color:0x5a3a2a, metalness:0.9, roughness:0.35 }),
  pan:     new THREE.MeshStandardMaterial({ color:0x22262c, metalness:0.65, roughness:0.48, side:THREE.DoubleSide }),
  pulley:  new THREE.MeshStandardMaterial({ color:0x14171b, metalness:0.75, roughness:0.38 }),
  accent:  new THREE.MeshStandardMaterial({ color:0x0fd0ff, metalness:0.6, roughness:0.3, emissive:0x0fd0ff, emissiveIntensity:0.18 }),
  crank:   new THREE.MeshStandardMaterial({ color:0xe4e8ec, metalness:0.97, roughness:0.1 }),
  piston:  new THREE.MeshStandardMaterial({ color:0xdcd4b8, metalness:0.6, roughness:0.28 }),
  rod:     new THREE.MeshStandardMaterial({ color:0x9aa0a8, metalness:0.88, roughness:0.22 }),
  hot:     new THREE.MeshStandardMaterial({ color:0xff5a2a, metalness:0.3, roughness:0.4, emissive:0xff3300, emissiveIntensity:0.2, transparent:true, opacity:0.28 }),
};

const clippablePartTags = new Set(['block','head','cover','pan']);
const clipPlane = new THREE.Plane(new THREE.Vector3(0,0,-1), 0);

const rig = new THREE.Group();
scene.add(rig);

const parts = {};
let activeLibraryModel = 'inline-six';
function registerPart(name, group, explodeDir, color, info, matTag){
  group.userData.basePos = group.position.clone();
  group.userData.explodeDir = explodeDir.clone().normalize();
  const mats = [];
  const clippable = clippablePartTags.has(matTag);
  group.traverse(o => {
    if (o.isMesh){
      o.castShadow = true; o.receiveShadow = true;
      if (clippable) o.material.clippingPlanes = [clipPlane];
      o.userData.partName = name;
      mats.push(o.material);
    }
  });
  parts[name] = { group, color, info, mats, clippable };
  rig.add(group);
}
function matFor(tag){ return baseMats[tag].clone(); }

function addBolts(g, positions, r=0.05, len=0.12){
  positions.forEach(p=>{
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,8), matFor('pulley'));
    bolt.position.set(p[0], p[1], p[2]);
    g.add(bolt);
  });
}

// ===== Engine Block =====
{
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(7.4,1.6,1.9), matFor('block')); g.add(block);
  const oilPanTop = new THREE.Mesh(new THREE.BoxGeometry(7.0,0.6,1.7), matFor('block'));
  oilPanTop.position.y = -1.05; g.add(oilPanTop);
  const boltPositions = [];
  for(let i=0;i<7;i++){ boltPositions.push([-3.5+i*1.17, 0.82, 0.98], [-3.5+i*1.17, 0.82, -0.98]); }
  addBolts(g, boltPositions);
  registerPart('Engine Block', g, new THREE.Vector3(0,0,-1), 0x3d434c,
    { material:'Cast aluminum alloy', fn:'Houses cylinders, crankshaft & oil galleries' }, 'block');
}
// ===== Cylinder Head =====
{
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(7.2,0.55,1.75), matFor('head'));
  head.position.y = 0.95; g.add(head);
  registerPart('Cylinder Head', g, new THREE.Vector3(0,1,0), 0x9aa2ae,
    { material:'Forged aluminum', fn:'Seals cylinders, houses valves & camshafts' }, 'head');
}
// ===== Valve Cover =====
{
  const g = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(7.0,0.42,1.55), matFor('cover'));
  cover.position.y = 1.42; g.add(cover);
  const accentMat = matFor('accent');
  for (let i=0;i<6;i++){
    const bump = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.15,12), accentMat);
    bump.position.set(-3+i*1.2, 1.66, 0); g.add(bump);
  }
  registerPart('Valve Cover', g, new THREE.Vector3(0,1,0), 0x0d1013,
    { material:'Composite w/ clear-coat finish', fn:'Seals the valvetrain and retains oil mist' }, 'cover');
}
// ===== Intake Manifold =====
{
  const g = new THREE.Group();
  const im = matFor('intake');
  const plenum = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,6.6,20), im);
  plenum.rotation.z = Math.PI/2; plenum.position.set(0,1.9,-1.05); g.add(plenum);
  const throttle = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,1.0,16), im);
  throttle.rotation.x = Math.PI/2; throttle.position.set(3.3,1.9,-1.6); g.add(throttle);
  for (let i=0;i<6;i++){
    const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.9,12), im);
    runner.position.set(-3+i*1.2,1.5,-0.55); runner.rotation.x = Math.PI/5; g.add(runner);
  }
  registerPart('Intake Manifold', g, new THREE.Vector3(0,0.6,-1), 0x1c2a33,
    { material:'Polymer composite', fn:'Distributes compressed air evenly to each cylinder' }, 'intake');
}
// ===== Exhaust Headers =====
{
  const g = new THREE.Group();
  const em = matFor('exhaust');
  const curve = (x,z0,z1) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(x,0.6,z0), new THREE.Vector3(x,-0.4,z0*0.6), new THREE.Vector3(x*0.3,-1.3,z1)]);
  for (let i=0;i<6;i++){
    const x = -3+i*1.2;
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve(x,1.3,2.6),24,0.13,10,false), em));
  }
  const collector = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.5,1.4,16), em);
  collector.rotation.x = Math.PI/2; collector.position.set(0,-1.5,2.6); g.add(collector);
  registerPart('Exhaust Headers', g, new THREE.Vector3(0,-0.7,1), 0x8a5a3f,
    { material:'Cast iron / steel tubing', fn:'Channels hot exhaust gas toward the turbos' }, 'exhaust');
}
// ===== Twin Turbochargers =====
const turboSpinRefs = [];
['Turbocharger A','Turbocharger B'].forEach((name, idx) => {
  const g = new THREE.Group();
  const side = idx === 0 ? -1 : 1;
  const tm = matFor('turbo'), thm = matFor('turboHot');
  const compressor = new THREE.Mesh(new THREE.SphereGeometry(0.55,22,22), tm);
  compressor.scale.set(1,1,0.85);
  g.add(compressor);
  turboSpinRefs.push(compressor);
  const turbine = new THREE.Mesh(new THREE.ConeGeometry(0.5,0.9,22), thm);
  turbine.rotation.z = Math.PI/2; turbine.position.x = 0.75*side; g.add(turbine);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.5,12), tm);
  shaft.rotation.z = Math.PI/2; g.add(shaft);
  const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.32,0.5,14), tm);
  inlet.position.set(-0.75*side,0.15,0); inlet.rotation.z = Math.PI/2.3; g.add(inlet);
  g.position.set(3.6*side*0.62,-1.1,2.9);
  registerPart(name, g, new THREE.Vector3(side,-0.4,1), 0xc3c9d1,
    { material:'Inconel / forged steel', fn:'Uses exhaust energy to force extra air into the engine' }, 'turbo');
});
// ===== Charge Piping =====
{
  const g = new THREE.Group();
  const am = matFor('accent');
  [-1,1].forEach(side=>{
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.2*side,-1.1,2.9), new THREE.Vector3(2.6*side,-0.2,1.5), new THREE.Vector3(1.8*side,1.9,-1.6)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path,28,0.11,10,false), am));
  });
  registerPart('Charge Piping', g, new THREE.Vector3(0,0.8,0.6), 0x0fd0ff,
    { material:'Aluminum / silicone hose', fn:'Carries pressurized air from turbos to intake' }, 'accent');
}
// ===== Oil Pan =====
{
  const g = new THREE.Group();
  const pan = new THREE.Mesh(new THREE.BoxGeometry(6.6,0.7,1.5), matFor('pan'));
  pan.position.y = -1.75; g.add(pan);
  registerPart('Oil Pan', g, new THREE.Vector3(0,-1,0), 0x22262c,
    { material:'Stamped steel / aluminum', fn:'Reservoir for engine oil and lubrication sump' }, 'pan');
}
// ===== Crank Pulley =====
let crankPulleyGroup;
{
  const g = new THREE.Group();
  const pulleyGeo = new THREE.CylinderGeometry(0.55,0.55,0.35,28); pulleyGeo.rotateZ(Math.PI/2);
  const pulley = new THREE.Mesh(pulleyGeo, matFor('pulley')); pulley.position.set(-4.1,-0.4,0); g.add(pulley);
  const hubGeo = new THREE.CylinderGeometry(0.18,0.18,0.5,16); hubGeo.rotateZ(Math.PI/2);
  const hub = new THREE.Mesh(hubGeo, matFor('accent')); hub.position.set(-4.25,-0.4,0); g.add(hub);
  registerPart('Crank Pulley', g, new THREE.Vector3(-1,-0.3,0), 0x14171b,
    { material:'Forged steel', fn:'Drives the accessory belt from the crankshaft' }, 'pulley');
  crankPulleyGroup = g;
}
// ===== Alternator =====
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.7,18), matFor('pulley'));
  body.rotation.z = Math.PI/2; body.position.set(-3.4,0.6,1.35); g.add(body);
  registerPart('Alternator', g, new THREE.Vector3(-0.6,0.3,1), 0x14171b,
    { material:'Aluminum housing', fn:'Generates electrical power to charge the battery' }, 'pulley');
}

// ===== Internal structure (crank, pistons, rods — driven by simulation) =====
const internals = new THREE.Group();
const crankGroup = new THREE.Group();
const pistons = [], rods = [], liners = [];
const NCYL = 6;
{
  const crankGeo = new THREE.CylinderGeometry(0.16,0.16,7.2,16); crankGeo.rotateZ(Math.PI/2);
  crankGroup.add(new THREE.Mesh(crankGeo, matFor('crank')));
  for (let i=0;i<NCYL;i++){
    const x = -3+i*1.2;
    const webGeo = new THREE.CylinderGeometry(0.32,0.32,0.14,18); webGeo.rotateZ(Math.PI/2);
    const web = new THREE.Mesh(webGeo, matFor('crank')); web.position.x = x; crankGroup.add(web);

    const linerMat = matFor('hot');
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,1.5,24,1,true), linerMat);
    liner.position.set(x,0.15,0); internals.add(liner); liners.push(liner);

    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.35,22), matFor('piston'));
    piston.userData.baseY = 0.1; piston.userData.x = x; piston.userData.phase = i*(Math.PI/3);
    internals.add(piston); pistons.push(piston);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.9,10), matFor('rod'));
    rod.userData.x = x; rod.userData.phase = i*(Math.PI/3);
    internals.add(rod); rods.push(rod);
  }
}
internals.add(crankGroup);
internals.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
rig.add(internals);
rig.position.y = 0.3;
const defaultRigPosition = rig.position.clone();
const defaultRigQuaternion = rig.quaternion.clone();
const defaultRigScale = rig.scale.clone();

function registerLibraryPart(name, modelId, group, explodeDir, color, info, materialTag){
  group.userData.libraryModel = modelId;
  registerPart(name, group, explodeDir, color, info, materialTag);
  group.visible = false;
  return group;
}

const demoCylinderPiston = (()=>{
  const group = new THREE.Group();
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.49,0.49,0.36,32), matFor('piston'));
  group.add(piston);
  [-0.09,0.02,0.13].forEach(y=>{
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.49,0.025,8,32), matFor('pulley'));
    ring.rotation.x = Math.PI/2;
    ring.position.y = y;
    group.add(ring);
  });
  group.position.y = 0.2;
  registerLibraryPart('Demo Piston','single-cylinder',group,new THREE.Vector3(0,1,0),0xdcd4b8,
    { material:'Aluminum alloy', fn:'Moves inside the cylinder and transfers combustion force to the connecting rod' },'piston');
  return group;
})();

const demoConnectingRod = (()=>{
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.095,0.92,16), matFor('rod'));
  group.add(shaft);
  const bigEnd = new THREE.Mesh(new THREE.TorusGeometry(0.17,0.055,10,24), matFor('rod'));
  bigEnd.position.y = -0.43;
  group.add(bigEnd);
  const smallEnd = new THREE.Mesh(new THREE.TorusGeometry(0.105,0.04,10,24), matFor('rod'));
  smallEnd.position.y = 0.43;
  group.add(smallEnd);
  group.position.y = -0.51;
  registerLibraryPart('Demo Connecting Rod','single-cylinder',group,new THREE.Vector3(0,-1,0),0x9aa0a8,
    { material:'Forged steel', fn:'Connects the piston to the crankshaft and transmits its reciprocating force' },'rod');
  return group;
})();

registerLibraryPart('Demo Cylinder Block','single-cylinder',(()=>{
  const group = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.9,1.35,1.55), matFor('block'));
  block.position.y = -0.78;
  group.add(block);
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,1.55,32,1,true), matFor('head'));
  liner.position.y = 0.24;
  group.add(liner);
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.05,0.28,1.7), matFor('head'));
  head.position.y = 1.13;
  group.add(head);
  return group;
})(),new THREE.Vector3(0,0,-1),0x656f77,
  { material:'Cast aluminum with a steel cylinder liner', fn:'Supports the cylinder bore and guides the piston through its stroke' },'block');

const demoCrankshaft = (()=>{
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,1.9,24), matFor('crank'));
  shaft.rotation.z = Math.PI/2;
  group.add(shaft);
  const throwPin = new THREE.Mesh(new THREE.CylinderGeometry(0.105,0.105,0.42,20), matFor('crank'));
  throwPin.rotation.z = Math.PI/2;
  throwPin.position.set(0.22,0.23,0);
  group.add(throwPin);
  const web = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.42,0.12), matFor('crank'));
  web.position.set(0,0.1,0);
  group.add(web);
  group.position.y = -1.18;
  registerLibraryPart('Demo Crankshaft','single-cylinder',group,new THREE.Vector3(0,-1,0),0xe4e8ec,
    { material:'Forged steel', fn:'Converts the piston and connecting-rod motion into rotary output' },'crank');
  return group;
})();

function createSpurGear(radius, toothCount, material){
  const gear = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,0.25,48), material);
  disc.rotation.x = Math.PI/2;
  gear.add(disc);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius*0.22,radius*0.22,0.38,32), matFor('accent'));
  hub.rotation.x = Math.PI/2;
  gear.add(hub);
  for(let index=0;index<toothCount;index++){
    const angle = index / toothCount * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.15,0.25), material);
    tooth.position.set(Math.cos(angle)*(radius+0.045),Math.sin(angle)*(radius+0.045),0);
    tooth.rotation.z = angle;
    gear.add(tooth);
  }
  return gear;
}

const demoGearA = createSpurGear(0.73,18,matFor('turbo'));
demoGearA.position.x = -0.73;
registerLibraryPart('Drive Gear','gear-pair',demoGearA,new THREE.Vector3(-1,0,0),0xc3c9d1,
  { material:'Machined steel', fn:'Transfers rotary motion to the driven gear through meshing teeth' },'turbo');
const demoGearB = createSpurGear(0.73,18,matFor('exhaust'));
demoGearB.position.x = 0.73;
registerLibraryPart('Driven Gear','gear-pair',demoGearB,new THREE.Vector3(1,0,0),0x8a5a3f,
  { material:'Hardened alloy steel', fn:'Receives torque from the drive gear and rotates in the opposite direction' },'exhaust');

// ================= Camera (spherical orbit + focus target) =================
let isDragging=false, dragMoved=false, prevX=0, prevY=0, theta=0.7, phi=1.1, radius=15, autoRotate=true;
let camTarget = new THREE.Vector3(0,0.2,0);
let camTargetGoal = camTarget.clone();
let radiusGoal = radius;
let pinchStartDist = null;

function updateCamera(){
  camera.position.x = camTarget.x + radius*Math.sin(phi)*Math.sin(theta);
  camera.position.y = camTarget.y + radius*Math.cos(phi);
  camera.position.z = camTarget.z + radius*Math.sin(phi)*Math.cos(theta);
  camera.lookAt(camTarget);
}
updateCamera();

container.addEventListener('pointerdown', e=>{ isDragging=true; dragMoved=false; prevX=e.clientX; prevY=e.clientY; });
window.addEventListener('pointerup', e=>{
  if (isDragging && !dragMoved) handleTap(e.clientX, e.clientY);
  isDragging=false;
});
window.addEventListener('pointermove', e=>{
  if(!isDragging || renderer.xr.isPresenting) return;
  const dx = e.clientX-prevX, dy = e.clientY-prevY;
  if (Math.abs(dx)+Math.abs(dy) > 4) dragMoved = true;
  theta -= dx*0.006;
  phi = Math.min(Math.max(phi-dy*0.006,0.3),Math.PI-0.3);
  prevX=e.clientX; prevY=e.clientY;
});
container.addEventListener('wheel', e=>{ radiusGoal=Math.min(Math.max(radiusGoal+e.deltaY*0.01,3),30); }, {passive:true});

// pinch-to-zoom for touch devices
container.addEventListener('touchstart', e=>{
  if (e.touches.length===2){
    pinchStartDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
  }
}, {passive:true});
container.addEventListener('touchmove', e=>{
  if (e.touches.length===2 && pinchStartDist){
    const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    radiusGoal = Math.min(Math.max(radiusGoal - (d-pinchStartDist)*0.02, 3), 30);
    pinchStartDist = d;
  }
}, {passive:true});
container.addEventListener('touchend', ()=>{ pinchStartDist = null; });

// ================= Selection ring =================
const ringMat = new THREE.MeshBasicMaterial({ color:0x3fd0ff, transparent:true, opacity:0.85 });
const selectionRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 48), ringMat);
selectionRing.visible = false;
scene.add(selectionRing);

const arReticle = new THREE.Mesh(
  new THREE.RingGeometry(0.12, 0.16, 32),
  new THREE.MeshBasicMaterial({ color:0x76f0cc, side:THREE.DoubleSide })
);
arReticle.rotation.x = -Math.PI/2;
arReticle.matrixAutoUpdate = false;
arReticle.visible = false;
scene.add(arReticle);
let arHitTestSource = null;
let arAnimationFrameId = null;
let arSession = null;
let arPlaced = false;
let previousFog = scene.fog;
let previousClearAlpha = renderer.getClearAlpha();

async function startAR(){
  if (!navigator.xr) throw new Error('WebXR is unavailable. Open this page in a supported mobile browser over HTTPS.');
  if (!await navigator.xr.isSessionSupported('immersive-ar')) throw new Error('This browser or device does not support immersive AR.');

  renderer.xr.setReferenceSpaceType('local-floor');
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures:['hit-test','local-floor'],
    optionalFeatures:['dom-overlay'],
    domOverlay:{ root:document.body },
  });
  arSession = session;
  session.addEventListener('end', ()=>{
    arHitTestSource = null;
    arAnimationFrameId = null;
    arSession = null;
    arReticle.visible = false;
    rig.visible = true;
    rig.position.copy(defaultRigPosition);
    rig.quaternion.copy(defaultRigQuaternion);
    rig.scale.copy(defaultRigScale);
    floorDecorations.forEach(item=>item.visible = true);
    scene.fog = previousFog;
    renderer.setClearColor(0x02040a, previousClearAlpha);
    window.dispatchEvent(new CustomEvent('aura-xr-status', { detail:{ active:false } }));
    resizeEngineCanvas();
  });
  arPlaced = false;
  arReticle.visible = false;
  rig.visible = false;
  rig.scale.setScalar(0.12);
  floorDecorations.forEach(item=>item.visible = false);
  previousFog = scene.fog;
  scene.fog = null;
  previousClearAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  await renderer.xr.setSession(session);

  try {
    const viewerSpace = await session.requestReferenceSpace('viewer');
    arHitTestSource = await session.requestHitTestSource({ space:viewerSpace });
    arAnimationFrameId = session.requestAnimationFrame(updateARFrame);
  } catch(error){
    await session.end();
    throw error;
  }
  session.addEventListener('select', ()=>{
    if (!arReticle.visible) return;
    arReticle.matrix.decompose(rig.position, rig.quaternion, new THREE.Vector3());
    rig.position.y += 0.24;
    rig.visible = true;
    arPlaced = true;
  });
  window.dispatchEvent(new CustomEvent('aura-xr-status', { detail:{ active:true } }));
}

function updateARFrame(time, xrFrame){
  if (!arHitTestSource || !arSession || arPlaced) return;
  const hits = xrFrame.getHitTestResults(arHitTestSource);
  if (hits.length){
    const pose = hits[0].getPose(renderer.xr.getReferenceSpace());
    if (pose){
      arReticle.matrix.fromArray(pose.transform.matrix);
      arReticle.visible = true;
    } else {
      arReticle.visible = false;
    }
  } else {
    arReticle.visible = false;
  }
  arAnimationFrameId = arSession.requestAnimationFrame(updateARFrame);
}

// ================= Parts strip (bottom) =================
const partsStripEl = document.getElementById('parts-strip');
const showAllChip = document.createElement('div');
showAllChip.className = 'part-chip showall';
showAllChip.textContent = 'Show All';
showAllChip.addEventListener('click', resetFocus);
partsStripEl.appendChild(showAllChip);

Object.entries(parts).forEach(([name, p]) => {
  const chip = document.createElement('div');
  chip.className = 'part-chip';
  chip.dataset.name = name;
  chip.dataset.libraryModel = p.group.userData.libraryModel || 'inline-six';
  chip.hidden = chip.dataset.libraryModel !== activeLibraryModel;
  chip.innerHTML = `<div class="chip-swatch" style="background:#${p.color.toString(16).padStart(6,'0')}"></div><span>${name}</span>`;
  chip.addEventListener('click', ()=> focusPart(name));
  partsStripEl.appendChild(chip);
});

let selectedPart = null;
const infoFloat = document.getElementById('info-float');
const infoName = document.getElementById('info-name');
const infoFn = document.getElementById('info-fn');

function setMatOpacityGoal(m, goal){ m.userData = m.userData || {}; m.userData.targetOpacity = goal; }

function focusPart(name){
  const p = parts[name]; if(!p) return;
  selectedPart = name;
  document.querySelectorAll('.part-chip').forEach(c => c.classList.toggle('selected', c.dataset.name===name));
  Object.values(parts).forEach(pp => {
    const on = pp === p;
    pp.mats.forEach(m => setMatOpacityGoal(m, on ? 1 : 0.05));
  });
  const box = new THREE.Box3().setFromObject(p.group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  camTargetGoal = center;
  radiusGoal = Math.max(size.length()*1.7, 2.8);
  selectionRing.visible = true;
  selectionRing.userData.targetScale = Math.max(size.x,size.y,size.z)*0.75 + 0.3;
  showInfo(name);
}
function resetFocus(){
  selectedPart = null;
  document.querySelectorAll('.part-chip').forEach(c => c.classList.remove('selected'));
  Object.values(parts).forEach(pp => pp.mats.forEach(m => setMatOpacityGoal(m, 1)));
  camTargetGoal = new THREE.Vector3(0,0.2,0);
  radiusGoal = 15;
  selectionRing.visible = false;
  infoFloat.classList.remove('show');
}
function setLibraryModel(modelId){
  const modelGroups = {
    'inline-six':'inline-six',
    'turbo-preset':'inline-six',
    'charge-preset':'inline-six',
    'single-cylinder':'single-cylinder',
    'gear-pair':'gear-pair',
  };
  const nextModel = modelGroups[modelId];
  if (!nextModel) return false;
  activeLibraryModel = nextModel;
  setSimulation(false);
  setExplode(false);
  setCross(false);
  resetFocus();
  Object.values(parts).forEach(part=>{
    part.group.visible = (part.group.userData.libraryModel || 'inline-six') === activeLibraryModel;
  });
  internals.visible = activeLibraryModel === 'inline-six';
  document.querySelectorAll('.part-chip:not(.showall)').forEach(chip=>{
    chip.hidden = chip.dataset.libraryModel !== activeLibraryModel;
  });
  radiusGoal = activeLibraryModel === 'inline-six' ? 15 : (activeLibraryModel === 'gear-pair' ? 7.2 : 7.8);
  camTargetGoal.set(0,0.1,0);
  return true;
}
function showInfo(name){
  const p = parts[name]; if(!p) return;
  infoName.textContent = name; infoFn.textContent = p.info.fn;
  infoFloat.classList.add('show');
}

// tap directly on the model to isolate that part; tap empty space to reset
const raycaster = new THREE.Raycaster();
function handleTap(clientX, clientY){
  const ndc = new THREE.Vector2((clientX/window.innerWidth)*2-1, -(clientY/window.innerHeight)*2+1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(rig.children, true);
  if (hits.length && hits[0].object.userData && hits[0].object.userData.partName){
    focusPart(hits[0].object.userData.partName);
  } else if (hits.length === 0){
    resetFocus();
  }
}

// ================= Feature drawer toggle =================
const drawer = document.getElementById('feature-drawer');
const backdrop = document.getElementById('drawer-backdrop');
const drawerToggle = document.getElementById('drawer-toggle');
function setDrawer(open){
  drawer.classList.toggle('open', open);
  backdrop.classList.toggle('show', open && window.innerWidth < 900);
}
drawerToggle.addEventListener('click', ()=> setDrawer(!drawer.classList.contains('open')));
document.getElementById('feature-drawer-close').addEventListener('click', ()=>setDrawer(false));
backdrop.addEventListener('click', ()=> setDrawer(false));
setDrawer(false);

// ================= Exploded / Cross-section / Simulation toggles =================
let exploded=false, crossSection=false, simulationRunning=false;
const explodeAmount = { v:0 };

function setExplode(on){ exploded=on; document.getElementById('btn-explode').classList.toggle('active', on); }
function setCross(on){
  crossSection=on; document.getElementById('btn-cross').classList.toggle('active', on);
  Object.values(parts).forEach(p=>{ if(p.clippable) p.mats.forEach(m=> m.clippingPlanes = on ? [clipPlane] : []); });
}
function setSimulation(on){
  simulationRunning = on;
  const btn = document.getElementById('btn-sim');
  btn.classList.toggle('active', on);
  btn.textContent = on ? 'Stop Engine' : 'Start Engine';
}
document.getElementById('btn-explode').addEventListener('click', ()=> setExplode(!exploded));
document.getElementById('btn-cross').addEventListener('click', ()=> setCross(!crossSection));
document.getElementById('btn-sim').addEventListener('click', ()=> setSimulation(!simulationRunning));
// ================= Animation loop =================
let flowT = 0, simAngle = 0;
function animate(){
  explodeAmount.v += ((exploded?1:0) - explodeAmount.v) * 0.08;
  Object.values(parts).forEach(p=>{
    const g = p.group;
    const off = g.userData.explodeDir.clone().multiplyScalar(explodeAmount.v*2.4);
    g.position.copy(g.userData.basePos).add(off);
    p.mats.forEach(m=>{
      const goal = (m.userData && m.userData.targetOpacity!==undefined) ? m.userData.targetOpacity : 1;
      m.opacity += (goal - m.opacity) * 0.12;
      // only pay the transparency-sorting cost while actually fading — keeps opaque parts crisp
      const fading = goal < 0.995 || m.opacity < 0.995;
      m.transparent = fading;
      m.depthWrite = !fading;
    });
  });

  if (!renderer.xr.isPresenting){
    camTarget.lerp(camTargetGoal, 0.08);
    radius += (radiusGoal - radius) * 0.08;
    if (autoRotate && !isDragging && !selectedPart) theta += 0.0022;
    updateCamera();
  }

  if (selectionRing.visible){
    selectionRing.position.copy(camTargetGoal);
    selectionRing.lookAt(camera.position);
    const s = selectionRing.userData.targetScale || 1;
    selectionRing.scale.setScalar(s + Math.sin(flowT*2)*0.03);
  }

  const turboSpeed = simulationRunning ? 0.55 : 0.06;
  turboSpinRefs.forEach(m => m.rotation.x += turboSpeed);

  if (simulationRunning){ simAngle += 0.09; }
  crankGroup.rotation.x = simAngle;
  crankPulleyGroup.children.forEach(c => c.rotation.x = simAngle);
  pistons.forEach(piston=>{
    const stroke = Math.cos(simAngle + piston.userData.phase);
    piston.position.set(piston.userData.x, piston.userData.baseY + stroke*0.42, 0);
  });
  rods.forEach(rod=>{
    const stroke = Math.cos(simAngle + rod.userData.phase);
    rod.position.set(rod.userData.x, -0.25 + stroke*0.21, 0);
    rod.rotation.z = Math.sin(simAngle + rod.userData.phase) * 0.22;
  });
  if (activeLibraryModel === 'single-cylinder' && simulationRunning){
    demoCylinderPiston.position.y = demoCylinderPiston.userData.basePos.y + Math.cos(simAngle)*0.34;
    demoConnectingRod.position.y = -0.51 + Math.cos(simAngle)*0.17;
    demoConnectingRod.rotation.z = Math.sin(simAngle)*0.18;
    demoCrankshaft.rotation.x = simAngle;
  } else if (activeLibraryModel === 'gear-pair' && simulationRunning){
    demoGearA.rotation.z += 0.035;
    demoGearB.rotation.z -= 0.035;
  }
  liners.forEach((liner,i)=>{
    const nearTop = Math.max(0, Math.cos(simAngle + pistons[i].userData.phase));
    liner.material.emissiveIntensity = simulationRunning ? 0.2 + Math.pow(nearTop,6)*1.4 : 0.15;
  });

  flowT += 0.06;
  document.querySelectorAll('#wave span').forEach((b,i)=>{
    const active = listening || simulationRunning;
    const h = 4 + Math.abs(Math.sin(flowT + i*0.4)) * (active ? 24 : 8);
    b.style.height = h+'px';
  });
  const accentPulse = simulationRunning ? Math.abs(Math.sin(flowT*2))*0.7 : 0;
  parts['Charge Piping'].mats.forEach(m => m.emissiveIntensity = 0.18 + accentPulse);

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', ()=>{
  resizeEngineCanvas();
});

function resizeEngineCanvas(){
  const bounds = container.getBoundingClientRect();
  const width = Math.max(1, bounds.width || window.innerWidth);
  const height = Math.max(1, bounds.height || window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.AuraEngine = {
  focusPart,
  resetFocus,
  setDrawer,
  setSimulation,
  setExplode,
  setCross,
  resize:resizeEngineCanvas,
  startAR,
  setLibraryModel,
  endAR:()=>arSession ? arSession.end() : Promise.resolve(),
  isARPresenting:()=>renderer.xr.isPresenting,
  getModelSummary:()=>activeLibraryModel === 'single-cylinder'
    ? { name:'Single-Cylinder Piston', cylinders:1, turbochargers:0, description:'A piston, connecting rod, cylinder block, and crankshaft.' }
    : activeLibraryModel === 'gear-pair'
      ? { name:'Intermeshing Gear Pair', cylinders:0, turbochargers:0, description:'Two spur gears that mesh and counter-rotate to transfer motion.' }
      : { name:'Twin Turbo Inline-6', cylinders:NCYL, turbochargers:2, description:'A six-cylinder engine with twin turbochargers, an intake and exhaust path, charge piping, and a reciprocating crank-and-piston assembly.' },
  getParts:()=>Object.entries(parts).filter(([,part])=>(part.group.userData.libraryModel || 'inline-six') === activeLibraryModel).map(([name,part])=>({ name, material:part.info.material, function:part.info.fn })),
  getSelectedPart:()=>selectedPart,
  getPartInfo:name=>{
    const part = parts[name];
    return part && (part.group.userData.libraryModel || 'inline-six') === activeLibraryModel
      ? { name, material:part.info.material, function:part.info.fn }
      : null;
  },
};
