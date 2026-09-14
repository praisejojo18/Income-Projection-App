const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ---------- CSV PARSER (quotes, commas, semicolons, tabs, CRLF, Excel BOM) ----------
function parseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];

  // 🧠 SMART DETECT: comma, semicolon or tab separated?
  const firstLine = text.split(/\r?\n/)[0] || '';
  let sep = ',';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const c of firstLine) { if (counts[c] !== undefined) counts[c]++; }
  if (counts[';'] > counts[','] && counts[';'] > counts['\t']) sep = ';';
  else if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) sep = '\t';

  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (h) => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normPlan = (s) => String(s || '').toLowerCase().replace(/plus/g, '+').replace(/[^a-z0-9+]/g, '');

// ---------- SMART MAPPING (relaxed rules + fallbacks) ----------
function buildMapping(headers) {
  const used = new Set();
  const map = {};
  const find = (key, test) => {
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      const n = norm(headers[i]);
      if (test(n)) { map[key] = i; used.add(i); return; }
    }
  };
  find('externalId',    n => n.includes('clientid') || n.includes('customerid') || n.includes('accountno') || n.includes('pbs') || n === 'id');
  find('status',        n => n === 'expird' || n === 'expired' || n === 'isexpired' || n === 'status' || n.includes('expired'));
  find('expiryDate',    n => n.includes('xpir') || n.includes('expir'));
  find('plan',          n => n.includes('plan') || n.includes('service') || n.includes('package'));
  find('amount',        n => n.includes('amount') || n.includes('price') || n.includes('fee'));
  find('customerSince', n => n.includes('subscribed') || n.includes('since') || n.includes('start') || n.includes('join') || n.includes('regist'));
  find('billingDate',   n => n.includes('biling') || n.includes('billing') || n.includes('billdate'));
  find('paymentDate',   n => n.includes('paymentdate') || n.includes('datepaid') || n.includes('paiddate') || n.includes('lastpaid') || n.includes('paidon') || n.includes('payment'));
  find('email',         n => n.includes('mail'));
  find('phone',         n => n.includes('phone') || n.includes('tel') || n.includes('whatsapp') || n === 'contact');

  // 🧠 RELAXED NAME FINDER (Accepts almost anything)
  find('name', n => n === 'customer' || n === 'client' || n === 'name' || n.includes('customername') || n.includes('clientname') || n.includes('fullname') || n.includes('firstname') || n.includes('member') || n.includes('tenant') || n.includes('user') || n.includes('holder') || n.includes('subscriber'));

  // 🛡️ ULTIMATE FALLBACK: If name is STILL missing, just grab the first unused column!
  if (map.name === undefined) {
    for (let i = 0; i < headers.length; i++) {
      if (!used.has(i)) { map.name = i; used.add(i); break; }
    }
  }

  const discarded = headers.filter((h, i) => !used.has(i));
  return { map, discarded };
}

// ---------- CLEANERS ----------
function cleanMoney(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : n;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseDate(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/))) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]*(\d{4})/))) { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; if (mo !== undefined) return new Date(+m[3], mo, +m[1]); }
  if ((m = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s*(\d{4})/))) { const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; if (mo !== undefined) return new Date(+m[3], mo, +m[2]); }
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : t;
}

function cleanStatus(v) {
  const s = String(v || '').trim().toUpperCase();
  if (['ACTIVE', 'EXPIRED', 'INACTIVE'].includes(s)) return s;
  if (['YES', 'Y', 'TRUE', '1'].includes(s)) return 'EXPIRED';
  return 'ACTIVE';
}

const LABELS = {
  externalId: 'Client ID (PBS…)', name: 'Customer Name', plan: 'Service Plan', amount: 'Amount (ignored if plan exists)',
  customerSince: 'Date Subscribed', billingDate: 'Billing Date', paymentDate: 'Payment Date', expiryDate: 'Expiry Date',
  email: 'Email', phone: 'Phone', status: 'Expired / Status'
};

// ---------- PREVIEW ----------
exports.preview = async (req, res) => {
  try {
    const rows = parseCSV(req.body.csv);
    if (rows.length < 2) return res.status(400).json({ success: false, message: 'CSV is empty or has no data rows.' });
    const headers = rows[0];
    const { map, discarded } = buildMapping(headers);
    const mapping = {};
    Object.keys(map).forEach(k => { mapping[k] = { label: LABELS[k], csvColumn: headers[map[k]] }; });
    const pick = (r, k) => (map[k] !== undefined ? (r[map[k]] || '').trim() : null);
    const sample = rows.slice(1, 6).map(r => ({
      externalId: pick(r, 'externalId'), name: pick(r, 'name'), plan: pick(r, 'plan'),
      amount: pick(r, 'amount'), expiryDate: pick(r, 'expiryDate')
    }));
    res.json({ success: true, totalRows: rows.length - 1, mapping, discarded, sample });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------- EXECUTE ----------
exports.execute = async (req, res) => {
  try {
    const rows = parseCSV(req.body.csv);
    if (rows.length < 2) return res.status(400).json({ success: false, message: 'CSV is empty.' });
    const headers = rows[0];
    const { map, discarded } = buildMapping(headers);

    if (map.name === undefined) return res.status(400).json({ success: false, message: 'Could not identify a customer name column. Please ensure one column contains the word "Name", "Client", or "Customer".' });

    const ownerId = req.userId;

    // Load the company's REAL plans — their prices are the source of truth
    const myPlans = await prisma.plan.findMany({ where: { userId: ownerId } });
    const planCache = {};
    myPlans.forEach(p => { planCache[normPlan(p.name)] = p; });

    // Load existing client IDs once
    const existing = await prisma.customer.findMany({ where: { userId: ownerId }, select: { externalId: true } });
    const seenIds = new Set(existing.map(e => e.externalId).filter(Boolean));

    let imported = 0, duplicates = 0, priceOverrides = 0, paymentsRecorded = 0;
    const skipped = [];
    const plansCreated = new Set();
    const dataRows = rows.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rowNo = i + 2;
      const pick = (k) => (map[k] !== undefined ? (r[map[k]] || '').trim() : null);
      try {
        const name = pick('name');
        if (!name) { skipped.push({ row: rowNo, reason: 'Missing customer name' }); continue; }

        const externalId = pick('externalId') || null;
        if (externalId && seenIds.has(externalId)) { duplicates++; continue; }

        // 🧠 RELAXED PLAN FINDER
        const planName = pick('plan');
        let plan = planName ? planCache[normPlan(planName)] : null;
        if (!plan && planName) {
          plan = await prisma.plan.findFirst({ where: { userId: ownerId, name: planName } });
          if (plan) planCache[normPlan(planName)] = plan;
        }
        if (!plan) {
          if (planName) {
            const amount = cleanMoney(pick('amount'));
            plan = await prisma.plan.create({ data: { userId: ownerId, name: planName, price: amount || 0, durationDays: 30, status: 'ACTIVE' } });
            planCache[normPlan(planName)] = plan;
            plansCreated.add(planName);
          } else {
            const fallbackPlan = myPlans[0];
            if (!fallbackPlan) {
               skipped.push({ row: rowNo, name, reason: 'No plans exist in your system. Create a plan first.' }); continue;
            }
            plan = fallbackPlan;
          }
        } else {
          const csvAmount = cleanMoney(pick('amount'));
          if (csvAmount !== null && Math.abs(csvAmount - Number(plan.price)) > 0.009) priceOverrides++;
        }

        const since = parseDate(pick('customerSince'));
        const expiry = parseDate(pick('expiryDate'))
          || (since ? new Date(since.getTime() + (plan.durationDays || 30) * 86400000) : null)
          || new Date(Date.now() + (plan.durationDays || 30) * 86400000);

        const status = map.status !== undefined ? cleanStatus(r[map.status]) : (expiry.getTime() < Date.now() ? 'EXPIRED' : 'ACTIVE');

        const created = await prisma.customer.create({
          data: {
            userId: ownerId,
            name,
            email: pick('email'),
            phone: pick('phone'),
            planId: plan.id,
            expiryDate: expiry,
            customerSince: since || new Date(),
            status,
            ...(externalId ? { externalId } : {})
          }
        });
        if (externalId) seenIds.add(externalId);
        imported++;

        // 💳 AUTO-PAYMENT: ACTIVE + EXPIRED customers get a payment at the plan's REAL price
        if (status !== 'INACTIVE') {
          const payDate = parseDate(pick('paymentDate')) || new Date();
          await prisma.payment.create({
            data: {
              userId: ownerId,
              customerId: created.id,
              planId: plan.id,
              amount: plan.price,
              paymentDate: payDate,
              method: 'CASH',
              reference: 'IMP-' + (externalId || created.id)
            }
          });
          paymentsRecorded++;
        }
      } catch (e) {
        skipped.push({ row: rowNo, reason: e.message });
      }
    }

    res.json({ success: true, imported, duplicates, skipped, plansCreated: [...plansCreated], priceOverrides, paymentsRecorded, discarded });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};