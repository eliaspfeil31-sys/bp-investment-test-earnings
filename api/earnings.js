// api/earnings.js — Financial Modeling Prep (zuverlässig, kostenlos bis 250 req/Tag)
export const config = { runtime: 'edge' };

const FMP_KEY = process.env.FMP_API_KEY || 'demo';

function getWeekDates(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { monday, friday };
}

function fmt(d) { return d.toISOString().slice(0, 10); }

function dayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][d.getUTCDay()];
}

function weekLabel(monday, friday) {
  const m = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${m(monday)} – ${m(friday)}`;
}

const LOGO_OVERRIDES = {
  AAPL:'apple.com', GOOGL:'google.com', GOOG:'google.com', MSFT:'microsoft.com',
  AMZN:'amazon.com', META:'meta.com', NVDA:'nvidia.com', TSLA:'tesla.com',
  NFLX:'netflix.com', AMD:'amd.com', INTC:'intel.com', WMT:'walmart.com',
  TGT:'target.com', HD:'homedepot.com', LOW:'lowes.com', NKE:'nike.com',
  SBUX:'starbucks.com', MCD:'mcdonalds.com', JPM:'jpmorganchase.com',
  BAC:'bankofamerica.com', GS:'goldmansachs.com', MS:'morganstanley.com',
  V:'visa.com', MA:'mastercard.com', DIS:'disney.com', BA:'boeing.com',
  XOM:'exxonmobil.com', CVX:'chevron.com', PFE:'pfizer.com', JNJ:'jnj.com',
};

function logoUrl(ticker, companyName) {
  if (LOGO_OVERRIDES[ticker]) return `https://logo.clearbit.com/${LOGO_OVERRIDES[ticker]}?size=128`;
  const clean = (companyName || ticker)
    .toLowerCase()
    .replace(/\b(inc|corp|ltd|llc|plc|co|group|holdings|technologies|technology|systems|solutions|services|international|global)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  const domain = clean ? `${clean}.com` : `${ticker.toLowerCase()}.com`;
  return `https://logo.clearbit.com/${domain}?size=128`;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const weekOffset = parseInt(searchParams.get('week') || '0', 10);
  const { monday, friday } = getWeekDates(weekOffset);

  const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${fmt(monday)}&to=${fmt(friday)}&apikey=${FMP_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FMP error ${res.status}`);
    const raw = await res.json();

    if (!Array.isArray(raw)) throw new Error(raw?.['Error Message'] || 'Unbekannter Fehler — API Key fehlt?');

    const days = {
      monday:{bmo:[],amc:[]}, tuesday:{bmo:[],amc:[]}, wednesday:{bmo:[],amc:[]},
      thursday:{bmo:[],amc:[]}, friday:{bmo:[],amc:[]}
    };

    for (const e of raw) {
      const day = dayName(e.date);
      if (!days[day]) continue;
      const slot = (e.time === 'bmo' || e.time === 'BMO') ? 'bmo' : 'amc';
      if (days[day][slot].length >= 8) continue;
      days[day][slot].push({
        ticker: e.symbol,
        company: e.symbol,
        logoUrl: logoUrl(e.symbol, e.symbol),
        bgMode: 'none',
      });
    }

    return new Response(JSON.stringify({ weekLabel: weekLabel(monday, friday), days }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 's-maxage=3600' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

const DAYS_MAP = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function getWeekRange(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offsetWeeks * 7);
  monday.setHours(0,0,0,0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { monday, friday };
}

function dateKey(d) {
  return d.toISOString().slice(0,10); // YYYY-MM-DD
}

// Yahoo Finance earnings calendar URL
function yahooEarningsUrl(dateStr) {
  return `https://finance.yahoo.com/calendar/earnings?day=${dateStr}`;
}

// Fetch earnings for a single day from Yahoo Finance
async function fetchDayEarnings(dateStr) {
  const url = `https://query1.finance.yahoo.com/v1/finance/earning?date=${dateStr}&offset=0&size=50&lang=en-US&region=US`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = json?.finance?.result?.[0]?.rows || [];

    return rows.map(r => ({
      ticker: r.ticker || '',
      company: r.companyshortname || r.ticker || '',
      time: r.startdatetimetype || 'TAS', // BMO / AMC / TAS
      epsEst: r.epsestimate,
      domain: guessDomain(r.ticker, r.companyshortname),
    }));
  } catch {
    return [];
  }
}

// Heuristic: guess company domain for logo lookup
function guessDomain(ticker, name) {
  // A few well-known overrides
  const overrides = {
    AAPL:'apple.com', GOOGL:'google.com', GOOG:'google.com',
    MSFT:'microsoft.com', AMZN:'amazon.com', META:'meta.com',
    NVDA:'nvidia.com', TSLA:'tesla.com', NFLX:'netflix.com',
    AMD:'amd.com', INTC:'intel.com', QCOM:'qualcomm.com',
    DIS:'disney.com', V:'visa.com', MA:'mastercard.com',
    JPM:'jpmorganchase.com', BAC:'bankofamerica.com', WFC:'wellsfargo.com',
    GS:'goldmansachs.com', MS:'morganstanley.com',
    WMT:'walmart.com', TGT:'target.com', COST:'costco.com',
    HD:'homedepot.com', LOW:'lowes.com', NKE:'nike.com',
    SBUX:'starbucks.com', MCD:'mcdonalds.com', YUM:'yum.com',
    PFE:'pfizer.com', JNJ:'jnj.com', ABBV:'abbvie.com',
    XOM:'exxonmobil.com', CVX:'chevron.com', BP:'bp.com',
    BA:'boeing.com', CAT:'caterpillar.com', GE:'ge.com',
  };
  if (overrides[ticker]) return overrides[ticker];

  // Generic: lowercase name, remove Inc/Corp/Ltd, add .com
  const clean = (name || ticker)
    .toLowerCase()
    .replace(/\b(inc|corp|ltd|llc|plc|co|group|holdings|technologies|technology|systems|solutions|services|international|global|enterprises|partners)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return clean ? `${clean}.com` : `${ticker.toLowerCase()}.com`;
}

// Logo URL via Clearbit (free, no key needed for logos)
function logoUrl(domain) {
  return `https://logo.clearbit.com/${domain}?size=128`;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const weekOffset = parseInt(searchParams.get('week') || '0', 10);

  const { monday, friday } = getWeekRange(weekOffset);

  // Build result structure
  const result = {
    weekLabel: `${monday.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${friday.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,
    days: {}
  };

  const dayNames = ['monday','tuesday','wednesday','thursday','friday'];
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({ name: dayNames[i], dateStr: dateKey(d) });
  }

  // Fetch all days in parallel
  await Promise.all(dates.map(async ({ name, dateStr }) => {
    const earnings = await fetchDayEarnings(dateStr);

    const bmo = earnings
      .filter(e => e.time === 'BMO' || e.time === 'PRE')
      .slice(0, 8)
      .map(e => ({
        ticker: e.ticker,
        company: e.company,
        logoUrl: logoUrl(e.domain),
        domain: e.domain,
        bgMode: 'none',
      }));

    const amc = earnings
      .filter(e => e.time === 'AMC' || e.time === 'POST')
      .slice(0, 8)
      .map(e => ({
        ticker: e.ticker,
        company: e.company,
        logoUrl: logoUrl(e.domain),
        domain: e.domain,
        bgMode: 'none',
      }));

    result.days[name] = { bmo, amc };
  }));

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 's-maxage=3600',
    }
  });
}
