const STORAGE_KEY = 'image-converter:options';
function loadOptions(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))}catch{return null}}
function saveOptions(opts){localStorage.setItem(STORAGE_KEY,JSON.stringify(opts))}

export function initUI({onFiles}){
  const sizeEl=document.getElementById('size');
  const typeEl=document.getElementById('filetype');
  const qualityEl=document.getElementById('quality');
  const concurrencyEl=document.getElementById('concurrency');

  // NEW prefix/suffix fields
  const prefixEl=document.getElementById('prefix');
  const suffixEl=document.getElementById('suffix');

  const dropzone=document.getElementById('dropzone');
  const fileInput=document.getElementById('fileInput');
  const selectBtn=document.getElementById('selectBtn');
  const clearBtn=document.getElementById('clearBtn');
  const queueEl=document.getElementById('queue');
  const statusEl=document.getElementById('status');
  const saved=loadOptions();
  if(saved){
    sizeEl.value=saved.size||1200;
    typeEl.value=saved.type||'image/jpeg';
    qualityEl.value=saved.quality||0.8;
    concurrencyEl.value=saved.concurrency||3;
    prefixEl.value=saved.prefix||'';
    suffixEl.value=saved.suffix||'';
  }

  function currentOptions(){
    return{
      size:Number(sizeEl.value)||1200,
      type:typeEl.value,
      quality:Number(qualityEl.value)||0.8,
      concurrency:Number(concurrencyEl.value)||3,
      prefix:prefixEl.value||'',
      suffix:suffixEl.value||''
    }
  }

  // Save whenever anything changes
  [sizeEl,typeEl,qualityEl,concurrencyEl,prefixEl,suffixEl]
    .forEach(el=>el.addEventListener('change',()=>saveOptions(currentOptions())));

  dropzone.addEventListener('dragover',e=>{e.preventDefault();dropzone.classList.add('dragover')});
  dropzone.addEventListener('dragleave',()=>dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop',e=>{
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if(e.dataTransfer.files.length)onFiles(e.dataTransfer.files,currentOptions())
  });
  selectBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',e=>{
    if(e.target.files.length)onFiles(e.target.files,currentOptions());
    fileInput.value=''
  });
  clearBtn.addEventListener('click',()=>{
    if(window.__IMG_CONVERTER?.clearQueue)window.__IMG_CONVERTER.clearQueue()
  });
  window.__IMG_CONVERTER={...(window.__IMG_CONVERTER||{}),queueEl,statusEl,getOptions:currentOptions,saveOptions}
}
