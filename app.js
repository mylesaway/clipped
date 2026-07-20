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
  var file = null;
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
    file = f;
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
    file = null;
    closeExport();
    duration = 0;
    stripToken++;
    strip.innerHTML = '';
    fileInput.value = '';
    editor.classList.add('hidden');
    btnNew.classList.add('hidden');
    dropzone.classList.remove('hidden');
  }

  btnNew.addEventListener('click', resetToUpload);

  // ---- export (ffmpeg.wasm, runs entirely in the browser) ----
  var fmtSelect = $('fmtSelect');
  var btnExport = $('btnExport');
  var exportCard = $('exportCard');
  var exportProgress = $('exportProgress');
  var exportResult = $('exportResult');
  var exportStatus = $('exportStatus');
  var progressFill = $('progressFill');

  var ffmpeg = null;        // FFmpeg instance, kept warm between exports
  var exporting = false;
  var cancelled = false;
  var resultUrl = null;
  var resultFmt = null; // format of the finished export, so re-downloads name it right

  // progress reported by parsing ffmpeg's own log lines, scaled to the
  // window [from..to] so multi-pass exports (GIF) show one smooth bar
  var progWindow = { from: 0, to: 1, clipLen: 1 };

  function setProgress(ratio) {
    var p = Math.max(0, Math.min(1, ratio));
    progressFill.style.width = (p * 100).toFixed(1) + '%';
  }

  function onFfmpegLog(e) {
    var m = /time=\s*(\d+):(\d+):(\d+\.?\d*)/.exec(e.message || '');
    if (!m) return;
    var t = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
    var local = Math.min(1, t / progWindow.clipLen);
    setProgress(progWindow.from + local * (progWindow.to - progWindow.from));
  }

  function getFFmpeg() {
    if (ffmpeg) return Promise.resolve(ffmpeg);
    if (!window.FFmpegWASM) {
      return Promise.reject(new Error('engine script missing'));
    }
    var inst = new window.FFmpegWASM.FFmpeg();
    inst.on('log', onFfmpegLog);
    exportStatus.textContent = 'Loading the video engine (first time only, ~30 MB)…';
    return inst.load({
      coreURL: new URL('vendor/ffmpeg/ffmpeg-core.js', location.href).toString(),
      wasmURL: new URL('vendor/ffmpeg/ffmpeg-core.wasm', location.href).toString()
    }).then(function () {
      ffmpeg = inst;
      return inst;
    });
  }

  function trimArgs(inputName) {
    return ['-ss', inPoint.toFixed(3), '-to', outPoint.toFixed(3), '-i', inputName];
  }

  function runExport(fmt, inputName) {
    var outName = 'out.' + fmt;
    if (fmt === 'mp4') {
      exportStatus.textContent = 'Exporting HD MP4…';
      progWindow = { from: 0, to: 1, clipLen: outPoint - inPoint };
      return ffmpeg.exec(trimArgs(inputName).concat([
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-y', outName
      ])).then(function () { return outName; });
    }
    if (fmt === 'webp') {
      exportStatus.textContent = 'Exporting animated WebP…';
      progWindow = { from: 0, to: 1, clipLen: outPoint - inPoint };
      return ffmpeg.exec(trimArgs(inputName).concat([
        '-vcodec', 'libwebp', '-filter:v', 'fps=20',
        '-lossless', '0', '-q:v', '75', '-loop', '0', '-an', '-y', outName
      ])).then(function () { return outName; });
    }
    // gif: two passes — build a color palette first, then use it (much better quality)
    var vf = 'fps=15,scale=min(1080\\,iw):-1:flags=lanczos';
    exportStatus.textContent = 'Preparing GIF colors…';
    progWindow = { from: 0, to: 0.35, clipLen: outPoint - inPoint };
    return ffmpeg.exec(trimArgs(inputName).concat([
      '-vf', vf + ',palettegen=stats_mode=diff', '-y', 'palette.png'
    ])).then(function () {
      if (cancelled) throw new Error('cancelled');
      exportStatus.textContent = 'Exporting GIF…';
      progWindow = { from: 0.35, to: 1, clipLen: outPoint - inPoint };
      return ffmpeg.exec(trimArgs(inputName).concat([
        '-i', 'palette.png',
        '-lavfi', vf + ',paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
        '-y', outName
      ]));
    }).then(function () { return outName; });
  }

  function exportClip() {
    if (exporting || !file || !duration) return;
    exporting = true;
    cancelled = false;
    var fmt = fmtSelect.value;
    btnExport.disabled = true;
    exportCard.classList.remove('hidden');
    exportProgress.classList.remove('hidden');
    exportResult.classList.add('hidden');
    setProgress(0);
    exportCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    var ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
    if (ACCEPTED.indexOf(ext) === -1) ext = 'mp4';
    var inputName = 'input.' + ext;

    getFFmpeg().then(function () {
      if (cancelled) throw new Error('cancelled');
      exportStatus.textContent = 'Reading your video…';
      return file.arrayBuffer();
    }).then(function (buf) {
      if (cancelled) throw new Error('cancelled');
      return ffmpeg.writeFile(inputName, new Uint8Array(buf));
    }).then(function () {
      if (cancelled) throw new Error('cancelled');
      return runExport(fmt, inputName);
    }).then(function (outName) {
      if (cancelled) throw new Error('cancelled');
      return ffmpeg.readFile(outName);
    }).then(function (data) {
      if (cancelled) throw new Error('cancelled');
      setProgress(1);
      var mime = fmt === 'mp4' ? 'video/mp4' : fmt === 'webp' ? 'image/webp' : 'image/gif';
      finishExport(new Blob([data.buffer], { type: mime }), fmt);
    }).catch(function (err) {
      exporting = false;
      btnExport.disabled = false;
      if (cancelled) { exportCard.classList.add('hidden'); return; }
      exportCard.classList.add('hidden');
      showNotice('Export didn’t work for this video. Try MP4 format, or a shorter clip.');
      if (window.console) console.error('export failed:', err);
    });
  }

  function downloadName(fmt) {
    var base = (file && file.name ? file.name : 'clip').replace(/\.[^.]+$/, '');
    return base + '-clip.' + fmt;
  }

  function finishExport(blob, fmt) {
    exporting = false;
    btnExport.disabled = false;
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    resultFmt = fmt;

    var preview = $('resultPreview');
    preview.innerHTML = '';
    if (fmt === 'mp4') {
      var v = document.createElement('video');
      v.src = resultUrl;
      v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
      preview.appendChild(v);
    } else {
      var img = document.createElement('img');
      img.src = resultUrl;
      img.alt = 'Exported clip';
      preview.appendChild(img);
    }

    $('resultName').textContent = downloadName(fmt);
    $('resultSize').textContent = fmtSize(blob.size);
    exportProgress.classList.add('hidden');
    exportResult.classList.remove('hidden');
    triggerDownload();
  }

  function triggerDownload() {
    if (!resultUrl) return;
    var a = document.createElement('a');
    a.href = resultUrl;
    a.download = downloadName(resultFmt);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function closeExport() {
    exportCard.classList.add('hidden');
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    $('resultPreview').innerHTML = '';
  }

  btnExport.addEventListener('click', exportClip);
  $('btnDownloadAgain').addEventListener('click', triggerDownload);
  $('btnCloseExport').addEventListener('click', closeExport);
  $('btnCancelExport').addEventListener('click', function () {
    if (!exporting) { exportCard.classList.add('hidden'); return; }
    cancelled = true;
    // terminate kills the worker mid-job; a fresh engine is loaded on next export
    if (ffmpeg) { try { ffmpeg.terminate(); } catch (e) {} ffmpeg = null; }
    exporting = false;
    btnExport.disabled = false;
    exportCard.classList.add('hidden');
  });
})();
