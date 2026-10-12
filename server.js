const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cliniciq-db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'cliniciq-db.backup.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const defaultDb = {
  users: [
    {
      _id: 'admin-default',
      username: 'admin2',
      password: 'clinic1',
      email: 'admin@cliniciq.com',
      role: 'admin',
      krijuar_me: new Date().toISOString()
    }
  ],
  patients: []
};

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
    await fs.writeFile(BACKUP_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
  }
}

async function readDb() {
  await ensureDb();

  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : defaultDb.users,
      patients: Array.isArray(parsed.patients) ? parsed.patients : []
    };
  } catch (err) {
    console.error('Gabim gjatë leximit të databazës:', err);
    const rawBackup = await fs.readFile(BACKUP_FILE, 'utf8');
    return JSON.parse(rawBackup);
  }
}

async function writeDb(db) {
  await ensureDb();
  const tmpFile = `${DB_FILE}.tmp`;
  const payload = JSON.stringify(db, null, 2);

  try {
    await fs.copyFile(DB_FILE, BACKUP_FILE);
  } catch {
    // Backup-u krijohet pas ruajtjes së parë nëse file kryesor nuk ekziston ende.
  }

  await fs.writeFile(tmpFile, payload, 'utf8');
  await fs.rename(tmpFile, DB_FILE);
}

function makeId() {
  return crypto.randomBytes(12).toString('hex');
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeVisit(visit = {}) {
  return {
    _id: visit._id || makeId(),
    data: visit.data || new Date().toISOString(),
    sherbimi: String(visit.sherbimi || '').trim(),
    analizat: String(visit.analizat || '').trim(),
    analizat_lista: Array.isArray(visit.analizat_lista) ? visit.analizat_lista.map((a) => String(a || '').trim()).filter(Boolean) : [],
    diagnoza: String(visit.diagnoza || '').trim(),
    cmimi_total: toNumber(visit.cmimi_total),
    pagesa_e_bere: toNumber(visit.pagesa_e_bere),
    cmimi_bruto: toNumber(visit.cmimi_bruto ?? visit.cmimi_total),
    zbritja: toNumber(visit.zbritja),
    menyra_pageses: String(visit.menyra_pageses || 'Cash'),
    statusi_pageses: String(visit.statusi_pageses || (toNumber(visit.pagesa_e_bere) >= toNumber(visit.cmimi_total) ? 'Paguar' : (toNumber(visit.pagesa_e_bere) > 0 ? 'Pjesërisht paguar' : 'Pa paguar'))),
    rezultatet: Array.isArray(visit.rezultatet) ? visit.rezultatet.map((r) => ({
      analiza: String(r.analiza || ''), rezultati: String(r.rezultati || ''),
      njesia: String(r.njesia || ''), referenca: String(r.referenca || '')
    })) : []
  };
}

function normalizePatient(body = {}) {
  const history = Array.isArray(body.historia) ? body.historia : [];

  return {
    _id: body._id || makeId(),
    emri: String(body.emri || '').trim(),
    emri_pacientit: String(body.emri_pacientit || '').trim(),
    mbiemri: String(body.mbiemri || '').trim(),
    telefoni: String(body.telefoni || '').trim(),
    qyteti: String(body.qyteti || '').trim(),
    gjinia: String(body.gjinia || '').trim(),
    numri_personal: String(body.numri_personal || '').trim(),
    krijuar_me: body.krijuar_me || new Date().toISOString(),
    historia: history.map(normalizeVisit),
    terminet: Array.isArray(body.terminet) ? body.terminet : []
  };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await readDb();
  const user = db.users.find((item) => item.username === username);

  if (user && user.password === password) {
    console.log(`Qasje e lejuar për: ${username}`);
    return res.redirect('/dashboard');
  }

  return res.status(401).send('Përdoruesi ose fjalëkalimi i gabuar!');
});

app.get('/api/patients', async (req, res) => {
  const db = await readDb();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json(db.patients);
});

app.get('/api/pacientet', async (req, res) => {
  const db = await readDb();
  res.json(db.patients);
});

app.get('/api/patients/search', async (req, res) => {
  const db = await readDb();
  const query = String(req.query.q || '').trim().toLowerCase();

  if (!query) return res.json(db.patients);

  const patients = db.patients.filter((patient) => {
    const lastVisit = patient.historia?.[patient.historia.length - 1];
    return [
      patient.emri,
      patient.emri_pacientit,
      patient.mbiemri,
      patient.telefoni,
      patient.qyteti,
      patient.gjinia,
      patient.numri_personal,
      lastVisit?.sherbimi,
      lastVisit?.analizat,
      lastVisit?.diagnoza
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  res.json(patients);
});

app.post('/api/patients', async (req, res) => {
  try {
    const incoming = normalizePatient(req.body);

    if (!incoming.emri) {
      return res.status(400).json({ error: 'Emri i pacientit është i detyrueshëm.' });
    }

    const db = await readDb();
    const existing = db.patients.find(
      (patient) => patient.emri.toLowerCase() === incoming.emri.toLowerCase()
    );

    if (existing) {
      existing.telefoni = incoming.telefoni || existing.telefoni;
      existing.emri_pacientit = incoming.emri_pacientit || existing.emri_pacientit;
      existing.mbiemri = incoming.mbiemri || existing.mbiemri;
      existing.qyteti = incoming.qyteti || existing.qyteti;
      existing.gjinia = incoming.gjinia || existing.gjinia;
      existing.numri_personal = incoming.numri_personal || existing.numri_personal;
      existing.historia.push(...incoming.historia);
      existing.terminet = incoming.terminet.length ? incoming.terminet : existing.terminet;
      await writeDb(db);
      return res.status(200).json(existing);
    }

    db.patients.push(incoming);
    await writeDb(db);
    return res.status(201).json(incoming);
  } catch (err) {
    console.error('Gabim gjatë ruajtjes:', err);
    return res.status(500).json({ error: 'Gabim gjatë ruajtjes së pacientit.' });
  }
});

app.get('/api/finances/stats', async (req, res) => {
  const db = await readDb();
  const dataFiltrit = String(req.query.date || '').trim();
  let vizit_totale = 0;
  let pagesat_totale = 0;

  db.patients.forEach((patient) => {
    (Array.isArray(patient.historia) ? patient.historia : []).forEach((visit) => {
      // Kur zgjidhet data, llogaritet vetëm vizita e asaj dite.
      // Pa parametër date ruhet sjellja e mëparshme: totali i të gjitha vizitave.
      const dataRaw = visit.data || patient.krijuar_me || '';
      let dataVizites = String(dataRaw).slice(0, 10);
      // Datat ruhen si ISO/UTC, ndërsa filtri përdor ditën lokale të Kosovës.
      // Ktheje timestamp-in në datën lokale që vizita pas mesnatës të mos bjerë në ditën paraprake.
      if (dataRaw) {
        const dateObj = new Date(dataRaw);
        if (!Number.isNaN(dateObj.getTime())) {
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Belgrade',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).formatToParts(dateObj);
          const part = (type) => parts.find((p) => p.type === type)?.value || '';
          dataVizites = `${part('year')}-${part('month')}-${part('day')}`;
        }
      }
      if (dataFiltrit && dataVizites !== dataFiltrit) return;
      vizit_totale += toNumber(visit.cmimi_total);
      pagesat_totale += toNumber(visit.pagesa_e_bere);
    });
  });

  res.json({
    data: dataFiltrit || null,
    vizit_totale,
    pagesat_totale,
    borxhi: vizit_totale - pagesat_totale
  });
});

app.patch('/api/patients/:id/visits/:visitId', async (req, res) => {
  try {
    const db = await readDb();
    const patient = db.patients.find((item) => item._id === req.params.id);
    if (!patient) return res.status(404).json({ error: 'Pacienti nuk u gjet.' });
    const visit = patient.historia.find((item) => item._id === req.params.visitId);
    if (!visit) return res.status(404).json({ error: 'Vizita nuk u gjet.' });
    if (Array.isArray(req.body.rezultatet)) {
      visit.rezultatet = req.body.rezultatet.map((r) => ({
        analiza: String(r.analiza || '').trim(),
        rezultati: String(r.rezultati || '').trim(),
        njesia: String(r.njesia || '').trim(),
        referenca: String(r.referenca || '').trim(),
        statusi: ['Në pritje', 'Në proces', 'Rezultati i plotësuar', 'I verifikuar'].includes(String(r.statusi || ''))
          ? String(r.statusi)
          : (String(r.rezultati || '').trim() ? 'Rezultati i plotësuar' : 'Në pritje')
      }));
    }
    if (Array.isArray(req.body.shto_analiza) && req.body.shto_analiza.length) {
      const existing = Array.isArray(visit.analizat_lista) && visit.analizat_lista.length
        ? visit.analizat_lista.map((name) => String(name || '').trim()).filter(Boolean)
        : String(visit.analizat || '').split(',').map((name) => name.trim()).filter(Boolean);
      const existingNames = new Set(existing.map((name) => name.toLocaleLowerCase()));
      const added = [];
      for (const item of req.body.shto_analiza) {
        const name = String(item?.analiza || '').trim();
        const price = toNumber(item?.cmimi);
        if (!name || price < 0 || existingNames.has(name.toLocaleLowerCase())) continue;
        existingNames.add(name.toLocaleLowerCase());
        existing.push(name);
        added.push({ analiza: name, cmimi: price });
      }
      if (added.length) {
        const extraPrice = added.reduce((sum, item) => sum + item.cmimi, 0);
        visit.analizat_lista = existing;
        visit.analizat = existing.join(', ');
        visit.sherbimi = visit.sherbimi || 'Analiza Laboratorike';
        visit.cmimi_bruto = Number((toNumber(visit.cmimi_bruto ?? visit.cmimi_total) + extraPrice).toFixed(2));
        visit.cmimi_total = Number((toNumber(visit.cmimi_total) + extraPrice).toFixed(2));
        const results = Array.isArray(visit.rezultatet) ? visit.rezultatet : [];
        const resultNames = new Set(results.map((r) => String(r.analiza || '').toLocaleLowerCase()));
        added.forEach((item) => {
          if (!resultNames.has(item.analiza.toLocaleLowerCase())) {
            results.push({ analiza: item.analiza, rezultati: '', njesia: '', referenca: '', statusi: 'Në pritje' });
          }
        });
        visit.rezultatet = results;
        visit.statusi_pageses = toNumber(visit.pagesa_e_bere) >= toNumber(visit.cmimi_total) ? 'Paguar' : (toNumber(visit.pagesa_e_bere) > 0 ? 'Pjesërisht paguar' : 'Pa paguar');
      }
    }
    if (req.body.pagesa_e_bere !== undefined) {
      visit.pagesa_e_bere = Math.min(toNumber(visit.cmimi_total), Math.max(0, toNumber(req.body.pagesa_e_bere)));
      visit.statusi_pageses = visit.pagesa_e_bere >= toNumber(visit.cmimi_total) ? 'Paguar' : (visit.pagesa_e_bere > 0 ? 'Pjesërisht paguar' : 'Pa paguar');
    }
    await writeDb(db);
    return res.json(patient);
  } catch (err) {
    console.error('Gabim gjatë përditësimit të vizitës:', err);
    return res.status(500).json({ error: 'Nuk u ruajtën ndryshimet e vizitës.' });
  }
});

app.delete('/api/patients/:id', async (req, res) => {
  const db = await readDb();
  const before = db.patients.length;
  db.patients = db.patients.filter((patient) => patient._id !== req.params.id);

  if (db.patients.length === before) {
    return res.status(404).json({ error: 'Pacienti nuk u gjet.' });
  }

  await writeDb(db);
  res.json({ success: true });
});

ensureDb()
  .then(() => {
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`CLINICIQ DESKTOP: ONLINE vetëm në këtë kompjuter: http://127.0.0.1:${PORT}`);
      console.log(`DATABASE lokale: ${DB_FILE}`);
      console.log('Llogaria fillestare: admin2 / clinic1');
    });
  })
  .catch((err) => {
    console.error('Serveri nuk mund të startojë:', err);
    process.exit(1);
  });
