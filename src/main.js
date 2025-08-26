import { initUI } from './ui.js';
import { processQueue, addFilesToQueue } from './processor.js';

initUI({
  onFiles: async (files, options) => {
    addFilesToQueue([...files], options);
    processQueue();
  }
});
