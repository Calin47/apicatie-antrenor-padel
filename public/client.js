// Pagina pentru clienti: alege ziua, ora, apoi trimite numele si telefonul.
const $ = (id) => document.getElementById(id);
const ZILE_SCURT = ["Lun", "Mar", "Mie", "Joi", "Vin", "Sâm", "Dum"];
const ZILE_LUNG = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"];
const LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

let calendar = null;
let ziAleasa = null;
let oraAleasa = null;

const ziSapt = (data) => (new Date(data + "T00:00:00Z").getUTCDay() + 6) % 7;
const dataLunga = (data) => {
  const d = new Date(data + "T00:00:00Z");
  return `${ZILE_LUNG[ziSapt(data)]}, ${d.getUTCDate()} ${LUNI[d.getUTCMonth()]}`;
};
const oraFinal = (ora, durata) => {
  const m = Number(ora.slice(0, 2)) * 60 + Number(ora.slice(3)) + durata;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

async function incarca() {
  const raspuns = await fetch("/api/calendar");
  calendar = await raspuns.json();
  $("antrenor").textContent = calendar.antrenor;
  document.title = `Rezervă · ${calendar.antrenor}`;
  if (calendar.anunt) $("anunt").textContent = calendar.anunt;
  deseneazaExercitii(calendar.exercitii || []);
  $("nota-durata").textContent = `Un antrenament durează ${calendar.durata} de minute. Orele sunt afișate în ora României.`;
  // pastreaza ziua aleasa daca mai exista, altfel prima zi cu ore libere
  if (!calendar.zile.some((z) => z.data === ziAleasa)) {
    ziAleasa = (calendar.zile.find((z) => z.sloturi.some((s) => s.liber)) || calendar.zile[0])?.data;
  }
  deseneaza();
}

// se deseneaza o singura data, ca bifele clientului sa nu se piarda la reimprospatare
function deseneazaExercitii(lista) {
  const cutie = $("exercitii");
  if (cutie.childElementCount) return;
  lista.forEach((nume, i) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `ex-${i}`;
    input.value = nume;
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = nume;
    cutie.append(input, label);
  });
}

function deseneaza() {
  const zile = $("zile");
  zile.replaceChildren();
  for (const zi of calendar.zile) {
    const libere = zi.sloturi.filter((s) => s.liber).length;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "zi" + (libere ? "" : " fara");
    b.setAttribute("aria-pressed", String(zi.data === ziAleasa));
    b.setAttribute("aria-label", `${dataLunga(zi.data)}, ${libere} ore libere`);
    const nume = document.createElement("span");
    nume.className = "nume-zi";
    nume.textContent = ZILE_SCURT[ziSapt(zi.data)];
    const numar = document.createElement("span");
    numar.className = "numar-zi";
    numar.textContent = String(Number(zi.data.slice(8)));
    const info = document.createElement("span");
    info.className = "libere";
    info.textContent = zi.inchisa ? "închis" : !zi.sloturi.length ? "fără ore" : libere ? `${libere} libere` : "plin";
    b.append(nume, numar, info);
    b.addEventListener("click", () => { ziAleasa = zi.data; oraAleasa = null; deseneaza(); });
    zile.append(b);
  }

  const zi = calendar.zile.find((z) => z.data === ziAleasa);
  const ore = $("ore");
  ore.replaceChildren();
  $("titlu-ora").textContent = zi ? `2. Alege ora · ${dataLunga(zi.data)}` : "2. Alege ora";
  if (!zi || !zi.sloturi.length) {
    const p = document.createElement("p");
    p.className = "gol";
    p.textContent = zi?.inchisa ? "Antrenorul nu ține antrenamente în ziua asta." : "Nu sunt ore în program în ziua asta. Alege altă zi.";
    ore.append(p);
  }
  for (const slot of zi?.sloturi || []) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ora";
    b.disabled = !slot.liber;
    b.setAttribute("aria-pressed", String(slot.ora === oraAleasa));
    b.textContent = slot.ora;
    const sub = document.createElement("small");
    sub.textContent = slot.liber ? `până la ${oraFinal(slot.ora, calendar.durata)}` : "ocupat";
    b.append(sub);
    b.addEventListener("click", () => {
      oraAleasa = slot.ora;
      deseneaza();
      $("sectiune-date").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      $("nume").focus({ preventScroll: true });
    });
    ore.append(b);
  }

  $("sectiune-date").hidden = !oraAleasa;
  if (oraAleasa) {
    $("alegere-text").textContent = `${dataLunga(ziAleasa)} · ${oraAleasa}`;
    $("alegere-durata").textContent = `${calendar.durata} min, până la ${oraFinal(oraAleasa, calendar.durata)}`;
  }
}

$("formular").addEventListener("submit", async (e) => {
  e.preventDefault();
  const buton = $("trimite");
  buton.disabled = true;
  $("eroare").hidden = true;
  try {
    const raspuns = await fetch("/api/rezervari", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: ziAleasa,
        ora: oraAleasa,
        nume: $("nume").value,
        telefon: $("telefon").value,
        persoane: Number(document.querySelector('input[name="persoane"]:checked').value),
        exercitii: [...document.querySelectorAll("#exercitii input:checked")].map((i) => i.value),
        nota: $("nota").value,
      }),
    });
    const corp = await raspuns.json();
    if (!raspuns.ok) {
      $("eroare").textContent = corp.eroare;
      $("eroare").hidden = false;
      await incarca();
      return;
    }
    const cine = corp.persoane === 1 ? "Te așteptăm" : `Vă așteptăm pe toți ${corp.persoane}`;
    $("confirmare-text").textContent = `${cine} ${dataLunga(corp.data)}, la ora ${corp.ora} (${corp.durata} de minute).`;
    $("confirmare").hidden = false;
    $("sectiune-date").hidden = true;
    $("nota").value = "";
    for (const i of document.querySelectorAll("#exercitii input")) i.checked = false;
    $("pers-1").checked = true;
    oraAleasa = null;
    await incarca();
    $("sectiune-date").hidden = true;
    $("confirmare").scrollIntoView({ block: "center" });
  } catch {
    $("eroare").textContent = "Nu am putut trimite rezervarea. Verifică internetul și încearcă din nou.";
    $("eroare").hidden = false;
  } finally {
    buton.disabled = false;
  }
});

$("alta").addEventListener("click", () => {
  $("confirmare").hidden = true;
  window.scrollTo({ top: 0 });
});

incarca().catch(() => {
  $("zile").textContent = "Programul nu s-a putut încărca. Reîncarcă pagina.";
});
// orele se ocupa si de la alti clienti; reimprospateaza din cand in cand
setInterval(() => { if (!oraAleasa) incarca().catch(() => {}); }, 60000);
