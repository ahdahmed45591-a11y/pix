import http.server
import json
import os
import socketserver
import urllib.parse
from datetime import datetime

PORT = 5050
DATA_FILE = os.path.join(os.path.dirname(__file__), "portfolio_data.json")

INITIAL_DATA = {
    "cash_xof": 250000.0,
    "kyc_status": "VERIFIED",
    "positions": {
        "SNTS": {"quantity": 8, "avg_price": 22000.0, "asset_class": "Stocks"},
        "SGBC": {"quantity": 5, "avg_price": 18500.0, "asset_class": "Stocks"},
        "TPCI_590": {"quantity": 10, "avg_price": 10000.0, "asset_class": "Bonds"}
    },
    "history": [
        {"id": 1, "type": "DEPOSIT", "label": "Dépôt Mobile Money (Wave)", "amount_xof": 500000.0, "date": "14/10/2026"},
        {"id": 2, "type": "BUY", "label": "Achat 8x Sonatel (SNTS)", "amount_xof": -176000.0, "date": "14/10/2026"},
        {"id": 3, "type": "BUY", "label": "Achat 10x TPCI 5.90% 2024-2031", "amount_xof": -100000.0, "date": "15/10/2026"}
    ]
}

MARKET_QUOTES = [
    {
        "ticker": "SNTS",
        "name": "Sonatel Sénégal",
        "class": "Stocks",
        "category": "Télécoms",
        "price_xof": 22600.0,
        "change_pct": 1.45,
        "pe_ratio": 10.4,
        "dividend_yield": 7.4,
        "sparkline": [21900, 22100, 22050, 22400, 22350, 22600]
    },
    {
        "ticker": "ECOC",
        "name": "Ecobank Côte d'Ivoire",
        "class": "Stocks",
        "category": "Banque",
        "price_xof": 8150.0,
        "change_pct": -0.61,
        "pe_ratio": 6.8,
        "dividend_yield": 8.3,
        "sparkline": [8300, 8250, 8200, 8150, 8100, 8150]
    },
    {
        "ticker": "SGBC",
        "name": "Société Générale CI",
        "class": "Stocks",
        "category": "Banque",
        "price_xof": 19100.0,
        "change_pct": 0.52,
        "pe_ratio": 8.1,
        "dividend_yield": 6.5,
        "sparkline": [18800, 18900, 18950, 19000, 19050, 19100]
    },
    {
        "ticker": "ORAC",
        "name": "Orange Côte d'Ivoire",
        "class": "Stocks",
        "category": "Télécoms",
        "price_xof": 14700.0,
        "change_pct": 2.10,
        "pe_ratio": 9.2,
        "dividend_yield": 7.1,
        "sparkline": [14200, 14350, 14400, 14500, 14650, 14700]
    },
    {
        "ticker": "TPCI_590",
        "name": "TPCI 5.90% 2024-2031",
        "class": "Bonds",
        "category": "Obligation d'État",
        "price_xof": 10000.0,
        "change_pct": 0.00,
        "pe_ratio": None,
        "dividend_yield": 5.9,
        "sparkline": [10000, 10000, 10000, 10000, 10000, 10000]
    },
    {
        "ticker": "FCP_EXP",
        "name": "FCP Daba Expansion",
        "class": "Mutual Funds",
        "category": "OPCVM Diversifié",
        "price_xof": 50000.0,
        "change_pct": 0.85,
        "pe_ratio": None,
        "dividend_yield": 6.8,
        "sparkline": [49200, 49400, 49500, 49700, 49850, 50000]
    },
    {
        "ticker": "AFRI_TECH",
        "name": "Fintech West Africa Seed",
        "class": "Venture",
        "category": "Capital-Risque",
        "price_xof": 100000.0,
        "change_pct": 0.00,
        "pe_ratio": None,
        "dividend_yield": 0.0,
        "sparkline": [100000, 100000, 100000, 100000, 100000, 100000]
    }
]

def load_data():
    if not os.path.exists(DATA_FILE):
        save_data(INITIAL_DATA)
        return INITIAL_DATA
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return INITIAL_DATA

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class PixApiHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/quotes":
            self.send_json(200, {"quotes": MARKET_QUOTES})
        elif parsed.path == "/api/portfolio":
            self.handle_get_portfolio()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {}

        if parsed.path == "/api/order":
            self.handle_order(payload)
        elif parsed.path == "/api/deposit":
            self.handle_deposit(payload)
        elif parsed.path == "/api/kyc":
            self.handle_kyc(payload)
        else:
            self.send_json(404, {"error": "Endpoint non trouvé"})

    def handle_get_portfolio(self):
        data = load_data()
        quotes_map = {q["ticker"]: q for q in MARKET_QUOTES}
        
        invested_by_class = {"Stocks": 0.0, "Bonds": 0.0, "Mutual Funds": 0.0, "Venture": 0.0}
        total_invested = 0.0
        positions_detail = []

        for ticker, pos in data.get("positions", {}).items():
            quote = quotes_map.get(ticker)
            price = quote["price_xof"] if quote else pos["avg_price"]
            market_val = price * pos["quantity"]
            cost_val = pos["avg_price"] * pos["quantity"]
            gain_val = market_val - cost_val
            gain_pct = (gain_val / cost_val * 100) if cost_val > 0 else 0.0
            
            aclass = pos.get("asset_class", "Stocks")
            invested_by_class[aclass] = invested_by_class.get(aclass, 0.0) + market_val
            total_invested += market_val

            positions_detail.append({
                "ticker": ticker,
                "name": quote["name"] if quote else ticker,
                "quantity": pos["quantity"],
                "avg_price": pos["avg_price"],
                "current_price": price,
                "market_value": market_val,
                "gain_xof": gain_val,
                "gain_pct": round(gain_pct, 2),
                "asset_class": aclass
            })

        total_portfolio = total_invested + data.get("cash_xof", 0.0)
        allocation_pct = {}
        for ac, val in invested_by_class.items():
            allocation_pct[ac] = round((val / total_portfolio * 100), 1) if total_portfolio > 0 else 0.0
        allocation_pct["Cash"] = round((data.get("cash_xof", 0.0) / total_portfolio * 100), 1) if total_portfolio > 0 else 0.0

        resp = {
            "total_portfolio_xof": round(total_portfolio, 0),
            "cash_xof": round(data.get("cash_xof", 0.0), 0),
            "total_invested_xof": round(total_invested, 0),
            "allocation_pct": allocation_pct,
            "positions": positions_detail,
            "history": data.get("history", []),
            "kyc_status": data.get("kyc_status", "PENDING")
        }
        self.send_json(200, resp)

    def handle_order(self, payload):
        data = load_data()
        ticker = payload.get("ticker")
        order_type = payload.get("type", "BUY")
        quantity = int(payload.get("quantity", 0))

        if quantity <= 0:
            return self.send_json(400, {"error": "Quantité invalide"})

        quote = next((q for q in MARKET_QUOTES if q["ticker"] == ticker), None)
        if not quote:
            return self.send_json(404, {"error": f"Titre {ticker} inconnu"})

        cost = quote["price_xof"] * quantity

        if order_type == "BUY":
            if data["cash_xof"] < cost:
                return self.send_json(400, {"error": "Solde de liquidités insuffisant"})
            data["cash_xof"] -= cost
            if ticker in data["positions"]:
                cur = data["positions"][ticker]
                new_q = cur["quantity"] + quantity
                new_avg = ((cur["quantity"] * cur["avg_price"]) + cost) / new_q
                cur["quantity"] = new_q
                cur["avg_price"] = new_avg
            else:
                data["positions"][ticker] = {
                    "quantity": quantity,
                    "avg_price": quote["price_xof"],
                    "asset_class": quote["class"]
                }
            label = f"Achat {quantity}x {quote['name']} ({ticker})"
            amt = -cost
        elif order_type == "SELL":
            pos = data["positions"].get(ticker)
            if not pos or pos["quantity"] < quantity:
                return self.send_json(400, {"error": "Quantité détenue insuffisante"})
            data["cash_xof"] += cost
            pos["quantity"] -= quantity
            if pos["quantity"] == 0:
                del data["positions"][ticker]
            label = f"Vente {quantity}x {quote['name']} ({ticker})"
            amt = +cost
        else:
            return self.send_json(400, {"error": "Type d'ordre invalide"})

        record = {
            "id": len(data.get("history", [])) + 1,
            "type": order_type,
            "label": label,
            "amount_xof": amt,
            "date": datetime.now().strftime("%d/%m/%Y %H:%M")
        }
        data.setdefault("history", []).insert(0, record)
        save_data(data)
        self.send_json(200, {"success": True, "order": record})

    def handle_deposit(self, payload):
        data = load_data()
        amount = float(payload.get("amount_xof", 0))
        provider = payload.get("provider", "Wave")
        phone = payload.get("phone", "")

        if amount < 1000:
            return self.send_json(400, {"error": "Montant minimum : 1 000 XOF"})

        data["cash_xof"] += amount
        record = {
            "id": len(data.get("history", [])) + 1,
            "type": "DEPOSIT",
            "label": f"Dépôt Mobile Money ({provider})",
            "amount_xof": amount,
            "date": datetime.now().strftime("%d/%m/%Y %H:%M")
        }
        data.setdefault("history", []).insert(0, record)
        save_data(data)
        self.send_json(200, {"success": True, "deposit": record, "new_cash": data["cash_xof"]})

    def handle_kyc(self, payload):
        data = load_data()
        data["kyc_status"] = "VERIFIED"
        save_data(data)
        self.send_json(200, {"success": True, "status": "VERIFIED"})

    def send_json(self, status, payload):
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    os.chdir(os.path.dirname(__file__))
    load_data()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), PixApiHandler) as httpd:
        print(f"PIX Mobile App Server démarré sur http://localhost:{PORT}")
        httpd.serve_forever()
