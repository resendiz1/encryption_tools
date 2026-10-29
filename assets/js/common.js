/* ByteKit · shared utilities */
(function () {
  "use strict";

  var THEME_KEY = "bytekit:theme";
  var root = document.documentElement;

  function readTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function paintTheme(theme) {
    root.setAttribute("data-bs-theme", theme);

    var buttons = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var icon = btn.querySelector("[data-theme-icon]");
      var label = btn.querySelector("[data-theme-label]");
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
      );
      btn.setAttribute(
        "title",
        theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
      );
      if (icon) icon.className = theme === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
      if (label) label.textContent = theme === "dark" ? "Tema claro" : "Tema oscuro";
    }

    document.dispatchEvent(
      new CustomEvent("bytekit:theme", { detail: { theme: theme } })
    );
  }

  function setTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    paintTheme(theme);
  }

  function initTheme() {
    paintTheme(readTheme());
    document.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-theme-toggle]");
      if (!btn) return;
      var next = root.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
      setTheme(next);
    });
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        try {
          if (localStorage.getItem(THEME_KEY)) return;
        } catch (e) {}
        paintTheme(mq.matches ? "dark" : "light");
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---------- toasts ---------- */
  function toast(message, type) {
    var stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    var el = document.createElement("div");
    el.className = "bk-toast" + (type === "error" ? " error" : "");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");

    var icon = document.createElement("i");
    icon.className =
      type === "error"
        ? "bi bi-x-circle"
        : type === "info"
        ? "bi bi-info-circle"
        : "bi bi-check-circle";
    var text = document.createElement("span");
    text.textContent = message;

    el.appendChild(icon);
    el.appendChild(text);
    stack.appendChild(el);

    window.setTimeout(function () {
      el.classList.add("out");
      window.setTimeout(function () {
        el.remove();
      }, 220);
    }, 2200);
  }

  /* ---------- clipboard ---------- */
  function copyRaw(text) {
    if (text === null || text === undefined) return Promise.resolve(false);

    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function flashCopied(button) {
    var icon = button.querySelector("i");
    var previous = icon ? icon.className : null;
    button.classList.add("copied");
    if (icon) icon.className = "bi bi-check2";
    window.setTimeout(function () {
      button.classList.remove("copied");
      if (icon && previous) icon.className = previous;
    }, 1400);
  }

  function copy(text, button, message) {
    if (!text) {
      toast("Nada que copiar todavía", "info");
      return Promise.resolve(false);
    }
    return copyRaw(text).then(function (ok) {
      if (ok) {
        if (button) flashCopied(button);
        toast(message || "Copiado al portapapeles");
      } else {
        toast("No se pudo copiar al portapapeles", "error");
      }
      return ok;
    });
  }

  function bindCopy(button, getText, message) {
    button.addEventListener("click", function () {
      var text = typeof getText === "function" ? getText() : getText;
      copy(text, button, message);
    });
  }

  /* ---------- files ---------- */
  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    var value = bytes / Math.pow(1024, i);
    var shown = i === 0 || value >= 10 ? Math.round(value) : value.toFixed(1);
    return shown + " " + units[i];
  }

  function readSlice(slice) {
    if (slice.arrayBuffer) return slice.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error("No se pudo leer el archivo."));
      };
      reader.readAsArrayBuffer(slice);
    });
  }

  function hashFile(file, factory, onProgress) {
    var chunkSize = 4 * 1024 * 1024;
    var hasher = factory();
    var offset = 0;

    if (!file || file.size === 0) {
      return Promise.resolve(hasher.hex());
    }

    function step() {
      var end = Math.min(offset + chunkSize, file.size);
      return readSlice(file.slice(offset, end)).then(function (buffer) {
        hasher.update(new Uint8Array(buffer));
        offset = end;
        if (onProgress) {
          onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
        }
        if (offset >= file.size) return hasher.hex();
        return new Promise(function (resolve) {
          window.setTimeout(resolve, 0);
        }).then(step);
      });
    }

    return step();
  }

  function initDropzone(zone, input, onFile) {
    if (!zone || !input) return;

    zone.addEventListener("click", function () {
      input.click();
    });
    zone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });

    ["dragenter", "dragover"].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.remove("dragover");
      });
    });

    zone.addEventListener("drop", function (event) {
      var file = event.dataTransfer && event.dataTransfer.files[0];
      if (file) onFile(file);
    });

    input.addEventListener("change", function () {
      if (input.files && input.files[0]) onFile(input.files[0]);
      input.value = "";
    });
  }

  function download(filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], {
      type: mime || "text/plain;charset=utf-8"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1200);
  }

  /* ---------- misc ---------- */
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(ctx, args);
      }, wait);
    };
  }

  function groupHash(hash, size) {
    if (!hash) return [];
    var n = size || 8;
    var groups = [];
    for (var i = 0; i < hash.length; i += n) {
      groups.push(hash.slice(i, i + n));
    }
    return groups;
  }

  function timeAgo(timestamp) {
    var diff = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diff < 60) return "ahora";
    if (diff < 3600) return "hace " + Math.floor(diff / 60) + " min";
    if (diff < 86400) return "hace " + Math.floor(diff / 3600) + " h";
    return "hace " + Math.floor(diff / 86400) + " d";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- history ---------- */
  var History = {
    prefix: "bytekit:history:",
    limit: 8,
    get: function (tool) {
      try {
        var list = JSON.parse(localStorage.getItem(this.prefix + tool) || "[]");
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    },
    save: function (tool, list) {
      try {
        localStorage.setItem(this.prefix + tool, JSON.stringify(list));
      } catch (e) {}
      return list;
    },
    add: function (tool, entry) {
      var list = this.get(tool).filter(function (item) {
        return item.hash !== entry.hash;
      });
      list.unshift({
        hash: entry.hash,
        label: entry.label || "",
        meta: entry.meta || "",
        ts: Date.now()
      });
      return this.save(tool, list.slice(0, this.limit));
    },
    remove: function (tool, ts) {
      var list = this.get(tool).filter(function (item) {
        return item.ts !== ts;
      });
      return this.save(tool, list);
    },
    clear: function (tool) {
      try {
        localStorage.removeItem(this.prefix + tool);
      } catch (e) {}
    }
  };

  window.ByteKit = {
    theme: {
      init: initTheme,
      get: function () {
        return root.getAttribute("data-bs-theme");
      },
      set: setTheme
    },
    toast: toast,
    copy: copy,
    copyRaw: copyRaw,
    bindCopy: bindCopy,
    flashCopied: flashCopied,
    formatBytes: formatBytes,
    hashFile: hashFile,
    initDropzone: initDropzone,
    download: download,
    debounce: debounce,
    groupHash: groupHash,
    timeAgo: timeAgo,
    escapeHtml: escapeHtml,
    History: History
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }
})();
