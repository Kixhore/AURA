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
const customVehicleModels = new Map();
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
function registerVehicleModel(modelId, buildModel){
  if (customVehicleModels.has(modelId)) return false;
  const driver = buildModel({
    THREE,
    registerPart:(name,group,explodeDir,color,info,materialTag)=>registerLibraryPart(name,modelId,group,explodeDir,color,info,materialTag),
    material:matFor,
  });
  customVehicleModels.set(modelId,driver || {});
  return true;
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

function makeMechanismBar(color, radius=0.09){
  return new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1,16), matFor(color));
}
function positionBarBetween(mesh, start, end){
  const direction = new THREE.Vector3(end.x-start.x,end.y-start.y,0);
  const length = direction.length();
  mesh.position.set((start.x+end.x)/2,(start.y+end.y)/2,0.08);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  mesh.scale.set(1,length,1);
}

const fourBarA = { x:-1.55, y:0 };
const fourBarD = { x:1.55, y:0 };
const fourBarCrankLength = 0.78;
const fourBarCouplerLength = 2.65;
const fourBarRockerLength = 2.05;
const fourBarFrame = (()=>{
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.55,0.16,0.3),matFor('block'));
  base.position.y = -0.25;
  group.add(base);
  [fourBarA,fourBarD].forEach(pivot=>{
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.3,0.3),matFor('head'));
    support.position.set(pivot.x,-0.08,0);
    group.add(support);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.16,16,16),matFor('accent'));
    pin.position.set(pivot.x,pivot.y,0.1);
    group.add(pin);
  });
  registerLibraryPart('Linkage Frame','four-bar-linkage',group,new THREE.Vector3(0,-1,0),0x555f67,
    { material:'Aluminum alloy frame with steel pivot pins', fn:'Holds the fixed pivots that constrain the linkage motion' },'block');
  return group;
})();
const fourBarInput = (()=>{
  const group = new THREE.Group();
  const beam = makeMechanismBar('accent',0.105);
  group.add(beam);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.13,16,16),matFor('crank'));
  group.add(pin);
  registerLibraryPart('Input Crank','four-bar-linkage',group,new THREE.Vector3(0,1,0),0x0fd0ff,
    { material:'Steel crank arm', fn:'Provides rotary input at the fixed frame pivot' },'accent');
  return { group, beam, pin };
})();
const fourBarCoupler = (()=>{
  const group = new THREE.Group();
  const beam = makeMechanismBar('turbo',0.12);
  group.add(beam);
  const pinA = new THREE.Mesh(new THREE.SphereGeometry(0.13,16,16),matFor('crank'));
  const pinB = pinA.clone();
  group.add(pinA,pinB);
  registerLibraryPart('Coupler Link','four-bar-linkage',group,new THREE.Vector3(0,1,0),0xc3c9d1,
    { material:'Machined steel link', fn:'Transfers motion between the input crank and output rocker' },'turbo');
  return { group, beam, pinA, pinB };
})();
const fourBarRocker = (()=>{
  const group = new THREE.Group();
  const beam = makeMechanismBar('exhaust',0.13);
  group.add(beam);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.14,16,16),matFor('crank'));
  group.add(pin);
  registerLibraryPart('Output Rocker','four-bar-linkage',group,new THREE.Vector3(0,-1,0),0x8a5a3f,
    { material:'Hardened steel rocker arm', fn:'Oscillates around the fixed output pivot as the crank turns' },'exhaust');
  return { group, beam, pin };
})();
function updateFourBar(angle){
  const pointB = {
    x:fourBarA.x + Math.cos(angle)*fourBarCrankLength,
    y:fourBarA.y + Math.sin(angle)*fourBarCrankLength,
  };
  const dx = fourBarD.x-pointB.x;
  const dy = fourBarD.y-pointB.y;
  const distance = Math.hypot(dx,dy);
  const along = (fourBarCouplerLength*fourBarCouplerLength - fourBarRockerLength*fourBarRockerLength + distance*distance)/(2*distance);
  const height = Math.sqrt(Math.max(0,fourBarCouplerLength*fourBarCouplerLength-along*along));
  const unitX = dx/distance;
  const unitY = dy/distance;
  const pointC = {
    x:pointB.x + along*unitX - height*unitY,
    y:pointB.y + along*unitY + height*unitX,
  };
  positionBarBetween(fourBarInput.beam,fourBarA,pointB);
  fourBarInput.pin.position.set(pointB.x,pointB.y,0.08);
  positionBarBetween(fourBarCoupler.beam,pointB,pointC);
  fourBarCoupler.pinA.position.set(pointB.x,pointB.y,0.08);
  fourBarCoupler.pinB.position.set(pointC.x,pointC.y,0.08);
  positionBarBetween(fourBarRocker.beam,fourBarD,pointC);
  fourBarRocker.pin.position.set(pointC.x,pointC.y,0.08);
}
updateFourBar(0);

const planetaryOrbitRadius = 0.86;
const planetaryPhase = { value:0 };
const planetaryRing = (()=>{
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42,0.12,16,72),matFor('head'));
  group.add(ring);
  for(let index=0;index<36;index++){
    const angle = index/36*Math.PI*2;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.17,0.12,0.24),matFor('head'));
    tooth.position.set(Math.cos(angle)*1.31,Math.sin(angle)*1.31,0);
    tooth.rotation.z = angle;
    group.add(tooth);
  }
  registerLibraryPart('Internal Ring Gear','planetary-gears',group,new THREE.Vector3(0,1,0),0x9aa2ae,
    { material:'Hardened steel internal ring', fn:'Provides the fixed internal teeth that mesh with the orbiting planet gears' },'head');
  return group;
})();
const planetarySun = createSpurGear(0.47,18,matFor('accent'));
registerLibraryPart('Sun Gear','planetary-gears',planetarySun,new THREE.Vector3(0,1,0),0x0fd0ff,
  { material:'Case-hardened steel', fn:'Central input gear that meshes with all three planet gears' },'accent');
const planetaryCarrier = (()=>{
  const group = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.2,24),matFor('crank'));
  hub.rotation.x = Math.PI/2;
  group.add(hub);
  const arms = [];
  for(let index=0;index<3;index++){
    const angle = index/3*Math.PI*2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(planetaryOrbitRadius,0.11,0.16),matFor('crank'));
    arm.position.set(Math.cos(angle)*planetaryOrbitRadius/2,Math.sin(angle)*planetaryOrbitRadius/2,0.02);
    arm.rotation.z = angle;
    group.add(arm);
    arms.push(arm);
  }
  registerLibraryPart('Planet Carrier','planetary-gears',group,new THREE.Vector3(1,0,0),0xe4e8ec,
    { material:'Forged steel carrier plate', fn:'Supports the planet gear axles as they orbit the sun gear' },'crank');
  return group;
})();
const planetaryGears = Array.from({length:3},(_,index)=>{
  const gear = createSpurGear(0.36,12,matFor(index===1?'exhaust':'turbo'));
  const name = 'Planet Gear ' + (index+1);
  registerLibraryPart(name,'planetary-gears',gear,new THREE.Vector3(Math.cos(index/3*Math.PI*2),Math.sin(index/3*Math.PI*2),0),
    index===1?0x8a5a3f:0xc3c9d1,
    { material:'Hardened steel planet gear', fn:'Meshes with the sun and ring gears while orbiting on the carrier' },index===1?'exhaust':'turbo');
  return gear;
});

function makeBar3D(start,end,radius,material){
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1,14),material);
  const startVector = new THREE.Vector3(start.x,start.y,start.z);
  const endVector = new THREE.Vector3(end.x,end.y,end.z);
  const direction = endVector.clone().sub(startVector);
  mesh.position.copy(startVector.add(endVector).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
  mesh.scale.y = direction.length();
  return mesh;
}

const v8CylinderPositions = [-2.25,-0.75,0.75,2.25];
const v8BankAngle = Math.PI/4;
const v8Pistons = [];
const v8ConnectingRods = [];
const v8SparkPlugs = [];
const v8Crankshaft = new THREE.Group();
const v8FiringOrder = [1,8,4,3,6,5,7,2];
function getV8CylinderPhase(cylinderNumber){
  return -v8FiringOrder.indexOf(cylinderNumber)*Math.PI/2;
}

registerLibraryPart('V8 Engine Block','v8-engine',(()=>{
  const group = new THREE.Group();
  const crankcase = new THREE.Mesh(new THREE.BoxGeometry(5.9,1.25,1.8),matFor('block'));
  crankcase.position.y = -0.62;
  group.add(crankcase);
  for(let bankIndex=0;bankIndex<2;bankIndex++){
    const side = bankIndex===0?-1:1;
    const bank = new THREE.Group();
    bank.rotation.x = side*v8BankAngle;
    bank.position.z = side*0.52;
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(5.65,0.48,1.15),matFor('block'));
    skirt.position.y = 0.14;
    bank.add(skirt);
    v8CylinderPositions.forEach(x=>{
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.39,0.39,1.45,24,1,true),matFor('head'));
      sleeve.position.set(x,0.43,0);
      bank.add(sleeve);
      const lowerRib = new THREE.Mesh(new THREE.TorusGeometry(0.4,0.035,8,24),matFor('pulley'));
      lowerRib.rotation.x = Math.PI/2;
      lowerRib.position.set(x,-0.13,0);
      bank.add(lowerRib);
    });
    group.add(bank);
  }
  return group;
})(),new THREE.Vector3(0,-1,0),0x4a5159,
  { material:'Cast aluminum block with eight steel cylinder liners', fn:'Supports both cylinder banks, main bearings, and the crankshaft' },'block');

const v8Heads = [];
const v8ValveCovers = [];
for(let bankIndex=0;bankIndex<2;bankIndex++){
  const side = bankIndex===0?-1:1;
  const bankName = side<0?'Left':'Right';
  const bankRotation = side*v8BankAngle;
  const head = new THREE.Group();
  head.rotation.x = bankRotation;
  head.position.z = side*0.52;
  const headCasting = new THREE.Mesh(new THREE.BoxGeometry(5.8,0.4,1.32),matFor('head'));
  headCasting.position.y = 1.12;
  head.add(headCasting);
  const camshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,5.5,20),matFor('crank'));
  camshaft.rotation.z = Math.PI/2;
  camshaft.position.y = 1.27;
  head.add(camshaft);
  v8CylinderPositions.forEach(x=>{
    [-1,1].forEach(offset=>{
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.24,12),matFor('accent'));
      valve.position.set(x,1.34,offset*0.25);
      head.add(valve);
    });
  });
  registerLibraryPart(bankName+' Cylinder Head','v8-engine',head,new THREE.Vector3(0,1,side),0x9aa2ae,
    { material:'Cast aluminum alloy with twin overhead camshafts', fn:'Carries the intake and exhaust valves for one four-cylinder bank' },'head');
  v8Heads.push(head);

  const cover = new THREE.Group();
  cover.rotation.x = bankRotation;
  cover.position.z = side*0.52;
  const coverBody = new THREE.Mesh(new THREE.BoxGeometry(5.9,0.2,0.85),matFor('cover'));
  coverBody.position.y = 1.48;
  cover.add(coverBody);
  v8CylinderPositions.forEach(x=>{
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.06,10),matFor('accent'));
    bolt.position.set(x,1.61,0);
    cover.add(bolt);
  });
  registerLibraryPart(bankName+' Valve Cover','v8-engine',cover,new THREE.Vector3(0,1,side),0x0d1013,
    { material:'Coated aluminum cover', fn:'Seals and protects the overhead camshaft and valve train' },'cover');
  v8ValveCovers.push(cover);
}

registerLibraryPart('V8 Intake Manifold','v8-engine',(()=>{
  const group = new THREE.Group();
  const plenum = new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,4.9,24),matFor('intake'));
  plenum.rotation.z = Math.PI/2;
  plenum.position.set(0,1.44,0);
  group.add(plenum);
  const throttle = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.32,0.58,20),matFor('accent'));
  throttle.position.set(0,1.87,0);
  group.add(throttle);
  for(let bankIndex=0;bankIndex<2;bankIndex++){
    const side = bankIndex===0?-1:1;
    v8CylinderPositions.forEach(x=>{
      const runner = makeBar3D({x,y:1.38,z:side*0.08},{x:x*0.92,y:1.75,z:side*0.84},0.105,matFor('intake'));
      group.add(runner);
      const clamp = new THREE.Mesh(new THREE.SphereGeometry(0.13,12,12),matFor('accent'));
      clamp.position.set(x,1.72,side*0.78);
      group.add(clamp);
    });
  }
  return group;
})(),new THREE.Vector3(0,1,0),0x1c2a33,
  { material:'Cast aluminum intake plenum with eight runners', fn:'Splits incoming air evenly between the eight cylinders' },'intake');

for(let bankIndex=0;bankIndex<2;bankIndex++){
  const side = bankIndex===0?-1:1;
  const bankName = side<0?'Left':'Right';
  registerLibraryPart(bankName+' Exhaust Headers','v8-engine',(()=>{
    const group = new THREE.Group();
    v8CylinderPositions.forEach(x=>{
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x,-0.05,side*0.9),
        new THREE.Vector3(x,-0.55,side*1.3),
        new THREE.Vector3(x*0.78,-1.0,side*1.65),
        new THREE.Vector3(x*0.55,-1.26,side*1.75),
      ]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,0.095,10,false),matFor('exhaust')));
    });
    const collector = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,2.1,18),matFor('exhaust'));
    collector.rotation.z = Math.PI/2;
    collector.position.set(0,-1.25,side*1.75);
    group.add(collector);
    return group;
  })(),new THREE.Vector3(0,-0.6,side),0x8a5a3f,
    { material:'Cast iron headers and stainless collectors', fn:'Collects exhaust pulses from four cylinders on this bank' },'exhaust');
}

registerLibraryPart('V8 Crankshaft','v8-engine',v8Crankshaft,new THREE.Vector3(0,-1,0),0xe4e8ec,
  { material:'Cross-plane forged steel', fn:'Combines the eight cylinder power strokes into rotary output' },'crank');
{
  const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,5.8,24),matFor('crank'));
  mainShaft.rotation.z = Math.PI/2;
  mainShaft.position.y = -1.1;
  v8Crankshaft.add(mainShaft);
  v8CylinderPositions.forEach((x,index)=>{
    const web = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.7,0.4),matFor('crank'));
    web.position.set(x,-1.05,index%2===0?0.16:-0.16);
    v8Crankshaft.add(web);
    const journal = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.68,18),matFor('turbo'));
    journal.rotation.z = Math.PI/2;
    journal.position.set(x,-0.79,index%2===0?0.16:-0.16);
    v8Crankshaft.add(journal);
  });
}

for(let bankIndex=0;bankIndex<2;bankIndex++){
  const side = bankIndex===0?-1:1;
  const bankName = side<0?'L':'R';
  v8CylinderPositions.forEach((x,cylinderIndex)=>{
    const cylinderNumber = bankIndex*4+cylinderIndex+1;
    const phase = getV8CylinderPhase(cylinderNumber);
    const pistonAssembly = new THREE.Group();
    pistonAssembly.rotation.x = side*v8BankAngle;
    pistonAssembly.position.set(x,0,side*0.52);
    const piston = new THREE.Group();
    piston.position.y = 0.43;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.36,0.34,24),matFor('piston'));
    piston.add(body);
    [-0.13,0,0.13].forEach(y=>{
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36,0.022,8,24),matFor('pulley'));
      ring.rotation.x = Math.PI/2;
      ring.position.y = y;
      piston.add(ring);
    });
    pistonAssembly.add(piston);
    registerLibraryPart('V8 Piston '+bankName+cylinderNumber,'v8-engine',pistonAssembly,new THREE.Vector3(0,1,0),0xdcd4b8,
      { material:'Aluminum alloy piston with steel compression rings', fn:'Cylinder '+cylinderNumber+' piston; reciprocates in its bank bore and transfers combustion pressure to its connecting rod' },'piston');
    v8Pistons.push({ slider:piston, baseY:piston.position.y, phase });

    const rodAssembly = new THREE.Group();
    rodAssembly.rotation.x = side*v8BankAngle;
    rodAssembly.position.set(x,-0.22,side*0.52);
    const rod = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.1,1.05,14),matFor('rod'));
    rod.add(shaft);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.15,0.045,8,20),matFor('crank'));
    cap.position.y = -0.48;
    rod.add(cap);
    rodAssembly.add(rod);
    registerLibraryPart('V8 Rod '+bankName+cylinderNumber,'v8-engine',rodAssembly,new THREE.Vector3(0,-1,0),0x9aa0a8,
      { material:'Forged connecting-rod steel', fn:'Cylinder '+cylinderNumber+' connecting rod; transmits piston stroke to its cross-plane crankshaft journal' },'rod');
    v8ConnectingRods.push({ link:rod, phase });
  });
}

registerLibraryPart('V8 Oil Pan','v8-engine',(()=>{
  const group = new THREE.Group();
  const sump = new THREE.Mesh(new THREE.BoxGeometry(5.35,0.62,1.72),matFor('pan'));
  sump.position.y = -1.75;
  group.add(sump);
  const flange = new THREE.Mesh(new THREE.BoxGeometry(5.75,0.12,1.95),matFor('pulley'));
  flange.position.y = -1.39;
  group.add(flange);
  return group;
})(),new THREE.Vector3(0,-1,0),0x22262c,
  { material:'Stamped aluminum sump with a steel mounting flange', fn:'Stores and returns engine oil to the lubrication system' },'pan');

for(let bankIndex=0;bankIndex<2;bankIndex++){
  const side = bankIndex===0?-1:1;
  const bankName = side<0?'L':'R';
  v8CylinderPositions.forEach((x,cylinderIndex)=>{
    const cylinderNumber = bankIndex*4+cylinderIndex+1;
    const plug = new THREE.Group();
    plug.rotation.x = side*v8BankAngle;
    plug.position.set(x,0,side*0.52);
    const ceramic = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.085,0.38,12),matFor('head'));
    ceramic.position.y = 1.35;
    plug.add(ceramic);
    const electrodeMaterial = matFor('accent');
    electrodeMaterial.emissive.setHex(0xff8a35);
    electrodeMaterial.emissiveIntensity = 0.03;
    const electrode = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.15,10),electrodeMaterial);
    electrode.position.y = 1.61;
    plug.add(electrode);
    registerLibraryPart('V8 Spark Plug '+bankName+cylinderNumber,'v8-engine',plug,new THREE.Vector3(0,1,0),0xff8a35,
      { material:'Copper-core electrode with ceramic insulator', fn:'Cylinder '+cylinderNumber+' spark plug; ignites the compressed air-fuel charge in the V8 firing sequence' },'accent');
    v8SparkPlugs.push({ cylinder:cylinderNumber, material:electrodeMaterial });
  });
}

// ===== KTM Duke 349.32 cc single-cylinder DOHC demo =====
const dukeCrankRadius = 0.31;
const dukeRodLength = 1.28;
const dukeCrankCenterY = -0.92;
const dukeCycle = { angle:0 };
let dukeRpm = 1200;
const dukeSlowMotion = 0.05;
const dukeCamshafts = [];
const dukeValves = [];
const dukeCoolantCurves = [];
const dukeCoolantMarkers = [];
let dukeSparkMaterial = null;

registerLibraryPart('Duke Crankcase','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const upperCase = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.9,1.9),matFor('block'));
  upperCase.position.y = -0.78;
  group.add(upperCase);
  const clutchBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.68,0.45,32),matFor('cover'));
  clutchBoss.rotation.x = Math.PI/2;
  clutchBoss.position.set(-1.18,-0.72,0.04);
  group.add(clutchBoss);
  const inspectionCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.49,24),matFor('accent'));
  inspectionCap.rotation.x = Math.PI/2;
  inspectionCap.position.set(0.85,-0.65,0.08);
  group.add(inspectionCap);
  return group;
})(),new THREE.Vector3(0,-1,0),0x444b53,
  { material:'Cast aluminum alloy crankcase', fn:'Supports the crankshaft, clutch, gearbox, and lower cylinder assembly' },'block');

registerLibraryPart('Duke Cylinder Barrel','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.69,0.76,1.9,40,1,true),matFor('head'));
  barrel.position.y = 0.12;
  group.add(barrel);
  const lowerDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.78,0.78,0.16,40),matFor('block'));
  lowerDeck.position.y = -0.82;
  group.add(lowerDeck);
  const upperDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.78,0.78,0.14,40),matFor('block'));
  upperDeck.position.y = 1.06;
  group.add(upperDeck);
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,1.88,36,1,true),matFor('crank'));
  liner.position.y = 0.11;
  group.add(liner);
  return group;
})(),new THREE.Vector3(0,1,0),0x929ba5,
  { material:'Aluminum cylinder barrel with a hard-coated steel liner', fn:'Provides the precision bore in which the 349.32 cc piston reciprocates' },'head');

registerLibraryPart('Duke Coolant Jacket','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const waterJacket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.73,0.73,1.72,36,1,true),
    new THREE.MeshPhysicalMaterial({color:0x2f9eac,metalness:0.2,roughness:0.25,transparent:true,opacity:0.27,side:THREE.DoubleSide,emissive:0x06343b,emissiveIntensity:0.55})
  );
  waterJacket.position.y = 0.12;
  group.add(waterJacket);
  for(let index=0;index<12;index++){
    const angle = index/12*Math.PI*2;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.74,0.025,8,40),matFor('accent'));
    rib.rotation.x = Math.PI/2;
    rib.position.y = -0.56+index*0.12;
    group.add(rib);
  }
  return group;
})(),new THREE.Vector3(0,1,0),0x32c6d0,
  { material:'Water-glycol coolant surrounding the cylinder liner', fn:'Carries combustion heat from the cylinder barrel to the radiator' },'accent');

registerLibraryPart('Duke DOHC Cylinder Head','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const casting = new THREE.Mesh(new THREE.BoxGeometry(2.05,0.62,2.05),matFor('head'));
  casting.position.y = 1.42;
  group.add(casting);
  const gasket = new THREE.Mesh(new THREE.BoxGeometry(1.72,0.08,1.72),matFor('pulley'));
  gasket.position.y = 1.08;
  group.add(gasket);
  const combustionDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.1,36),matFor('cover'));
  combustionDeck.position.y = 1.08;
  group.add(combustionDeck);
  return group;
})(),new THREE.Vector3(0,1,0),0x9aa2ae,
  { material:'Cast aluminum four-valve cylinder head', fn:'Seals the combustion chamber and houses the dual overhead camshafts and four valves' },'head');

registerLibraryPart('Duke Valve Cover','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(1.75,0.34,1.76),matFor('cover'));
  cover.position.y = 1.94;
  group.add(cover);
  const centerRib = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.08,0.12),matFor('accent'));
  centerRib.position.set(0,2.16,0);
  group.add(centerRib);
  for(let index=0;index<4;index++){
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.08,10),matFor('pulley'));
    bolt.position.set(index%2===0?-0.68:0.68,2.13,index<2?-0.66:0.66);
    group.add(bolt);
  }
  return group;
})(),new THREE.Vector3(0,1,0),0x15191d,
  { material:'Powder-coated aluminum cam cover', fn:'Seals and protects both overhead camshafts and the valve train' },'cover');

registerLibraryPart('Duke DOHC Camshafts','duke-349-engine',(()=>{
  const group = new THREE.Group();
  [-0.48,0.48].forEach((z,camIndex)=>{
    const cam = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,1.66,20),matFor('crank'));
    shaft.rotation.z = Math.PI/2;
    cam.add(shaft);
    for(let lobeIndex=0;lobeIndex<4;lobeIndex++){
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.16,16,12),matFor(camIndex===0?'accent':'exhaust'));
      lobe.scale.set(0.58,1.35,0.75);
      lobe.position.set(-0.58+lobeIndex*0.38,0,0);
      cam.add(lobe);
    }
    cam.position.set(0,1.82,z);
    group.add(cam);
    dukeCamshafts.push(cam);
  });
  return group;
})(),new THREE.Vector3(0,1,0),0xc3c9d1,
  { material:'Hardened steel dual overhead camshafts', fn:'Operate the intake and exhaust valves at half crankshaft speed' },'crank');

registerLibraryPart('Duke Four-Valve Train','duke-349-engine',(()=>{
  const group = new THREE.Group();
  [[-0.36,-0.42],[-0.36,0.42],[0.36,-0.42],[0.36,0.42]].forEach(([x,z],index)=>{
    const valve = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.52,12),matFor('crank'));
    stem.position.y = 0.12;
    valve.add(stem);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.115,0.07,20),matFor(index<2?'accent':'exhaust'));
    head.position.y = -0.17;
    valve.add(head);
    const spring = new THREE.Mesh(new THREE.TorusGeometry(0.08,0.018,8,20),matFor('pulley'));
    spring.rotation.x = Math.PI/2;
    spring.position.y = 0.29;
    valve.add(spring);
    valve.position.set(x,1.18,z);
    group.add(valve);
    dukeValves.push({ group:valve, baseY:valve.position.y, phase:index*Math.PI/2, intake:index<2 });
  });
  return group;
})(),new THREE.Vector3(0,1,0),0x9aa2ae,
  { material:'Steel poppet valves with return springs', fn:'Two intake and two exhaust valves control gas exchange in the combustion chamber' },'head');

const dukePiston = (()=>{
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.49,0.51,0.38,32),matFor('piston'));
  group.add(body);
  [-0.13,0,0.13].forEach(y=>{
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.51,0.025,8,32),matFor('pulley'));
    ring.rotation.x = Math.PI/2;
    ring.position.y = y;
    group.add(ring);
  });
  group.position.y = 0.42;
  registerLibraryPart('Duke 89 mm Piston','duke-349-engine',group,new THREE.Vector3(0,1,0),0xdcd4b8,
    { material:'Forged aluminum alloy with three piston rings', fn:'The 89 mm piston compresses the charge and transfers combustion force to the connecting rod' },'piston');
  return group;
})();

const dukeCrankshaft = (()=>{
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,1.85,24),matFor('crank'));
  shaft.rotation.x = Math.PI/2;
  group.add(shaft);
  const webA = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.62,0.16),matFor('crank'));
  webA.position.set(0,-0.04,0.16);
  group.add(webA);
  const webB = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.62,0.16),matFor('crank'));
  webB.position.set(0,-0.04,-0.16);
  group.add(webB);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.52,20),matFor('turbo'));
  pin.rotation.x = Math.PI/2;
  pin.position.y = dukeCrankRadius;
  group.add(pin);
  group.position.y = dukeCrankCenterY;
  registerLibraryPart('Duke Crankshaft','duke-349-engine',group,new THREE.Vector3(0,-1,0),0xe4e8ec,
    { material:'Forged steel crankshaft with offset crankpin', fn:'Converts the single piston’s reciprocating motion into rotary power' },'crank');
  return group;
})();

const dukeConnectingRod = makeBar3D({x:0,y:-0.2,z:0.08},{x:0,y:0.6,z:0.08},0.085,matFor('rod'));
const dukeConnectingRodGroup = new THREE.Group();
dukeConnectingRodGroup.add(dukeConnectingRod);
const dukeSmallEnd = new THREE.Mesh(new THREE.TorusGeometry(0.13,0.035,8,24),matFor('crank'));
const dukeBigEnd = new THREE.Mesh(new THREE.TorusGeometry(0.19,0.045,8,24),matFor('crank'));
dukeConnectingRodGroup.add(dukeSmallEnd,dukeBigEnd);
registerLibraryPart('Duke Connecting Rod','duke-349-engine',dukeConnectingRodGroup,new THREE.Vector3(0,-1,0),0x9aa0a8,
  { material:'Forged steel connecting rod', fn:'Links the piston wrist pin to the crankshaft crankpin' },'rod');

registerLibraryPart('Duke Clutch and Gearbox','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const clutch = new THREE.Group();
  for(let index=0;index<7;index++){
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42-index*0.018,0.42-index*0.018,0.055,32),matFor(index%2===0?'crank':'pulley'));
    plate.rotation.x = Math.PI/2;
    plate.position.z = index*0.075;
    clutch.add(plate);
  }
  clutch.position.set(-1.15,-0.72,0.22);
  group.add(clutch);
  [-0.48,0.42].forEach((x,index)=>{
    const gear = createSpurGear(index===0?0.3:0.42,index===0?12:18,matFor('turbo'));
    gear.position.set(x,-0.9,-0.18);
    group.add(gear);
  });
  return group;
})(),new THREE.Vector3(-1,-0.5,0),0xc3c9d1,
  { material:'Wet multi-plate clutch and six-speed steel gears', fn:'Transfers crankshaft torque through the clutch into the six-speed transmission' },'turbo');

registerLibraryPart('Duke Throttle Body and Intake','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const throttle = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.34,0.72,24),matFor('intake'));
  throttle.rotation.z = Math.PI/2;
  throttle.position.set(-1.2,0.58,-0.46);
  group.add(throttle);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.3,0.25,24),matFor('accent'));
  bell.rotation.z = Math.PI/2;
  bell.position.set(-1.65,0.58,-0.46);
  group.add(bell);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.9,0.58,-0.46),new THREE.Vector3(-0.35,0.92,-0.25),new THREE.Vector3(0,1.16,0),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,24,0.15,12,false),matFor('intake')));
  return group;
})(),new THREE.Vector3(-1,1,0),0x1c2a33,
  { material:'Cast aluminum throttle body and intake runner', fn:'Meters incoming air and routes it into the single-cylinder combustion chamber' },'intake');

registerLibraryPart('Duke Exhaust Header','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const headerPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.45,1.35,0.38),new THREE.Vector3(0.82,0.85,0.56),new THREE.Vector3(0.88,0.05,0.7),new THREE.Vector3(1.25,-0.62,0.72),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(headerPath,44,0.14,14,false),matFor('exhaust')));
  const oxygenSensor = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.24,12),matFor('accent'));
  oxygenSensor.position.set(0.89,0.28,0.7);
  group.add(oxygenSensor);
  return group;
})(),new THREE.Vector3(1,-0.5,0),0x8a5a3f,
  { material:'Stainless-steel exhaust header with oxygen sensor', fn:'Carries burned gas from the exhaust valve toward the muffler and monitors oxygen content' },'exhaust');

const dukeRadiator = (()=>{
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(1.18,1.72,0.22),matFor('pulley'));
  group.add(core);
  for(let index=0;index<14;index++){
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.08,0.035,0.27),matFor('head'));
    fin.position.y = -0.78+index*0.12;
    group.add(fin);
  }
  [-0.6,0.6].forEach(x=>{
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,1.7,12),matFor('accent'));
    tank.position.x = x;
    group.add(tank);
  });
  group.position.set(1.75,0.42,1.18);
  registerLibraryPart('Duke Radiator','duke-349-engine',group,new THREE.Vector3(1,0,1),0x25383c,
    { material:'Aluminum core with coolant end tanks', fn:'Rejects heat from the liquid coolant as air passes across its fins' },'pan');
  return group;
})();

registerLibraryPart('Duke Coolant Hoses','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const paths = [
    new THREE.CatmullRomCurve3([new THREE.Vector3(0.7,0.76,0.54),new THREE.Vector3(1.18,1.02,0.82),new THREE.Vector3(1.72,0.92,1.18),new THREE.Vector3(1.75,0.56,1.18)]),
    new THREE.CatmullRomCurve3([new THREE.Vector3(1.75,0.27,1.18),new THREE.Vector3(1.25,-0.02,0.98),new THREE.Vector3(0.92,-0.24,0.54),new THREE.Vector3(0.68,-0.24,0.48)]),
  ];
  paths.forEach((curve,index)=>{
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,36,0.095,12,false),matFor(index===0?'accent':'intake')));
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.105,12,12),new THREE.MeshStandardMaterial({color:index===0?0x51e7f4:0x4897c5,emissive:index===0?0x1595a0:0x163f67,emissiveIntensity:0.85}));
    marker.userData.curve = curve;
    marker.userData.phase = index*0.5;
    group.add(marker);
    dukeCoolantMarkers.push(marker);
    dukeCoolantCurves.push(curve);
  });
  return group;
})(),new THREE.Vector3(1,0.2,1),0x34cedb,
  { material:'Reinforced coolant hoses carrying water-glycol coolant', fn:'Circulates coolant between the cylinder jacket and radiator' },'accent');

registerLibraryPart('Duke Spark Plug','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const ceramic = new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.11,0.55,16),matFor('head'));
  group.add(ceramic);
  const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.2,14),matFor('accent'));
  terminal.position.y = 0.34;
  group.add(terminal);
  const electrode = new THREE.Mesh(new THREE.SphereGeometry(0.12,12,12),new THREE.MeshStandardMaterial({color:0xffad55,emissive:0xff7a1a,emissiveIntensity:0.05}));
  electrode.position.y = -0.31;
  group.add(electrode);
  dukeSparkMaterial = electrode.material;
  group.position.set(0.28,1.86,0.04);
  return group;
})(),new THREE.Vector3(0,1,0),0xffad55,
  { material:'Nickel-alloy electrode with ceramic insulator', fn:'Ignites the compressed mixture once per four-stroke combustion cycle' },'accent');

registerLibraryPart('Duke Oil Sump','duke-349-engine',(()=>{
  const group = new THREE.Group();
  const pan = new THREE.Mesh(new THREE.BoxGeometry(2.55,0.48,1.78),matFor('pan'));
  pan.position.y = -1.52;
  group.add(pan);
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.18,16),matFor('crank'));
  drain.position.set(0.55,-1.8,0.2);
  group.add(drain);
  return group;
})(),new THREE.Vector3(0,-1,0),0x22262c,
  { material:'Cast aluminum wet-sump oil pan', fn:'Collects and stores engine oil for lubrication and cooling' },'pan');

function updateDukeMechanism(angle){
  const crankPinX = dukeCrankRadius*Math.sin(angle);
  const crankPinY = dukeCrankCenterY+dukeCrankRadius*Math.cos(angle);
  const rodRise = Math.sqrt(Math.max(0,dukeRodLength*dukeRodLength-crankPinX*crankPinX));
  const pistonPinY = crankPinY+rodRise;
  const crankPin = new THREE.Vector3(crankPinX,crankPinY,0.12);
  const pistonPin = new THREE.Vector3(0,pistonPinY,0.12);
  const direction = pistonPin.clone().sub(crankPin);
  dukeConnectingRod.position.copy(crankPin.clone().add(pistonPin).multiplyScalar(0.5));
  dukeConnectingRod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
  dukeConnectingRod.scale.y = direction.length();
  dukeSmallEnd.position.copy(pistonPin);
  dukeBigEnd.position.copy(crankPin);
  dukePiston.position.set(0,pistonPinY-0.18,0);
  dukeCrankshaft.rotation.z = angle;

  dukeCamshafts.forEach((cam,index)=>{ cam.rotation.x = angle*0.5 + index*Math.PI; });
  const fourStrokeAngle = ((angle%(Math.PI*4))+Math.PI*4)%(Math.PI*4);
  dukeValves.forEach(valve=>{
    const valveWindow = valve.intake
      ? fourStrokeAngle < Math.PI ? fourStrokeAngle : -1
      : fourStrokeAngle >= Math.PI*3 ? fourStrokeAngle-Math.PI*3 : -1;
    const lift = valveWindow < 0 ? 0 : Math.sin(valveWindow)*0.12;
    valve.group.position.y = valve.baseY + Math.max(0,lift);
  });

  const coolantProgress = (angle/(Math.PI*2))%1;
  dukeCoolantMarkers.forEach(marker=>{
    marker.position.copy(marker.userData.curve.getPoint((coolantProgress+marker.userData.phase)%1));
  });
  const sparkNow = fourStrokeAngle >= Math.PI*2-0.12 && fourStrokeAngle < Math.PI*2+0.12;
  dukeSparkMaterial.emissiveIntensity = sparkNow ? 1.8 : 0.04;
  const stroke = sparkNow ? 'Ignition'
    : fourStrokeAngle < Math.PI ? 'Intake'
    : fourStrokeAngle < Math.PI*2 ? 'Compression'
      : fourStrokeAngle < Math.PI*3 ? 'Power' : 'Exhaust';
  const valveState = fourStrokeAngle < Math.PI ? 'Intake valves open'
    : fourStrokeAngle >= Math.PI*3 ? 'Exhaust valves open' : 'Both valve sets closed';
  document.getElementById('duke-cycle-stroke').textContent = stroke;
  document.getElementById('duke-cycle-angle').textContent = Math.round(fourStrokeAngle*180/Math.PI)+'° / 720°';
  document.getElementById('duke-valve-state').textContent = valveState;
  document.getElementById('duke-valve-state').classList.toggle('active',valveState.includes('open'));
  document.getElementById('duke-spark-state').textContent = sparkNow ? 'Firing' : 'Standby';
  document.getElementById('duke-spark-state').classList.toggle('active',sparkNow);
}
updateDukeMechanism(0);
document.getElementById('duke-rpm').addEventListener('input',event=>{
  dukeRpm = Number(event.target.value);
  document.getElementById('duke-rpm-value').textContent = dukeRpm.toLocaleString('en-US');
});

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
    'four-bar-linkage':'four-bar-linkage',
    'planetary-gears':'planetary-gears',
    'v8-engine':'v8-engine',
    'duke-349-engine':'duke-349-engine',
    'ktm-390-duke':'ktm-390-duke',
    'bmw-m4':'bmw-m4',
  };
  const nextModel = modelGroups[modelId];
  if (!nextModel) return false;
  activeLibraryModel = nextModel;
  setSimulation(false);
  setExplode(false);
  setCross(false);
  resetFocus();
  demoCylinderPiston.position.copy(demoCylinderPiston.userData.basePos);
  demoConnectingRod.position.set(0,-0.51,0);
  demoConnectingRod.rotation.z = 0;
  demoCrankshaft.rotation.x = 0;
  demoGearA.rotation.z = 0;
  demoGearB.rotation.z = 0;
  dukeCycle.angle = 0;
  updateDukeMechanism(0);
  v8Crankshaft.rotation.x = 0;
  v8Pistons.forEach(piston=>piston.slider.position.y = piston.baseY);
  v8ConnectingRods.forEach(rod=>rod.link.rotation.z = 0);
  updateFourBar(0);
  planetaryPhase.value = 0;
  planetaryCarrier.rotation.z = 0;
  planetarySun.rotation.z = 0;
  planetaryGears.forEach((gear,index)=>{
    const angle = index/3*Math.PI*2;
    gear.position.set(Math.cos(angle)*planetaryOrbitRadius,Math.sin(angle)*planetaryOrbitRadius,0.04);
    gear.rotation.z = 0;
  });
  Object.values(parts).forEach(part=>{
    part.group.visible = (part.group.userData.libraryModel || 'inline-six') === activeLibraryModel;
  });
  const currentVehicle = customVehicleModels.get(activeLibraryModel);
  if (currentVehicle && currentVehicle.reset) currentVehicle.reset();
  document.getElementById('duke-telemetry').hidden = activeLibraryModel !== 'duke-349-engine';
  internals.visible = activeLibraryModel === 'inline-six';
  document.querySelectorAll('.part-chip:not(.showall)').forEach(chip=>{
    chip.hidden = chip.dataset.libraryModel !== activeLibraryModel;
  });
  radiusGoal = activeLibraryModel === 'inline-six' ? 15
    : activeLibraryModel === 'v8-engine' ? 10.5
      : activeLibraryModel === 'duke-349-engine' ? 7.4
      : activeLibraryModel === 'ktm-390-duke' ? 7.2
        : activeLibraryModel === 'bmw-m4' ? 8.2
      : activeLibraryModel === 'planetary-gears' ? 6.4
      : activeLibraryModel === 'four-bar-linkage' ? 8
        : activeLibraryModel === 'gear-pair' ? 7.2 : 7.8;
  camTargetGoal.set(0,0.1,0);
  if (activeLibraryModel === 'ktm-390-duke' || activeLibraryModel === 'bmw-m4') camTargetGoal.set(0,-1.05,0);
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
  document.getElementById('duke-engine-state').textContent = on && activeLibraryModel === 'duke-349-engine' ? 'RUNNING' : 'STOPPED';
  document.getElementById('duke-engine-state').classList.toggle('running',on && activeLibraryModel === 'duke-349-engine');
  if (!on) v8SparkPlugs.forEach(plug=>plug.material.emissiveIntensity = 0.03);
  if (!on && dukeSparkMaterial){
    dukeSparkMaterial.emissiveIntensity = 0.04;
    document.getElementById('duke-spark-state').textContent = 'Standby';
    document.getElementById('duke-spark-state').classList.remove('active');
  }
}
document.getElementById('btn-explode').addEventListener('click', ()=> setExplode(!exploded));
document.getElementById('btn-cross').addEventListener('click', ()=> setCross(!crossSection));
document.getElementById('btn-sim').addEventListener('click', ()=> setSimulation(!simulationRunning));
// ================= Animation loop =================
let flowT = 0, simAngle = 0, lastFrameTime = 0;
function animate(timestamp=performance.now()){
  const deltaSeconds = lastFrameTime ? Math.min((timestamp-lastFrameTime)/1000,0.05) : 1/60;
  lastFrameTime = timestamp;
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
  } else if (activeLibraryModel === 'four-bar-linkage' && simulationRunning){
    updateFourBar(simAngle);
  } else if (activeLibraryModel === 'planetary-gears' && simulationRunning){
    planetaryPhase.value += 0.014;
    planetaryCarrier.rotation.z = planetaryPhase.value;
    planetarySun.rotation.z += 0.035;
    planetaryGears.forEach((gear,index)=>{
      const angle = planetaryPhase.value + index/3*Math.PI*2;
      gear.position.set(Math.cos(angle)*planetaryOrbitRadius,Math.sin(angle)*planetaryOrbitRadius,0.04);
      gear.rotation.z -= 0.045;
    });
  } else if (activeLibraryModel === 'v8-engine' && simulationRunning){
    v8Crankshaft.rotation.x = simAngle;
    v8Pistons.forEach(piston=>{
      piston.slider.position.y = piston.baseY + Math.cos(simAngle+piston.phase)*0.29;
    });
    v8ConnectingRods.forEach(rod=>{
      const phase = simAngle + rod.phase;
      rod.link.rotation.z = Math.sin(phase)*0.12;
    });
    const firingStep = Math.floor((simAngle%(Math.PI*4))/(Math.PI/2))%v8FiringOrder.length;
    const firingCylinder = v8FiringOrder[firingStep];
    v8SparkPlugs.forEach(plug=>{
      plug.material.emissiveIntensity = plug.cylinder === firingCylinder ? 1.8 : 0.03;
    });
  } else if (activeLibraryModel === 'duke-349-engine' && simulationRunning){
    dukeCycle.angle += (dukeRpm*Math.PI*2/60)*dukeSlowMotion*deltaSeconds;
    updateDukeMechanism(dukeCycle.angle);
  }
  if (simulationRunning){
    const vehicleModel = customVehicleModels.get(activeLibraryModel);
    if (vehicleModel && vehicleModel.update) vehicleModel.update({deltaSeconds,angle:simAngle});
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
  registerVehicleModel,
  setVehicleHood:open=>{
    const vehicle=customVehicleModels.get(activeLibraryModel);
    return vehicle && vehicle.setHoodOpen ? vehicle.setHoodOpen(open) : false;
  },
  toggleVehicleHood:()=>{
    const vehicle=customVehicleModels.get(activeLibraryModel);
    return vehicle && vehicle.toggleHood ? vehicle.toggleHood() : false;
  },
  isVehicleHoodOpen:()=>{
    const vehicle=customVehicleModels.get(activeLibraryModel);
    return vehicle && vehicle.isHoodOpen ? vehicle.isHoodOpen() : false;
  },
  isModelActive:modelId=>activeLibraryModel === modelId,
  endAR:()=>arSession ? arSession.end() : Promise.resolve(),
  isARPresenting:()=>renderer.xr.isPresenting,
  getModelSummary:()=>{
    const vehicle=customVehicleModels.get(activeLibraryModel);
    if (vehicle && vehicle.summary) return vehicle.summary;
    return activeLibraryModel === 'single-cylinder'
    ? { name:'Single-Cylinder Piston', cylinders:1, turbochargers:0, description:'A piston, connecting rod, cylinder block, and crankshaft.' }
    : activeLibraryModel === 'gear-pair'
      ? { name:'Intermeshing Gear Pair', cylinders:0, turbochargers:0, description:'Two spur gears that mesh and counter-rotate to transfer motion.' }
      : activeLibraryModel === 'four-bar-linkage'
        ? { name:'Four-Bar Linkage', cylinders:0, turbochargers:0, description:'A fixed frame, input crank, coupler link, and output rocker move together through a constrained cycle.' }
        : activeLibraryModel === 'planetary-gears'
          ? { name:'Planetary Gear Train', cylinders:0, turbochargers:0, description:'A sun gear drives three orbiting planet gears inside an internal ring gear on a rotating carrier.' }
          : activeLibraryModel === 'v8-engine'
            ? { name:'90° V8 Engine', cylinders:8, turbochargers:0, firingOrder:v8FiringOrder.slice(), description:'Eight cylinders in two numbered 90-degree banks with overhead cams, a cross-plane crankshaft, intake runners, headers, and individually sequenced spark plugs.' }
          : activeLibraryModel === 'duke-349-engine'
            ? { name:'KTM Duke 349.32 cc DOHC', cylinders:1, displacementCc:349.32, cooling:'Liquid-cooled', valveTrain:'DOHC, four valves', turbochargers:0, description:'Single-cylinder 349.32 cc engine with liquid cooling, dual overhead camshafts, four valves, a slider-crank, wet clutch, and six-speed gearbox.' }
            : { name:'Twin Turbo Inline-6', cylinders:NCYL, turbochargers:2, description:'A six-cylinder engine with twin turbochargers, an intake and exhaust path, charge piping, and a reciprocating crank-and-piston assembly.' };
          },
  getParts:()=>Object.entries(parts).filter(([,part])=>(part.group.userData.libraryModel || 'inline-six') === activeLibraryModel).map(([name,part])=>({ name, material:part.info.material, function:part.info.fn })),
  getSelectedPart:()=>selectedPart,
  getPartInfo:name=>{
    const part = parts[name];
    return part && (part.group.userData.libraryModel || 'inline-six') === activeLibraryModel
      ? { name, material:part.info.material, function:part.info.fn }
      : null;
  },
};
