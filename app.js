/* Clipped — upload, preview, trim. All processing stays in the browser. */
(function () {
  'use strict';

  var ACCEPTED = ['mp4', 'mov', 'webm', 'm4v'];
  var MIN_GAP = 0.1; // seconds between in/out points

  // ---- elements ----
  var $ = function (id) { return document.getElementById(id); };
  var dropzone = $('dropzone');
  var fileInput = $('fileInput');
  var btnChoose = $('btnChoose');
  var btnNew = $('btnNew');
  var editor = $('editor');
  var video = $('video');
  var timeline = $('timeline');
  var strip = $('strip');
  var shadeL = $('shadeL');
  var shadeR = $('shadeR');
  var range = $('range');
  var playhead = $('playhead');
  var handleIn = $('handleIn');
  var handleOut = $('handleOut');
  var gripIn = $('gripIn');
  var gripOut = $('gripOut');
  var btnPlay = $('btnPlay');
  var btnSetIn = $('btnSetIn');
  var btnSetOut = $('btnSetOut');
  var chkLoop = $('chkLoop');

  // ---- state ----
  var url = null;
  var duration = 0;
  var inPoint = 0;
  var outPoint = 0;
  var dragging = null; // 'in' | 'out' | 'scrub' | null
  var stripToken = 0;  // cancels stale filmstrip jobs

  // ---- helpers ----
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    var d = Math.floor((t % 1) * 10);
    return m + ':' + String(s).padStart(2, '0') + '.' + d;
  }

  function fmtSize(b) {
    if (b > 1e9) return (b / 1e9).toFixed(2) + ' GB';
    if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
    return Math.round(b / 1e3) + ' KB';
  }

  function pct(t) { return duration ? (t / duration) * 100 : 0; }

  // ---- load a file ----
  function loadFile(f) {
    if (!f) return;
    var ext = f.name.split('.').pop().toLowerCase();
    if (f.type.indexOf('video/') !== 0 && ACCEPTED.indexOf(ext) === -1) {
      showNotice('Please choose a video file (mp4, mov, webm, or m4v).');
      return;
    }
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f);
    video.src = url;

    $('metaName').textContent = f.name;
    $('metaSize').textContent = fmtSize(f.size);
    $('metaDims').textContent = '';
    $('metaDur').textContent = '';

    dropzone.classList.add('hidden');
    editor.classList.remove('hidden');
    btnNew.classList.remove('hidden');
  }

  var noticeTimer = null;
  function showNotice(msg) {
    var n = document.querySelector('.notice');
    if (!n) {
      n = document.createElement('div');
      n.className = 'notice';
      n.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
        'background:#2a2f3a;color:#eef1f6;padding:10px 18px;border-radius:12px;' +
        'font-size:14px;z-index:99;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:90vw;text-align:center;';
      document.body.appendChild(n);
    }
    n.textContent = msg;
    n.style.display = 'block';
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { n.style.display = 'none'; }, 3500);
  }

  video.addEventListener('loadedmetadata', function () {
    duration = video.duration;
    inPoint = 0;
    outPoint = duration;
    $('metaDims').textContent = video.videoWidth + '×' + video.videoHeight;
    $('metaDur').textContent = fmt(duration) + ' total';
    $('lblTotal').textContent = fmt(duration);
    render();
    buildFilmstrip();
  });

  video.addEventListener('error', function () {
    if (!url) return;
    showNotice("This video format couldn't be played by your browser. Try an MP4 or WebM file.");
    resetToUpload();
  });

  // ---- filmstrip thumbnails ----
  function buildFilmstrip() {
    var token = ++stripToken;
    strip.innerHTML = '';
    if (!duration) return;

    var vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.preload = 'auto';

    function whenReady(cb) {
      if (vid.readyState >= 2) cb();
      else vid.addEventListener('loadeddata', cb, { once: true });
    }

    whenReady(function () {
      if (token !== stripToken) return;
      var h = strip.clientHeight || 64;
      var aspect = (vid.videoWidth || 16) / (vid.videoHeight || 9);
      var thumbW = Math.max(40, Math.round(h * aspect));
      var count = Math.max(4, Math.ceil(strip.clientWidth / thumbW));
      var i = 0;

      function next() {
        if (token !== stripToken || i >= count) {
          vid.removeAttribute('src');
          vid.load();
          return;
        }
        var t = ((i + 0.5) / count) * duration;
        var done = false;
        var finish = function () {
          if (done || token !== stripToken) return;
          done = true;
          var c = document.createElement('canvas');
          c.width = thumbW;
          c.height = h;
          c.style.width = (100 / count) + '%';
          try { c.getContext('2d').drawImage(vid, 0, 0, thumbW, h); } catch (e) {}
          strip.appendChild(c);
          i++;
          next();
        };
        vid.addEventListener('seeked', finish, { once: true });
        setTimeout(finish, 900); // don't hang on a stubborn frame
        vid.currentTime = Math.min(t, Math.max(0, duration - 0.05));
      }
      next();
    });
  }

  // ---- render timeline ----
  function render() {
    var cur = video.currentTime || 0;
    shadeL.style.left = '0';
    shadeL.style.width = pct(inPoint) + '%';
    shadeR.style.left = pct(outPoint) + '%';
    shadeR.style.right = '0';
    range.style.left = pct(inPoint) + '%';
    range.style.width = pct(outPoint - inPoint) + '%';
    playhead.style.left = pct(cur) + '%';
    handleIn.style.left = pct(inPoint) + '%';
    handleOut.style.left = pct(outPoint) + '%';
    gripIn.textContent = fmt(inPoint);
    gripOut.textContent = fmt(outPoint);
    $('lblCurrent').textContent = fmt(cur);
    $('sumIn').textContent = fmt(inPoint);
    $('sumOut').textContent = fmt(outPoint);
    $('sumLen').textContent = fmt(Math.max(0, outPoint - inPoint));
    btnPlay.textContent = video.paused ? '▶' : '⏸';
  }

  // playback loop: keep playhead moving + loop trimmed range
  function tick() {
    if (duration) {
      if (chkLoop.checked && !video.paused && video.currentTime >= outPoint - 0.03) {
        video.currentTime = inPoint;
      }
      render();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---- timeline interaction ----
  function timeFromEvent(e) {
    var rect = timeline.getBoundingClientRect();
    var x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    return (x / rect.width) * duration;
  }

  handleIn.addEventListener('pointerdown', function (e) {
    e.preventDefault(); e.stopPropagation();
    dragging = 'in';
    timeline.setPointerCapture(e.pointerId);
  });

  handleOut.addEventListener('pointerdown', function (e) {
    e.preventDefault(); e.stopPropagation();
    dragging = 'out';
    timeline.setPointerCapture(e.pointerId);
  });

  timeline.addEventListener('pointerdown', function (e) {
    if (dragging) return; // a handle grabbed it first
    dragging = 'scrub';
    timeline.setPointerCapture(e.pointerId);
    video.currentTime = timeFromEvent(e);
    render();
  });

  timeline.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var t = timeFromEvent(e);
    if (dragging === 'in') {
      inPoint = Math.max(0, Math.min(t, outPoint - MIN_GAP));
      video.currentTime = inPoint;
    } else if (dragging === 'out') {
      outPoint = Math.min(duration, Math.max(t, inPoint + MIN_GAP));
      video.currentTime = outPoint;
    } else {
      video.currentTime = t;
    }
    render();
  });

  function endDrag() { dragging = null; }
  timeline.addEventListener('pointerup', endDrag);
  timeline.addEventListener('pointercancel', endDrag);

  // ---- controls ----
  function togglePlay() {
    if (!duration) return;
    if (video.paused) {
      if (chkLoop.checked && (video.currentTime < inPoint || video.currentTime >= outPoint - 0.05)) {
        video.currentTime = inPoint;
      }
      video.play();
    } else {
      video.pause();
    }
  }

  btnPlay.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  video.addEventListener('play', render);
  video.addEventListener('pause', render);

  btnSetIn.addEventListener('click', function () {
    inPoint = Math.max(0, Math.min(video.currentTime, outPoint - MIN_GAP));
    render();
  });

  btnSetOut.addEventListener('click', function () {
    outPoint = Math.min(duration, Math.max(video.currentTime, inPoint + MIN_GAP));
    render();
  });

  document.addEventListener('keydown', function (e) {
    if (editor.classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.key === 'i') { btnSetIn.click(); }
    if (e.key === 'o') { btnSetOut.click(); }
    if (e.key === 'ArrowLeft') { video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 1 : 1 / 30)); render(); }
    if (e.key === 'ArrowRight') { video.currentTime = Math.min(duration, video.currentTime + (e.shiftKey ? 1 : 1 / 30)); render(); }
  });

  // ---- upload wiring ----
  btnChoose.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { loadFile(fileInput.files[0]); });

  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    loadFile(e.dataTransfer.files[0]);
  });

  // dropping a new file anywhere while editing swaps the video
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    if (!editor.classList.contains('hidden') && e.dataTransfer.files.length) {
      loadFile(e.dataTransfer.files[0]);
    }
  });

  function resetToUpload() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (url) { URL.revokeObjectURL(url); url = null; }
    duration = 0;
    stripToken++;
    strip.innerHTML = '';
    fileInput.value = '';
    editor.classList.add('hidden');
    btnNew.classList.add('hidden');
    dropzone.classList.remove('hidden');
  }

  btnNew.addEventListener('click', resetToUpload);
})();
