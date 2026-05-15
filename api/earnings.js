// api/earnings.js
// Fetches upcoming earnings for a given week from Yahoo Finance
// and enriches each company with logo via Clearbit/Google

export const config = { runtime: 'edge' };

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
