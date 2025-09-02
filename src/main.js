import { initUI } from './ui.js';
import { processQueue, addFilesToQueue } from './processor.js';

initUI({
  onFiles: async (files, options) => {
    // Read additional crop fields from the DOM (leave blank = no crop)
    const arw = parseInt(document.getElementById('aspectRatioWidth')?.value, 10);
    const arh = parseInt(document.getElementById('aspectRatioHeight')?.value, 10);
    const cropPosition = document.getElementById('cropPosition')?.value || 'center';

    const enhancedOptions = {
      ...options,
      aspectRatio: (Number.isFinite(arw) && arw > 0 && Number.isFinite(arh) && arh > 0)
        ? { w: arw, h: arh }
        : null,
      cropPosition
    };

    addFilesToQueue([...files], enhancedOptions);
    processQueue();
  }
});
