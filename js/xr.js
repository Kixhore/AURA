const shareDialog = document.getElementById('share-model-dialog');
const shareUrlInput = document.getElementById('share-model-url');
const shareStatus = document.getElementById('share-model-status');
const qrContainer = document.getElementById('model-qr-code');
const arButton = document.getElementById('ar-model-button');
const arStatus = document.getElementById('ar-session-status');
let qrCode = null;

function getReachableBaseUrl(){
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return '';
  const base = new URL(window.location.href);
  base.hash = '';
  base.search = '';
  return base.toString();
}

function renderModelQr(){
  const enteredUrl = shareUrlInput.value.trim();
  qrContainer.replaceChildren();
  qrCode = null;

  let modelUrl;
  try {
    modelUrl = new URL(enteredUrl);
  } catch(error){
    shareStatus.textContent = 'Enter a valid web address to create a QR code.';
    shareStatus.classList.add('error');
    return;
  }
  if (modelUrl.protocol !== 'http:' && modelUrl.protocol !== 'https:'){
    shareStatus.textContent = 'Use an HTTP or HTTPS web address. Local file links do not work on a phone.';
    shareStatus.classList.add('error');
    return;
  }
  if (modelUrl.hostname === 'localhost' || modelUrl.hostname === '127.0.0.1'){
    shareStatus.textContent = 'Replace localhost with this computer’s network address. For WebXR, use an HTTPS address on the phone.';
    shareStatus.classList.add('error');
    return;
  }

  const modelId = document.getElementById('view-viewer').dataset.modelId || 'inline-six';
  modelUrl.hash = 'model=' + encodeURIComponent(modelId);
  if (typeof QRCode !== 'function'){
    shareStatus.textContent = 'QR generator did not load. Check your internet connection and try again.';
    shareStatus.classList.add('error');
    return;
  }
  qrCode = new QRCode(qrContainer, {
    text:modelUrl.toString(),
    width:192,
    height:192,
    colorDark:'#10191b',
    colorLight:'#ffffff',
    correctLevel:QRCode.CorrectLevel.M,
  });
  shareStatus.textContent = 'QR ready for ' + document.getElementById('viewer-model-name').textContent + '. The phone must be able to reach this address.';
  shareStatus.classList.remove('error');
}

function openModelShare(){
  const baseUrl = getReachableBaseUrl();
  shareUrlInput.value = baseUrl;
  if (!shareDialog.open) shareDialog.showModal();
  if (baseUrl) renderModelQr();
  else {
    qrContainer.replaceChildren();
    shareStatus.textContent = 'This page is opened as a local file. Serve it from a network-reachable web address, then enter that address here.';
    shareStatus.classList.remove('error');
  }
}

document.getElementById('share-model-button').addEventListener('click', openModelShare);
document.getElementById('share-model-generate').addEventListener('click', renderModelQr);
shareUrlInput.addEventListener('keydown', event=>{
  if (event.key === 'Enter'){
    event.preventDefault();
    renderModelQr();
  }
});
document.getElementById('share-model-close').addEventListener('click', ()=>shareDialog.close());
shareDialog.addEventListener('click', event=>{ if (event.target === shareDialog) shareDialog.close(); });

document.getElementById('ar-model-button').addEventListener('click', async ()=>{
  if (window.AuraEngine.isARPresenting()){
    await window.AuraEngine.endAR();
    return;
  }
  arButton.disabled = true;
  arButton.textContent = 'Starting AR…';
  try {
    await window.AuraEngine.startAR();
  } catch(error){
    arStatus.hidden = false;
    arStatus.textContent = error.message || 'Unable to start an AR session on this device.';
    window.setTimeout(()=>{ if (!window.AuraEngine.isARPresenting()) arStatus.hidden = true; }, 6000);
  } finally {
    arButton.disabled = false;
    arButton.innerHTML = window.AuraEngine.isARPresenting() ? '× &nbsp; Exit AR' : '⌖ &nbsp; View in AR';
  }
});
window.addEventListener('aura-xr-status', event=>{
  const active = event.detail.active;
  arStatus.hidden = !active;
  arStatus.textContent = active ? 'Move your phone to find a surface, then tap to place the model.' : '';
  arButton.innerHTML = active ? '× &nbsp; Exit AR' : '⌖ &nbsp; View in AR';
});

if (window.location.protocol === 'file:'){
  arButton.title = 'Open this app on your phone through a secure web address to use WebXR.';
}
