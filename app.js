const API_BASE = "http://localhost:5050/api";

let appState = {
  portfolio: null,
  quotes: [],
  selectedQuote: null,
  currentOrderType: "BUY",
  currentFilter: "ALL"
};

// Web Audio API Synthesizer for success chime (Daba-style ding/cash sound, zero assets needed)
function playSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log("Audio not supported");
  }
}

// Fetch Portfolio State
async function fetchPortfolio() {
  try {
    const res = await fetch(`${API_BASE}/portfolio`);
    appState.portfolio = await res.json();
    renderPortfolio();
  } catch (e) {
    console.error("API error, fallback to offline demo:", e);
  }
}

// Fetch Market Quotes
async function fetchQuotes() {
  try {
    const res = await fetch(`${API_BASE}/quotes`);
    const data = await res.json();
    appState.quotes = data.quotes;
    renderMarket();
  } catch (e) {
    console.error("API error, fallback to offline demo:", e);
  }
}

// Render Portfolio & Allocation
function renderPortfolio() {
  const p = appState.portfolio;
  if (!p) return;

  document.getElementById("portfolio-total").innerText = `${p.total_portfolio_xof.toLocaleString("fr-FR")} XOF`;
  document.getElementById("portfolio-cash").innerText = `Liquidités : ${p.cash_xof.toLocaleString("fr-FR")} XOF`;
  document.getElementById("positions-count").innerText = p.positions.length;

  // Render Allocation Bar
  const bar = document.getElementById("allocation-bar");
  const alloc = p.allocation_pct;
  bar.innerHTML = `
    <div class="bar-segment stocks" style="width: ${alloc.Stocks || 0}%" title="Actions ${alloc.Stocks || 0}%"></div>
    <div class="bar-segment bonds" style="width: ${alloc.Bonds || 0}%" title="Obligations ${alloc.Bonds || 0}%"></div>
    <div class="bar-segment funds" style="width: ${alloc['Mutual Funds'] || 0}%" title="FCP ${alloc['Mutual Funds'] || 0}%"></div>
    <div class="bar-segment venture" style="width: ${alloc.Venture || 0}%" title="Venture ${alloc.Venture || 0}%"></div>
    <div class="bar-segment cash" style="width: ${alloc.Cash || 0}%" title="Cash ${alloc.Cash || 0}%"></div>
  `;

  // Render Positions
  const posContainer = document.getElementById("positions-container");
  if (!p.positions.length) {
    posContainer.innerHTML = `<div class="card-item" style="justify-content:center; color:#9ca3af;">Aucun titre en portefeuille. Découvrez le marché BRVM !</div>`;
    return;
  }

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

  // Render History
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

// Render Market Quotes
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

// Navigation Tabs
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

// Market Filtering
function filterMarket(category, el) {
  appState.currentFilter = category;
  document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  renderMarket();
}

// Modal Orders
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

async function submitOrder() {
  if (!appState.selectedQuote) return;
  const qty = parseInt(document.getElementById("order-quantity").value) || 1;

  try {
    const res = await fetch(`${API_BASE}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: appState.selectedQuote.ticker,
        type: appState.currentOrderType,
        quantity: qty
      })
    });
    const result = await res.json();
    if (result.success) {
      playSuccessChime();
      closeOrderModal();
      await fetchPortfolio();
      alert(`Ordre exécuté avec succès : ${result.order.label}`);
    } else {
      alert(`Erreur : ${result.error}`);
    }
  } catch (e) {
    alert("Erreur de connexion au serveur PIX");
  }
}

// Deposit Modal (Mobile Money)
function openDepositModal() {
  document.getElementById("deposit-modal").classList.add("open");
}
function closeDepositModal() {
  document.getElementById("deposit-modal").classList.remove("open");
}

// Radio Provider Selection
document.querySelectorAll(".provider-radio").forEach(radio => {
  radio.addEventListener("click", () => {
    document.querySelectorAll(".provider-radio").forEach(r => r.classList.remove("active"));
    radio.classList.add("active");
  });
});

async function submitDeposit() {
  const amount = parseFloat(document.getElementById("deposit-amount").value);
  const phone = document.getElementById("deposit-phone").value;
  const provider = document.querySelector('input[name="provider"]:checked').value;

  if (!amount || amount < 1000) {
    alert("Veuillez saisir un montant d'au moins 1 000 XOF");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_xof: amount, provider, phone })
    });
    const result = await res.json();
    if (result.success) {
      playSuccessChime();
      closeDepositModal();
      await fetchPortfolio();
      alert(`Dépôt de ${amount.toLocaleString("fr-FR")} XOF réussi via ${provider} !`);
    } else {
      alert(`Erreur : ${result.error}`);
    }
  } catch (e) {
    alert("Erreur de connexion au serveur PIX");
  }
}

// Initialize on Load
window.addEventListener("DOMContentLoaded", () => {
  fetchQuotes();
  fetchPortfolio();
});
