const starterModels = window.AuraModels;
// ================= Demo session and workspace entry =================
const loginDialog = document.getElementById('login-dialog');
const authAction = document.getElementById('auth-action');
const sessionLabel = document.getElementById('session-label');
const demoRoleInput = document.getElementById('demo-role');
let isAuthenticated = false;
let activeRole = 'student';

function openDemoLogin(){
  demoRoleInput.value = activeRole;
  updateLoginSubmitLabel();
  if (!loginDialog.open) loginDialog.showModal();
}
function enterWorkspace(authenticated, role=activeRole){
  isAuthenticated = authenticated;
  activeRole = role;
  document.body.classList.add('workspace-active');
  sessionLabel.textContent = authenticated ? 'DEMO SESSION' : 'DEMO ACCESS';
  authAction.textContent = authenticated ? 'Log out' : 'Sign in';
  updateRoleDashboard();
  updateProfileDisplay();
  AuraEngine.setDrawer(false);
  switchWorkspaceView('dashboard');
}
function signOut(){
  isAuthenticated = false;
  AuraEngine.setSimulation(false);
  AuraEngine.setExplode(false);
  AuraEngine.setCross(false);
  AuraEngine.resetFocus();
  AuraEngine.setDrawer(false);
  document.body.classList.remove('view-viewer');
  document.body.classList.remove('workspace-active');
  sessionLabel.textContent = 'DEMO ACCESS';
  authAction.textContent = 'Sign in';
}

document.getElementById('launch-demo').addEventListener('click', ()=> enterWorkspace(false, 'student'));
document.getElementById('landing-login').addEventListener('click', openDemoLogin);
authAction.addEventListener('click', ()=> isAuthenticated ? signOut() : openDemoLogin());
document.getElementById('login-close').addEventListener('click', ()=> loginDialog.close());
loginDialog.addEventListener('click', e=>{ if (e.target === loginDialog) loginDialog.close(); });
document.getElementById('demo-login-form').addEventListener('submit', e=>{
  e.preventDefault();
  loginDialog.close();
  enterWorkspace(true, demoRoleInput.value);
});

// ================= Workspace pages and local demo data =================

const modelFavorites = new Set(readStored('aura.modelFavorites', []));
const localUploads = [];
let libraryFilter = 'all';
let workspaceSearch = '';
let profileName = readStored('aura.profileName', 'Engineering Student');
let modelViewCount = 4;
let selectedModel = starterModels[0];

function readStored(key, fallback){
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch(error){ return fallback; }
}
function writeStored(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(error){}
}
function updateProfileDisplay(){
  const initial = (profileName.trim()[0] || 'E').toUpperCase();
  document.getElementById('sidebar-name').textContent = profileName;
  document.getElementById('dashboard-greeting').textContent = profileName;
  document.getElementById('profile-display-name').textContent = profileName;
  document.getElementById('sidebar-role').textContent = roleNames[activeRole] + ' · Demo';
  document.getElementById('profile-role').textContent = roleNames[activeRole] + ' · Demo profile';
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('toolbar-profile').textContent = initial;
}
function updateWorkspaceStats(){
  document.getElementById('profile-model-total').textContent = (starterModels.length + localUploads.length) + ' models';
  document.getElementById('profile-favorite-total').textContent = modelFavorites.size + ' favorites';
  updateRoleDashboard();
}
const roleNames = { student:'Student', mentor:'Mentor', admin:'Admin' };
function updateLoginSubmitLabel(){
  document.getElementById('demo-submit').textContent = 'Open ' + roleNames[demoRoleInput.value] + ' dashboard';
}
demoRoleInput.addEventListener('change', updateLoginSubmitLabel);
function updateRoleDashboard(){
  const roles = {
    student:{ values:[starterModels.length + localUploads.length,modelViewCount,'0%',modelFavorites.size], labels:['My models','Total views','Learning progress','Favorites'], intro:'Continue your engineering learning journey.', action:'↑  Upload model', destination:'upload' },
    mentor:{ values:['18','6','12','3'], labels:['Learners','Reviews pending','Active assignments','Overdue'], intro:'Review learner work and keep engineering projects moving.', action:'Review models', destination:'library' },
    admin:{ values:['128','42','7','99.8%'], labels:['Demo accounts','Models listed','Pending review','Service uptime'], intro:'Monitor the engineering workspace and demo platform activity.', action:'Manage models', destination:'library' },
  };
  const config = roles[activeRole] || roles.student;
  document.querySelectorAll('.role-dashboard').forEach(panel=>{ panel.hidden = panel.dataset.dashboardRole !== activeRole; });
  document.getElementById('dashboard-role-label').textContent = '✦  ' + roleNames[activeRole] + ' workspace';
  document.getElementById('dashboard-intro').textContent = config.intro;
  const primaryAction = document.getElementById('dashboard-primary-action');
  primaryAction.dataset.go = config.destination;
  primaryAction.textContent = config.action;
  ['models','views','progress','favorites'].forEach((key,index)=>{
    document.getElementById('stat-' + key).textContent = config.values[index];
    document.getElementById('stat-' + key + '-label').textContent = config.labels[index];
  });
}
function createModelCard(model){
  const card = document.createElement('article');
  card.className = 'model-card';

  const thumb = document.createElement('div');
  thumb.className = 'model-thumb';
  thumb.dataset.tone = model.tone;
  const type = document.createElement('span');
  type.className = 'thumb-type';
  type.textContent = model.category === 'assembly' ? 'Starter assembly' : 'Component preset';
  const name = document.createElement('strong');
  name.textContent = model.name;
  thumb.append(type, name);

  const body = document.createElement('div');
  body.className = 'model-card-body';
  const description = document.createElement('p');
  description.textContent = model.description;
  const meta = document.createElement('div');
  meta.className = 'model-card-meta';
  const detail = document.createElement('span');
  detail.textContent = model.components + (model.components === 1 ? ' focused component' : ' components');
  const open = document.createElement('button');
  open.className = 'model-open';
  open.type = 'button';
  open.dataset.openModel = model.id;
  open.textContent = 'Open viewer';
  meta.append(detail, open);

  const footer = document.createElement('div');
  footer.className = 'model-card-footer';
  const status = document.createElement('span');
  status.textContent = 'Ready to explore';
  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.dataset.favoriteModel = model.id;
  favorite.setAttribute('aria-label', (modelFavorites.has(model.id) ? 'Remove from' : 'Add to') + ' favorites: ' + model.name);
  favorite.setAttribute('aria-pressed', modelFavorites.has(model.id));
  favorite.textContent = modelFavorites.has(model.id) ? '★' : '☆';
  footer.append(status, favorite);
  body.append(description, meta, footer);
  card.append(thumb, body);
  return card;
}
function renderDashboardModels(){
  const recent = document.getElementById('dashboard-models');
  recent.replaceChildren(...starterModels.slice(0,2).map(createModelCard));
}
function renderLibrary(){
  const grid = document.getElementById('library-grid');
  const query = workspaceSearch.trim().toLowerCase();
  const models = starterModels.filter(model=>{
    const matchesFilter = libraryFilter === 'all' ||
      (libraryFilter === 'favorites' ? modelFavorites.has(model.id) : model.category === libraryFilter);
    const matchesSearch = !query || (model.name + ' ' + model.description).toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });
  if (!models.length){
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = libraryFilter === 'favorites' ? 'No favorites yet. Star a model to save it here.' : 'No models match this search.';
    grid.replaceChildren(empty);
  } else {
    grid.replaceChildren(...models.map(createModelCard));
  }
  document.getElementById('library-count').textContent = models.length + (models.length === 1 ? ' model' : ' models');
}
function switchWorkspaceView(view){
  const page = document.querySelector('.workspace-page[data-page="' + view + '"]');
  if (!page) return;
  document.querySelectorAll('.workspace-page').forEach(item=>item.classList.toggle('active', item === page));
  document.querySelectorAll('.nav-link').forEach(button=>{
    if (button.dataset.view === view) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  document.body.classList.toggle('view-viewer', view === 'viewer');
  document.getElementById('toolbar-view-name').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  document.getElementById('workspace-main').scrollTop = 0;
  AuraEngine.setDrawer(false);
  if (view === 'library') renderLibrary();
  if (view === 'viewer') AuraEngine.resize();
}
function openModel(modelId){
  const model = starterModels.find(item=>item.id === modelId);
  if (!model) return;
  selectedModel = model;
  AuraEngine.setLibraryModel(model.id);
  const hoodToggle = document.getElementById('bmw-hood-toggle');
  hoodToggle.hidden = model.id !== 'bmw-m4';
  hoodToggle.textContent = 'Open hood';
  document.getElementById('view-viewer').dataset.modelId = model.id;
  modelViewCount += 1;
  document.getElementById('viewer-model-name').textContent = model.name;
  document.getElementById('viewer-model-description').textContent = model.description + ' · select a part to isolate it';
  if (model.focusPart) AuraEngine.focusPart(model.focusPart);
  else AuraEngine.resetFocus();
  updateWorkspaceStats();
  switchWorkspaceView('viewer');
}
function toggleFavorite(modelId){
  if (modelFavorites.has(modelId)) modelFavorites.delete(modelId);
  else modelFavorites.add(modelId);
  writeStored('aura.modelFavorites', Array.from(modelFavorites));
  renderDashboardModels();
  if (document.getElementById('view-library').classList.contains('active')) renderLibrary();
  updateWorkspaceStats();
}

document.querySelectorAll('.nav-link').forEach(button=>button.addEventListener('click', ()=>switchWorkspaceView(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click', ()=>switchWorkspaceView(button.dataset.go)));
document.getElementById('toolbar-profile').addEventListener('click', ()=>switchWorkspaceView('profile'));
document.getElementById('workspace-signout').addEventListener('click', signOut);
document.getElementById('viewer-controls-toggle').addEventListener('click', ()=>AuraEngine.setDrawer(!drawer.classList.contains('open')));
document.getElementById('bmw-hood-toggle').addEventListener('click', event=>{
  const open = AuraEngine.toggleVehicleHood();
  event.currentTarget.textContent = open ? 'Close hood' : 'Open hood';
});
[document.getElementById('dashboard-models'),document.getElementById('library-grid')].forEach(grid=>grid.addEventListener('click', event=>{
  const openButton = event.target.closest('[data-open-model]');
  const favoriteButton = event.target.closest('[data-favorite-model]');
  if (openButton){
    openModel(openButton.dataset.openModel);
  } else if (!favoriteButton){
    const card = event.target.closest('.model-card');
    const cardOpenButton = card && card.querySelector('[data-open-model]');
    if (cardOpenButton) openModel(cardOpenButton.dataset.openModel);
  }
  if (favoriteButton) toggleFavorite(favoriteButton.dataset.favoriteModel);
}));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click', ()=>{
  libraryFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(filter=>filter.setAttribute('aria-pressed', filter === button));
  renderLibrary();
}));
const workspaceSearchInput = document.getElementById('workspace-search');
workspaceSearchInput.addEventListener('input', ()=>{
  workspaceSearch = workspaceSearchInput.value;
  if (document.getElementById('view-library').classList.contains('active')) renderLibrary();
});
workspaceSearchInput.addEventListener('keydown', event=>{
  if (event.key === 'Enter') switchWorkspaceView('library');
});

const uploadDropzone = document.getElementById('upload-dropzone');
const modelFileInput = document.getElementById('model-file-input');
function formatFileSize(bytes){
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function queueModelFiles(fileList){
  const allowed = new Set(['glb','gltf','obj','stl']);
  const accepted = [];
  let rejected = 0;
  Array.from(fileList).forEach(file=>{
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowed.has(extension) || file.size > 50 * 1024 * 1024){ rejected += 1; return; }
    localUploads.push({ id:'upload-' + Date.now() + '-' + Math.random().toString(36).slice(2,7), name:file.name, extension, size:file.size });
    accepted.push(file.name);
  });
  document.getElementById('upload-feedback').textContent = accepted.length
    ? accepted.length + ' file' + (accepted.length === 1 ? '' : 's') + ' added to this browser session.' + (rejected ? ' ' + rejected + ' rejected.' : '')
    : (rejected ? 'Only GLB, GLTF, OBJ, or STL files under 50 MB are accepted.' : 'Choose a model file to add it to this session.');
  renderUploadList();
  updateWorkspaceStats();
}
function renderUploadList(){
  const list = document.getElementById('upload-list');
  list.replaceChildren();
  localUploads.forEach(file=>{
    const row = document.createElement('div');
    row.className = 'upload-item';
    const mark = document.createElement('span');
    mark.className = 'file-mark';
    mark.textContent = file.extension.toUpperCase();
    const detail = document.createElement('span');
    const fileName = document.createElement('strong');
    fileName.textContent = file.name;
    const fileInfo = document.createElement('small');
    fileInfo.textContent = formatFileSize(file.size) + ' · queued locally';
    detail.append(fileName, fileInfo);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label','Remove ' + file.name);
    remove.textContent = '×';
    remove.addEventListener('click', ()=>{
      const index = localUploads.findIndex(item=>item.id === file.id);
      if (index >= 0) localUploads.splice(index,1);
      renderUploadList();
      updateWorkspaceStats();
    });
    row.append(mark, detail, remove);
    list.appendChild(row);
  });
}
document.getElementById('choose-models').addEventListener('click', ()=>modelFileInput.click());
uploadDropzone.addEventListener('click', event=>{ if (!event.target.closest('button')) modelFileInput.click(); });
uploadDropzone.addEventListener('keydown', event=>{
  if (event.key === 'Enter' || event.key === ' '){ event.preventDefault(); modelFileInput.click(); }
});
modelFileInput.addEventListener('change', ()=>{ queueModelFiles(modelFileInput.files); modelFileInput.value = ''; });
uploadDropzone.addEventListener('dragover', event=>{ event.preventDefault(); uploadDropzone.classList.add('drag-over'); });
uploadDropzone.addEventListener('dragleave', event=>{ if (!uploadDropzone.contains(event.relatedTarget)) uploadDropzone.classList.remove('drag-over'); });
uploadDropzone.addEventListener('drop', event=>{
  event.preventDefault();
  uploadDropzone.classList.remove('drag-over');
  queueModelFiles(event.dataTransfer.files);
});

document.getElementById('profile-form').addEventListener('submit', event=>{
  event.preventDefault();
  const value = document.getElementById('profile-name-input').value.trim();
  if (!value){
    document.getElementById('profile-feedback').textContent = 'Enter a display name before saving.';
    return;
  }
  profileName = value;
  writeStored('aura.profileName', profileName);
  updateProfileDisplay();
  document.getElementById('profile-feedback').textContent = 'Profile saved on this device.';
});
document.getElementById('profile-signout').addEventListener('click', signOut);
document.getElementById('profile-name-input').value = profileName;
updateProfileDisplay();
renderDashboardModels();
renderLibrary();
updateWorkspaceStats();

const sharedParams = new URLSearchParams(window.location.search);
const legacySharedParams = new URLSearchParams(window.location.hash.slice(1));
const sharedModelId = sharedParams.get('model') || legacySharedParams.get('model');
if (sharedModelId && starterModels.some(model=>model.id === sharedModelId)){
  enterWorkspace(false);
  openModel(sharedModelId);
  if (sharedParams.get('ar') === '1' || legacySharedParams.get('ar') === '1'){
    const arStatus = document.getElementById('ar-session-status');
    arStatus.hidden = false;
    arStatus.textContent = 'Model ready. Tap Start AR placement, then point at a surface and tap to place it.';
    document.getElementById('ar-model-button').focus({ preventScroll:true });
  }
}

