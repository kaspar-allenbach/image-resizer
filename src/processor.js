import {
    psdToCanvas
} from './psd-handler.js';
import {
    saveAs
} from 'file-saver';

const queue = [];
let running = 0;

function createQueueItem(file, options) {
    return {
        id: Date.now() + Math.random(),
        file,
        options,
        status: 'queued'
    }
}
export function addFilesToQueue(files, options) {
    const qEl = window.__IMG_CONVERTER.queueEl;
    for (const file of files) {
        const item = createQueueItem(file, options);
        queue.push(item);
        renderQueueItem(item)
    };
    updateStatus()
}
export function clearQueue() {
    queue.length = 0;
    running = 0;
    window.__IMG_CONVERTER.queueEl.innerHTML = '';
    updateStatus()
}
window.__IMG_CONVERTER = {
    ...(window.__IMG_CONVERTER || {}),
    clearQueue
};

function updateStatus() {
    const s = window.__IMG_CONVERTER.statusEl;
    const q = queue.filter(i => i.status === 'queued').length;
    const p = queue.filter(i => i.status === 'processing').length;
    s.textContent = `Queued: ${q} • Processing: ${p}`
}

function renderQueueItem(item) {
    const div = document.createElement('div');
    div.className = 'item';
    div.id = 'item-' + item.id;
    div.innerHTML = `<div class="meta"><strong>${item.file.name}</strong> • ${Math.round(item.file.size/1024)} KB</div><div class="actions"><div class="progress"><i></i></div><button class="secondary">Remove</button></div>`;
    const btn = div.querySelector('button');
    btn.onclick = () => {
        const idx = queue.findIndex(q => q.id === item.id);
        if (idx >= 0 && queue[idx].status === 'queued') {
            queue.splice(idx, 1);
            div.remove();
            updateStatus()
        }
    };
    window.__IMG_CONVERTER.queueEl.appendChild(div);
    item._el = div;
    item._progressBar = div.querySelector('i')
}
async function canvasFromFile(file) {
    if (file.name.toLowerCase().endsWith('.psd')) return await psdToCanvas(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return c
}

function scaleCanvas(c, max) {
    if (Math.max(c.width, c.height) <= max) return c;
    const r = max / Math.max(c.width, c.height);
    const out = document.createElement('canvas');
    out.width = c.width * r;
    out.height = c.height * r;
    out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
    return out
}
async function exportCanvasToBlob(c, t, q) {
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej('toBlob failed'), t, q))
}
async function processItem(it) {
    it.status = 'processing';
    const pb = it._progressBar;
    try {
        pb.style.width = '20%';
        const src = await canvasFromFile(it.file);
        pb.style.width = '50%';
        const resized = scaleCanvas(src, it.options.size);
        pb.style.width = '80%';
        const blob = await exportCanvasToBlob(resized, it.options.type, it.options.quality);

        // NEW: build filename with prefix/suffix
        const baseName = it.file.name.replace(/\.[^.]+$/, '');
        const ext = it.options.type.split('/')[1] || 'png';
        const finalName = (it.options.prefix||'') + baseName + (it.options.suffix||'') + '.' + ext;

        saveAs(blob, finalName);

        pb.style.width = '100%';
        it.status = 'done';
        setTimeout(() => it._el.remove(), 1500)
    } catch (e) {
        console.error(e);
        it.status = 'error';
        it._el.querySelector('.meta').innerHTML += '<div style="color:red">Error</div>'
    } finally {
        updateStatus()
    }
}
export async function processQueue() {
    const c = window.__IMG_CONVERTER.getOptions().concurrency || 3;
    if (running >= c) return;
    while (running < c) {
        const n = queue.find(i => i.status === 'queued');
        if (!n) break;
        running++;
        processItem(n).finally(() => {
            running--;
            processQueue()
        })
    }
}
