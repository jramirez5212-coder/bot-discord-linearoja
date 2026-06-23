const fs   = require("fs");
const path = require("path");

const DATA_PATH        = path.join(__dirname, "../../data/actividad.json");
const BACKUP_PATH      = path.join(__dirname, "../../data/actividad.backup.json");
const DATA_RUSH_PATH   = path.join(__dirname, "../../data/actividad_rush.json");
const BACKUP_RUSH_PATH = path.join(__dirname, "../../data/actividad_rush.backup.json");
const TOPS_PATH        = path.join(__dirname, "../../data/tops.json");
const TOPS_RUSH_PATH   = path.join(__dirname, "../../data/tops_rush.json");

// ── Actividad ROLAS ────────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")); }
  catch {
    if (fs.existsSync(BACKUP_PATH))
      return JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
    return {};
  }
}

function saveData(data) {
  try {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(DATA_PATH)) fs.copyFileSync(DATA_PATH, BACKUP_PATH);
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch (err) { console.error("[DATA] Error guardando:", err); }
}

// ── Actividad RUSH ─────────────────────────────────────────────
function loadDataRush() {
  if (!fs.existsSync(DATA_RUSH_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_RUSH_PATH, "utf8")); }
  catch {
    if (fs.existsSync(BACKUP_RUSH_PATH))
      return JSON.parse(fs.readFileSync(BACKUP_RUSH_PATH, "utf8"));
    return {};
  }
}

function saveDataRush(data) {
  try {
    const dir = path.dirname(DATA_RUSH_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(DATA_RUSH_PATH)) fs.copyFileSync(DATA_RUSH_PATH, BACKUP_RUSH_PATH);
    fs.writeFileSync(DATA_RUSH_PATH, JSON.stringify(data, null, 2));
  } catch (err) { console.error("[DATA-RUSH] Error guardando:", err); }
}

function getUser(data, userId) {
  if (!data[userId]) {
    data[userId] = {
      totalMs:   0,
      weekMs:    0,
      lastSeen:  null,
      days:      {},
      topsGanados: 0,
      diasSeguidos: 0,
      ultimoDiaContinuo: null,
    };
  }
  return data[userId];
}

function cleanOldDays(userData) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const date in userData.days)
    if (new Date(date).getTime() < cutoff) delete userData.days[date];
}

// ── Tops históricos ────────────────────────────────────────────
function loadTops() {
  if (!fs.existsSync(TOPS_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(TOPS_PATH, "utf8")); }
  catch { return []; }
}

function saveTops(tops) {
  const dir = path.dirname(TOPS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOPS_PATH, JSON.stringify(tops, null, 2));
}

function loadTopsRush() {
  if (!fs.existsSync(TOPS_RUSH_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(TOPS_RUSH_PATH, "utf8")); }
  catch { return []; }
}

function saveTopsRush(tops) {
  const dir = path.dirname(TOPS_RUSH_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOPS_RUSH_PATH, JSON.stringify(tops, null, 2));
}

// ── Helpers de fecha ───────────────────────────────────────────
function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function nowColombia() {
  return new Date().toLocaleString("en-US", { timeZone: "America/Bogota" });
}

function horaMinutoColombia() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

module.exports = {
  loadData, saveData, loadDataRush, saveDataRush,
  getUser, cleanOldDays,
  loadTops, saveTops, loadTopsRush, saveTopsRush,
  todayKey, nowColombia, horaMinutoColombia,
};
