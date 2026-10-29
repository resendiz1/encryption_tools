/* ByteKit · Base64 tool */
(function () {
  "use strict";

  var BK = window.ByteKit;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var input = $("b64-input");
  var output = $("b64-output");
  var urlSafe = $("b64-urlsafe");
  var inputMeta = $("b64-input-meta");
  var outputMeta = $("b64-output-meta");
  var state = $("b64-state");
  var errorBox = $("b64-error");
  var errorText = $("b64-error-text");
  var copyBtn = $("b64-copy");
  var downloadBtn = $("b64-download");
  var exampleBtn = $("b64-example");
  var clearBtn = $("b64-clear");
  var modeButtons = document.querySelectorAll("[data-b64-mode]");
  var fileBlock = $("b64-file-block");
  var dropzone = $("b64-drop");
  var fileInput = $("b64-file");
  var fileMeta = $("b64-file-meta");

  var mode = "encode";
  var currentFile = null;
  var fileBase64 = "";

  function byteLength(value) {
    return new TextEncoder().encode(value).length;
  }

  function setState(kind, label, icon) {
    state.className = "status " + kind;
    state.innerHTML = '<i class="bi ' + (icon || "bi-dot") + '"></i> ' + label;
  }

  function setOutput(value) {
    output.value = value || "";
    var has = !!output.value;
    copyBtn.disabled = !has;
    downloadBtn.disabled = !has;
    outputMeta.textContent = has
      ? BK.formatBytes(byteLength(output.value))
      : "0 bytes";
    output.scrollTop = 0;
  }

  function showError(message) {
    errorBox.hidden = false;
    errorText.textContent = message;
    input.classList.add("field-error");
  }

  function clearError() {
    errorBox.hidden = true;
    errorText.textContent = "";
    input.classList.remove("field-error");
  }

  function toUrlSafe(value) {
    return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromUrlSafe(value) {
    var normalized = value
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    if (normalized.length % 4 === 1) {
      throw new Error("La longitud del Base64 no es válida.");
    }
    while (normalized.length % 4) normalized += "=";
    return normalized;
  }

  function bytesToBinary(bytes) {
    var binary = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return binary;
  }

  function encodeText(value) {
    var bytes = new TextEncoder().encode(value);
    var encoded = btoa(bytesToBinary(bytes));
    return urlSafe.checked ? toUrlSafe(encoded) : encoded;
  }

  function decodeText(value) {
    var normalized = fromUrlSafe(value);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      throw new Error("El texto contiene caracteres que no son Base64.");
    }

    var binary;
    try {
      binary = atob(normalized);
    } catch (e) {
      throw new Error("No se pudo decodificar: Base64 inválido.");
    }

    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (e) {
      throw new Error("El Base64 es válido, pero no contiene texto UTF-8.");
    }
  }

  function updateFromText() {
    clearError();
    if (currentFile) {
      currentFile = null;
      fileBase64 = "";
      fileMeta.hidden = true;
    }

    var text = input.value;
    inputMeta.textContent = text
      ? BK.formatBytes(byteLength(text))
      : "0 bytes";

    if (!text) {
      setOutput("");
      setState("idle", "Esperando");
      return;
    }

    try {
      var result = mode === "encode" ? encodeText(text) : decodeText(text);
      setOutput(result);
      setState("ok", "Listo", "bi-check2");
    } catch (error) {
      setOutput("");
      showError(error.message);
      setState("err", "Error", "bi-exclamation-triangle");
    }
  }

  function paintFileMeta(file, dataUrl) {
    fileMeta.hidden = false;
    fileMeta.innerHTML = "";

    var thumb;
    if (file.type && file.type.indexOf("image/") === 0) {
      thumb = document.createElement("img");
      thumb.className = "file-thumb";
      thumb.src = dataUrl;
      thumb.alt = "";
    } else {
      thumb = document.createElement("i");
      thumb.className = "bi bi-file-earmark-binary";
    }

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
      fileBase64 = "";
      fileMeta.hidden = true;
      inputMeta.textContent = "0 bytes";
      setOutput("");
      setState("idle", "Esperando");
    });

    fileMeta.appendChild(thumb);
    fileMeta.appendChild(main);
    fileMeta.appendChild(remove);
  }

  function renderFileOutput() {
    if (!fileBase64) return;
    var result = urlSafe.checked ? toUrlSafe(fileBase64) : fileBase64;
    setOutput(result);
    setState("ok", "Listo", "bi-check2");
  }

  function handleFile(file) {
    if (mode !== "encode") return;

    clearError();
    input.value = "";
    currentFile = file;
    inputMeta.textContent = BK.formatBytes(file.size);

    var reader = new FileReader();
    reader.onload = function () {
      if (mode !== "encode" || currentFile !== file) return;
      var dataUrl = String(reader.result || "");
      var comma = dataUrl.indexOf(",");
      fileBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
      paintFileMeta(file, dataUrl);
      renderFileOutput();
    };
    reader.onerror = function () {
      BK.toast("No se pudo leer el archivo", "error");
      setState("err", "Error", "bi-exclamation-triangle");
    };
    reader.readAsDataURL(file);
  }

  function setMode(next, focus) {
    mode = next;
    modeButtons.forEach(function (button) {
      var active = button.getAttribute("data-b64-mode") === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    fileBlock.hidden = mode !== "encode";
    currentFile = null;
    fileBase64 = "";
    fileMeta.hidden = true;
    input.value = "";
    input.placeholder =
      mode === "encode"
        ? "Escribe o pega el texto que quieres codificar..."
        : "Pega el Base64 que quieres decodificar...";
    inputMeta.textContent = "0 bytes";
    clearError();
    setOutput("");
    setState("idle", "Esperando");
    if (focus) input.focus();
  }

  modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setMode(button.getAttribute("data-b64-mode"), true);
    });
  });

  input.addEventListener("input", updateFromText);

  urlSafe.addEventListener("change", function () {
    if (currentFile) renderFileOutput();
    else updateFromText();
  });

  exampleBtn.addEventListener("click", function () {
    input.value =
      mode === "encode" ? "Hola, mundo 👋" : "SG9sYSwgbXVuZG8g8J+Riw==";
    updateFromText();
  });

  clearBtn.addEventListener("click", function () {
    currentFile = null;
    fileBase64 = "";
    fileMeta.hidden = true;
    input.value = "";
    inputMeta.textContent = "0 bytes";
    clearError();
    setOutput("");
    setState("idle", "Esperando");
    input.focus();
  });

  copyBtn.addEventListener("click", function () {
    BK.copy(output.value, copyBtn, "Resultado copiado");
  });

  downloadBtn.addEventListener("click", function () {
    if (!output.value) return;
    BK.download(
      mode === "encode" ? "base64.txt" : "decodificado.txt",
      output.value,
      "text/plain;charset=utf-8"
    );
  });

  BK.initDropzone(dropzone, fileInput, handleFile);

  document.addEventListener("keydown", function (event) {
    var mod = event.ctrlKey || event.metaKey;
    if (mod && event.shiftKey && (event.key === "c" || event.key === "C")) {
      if (!output.value) return;
      event.preventDefault();
      BK.copy(output.value, copyBtn, "Resultado copiado");
    }
    if (mod && !event.shiftKey && (event.key === "k" || event.key === "K")) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });

  setOutput("");
  setState("idle", "Esperando");
})();
