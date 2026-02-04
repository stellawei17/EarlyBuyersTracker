export const runtime = "nodejs";

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function safeNum(x){ const n = Number(x); return Number.isFinite(n) ? n : null; }
function isValidBase58(s){ return typeof s === "string" && s.length >= 32 && s.length <= 60; }

async function rpc(apiKey, method, params){
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const r = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ jsonrpc:"2.0", id:1, method, params })
  });
  if (!r.ok){
    const t = await r.text();
    throw new Error(`RPC error: ${r.status} ${t}`);
  }
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j.result;
}

async function fetchEnhancedMintTransfers({ mint, apiKey, want }){
  const baseUrl = `https://api-mainnet.helius-rpc.com/v0/addresses/${mint}/transactions?api-key=${apiKey}`;
  let before = null;
  let pages = 0;
  const events = [];

  // NOTE: this part finds earliest unique receiver wallets
  while (pages < 15 && events.length < want * 8){
    const url = new URL(baseUrl);
    url.searchParams.set("limit","100");
    if (before) url.searchParams.set("before", before);

    const r = await fetch(url.toString());
    if (!r.ok){
      const txt = await r.text();
      throw new Error(`Helius Enhanced error: ${r.status} ${txt}`);
    }
    const txs = await r.json();
    if (!Array.isArray(txs) || txs.length === 0) break;

    for (const tx of txs){
      const signature = tx?.signature || "";
      const blockTime = safeNum(tx?.timestamp || tx?.blockTime);
      const transfers = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];

      for (const t of transfers){
        if (t?.mint !== mint) continue;

        const toUser = t?.toUserAccount || null;
        const fromUser = t?.fromUserAccount || null;
        if (!toUser || toUser === fromUser) continue;

        const amt = t?.tokenAmount?.uiAmountString ?? t?.tokenAmount?.uiAmount ?? t?.tokenAmount ?? t?.amount ?? null;
        const tokenBought = amt == null ? null : Number(amt);

        events.push({ wallet: toUser, signature, blockTime, tokenBought });
      }
    }

    before = txs[txs.length-1]?.signature || null;
    pages += 1;
  }

  events.sort((a,b)=> (a.blockTime||0) - (b.blockTime||0));

  const byWallet = new Map();
  for (const ev of events){
    if (!byWallet.has(ev.wallet)) byWallet.set(ev.wallet, ev);
    if (byWallet.size >= want) break;
  }

  return Array.from(byWallet.values()).slice(0, want);
}

async function getTokenSupplyUi(apiKey, mint){
  const res = await rpc(apiKey, "getTokenSupply", [mint]);
  const uiAmount = res?.value?.uiAmount;
  if (uiAmount != null) return Number(uiAmount);

  const uiStr = res?.value?.uiAmountString;
  if (uiStr != null) return Number(uiStr);

  const amount = Number(res?.value?.amount || 0);
  const decimals = Number(res?.value?.decimals || 0);
  return decimals ? amount / Math.pow(10, decimals) : amount;
}

async function getSolBalance(apiKey, pubkey){
  const r = await rpc(apiKey, "getBalance", [pubkey, { commitment:"confirmed" }]);
  return Number(r?.value || 0) / 1e9;
}

async function getTokenBalanceForOwner(apiKey, owner, mint){
  const r = await rpc(apiKey, "getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding:"jsonParsed", commitment:"confirmed" }
  ]);

  let sum = 0;
  const arr = Array.isArray(r?.value) ? r.value : [];
  for (const it of arr){
    const info = it?.account?.data?.parsed?.info;
    const amount = info?.tokenAmount?.uiAmount;
    if (amount != null) sum += Number(amount);
  }
  return sum;
}

async function mapLimit(items, limit, fn){
  const out = new Array(items.length);
  let idx = 0;

  async function worker(){
    while (idx < items.length){
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }

  const ws = [];
  for (let i=0;i<limit;i++) ws.push(worker());
  await Promise.all(ws);
  return out;
}

export async function POST(req){
  try{
    const { mint, limit } = await req.json();
    const apiKey = process.env.HELIUS_API_KEY;

    if (!apiKey) return Response.json({ error:"Missing HELIUS_API_KEY env var." }, { status:500 });
    if (!isValidBase58(mint)) return Response.json({ error:"Invalid mint address." }, { status:400 });

    const want = clamp(Number(limit || 50), 1, 100);
    const totalSupply = await getTokenSupplyUi(apiKey, mint);
    const earliest = await fetchEnhancedMintTransfers({ mint, apiKey, want });

    // Concurrency 5 is okay, but now lighter because we removed txCount calls
    const rows = await mapLimit(earliest, 5, async (ev) => {
      const wallet = ev.wallet;
      const tokenBought = Number(ev.tokenBought || 0);

      const [solBal, remaining] = await Promise.all([
        getSolBalance(apiKey, wallet).catch(()=>null),
        getTokenBalanceForOwner(apiKey, wallet, mint).catch(()=>null),
      ]);

      const pctBought = totalSupply ? (tokenBought / totalSupply) : null;
      const pctRemaining = (totalSupply && remaining != null) ? (remaining / totalSupply) : null;

      // Status logic
      let status = "HOLDING";
      if (remaining == null) status = "NO ACTIVITY";
      else if (remaining <= 0) status = "SOLD ALL";
      else {
        const ratio = tokenBought > 0 ? (remaining / tokenBought) : 1;
        status = ratio >= 0.98 ? "HOLDING" : "SOLD PART";
      }

      return {
        wallet,
        signature: ev.signature,
        sol_balance: solBal,
        status,
        token_bought: tokenBought,
        pct_supply_bought: pctBought,
        remaining_tokens: remaining,
        pct_supply_remaining: pctRemaining
      };
    });

    const earlyBoughtSum = rows.reduce((a,r)=> a + (Number(r.token_bought)||0), 0);
    const earlyRemainingSum = rows.reduce((a,r)=> a + (Number(r.remaining_tokens)||0), 0);

    return Response.json({
      mint,
      stats: {
        total_supply: totalSupply,
        early_bought_sum: earlyBoughtSum,
        early_remaining_sum: earlyRemainingSum
      },
      rows
    });
  } catch(e){
    return Response.json({ error: e?.message || String(e) }, { status:500 });
  }
}
