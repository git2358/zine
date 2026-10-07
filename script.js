"use strict";

const $ = id => document.getElementById(id);

const state = {
  photos: [],
  pageCount: 16,
  sheetOrientation: 'portrait',
  assignments: Array(16).fill(null),
  pageMeta: Array(16).fill(null).map(() => ({ rotate: 0, fit: 'global' })),
  paper: 'A4',
  objectFit: 'cover',
  margin: 4,
  spineGap: 5,
  borderWidth: 0.3,
  borderColor: '#ffffff',
  pageBg: '#ffffff',
  guides: 'yes'
};

const paperDimensionsMM = {
  "A4": [210, 297],
  "A3": [297, 420],
  "US Letter": [215.9, 279.4]
};

const oneSheetLayouts = {
  8: {
    cols: 4, rows: 2,
    slots: [
      { logical: 5, rotate: 180, col: 0, row: 0 },
      { logical: 4, rotate: 180, col: 1, row: 0 },
      { logical: 3, rotate: 180, col: 2, row: 0 },
      { logical: 6, rotate: 180, col: 3, row: 0 },
      { logical: 8, rotate: 0,   col: 0, row: 1 },
      { logical: 1, rotate: 0,   col: 1, row: 1 },
      { logical: 2, rotate: 0,   col: 2, row: 1 },
      { logical: 7, rotate: 0,   col: 3, row: 1 }
    ]
  },
  16: {
    cols: 4, rows: 4,
    slots: [
      { logical: 14, rotate: 180, col: 0, row: 0 },
      { logical: 13, rotate: 180, col: 1, row: 0 },
      { logical: 12, rotate: 180, col: 2, row: 0 },
      { logical: 11, rotate: 180, col: 3, row: 0 },

      { logical: 7,  rotate: 0,   col: 0, row: 1 },
      { logical: 8,  rotate: 0,   col: 1, row: 1 },
      { logical: 9,  rotate: 0,   col: 2, row: 1 },
      { logical: 10, rotate: 0,   col: 3, row: 1 },

      { logical: 6,  rotate: 180, col: 0, row: 2 },
      { logical: 5,  rotate: 180, col: 1, row: 2 },
      { logical: 4,  rotate: 180, col: 2, row: 2 },
      { logical: 3,  rotate: 180, col: 3, row: 2 },

      { logical: 16, rotate: 0,   col: 0, row: 3, customLabel: 'BACK COVER', isBackCover: true },
      { logical: 1,  rotate: 0,   col: 1, row: 3, customLabel: 'FRONT COVER' },
      { logical: 2,  rotate: 0,   col: 2, row: 3, customLabel: '1' },
      { logical: 15, rotate: 0,   col: 3, row: 3, customLabel: '2' }
    ]
  }
};

function init() {
  bindEvents();
  renderPageGrid();
  renderPreview();
}

function bindEvents() {
  $("pickBtn").onclick = () => $("fileInput").click();
  $("fileInput").onchange = e => handleFiles([...e.target.files]);
  
  const drop = $("drop");
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("drag"); };
  drop.ondragleave = () => drop.classList.remove("drag");
  drop.ondrop = e => {
    e.preventDefault();
    drop.classList.remove("drag");
    handleFiles([...e.dataTransfer.files].filter(f => f.type.startsWith("image/")));
  };

  $("clearPhotos").onclick = () => {
    state.photos.forEach(p => URL.revokeObjectURL(p.url));
    state.photos = [];
    state.assignments.fill(null);
    renderPageGrid();
    renderPreview();
  };

  $("autoAssign").onclick = () => {
    state.photos.forEach((ph, i) => {
      if (i < state.pageCount) state.assignments[i] = ph.id;
    });
    renderPageGrid();
    renderPreview();
  };

  $("pageCount").onchange = e => {
    state.pageCount = parseInt(e.target.value, 10);
    state.assignments = Array(state.pageCount).fill(null);
    state.pageMeta = Array(state.pageCount).fill(null).map(() => ({ rotate: 0, fit: 'global' }));
    renderPageGrid();
    renderPreview();
  };

  $("sheetOrientation").onchange = e => { state.sheetOrientation = e.target.value; renderPreview(); };
  $("paper").onchange = e => { state.paper = e.target.value; renderPreview(); };
  $("objectFit").onchange = e => { state.objectFit = e.target.value; renderPreview(); };
  $("margin").oninput = e => { state.margin = +e.target.value || 0; renderPreview(); };
  $("spineGap").oninput = e => { state.spineGap = +e.target.value || 0; renderPreview(); };
  $("borderWidth").oninput = e => { state.borderWidth = +e.target.value || 0; renderPreview(); };
  $("borderColor").oninput = e => { state.borderColor = e.target.value; renderPreview(); };
  $("pageBg").oninput = e => { state.pageBg = e.target.value; renderPreview(); };
  $("guides").onchange = e => { state.guides = e.target.value; renderPreview(); };

  $("printBtn").onclick = () => window.print();
  $("pngBtn").onclick = exportPNG;
  $("jsonOut").onclick = exportJSON;
  $("jsonIn").onclick = () => $("jsonInput").click();
  $("jsonInput").onchange = e => importJSONFile(e.target.files[0]);

  window.addEventListener("resize", renderPreview);
}

async function handleFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    await new Promise(r => { img.onload = r; });
    
    const photoObj = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), name: f.name, url, img };
    state.photos.push(photoObj);

    const emptyIdx = state.assignments.findIndex(x => x === null);
    if (emptyIdx !== -1) state.assignments[emptyIdx] = photoObj.id;
  }
  renderPageGrid();
  renderPreview();
}

function renderPageGrid() {
  const container = $("pageGrid");
  container.innerHTML = "";

  for (let i = 0; i < state.pageCount; i++) {
    const logicalNum = i + 1;
    const card = document.createElement("div");
    card.className = "page-card";

    const assignedId = state.assignments[i];
    const photo = state.photos.find(p => p.id === assignedId);
    const meta = state.pageMeta[i] || { rotate: 0, fit: 'global' };
    const effectiveFit = meta.fit === 'global' ? state.objectFit : meta.fit;

    let tag = '';
    if (logicalNum === 1) tag = ' (Front Cover)';
    else if (logicalNum === state.pageCount) tag = ' (Back Cover)';

    card.innerHTML = `
      <div class="header">
        <span>Page ${logicalNum}${tag}</span>
      </div>
      <div class="thumb-box">
        ${photo ? `<img src="${photo.url}" class="fit-${effectiveFit}" style="transform: rotate(${meta.rotate}deg);">` : `<span style="font-size:10px;color:#666">Empty</span>`}
      </div>
      <select class="photo-select">
        <option value="">-- Blank --</option>
        ${state.photos.map(p => `<option value="${p.id}" ${p.id === assignedId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
      </select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <select class="rot-select">
          <option value="0" ${meta.rotate === 0 ? 'selected' : ''}>Rot: 0°</option>
          <option value="90" ${meta.rotate === 90 ? 'selected' : ''}>Rot: 90°</option>
          <option value="180" ${meta.rotate === 180 ? 'selected' : ''}>Rot: 180°</option>
          <option value="270" ${meta.rotate === 270 ? 'selected' : ''}>Rot: 270°</option>
        </select>
        <select class="fit-select">
          <option value="global" ${meta.fit === 'global' ? 'selected' : ''}>Fit: Auto</option>
          <option value="cover" ${meta.fit === 'cover' ? 'selected' : ''}>Fit: Crop</option>
          <option value="contain" ${meta.fit === 'contain' ? 'selected' : ''}>Fit: Fit</option>
          <option value="fill" ${meta.fit === 'fill' ? 'selected' : ''}>Fit: Stretch</option>
        </select>
      </div>
    `;

    card.querySelector(".photo-select").onchange = e => {
      state.assignments[i] = e.target.value || null;
      renderPageGrid(); renderPreview();
    };
    card.querySelector(".rot-select").onchange = e => {
      state.pageMeta[i].rotate = parseInt(e.target.value, 10);
      renderPageGrid(); renderPreview();
    };
    card.querySelector(".fit-select").onchange = e => {
      state.pageMeta[i].fit = e.target.value;
      renderPageGrid(); renderPreview();
    };

    container.appendChild(card);
  }
}

function renderPreview() {
  const container = $("paperPreview");
  const wrap = $("previewWrap");
  container.innerHTML = "";

  const dim = paperDimensionsMM[state.paper];
  const mmW = state.sheetOrientation === 'portrait' ? dim[0] : dim[1];
  const mmH = state.sheetOrientation === 'portrait' ? dim[1] : dim[0];

  const maxW = wrap.clientWidth - 40;
  const maxH = wrap.clientHeight - 40;

  const scale = Math.min(maxW / mmW, maxH / mmH, 2.2);
  const width = mmW * scale;
  const height = mmH * scale;

  container.style.width = width + "px";
  container.style.height = height + "px";
  container.style.setProperty('--page-bg', state.pageBg);

  const layout = oneSheetLayouts[state.pageCount];
  const colW = width / layout.cols;
  const rowH = height / layout.rows;
  
  // Shift value = half of the configured spineGap (converted to px)
  const shiftPx = ((state.spineGap / 2) / mmW) * width;

  layout.slots.forEach(slot => {
    const pageDiv = document.createElement("div");
    pageDiv.className = `page ${slot.rotate === 180 ? 'flipped' : ''}`;
    
    let leftPos = slot.col * colW;
    
    // Shift ONLY the Back Cover panel to the left by half the spine margin
    if (slot.isBackCover) {
      leftPos -= shiftPx;
    }

    pageDiv.style.left = leftPos + "px";
    pageDiv.style.top = (slot.row * rowH) + "px";
    pageDiv.style.width = colW + "px";
    pageDiv.style.height = rowH + "px";
    pageDiv.style.padding = (state.margin / mmW * width) + "px";

    const assignedId = state.assignments[slot.logical - 1];
    const photo = state.photos.find(p => p.id === assignedId);
    const meta = state.pageMeta[slot.logical - 1] || { rotate: 0, fit: 'global' };
    const effectiveFit = meta.fit === 'global' ? state.objectFit : meta.fit;

    if (photo) {
      const inner = document.createElement("div");
      inner.className = "page-inner";

      const img = document.createElement("img");
      img.src = photo.url;
      img.className = `fit-${effectiveFit}`;
      if (meta.rotate !== 0) img.style.transform = `rotate(${meta.rotate}deg)`;

      inner.appendChild(img);
      pageDiv.appendChild(inner);
    } else {
      const empty = document.createElement("div");
      empty.className = "empty";
      const lblText = slot.customLabel || `Page ${slot.logical}`;
      empty.innerHTML = `<div>${lblText}</div>`;
      pageDiv.appendChild(empty);
    }

    if (state.guides === 'yes') {
      const cross = document.createElement("div");
      cross.className = "diagonal-cross";
      cross.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="0" x2="100" y2="100" stroke="#aaa" stroke-width="0.5"/><line x1="100" y1="0" x2="0" y2="100" stroke="#aaa" stroke-width="0.5"/></svg>`;
      pageDiv.appendChild(cross);
    }

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = slot.customLabel ? slot.customLabel : `P${slot.logical}`;
    pageDiv.appendChild(label);

    if (state.borderWidth > 0) {
      const border = document.createElement("div");
      border.className = "border-overlay";
      border.style.border = `${state.borderWidth * scale}px solid ${state.borderColor}`;
      pageDiv.appendChild(border);
    }

    container.appendChild(pageDiv);
  });

  if (state.guides === 'yes') {
    for (let c = 1; c < layout.cols; c++) {
      const vFold = document.createElement("div");
      vFold.className = "foldline v";
      vFold.style.left = (c * colW) + "px";
      container.appendChild(vFold);
    }
    for (let r = 1; r < layout.rows; r++) {
      const hFold = document.createElement("div");
      hFold.className = "foldline h";
      hFold.style.top = (r * rowH) + "px";
      container.appendChild(hFold);
    }
  }
}

function exportPNG() {
  const dim = paperDimensionsMM[state.paper];
  const mmW = state.sheetOrientation === 'portrait' ? dim[0] : dim[1];
  const mmH = state.sheetOrientation === 'portrait' ? dim[1] : dim[0];

  const dpi = 300;
  const mmToPx = dpi / 25.4;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mmW * mmToPx);
  canvas.height = Math.round(mmH * mmToPx);

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = state.pageBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const layout = oneSheetLayouts[state.pageCount];
  const colW = canvas.width / layout.cols;
  const rowH = canvas.height / layout.rows;
  const shiftPx = (state.spineGap / 2) * mmToPx;

  layout.slots.forEach(slot => {
    let x = slot.col * colW;
    if (slot.isBackCover) {
      x -= shiftPx;
    }
    const y = slot.row * rowH;

    const assignedId = state.assignments[slot.logical - 1];
    const photo = state.photos.find(p => p.id === assignedId);
    const meta = state.pageMeta[slot.logical - 1] || { rotate: 0, fit: 'global' };
    const effectiveFit = meta.fit === 'global' ? state.objectFit : meta.fit;

    const marginPx = state.margin * mmToPx;
    const drawW = colW - (marginPx * 2);
    const drawH = rowH - (marginPx * 2);

    ctx.save();
    ctx.translate(x + colW / 2, y + rowH / 2);
    if (slot.rotate) ctx.rotate((slot.rotate * Math.PI) / 180);

    if (photo) {
      ctx.save();
      if (meta.rotate) ctx.rotate((meta.rotate * Math.PI) / 180);

      const img = photo.img;
      const rot = (meta.rotate % 180 !== 0);
      const nw = rot ? img.naturalHeight : img.naturalWidth;
      const nh = rot ? img.naturalWidth : img.naturalHeight;

      let renderW = drawW, renderH = drawH;

      if (effectiveFit === 'cover') {
        const ratio = Math.max(drawW / nw, drawH / nh);
        renderW = nw * ratio; renderH = nh * ratio;
      } else if (effectiveFit === 'contain') {
        const ratio = Math.min(drawW / nw, drawH / nh);
        renderW = nw * ratio; renderH = nh * ratio;
      }

      ctx.beginPath();
      ctx.rect(-drawW / 2, -drawH / 2, drawW, drawH);
      ctx.clip();

      if (rot) {
        ctx.drawImage(img, -renderH / 2, -renderW / 2, renderH, renderW);
      } else {
        ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
      }
      ctx.restore();
    }

    if (state.borderWidth > 0) {
      ctx.strokeStyle = state.borderColor;
      ctx.lineWidth = state.borderWidth * mmToPx;
      ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
    }

    ctx.restore();
  });

  canvas.toBlob(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `zine-${state.pageCount}pages-${state.sheetOrientation}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}

function exportJSON() {
  const data = {
    app: "One-Sheet Zine Studio",
    version: 9,
    state: {
      pageCount: state.pageCount,
      sheetOrientation: state.sheetOrientation,
      paper: state.paper,
      objectFit: state.objectFit,
      margin: state.margin,
      spineGap: state.spineGap,
      borderWidth: state.borderWidth,
      borderColor: state.borderColor,
      pageBg: state.pageBg,
      assignments: state.assignments,
      pageMeta: state.pageMeta
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "zine-settings.json";
  a.click();
}

async function importJSONFile(file) {
  if (!file) return;
  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    if (parsed.state) {
      Object.assign(state, parsed.state);
      $("pageCount").value = state.pageCount;
      $("sheetOrientation").value = state.sheetOrientation || 'portrait';
      $("paper").value = state.paper;
      $("objectFit").value = state.objectFit;
      $("margin").value = state.margin;
      if (state.spineGap !== undefined) $("spineGap").value = state.spineGap;
      $("borderWidth").value = state.borderWidth;
      $("borderColor").value = state.borderColor;
      $("pageBg").value = state.pageBg;
      renderPageGrid();
      renderPreview();
    }
  } catch (err) {
    alert("Could not load configuration.");
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

window.onload = init;