/* ByteKit · JSON tool */
(function () {
  "use strict";

  var BK = window.ByteKit;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var textarea = $("json-input");
  var indentSelect = $("json-indent");
  var statusEl = $("json-status");
  var errorBox = $("json-error");
  var errorText = $("json-error-text");
  var emptyNote = $("json-empty");
  var treeEl = $("json-tree-view");
  var textView = $("json-text-view");
  var copyBtn = $("json-copy");
  var downloadBtn = $("json-download");
  var statType = $("json-stat-type");
  var statKeys = $("json-stat-keys");
  var statDepth = $("json-stat-depth");
  var statSize = $("json-stat-size");
  var viewButtons = document.querySelectorAll("[data-json-view]");

  var editor = null;
  var currentView = "tree";
  var hasData = false;
  var mark = null;
  var suppress = false;
  var MAX_NODES = 4000;
  var nodeCount = 0;
  var truncated = false;

  function indentValue() {
    var value = indentSelect.value;
    return value === "tab" ? "\t" : parseInt(value, 10) || 2;
  }

  function getValue() {
    return editor ? editor.getValue() : textarea.value;
  }

  function setValue(value) {
    suppress = true;
    if (editor) editor.setValue(value);
    else textarea.value = value;
    suppress = false;
  }

  function focusEditor() {
    if (editor) editor.focus();
    else textarea.focus();
  }

  function setStatus(kind, label, icon) {
    statusEl.className = "status " + kind;
    statusEl.innerHTML = '<i class="bi ' + (icon || "bi-dot") + '"></i> ' + label;
  }

  function showEmpty(message) {
    emptyNote.textContent = message;
    emptyNote.hidden = false;
  }

  function hideEmpty() {
    emptyNote.hidden = true;
  }

  function clearMark() {
    if (mark) {
      mark.clear();
      mark = null;
    }
  }

  function clearError() {
    errorBox.hidden = true;
    errorText.textContent = "";
    clearMark();
  }

  function locate(message, value) {
    var posMatch = message.match(/position\s+(\d+)/i);
    if (posMatch) {
      var pos = Math.min(parseInt(posMatch[1], 10), value.length);
      var before = value.slice(0, pos);
      return {
        pos: pos,
        line: before.split("\n").length,
        col: pos - before.lastIndexOf("\n")
      };
    }
    var lineCol = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineCol) {
      return {
        pos: null,
        line: parseInt(lineCol[1], 10),
        col: parseInt(lineCol[2], 10)
      };
    }
    return null;
  }

  function indexFromLineCol(value, line, col) {
    var lines = value.split("\n");
    var index = 0;
    for (var i = 0; i < line - 1 && i < lines.length; i++) {
      index += lines[i].length + 1;
    }
    return Math.min(value.length, index + Math.max(0, col - 1));
  }

  function highlight(loc, value) {
    if (!editor || !loc || !value) return;
    clearMark();
    var pos =
      loc.pos !== null
        ? loc.pos
        : indexFromLineCol(value, loc.line, loc.col);
    if (pos >= value.length) pos = Math.max(0, value.length - 1);
    var from = editor.posFromIndex(pos);
    var to = editor.posFromIndex(Math.min(pos + 1, value.length));
    mark = editor.markText(from, to, { className: "cm-json-error" });
    editor.scrollIntoView({ line: from.line, ch: from.ch }, 80);
  }

  function reportError(error, value) {
    var message = error && error.message ? error.message : "JSON inválido";
    var loc = locate(message, value);
    var suffix =
      loc && !/line\s+\d+/i.test(message)
        ? " · línea " + loc.line + ", columna " + loc.col
        : "";
    errorText.textContent = message + suffix;
    errorBox.hidden = false;
    highlight(loc, value);
  }

  function resetStats() {
    statType.textContent = "—";
    statKeys.textContent = "0";
    statDepth.textContent = "0";
  }

  function clearViews() {
    hasData = false;
    treeEl.innerHTML = "";
    textView.textContent = "";
    treeEl.hidden = true;
    textView.hidden = true;
  }

  function applyView() {
    if (!hasData) {
      treeEl.hidden = true;
      textView.hidden = true;
      return;
    }
    treeEl.hidden = currentView !== "tree";
    textView.hidden = currentView !== "text";
  }

  function analyze(root) {
    var keys = 0;
    var depth = 1;
    var stack = [{ value: root, level: 1 }];

    while (stack.length) {
      var item = stack.pop();
      var value = item.value;
      if (value !== null && typeof value === "object") {
        if (item.level > depth) depth = item.level;
        if (Array.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            stack.push({ value: value[i], level: item.level + 1 });
          }
        } else {
          var names = Object.keys(value);
          keys += names.length;
          for (var j = 0; j < names.length; j++) {
            stack.push({ value: value[names[j]], level: item.level + 1 });
          }
        }
      } else if (item.level > depth) {
        depth = item.level;
      }
    }

    return { keys: keys, depth: depth };
  }

  function buildLeaf(key, value, isRoot, isIndex) {
    var wrap = document.createElement("div");
    wrap.className = "json-leaf";

    if (!isRoot) {
      var label = document.createElement("span");
      if (isIndex) {
        label.className = "json-idx";
        label.textContent = "[" + key + "]";
      } else {
        label.className = "json-key";
        label.textContent = '"' + key + '"';
      }
      wrap.appendChild(label);

      var colon = document.createElement("span");
      colon.className = "json-meta";
      colon.textContent = ": ";
      wrap.appendChild(colon);
    }

    var val = document.createElement("span");
    if (value === null) {
      val.className = "json-null";
      val.textContent = "null";
    } else if (typeof value === "string") {
      val.className = "json-string";
      val.textContent =
        '"' + (value.length > 240 ? value.slice(0, 240) + "…" : value) + '"';
    } else if (typeof value === "number") {
      val.className = "json-number";
      val.textContent = String(value);
    } else if (typeof value === "boolean") {
      val.className = "json-bool";
      val.textContent = String(value);
    } else {
      val.textContent = String(value);
    }

    wrap.appendChild(val);
    return wrap;
  }

  function buildEntry(key, value, depth, isRoot, isIndex) {
    nodeCount++;
    if (nodeCount > MAX_NODES) {
      truncated = true;
      return null;
    }

    if (value === null || typeof value !== "object") {
      return buildLeaf(key, value, isRoot, isIndex);
    }

    var isArray = Array.isArray(value);
    var names = isArray ? null : Object.keys(value);
    var length = isArray ? value.length : names.length;

    var details = document.createElement("details");
    details.open = depth < 2;

    var summary = document.createElement("summary");

    var label = document.createElement("span");
    if (isRoot) {
      label.className = "json-key";
      label.textContent = "root";
    } else if (isIndex) {
      label.className = "json-idx";
      label.textContent = "[" + key + "]";
    } else {
      label.className = "json-key";
      label.textContent = '"' + key + '"';
    }
    summary.appendChild(label);

    var meta = document.createElement("span");
    meta.className = "json-meta";
    meta.textContent = isArray
      ? "Array(" + length + ")"
      : "Object(" + length + ")";
    summary.appendChild(meta);

    details.appendChild(summary);

    var list = document.createElement("ul");
    for (var i = 0; i < length; i++) {
      if (nodeCount >= MAX_NODES) {
        truncated = true;
        break;
      }
      var child;
      var li = document.createElement("li");
      if (isArray) {
        child = buildEntry(i, value[i], depth + 1, false, true);
      } else {
        var name = names[i];
        child = buildEntry(name, value[name], depth + 1, false, false);
      }
      if (child) {
        li.appendChild(child);
        list.appendChild(li);
      }
    }
    details.appendChild(list);

    return details;
  }

  function renderTree(data) {
    treeEl.innerHTML = "";
    nodeCount = 0;
    truncated = false;

    var root = buildEntry(null, data, 0, true, false);
    if (root) treeEl.appendChild(root);

    if (truncated) {
      var note = document.createElement("div");
      note.className = "empty-note";
      note.textContent =
        "Árbol truncado a " +
        MAX_NODES.toLocaleString("es") +
        " nodos. Usa la pestaña Salida para ver el JSON completo.";
      treeEl.appendChild(note);
    }
  }

  function parseCurrent() {
    var value = getValue();
    if (!value.trim()) {
      return { ok: false, empty: true, value: value };
    }
    try {
      return { ok: true, data: JSON.parse(value), value: value };
    } catch (error) {
      return { ok: false, error: error, value: value };
    }
  }

  function update() {
    var value = getValue();
    var bytes = new TextEncoder().encode(value).length;
    var hasText = value.trim() !== "";

    statSize.textContent = BK.formatBytes(bytes);
    copyBtn.disabled = !hasText;
    downloadBtn.disabled = !hasText;

    clearError();

    if (!hasText) {
      setStatus("idle", "Esperando");
      resetStats();
      clearViews();
      showEmpty("Pega o escribe JSON para validarlo, formatearlo y explorarlo.");
      return;
    }

    try {
      var data = JSON.parse(value);
      hasData = true;
      setStatus("ok", "Válido", "bi-check2");

      var info = analyze(data);
      statType.textContent = Array.isArray(data)
        ? "array"
        : data === null
        ? "null"
        : typeof data;
      statKeys.textContent = info.keys.toLocaleString("es");
      statDepth.textContent = String(info.depth);

      hideEmpty();
      renderTree(data);
      textView.textContent = JSON.stringify(data, null, indentValue());
      applyView();
    } catch (error) {
      clearViews();
      resetStats();
      setStatus("err", "Inválido", "bi-x-circle");
      reportError(error, value);
      showEmpty("Corrige el error para ver el resultado.");
    }
  }

  function sortDeep(value) {
    if (Array.isArray(value)) {
      return value.map(sortDeep);
    }
    if (value !== null && typeof value === "object") {
      var sorted = {};
      Object.keys(value)
        .sort(function (a, b) {
          return a < b ? -1 : a > b ? 1 : 0;
        })
        .forEach(function (key) {
          sorted[key] = sortDeep(value[key]);
        });
      return sorted;
    }
    return value;
  }

  function handleParseFailure(result) {
    update();
    if (result.empty) BK.toast("Escribe JSON primero", "info");
    else BK.toast("JSON inválido", "error");
  }

  function formatJson() {
    var result = parseCurrent();
    if (!result.ok) {
      handleParseFailure(result);
      return;
    }
    setValue(JSON.stringify(result.data, null, indentValue()));
    update();
    BK.toast("JSON formateado");
    focusEditor();
  }

  function minifyJson() {
    var result = parseCurrent();
    if (!result.ok) {
      handleParseFailure(result);
      return;
    }
    setValue(JSON.stringify(result.data));
    update();
    BK.toast("JSON minificado");
    focusEditor();
  }

  function sortJson() {
    var result = parseCurrent();
    if (!result.ok) {
      handleParseFailure(result);
      return;
    }
    setValue(JSON.stringify(sortDeep(result.data), null, indentValue()));
    update();
    BK.toast("Claves ordenadas");
    focusEditor();
  }

  function validateJson() {
    var result = parseCurrent();
    update();
    if (result.ok) BK.toast("JSON válido");
    else if (result.empty) BK.toast("Escribe JSON primero", "info");
    else BK.toast("JSON inválido", "error");
  }

  $("json-format").addEventListener("click", formatJson);
  $("json-minify").addEventListener("click", minifyJson);
  $("json-sort").addEventListener("click", sortJson);
  $("json-validate").addEventListener("click", validateJson);

  $("json-example").addEventListener("click", function () {
    var sample = {
      herramienta: "ByteKit",
      version: "1.0.0",
      privado: true,
      herramientas: [
        { nombre: "MD5", tipo: "hash", bits: 128 },
        { nombre: "Base64", tipo: "codec" },
        { nombre: "JSON", tipo: "format" },
        { nombre: "SHA-256", tipo: "hash", bits: 256 }
      ],
      meta: {
        servidor: null,
        local: true,
        tags: ["dev", "tools", "browser"]
      }
    };
    indentSelect.value = "2";
    setValue(JSON.stringify(sample, null, 2));
    update();
    BK.toast("Ejemplo cargado");
    focusEditor();
  });

  $("json-clear").addEventListener("click", function () {
    setValue("");
    update();
    BK.toast("Editor limpiado", "info");
    focusEditor();
  });

  copyBtn.addEventListener("click", function () {
    var selected = editor ? editor.getSelection() : "";
    var value = selected || getValue();
    if (!value.trim()) {
      BK.toast("Nada que copiar todavía", "info");
      return;
    }
    BK.copy(value, copyBtn, selected ? "Selección copiada" : "JSON copiado");
  });

  downloadBtn.addEventListener("click", function () {
    var value = getValue();
    if (!value.trim()) {
      BK.toast("Nada que descargar todavía", "info");
      return;
    }
    BK.download("datos.json", value, "application/json;charset=utf-8");
  });

  viewButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      currentView = button.getAttribute("data-json-view");
      viewButtons.forEach(function (btn) {
        var active = btn === button;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      applyView();
    });
  });

  indentSelect.addEventListener("change", function () {
    if (editor) {
      var useTab = indentSelect.value === "tab";
      editor.setOption("indentWithTabs", useTab);
      editor.setOption("indentUnit", useTab ? 1 : parseInt(indentSelect.value, 10) || 2);
    }
    if (hasData) update();
  });

  document.addEventListener("keydown", function (event) {
    var mod = event.ctrlKey || event.metaKey;
    if (mod && event.key === "Enter") {
      event.preventDefault();
      formatJson();
    }
    if (mod && event.shiftKey && (event.key === "c" || event.key === "C")) {
      var selected = editor ? editor.getSelection() : "";
      var value = selected || getValue();
      if (!value.trim()) return;
      event.preventDefault();
      BK.copy(value, copyBtn, selected ? "Selección copiada" : "JSON copiado");
    }
  });

  var debouncedUpdate = BK.debounce(update, 280);

  function initEditor() {
    if (!window.CodeMirror) {
      textarea.addEventListener("input", debouncedUpdate);
      return;
    }
    editor = window.CodeMirror.fromTextArea(textarea, {
      mode: { name: "javascript", json: true },
      theme: "bytekit",
      lineNumbers: true,
      lineWrapping: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      indentUnit: 2,
      tabSize: 2,
      placeholder: "Pega tu JSON aquí..."
    });
    editor.setSize("100%", "100%");
    editor.on("change", function () {
      if (!suppress) debouncedUpdate();
    });
    document.addEventListener("bytekit:theme", function () {
      window.setTimeout(function () {
        editor.refresh();
      }, 40);
    });
  }

  initEditor();
  update();
})();
