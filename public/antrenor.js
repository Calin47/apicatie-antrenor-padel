// Panoul antrenorului: rezervarile pe saptamani, programul si zilele libere.
const $ = (id) => document.getElementById(id);
const ZILE_SCURT = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const ZILE_LUNG = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const LUNI = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const LUNI_LUNG = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

// orele care pot fi bifate in program: 07:00 - 22:30, din jumatate in jumatate de ora
const ORE = [];
for (let m = 7 * 60; m <= 22 * 60 + 30; m += 30) ORE.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

let date = null;
let luniSapt = null; // data de luni a saptamanii afisate

const ziSapt = (data) => (new Date(data + "T00:00:00Z").getUTCDay() + 6) % 7;
const aduna = (data, n) => {
  const d = new Date(data + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const scurt = (data) => `${Number(data.slice(8))} ${LUNI[Number(data.slice(5, 7)) - 1]}`;
const oraFinal = (ora, durata) => {
  const m = Number(ora.slice(0, 2)) * 60 + Number(ora.slice(3)) + durata;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

async function cerere(url, optiuni = {}) {
  const raspuns = await fetch(url, { headers: { "Content-Type": "application/json" }, ...optiuni });
  if (raspuns.status === 401 && !url.endsWith("/login")) { arataLogin(); throw new Error("neautentificat"); }
  const corp = await raspuns.json();
  if (!raspuns.ok) throw new Error(corp.eroare || "Ceva n-a mers.");
  return corp;
}

function arataLogin() {
  $("login").hidden = false;
  $("panou").hidden = true;
  $("parola").focus();
}

async function incarca() {
  date = await cerere("/api/antrenor/date");
  $("login").hidden = true;
  $("panou").hidden = false;
  if (!luniSapt) luniSapt = aduna(date.azi, -ziSapt(date.azi));
  $("titlu").textContent = date.setari.antrenor;
  $("link").textContent = location.origin + "/";
  deseneazaCifre();
  deseneazaSaptamana();
  deseneazaLibere();
  deseneazaAdmin();
  if ($("detalii").open) deschideDetalii(Number($("detalii").dataset.id));
}

function deseneazaCifre() {
  const r = date.rezervari;
  const luni = aduna(date.azi, -ziSapt(date.azi));
  $("c-azi").textContent = r.filter((x) => x.data === date.azi).length;
  $("c-maine").textContent = r.filter((x) => x.data === aduna(date.azi, 1)).length;
  $("c-sapt").textContent = r.filter((x) => x.data >= luni && x.data <= aduna(luni, 6)).length;
  $("c-luna").textContent = r.filter((x) => x.data.slice(0, 7) === date.azi.slice(0, 7)).length;
}

function deseneazaSaptamana() {
  const duminica = aduna(luniSapt, 6);
  const total = date.rezervari.filter((x) => x.data >= luniSapt && x.data <= duminica).length;
  $("sapt-titlu").textContent = `${scurt(luniSapt)} – ${scurt(duminica)} · ${total} ${total === 1 ? "antrenament" : "antrenamente"}`;
  const lista = $("lista-sapt");
  lista.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const data = aduna(luniSapt, i);
    const rand = document.createElement("div");
    rand.className = "zi-rand" + (data === date.azi ? " azi" : "");
    const nume = document.createElement("div");
    nume.className = "zi-nume";
    nume.textContent = data === date.azi ? "Azi" : ZILE_LUNG[i];
    const sub = document.createElement("small");
    sub.textContent = `${Number(data.slice(8))} ${LUNI_LUNG[Number(data.slice(5, 7)) - 1]}`;
    nume.append(sub);
    const cutie = document.createElement("div");
    cutie.className = "zi-rezervari";
    const aleZilei = date.rezervari.filter((x) => x.data === data);
    if (!aleZilei.length) {
      const gol = document.createElement("div");
      gol.className = "zi-goala";
      gol.textContent = date.zileLibere.includes(data) ? "Zi liberă" : "Nicio rezervare";
      cutie.append(gol);
    }
    for (const r of aleZilei) cutie.append(cardRezervare(r));
    rand.append(nume, cutie);
    lista.append(rand);
  }
}

function cardRezervare(r) {
  const card = document.createElement("div");
  card.className = "rezervare";
  const ora = document.createElement("div");
  ora.className = "r-ora";
  ora.textContent = r.ora;
  const pana = document.createElement("small");
  pana.textContent = `până la ${oraFinal(r.ora, r.durata)}`;
  ora.append(pana);
  const cine = document.createElement("div");
  cine.className = "r-cine";
  const nume = document.createElement("div");
  nume.className = "r-nume";
  nume.textContent = r.nume;
  if (r.persoane > 1) {
    const pers = document.createElement("span");
    pers.className = "r-persoane";
    pers.textContent = `${r.persoane} persoane`;
    nume.append(" ", pers);
  }
  const tel = document.createElement("a");
  tel.className = "r-tel";
  tel.href = "tel:" + r.telefon.replace(/[^\d+]/g, "");
  tel.textContent = r.telefon;
  cine.append(nume, tel);
  if (r.exercitii) {
    const ex = document.createElement("div");
    ex.className = "r-exercitii";
    for (const e of r.exercitii.split(", ")) {
      const chip = document.createElement("span");
      chip.textContent = e;
      ex.append(chip);
    }
    cine.append(ex);
  }
  if (r.nota) {
    const nota = document.createElement("div");
    nota.className = "r-nota";
    nota.textContent = r.nota;
    cine.append(nota);
  }
  // anularea cere doua apasari, ca sa nu se piarda o rezervare din greseala
  const anuleaza = document.createElement("button");
  anuleaza.type = "button";
  anuleaza.className = "buton pericol mic";
  anuleaza.textContent = "Anulează";
  anuleaza.addEventListener("click", async () => {
    if (anuleaza.dataset.sigur !== "1") {
      anuleaza.dataset.sigur = "1";
      anuleaza.textContent = "Sigur? Apasă din nou";
      setTimeout(() => { anuleaza.dataset.sigur = ""; anuleaza.textContent = "Anulează"; }, 4000);
      return;
    }
    anuleaza.disabled = true;
    await cerere(`/api/antrenor/rezervari/${r.id}/anuleaza`, { method: "POST" });
    await incarca();
  });
  const vezi = document.createElement("button");
  vezi.type = "button";
  vezi.className = "buton secundar mic";
  vezi.textContent = "Detalii";
  vezi.addEventListener("click", () => deschideDetalii(r.id));
  const butoane = document.createElement("div");
  butoane.className = "r-butoane";
  butoane.append(vezi, anuleaza);
  card.append(ora, cine, butoane);
  return card;
}

function deseneazaProgram() {
  const bifate = new Set(date.program.map((p) => `${p.zi}-${p.ora}`));
  const tabel = $("grila-program");
  tabel.replaceChildren();
  const cap = document.createElement("tr");
  cap.append(document.createElement("th"));
  for (const z of ZILE_SCURT) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = z;
    cap.append(th);
  }
  const thead = document.createElement("thead");
  thead.append(cap);
  const tbody = document.createElement("tbody");
  for (const ora of ORE) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = ora;
    tr.append(th);
    for (let zi = 0; zi < 7; zi++) {
      const td = document.createElement("td");
      const id = `p-${zi}-${ora.replace(":", "")}`;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      input.dataset.zi = zi;
      input.dataset.ora = ora;
      input.checked = bifate.has(`${zi}-${ora}`);
      const label = document.createElement("label");
      label.htmlFor = id;
      label.title = `${ZILE_LUNG[zi]}, ${ora}`;
      label.setAttribute("aria-label", `${ZILE_LUNG[zi]}, ora ${ora}`);
      td.append(input, label);
      tr.append(td);
    }
    tbody.append(tr);
  }
  tabel.append(thead, tbody);
  $("s-antrenor").value = date.setari.antrenor;
  $("s-durata").value = String(date.setari.durata);
  $("s-zile").value = String(date.setari.zileInainte);
  $("s-anunt").value = date.setari.anunt;
}

function deseneazaLibere() {
  const lista = $("lista-libere");
  lista.replaceChildren();
  if (!date.zileLibere.length) {
    const li = document.createElement("li");
    li.textContent = "Nicio zi liberă programată.";
    lista.append(li);
  }
  for (const data of date.zileLibere) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = `${ZILE_LUNG[ziSapt(data)]}, ${Number(data.slice(8))} ${LUNI_LUNG[Number(data.slice(5, 7)) - 1]} ${data.slice(0, 4)}`;
    const sterge = document.createElement("button");
    sterge.type = "button";
    sterge.className = "buton secundar mic";
    sterge.textContent = "Redeschide ziua";
    sterge.addEventListener("click", async () => {
      await cerere(`/api/antrenor/zile-libere/${data}`, { method: "DELETE" });
      await incarca();
    });
    li.append(text, sterge);
    lista.append(li);
  }
}

// ---------- evenimente ----------

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("eroare-login").hidden = true;
  try {
    await cerere("/api/antrenor/login", { method: "POST", body: JSON.stringify({ parola: $("parola").value }) });
    $("parola").value = "";
    await incarca();
  } catch (err) {
    $("eroare-login").textContent = err.message;
    $("eroare-login").hidden = false;
  }
});

$("iesire").addEventListener("click", async () => {
  await cerere("/api/antrenor/logout", { method: "POST" });
  arataLogin();
});

for (const [tab, sectiune] of [["tab-rezervari", "sec-rezervari"], ["tab-admin", "sec-admin"], ["tab-program", "sec-program"], ["tab-libere", "sec-libere"]]) {
  $(tab).addEventListener("click", () => {
    for (const t of document.querySelectorAll('[role="tab"]')) t.setAttribute("aria-selected", String(t.id === tab));
    for (const s of document.querySelectorAll('[role="tabpanel"]')) s.hidden = s.id !== sectiune;
    if (sectiune === "sec-program") deseneazaProgram();
  });
}

$("sapt-inapoi").addEventListener("click", () => { luniSapt = aduna(luniSapt, -7); deseneazaSaptamana(); });
$("sapt-inainte").addEventListener("click", () => { luniSapt = aduna(luniSapt, 7); deseneazaSaptamana(); });

$("salveaza-program").addEventListener("click", async () => {
  const program = [...document.querySelectorAll("#grila-program input:checked")].map((i) => ({ zi: Number(i.dataset.zi), ora: i.dataset.ora }));
  $("stare-program").textContent = "Se salvează…";
  try {
    await cerere("/api/antrenor/program", {
      method: "PUT",
      body: JSON.stringify({ program, durata: $("s-durata").value, zileInainte: $("s-zile").value, antrenor: $("s-antrenor").value, anunt: $("s-anunt").value }),
    });
    await incarca();
    deseneazaProgram();
    $("stare-program").textContent = `Salvat. ${program.length} ore pe săptămână în program.`;
  } catch (err) {
    $("stare-program").textContent = err.message;
  }
});

$("form-libera").addEventListener("submit", async (e) => {
  e.preventDefault();
  await cerere("/api/antrenor/zile-libere", { method: "POST", body: JSON.stringify({ data: $("data-libera").value }) });
  $("data-libera").value = "";
  await incarca();
});

$("copiaza").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("link").textContent);
    $("copiaza").textContent = "Copiat";
  } catch {
    getSelection().selectAllChildren($("link"));
    $("copiaza").textContent = "Selectat, apasă Cmd+C";
  }
  setTimeout(() => { $("copiaza").textContent = "Copiază linkul"; }, 2500);
});

incarca().catch(() => {});

// ---------- administrare: toate rezervarile si detaliile fiecareia ----------

const doarCifre = (t) => t.replace(/\D/g, "").replace(/^40/, "0");
const dataOra = (iso) => iso ? new Intl.DateTimeFormat("ro-RO", {
  timeZone: "Europe/Bucharest", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date(iso)) : "";
const dataLunga = (data) => `${ZILE_LUNG[ziSapt(data)]}, ${Number(data.slice(8))} ${LUNI_LUNG[Number(data.slice(5, 7)) - 1]} ${data.slice(0, 4)}`;

function stare(r) {
  if (r.anulata) return { text: "Anulată", cls: "anulata" };
  if (r.data < date.azi) return { text: "Încheiată", cls: "trecuta" };
  return { text: "Confirmată", cls: "confirmata" };
}

function deseneazaAdmin() {
  const toate = date.toate;
  const active = toate.filter((r) => !r.anulata);
  const clienti = new Set(active.map((r) => doarCifre(r.telefon)));
  const persoane = active.filter((r) => r.data >= date.azi).reduce((n, r) => n + r.persoane, 0);
  const cifre = [
    [active.filter((r) => r.data >= date.azi).length, "viitoare"],
    [persoane, "persoane așteptate"],
    [clienti.size, "clienți diferiți"],
    [toate.filter((r) => r.anulata).length, "anulate"],
  ];
  const cutie = $("admin-cifre");
  cutie.replaceChildren();
  for (const [valoare, eticheta] of cifre) {
    const div = document.createElement("div");
    div.className = "cifra";
    const v = document.createElement("span");
    v.className = "valoare";
    v.textContent = valoare;
    const e = document.createElement("span");
    e.className = "cifra-eticheta";
    e.textContent = eticheta;
    div.append(v, e);
    cutie.append(div);
  }

  const filtru = $("filtru").value;
  const cautat = $("cauta").value.trim().toLowerCase();
  let lista = toate.filter((r) => {
    if (filtru === "viitoare") return !r.anulata && r.data >= date.azi;
    if (filtru === "trecute") return !r.anulata && r.data < date.azi;
    if (filtru === "anulate") return r.anulata;
    return true;
  });
  if (cautat) {
    const cifreCautate = doarCifre(cautat);
    lista = lista.filter((r) => r.nume.toLowerCase().includes(cautat) || (cifreCautate.length >= 3 && doarCifre(r.telefon).includes(cifreCautate)));
  }
  // viitoarele de la cea mai apropiata, restul de la cea mai recenta
  if (filtru === "viitoare") lista = [...lista].reverse();

  const corp = $("tabel-admin");
  corp.replaceChildren();
  for (const r of lista) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.addEventListener("click", () => deschideDetalii(r.id));
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter") deschideDetalii(r.id); });
    const st = stare(r);
    const celule = [scurt(r.data) + " " + r.data.slice(0, 4), r.ora, r.nume, String(r.persoane)];
    for (const text of celule) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    const td = document.createElement("td");
    const pastila = document.createElement("span");
    pastila.className = "stare " + st.cls;
    pastila.textContent = st.text;
    td.append(pastila);
    tr.append(td);
    corp.append(tr);
  }
  if (!lista.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "zi-goala";
    td.textContent = cautat ? "Nicio rezervare nu se potrivește cu căutarea." : "Nicio rezervare aici.";
    tr.append(td);
    corp.append(tr);
  }
  $("admin-numar").textContent = `${lista.length} ${lista.length === 1 ? "rezervare" : "rezervări"}. Apasă pe un rând ca să vezi tot.`;
}

function deschideDetalii(id) {
  const r = date.toate.find((x) => x.id === id);
  if (!r) return;
  const dialog = $("detalii");
  dialog.dataset.id = String(id);
  const st = stare(r);
  $("d-cod").textContent = `Rezervarea #${r.id}`;
  $("d-titlu").textContent = r.nume;
  $("d-stare").className = "stare " + st.cls;
  $("d-stare").textContent = st.text;

  const randuri = [
    ["Ziua", dataLunga(r.data)],
    ["Ora", `${r.ora} – ${oraFinal(r.ora, r.durata)} (${r.durata} min)`],
    ["Persoane", r.persoane === 1 ? "1 (individual)" : String(r.persoane)],
    ["Telefon", r.telefon],
    ["Vrea să exerseze", r.exercitii || "Nu a ales nimic"],
    ["Mesaj", r.nota || "Fără mesaj"],
    ["Rezervată pe", dataOra(r.creata_la)],
  ];
  if (r.anulata) randuri.push(["Anulată pe", r.anulata_la ? dataOra(r.anulata_la) : "dată necunoscută"]);
  const lista = $("d-lista");
  lista.replaceChildren();
  for (const [eticheta, valoare] of randuri) {
    const dt = document.createElement("dt");
    dt.textContent = eticheta;
    const dd = document.createElement("dd");
    if (eticheta === "Telefon") {
      const a = document.createElement("a");
      a.href = "tel:" + valoare.replace(/[^\d+]/g, "");
      a.textContent = valoare;
      const copiaza = document.createElement("button");
      copiaza.type = "button";
      copiaza.className = "buton secundar mic";
      copiaza.textContent = "Copiază";
      copiaza.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(valoare); copiaza.textContent = "Copiat"; } catch { getSelection().selectAllChildren(a); }
      });
      dd.append(a, " ", copiaza);
    } else {
      dd.textContent = valoare;
    }
    lista.append(dt, dd);
  }

  // acelasi client = acelasi numar de telefon
  const aleLui = date.toate.filter((x) => doarCifre(x.telefon) === doarCifre(r.telefon));
  const venite = aleLui.filter((x) => !x.anulata && x.data < date.azi).length;
  const anulate = aleLui.filter((x) => x.anulata).length;
  $("d-istoric-rezumat").textContent = aleLui.length === 1
    ? "Prima rezervare a acestui client."
    : `${aleLui.length} rezervări în total: ${venite} încheiate, ${anulate} anulate.`;
  const istoric = $("d-istoric");
  istoric.replaceChildren();
  for (const x of aleLui.slice(0, 8)) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link-istoric" + (x.id === r.id ? " curent" : "");
    b.textContent = `${scurt(x.data)} ${x.data.slice(0, 4)}, ${x.ora} · ${stare(x).text}`;
    b.addEventListener("click", () => deschideDetalii(x.id));
    li.append(b);
    istoric.append(li);
  }

  const actiuni = $("d-actiuni");
  actiuni.replaceChildren();
  if (!r.anulata && r.data >= date.azi) {
    const anuleaza = document.createElement("button");
    anuleaza.type = "button";
    anuleaza.className = "buton pericol";
    anuleaza.textContent = "Anulează rezervarea";
    anuleaza.addEventListener("click", async () => {
      if (anuleaza.dataset.sigur !== "1") {
        anuleaza.dataset.sigur = "1";
        anuleaza.textContent = "Sigur? Apasă din nou";
        return;
      }
      anuleaza.disabled = true;
      await cerere(`/api/antrenor/rezervari/${r.id}/anuleaza`, { method: "POST" });
      await incarca();
    });
    actiuni.append(anuleaza);
  }
  if (!dialog.open) dialog.showModal();
}

$("d-inchide").addEventListener("click", () => $("detalii").close());
$("detalii").addEventListener("click", (e) => { if (e.target === $("detalii")) $("detalii").close(); });
$("filtru").addEventListener("change", deseneazaAdmin);
$("cauta").addEventListener("input", deseneazaAdmin);
