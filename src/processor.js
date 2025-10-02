import { psdToCanvas } from './psd-handler.js';
import { saveAs } from 'file-saver';
import * as UTIF from 'utif';

// Import optimization libraries
import { encode as encodePNG } from '@jsquash/png';
import { encode as encodeJPEG } from '@jsquash/jpeg';
import { encode as encodeWebP } from '@jsquash/webp';
import { optimise as optimisePNG } from '@jsquash/oxipng';

console.log('✅ Image optimization libraries loaded successfully');

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
        UTIF.decodeImage(buf, first);
        const rgba = UTIF.toRGBA8(first);
        const width = first.width || first.t256;
        const height = first.height || first.t257;

        if (!width || !height) {
            throw new Error("Invalid TIFF: missing dimensions");
        }

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

// Advanced PNG optimization function
async function optimizePNGAdvanced(canvas, quality) {
    console.log(`🔄 Starting advanced PNG optimization (quality: ${Math.round(quality * 100)}%)`);
    
    try {
        // Step 1: Get basic PNG data first
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Step 2: Create a base PNG with jSquash
        const basePngData = await encodePNG(imageData);
        console.log(`📊 Base PNG size: ${Math.round(basePngData.byteLength / 1024)} KB`);
        
        // Step 3: Apply Oxipng optimization (this is the key!)
        const optimizedData = await optimisePNG(basePngData, {
            level: 6,           // Maximum optimization level
            interlace: false,   // Don't use interlacing (saves space)
            optimiseAlpha: true,// Optimize alpha channel
            stripAll: true      // Remove all metadata
        });
        
        const finalBlob = new Blob([optimizedData], { type: 'image/png' });
        console.log(`✅ Advanced PNG optimized: ${Math.round(finalBlob.size / 1024)} KB (${Math.round((1 - finalBlob.size / basePngData.byteLength) * 100)}% reduction)`);
        
        return finalBlob;
        
    } catch (error) {
        console.error('❌ Advanced PNG optimization failed:', error);
        
        // Fallback: Try basic PNG with aggressive quality reduction
        console.log('🔄 Trying fallback PNG optimization...');
        
        // Reduce canvas size if quality is low (simulates color reduction)
        let workingCanvas = canvas;
        if (quality < 0.8) {
            workingCanvas = document.createElement('canvas');
            const reductionFactor = Math.max(0.5, quality);
            workingCanvas.width = Math.round(canvas.width * reductionFactor);
            workingCanvas.height = Math.round(canvas.height * reductionFactor);
            
            const ctx = workingCanvas.getContext('2d');
            // Use lower quality scaling
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(canvas, 0, 0, workingCanvas.width, workingCanvas.height);
            
            // Scale back up with smoothing
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvas.width;
            finalCanvas.height = canvas.height;
            const finalCtx = finalCanvas.getContext('2d');
            finalCtx.imageSmoothingEnabled = true;
            finalCtx.drawImage(workingCanvas, 0, 0, canvas.width, canvas.height);
            workingCanvas = finalCanvas;
        }
        
        const fallbackBlob = await exportCanvasToBlob(workingCanvas, 'image/png', Math.max(0.1, quality * 0.7));
        console.log(`⚠️ Fallback PNG: ${Math.round(fallbackBlob.size / 1024)} KB`);
        return fallbackBlob;
    }
}

async function optimizeCanvas(canvas, options) {
    const startTime = Date.now();
    
    console.log(`🎨 Starting optimization for ${options.type} (${canvas.width}x${canvas.height})`);
    
    try {
        let blob;
        
        if (options.type === 'image/png') {
            // Use advanced PNG optimization
            blob = await optimizePNGAdvanced(canvas, options.quality || 0.8);
            
        } else if (options.type === 'image/jpeg') {
            console.log('🔄 Using jSquash JPEG encoder...');
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const quality = Math.round((options.quality || 0.8) * 100);
            const jpegData = await encodeJPEG(imageData, { quality });
            blob = new Blob([jpegData], { type: 'image/jpeg' });
            console.log(`✅ JPEG optimized: ${Math.round(blob.size / 1024)} KB`);
            
        } else if (options.type === 'image/webp') {
            console.log('🔄 Using jSquash WebP encoder...');
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const quality = Math.round((options.quality || 0.8) * 100);
            const webpData = await encodeWebP(imageData, { quality });
            blob = new Blob([webpData], { type: 'image/webp' });
            console.log(`✅ WebP optimized: ${Math.round(blob.size / 1024)} KB`);
            
        } else {
            console.log('🔄 Using browser native encoder...');
            blob = await exportCanvasToBlob(canvas, options.type, options.quality);
            console.log(`✅ Native encoding: ${Math.round(blob.size / 1024)} KB`);
        }
        
        console.log(`⏱️ Total optimization time: ${Date.now() - startTime}ms`);
        return blob;
        
    } catch (error) {
        console.error('❌ Optimization failed:', error);
        console.log('🔄 Falling back to browser encoding...');
        const blob = await exportCanvasToBlob(canvas, options.type, options.quality);
        console.log(`⚠️ Fallback encoding: ${Math.round(blob.size / 1024)} KB`);
        return blob;
    }
}

async function processItem(it) {
  it.status = 'processing';
  const pb = it._progressBar;
  try {
    console.log(`📸 Processing: ${it.file.name} (${Math.round(it.file.size/1024)} KB)`);
    
    pb.style.width = '20%';
    let src = await canvasFromFile(it.file);

    if (it.options.aspectRatio) {
      src = cropCanvasToAspectRatio(src, it.options.aspectRatio, it.options.cropPosition);
    }

    pb.style.width = '50%';
    const resized = scaleCanvas(src, it.options.size);

    pb.style.width = '70%';
    const blob = await optimizeCanvas(resized, it.options);

    pb.style.width = '90%';

    // Filename logic
    const baseName = it.file.name.replace(/\.[^.]+$/, '');
    const originalExt = it.file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
    let ext = it.options.type.split('/')[1] || 'png';

    if (ext === 'jpeg' && (originalExt === 'jpg' || originalExt === 'jpeg')) {
        ext = originalExt;
    }

    const finalName = (it.options.prefix || '') + baseName + (it.options.suffix || '') + '.' + ext;

    console.log(`💾 Saving: ${finalName} (${Math.round(blob.size/1024)} KB)`);
    
    // Update UI with before/after sizes
    it._el.querySelector('.meta').innerHTML = `<strong>${it.file.name}</strong> • ${Math.round(it.file.size/1024)} KB → ${Math.round(blob.size/1024)} KB`;
    
    saveAs(blob, finalName);

    pb.style.width = '100%';
    it.status = 'done';
    setTimeout(() => it._el.remove(), 1500);
  } catch (e) {
    console.error('❌ Processing failed:', e);
    it.status = 'error';
    it._el.querySelector('.meta').innerHTML += '<div style="color:red">Error: ' + e.message + '</div>';
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