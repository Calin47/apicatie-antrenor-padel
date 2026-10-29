// Server pentru rezervari de antrenamente de padel.
// Fara dependinte: node:http + node:sqlite (Node 22.5+).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { createHash, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3100);
const PAROLA = process.env.ANTRENOR_PAROLA || "padel123";
const FUS_ORAR = "Europe/Bucharest";
const DB_FILE = process.env.DB_FILE || path.join(DIR, "rezervari.db");

const db = new DatabaseSync(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS setari (cheie TEXT PRIMARY KEY, valoare TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS program (zi INTEGER NOT NULL, ora TEXT NOT NULL, PRIMARY KEY (zi, ora));
  CREATE TABLE IF NOT EXISTS zile_libere (data TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS rezervari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    ora TEXT NOT NULL,
    durata INTEGER NOT NULL,
    nume TEXT NOT NULL,
    telefon TEXT NOT NULL,
    nota TEXT NOT NULL DEFAULT '',
    creata_la TEXT NOT NULL,
    anulata INTEGER NOT NULL DEFAULT 0
  );
`);

// Coloane adaugate dupa prima versiune; bazele vechi le primesc la pornire.
const coloane = db.prepare("PRAGMA table_info(rezervari)").all().map((c) => c.name);
if (!coloane.includes("persoane")) db.exec("ALTER TABLE rezervari ADD COLUMN persoane INTEGER NOT NULL DEFAULT 1");
if (!coloane.includes("anulata_la")) db.exec("ALTER TABLE rezervari ADD COLUMN anulata_la TEXT");
if (!coloane.includes("exercitii")) db.exec("ALTER TABLE rezervari ADD COLUMN exercitii TEXT NOT NULL DEFAULT ''");

// Ce poate bifa clientul ca vrea sa lucreze la antrenament.
const EXERCITII = [
  "Serviciu", "Retur", "Volei la fileu", "Bandeja", "Víbora", "Smash",
  "Lob", "Ieșirea din geam", "Poziționare", "Joc de dublu",
];

// Program implicit la prima pornire; antrenorul il schimba din panou.
if (!db.prepare("SELECT 1 FROM setari LIMIT 1").get()) {
  const setare = db.prepare("INSERT INTO setari VALUES (?, ?)");
  setare.run("antrenor", "Antrenamente cu Călin");
  setare.run("durata", "60");
  setare.run("zile_inainte", "14");
  setare.run("anunt", "");
  const slot = db.prepare("INSERT INTO program VALUES (?, ?)");
  for (let zi = 0; zi < 5; zi++) for (const ora of ["17:00", "18:00", "19:00", "20:00"]) slot.run(zi, ora);
  for (const ora of ["09:00", "10:00", "11:00", "12:00"]) slot.run(5, ora);
}

// ---------- timp, mereu in ora Romaniei ----------

function acum() {
  const parti = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUS_ORAR, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { data: `${parti.year}-${parti.month}-${parti.day}`, minute: Number(parti.hour) * 60 + Number(parti.minute) };
}

const minute = (ora) => Number(ora.slice(0, 2)) * 60 + Number(ora.slice(3, 5));

function adunaZile(data, n) {
  const d = new Date(data + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 0 = luni ... 6 = duminica
const ziSaptamana = (data) => (new Date(data + "T00:00:00Z").getUTCDay() + 6) % 7;

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- date ----------

function setari() {
  const s = Object.fromEntries(db.prepare("SELECT cheie, valoare FROM setari").all().map((r) => [r.cheie, r.valoare]));
  return { antrenor: s.antrenor, durata: Number(s.durata), zileInainte: Number(s.zile_inainte), anunt: s.anunt || "" };
}

function rezervariActive(deLa, panaLa) {
  return db.prepare(
    "SELECT * FROM rezervari WHERE anulata = 0 AND data >= ? AND data <= ? ORDER BY data, ora",
  ).all(deLa, panaLa);
}

// Un slot e ocupat daca se suprapune cu orice rezervare activa din aceeasi zi.
function seSuprapune(rezervari, data, ora, durata) {
  const start = minute(ora);
  return rezervari.some((r) => r.data === data && minute(r.ora) < start + durata && start < minute(r.ora) + r.durata);
}

function calendar() {
  const s = setari();
  const azi = acum();
  const ultima = adunaZile(azi.data, s.zileInainte - 1);
  const program = db.prepare("SELECT zi, ora FROM program ORDER BY ora").all();
  const libere = new Set(db.prepare("SELECT data FROM zile_libere").all().map((r) => r.data));
  const rezervari = rezervariActive(azi.data, ultima);
  const zile = [];
  for (let i = 0; i < s.zileInainte; i++) {
    const data = adunaZile(azi.data, i);
    const inchisa = libere.has(data);
    const sloturi = inchisa ? [] : program
      .filter((p) => p.zi === ziSaptamana(data))
      // nu se mai poate rezerva cu mai putin de o ora inainte
      .filter((p) => data !== azi.data || minute(p.ora) > azi.minute + 60)
      .map((p) => ({ ora: p.ora, liber: !seSuprapune(rezervari, data, p.ora, s.durata) }));
    zile.push({ data, inchisa, sloturi });
  }
  return { antrenor: s.antrenor, anunt: s.anunt, durata: s.durata, exercitii: EXERCITII, zile };
}

function creeazaRezervare(corp) {
  const nume = String(corp.nume || "").trim().slice(0, 80);
  const telefon = String(corp.telefon || "").trim().slice(0, 30);
  const nota = String(corp.nota || "").trim().slice(0, 300);
  const persoane = Number(corp.persoane);
  const exercitii = (Array.isArray(corp.exercitii) ? corp.exercitii : []).filter((e) => EXERCITII.includes(e));
  const { data, ora } = corp;
  if (nume.length < 2) return { eroare: "Scrie-ți numele, ca antrenorul să știe cine vine." };
  if (telefon.replace(/\D/g, "").length < 9) return { eroare: "Numărul de telefon pare incomplet. Verifică-l și încearcă din nou." };
  if (![1, 2, 3, 4].includes(persoane)) return { eroare: "Alege câte persoane vin, între 1 și 4." };
  const zi = calendar().zile.find((z) => z.data === data);
  const slot = zi?.sloturi.find((s) => s.ora === ora);
  if (!slot) return { eroare: "Ora aleasă nu mai este în program. Alege alt interval." };
  if (!slot.liber) return { eroare: "Cineva tocmai a rezervat ora asta. Alege alt interval." };
  const { durata } = setari();
  const r = db.prepare(
    "INSERT INTO rezervari (data, ora, durata, nume, telefon, nota, persoane, exercitii, creata_la) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
  ).get(data, ora, durata, nume, telefon, nota, persoane, exercitii.join(", "), new Date().toISOString());
  return { rezervare: r };
}

// ---------- autentificare antrenor ----------

const TOKEN = createHash("sha256").update("padel-rezervari:" + PAROLA).digest("hex");

function esteAntrenor(req) {
  const cookie = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith("antrenor="));
  if (!cookie) return false;
  const a = Buffer.from(cookie.slice(9));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- http ----------

function trimite(res, status, corp, antete = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...antete });
  res.end(JSON.stringify(corp));
}

async function citesteCorp(req) {
  let text = "";
  for await (const bucata of req) {
    text += bucata;
    if (text.length > 20000) throw new Error("prea mare");
  }
  return text ? JSON.parse(text) : {};
}

const TIPURI = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
const PAGINI = { "/": "index.html", "/antrenor": "antrenor.html" };

async function fisierStatic(res, cale) {
  const nume = PAGINI[cale] || cale.slice(1);
  if (!/^[\w-]+\.(html|css|js|svg)$/.test(nume)) return false;
  try {
    const continut = await readFile(path.join(DIR, "public", nume));
    res.writeHead(200, { "Content-Type": TIPURI[path.extname(nume)] });
    res.end(continut);
    return true;
  } catch {
    return false;
  }
}

async function api(req, res, cale) {
  const metoda = req.method;

  if (metoda === "GET" && cale === "/api/calendar") return trimite(res, 200, calendar());

  if (metoda === "POST" && cale === "/api/rezervari") {
    const rezultat = creeazaRezervare(await citesteCorp(req));
    if (rezultat.eroare) return trimite(res, 400, rezultat);
    const { id, data, ora, durata, persoane } = rezultat.rezervare;
    return trimite(res, 201, { id, data, ora, durata, persoane });
  }

  if (metoda === "POST" && cale === "/api/antrenor/login") {
    const { parola } = await citesteCorp(req);
    if (parola !== PAROLA) return trimite(res, 401, { eroare: "Parola nu e corectă." });
    return trimite(res, 200, { ok: true }, {
      "Set-Cookie": `antrenor=${TOKEN}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 90}`,
    });
  }

  if (metoda === "POST" && cale === "/api/antrenor/logout") {
    return trimite(res, 200, { ok: true }, { "Set-Cookie": "antrenor=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }

  if (!cale.startsWith("/api/antrenor/")) return trimite(res, 404, { eroare: "Nu există." });
  if (!esteAntrenor(req)) return trimite(res, 401, { eroare: "Intră din nou cu parola." });

  if (metoda === "GET" && cale === "/api/antrenor/date") {
    const azi = acum().data;
    return trimite(res, 200, {
      azi,
      setari: setari(),
      program: db.prepare("SELECT zi, ora FROM program ORDER BY zi, ora").all(),
      zileLibere: db.prepare("SELECT data FROM zile_libere WHERE data >= ? ORDER BY data").all(azi).map((r) => r.data),
      rezervari: rezervariActive(adunaZile(azi, -30), adunaZile(azi, 400)),
      // tot istoricul, cu anulatele, pentru sectiunea de administrare
      toate: db.prepare("SELECT * FROM rezervari ORDER BY data DESC, ora DESC").all(),
    });
  }

  if (metoda === "PUT" && cale === "/api/antrenor/program") {
    const corp = await citesteCorp(req);
    const program = Array.isArray(corp.program) ? corp.program : [];
    const valid = program.filter((p) => Number.isInteger(p.zi) && p.zi >= 0 && p.zi <= 6 && RE_ORA.test(p.ora));
    const durata = [30, 45, 60, 90, 120].includes(Number(corp.durata)) ? Number(corp.durata) : 60;
    const zileInainte = Math.min(60, Math.max(1, Number(corp.zileInainte) || 14));
    const antrenor = String(corp.antrenor || "").trim().slice(0, 80) || "Antrenamente cu Călin";
    const anunt = String(corp.anunt || "").trim().slice(0, 300);
    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM program");
      const slot = db.prepare("INSERT OR IGNORE INTO program VALUES (?, ?)");
      for (const p of valid) slot.run(p.zi, p.ora);
      const setare = db.prepare("INSERT OR REPLACE INTO setari VALUES (?, ?)");
      setare.run("durata", String(durata));
      setare.run("zile_inainte", String(zileInainte));
      setare.run("antrenor", antrenor);
      setare.run("anunt", anunt);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return trimite(res, 200, { ok: true });
  }

  if (metoda === "POST" && cale === "/api/antrenor/zile-libere") {
    const { data } = await citesteCorp(req);
    if (!RE_DATA.test(String(data))) return trimite(res, 400, { eroare: "Alege o dată din calendar." });
    db.prepare("INSERT OR IGNORE INTO zile_libere VALUES (?)").run(data);
    return trimite(res, 200, { ok: true });
  }

  const ziLibera = cale.match(/^\/api\/antrenor\/zile-libere\/(\d{4}-\d{2}-\d{2})$/);
  if (metoda === "DELETE" && ziLibera) {
    db.prepare("DELETE FROM zile_libere WHERE data = ?").run(ziLibera[1]);
    return trimite(res, 200, { ok: true });
  }

  const anulare = cale.match(/^\/api\/antrenor\/rezervari\/(\d+)\/anuleaza$/);
  if (metoda === "POST" && anulare) {
    db.prepare("UPDATE rezervari SET anulata = 1, anulata_la = ? WHERE id = ? AND anulata = 0").run(new Date().toISOString(), Number(anulare[1]));
    return trimite(res, 200, { ok: true });
  }

  return trimite(res, 404, { eroare: "Nu există." });
}

const server = http.createServer(async (req, res) => {
  const cale = new URL(req.url, "http://x").pathname;
  try {
    if (cale.startsWith("/api/")) return await api(req, res, cale);
    if (req.method === "GET" && (await fisierStatic(res, cale))) return;
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Pagina nu există.");
  } catch (e) {
    console.error(e);
    if (!res.headersSent) trimite(res, 500, { eroare: "Ceva n-a mers. Încearcă din nou peste câteva secunde." });
  }
});

server.listen(PORT, () => {
  console.log(`Clienti:   http://localhost:${PORT}/`);
  console.log(`Antrenor:  http://localhost:${PORT}/antrenor`);
  if (!process.env.ANTRENOR_PAROLA) console.log("Parola antrenor implicita: padel123 (seteaza ANTRENOR_PAROLA)");
});
