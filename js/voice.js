// ================= Voice: Speech Recognition + Synthesis =================
const micBtn = document.getElementById('mic-btn');
const voiceStatus = document.getElementById('voice-status');
const voiceTextEl = document.getElementById('voice-text');
const aiVoiceToggle = document.getElementById('ai-voice-toggle');
let aiVoiceOn = false;
let recognition = null, listening = false, userStopped = false;

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR){
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  voiceStatus.textContent = 'Tap the mic and speak a question or command';

  recognition.onresult = e=>{
    let interim = '', final = '';
    for (let i=e.resultIndex; i<e.results.length; i++){
      const transcript = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    voiceTextEl.textContent = '"' + (final || interim) + '"';
    if (final) runCommand(final.trim());
  };
  recognition.onerror = e=>{
    voiceStatus.textContent = (e.error === 'not-allowed' || e.error === 'service-not-allowed')
      ? 'Microphone permission denied — type your question instead'
      : 'Mic error (' + e.error + ') — type your question instead';
    listening = false;
    micBtn.classList.remove('listening');
  };
  recognition.onend = ()=>{
    micBtn.classList.remove('listening');
    if (listening && !userStopped){
      try { recognition.start(); } catch(error){ listening = false; }
    } else {
      listening = false;
    }
  };
} else {
  micBtn.disabled = true;
  voiceStatus.textContent = 'Voice input is not supported — type your question instead';
}

function startListening(){
  if (!recognition || listening) return;
  userStopped = false;
  try {
    recognition.start();
    listening = true;
    micBtn.classList.add('listening');
    voiceStatus.textContent = 'Listening for a question or command…';
  } catch(error){}
}
function stopListening(){
  userStopped = true;
  listening = false;
  micBtn.classList.remove('listening');
  if (recognition){ try { recognition.stop(); } catch(error){} }
  if (SR) voiceStatus.textContent = 'Tap the mic and speak a question or command';
}
micBtn.addEventListener('click', ()=>listening ? stopListening() : startListening());

aiVoiceToggle.addEventListener('click', ()=>{
  aiVoiceOn = !aiVoiceOn;
  aiVoiceToggle.classList.toggle('active', aiVoiceOn);
  aiVoiceToggle.textContent = 'AI Voice: ' + (aiVoiceOn ? 'On' : 'Off');
  if (!('speechSynthesis' in window) && aiVoiceOn){
    voiceStatus.textContent = 'Speech synthesis is not supported in this browser';
    aiVoiceOn = false;
    aiVoiceToggle.classList.remove('active');
    aiVoiceToggle.textContent = 'AI Voice: Off';
  }
});
function speak(text){
  if (!aiVoiceOn || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  utterance.pitch = 0.95;
  window.speechSynthesis.speak(utterance);
}

// ================= Model-grounded chat and viewer commands =================
const chatMessages = document.getElementById('chat-messages');
const commandInput = document.getElementById('cmd-input');
const internalFacts = [
  { terms:['crankshaft','crank'], answer:'The crankshaft converts the pistons’ up-and-down motion into rotation. The viewer animates it as part of the firing-cycle simulation.' },
  { terms:['piston','pistons'], answer:'The six pistons move inside the cylinders and transfer combustion force through connecting rods to rotate the crankshaft.' },
  { terms:['connecting rod','con rod','rods'], answer:'Connecting rods link each piston to the crankshaft, transmitting the pistons’ motion into crank rotation.' },
];
const partAliases = [
  { terms:['turbocharger b','turbo b','right turbo'], name:'Turbocharger B' },
  { terms:['turbocharger a','turbo a','left turbo'], name:'Turbocharger A' },
  { terms:['turbo','turbocharger'], name:'Turbocharger A' },
  { terms:['oil sump','sump'], name:'Oil Pan' },
  { terms:['exhaust manifold','headers'], name:'Exhaust Headers' },
  { terms:['intake'], name:'Intake Manifold' },
];

function addChatMessage(text, speaker){
  const message = document.createElement('div');
  message.className = 'chat-message ' + speaker;
  const label = document.createElement('span');
  label.className = 'chat-speaker';
  label.textContent = speaker === 'user' ? 'YOU' : 'AURA';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  message.append(label, paragraph);
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function findMentionedPart(text){
  const normalized = text.toLowerCase();
  const modelParts = AuraEngine.getParts();
  const exact = modelParts.slice().sort((left,right)=>right.name.length-left.name.length)
    .find(part=>normalized.includes(part.name.toLowerCase()));
  if (exact) return exact;
  const modelName = AuraEngine.getModelSummary().name;
  if (modelName === '90° V8 Engine'){
    const cylinderMatch = normalized.match(/\b(?:cylinder|piston|plug)\s*(?:number\s*)?([1-8])\b/);
    if (cylinderMatch){
      const number = Number(cylinderMatch[1]);
      const bank = number <= 4 ? 'L' : 'R';
      const bankCylinder = number <= 4 ? number : number - 4;
      const partName = /\b(plug|spark)\b/.test(normalized)
        ? 'V8 Spark Plug ' + bank + number
        : /\b(rod|connecting rod)\b/.test(normalized)
          ? 'V8 Rod ' + bank + number
          : 'V8 Piston ' + bank + number;
      const cylinderPart = AuraEngine.getPartInfo(partName);
      if (cylinderPart) return cylinderPart;
      return 'Cylinder ' + number + ' is in the ' + (number <= 4 ? 'left' : 'right') + ' bank, position ' + bankCylinder + ' from the front.';
    }
  }
  if (modelName === 'KTM Duke 349.32 cc DOHC'){
    const dukeAliases = [
      { terms:['coolant jacket','water jacket','cooling jacket'], name:'Duke Coolant Jacket' },
      { terms:['coolant hose','coolant loop','coolant'], name:'Duke Coolant Hoses' },
      { terms:['cylinder barrel','cylinder bore','barrel'], name:'Duke Cylinder Barrel' },
      { terms:['cylinder head','head'], name:'Duke DOHC Cylinder Head' },
      { terms:['valve cover','cam cover'], name:'Duke Valve Cover' },
      { terms:['valve train','valves','four valves'], name:'Duke Four-Valve Train' },
      { terms:['camshaft','cam shafts','cams','dohc'], name:'Duke DOHC Camshafts' },
      { terms:['connecting rod','con rod','rod'], name:'Duke Connecting Rod' },
      { terms:['crankshaft','crank'], name:'Duke Crankshaft' },
      { terms:['oil sump','oil pan','sump','oil'], name:'Duke Oil Sump' },
      { terms:['clutch','gearbox','six-speed','transmission'], name:'Duke Clutch and Gearbox' },
      { terms:['throttle body','intake','air path'], name:'Duke Throttle Body and Intake' },
      { terms:['exhaust header','exhaust','header'], name:'Duke Exhaust Header' },
      { terms:['spark plug','ignition'], name:'Duke Spark Plug' },
      { terms:['piston'], name:'Duke 89 mm Piston' },
      { terms:['crankcase','engine block','engine case'], name:'Duke Crankcase' },
      { terms:['radiator'], name:'Duke Radiator' },
    ];
    for (const alias of dukeAliases){
      if (alias.terms.some(term=>normalized.includes(term))){
        const match = AuraEngine.getPartInfo(alias.name);
        if (match) return match;
      }
    }
  }
  if (modelName === 'KTM 390 Duke'){
    const dukeAliases=[
      {terms:['front wheel','front tire'],name:'KTM 390 Front Wheel'},
      {terms:['rear wheel','rear tire'],name:'KTM 390 Rear Wheel'},
      {terms:['front fork','suspension fork','fork'],name:'KTM 390 WP Front Fork'},
      {terms:['rear shock','monoshock','shock'],name:'KTM 390 Rear Shock'},
      {terms:['fuel tank','tank'],name:'KTM 390 Fuel Tank and Shrouds'},
      {terms:['frame','trellis'],name:'KTM 390 Trellis Frame'},
      {terms:['brake','brembo','caliper'],name:'KTM 390 Brembo Brakes'},
      {terms:['chain','sprocket','final drive'],name:'KTM 390 Chain Final Drive'},
      {terms:['headlight','front light'],name:'KTM 390 LED Headlight'},
      {terms:['engine','motor','cylinder'],name:'KTM 390 LC4c Engine'},
    ];
    for(const alias of dukeAliases){
      if(alias.terms.some(term=>normalized.includes(term))){
        const match=AuraEngine.getPartInfo(alias.name);
        if(match) return match;
      }
    }
  }
  if (modelName === 'BMW M4 Coupe'){
    const bmwAliases=[
      {terms:['front left wheel','left front wheel'],name:'BMW M4 Front Left Wheel'},
      {terms:['front right wheel','right front wheel'],name:'BMW M4 Front Right Wheel'},
      {terms:['rear left wheel','left rear wheel'],name:'BMW M4 Rear Left Wheel'},
      {terms:['rear right wheel','right rear wheel'],name:'BMW M4 Rear Right Wheel'},
      {terms:['wheel','tire'],name:'BMW M4 Front Left Wheel'},
      {terms:['hood','bonnet'],name:'BMW M4 Bonnet'},
      {terms:['engine','inline six','powertrain'],name:'BMW M4 3.0L Inline-Six Engine'},
      {terms:['turbo','turbocharger'],name:'BMW M4 Twin Turbochargers'},
      {terms:['kidney grille','grille','front bumper'],name:'BMW M4 Kidney Grille and Front Bumper'},
      {terms:['brake','caliper','rotor'],name:'BMW M4 M Compound Brakes'},
      {terms:['interior','cabin','seat','steering'],name:'BMW M4 Cabin and Interior'},
      {terms:['exhaust','quad tip'],name:'BMW M4 Exhaust and Quad Tips'},
    ];
    for(const alias of bmwAliases){
      if(alias.terms.some(term=>normalized.includes(term))){
        const match=AuraEngine.getPartInfo(alias.name);
        if(match) return match;
      }
    }
  }
  const modelAliases = modelName === 'Single-Cylinder Piston'
    ? [
      { terms:['piston'], name:'Demo Piston' },
      { terms:['connecting rod','con rod','rod'], name:'Demo Connecting Rod' },
      { terms:['cylinder block','cylinder'], name:'Demo Cylinder Block' },
      { terms:['crankshaft','crank'], name:'Demo Crankshaft' },
    ]
    : modelName === 'Intermeshing Gear Pair'
      ? [
        { terms:['driven gear','output gear'], name:'Driven Gear' },
        { terms:['drive gear','input gear'], name:'Drive Gear' },
        { terms:['gear'], name:AuraEngine.getSelectedPart() || 'Drive Gear' },
      ]
      : modelName === 'Four-Bar Linkage'
        ? [
          { terms:['input crank','crank'], name:'Input Crank' },
          { terms:['coupler link','coupler'], name:'Coupler Link' },
          { terms:['output rocker','rocker'], name:'Output Rocker' },
          { terms:['frame','fixed pivots'], name:'Linkage Frame' },
        ]
        : modelName === 'Planetary Gear Train'
          ? [
            { terms:['ring gear','internal ring'], name:'Internal Ring Gear' },
            { terms:['sun gear','sun'], name:'Sun Gear' },
            { terms:['planet gear','planet'], name:AuraEngine.getSelectedPart() || 'Planet Gear 1' },
            { terms:['carrier'], name:'Planet Carrier' },
          ]
          : modelName === '90° V8 Engine'
            ? [
              { terms:['left bank','left head'], name:'Left Cylinder Head' },
              { terms:['right bank','right head'], name:'Right Cylinder Head' },
              { terms:['spark plug','ignition'], name:'V8 Ignition System' },
              { terms:['crankshaft','crank'], name:'V8 Crankshaft' },
              { terms:['piston'], name:'V8 Piston L1' },
              { terms:['connecting rod','con rod'], name:'V8 Rod L1' },
              { terms:['header','exhaust'], name:'Left Exhaust Headers' },
              { terms:['intake','manifold'], name:'V8 Intake Manifold' },
            ]
            : [];
  for (const alias of modelAliases){
    if (alias.terms.some(term=>normalized.includes(term))){
      const match = AuraEngine.getPartInfo(alias.name);
      if (match) return match;
    }
  }
  for (const alias of partAliases){
    if (alias.terms.some(term=>normalized.includes(term))){
      const match = AuraEngine.getPartInfo(alias.name);
      if (match) return match;
    }
  }
  if (/\b(it|that part|this part)\b/.test(normalized)){
    const selectedName = AuraEngine.getSelectedPart();
    return selectedName ? AuraEngine.getPartInfo(selectedName) : null;
  }
  return null;
}
function executeViewerCommands(text, part){
  const normalized = text.toLowerCase();
  const actions = [];
  if (/\b(explode|explode view|open up)\b/.test(normalized)){
    AuraEngine.setExplode(true);
    actions.push('Exploded view is on.');
  } else if (/\b(assemble|close up|put together)\b/.test(normalized)){
    AuraEngine.setExplode(false);
    actions.push('Exploded view is off.');
  }
  if (/\b(cross section|cutaway|cut away)\b/.test(normalized)){
    AuraEngine.setCross(true);
    actions.push('Cross-section view is on.');
  } else if (/\b(solid view|solid model)\b/.test(normalized)){
    AuraEngine.setCross(false);
    actions.push('Cross-section view is off.');
  }
  if (/\b(stop engine|stop simulation|stop the engine)\b/.test(normalized)){
    AuraEngine.setSimulation(false);
    actions.push('Engine simulation stopped.');
  } else if (/\b(start engine|run engine|start simulation|run simulation|start the engine)\b/.test(normalized)){
    AuraEngine.setSimulation(true);
    actions.push('Engine simulation started.');
  }
  if (/\b(reset focus|show all|deselect|clear focus)\b/.test(normalized)){
    AuraEngine.resetFocus();
    actions.push('Showing all engine components.');
  } else if (part && /\b(focus|select|highlight|inspect|zoom to|show)\b/.test(normalized)){
    AuraEngine.focusPart(part.name);
    actions.push('Focused ' + part.name + ' in the viewer.');
  }
  return actions;
}
function buildModelAnswer(text, part, actions){
  const normalized = text.toLowerCase();
  const modelSummary = AuraEngine.getModelSummary();
  const modelParts = AuraEngine.getParts();
  if (actions.length) return actions.join(' ');
  if (/\b(power flow|air flow|airflow|how does .*engine work|how .*engine works)\b/.test(normalized)){
    if (modelSummary.name === 'Intermeshing Gear Pair') return 'The drive gear turns the meshing driven gear in the opposite direction, transferring rotary motion and torque through their teeth.';
    if (modelSummary.name === 'Single-Cylinder Piston') return 'Combustion pushes the piston down the cylinder. The connecting rod transfers that motion to the crankshaft, which converts it into rotation.';
    if (modelSummary.name === 'Four-Bar Linkage') return 'The input crank rotates about a fixed pivot. The coupler transfers that motion to the output rocker, which oscillates around the second fixed pivot.';
    if (modelSummary.name === 'Planetary Gear Train') return 'The sun gear meshes with three planet gears. The planets also mesh with the fixed internal ring while the carrier supports and moves their axles around the center.';
    if (modelSummary.name === '90° V8 Engine') return 'The V8 uses two banks of four cylinders. Each combustion stroke drives a piston and connecting rod against the cross-plane crankshaft; the intake runners distribute air and the headers carry exhaust away.';
    if (modelSummary.name === 'KTM Duke 349.32 cc DOHC') return 'The throttle body meters air into the single cylinder. The piston compresses the mixture; combustion drives the connecting rod and crankshaft. Dual overhead cams operate two intake and two exhaust valves. Coolant carries heat from the cylinder jacket to the radiator.';
    if (modelSummary.name === 'KTM 390 Duke') return 'The throttle body feeds the single-cylinder engine. Combustion drives the piston, crankshaft, wet clutch, gearbox, chain, and rear wheel; the liquid-cooling loop carries heat to the radiator.';
    if (modelSummary.name === 'BMW M4 Coupe') return 'The twin-turbo inline-six sends torque through the transmission and rear-biased drivetrain to the wheels. The cooling pack manages engine heat, while the brakes and suspension control speed and body motion.';
    return 'Air is compressed by the twin turbochargers, carried through the charge piping to the intake, and drawn into the six cylinders. Combustion drives the pistons and crankshaft; exhaust gas then powers the turbochargers.';
  }
  if (/\b(what is|what are|describe|tell me about|how many|overview|specifications|specs|what model|displacement|cc)\b/.test(normalized) && (/\b(model|engine|cylinder|turbo|assembly|linkage|mechanism|gear train|planetary|v8|ktm|duke|cc|349)\b/.test(normalized) || /\bhow many\b/.test(normalized))){
    if (modelSummary.vehicleType === 'motorcycle') return 'KTM 390 Duke interactive visual: a street motorcycle with a single-cylinder engine, trellis frame, suspension, disc brakes, chain drive, fuel tank, and LED lighting. Major assemblies can be isolated in the Viewer.';
    if (modelSummary.vehicleType === 'car') return 'BMW M4 Coupe interactive visual: a two-door performance coupe with a twin-turbo inline-six, four wheels and brakes, cabin, body panels, lighting, drivetrain, and exhaust. Open the hood control to inspect the engine bay.';
    if (modelSummary.name === 'KTM Duke 349.32 cc DOHC') return 'KTM Duke engine demo: 349.32 cc single-cylinder, liquid-cooled, DOHC with four valves. It includes a slider-crank, clutch and six-speed gearbox, throttle body, exhaust header, radiator, and coolant loop.';
    if (modelSummary.name === '90° V8 Engine'){
      return 'The 90° V8 has eight cylinders in two banks of four, overhead camshafts, and a cross-plane crankshaft. Firing order: 1-8-4-3-6-5-7-2. Each cylinder has a separately selectable piston, rod, and spark plug.';
    }
    const turboDetails = modelSummary.turbochargers
      ? ' with ' + modelSummary.turbochargers + ' turbochargers'
      : '';
    const engineLabel = modelSummary.cylinders === 1 ? '1-cylinder' : modelSummary.cylinders + '-cylinder';
    if (modelSummary.cylinders) return modelSummary.name + ' is a ' + engineLabel + ' engine' + turboDetails + '. ' + modelSummary.description;
    return modelSummary.name + ' is a ' + modelSummary.cylinders + '-cylinder engine with ' + modelSummary.turbochargers + ' turbochargers. ' + modelSummary.description;
  }
  if (part){
    if (/\b(material|made of|made from|composition)\b/.test(normalized)){
      return part.name + ' uses ' + part.material + '. ' + part.function + '.';
    }
    if (/\b(parts|components|include|inside)\b/.test(normalized) && /\b(engine|model|assembly)\b/.test(normalized)){
      return 'The model includes ' + modelParts.map(item=>item.name).join(', ') + ', plus the internal crankshaft, pistons, and connecting rods.';
    }
    return part.name + ': ' + part.function + '. Its listed material is ' + part.material + '.';
  }
  const internal = internalFacts.find(fact=>fact.terms.some(term=>normalized.includes(term)));
  if (internal) return internal.answer;
  if (/\b(model|engine|cylinder|turbo|assembly)\b/.test(normalized)){
    return modelSummary.name + ' is a ' + modelSummary.cylinders + '-cylinder engine with ' + modelSummary.turbochargers + ' turbochargers. ' + modelSummary.description;
  }
  if (/\b(hello|hi|hey)\b/.test(normalized)){
    return 'Hi. Ask me what a model part does, what it is made from, or use a command such as “focus turbo” or “start engine”.';
  }
  return 'I can answer from the current model data. Ask about ' + modelParts.map(item=>item.name).join(', ') + ', or ask about the crankshaft, pistons, connecting rods, or engine power flow.';
}
function runCommand(text){
  const prompt = text.trim();
  if (!prompt) return;
  addChatMessage(prompt, 'user');
  const part = findMentionedPart(prompt);
  const actions = executeViewerCommands(prompt, part);
  const answer = buildModelAnswer(prompt, part, actions);
  addChatMessage(answer, 'assistant');
  speak(answer);
}

document.getElementById('cmd-form').addEventListener('submit', event=>{
  event.preventDefault();
  const prompt = commandInput.value;
  if (!prompt.trim()) return;
  runCommand(prompt);
  voiceTextEl.textContent = '"' + prompt.trim() + '"';
  commandInput.value = '';
  commandInput.focus();
});

const wave = document.getElementById('wave');
for(let i=0;i<26;i++){
  const bar = document.createElement('span');
  bar.style.height = '4px';
  wave.appendChild(bar);
}
