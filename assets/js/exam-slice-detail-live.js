/* ==========================================================================
   考试切片详情（assets/js/exam-slice-detail-live.js）
   --------------------------------------------------------------------------
   一页干三件事：
     1. 看原图（多页切换、缩放）
     2. 框错题（在图上拖出一个矩形，存百分比坐标）
     3. 给每道错题填：题号、知识点（从知识树选）、错误原因

   坐标为什么用百分比：同一张图在不同设备上显示尺寸不一样，存像素就乱了。
   百分比只跟"图本身"有关，换设备照样对得上。

   依赖：api.js（取数 + PATCH）、auth-client.js（身份）。
   ========================================================================== */
(function () {
  'use strict';

  var API = window.WK_API;
  var AUTH = window.WK_AUTH;
  if (!API) { return; }

  /* 从 URL 拿 id：exam-slice-detail.html?id=123 */
  var SLICE_ID = (function () {
    var m = /[?&]id=(\d+)/.exec(location.search);
    return m ? Number(m[1]) : 0;
  })();

  var nameEl = document.getElementById('slice-name');
  var metaEl = document.getElementById('slice-meta');
  var noteSec = document.getElementById('note-sec');
  var noteEl = document.getElementById('slice-note');
  var tabsEl = document.getElementById('img-tabs');
  var stageEl = document.getElementById('stage');
  var wrapEl = document.getElementById('img-wrap');
  var imgEl = document.getElementById('slice-img');
  var overlayEl = document.getElementById('overlay');
  var emptyEl = document.getElementById('viewer-empty');
  var boxesEl = document.getElementById('boxes-list');
  var boxesCountEl = document.getElementById('boxes-count');
  var saveBtn = document.getElementById('save-btn');
  var saveMsg = document.getElementById('save-msg');
  var nodeModal = document.getElementById('node-modal');
  var nodeListEl = document.getElementById('node-list');
  var nodeSearchEl = document.getElementById('node-search');

  if (!nameEl) { return; }

  var slice = null;          // 后端返回的整条切片
  var boxes = [];            // 当前编辑中的 box 数组（可增删改）
  var curPage = 0;           // 当前看第几页（0-based）
  var allNodes = [];         // 知识树扁平化后的节点（供选知识点）
  var pickingBoxIdx = -1;    // 正在选知识点的那个 box 在 boxes 里的下标
  var selectedBoxIdx = -1;   // 当前高亮的 box
  var zoom = 1;              // 图片缩放
  var dirty = false;         // 有没有未保存的改动

  /* ---- 拖拽画框用 ---- */
  var drawing = false;
  var drawStart = null;      // {x, y} 百分比
  var draftEl = null;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pct(v) {
    return v === null || v === undefined ? '—' : Math.round(v * 100) + '%';
  }

  function setSaveMsg(text, bad) {
    if (!saveMsg) { return; }
    saveMsg.textContent = text || '';
    saveMsg.setAttribute('data-tone', bad ? 'bad' : (text ? 'ok' : ''));
  }

  function markDirty() {
    dirty = true;
    if (saveBtn) { saveBtn.removeAttribute('disabled'); }
  }

  /* ------------------------------------------------------------------
   * 取知识树（扁平化，留着给"选知识点"用）
   * ------------------------------------------------------------------ */
  function flatten(node, out, book) {
    out.push({ id: node.id, name: node.name, kind: node.kind || '', book: book || '' });
    var here = (node.kind === 'book') ? node.name : book;
    (node.children || []).forEach(function (c) { flatten(c, out, here); });
    return out;
  }

  function loadTree() {
    return API.get('/tree').then(function (d) {
      allNodes = flatten(d.tree, [], '');
    }, function () { allNodes = []; });
  }

  /* ------------------------------------------------------------------
   * 加载切片
   * ------------------------------------------------------------------ */
  function loadSlice() {
    return API.get('/me/exam-slices/' + SLICE_ID).then(function (d) {
      slice = d;
      boxes = (d.boxes || []).map(function (b) {
        return {
          page: b.page, q: b.q, x: b.x, y: b.y, w: b.w, h: b.h,
          nodeId: b.nodeId, cause: b.cause || '',
        };
      });
      renderMeta();
      renderTabs();
      if (d.images && d.images.length) {
        curPage = 0;
        showPage(0);
      } else {
        if (emptyEl) { emptyEl.hidden = false; }
        if (wrapEl) { wrapEl.style.display = 'none'; }
      }
      renderBoxesList();
      drawBoxes();
      dirty = false;
      if (saveBtn) { saveBtn.setAttribute('disabled', ''); }
    }, function (err) {
      nameEl.textContent = '取不出这张切片';
      if (metaEl) { metaEl.textContent = (err && err.message) || '接口没通'; }
    });
  }

  function renderMeta() {
    if (!slice) { return; }
    nameEl.textContent = slice.name;
    var parts = [slice.date, slice.subject, slice.paperType];
    if (slice.score !== null) { parts.push(slice.score + '/' + slice.full + ' · ' + pct(slice.rate)); }
    else { parts.push('没记分数'); }
    if (metaEl) { metaEl.textContent = parts.join(' · '); }
    if (slice.note && noteEl && noteSec) {
      noteEl.textContent = slice.note;
      noteSec.hidden = false;
    }
  }

  /* ------------------------------------------------------------------
   * 图片分页
   * ------------------------------------------------------------------ */
  function renderTabs() {
    if (!tabsEl || !slice) { return; }
    var imgs = slice.images || [];
    if (!imgs.length) { tabsEl.innerHTML = ''; return; }
    tabsEl.innerHTML = imgs.map(function (img, i) {
      return '<button type="button" class="viewer__tab" data-page="' + i + '"' +
        (i === curPage ? ' data-on="1"' : '') + '>' + esc(img.label || ('第 ' + (i + 1) + ' 页')) + '</button>';
    }).join('');
  }

  function showPage(idx) {
    if (!slice || !slice.images || !slice.images[idx]) { return; }
    curPage = idx;
    var img = slice.images[idx];
    if (imgEl) {
      imgEl.src = API.asset(img.url);
      imgEl.style.transform = 'scale(' + zoom + ')';
      imgEl.style.transformOrigin = 'top left';
    }
    if (emptyEl) { emptyEl.hidden = true; }
    if (wrapEl) { wrapEl.style.display = ''; }
    renderTabs();
    drawBoxes();
  }

  /* 图片加载完之后，overlay 的尺寸才跟图片一致；等 load 再画一次，
     否则第一次进页面 box 会画在 0x0 的区域上。 */
  if (imgEl) {
    imgEl.addEventListener('load', function () {
      /* 缩放后 wrap 要跟着变大，否则 overlay 还是原图尺寸，框就画偏了 */
      if (wrapEl) {
        wrapEl.style.width = (imgEl.naturalWidth * zoom) + 'px';
        wrapEl.style.height = (imgEl.naturalHeight * zoom) + 'px';
      }
      drawBoxes();
    });
  }

  /* ------------------------------------------------------------------
   * 百分比 ↔ 像素（相对 wrapEl）
   * ------------------------------------------------------------------ */
  function pxToPct(px, py) {
    var rect = wrapEl.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    return {
      x: w > 0 ? Math.max(0, Math.min(100, ((px - rect.left) / w) * 100)) : 0,
      y: h > 0 ? Math.max(0, Math.min(100, ((py - rect.top) / h) * 100)) : 0,
    };
  }

  /* ------------------------------------------------------------------
   * 在 overlay 上画 boxes
   * ------------------------------------------------------------------ */
  function drawBoxes() {
    if (!overlayEl) { return; }
    /* 只画当前页的 */
    var cur = boxes.filter(function (b) { return b.page === curPage; });
    overlayEl.innerHTML = cur.map(function (b, i) {
      /* 注意：boxes 里的下标是全局的，这里用 data-idx 存全局下标 */
      var globalIdx = boxes.indexOf(b);
      return '<div class="box-mark" data-idx="' + globalIdx + '"' +
        (globalIdx === selectedBoxIdx ? ' data-sel="1"' : '') +
        ' style="left:' + b.x + '%;top:' + b.y + '%;width:' + b.w + '%;height:' + b.h + '%">' +
        '<span class="box-mark__q">' + (b.q || '?') + '</span></div>';
    }).join('');
  }

  /* ------------------------------------------------------------------
   * 拖拽画框
   * ------------------------------------------------------------------ */
  function onPointerDown(ev) {
    /* 只认主按键（左键 / 触摸），且点在 overlay 空白处（不是已有的 box） */
    if (ev.button !== undefined && ev.button !== 0) { return; }
    if (ev.target && ev.target.classList && ev.target.classList.contains('box-mark')) { return; }
    drawing = true;
    drawStart = pxToPct(ev.clientX, ev.clientY);
    draftEl = document.createElement('div');
    draftEl.className = 'box-draft';
    overlayEl.appendChild(draftEl);
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!drawing || !draftEl || !drawStart) { return; }
    var cur = pxToPct(ev.clientX, ev.clientY);
    var x = Math.min(drawStart.x, cur.x);
    var y = Math.min(drawStart.y, cur.y);
    var w = Math.abs(cur.x - drawStart.x);
    var h = Math.abs(cur.y - drawStart.y);
    draftEl.style.left = x + '%';
    draftEl.style.top = y + '%';
    draftEl.style.width = w + '%';
    draftEl.style.height = h + '%';
  }

  function onPointerUp(ev) {
    if (!drawing) { return; }
    drawing = false;
    var cur = pxToPct(ev.clientX, ev.clientY);
    var x = Math.min(drawStart.x, cur.x);
    var y = Math.min(drawStart.y, cur.y);
    var w = Math.abs(cur.x - drawStart.x);
    var h = Math.abs(cur.y - drawStart.y);
    if (draftEl && draftEl.parentNode) { draftEl.parentNode.removeChild(draftEl); }
    draftEl = null;
    drawStart = null;
    /* 太小的框不算（手抖点了一下）—— 小于 1% 忽略 */
    if (w < 1 || h < 1) { return; }

    var q = boxes.length + 1;
    boxes.push({ page: curPage, q: q, x: x, y: y, w: w, h: h, nodeId: null, cause: '' });
    selectedBoxIdx = boxes.length - 1;
    markDirty();
    drawBoxes();
    renderBoxesList();
  }

  if (overlayEl) {
    overlayEl.addEventListener('mousedown', onPointerDown);
    overlayEl.addEventListener('mousemove', onPointerMove);
    overlayEl.addEventListener('mouseup', onPointerUp);
    overlayEl.addEventListener('mouseleave', function () { if (drawing) { onPointerUp({ clientX: 0, clientY: 0 }); } });
    /* 触屏 */
    overlayEl.addEventListener('touchstart', function (e) { if (e.touches[0]) { onPointerDown(e.touches[0]); } }, { passive: false });
    overlayEl.addEventListener('touchmove', function (e) { if (e.touches[0]) { onPointerMove(e.touches[0]); } }, { passive: false });
    overlayEl.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (t) { onPointerUp(t); } });
  }

  /* ------------------------------------------------------------------
   * box 列表（右侧：题号 / 知识点 / 错误原因 / 删除）
   * ------------------------------------------------------------------ */
  function renderBoxesList() {
    if (!boxesEl) { return; }
    if (boxesCountEl) { boxesCountEl.textContent = boxes.length + ' 道'; }
    if (!boxes.length) {
      boxesEl.innerHTML = '<p class="wk-note">还没有框错题。在上面的照片上拖出一个框，就会多出一条。</p>';
      return;
    }
    boxesEl.innerHTML = boxes.map(function (b, i) {
      var nodeName = '';
      if (b.nodeId) {
        var n = allNodes.filter(function (x) { return x.id === b.nodeId; })[0];
        nodeName = n ? (n.book ? n.book + ' · ' : '') + n.name : ('#' + b.nodeId);
      }
      var pageLabel = (slice && slice.images && slice.images[b.page])
        ? slice.images[b.page].label || ('第 ' + (b.page + 1) + ' 页')
        : ('第 ' + (b.page + 1) + ' 页');
      return '<article class="box-card" data-idx="' + i + '"' +
        (i === selectedBoxIdx ? ' data-sel="1"' : '') + '>' +
        '<div class="box-card__row">' +
        '<span class="box-card__lab">题号</span>' +
        '<input type="number" min="0" max="999" data-field="q" data-idx="' + i + '" value="' + b.q + '">' +
        '<span class="box-card__page">' + esc(pageLabel) + '</span>' +
        '<button type="button" class="box-card__del" data-del="' + i + '">删除</button>' +
        '</div>' +
        '<div class="box-card__row">' +
        '<span class="box-card__lab">知识点</span>' +
        '<button type="button" class="box-card__node" data-node="' + i + '" data-set="' + (b.nodeId ? '1' : '0') + '">' +
        (nodeName ? esc(nodeName) : '点击选择…') + '</button>' +
        '</div>' +
        '<div class="box-card__row">' +
        '<span class="box-card__lab">错因</span>' +
        '<input type="text" maxlength="191" data-field="cause" data-idx="' + i + '" placeholder="算错 / 看不懂题 / 公式记错…" value="' + esc(b.cause) + '">' +
        '</div>' +
        '</article>';
    }).join('');
  }

  /* 列表里点某个 box → 高亮 + 跳到那一页 */
  function selectBox(idx) {
    selectedBoxIdx = idx;
    var b = boxes[idx];
    if (b && b.page !== curPage) { showPage(b.page); }
    else { drawBoxes(); }
    renderBoxesList();
  }

  /* ------------------------------------------------------------------
   * 知识点弹窗
   * ------------------------------------------------------------------ */
  function openNodePicker(idx) {
    pickingBoxIdx = idx;
    if (nodeSearchEl) { nodeSearchEl.value = ''; }
    renderNodeList('');
    if (nodeModal) { nodeModal.hidden = false; }
    if (nodeSearchEl) { nodeSearchEl.focus(); }
  }

  function closeNodePicker() {
    pickingBoxIdx = -1;
    if (nodeModal) { nodeModal.hidden = true; }
  }

  function renderNodeList(kw) {
    if (!nodeListEl) { return; }
    kw = (kw || '').trim();
    var shown = allNodes.filter(function (n) {
      return !kw || (n.name.indexOf(kw) >= 0) || (n.book && n.book.indexOf(kw) >= 0);
    }).slice(0, 300);
    if (!shown.length) {
      nodeListEl.innerHTML = '<div class="modal__empty">没找到。换个关键词试试，或者先不选。</div>';
      return;
    }
    nodeListEl.innerHTML = shown.map(function (n) {
      return '<div class="modal__item" data-node-id="' + n.id + '">' +
        '<b>' + esc(n.name) + '</b>' +
        (n.book ? '<span>' + esc(n.book) + (n.kind ? ' · ' + esc(n.kind) : '') + '</span>' : '') +
        '</div>';
    }).join('');
  }

  function pickNode(id) {
    if (pickingBoxIdx < 0 || !boxes[pickingBoxIdx]) { closeNodePicker(); return; }
    boxes[pickingBoxIdx].nodeId = id;
    markDirty();
    renderBoxesList();
    closeNodePicker();
  }

  /* ------------------------------------------------------------------
   * 保存
   * ------------------------------------------------------------------ */
  function save() {
    if (!dirty) { setSaveMsg('没有改动'); return; }
    /* 校验：百分比都在 0-100，w/h 不能 0 */
    var bad = boxes.some(function (b) {
      return b.w <= 0 || b.h <= 0 || b.x < 0 || b.y < 0 || b.x + b.w > 100.01 || b.y + b.h > 100.01;
    });
    if (bad) { setSaveMsg('有框出界了，检查一下。', true); return; }

    if (saveBtn) { saveBtn.setAttribute('disabled', ''); saveBtn.textContent = '正在存…'; }
    setSaveMsg('');

    API.patch('/me/exam-slices/' + SLICE_ID, {
      boxes: boxes.map(function (b) {
        return {
          page: b.page, q: Number(b.q) || 0,
          x: Math.round(b.x * 1000) / 1000,
          y: Math.round(b.y * 1000) / 1000,
          w: Math.round(b.w * 1000) / 1000,
          h: Math.round(b.h * 1000) / 1000,
          nodeId: b.nodeId || null,
          cause: b.cause || null,
        };
      }),
    }).then(function () {
      dirty = false;
      if (saveBtn) { saveBtn.textContent = '保存标注'; }
      setSaveMsg('已保存 ' + new Date().toLocaleTimeString());
    }, function (err) {
      if (saveBtn) { saveBtn.removeAttribute('disabled'); saveBtn.textContent = '保存标注'; }
      setSaveMsg('没存上：' + ((err && err.message) || '接口没通'), true);
    });
  }

  /* ------------------------------------------------------------------
   * 缩放
   * ------------------------------------------------------------------ */
  function setZoom(z) {
    zoom = Math.max(0.3, Math.min(4, z));
    if (imgEl) {
      imgEl.style.transform = 'scale(' + zoom + ')';
      if (wrapEl && imgEl.naturalWidth) {
        wrapEl.style.width = (imgEl.naturalWidth * zoom) + 'px';
        wrapEl.style.height = (imgEl.naturalHeight * zoom) + 'px';
      }
    }
    drawBoxes();
  }

  /* ------------------------------------------------------------------
   * 事件收口
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t) { return; }

    /* 图片页签 */
    var page = t.getAttribute && t.getAttribute('data-page');
    if (page !== null && page !== undefined && t.classList.contains('viewer__tab')) {
      showPage(Number(page));
      return;
    }

    /* 点 overlay 上的 box → 选中 */
    if (t.classList && t.classList.contains('box-mark')) {
      var idx = Number(t.getAttribute('data-idx'));
      if (!isNaN(idx)) { selectBox(idx); }
      return;
    }

    /* 列表卡片点中 → 选中 */
    var card = t.closest && t.closest('.box-card');
    if (card) {
      var cidx = Number(card.getAttribute('data-idx'));
      if (!isNaN(cidx)) { selectBox(cidx); }
      /* 不 return，让下面的字段按钮继续处理 */
    }

    /* 选知识点 */
    var nodeBtn = t.getAttribute && t.getAttribute('data-node');
    if (nodeBtn !== null && nodeBtn !== undefined) {
      ev.preventDefault();
      openNodePicker(Number(nodeBtn));
      return;
    }

    /* 删除 */
    var del = t.getAttribute && t.getAttribute('data-del');
    if (del !== null && del !== undefined) {
      ev.preventDefault();
      var di = Number(del);
      boxes.splice(di, 1);
      if (selectedBoxIdx === di) { selectedBoxIdx = -1; }
      else if (selectedBoxIdx > di) { selectedBoxIdx--; }
      markDirty();
      drawBoxes();
      renderBoxesList();
      return;
    }

    /* 保存 */
    if (t.id === 'save-btn') { save(); return; }

    /* 缩放 */
    if (t.id === 'zoom-in') { setZoom(zoom * 1.25); return; }
    if (t.id === 'zoom-out') { setZoom(zoom / 1.25); return; }
    if (t.id === 'zoom-reset') { setZoom(1); return; }

    /* 弹窗关闭 */
    if (t.getAttribute && t.getAttribute('data-close')) {
      closeNodePicker();
      return;
    }
    /* 弹窗里点某个知识点 */
    var nodeId = t.getAttribute && t.getAttribute('data-node-id');
    if (nodeId !== null && nodeId !== undefined) {
      pickNode(Number(nodeId));
      return;
    }
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t) { return; }
    var field = t.getAttribute && t.getAttribute('data-field');
    var idx = t.getAttribute && t.getAttribute('data-idx');
    if (field && idx !== null && idx !== undefined) {
      var bi = Number(idx);
      if (boxes[bi]) {
        if (field === 'q') { boxes[bi].q = Number(t.value) || 0; }
        if (field === 'cause') { boxes[bi].cause = t.value; }
        markDirty();
        if (field === 'q') { drawBoxes(); }
      }
      return;
    }
    if (t.id === 'node-search') {
      renderNodeList(t.value);
    }
  });

  /* 离开页面前提醒（有未保存改动） */
  window.addEventListener('beforeunload', function (e) {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '有未保存的标注，确定离开？';
    }
  });

  /* ------------------------------------------------------------------
   * 起
   * ------------------------------------------------------------------ */
  function start(user) {
    if (!user) {
      nameEl.textContent = '要登录才看得到自己的切片';
      if (metaEl) { metaEl.innerHTML = '<a href="login.html?next=exam-slice-detail.html?id=' + SLICE_ID + '">去登录</a>'; }
      return;
    }
    if (!SLICE_ID) {
      nameEl.textContent = '不知道要看哪张切片';
      if (metaEl) { metaEl.innerHTML = '从 <a href="exam-slices.html" class="link-plain">考试切片列表</a> 里点进来。'; }
      return;
    }
    loadTree();
    loadSlice();
  }

  if (!AUTH) { start(null); return; }
  AUTH.ready().then(function (u) { start(u); }, function () { start(null); });
}());
