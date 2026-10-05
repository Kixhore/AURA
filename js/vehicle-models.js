(function(){
  const floorOffset = -2.6;
  const black = new THREE.MeshStandardMaterial({ color:0x101316, metalness:0.2, roughness:0.52 });
  const rubber = new THREE.MeshStandardMaterial({ color:0x090b0d, metalness:0.05, roughness:0.82 });
  const steel = new THREE.MeshStandardMaterial({ color:0x909ba4, metalness:0.92, roughness:0.22 });
  const glass = new THREE.MeshPhysicalMaterial({ color:0x18313e, metalness:0.18, roughness:0.16, transparent:true, opacity:0.62, side:THREE.DoubleSide });

  function partRoot(){
    const root = new THREE.Group();
    root.position.y = floorOffset;
    return root;
  }
  function paint(color,roughness=0.24){
    return new THREE.MeshPhysicalMaterial({ color, metalness:0.62, roughness, clearcoat:0.75, clearcoatRoughness:0.18 });
  }
  function addSegment(parent,start,end,radius,material){
    const from = new THREE.Vector3(start[0],start[1],start[2]);
    const to = new THREE.Vector3(end[0],end[1],end[2]);
    const direction = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),12),material);
    mesh.position.copy(from.add(to).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
    parent.add(mesh);
    return mesh;
  }
  function addDisc(parent,radius,width,z,material){
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,width,40),material);
    disc.rotation.x = Math.PI/2;
    disc.position.z = z;
    parent.add(disc);
    return disc;
  }
  function createWheel(radius,width){
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(radius-0.11,0.11,16,56),rubber);
    wheel.add(tire);
    const sidewall = new THREE.Mesh(new THREE.TorusGeometry(radius-0.12,0.035,8,48),black);
    sidewall.position.z = width*0.47;
    wheel.add(sidewall);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius*0.62,0.035,10,44),steel);
    wheel.add(rim);
    addDisc(wheel,radius*0.13,width*1.35,0,steel);
    for(let index=0;index<10;index++){
      const angle = index/10*Math.PI*2;
      const inner = radius*0.12, outer = radius*0.59;
      addSegment(wheel,[Math.cos(angle)*inner,Math.sin(angle)*inner,0.035],[Math.cos(angle+0.22)*outer,Math.sin(angle+0.22)*outer,0.035],0.018,steel);
      const rotorHole = new THREE.Mesh(new THREE.TorusGeometry(radius*0.34,0.018,6,12),black);
      rotorHole.position.set(Math.cos(angle)*radius*0.34,Math.sin(angle)*radius*0.34,width*0.72);
      wheel.add(rotorHole);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius*0.16,radius*0.16,width*1.4,24),matFor('crank'));
    hub.rotation.x = Math.PI/2;
    wheel.add(hub);
    return wheel;
  }

  AuraEngine.registerVehicleModel('ktm-390-duke',({registerPart,material})=>{
    const orange = paint(0xff6818);
    const frameOrange = paint(0xff741b,0.33);
    const ktmWheels = [];
    const brakeLights = [];
    const engineCrank = new THREE.Group();
    let wheelAngle = 0;
    let running = false;

    const rearWheelRoot = partRoot();
    const rearWheel = createWheel(0.66,0.28);
    rearWheelRoot.add(rearWheel);
    rearWheelRoot.position.x = -1.42;
    rearWheelRoot.position.y += 0.66;
    registerPart('KTM 390 Rear Wheel',rearWheelRoot,new THREE.Vector3(0,-1,0),0x111316,
      {material:'Tubeless sport tire, cast alloy rim, and steel brake disc',fn:'Driven rear wheel transfers engine torque to the road through the chain final drive'},'pulley');
    ktmWheels.push(rearWheelRoot);

    const frontWheelRoot = partRoot();
    const frontWheel = createWheel(0.66,0.25);
    frontWheelRoot.add(frontWheel);
    frontWheelRoot.position.x = 1.48;
    frontWheelRoot.position.y += 0.66;
    registerPart('KTM 390 Front Wheel',frontWheelRoot,new THREE.Vector3(1,0,0),0x111316,
      {material:'Tubeless sport tire, cast alloy rim, and dual steel brake discs',fn:'Front wheel rolls and steers while twin discs provide front braking'},'pulley');
    ktmWheels.push(frontWheelRoot);

    const frameRoot = partRoot();
    const framePoints = [
      [[-1.05,1.25,0],[-0.42,1.78,0]], [[-0.42,1.78,0],[0.52,1.38,0]],
      [[0.52,1.38,0],[1.05,1.9,0]], [[1.05,1.9,0],[0.2,1.95,0]],
      [[0.2,1.95,0],[-0.42,1.78,0]], [[-0.42,1.78,0],[-0.5,1.0,0]],
      [[-0.5,1.0,0],[0.52,1.38,0]], [[0.52,1.38,0],[0.85,0.9,0]],
      [[0.85,0.9,0],[1.05,1.9,0]], [[-1.05,1.25,-0.22],[-0.42,1.78,-0.22]],
      [[-0.42,1.78,-0.22],[0.52,1.38,-0.22]], [[0.52,1.38,-0.22],[1.05,1.9,-0.22]],
    ];
    framePoints.forEach(([start,end])=>addSegment(frameRoot,start,end,0.055,frameOrange));
    registerPart('KTM 390 Trellis Frame',frameRoot,new THREE.Vector3(0,1,0),0xff741b,
      {material:'Chromium-molybdenum steel trellis',fn:'Triangulated chassis joins the steering head, engine mounts, swingarm pivot, and rear subframe'},'exhaust');

    const swingarmRoot = partRoot();
    addSegment(swingarmRoot,[-0.55,0.9,0.28],[-1.42,0.66,0.28],0.095,steel);
    addSegment(swingarmRoot,[-0.55,0.9,-0.28],[-1.42,0.66,-0.28],0.095,steel);
    addSegment(swingarmRoot,[-0.55,0.9,0],[-1.42,0.66,0],0.045,black);
    registerPart('KTM 390 Swingarm',swingarmRoot,new THREE.Vector3(0,-1,0),0x929ba3,
      {material:'Cast aluminum swingarm with steel axle',fn:'Locates the rear axle and transfers drive and suspension loads into the frame'},'head');

    const forkRoot = partRoot();
    [-0.22,0.22].forEach(z=>{
      addSegment(forkRoot,[1.48,0.8,z],[1.04,2.0,z],0.075,matFor('piston'));
      addSegment(forkRoot,[1.43,0.8,z],[0.99,1.87,z],0.105,steel);
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.09,16),black);
      seal.position.set(1.445,0.86,z);
      seal.rotation.z = -0.35;
      forkRoot.add(seal);
    });
    registerPart('KTM 390 WP Front Fork',forkRoot,new THREE.Vector3(1,1,0),0xc3c9d1,
      {material:'43 mm inverted WP suspension fork',fn:'Guides the front wheel and compresses to absorb bumps and braking loads'},'crank');

    const rearShockRoot = partRoot();
    addSegment(rearShockRoot,[-0.7,1.72,0],[-0.45,0.94,0],0.11,matFor('exhaust'));
    const spring = new THREE.Mesh(new THREE.TorusGeometry(0.17,0.035,8,28),orange);
    spring.position.set(-0.57,1.31,0.03);
    spring.rotation.y = Math.PI/2;
    rearShockRoot.add(spring);
    registerPart('KTM 390 Rear Shock',rearShockRoot,new THREE.Vector3(0,1,0),0xe57824,
      {material:'WP monoshock with coil spring',fn:'Controls rear wheel travel through the swingarm'},'exhaust');

    const tankRoot = partRoot();
    const tank = new THREE.Mesh(new THREE.SphereGeometry(1,32,24),orange);
    tank.scale.set(0.82,0.43,0.59);
    tank.position.set(0.08,1.94,0);
    tankRoot.add(tank);
    [-1,1].forEach(side=>{
      const shroud = new THREE.Mesh(new THREE.ShapeGeometry((()=>{
        const shape=new THREE.Shape();shape.moveTo(-0.54,1.67);shape.lineTo(0.35,1.73);shape.lineTo(0.64,1.12);shape.lineTo(0.08,1.29);shape.closePath();return shape;
      })()),orange);
      shroud.position.z = side*0.57;
      shroud.material.side = THREE.DoubleSide;
      tankRoot.add(shroud);
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.055,0.035),black);
      vent.position.set(0.25,1.43,side*0.59);
      tankRoot.add(vent);
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.045,24),steel);
    cap.position.set(-0.12,2.36,0);
    tankRoot.add(cap);
    registerPart('KTM 390 Fuel Tank and Shrouds',tankRoot,new THREE.Vector3(0,1,0),0xff6818,
      {material:'Steel fuel tank with molded polymer shrouds',fn:'Stores fuel and shapes the rider-facing tank and radiator side panels'},'cover');

    const seatRoot = partRoot();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.15,0.19,0.72),black);
    seat.position.set(-0.82,1.79,0);
    seat.rotation.z = -0.12;
    seatRoot.add(seat);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.85,0.34,0.72),orange);
    tail.position.set(-1.36,1.97,0);
    tail.rotation.z = -0.22;
    seatRoot.add(tail);
    const grabRail = addSegment(seatRoot,[-1.7,1.88,0.42],[-0.88,1.99,0.42],0.035,steel);
    addSegment(seatRoot,[-1.7,1.88,-0.42],[-0.88,1.99,-0.42],0.035,steel);
    registerPart('KTM 390 Seat and Tail',seatRoot,new THREE.Vector3(-1,1,0),0xff6818,
      {material:'Foam-padded seat with polymer tail fairing',fn:'Supports the rider and houses the rear bodywork and tail lighting'},'cover');

    const cockpitRoot = partRoot();
    addSegment(cockpitRoot,[0.82,2.02,0],[1.02,2.23,0],0.065,steel);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,1.15,16),steel);
    bar.rotation.x = Math.PI/2;
    bar.position.set(1.0,2.22,0);
    cockpitRoot.add(bar);
    [-1,1].forEach(side=>{
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.3,16),black);
      grip.rotation.x = Math.PI/2;
      grip.position.set(1.0,2.22,side*0.67);
      cockpitRoot.add(grip);
      const mirrorStem = addSegment(cockpitRoot,[1.02,2.22,side*0.48],[0.83,2.55,side*0.66],0.022,steel);
      const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.12,16,12),black);
      mirror.scale.set(0.62,1,1.2);
      mirror.position.set(0.82,2.57,side*0.68);
      cockpitRoot.add(mirror);
    });
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.33,0.25,0.16),black);
    dash.position.set(0.95,2.25,0);
    cockpitRoot.add(dash);
    const dashScreen = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.13,0.025),new THREE.MeshStandardMaterial({color:0x173941,emissive:0x16b8c6,emissiveIntensity:0.45}));
    dashScreen.position.set(1.0,2.27,0.085);
    cockpitRoot.add(dashScreen);
    registerPart('KTM 390 Cockpit and Mirrors',cockpitRoot,new THREE.Vector3(1,1,0),0x101316,
      {material:'Aluminum handlebar, TFT display, and stem mirrors',fn:'Provides steering, rider controls, and speed and engine information'},'pulley');

    const headlampRoot = partRoot();
    const lampHousing = new THREE.Mesh(new THREE.SphereGeometry(0.4,24,20),black);
    lampHousing.scale.set(0.65,0.7,1.15);
    lampHousing.position.set(1.52,1.96,0);
    headlampRoot.add(lampHousing);
    const lampLensMaterial = new THREE.MeshStandardMaterial({color:0xbdefff,emissive:0x86dcff,emissiveIntensity:0.3,transparent:true,opacity:0.9});
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.3,24,16),lampLensMaterial);
    lens.scale.set(0.45,0.75,1.1);
    lens.position.set(1.72,1.96,0);
    headlampRoot.add(lens);
    brakeLights.push(lampLensMaterial);
    const smallScreen = new THREE.Mesh(new THREE.SphereGeometry(0.27,20,14),glass);
    smallScreen.scale.set(0.4,0.55,1.1);
    smallScreen.position.set(1.2,2.22,0);
    headlampRoot.add(smallScreen);
    registerPart('KTM 390 LED Headlight',headlampRoot,new THREE.Vector3(1,1,0),0x92e9ff,
      {material:'LED projector with clear polycarbonate lens',fn:'Illuminates the road and provides the motorcycle front signature'},'accent');

    const engineRoot = partRoot();
    const cases = new THREE.Mesh(new THREE.BoxGeometry(1.12,0.9,1.08),matFor('block'));
    cases.position.set(-0.05,0.91,0);
    engineRoot.add(cases);
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.57,0.96,28),matFor('head'));
    cylinder.position.set(0.12,1.48,0);
    cylinder.rotation.z = -0.18;
    engineRoot.add(cylinder);
    for(let index=0;index<8;index++){
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.58-index*0.018,0.58-index*0.018,0.055,28),matFor(index%2===0?'head':'block'));
      fin.position.set(0.12,1.12+index*0.1,0);
      fin.rotation.z = -0.18;
      engineRoot.add(fin);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.92,0.28,0.96),matFor('head'));
    head.position.set(0.17,2.05,0);
    head.rotation.z = -0.18;
    engineRoot.add(head);
    const clutchCover = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.16,28),matFor('cover'));
    clutchCover.rotation.x = Math.PI/2;
    clutchCover.position.set(-0.18,0.82,0.57);
    engineRoot.add(clutchCover);
    for(let index=0;index<5;index++){
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.04,10),matFor('accent'));
      bolt.rotation.x = Math.PI/2;
      const angle = index/5*Math.PI*2;
      bolt.position.set(-0.18+Math.cos(angle)*0.31,0.82+Math.sin(angle)*0.31,0.67);
      engineRoot.add(bolt);
    }
    const crank = new THREE.Group();
    const crankShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.9,20),matFor('crank'));
    crankShaft.rotation.x = Math.PI/2;
    crank.add(crankShaft);
    const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.09,24),matFor('pulley'));
    flywheel.rotation.x = Math.PI/2;
    flywheel.position.z = 0.16;
    crank.add(flywheel);
    crank.position.set(0.38,0.72,0.12);
    engineRoot.add(crank);
    registerPart('KTM 390 LC4c Engine',engineRoot,new THREE.Vector3(0,-1,0),0x606a72,
      {material:'349 cc liquid-cooled single-cylinder DOHC four-valve engine',fn:'Combustion drives the piston and crank; DOHC valves manage intake and exhaust breathing'},'block');
    engineRoot.userData.crank = crank;

    const radiatorRoot = partRoot();
    const radiatorCore = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.88,0.88),matFor('pulley'));
    radiatorCore.position.set(0.55,1.15,0.62);
    radiatorRoot.add(radiatorCore);
    for(let index=0;index<10;index++){
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.025,0.82),matFor('head'));
      fin.position.set(0.58,0.77+index*0.085,0.62);
      radiatorRoot.add(fin);
    }
    [[0.24,1.66,0.52],[0.24,0.72,0.52]].forEach(([x,y,z])=>{
      const hosePath = new THREE.CatmullRomCurve3([new THREE.Vector3(x,y,z),new THREE.Vector3(0.38,y-0.1,z*0.82),new THREE.Vector3(0.22,y-0.3,0.28),new THREE.Vector3(0.3,y-0.38,0.05)]);
      radiatorRoot.add(new THREE.Mesh(new THREE.TubeGeometry(hosePath,22,0.055,10,false),matFor('accent')));
    });
    registerPart('KTM 390 Radiator and Coolant Loop',radiatorRoot,new THREE.Vector3(1,0,1),0x37d7df,
      {material:'Aluminum radiator core with reinforced coolant hoses',fn:'Circulates liquid coolant through the cylinder jacket and rejects heat through the radiator fins'},'accent');

    const exhaustRoot = partRoot();
    const exhaustCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.42,1.64,-0.38),new THREE.Vector3(0.78,1.32,-0.62),new THREE.Vector3(0.84,0.66,-0.68),new THREE.Vector3(0.4,0.35,-0.62),new THREE.Vector3(-0.55,0.48,-0.52)]);
    exhaustRoot.add(new THREE.Mesh(new THREE.TubeGeometry(exhaustCurve,40,0.11,12,false),matFor('exhaust')));
    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.24,0.82,24),matFor('turbo'));
    muffler.rotation.z = Math.PI/2;
    muffler.position.set(-0.75,0.54,-0.55);
    exhaustRoot.add(muffler);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.18,20),black);
    tip.rotation.z = Math.PI/2;
    tip.position.set(-1.24,0.54,-0.55);
    exhaustRoot.add(tip);
    registerPart('KTM 390 Exhaust and Muffler',exhaustRoot,new THREE.Vector3(-1,0,-1),0x9b6548,
      {material:'Stainless header with catalytic converter and silencer',fn:'Routes exhaust from the single cylinder and reduces noise and emissions'},'exhaust');

    const brakeRoot = partRoot();
    [-1.42,1.48].forEach(x=>{
      [-1,1].forEach(side=>{
        const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.32,0.16),matFor('exhaust'));
        caliper.position.set(x,x<0?0.75:0.84,side*0.25);
        brakeRoot.add(caliper);
      });
    });
    registerPart('KTM 390 Brembo Brakes',brakeRoot,new THREE.Vector3(1,0,0),0xa45538,
      {material:'Radial front caliper and rear disc brake hardware',fn:'Clamps the brake rotors to slow and control both wheels'},'exhaust');

    const chainRoot = partRoot();
    const rearSprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.29,0.29,0.07,28),matFor('crank'));
    rearSprocket.rotation.x = Math.PI/2;
    rearSprocket.position.set(-1.42,0.66,-0.31);
    chainRoot.add(rearSprocket);
    const frontSprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.07,20),matFor('crank'));
    frontSprocket.rotation.x = Math.PI/2;
    frontSprocket.position.set(-0.1,0.76,-0.32);
    chainRoot.add(frontSprocket);
    addSegment(chainRoot,[-1.42,0.93,-0.36],[-0.1,0.93,-0.36],0.035,steel);
    addSegment(chainRoot,[-1.42,0.39,-0.36],[-0.1,0.58,-0.36],0.035,steel);
    registerPart('KTM 390 Chain Final Drive',chainRoot,new THREE.Vector3(-1,0,0),0x8d969d,
      {material:'Sealed roller chain with steel sprockets',fn:'Transfers gearbox output to the rear wheel'},'crank');

    const tailLight = new THREE.MeshStandardMaterial({color:0xff3322,emissive:0xff160a,emissiveIntensity:0.25});
    const rearLightRoot = partRoot();
    const tailLens = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.14,0.42),tailLight);
    tailLens.position.set(-1.72,1.85,0);
    rearLightRoot.add(tailLens);
    registerPart('KTM 390 Tail Light',rearLightRoot,new THREE.Vector3(-1,1,0),0xff3528,
      {material:'LED tail and brake light',fn:'Signals braking and rear vehicle presence'},'accent');
    brakeLights.push(tailLight);

    const vehicleDetails = { wheels:ktmWheels, lights:brakeLights, engineCrank:engineRoot.userData.crank };
    return {
      summary:{name:'KTM 390 Duke',vehicleType:'motorcycle',description:'Naked street motorcycle with a trellis frame, single-cylinder liquid-cooled engine, WP suspension, disc brakes, chain drive, and LED lighting.'},
      update:({deltaSeconds})=>{
        wheelAngle += deltaSeconds*5.5;
        vehicleDetails.wheels.forEach(wheel=>wheel.rotation.z = wheelAngle);
        vehicleDetails.engineCrank.rotation.z = wheelAngle*1.8;
        vehicleDetails.lights.forEach(light=>light.emissiveIntensity = 1.15);
      },
      reset:()=>{
        wheelAngle = 0;
        vehicleDetails.wheels.forEach(wheel=>wheel.rotation.z = 0);
        vehicleDetails.engineCrank.rotation.z = 0;
        vehicleDetails.lights.forEach((light,index)=>light.emissiveIntensity = index===0?0.3:0.25);
      },
    };
  });

  AuraEngine.registerVehicleModel('bmw-m4',({THREE,registerPart,material})=>{
    const bluePaint = paint(0x1766c2,0.2);
    const darkPaint = paint(0x111820,0.28);
    const bmwWheels = [];
    const bmwEngineParts = [];
    const bmwLights = [];
    let hoodOpen = false;
    let wheelAngle = 0;
    let engineAngle = 0;

    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-3.5,0.57);
    bodyShape.lineTo(-3.48,0.95);
    bodyShape.lineTo(-3.02,1.05);
    bodyShape.lineTo(-2.68,1.18);
    bodyShape.lineTo(-1.55,1.22);
    bodyShape.quadraticCurveTo(-1.08,2.0,-0.25,2.04);
    bodyShape.lineTo(0.48,2.04);
    bodyShape.quadraticCurveTo(1.14,1.98,1.46,1.24);
    bodyShape.lineTo(2.46,1.18);
    bodyShape.lineTo(3.28,0.98);
    bodyShape.lineTo(3.45,0.66);
    bodyShape.lineTo(3.2,0.48);
    bodyShape.lineTo(2.86,0.46);
    bodyShape.quadraticCurveTo(2.15,1.37,1.44,0.46);
    bodyShape.lineTo(-1.43,0.46);
    bodyShape.quadraticCurveTo(-2.15,1.37,-2.87,0.46);
    bodyShape.lineTo(-3.23,0.48);
    bodyShape.closePath();
    const cabinWindow = new THREE.Path();
    cabinWindow.moveTo(-1.34,1.31);
    cabinWindow.lineTo(-0.86,1.82);
    cabinWindow.quadraticCurveTo(-0.63,1.93,-0.28,1.94);
    cabinWindow.lineTo(0.44,1.94);
    cabinWindow.quadraticCurveTo(0.76,1.89,1.07,1.31);
    cabinWindow.closePath();
    bodyShape.holes.push(cabinWindow);
    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape,{depth:1.82,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.045,bevelThickness:0.04});
    bodyGeometry.translate(0,0,-0.91);
    const bodyRoot = partRoot();
    const bodyMesh = new THREE.Mesh(bodyGeometry,bluePaint);
    bodyRoot.add(bodyMesh);
    const lowerGrille = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.32,1.45),black);
    lowerGrille.position.set(3.39,0.77,0);
    bodyRoot.add(lowerGrille);
    registerPart('BMW M4 Body Shell',bodyRoot,new THREE.Vector3(0,1,0),0x1766c2,
      {material:'Steel and aluminum monocoque with composite exterior panels',fn:'Structural unibody shell carries the coupe cabin, suspension, and exterior panels'},'block');

    const hoodRoot = partRoot();
    const hoodPivot = new THREE.Group();
    hoodPivot.position.set(1.05,1.16,0);
    const hoodPanel = new THREE.Mesh(new THREE.BoxGeometry(1.72,0.075,1.62),bluePaint);
    hoodPanel.position.x = 0.82;
    hoodPivot.add(hoodPanel);
    [-0.45,0.45].forEach(z=>{
      const crease = new THREE.Mesh(new THREE.BoxGeometry(1.28,0.018,0.035),paint(0x4186d1,0.25));
      crease.position.set(0.8,0.049,z);
      hoodPivot.add(crease);
    });
    hoodRoot.add(hoodPivot);
    registerPart('BMW M4 Bonnet',hoodRoot,new THREE.Vector3(1,1,0),0x1766c2,
      {material:'Formed aluminum bonnet panel',fn:'Hinged hood covers the engine bay and lifts for powertrain inspection'},'cover');

    const glassRoot = partRoot();
    const glassGeo = new THREE.ShapeGeometry(cabinWindow);
    [-0.918,0.918].forEach(z=>{
      const pane = new THREE.Mesh(glassGeo,glass);
      pane.position.z = z;
      pane.material = glass;
      glassRoot.add(pane);
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.77,1.65),glass);
    windshield.position.set(1.12,1.61,0);
    windshield.rotation.z = 0.65;
    glassRoot.add(windshield);
    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.55,1.55),glass);
    rearWindow.position.set(-1.04,1.63,0);
    rearWindow.rotation.z = -0.7;
    glassRoot.add(rearWindow);
    registerPart('BMW M4 Cabin Glazing',glassRoot,new THREE.Vector3(0,1,0),0x23414f,
      {material:'Tinted laminated automotive safety glass',fn:'Windshield, rear glass, and side windows enclose the cabin while preserving visibility'},'cover');

    const frontGrilleRoot = partRoot();
    [-0.28,0.28].forEach(z=>{
      const kidney = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.48,0.34),black);
      kidney.position.set(3.42,0.95,z);
      frontGrilleRoot.add(kidney);
      for(let index=0;index<5;index++){
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035,0.018,0.29),steel);
        slat.position.set(3.485,0.78+index*0.075,z);
        frontGrilleRoot.add(slat);
      }
    });
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.1,1.82),darkPaint);
    lip.position.set(3.45,0.52,0);
    frontGrilleRoot.add(lip);
    registerPart('BMW M4 Kidney Grille and Front Bumper',frontGrilleRoot,new THREE.Vector3(1,0,0),0x111820,
      {material:'Black kidney grille, active air shutters, and composite bumper',fn:'Front fascia directs cooling air to the radiator and engine bay'},'cover');

    const headlightRoot = partRoot();
    const headlampMaterials=[];
    [-0.62,0.62].forEach(z=>{
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.25,0.5),black);
      housing.position.set(3.36,1.12,z);
      headlightRoot.add(housing);
      const ledMat = new THREE.MeshStandardMaterial({color:0xbceaff,emissive:0x8ddcff,emissiveIntensity:0.25});
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.09,0.41),ledMat);
      lens.position.set(3.49,1.15,z);
      headlightRoot.add(lens);
      headlampMaterials.push(ledMat);
    });
    registerPart('BMW M4 Adaptive LED Headlights',headlightRoot,new THREE.Vector3(1,1,0),0x9bdcff,
      {material:'Adaptive LED projector modules',fn:'Provides forward illumination and adaptive cornering light'},'accent');
    bmwLights.push(...headlampMaterials);

    const wheelLocations=[
      {name:'Front Left',x:2.15,z:0.72},{name:'Front Right',x:2.15,z:-0.72},
      {name:'Rear Left',x:-2.15,z:0.72},{name:'Rear Right',x:-2.15,z:-0.72},
    ];
    wheelLocations.forEach((location,index)=>{
      const wheelRoot=partRoot();
      const wheel=createWheel(0.66,0.32);
      wheelRoot.add(wheel);
      wheelRoot.position.set(location.x,0.68,location.z);
      registerPart('BMW M4 '+location.name+' Wheel',wheelRoot,new THREE.Vector3(location.x>0?1:-1,0,location.z>0?1:-1),0x15181b,
        {material:'Michelin performance tire, forged alloy rim, and ventilated brake disc',fn:'Rotating road wheel with a high-performance tire and drilled brake rotor'},'pulley');
      bmwWheels.push(wheelRoot);
    });

    const brakeRoot=partRoot();
    wheelLocations.forEach(location=>{
      const caliper=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.31,0.19),paint(0xd44536,0.32));
      caliper.position.set(location.x+0.16,0.75,location.z+(location.z>0?0.18:-0.18));
      brakeRoot.add(caliper);
    });
    registerPart('BMW M4 M Compound Brakes',brakeRoot,new THREE.Vector3(0,1,0),0xd44536,
      {material:'Ventilated steel rotors with multi-piston calipers',fn:'Hydraulic brake calipers clamp the four wheel rotors to slow the car'},'exhaust');

    const cabinRoot=partRoot();
    const dash=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,1.45),black);
    dash.position.set(0.74,1.32,0);
    cabinRoot.add(dash);
    const console=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.18,0.32),darkPaint);
    console.position.set(0.15,1.18,0);
    cabinRoot.add(console);
    for(let index=0;index<2;index++){
      const seat=new THREE.Group();
      const cushion=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.18,0.54),black);
      cushion.position.y=1.15;
      seat.add(cushion);
      const back=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.72,0.54),black);
      back.position.set(-0.2,1.55,0);
      back.rotation.z=-0.12;
      seat.add(back);
      seat.position.set(index===0?0.05:-0.82,index===0?0:0, index===0?0.43:-0.43);
      cabinRoot.add(seat);
    }
    const steering=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.035,10,28),steel);
    steering.position.set(0.98,1.43,0.48);
    steering.rotation.y=Math.PI/2;
    cabinRoot.add(steering);
    registerPart('BMW M4 Cabin and Interior',cabinRoot,new THREE.Vector3(0,1,0),0x171c21,
      {material:'Leather sport seats, multifunction steering wheel, and digital cockpit',fn:'Driver cabin with sport seating, steering, controls, and central console'},'cover');

    let hoodPivotRef;
    hoodPivotRef=hoodPivot;
    const engineBlockRoot=partRoot();
    const block=new THREE.Mesh(new THREE.BoxGeometry(1.55,0.58,0.95),matFor('block'));
    block.position.set(1.74,1.0,0);
    engineBlockRoot.add(block);
    for(let index=0;index<6;index++){
      const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.49,18),matFor('head'));
      cylinder.position.set(1.18+index*0.22,1.35,0);
      engineBlockRoot.add(cylinder);
    }
    registerPart('BMW M4 3.0L Inline-Six Engine',engineBlockRoot,new THREE.Vector3(1,1,0),0x555f68,
      {material:'Turbocharged aluminum inline-six engine',fn:'Three-liter twin-turbo inline-six produces power for the M4 drivetrain'},'block');
    const turboRoot=partRoot();
    [-0.38,0.38].forEach(z=>{
      const turbo=new THREE.Mesh(new THREE.SphereGeometry(0.26,18,16),matFor('turbo'));
      turbo.position.set(1.3,0.96,z);
      turboRoot.add(turbo);
      const inlet=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.055,8,20),matFor('accent'));
      inlet.position.set(1.3,0.96,z+0.2);
      turboRoot.add(inlet);
    });
    registerPart('BMW M4 Twin Turbochargers',turboRoot,new THREE.Vector3(1,0,1),0xc3c9d1,
      {material:'Twin exhaust-driven turbocharger assemblies',fn:'Compress intake air to increase the inline-six engine output'},'turbo');
    const intakeRoot=partRoot();
    const plenum=new THREE.Mesh(new THREE.BoxGeometry(1.35,0.22,0.65),matFor('intake'));
    plenum.position.set(1.75,1.43,0);
    intakeRoot.add(plenum);
    registerPart('BMW M4 Intake and Charge Air','bmw-m4',intakeRoot,new THREE.Vector3(1,1,0),0x293941,
      {material:'Composite intake manifold and charge-air plumbing',fn:'Routes filtered and turbocharged air into the inline-six cylinders'},'intake');
    const engineParts=[engineBlockRoot,turboRoot,intakeRoot];
    engineParts.forEach(part=>part.visible=false);

    const exhaustRoot=partRoot();
    [-0.43,-0.14,0.14,0.43].forEach((z,index)=>{
      const curve=new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.2-index*0.12,0.92,z),new THREE.Vector3(0.86-index*0.08,0.68,z*1.2),new THREE.Vector3(-0.5,0.46,z*1.25),new THREE.Vector3(-1.9,0.48,z*1.15),
      ]);
      exhaustRoot.add(new THREE.Mesh(new THREE.TubeGeometry(curve,28,0.055,8,false),matFor('exhaust')));
    });
    [-0.5,0.5].forEach(z=>{
      const tip=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.32,20),steel);
      tip.rotation.z=Math.PI/2;
      tip.position.set(-3.34,0.57,z);
      exhaustRoot.add(tip);
    });
    registerPart('BMW M4 Exhaust and Quad Tips',exhaustRoot,new THREE.Vector3(-1,0,0),0x8e969c,
      {material:'Stainless performance exhaust with four rear outlets',fn:'Carries exhaust from the twin turbochargers to the rear quad tailpipes'},'exhaust');

    const rearRoot=partRoot();
    const diffuser=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.2,1.56),darkPaint);
    diffuser.position.set(-3.27,0.46,0);
    rearRoot.add(diffuser);
    for(let index=0;index<5;index++){
      const fin=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.06,0.045),black);
      fin.position.set(-3.12,0.37,-0.58+index*0.29);
      rearRoot.add(fin);
    }
    registerPart('BMW M4 Rear Diffuser',rearRoot,new THREE.Vector3(-1,-1,0),0x141a1f,
      {material:'Composite underbody diffuser',fn:'Manages underbody airflow and integrates the quad exhaust outlets'},'cover');

    const mirrorRoot=partRoot();
    [-1,1].forEach(side=>{
      addSegment(mirrorRoot,[0.95,1.35,side*0.78],[1.22,1.42,side*1.02],0.045,steel);
      const shell=new THREE.Mesh(new THREE.SphereGeometry(0.18,18,14),bluePaint);
      shell.scale.set(0.72,0.55,1.18);
      shell.position.set(1.27,1.44,side*1.07);
      mirrorRoot.add(shell);
      const mirrorGlass=new THREE.Mesh(new THREE.SphereGeometry(0.13,14,10),glass);
      mirrorGlass.scale.set(0.3,0.55,1.05);
      mirrorGlass.position.set(1.38,1.44,side*1.07);
      mirrorRoot.add(mirrorGlass);
    });
    registerPart('BMW M4 Wing Mirrors',mirrorRoot,new THREE.Vector3(1,1,1),0x1766c2,
      {material:'Painted mirror caps with blind-spot glass',fn:'Provides rearward driver visibility and side marker lighting'},'cover');

    const tailRoot=partRoot();
    const spoiler=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.1,1.35),darkPaint);
    spoiler.position.set(-3.18,1.08,0);
    tailRoot.add(spoiler);
    const tailMaterials=[];
    [-0.55,0.55].forEach(z=>{
      const lightMaterial=new THREE.MeshStandardMaterial({color:0xff3322,emissive:0xff1008,emissiveIntensity:0.22});
      const tailLamp=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.18,0.38),lightMaterial);
      tailLamp.position.set(-3.43,0.91,z);
      tailRoot.add(tailLamp);
      tailMaterials.push(lightMaterial);
    });
    registerPart('BMW M4 Rear Lighting and Spoiler',tailRoot,new THREE.Vector3(-1,1,0),0x252b31,
      {material:'LED tail lamps and carbon-fiber rear spoiler',fn:'Signals braking and adds rear aerodynamic downforce'},'cover');
    bmwLights.push(...tailMaterials);

    const doorsRoot=partRoot();
    [-1,1].forEach(side=>{
      const seam=new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.35,1.16,side*0.93),new THREE.Vector3(-1.2,0.74,side*0.94),new THREE.Vector3(0.68,0.72,side*0.94),new THREE.Vector3(0.83,1.18,side*0.93),
      ]);
      doorsRoot.add(new THREE.Mesh(new THREE.TubeGeometry(seam,24,0.012,6,false),black));
      const handle=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.035,0.035),steel);
      handle.position.set(-0.35,1.08,side*0.96);
      doorsRoot.add(handle);
      const sideVent=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.14,0.05),darkPaint);
      sideVent.position.set(2.65,1.07,side*0.92);
      doorsRoot.add(sideVent);
    });
    registerPart('BMW M4 Doors and Side Vents',doorsRoot,new THREE.Vector3(0,0,1),0x1766c2,
      {material:'Aluminum doors, flush handles, and M side air outlets',fn:'Two-door coupe panels seal the cabin and vent front wheel-arch pressure'},'cover');

    const hoodControl={set(open){
      hoodOpen=Boolean(open);
      hoodPivotRef.rotation.z=hoodOpen?0.72:0;
      bluePaint.transparent=hoodOpen;
      bluePaint.opacity=hoodOpen?0.28:1;
      bluePaint.depthWrite=!hoodOpen;
      engineParts.forEach(part=>part.visible=hoodOpen);
      return hoodOpen;
    },toggle(){return this.set(!hoodOpen);},reset(){this.set(false);},get open(){return hoodOpen;}};
    hoodControl.reset();
    return {
      summary:{name:'BMW M4 Coupe',vehicleType:'car',description:'Performance coupe with a 3.0-litre twin-turbo inline-six, rear-biased drivetrain, adaptive lighting, M compound brakes, cabin, and aerodynamic bodywork.'},
      update:({deltaSeconds})=>{
        wheelAngle += deltaSeconds*5.2;
        bmwWheels.forEach(wheel=>wheel.rotation.z=wheelAngle);
        engineAngle += deltaSeconds*13;
        bmwLights.forEach(light=>light.emissiveIntensity=0.95);
      },
      reset:()=>{
        wheelAngle=0;
        engineAngle=0;
        bmwWheels.forEach(wheel=>wheel.rotation.z=0);
        bmwLights.forEach(light=>light.emissiveIntensity=0.22);
        hoodControl.reset();
      },
      setHoodOpen:hoodControl.set,
      toggleHood:hoodControl.toggle,
      isHoodOpen:()=>hoodControl.open,
    };
  });

  window.AuraVehicleModels = {
    bmwHood(open){return AuraEngine.setVehicleHood(open);},
    toggleBMWood(){return AuraEngine.toggleVehicleHood();},
    isBMWoodOpen(){return AuraEngine.isVehicleHoodOpen();},
  };
})();
