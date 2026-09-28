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
    return 'Air is compressed by the twin turbochargers, carried through the charge piping to the intake, and drawn into the six cylinders. Combustion drives the pistons and crankshaft; exhaust gas then powers the turbochargers.';
  }
  if (/\b(what is|describe|tell me about|how many|overview|specifications|what model)\b/.test(normalized) && /\b(model|engine|cylinder|turbo|assembly)\b/.test(normalized)){
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