# Pump.fun Early Buyers Dashboard (Final)

Trader-friendly columns:
- Address
- Tx count (approx, capped) + tag (BOT / FRESH / TRADER)
- SOL balance
- Holding status (HOLDING / SOLD_ALL / SOLD_PART)
- Token bought (first receive)
- % of total supply bought
- Remaining tokens + remaining %

## Local
1) npm install
2) Create .env.local:
HELIUS_API_KEY=YOUR_KEY
3) npm run dev → http://localhost:3000

## Vercel
Add env var HELIUS_API_KEY in Vercel.
