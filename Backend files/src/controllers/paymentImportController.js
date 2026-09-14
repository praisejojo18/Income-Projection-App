const prisma = require("../config/database");
const { analyzePayment } = require("../utils/paymentBrain");

// ---------- CSV PARSER ----------
function parseCSV(text) {
  text = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  const firstLine = text.split(/\r?\n/)[0] || "";
  let sep = ",";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const c of firstLine) if (counts[c] !== undefined) counts[c]++;
  if (counts[";"] > counts[","] && counts[";"] > counts["\t"]) sep = ";";
  else if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) sep = "\t";

  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (h) => (h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

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
  find("customerId", n => n.includes("customerid") || n.includes("clientid") || n.includes("pbs") || n.includes("accountno") || n === "id");
  find("date",       n => n.includes("date") || n.includes("day"));
  find("action",     n => n === "action" || n === "type" || n === "trxtype");
  find("amount",     n => n.includes("amount") || n.includes("price") || n === "sum" || n === "total");
  find("details",    n => n.includes("detail") || n.includes("description") || n.includes("narration") || n.includes("remark"));
  find("logMessage", n => n.includes("log") || n.includes("message") || n.includes("note"));

  const discarded = headers.filter((h, i) => !used.has(i));
  return { map, discarded };
}

function cleanMoney(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseDate(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/))) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
  if ((m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]*(\d{4})/))) { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; if (mo !== undefined) return new Date(+m[3], mo, +m[1]); }
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : t;
}

const LABELS = {
  customerId: "Customer ID (PBS)", date: "Date", action: "Action",
  amount: "Amount", details: "Details", logMessage: "Log Message"
};

exports.preview = async (req, res) => {
  try {
    const rows = parseCSV(req.body.csv);
    if (rows.length < 2) return res.status(400).json({ success: false, message: "CSV is empty." });
    const headers = rows[0];
    const { map, discarded } = buildMapping(headers);
    const mapping = {};
    Object.keys(map).forEach(k => { mapping[k] = { label: LABELS[k], csvColumn: headers[map[k]] }; });
    const pick = (r, k) => (map[k] !== undefined ? (r[map[k]] || "").trim() : null);
    const sample = rows.slice(1, 6).map(r => ({
      customerId: pick(r, "customerId"), date: pick(r, "date"), action: pick(r, "action"),
      amount: pick(r, "amount") || "(try Details)", details: pick(r, "details")
    }));
    res.json({ success: true, totalRows: rows.length - 1, mapping, discarded, sample });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.execute = async (req, res) => {
  try {
    const rows = parseCSV(req.body.csv);
    if (rows.length < 2) return res.status(400).json({ success: false, message: "CSV is empty." });
    const headers = rows[0];
    const { map } = buildMapping(headers);
    if (map.customerId === undefined) {
      return res.status(400).json({ success: false, message: "Could not find a Customer ID column." });
    }

    const userId = req.userId;
    const allPlans = await prisma.plan.findMany({ where: { userId, status: "ACTIVE" } });
    const allCustomers = await prisma.customer.findMany({
      where: { userId }, include: { plan: true }
    });
    const pbsMap = {};
    allCustomers.forEach(c => {
      if (c.externalId) pbsMap[c.externalId] = c;
      pbsMap[c.id] = c;
    });

    const existing = await prisma.payment.findMany({
      where: { userId }, select: { paymentDate: true, customerId: true, amount: true, reference: true }
    });
    const seenKeys = new Set(existing.map(p => `${p.customerId}|${p.paymentDate.toISOString().slice(0,10)}|${Math.round(Number(p.amount))}`));

    let imported = 0, duplicates = 0, notFound = 0, skipped = 0;
    const typeCounts = { renewal: 0, multi_month: 0, upgrade: 0, manual: 0 };
    const sample = [];
    const dataRows = rows.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const pick = (k) => (map[k] !== undefined ? (r[map[k]] || "").trim() : null);

      try {
        const pbsId = pick("customerId");
        if (!pbsId) { skipped++; continue; }

        // Only keep credit rows if Action column exists
        if (map.action !== undefined) {
          const action = (pick("action") || "").toLowerCase();
          if (action && !["credit", "cr", "deposit", "in", "payment", "received"].some(k => action.includes(k))) {
            skipped++; continue;
          }
        }

        let amount = cleanMoney(pick("amount"));
        if (amount == null) amount = cleanMoney(pick("details"));
        if (amount == null || amount <= 0) { skipped++; continue; }

        const customer = pbsMap[pbsId];
        if (!customer) { notFound++; continue; }

        const payDate = parseDate(pick("date")) || new Date();
        const key = `${customer.id}|${payDate.toISOString().slice(0,10)}|${Math.round(amount)}`;
        if (seenKeys.has(key)) { duplicates++; continue; }

        const brain = await analyzePayment(userId, customer, amount, allPlans);
        typeCounts[brain.type]++;

        // AUTO-APPLY: extend customer expiry (and change plan on upgrade)
        const effect = brain.applyEffect || { addMonths: 1 };
        const currentExpiry = new Date(customer.expiryDate);
        const base = currentExpiry > new Date() ? currentExpiry : new Date();
        if (effect.addMonths) base.setMonth(base.getMonth() + effect.addMonths);

        const customerUpdate = { expiryDate: base };
        if (effect.changePlanId) {
          customerUpdate.planId = effect.changePlanId;
          customerUpdate.status = base < new Date() ? "EXPIRED" : "ACTIVE";
        }

        const count = await prisma.payment.count({ where: { userId } });
        let reference = `IMP-${String(count + imported + 1).padStart(5, "0")}`;

        await prisma.$transaction([
          prisma.payment.create({
            data: {
              userId,
              customerId: customer.id,
              planId: customer.planId,
              amount,
              paymentDate: payDate,
              method: "BANK_TRANSFER",
              reference,
              paymentType: brain.type,
              monthsPaid: brain.monthsPaid,
              discountPercent: brain.discountPercent
            }
          }),
          prisma.customer.update({ where: { id: customer.id }, data: customerUpdate })
        ]);

        seenKeys.add(key);
        imported++;

        if (sample.length < 5) {
          sample.push({
            pbsId, customer: customer.name, amount,
            type: brain.type, description: brain.description
          });
        }
      } catch (e) { skipped++; }
    }

    res.json({
      success: true, imported, duplicates, notFound, skipped,
      typeCounts, sample
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};