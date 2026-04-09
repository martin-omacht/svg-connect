'use strict';

const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const fileInfo    = document.getElementById('fileInfo');
const fileName    = document.getElementById('fileName');
const clearBtn    = document.getElementById('clearBtn');
const toleranceEl = document.getElementById('tolerance');
const processBtn  = document.getElementById('processBtn');
const resultEl    = document.getElementById('result');
const statsEl     = document.getElementById('stats');
const downloadBtn = document.getElementById('downloadBtn');
const errorEl     = document.getElementById('error');

let currentFile = null;

// --- File selection ---

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

clearBtn.addEventListener('click', e => {
  e.stopPropagation();
  clearFile();
});

function setFile(file) {
  if (!file.name.toLowerCase().endsWith('.svg')) {
    showError('Please select an SVG file.');
    return;
  }
  currentFile = file;
  fileName.textContent = file.name;
  dropZone.classList.add('has-file');
  fileInfo.hidden = false;
  processBtn.disabled = false;
  hideResult();
}

function clearFile() {
  currentFile = null;
  fileInput.value = '';
  dropZone.classList.remove('has-file');
  fileInfo.hidden = true;
  processBtn.disabled = true;
  hideResult();
}

// --- Processing ---

processBtn.addEventListener('click', () => {
  if (!currentFile) return;
  const tolerance = parseFloat(toleranceEl.value);
  if (isNaN(tolerance) || tolerance < 0) {
    showError('Tolerance must be a non-negative number.');
    return;
  }

  processBtn.disabled = true;
  processBtn.textContent = 'Processing…';
  hideResult();

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const { svg, merged } = mergeSVG(e.target.result, tolerance);

      const baseName = currentFile.name.replace(/\.svg$/i, '');
      const outName  = baseName + '_connected.svg';

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);

      downloadBtn.href     = url;
      downloadBtn.download = outName;
      downloadBtn.textContent = `Download ${outName}`;

      statsEl.textContent = merged === 0
        ? 'No overlapping endpoints found — file unchanged.'
        : `${merged} path connection${merged !== 1 ? 's' : ''} merged.`;

      resultEl.hidden = false;
      errorEl.hidden  = true;
    } catch (err) {
      showError('Failed to process SVG: ' + err.message);
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = 'Connect Paths';
    }
  };
  reader.onerror = () => {
    showError('Could not read the file.');
    processBtn.disabled = false;
    processBtn.textContent = 'Connect Paths';
  };
  reader.readAsText(currentFile);
});

function hideResult() {
  resultEl.hidden = true;
  errorEl.hidden  = true;
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  resultEl.hidden = true;
}
