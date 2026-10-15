// PIX Mobile Engine (Compatible APK Android autonome & Serveur Local)
const LOCAL_STORAGE_KEY = "pix_portfolio_v1";

const DEFAULT_MARKET_QUOTES = [
  {
    ticker: "SNTS",
    name: "Sonatel Sénégal",
    class: "Stocks",
    category: "Télécoms",
    price_xof: 22600.0,
    change_pct: 1.45,
    pe_ratio: 10.4,
    dividend_yield: 7.4
  },
  {
    ticker: "ECOC",
    name: "Ecobank Côte d'Ivoire",
    class: "Stocks",
    category: "Banque",
    price_xof: 8150.0,
    change_pct: -0.61,
    pe_ratio: 6.8,
    dividend_yield: 8.3
  },
  {
    ticker: "SGBC",
    name: "Société Générale CI",
    class: "Stocks",
    category: "Banque",
    price_xof: 19100.0,
    change_pct: 0.52,
    pe_ratio: 8.1,
    dividend_yield: 6.5
  },
  {
    ticker: "ORAC",
    name: "Orange Côte d'Ivoire",
    class: "Stocks",
    category: "Télécoms",
    price_xof: 14700.0,
    change_pct: 2.10,
    pe_ratio: 9.2,
    dividend_yield: 7.1
  },
  {
    ticker: "TPCI_590",
    name: "TPCI 5.90% 2024-2031",
    class: "Bonds",
    category: "Obligation d'État",
    price_xof: 10000.0,
    change_pct: 0.00,
    pe_ratio: null,
    dividend_yield: 5.9
  },
  {
    ticker: "FCP_EXP",
    name: "FCP Daba Expansion",
    class: "Mutual Funds",
    category: "OPCVM Diversifié",
    price_xof: 50000.0,
    change_pct: 0.85,
    pe_ratio: null,
    dividend_yield: 6.8
  },
  {
    ticker: "AFRI_TECH",
    name: "Fintech West Africa Seed",
    class: "Venture",
    category: "Capital-Risque",
    price_xof: 100000.0,
    change_pct: 0.00,
    pe_ratio: null,
    dividend_yield: 0.0
  }
];

const INITIAL_PORTFOLIO = {
  cash_xof: 250000.0,
  positions: {
    SNTS: { quantity: 8, avg_price: 22000.0, asset_class: "Stocks" },
    SGBC: { quantity: 5, avg_price: 18500.0, asset_class: "Stocks" },
    TPCI_590: { quantity: 10, avg_price: 10000.0, asset_class: "Bonds" }
  },
  history: [
    { id: 1, type: "DEPOSIT", label: "Dépôt Mobile Money (Wave)", amount_xof: 500000.0, date: "14/10/2026" },
    { id: 2, type: "BUY", label: "Achat 8x Sonatel (SNTS)", amount_xof: -176000.0, date: "14/10/2026" },
    { id: 3, type: "BUY", label: "Achat 10x TPCI 5.90% 2024-2031", amount_xof: -100000.0, date: "15/10/2026" }
  ]
};

let appState = {
  portfolio: null,
  quotes: DEFAULT_MARKET_QUOTES,
  selectedQuote: null,
  currentOrderType: "BUY",
  currentFilter: "ALL"
};

function getStoragePortfolio() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return JSON.parse(JSON.stringify(INITIAL_PORTFOLIO));
}

function saveStoragePortfolio(p) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(p));
}

// Chime audio
function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

function loadPortfolioData() {
  const raw = getStoragePortfolio();
  const quotesMap = {};
  appState.quotes.forEach(q => { quotesMap[q.ticker] = q; });

  const investedByClass = { Stocks: 0.0, Bonds: 0.0, "Mutual Funds": 0.0, Venture: 0.0 };
  let totalInvested = 0.0;
  const positionsDetail = [];

  for (const [ticker, pos] of Object.entries(raw.positions || {})) {
    const q = quotesMap[ticker];
    const price = q ? q.price_xof : pos.avg_price;
    const marketVal = price * pos.quantity;
    const costVal = pos.avg_price * pos.quantity;
    const gainVal = marketVal - costVal;
    const gainPct = costVal > 0 ? (gainVal / costVal * 100) : 0.0;
    const aclass = pos.asset_class || "Stocks";

    investedByClass[aclass] = (investedByClass[aclass] || 0.0) + marketVal;
    totalInvested += marketVal;

    positionsDetail.push({
      ticker: ticker,
      name: q ? q.name : ticker,
      quantity: pos.quantity,
      avg_price: pos.avg_price,
      current_price: price,
      market_value: marketVal,
      gain_xof: gainVal,
      gain_pct: Math.round(gainPct * 100) / 100,
      asset_class: aclass
    });
  }

  const totalPortfolio = totalInvested + (raw.cash_xof || 0.0);
  const allocPct = {};
  for (const [ac, val] of Object.entries(investedByClass)) {
    allocPct[ac] = totalPortfolio > 0 ? Math.round((val / totalPortfolio * 100) * 10) / 10 : 0.0;
  }
  allocPct.Cash = totalPortfolio > 0 ? Math.round(((raw.cash_xof || 0.0) / totalPortfolio * 100) * 10) / 10 : 0.0;

  appState.portfolio = {
    total_portfolio_xof: Math.round(totalPortfolio),
    cash_xof: Math.round(raw.cash_xof || 0.0),
    total_invested_xof: Math.round(totalInvested),
    allocation_pct: allocPct,
    positions: positionsDetail,
    history: raw.history || []
  };

  renderPortfolio();
}

function renderPortfolio() {
  const p = appState.portfolio;
  if (!p) return;

  document.getElementById("portfolio-total").innerText = `${p.total_portfolio_xof.toLocaleString("fr-FR")} XOF`;
  document.getElementById("portfolio-cash").innerText = `Liquidités : ${p.cash_xof.toLocaleString("fr-FR")} XOF`;
  document.getElementById("positions-count").innerText = p.positions.length;

  const bar = document.getElementById("allocation-bar");
  const alloc = p.allocation_pct;
  bar.innerHTML = `
    <div class="bar-segment stocks" style="width: ${alloc.Stocks || 0}%" title="Actions ${alloc.Stocks || 0}%"></div>
    <div class="bar-segment bonds" style="width: ${alloc.Bonds || 0}%" title="Obligations ${alloc.Bonds || 0}%"></div>
    <div class="bar-segment funds" style="width: ${alloc['Mutual Funds'] || 0}%" title="FCP ${alloc['Mutual Funds'] || 0}%"></div>
    <div class="bar-segment venture" style="width: ${alloc.Venture || 0}%" title="Venture ${alloc.Venture || 0}%"></div>
    <div class="bar-segment cash" style="width: ${alloc.Cash || 0}%" title="Cash ${alloc.Cash || 0}%"></div>
  `;

  const posContainer = document.getElementById("positions-container");
  if (!p.positions.length) {
    posContainer.innerHTML = `<div class="card-item" style="justify-content:center; color:#9ca3af;">Aucun titre en portefeuille. Découvrez le marché BRVM !</div>`;
  } else {
    posContainer.innerHTML = p.positions.map(pos => {
      const isUp = pos.gain_pct >= 0;
      return `
        <div class="card-item" onclick="openOrderModalFromTicker('${pos.ticker}')">
          <div class="card-left">
            <div class="ticker-badge">${pos.ticker}</div>
            <div>
              <div class="card-title">${pos.name}</div>
              <div class="card-sub">${pos.quantity} titres • PRU : ${pos.avg_price.toLocaleString("fr-FR")} XOF</div>
            </div>
          </div>
          <div class="card-right">
            <div class="card-price">${pos.market_value.toLocaleString("fr-FR")} XOF</div>
            <div class="card-change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${pos.gain_pct}%</div>
          </div>
        </div>
      `;
    }).join("");
  }

  const histContainer = document.getElementById("history-container");
  histContainer.innerHTML = (p.history || []).map(h => {
    const isDeposit = h.type === "DEPOSIT";
    const isBuy = h.type === "BUY";
    return `
      <div class="card-item">
        <div class="card-left">
          <div class="ticker-badge" style="background:${isDeposit ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'}; color:${isDeposit ? '#34d399' : '#60a5fa'}">
            ${isDeposit ? '↓' : (isBuy ? '↗' : '↘')}
          </div>
          <div>
            <div class="card-title">${h.label}</div>
            <div class="card-sub">${h.date}</div>
          </div>
        </div>
        <div class="card-right">
          <div class="card-price" style="color:${isDeposit ? '#34d399' : '#e5e7eb'}">
            ${h.amount_xof > 0 ? '+' : ''}${h.amount_xof.toLocaleString("fr-FR")} XOF
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderMarket() {
  const container = document.getElementById("market-container");
  const filtered = appState.quotes.filter(q => {
    if (appState.currentFilter === "ALL") return true;
    return q.class === appState.currentFilter;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="card-item" style="justify-content:center; color:#9ca3af;">Aucun actif disponible dans cette catégorie.</div>`;
    return;
  }

  container.innerHTML = filtered.map(q => {
    const isUp = q.change_pct >= 0;
    return `
      <div class="card-item" onclick="openOrderModal(${JSON.stringify(q).replace(/"/g, '&quot;')})">
        <div class="card-left">
          <div class="ticker-badge">${q.ticker}</div>
          <div>
            <div class="card-title">${q.name}</div>
            <div class="card-sub">${q.category} ${q.pe_ratio ? '• PER : ' + q.pe_ratio : ''} ${q.dividend_yield ? '• Div : ' + q.dividend_yield + '%' : ''}</div>
          </div>
        </div>
        <div class="card-right">
          <div class="card-price">${q.price_xof.toLocaleString("fr-FR")} XOF</div>
          <div class="card-change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${q.change_pct}%</div>
        </div>
      </div>
    `;
  }).join("");
}

function switchTab(tabId, el) {
  document.querySelectorAll(".tab-view").forEach(t => t.classList.remove("active"));
  document.getElementById(`tab-${tabId}`).classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (el) {
    el.classList.add("active");
  } else {
    const navItems = document.querySelectorAll(".nav-item");
    if (tabId === "portfolio") navItems[0].classList.add("active");
    if (tabId === "market") navItems[1].classList.add("active");
    if (tabId === "activity") navItems[2].classList.add("active");
    if (tabId === "profile") navItems[3].classList.add("active");
  }
}

function filterMarket(category, el) {
  appState.currentFilter = category;
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  renderMarket();
}

function openOrderModal(quote) {
  appState.selectedQuote = quote;
  document.getElementById("modal-quote-name").innerText = `${quote.name} (${quote.ticker})`;
  document.getElementById("modal-price").innerText = `${quote.price_xof.toLocaleString("fr-FR")} XOF`;
  document.getElementById("modal-pe").innerText = quote.pe_ratio ? `${quote.pe_ratio}x` : 'N/A';
  document.getElementById("modal-div").innerText = quote.dividend_yield ? `${quote.dividend_yield}%` : 'N/A';
  document.getElementById("order-quantity").value = 1;
  setOrderType("BUY");
  updateOrderTotal();
  document.getElementById("order-modal").classList.add("open");
}

function openOrderModalFromTicker(ticker) {
  const q = appState.quotes.find(item => item.ticker === ticker);
  if (q) openOrderModal(q);
}

function closeOrderModal() {
  document.getElementById("order-modal").classList.remove("open");
}

function setOrderType(type) {
  appState.currentOrderType = type;
  document.getElementById("btn-buy").classList.toggle("active", type === "BUY");
  document.getElementById("btn-sell").classList.toggle("active", type === "SELL");
  document.getElementById("btn-submit-order").innerText = type === "BUY" ? "Confirmer l'Achat" : "Confirmer la Vente";
  updateOrderTotal();
}

function changeQty(delta) {
  const input = document.getElementById("order-quantity");
  let val = parseInt(input.value) || 1;
  val = Math.max(1, val + delta);
  input.value = val;
  updateOrderTotal();
}

function updateOrderTotal() {
  if (!appState.selectedQuote) return;
  const qty = parseInt(document.getElementById("order-quantity").value) || 1;
  const total = appState.selectedQuote.price_xof * qty;
  document.getElementById("order-total-cost").innerText = `${total.toLocaleString("fr-FR")} XOF`;
}

function submitOrder() {
  if (!appState.selectedQuote) return;
  const qty = parseInt(document.getElementById("order-quantity").value) || 1;
  const q = appState.selectedQuote;
  const cost = q.price_xof * qty;
  const raw = getStoragePortfolio();

  if (appState.currentOrderType === "BUY") {
    if (raw.cash_xof < cost) {
      alert(`Solde insuffisant. Vous avez ${raw.cash_xof.toLocaleString("fr-FR")} XOF, requis : ${cost.toLocaleString("fr-FR")} XOF`);
      return;
    }
    raw.cash_xof -= cost;
    if (raw.positions[q.ticker]) {
      const cur = raw.positions[q.ticker];
      const newQty = cur.quantity + qty;
      cur.avg_price = ((cur.quantity * cur.avg_price) + cost) / newQty;
      cur.quantity = newQty;
    } else {
      raw.positions[q.ticker] = {
        quantity: qty,
        avg_price: q.price_xof,
        asset_class: q.class
      };
    }
    raw.history.unshift({
      id: Date.now(),
      type: "BUY",
      label: `Achat ${qty}x ${q.name} (${q.ticker})`,
      amount_xof: -cost,
      date: new Date().toLocaleDateString("fr-FR")
    });
  } else {
    const cur = raw.positions[q.ticker];
    if (!cur || cur.quantity < qty) {
      alert("Quantité détenue insuffisante pour vendre.");
      return;
    }
    raw.cash_xof += cost;
    cur.quantity -= qty;
    if (cur.quantity === 0) {
      delete raw.positions[q.ticker];
    }
    raw.history.unshift({
      id: Date.now(),
      type: "SELL",
      label: `Vente ${qty}x ${q.name} (${q.ticker})`,
      amount_xof: +cost,
      date: new Date().toLocaleDateString("fr-FR")
    });
  }

  saveStoragePortfolio(raw);
  playSuccessChime();
  closeOrderModal();
  loadPortfolioData();
  alert("Ordre exécuté avec succès sur la BRVM !");
}

function openDepositModal() {
  document.getElementById("deposit-modal").classList.add("open");
}
function closeDepositModal() {
  document.getElementById("deposit-modal").classList.remove("open");
}

document.querySelectorAll(".provider-radio").forEach(radio => {
  radio.addEventListener("click", () => {
    document.querySelectorAll(".provider-radio").forEach(r => r.classList.remove("active"));
    radio.classList.add("active");
  });
});

function submitDeposit() {
  const amount = parseFloat(document.getElementById("deposit-amount").value);
  const provider = document.querySelector('input[name="provider"]:checked').value;

  if (!amount || amount < 1000) {
    alert("Veuillez saisir un montant d'au moins 1 000 XOF");
    return;
  }

  const raw = getStoragePortfolio();
  raw.cash_xof += amount;
  raw.history.unshift({
    id: Date.now(),
    type: "DEPOSIT",
    label: `Dépôt Mobile Money (${provider})`,
    amount_xof: amount,
    date: new Date().toLocaleDateString("fr-FR")
  });

  saveStoragePortfolio(raw);
  playSuccessChime();
  closeDepositModal();
  loadPortfolioData();
  alert(`Dépôt de ${amount.toLocaleString("fr-FR")} XOF validé via ${provider} !`);
}

window.addEventListener("DOMContentLoaded", () => {
  renderMarket();
  loadPortfolioData();
});
