# padel-rezervari

Calendar de rezervari pentru antrenamente de padel. Antrenorul isi pune programul, clientii intra pe link si isi aleg ziua si ora.

## Pornire

```
npm run dev
```

- Clienti: http://localhost:3100/
- Antrenor: http://localhost:3100/antrenor (parola din `ANTRENOR_PAROLA`, implicit `padel123`)

Nu are dependinte: foloseste `node:http` si `node:sqlite` (Node 22.13+). Datele stau in `rezervari.db` (nu e in git).

## Ce face

- **Clientul** vede urmatoarele 14 zile (se schimba din panou), orele libere si ocupate, alege una si lasa nume, telefon, cate persoane vin (1-4), ce vrea sa exerseze (serviciu, bandeja, víbora, smash etc., lista e `EXERCITII` din `server.mjs`) si un mesaj optional. Nu se poate rezerva cu mai putin de o ora inainte.
- **Antrenorul** vede cate antrenamente are azi, maine, saptamana asta si luna asta, rezervarile pe saptamani (cu telefonul clientului, numarul de persoane si ce vrea sa exerseze), le poate anula, isi bifeaza programul saptamanal (07:00-22:30, din 30 in 30 de minute), durata antrenamentului si zilele libere.
- **Toate rezervarile** (fila din panou): tot istoricul, cu cautare dupa nume sau telefon si filtru viitoare/trecute/anulate. Un clic pe o rezervare deschide detaliile: zi, ora, persoane, telefon, exercitii, mesaj, cand a fost facuta sau anulata si istoricul clientului (recunoscut dupa numarul de telefon).
- Doua rezervari care se suprapun nu sunt posibile; serverul verifica la fiecare rezervare.
- Toate orele sunt in ora Romaniei (`Europe/Bucharest`).

## Variabile

| Variabila | Implicit | Rol |
|---|---|---|
| `PORT` | `3100` | portul serverului |
| `ANTRENOR_PAROLA` | `padel123` | parola panoului; **schimb-o in productie** |
| `DB_FILE` | `./rezervari.db` | unde se salveaza baza de date |

## Ce lipseste

- Nu e publicata pe internet; pentru un link pe care il primesc clientii trebuie gazduita (un server cu disc persistent, pentru ca SQLite e un fisier).
- Clientul nu primeste SMS sau email de confirmare si nu isi poate anula singur rezervarea.
