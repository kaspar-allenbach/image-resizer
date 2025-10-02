import { psdToCanvas } from './psd-handler.js';
import { saveAs } from 'file-saver';
import * as UTIF from 'utif';

// Try to import optimization libraries - with error handling
let encodePNG, encodeJPEG, encodeWebP;
let optimizationAvailable = false;

try {
    const pngModule = await import('@jsquash/png');
    const jpegModule = await import('@jsquash/jpeg');
    const webpModule = await import('@jsquash/webp');
    
    encodePNG = pngModule.encode;
    encodeJPEG = jpegModule.encode;
    encodeWebP = webpModule.encode;
    optimizationAvailable = true;
    console.log('✅ Image optimization libraries loaded successfully');
} catch (error) {
    console.warn('⚠️ Image optimization libraries not available, using fallback compression:', error);
    optimizationAvailable = false;
}

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

// Enhanced PNG optimization using multiple techniques
async function optimizePNG(canvas, quality) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    if (optimizationAvailable && encodePNG) {
        try {
            console.log(`🔄 Optimizing PNG with jSquash (quality: ${Math.round(quality * 100)}%)`);
            
            // More aggressive PNG optimization settings
            const optimized = await encodePNG(imageData, {
                level: 9, // Maximum compression
                quality: Math.max(10, Math.min(90, Math.round(quality * 100))), // Ensure reasonable range
                effort: 10, // Maximum effort
                palette: true, // Use palette when beneficial
                colors: quality < 0.7 ? 128 : 256 // Reduce colors for lower quality
            });
            
            const blob = new Blob([optimized], { type: 'image/png' });
            console.log(`✅ PNG optimized: ${Math.round(blob.size / 1024)} KB`);
            return blob;
        } catch (error) {
            console.warn('❌ jSquash PNG optimization failed:', error);
        }
    }
    
    // Fallback: Try multiple quality levels to find best compression
    console.log('🔄 Using fallback PNG optimization');
    let bestBlob = null;
    let bestSize = Infinity;
    
    // Try different canvas compression qualities
    const qualities = [0.3, 0.5, 0.7, 0.9];
    
    for (const q of qualities) {
        try {
            const blob = await exportCanvasToBlob(canvas, 'image/png', q);
            if (blob.size < bestSize) {
                bestSize = blob.size;
                bestBlob = blob;
            }
        } catch (error) {
            console.warn(`Failed PNG compression at quality ${q}:`, error);
        }
    }
    
    if (bestBlob) {
        console.log(`✅ PNG fallback optimization: ${Math.round(bestBlob.size / 1024)} KB`);
        return bestBlob;
    }
    
    // Final fallback
    return await exportCanvasToBlob(canvas, 'image/png', quality);
}

// Enhanced optimization function
async function optimizeCanvas(canvas, options) {
    const originalSize = Math.round((canvas.width * canvas.height * 4) / 1024); // Approximate KB
    console.log(`🎨 Optimizing ${options.type} (${canvas.width}x${canvas.height}, ~${originalSize} KB uncompressed)`);
    
    try {
        if (options.type === 'image/png') {
            return await optimizePNG(canvas, options.quality || 0.8);
        } 
        else if (options.type === 'image/jpeg' && optimizationAvailable && encodeJPEG) {
            console.log(`🔄 Optimizing JPEG with jSquash`);
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            const optimized = await encodeJPEG(imageData, {
                quality: Math.round((options.quality || 0.8) * 100),
                baseline: true,
                arithmetic: false,
                progressive: true,
                optimize_coding: true,
                smoothing: 0,
                color_space: 3,
                quant_table: 3,
                trellis_multipass: true,
                trellis_opt_zero: true,
                trellis_opt_table: true
            });
            
            const blob = new Blob([optimized], { type: 'image/jpeg' });
            console.log(`✅ JPEG optimized: ${Math.round(blob.size / 1024)} KB`);
            return blob;
        }
        else if (options.type === 'image/webp' && optimizationAvailable && encodeWebP) {
            console.log(`🔄 Optimizing WebP with jSquash`);
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            const optimized = await encodeWebP(imageData, {
                quality: Math.round((options.quality || 0.8) * 100),
                target_size: 0,
                target_PSNR: 0,
                method: 6,
                sns_strength: 50,
                filter_strength: 60,
                filter_sharpness: 0,
                filter_type: 1,
                partitions: 0,
                segments: 4,
                pass: 1,
                show_compressed: 0,
                preprocessing: 0,
                autofilter: 0,
                partition_limit: 0,
                alpha_compression: 1,
                alpha_filtering: 1,
                alpha_quality: 100,
                lossless: 0,
                exact: 0,
                image_hint: 0,
                emulate_jpeg_size: 0,
                thread_level: 0,
                low_memory: 0,
                near_lossless: 100,
                use_delta_palette: 0,
                use_sharp_yuv: 0
            });
            
            const blob = new Blob([optimized], { type: 'image/webp' });
            console.log(`✅ WebP optimized: ${Math.round(blob.size / 1024)} KB`);
            return blob;
        }
        else {
            console.log('🔄 Using standard browser compression');
            const blob = await exportCanvasToBlob(canvas, options.type, options.quality);
            console.log(`✅ Standard compression: ${Math.round(blob.size / 1024)} KB`);
            return blob;
        }
    } catch (error) {
        console.error('❌ Optimization failed:', error);
        // Fallback to original method
        return await exportCanvasToBlob(canvas, options.type, options.quality);
    }
}

async function processItem(it) {
  it.status = 'processing';
  const pb = it._progressBar;
  try {
    console.log(`📸 Processing: ${it.file.name} (${Math.round(it.file.size/1024)} KB)`);
    
    pb.style.width = '20%';
    let src = await canvasFromFile(it.file);

    // Apply aspect ratio crop first (if provided)
    if (it.options.aspectRatio) {
      src = cropCanvasToAspectRatio(src, it.options.aspectRatio, it.options.cropPosition);
    }

    pb.style.width = '50%';
    const resized = scaleCanvas(src, it.options.size);

    pb.style.width = '70%';
    
    // Use optimization
    const blob = await optimizeCanvas(resized, it.options);

    pb.style.width = '90%';

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

    console.log(`💾 Saving: ${finalName} (${Math.round(blob.size/1024)} KB)`);
    saveAs(blob, finalName);

    pb.style.width = '100%';
    it.status = 'done';
    setTimeout(() => it._el.remove(), 1500);
  } catch (e) {
    console.error('❌ Processing failed:', e);
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