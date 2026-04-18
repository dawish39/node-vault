// ════════════════════════════════════════════════
//  node-vault — Code.gs  v3
//  Execute as: Me | Access: Anyone with Google account
//
//  Script Properties（專案設定 → 指令碼屬性）：
//    NODE_FOLDER_ID   → 節點 MD 存放資料夾 ID
//    INDEX_FOLDER_ID  → _node-index.md 所在資料夾 ID
//    INDEX_FILENAME   → _node-index.md
// ════════════════════════════════════════════════

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    NODE_FOLDER_ID:  props.getProperty("NODE_FOLDER_ID"),
    INDEX_FOLDER_ID: props.getProperty("INDEX_FOLDER_ID"),
    INDEX_FILENAME:  props.getProperty("INDEX_FILENAME") || "_node-index.md"
  };
}

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile("index")
    .setTitle("node-vault")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ── upload：單檔處理，前端 loop 逐一呼叫 ─────────
function upload(payload) {
  try {
    var cfg      = getConfig();
    var filename = payload.filename;
    var keywords = parseCSV(payload.keywords);
    var seeAlso  = parseCSV(payload.seeAlso);
    var today    = formatDate(new Date());

    if (!cfg.NODE_FOLDER_ID || !cfg.INDEX_FOLDER_ID)
      throw new Error("Script Properties 尚未設定，請先填入 NODE_FOLDER_ID 與 INDEX_FOLDER_ID。");
    if (keywords.length === 0)
      throw new Error("keywords 為必填。");

    var date         = extractFrontmatterDate(payload.content) || today;
    var content      = stripFrontmatter(payload.content);
    var fm           = buildFrontmatter(date, keywords, seeAlso);
    var finalContent = convertSeeLinks(fm + content);
    var indexLine    = buildIndexLine(date, keywords, filename);
    var isDuplicate  = checkDuplicate(cfg, filename);

    uploadToDrive(cfg, filename, finalContent);
    appendToIndex(cfg, indexLine);

    return { ok: true, filename: filename, message: "完成", warn: isDuplicate ? "duplicate" : null };
  } catch (e) {
    return { ok: false, filename: payload.filename, message: e.message };
  }
}

// ── deleteNode：從 Drive 刪檔並從索引移除對應行 ──
function deleteNode(filename) {
  try {
    var cfg       = getConfig();
    var nameNoExt = filename.replace(/\.md$/, "");

    var nodeFolder = DriveApp.getFolderById(cfg.NODE_FOLDER_ID);
    var nodeFiles  = nodeFolder.getFilesByName(filename);
    if (nodeFiles.hasNext()) nodeFiles.next().setTrashed(true);

    var idxFolder = DriveApp.getFolderById(cfg.INDEX_FOLDER_ID);
    var idxFiles  = idxFolder.getFilesByName(cfg.INDEX_FILENAME);
    if (idxFiles.hasNext()) {
      var file     = idxFiles.next();
      var lines    = file.getBlob().getDataAsString("UTF-8").split("\n");
      var filtered = lines.filter(function(line) {
        var parts = line.split("|");
        if (parts.length < 3) return true;
        var node = parts[2].trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
        return node !== nameNoExt;
      });
      file.setContent(filtered.join("\n"));
    }

    return { ok: true, filename: filename };
  } catch (e) {
    return { ok: false, filename: filename, message: e.message };
  }
}

// ── getIndex：讀取 _node-index.md，回傳解析後的列陣列 ──
function getIndex() {
  try {
    var cfg    = getConfig();
    var folder = DriveApp.getFolderById(cfg.INDEX_FOLDER_ID);
    var files  = folder.getFilesByName(cfg.INDEX_FILENAME);

    if (!files.hasNext()) return { ok: true, rows: [] };

    var text = files.next().getBlob().getDataAsString("UTF-8");
    var rows = [];

    text.split("\n").forEach(function(line) {
      line = line.trim();
      if (!line || line.startsWith("#")) return;

      var parts = line.split("|").map(function(s) { return s.trim(); });
      if (parts.length < 3) return;

      var date     = parts[0];
      var keywords = parts[1];
      var nodeRaw  = parts[2];
      var node = nodeRaw.replace(/^\[\[/, "").replace(/\]\]$/, "");

      rows.push({ date: date, keywords: keywords, node: node });
    });

    rows.reverse();
    return { ok: true, rows: rows };
  } catch (e) {
    return { ok: false, message: e.message, rows: [] };
  }
}

// ── 工具函式 ─────────────────────────────────────

// ── removeIndexEntry：只移除索引裡的單一行，不動 Drive 檔案 ──
function removeIndexEntry(node, date) {
  try {
    var cfg       = getConfig();
    var idxFolder = DriveApp.getFolderById(cfg.INDEX_FOLDER_ID);
    var idxFiles  = idxFolder.getFilesByName(cfg.INDEX_FILENAME);
    if (!idxFiles.hasNext()) return { ok: true };

    var file    = idxFiles.next();
    var lines   = file.getBlob().getDataAsString("UTF-8").split("\n");
    var removed = false;
    var filtered = lines.filter(function(line) {
      if (removed) return true;
      var parts = line.split("|");
      if (parts.length < 3) return true;
      var lineNode = parts[2].trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
      var lineDate = parts[0].trim();
      if (lineNode === node && lineDate === date) { removed = true; return false; }
      return true;
    });
    file.setContent(filtered.join("\n"));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function extractFrontmatterDate(content) {
  var block = content.match(/^---[\s\S]*?---/);
  if (!block) return null;
  var m = block[0].match(/^date:\s*(.+)$/m);
  if (!m) return null;
  var d = m[1].trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function checkDuplicate(cfg, filename) {
  var nameNoExt = filename.replace(/\.md$/, "");
  var folder = DriveApp.getFolderById(cfg.INDEX_FOLDER_ID);
  var files  = folder.getFilesByName(cfg.INDEX_FILENAME);
  if (!files.hasNext()) return false;
  var text = files.next().getBlob().getDataAsString("UTF-8");
  return text.split("\n").some(function(line) {
    var parts = line.split("|");
    if (parts.length < 3) return false;
    var node = parts[2].trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
    return node === nameNoExt;
  });
}

function parseCSV(str) {
  if (!str || str.trim() === "") return [];
  return str.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
}

function formatDate(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\n?/, "");
}

function buildFrontmatter(date, keywords, seeAlso) {
  var kwLine = "[" + keywords.join(", ") + "]";
  var saLine = seeAlso.length
    ? '["' + seeAlso.map(function(s){ return "[[" + s + "]]"; }).join('", "') + '"]'
    : "[]";
  return "---\ndate: " + date + "\nkeywords: " + kwLine + "\nsee_also: " + saLine + "\nstatus: draft\n---\n\n";
}

function convertSeeLinks(content) {
  return content.replace(/^(→ See: )(?!\(pending\))(\[\[.+?\]\]|[^\[\n]+?)(?:\.md)?$/gm,
    function(match, prefix, name) {
      if (name.startsWith("[[")) return match;
      return prefix + "[[" + name.trim() + "]]";
    }
  );
}

function buildIndexLine(date, keywords, filename) {
  var nameNoExt = filename.replace(/\.md$/, "");
  return date + " | " + keywords.join(", ") + " | [[" + nameNoExt + "]]";
}

function appendToIndex(cfg, line) {
  var folder = DriveApp.getFolderById(cfg.INDEX_FOLDER_ID);
  var files  = folder.getFilesByName(cfg.INDEX_FILENAME);
  if (files.hasNext()) {
    var file = files.next();
    file.setContent(file.getBlob().getDataAsString("UTF-8").trimEnd() + "\n" + line + "\n");
  } else {
    folder.createFile(cfg.INDEX_FILENAME, "# node-index\n\n" + line + "\n", MimeType.PLAIN_TEXT);
  }
}

function uploadToDrive(cfg, filename, content) {
  var folder = DriveApp.getFolderById(cfg.NODE_FOLDER_ID);
  var files  = folder.getFilesByName(filename);
  if (files.hasNext()) {
    files.next().setContent(content);
  } else {
    folder.createFile(filename, content, MimeType.PLAIN_TEXT);
  }
}
