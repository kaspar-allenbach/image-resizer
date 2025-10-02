import { psdToCanvas } from './psd-handler.js';
import { saveAs } from 'file-saver';
import * as UTIF from 'utif';

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
function cropCanvasToAspectRatio(c, aspect, position = 'center') {
  if (!aspect || !aspect.w || !aspect.h) return c;

  const targetRatio = aspect.w / aspect.h;
  const currentRatio = c.width / c.height;

  // If already effectively equal, skip
  if (Math.abs(currentRatio - targetRatio) < 1e-6) return c;

  let sx = 0, sy = 0, sw = c.width, sh = c.height;

  if (currentRatio > targetRatio) {
    // Image too wide → crop width
    sw = Math.round(c.height * targetRatio);
    if (position.includes('left')) {
      sx = 0;
    } else if (position.includes('right')) {
      sx = c.width - sw;
    } else {
      sx = Math.round((c.width - sw) / 2);
    }
  } else {
    // Image too tall → crop height
    sh = Math.round(c.width / targetRatio);
    if (position.includes('top')) {
      sy = 0;
    } else if (position.includes('bottom')) {
      sy = c.height - sh;
    } else {
      sy = Math.round((c.height - sh) / 2);
    }
  }

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext('2d');
  ctx.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
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
    const name = file.name.toLowerCase();

    if (name.endsWith('.psd')) {
        return await psdToCanvas(file, options.aspectRatio, options.cropPosition);
    }


    if (name.endsWith('.tif') || name.endsWith('.tiff')) {
        const buf = await file.arrayBuffer();
        const ifds = UTIF.decode(buf);

        if (!ifds.length) throw new Error("No IFDs found in TIFF");

        const first = ifds[0];

        // Required: actually decode the image first
        UTIF.decodeImage(buf, first);

        // Extract pixel buffer (RGBA8)
        const rgba = UTIF.toRGBA8(first);

        // Width/height from tags
        const width = first.width || first.t256;
        const height = first.height || first.t257;

        if (!width || !height) {
            throw new Error("Invalid TIFF: missing dimensions");
        }

        // Draw onto canvas
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);

        return c;
    }


    // fallback: jpg/png/webp/avif
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return c;
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
    let src = await canvasFromFile(it.file);

    // 🔹 Apply aspect ratio crop first (if provided)
    if (it.options.aspectRatio) {
      src = cropCanvasToAspectRatio(src, it.options.aspectRatio, it.options.cropPosition);
    }

    pb.style.width = '50%';
    const resized = scaleCanvas(src, it.options.size);

    pb.style.width = '80%';
    const blob = await exportCanvasToBlob(resized, it.options.type, it.options.quality);

    // Filename with prefix/suffix
    const baseName = it.file.name.replace(/\.[^.]+$/, '');

    // Get original extension
    const originalExt = it.file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
    let ext = it.options.type.split('/')[1] || 'png';

    // For JPEG files, preserve original extension (.jpg vs .jpeg)
    if (ext === 'jpeg' && (originalExt === 'jpg' || originalExt === 'jpeg')) {
        ext = originalExt;
    }

    const finalName = (it.options.prefix || '') + baseName + (it.options.suffix || '') + '.' + ext;

    saveAs(blob, finalName);

    pb.style.width = '100%';
    it.status = 'done';
    setTimeout(() => it._el.remove(), 1500);
  } catch (e) {
    console.error(e);
    it.status = 'error';
    it._el.querySelector('.meta').innerHTML += '<div style="color:red">Error</div>';
  } finally {
    updateStatus();
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
