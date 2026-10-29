/* ByteKit · SHA-256 tool */
(function () {
  "use strict";

  var BK = window.ByteKit;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var input = $("sha-input");
  var count = $("sha-count");
  var upper = $("sha-upper");
  var output = $("sha-output");
  var status = $("sha-status");
  var copyBtn = $("sha-copy");
  var compareInput = $("sha-compare");
  var compareStatus = $("sha-compare-status");
  var clearBtn = $("sha-clear");
  var batchWrap = $("sha-batch-wrap");
  var batchBody = $("sha-batch-body");
  var batchCount = $("sha-batch-count");
  var historyEl = $("sha-history");
  var historyCount = $("sha-history-count");
  var sourceButtons = document.querySelectorAll("[data-source]");
  var panes = document.querySelectorAll("[data-pane]");
  var dropzone = $("sha-drop");
  var fileInput = $("sha-file");
  var fileMeta = $("sha-file-meta");
  var progress = $("sha-progress");
  var progressBar = progress.querySelector("span");

  var mode = "text";
  var currentHash = "";
  var currentFile = null;
  var busy = false;

  function setStatus(kind, label, icon) {
    status.className = "status " + kind;
    status.innerHTML = '<i class="bi ' + (icon || "bi-dot") + '"></i> ' + label;
  }

  function displayHash() {
    if (!currentHash) return "";
    return upper.checked ? currentHash.toUpperCase() : currentHash.toLowerCase();
  }

  function paintHash() {
    if (!currentHash) {
      output.className = "result-box empty";
      output.textContent =
        mode === "file"
          ? "El hash del archivo aparecerá aquí."
          : "El hash aparecerá aquí mientras escribes.";
      copyBtn.disabled = true;
      updateCompare();
      return;
    }

    var shown = displayHash();
    output.className = "result-box has-value";
    output.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "hash-groups";
    BK.groupHash(shown, 8).forEach(function (group) {
      var span = document.createElement("span");
      span.textContent = group;
      wrap.appendChild(span);
    });
    output.appendChild(wrap);
    copyBtn.disabled = false;
    updateCompare();
  }

  function updateCompare() {
    var expected = compareInput.value.trim().toLowerCase();
    if (!expected) {
      compareStatus.className = "status idle";
      compareStatus.innerHTML = '<i class="bi bi-dash-circle"></i> Sin comparar';
      return;
    }
    if (!currentHash) {
      compareStatus.className = "status idle";
      compareStatus.innerHTML = '<i class="bi bi-dash-circle"></i> Sin hash';
      return;
    }
    var match = expected === currentHash.toLowerCase();
    compareStatus.className = "status " + (match ? "ok" : "err");
    compareStatus.innerHTML = match
      ? '<i class="bi bi-check-circle"></i> Coincide'
      : '<i class="bi bi-x-circle"></i> No coincide';
  }

  function renderBatch(text) {
    if (mode !== "text") return;

    var lines = text.split(/\r?\n/);
    var items = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        items.push({ index: i + 1, line: lines[i] });
      }
    }

    if (items.length < 2 || typeof sha256 === "undefined") {
      batchWrap.hidden = true;
      batchWrap.open = false;
      batchBody.innerHTML = "";
      batchCount.textContent = "0";
      return;
    }

    var wasHidden = batchWrap.hidden;
    batchWrap.hidden = false;
    batchCount.textContent = String(items.length);
    batchBody.innerHTML = "";

    var limit = Math.min(items.length, 200);
    for (var j = 0; j < limit; j++) {
      var item = items[j];
      var hash = sha256(item.line);
      var shown = upper.checked ? hash.toUpperCase() : hash;

      var tr = document.createElement("tr");

      var no = document.createElement("td");
      no.className = "line-no";
      no.textContent = String(item.index);

      var textCell = document.createElement("td");
      textCell.className = "line-text";
      textCell.textContent =
        item.line.length > 70 ? item.line.slice(0, 70) + "…" : item.line;
      if (item.line.length <= 200) textCell.title = item.line;

      var hashCell = document.createElement("td");
      hashCell.className = "line-hash";
      hashCell.textContent = shown;

      var actionCell = document.createElement("td");
      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "icon-btn xs";
      copy.setAttribute("aria-label", "Copiar hash de la línea " + item.index);
      copy.innerHTML = '<i class="bi bi-clipboard"></i>';
      copy.addEventListener(
        "click",
        (function (value) {
          return function () {
            BK.copy(value, copy);
          };
        })(shown)
      );
      actionCell.appendChild(copy);

      tr.appendChild(no);
      tr.appendChild(textCell);
      tr.appendChild(hashCell);
      tr.appendChild(actionCell);
      batchBody.appendChild(tr);
    }

    if (items.length > limit) {
      var noteRow = document.createElement("tr");
      var noteCell = document.createElement("td");
      noteCell.colSpan = 4;
      noteCell.className = "meta";
      noteCell.textContent =
        "Mostrando las primeras " + limit + " líneas de " + items.length + ".";
      noteRow.appendChild(noteCell);
      batchBody.appendChild(noteRow);
    }

    if (wasHidden && items.length <= 25) batchWrap.open = true;
  }

  function updateText() {
    var text = input.value;
    var bytes = new TextEncoder().encode(text).length;
    count.textContent =
      text.length.toLocaleString("es") +
      " caracteres · " +
      bytes.toLocaleString("es") +
      " bytes";

    if (!text) {
      currentHash = "";
      paintHash();
      setStatus("idle", "Esperando");
      renderBatch("");
      return;
    }

    if (typeof sha256 === "undefined") {
      currentHash = "";
      paintHash();
      setStatus("err", "Sin librería", "bi-exclamation-triangle");
      BK.toast("No se pudo cargar la librería SHA-256", "error");
      return;
    }

    currentHash = sha256(text);
    paintHash();
    setStatus("ok", "Listo", "bi-check2");
    renderBatch(text);
  }

  function renderHistory() {
    var list = BK.History.get("sha256");
    historyCount.textContent = String(list.length);
    historyEl.innerHTML = "";

    if (!list.length) {
      var empty = document.createElement("div");
      empty.className = "empty-note";
      empty.textContent = "Aún no hay hashes. Copia uno para guardarlo aquí.";
      historyEl.appendChild(empty);
      return;
    }

    list.forEach(function (entry) {
      var item = document.createElement("div");
      item.className = "history-item";

      var main = document.createElement("div");
      main.className = "hist-main";

      var preview = document.createElement("div");
      preview.className = "hist-preview";
      preview.textContent = entry.label || "(sin texto)";
      preview.title = entry.label || "";

      var hash = document.createElement("div");
      hash.className = "hist-hash";
      hash.textContent = entry.hash;

      main.appendChild(preview);
      main.appendChild(hash);

      var time = document.createElement("span");
      time.className = "hist-time";
      time.textContent = BK.timeAgo(entry.ts);

      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "icon-btn xs";
      copy.setAttribute("aria-label", "Copiar hash del historial");
      copy.innerHTML = '<i class="bi bi-clipboard"></i>';
      copy.addEventListener("click", function () {
        BK.copy(entry.hash, copy);
      });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn xs";
      remove.setAttribute("aria-label", "Eliminar del historial");
      remove.innerHTML = '<i class="bi bi-x-lg"></i>';
      remove.addEventListener("click", function () {
        BK.History.remove("sha256", entry.ts);
        renderHistory();
      });

      item.appendChild(main);
      item.appendChild(time);
      item.appendChild(copy);
      item.appendChild(remove);
      historyEl.appendChild(item);
    });
  }

  function addHistory() {
    if (!currentHash) return;
    var label =
      mode === "file" && currentFile
        ? currentFile.name
        : input.value.trim().slice(0, 90) || "(texto vacío)";
    BK.History.add("sha256", {
      hash: currentHash,
      label: label,
      meta: mode === "file" && currentFile ? BK.formatBytes(currentFile.size) : ""
    });
    renderHistory();
  }

  function paintFileMeta(file) {
    fileMeta.hidden = false;
    fileMeta.innerHTML = "";

    var icon = document.createElement("i");
    icon.className = "bi bi-file-earmark-binary";

    var main = document.createElement("div");
    main.className = "file-main";

    var name = document.createElement("div");
    name.className = "file-name";
    name.textContent = file.name;
    name.title = file.name;

    var sub = document.createElement("div");
    sub.className = "file-sub";
    sub.textContent =
      BK.formatBytes(file.size) + " · " + (file.type || "tipo desconocido");

    main.appendChild(name);
    main.appendChild(sub);

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn xs";
    remove.setAttribute("aria-label", "Quitar archivo");
    remove.innerHTML = '<i class="bi bi-x-lg"></i>';
    remove.addEventListener("click", function () {
      currentFile = null;
      currentHash = "";
      fileMeta.hidden = true;
      progress.hidden = true;
      progressBar.style.width = "0%";
      count.textContent = "0 caracteres · 0 bytes";
      paintHash();
      setStatus("idle", "Esperando archivo");
    });

    fileMeta.appendChild(icon);
    fileMeta.appendChild(main);
    fileMeta.appendChild(remove);
  }

  function handleFile(file) {
    if (busy) return;
    if (typeof sha256 === "undefined") {
      BK.toast("No se pudo cargar la librería SHA-256", "error");
      return;
    }

    busy = true;
    currentFile = file;
    currentHash = "";
    paintFileMeta(file);
    progress.hidden = false;
    progressBar.style.width = "0%";
    count.textContent = BK.formatBytes(file.size);
    output.className = "result-box empty";
    output.textContent = "Calculando hash del archivo…";
    setStatus("idle", "Calculando…", "bi-hourglass-split");

    BK.hashFile(file, sha256.create, function (percent) {
      progressBar.style.width = percent + "%";
    })
      .then(function (hash) {
        if (mode !== "file" || currentFile !== file) return;
        currentHash = hash;
        paintHash();
        setStatus("ok", "Listo", "bi-check2");
        progressBar.style.width = "100%";
        window.setTimeout(function () {
          progress.hidden = true;
        }, 450);
        addHistory();
      })
      .catch(function () {
        if (mode !== "file" || currentFile !== file) return;
        setStatus("err", "Error", "bi-exclamation-triangle");
        output.className = "result-box empty";
        output.textContent = "No se pudo leer el archivo.";
        BK.toast("No se pudo leer el archivo", "error");
      })
      .then(function () {
        busy = false;
      });
  }

  sourceButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      mode = button.getAttribute("data-source");
      sourceButtons.forEach(function (btn) {
        var active = btn === button;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      panes.forEach(function (pane) {
        pane.hidden = pane.getAttribute("data-pane") !== mode;
      });

      if (mode === "text") {
        currentFile = null;
        fileMeta.hidden = true;
        progress.hidden = true;
        updateText();
        input.focus();
      } else {
        currentHash = "";
        paintHash();
        setStatus("idle", "Esperando archivo");
        count.textContent = "0 caracteres · 0 bytes";
        renderBatch("");
      }
    });
  });

  input.addEventListener("input", BK.debounce(updateText, 90));
  upper.addEventListener("change", function () {
    paintHash();
    renderBatch(input.value);
  });
  compareInput.addEventListener("input", updateCompare);
  copyBtn.addEventListener("click", function () {
    if (!currentHash) return;
    BK.copy(displayHash(), copyBtn, "Hash copiado");
    addHistory();
  });
  clearBtn.addEventListener("click", function () {
    input.value = "";
    currentHash = "";
    currentFile = null;
    fileMeta.hidden = true;
    progress.hidden = true;
    progressBar.style.width = "0%";
    count.textContent = "0 caracteres · 0 bytes";
    compareInput.value = "";
    paintHash();
    setStatus("idle", "Esperando");
    renderBatch("");
    input.focus();
  });

  BK.initDropzone(dropzone, fileInput, handleFile);

  document.addEventListener("keydown", function (event) {
    var mod = event.ctrlKey || event.metaKey;
    if (mod && event.shiftKey && (event.key === "c" || event.key === "C")) {
      if (!currentHash) return;
      event.preventDefault();
      BK.copy(displayHash(), copyBtn, "Hash copiado");
      addHistory();
    }
    if (mod && !event.shiftKey && (event.key === "k" || event.key === "K")) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });

  renderHistory();
  paintHash();
})();
