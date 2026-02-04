"use client";
import { useMemo, useState } from "react";

const C = {
  bg1: "#0b0a14",
  bg2: "#130b22",
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  text: "#EDE9FE",
  sub: "rgba(237,233,254,0.70)",
  accent1: "#14F195",
  accent2: "#9945FF",
  danger: "#FF4D6D",
  warn: "#FBBF24",
  mutedBtnBg: "rgba(0,0,0,0.25)",
  hoverBtnBg: "rgba(255,255,255,0.08)",
  hoverBorder: "rgba(255,255,255,0.22)"
};

function fmt(n, dp = 4) {
  if (n == null || Number.isNaN(n)) return "-";
  const num = Number(n);
  if (!Number.isFinite(num)) return "-";
  if (Math.abs(num) >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toFixed(dp);
}
function pct(n, dp = 6) {
  if (n == null || Number.isNaN(n)) return "-";
  const num = Number(n);
  if (!Number.isFinite(num)) return "-";
  return (num * 100).toFixed(dp) + "%";
}
function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-6) : "";
}

/** Normalize status coming from API (SOLD ALL / SOLD PART / NO ACTIVITY / HOLDING, etc) */
function normalizeStatusKey(s) {
  if (!s) return "NO_ACTIVITY";
  const t = String(s).trim().toUpperCase();
  if (t === "SOLD ALL") return "SOLD_ALL";
  if (t === "SOLD PART") return "SOLD_PART";
  if (t === "NO ACTIVITY") return "NO_ACTIVITY";
  return t;
}
function statusDisplay(s) {
  const key = normalizeStatusKey(s);
  return key.replaceAll("_", " ");
}
function statusStyle(s) {
  const key = normalizeStatusKey(s);
  const base = { fontWeight: 900 };
  if (key === "SOLD_ALL") return { ...base, color: C.danger };
  if (key === "SOLD_PART") return { ...base, color: C.warn };
  if (key === "HOLDING") return { ...base, color: C.accent1 };
  if (key === "NO_ACTIVITY") return { ...base, color: C.sub };
  return base;
}

function btnStyle({ variant = "ghost", small = false } = {}) {
  const base = {
    padding: small ? "6px 10px" : "9px 12px",
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: C.mutedBtnBg,
    color: C.text,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
    transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
    userSelect: "none",
    outline: "none",
    textDecoration: "none"
  };

  if (variant === "pill") {
    return {
      ...base,
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.15)"
    };
  }

  if (variant === "primary") {
    return {
      ...base,
      padding: small ? "8px 12px" : "16px 28px",
      border: "none",
      background: `linear-gradient(90deg, ${C.accent2}, ${C.accent1})`,
      color: "#07060E",
      fontWeight: 900,
      boxShadow: "0 12px 30px rgba(153,69,255,0.20)"
    };
  }

  return base;
}

function hoverHandlers(normalBg = C.mutedBtnBg) {
  return {
    onMouseEnter: (e) => {
      const el = e.currentTarget;
      el.style.transform = "translateY(-1px)";
      el.style.background = C.hoverBtnBg;
      el.style.borderColor = C.hoverBorder;
      el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.35)";
      el.style.textDecoration = "none";
    },
    onMouseLeave: (e) => {
      const el = e.currentTarget;
      el.style.transform = "translateY(0px)";
      el.style.background = normalBg;
      el.style.borderColor = C.border;
      el.style.boxShadow = "none";
      el.style.textDecoration = "none";
    }
  };
}

function solscanTxUrl(signature) {
  return `https://solscan.io/tx/${signature}`;
}

export default function Page() {
  const [mint, setMint] = useState("");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const canRun = useMemo(
    () => mint.trim().length > 20 && Number(limit) >= 1 && Number(limit) <= 100,
    [mint, limit]
  );
  const rows = data?.rows || [];

  async function run() {
    setErr("");
    setData(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: mint.trim(), limit: Number(limit) })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      setData(json);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  const disabledPrimary = !canRun || loading;

  return (
    <div
      style={{
        minHeight: "100vh",
        color: C.text,
        background: `radial-gradient(1200px 600px at 20% 10%, rgba(153,69,255,0.35), transparent 55%),
                 radial-gradient(900px 500px at 85% 15%, rgba(20,241,149,0.22), transparent 55%),
                 radial-gradient(1000px 600px at 55% 90%, rgba(153,69,255,0.22), transparent 60%),
                 linear-gradient(180deg, ${C.bg1}, ${C.bg2})`
      }}
    >
      {/* ✅ Responsive CSS */}
      <style>{`
        @media (max-width: 640px) {
          .wrap { padding: 12px !important; }
          .headerInner { padding: 12px 12px !important; }
          .brandTitle { font-size: 14px !important; }
          .brandSub { font-size: 11px !important; }
          .searchGrid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .mintCol, .howManyCol, .btnCol { grid-column: auto !important; }
          .btnPrimary { max-width: none !important; padding: 12px 14px !important; font-size: 12px !important; }
          .btnSmall { padding: 5px 8px !important; font-size: 11px !important; }
          table { font-size: 11px !important; }
          th { font-size: 11px !important; padding: 8px 10px !important; }
          td { padding: 8px 10px !important; }
          code { font-size: 11px !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(14px)",
          background: "rgba(7,6,14,0.55)",
          borderBottom: `1px solid ${C.border}`
        }}
      >
        <div
          className="headerInner"
          style={{
            maxWidth: 1220,
            margin: "0 auto",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo.png"
              alt="logo"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                padding: 6,
                border: `1px solid ${C.border}`
              }}
            />
            <div>
              <div className="brandTitle" style={{ fontWeight: 900, letterSpacing: 0.3 }}>
                Token Radar
              </div>
              <div className="brandSub" style={{ fontSize: 12, color: C.sub }}>
                Track the First Buyer Wallet Activity
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: C.sub }}>
            <a
              href="https://t.me/izoushii"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...btnStyle({ variant: "pill" }),
                textDecoration: "none"
              }}
              {...hoverHandlers("rgba(255,255,255,0.06)")}
            >
              Feedback ↗
            </a>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ maxWidth: 1220, margin: "0 auto", padding: 18 }}>
        {/* Search Card */}
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: 14,
            background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)"
          }}
        >
          <div
            className="searchGrid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: 50,
              alignItems: "end"
            }}
          >
            <div className="mintCol" style={{ gridColumn: "span 7" }}>
              <label style={{ display: "block", fontSize: 12, color: C.sub, marginBottom: 6 }}>
                Mint address
              </label>
              <input
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Paste mint address…"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: "rgba(0,0,0,0.25)",
                  color: C.text,
                  outline: "none"
                }}
              />
            </div>

            <div className="howManyCol" style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: 12, color: C.sub, marginBottom: 6 }}>
                How many
              </label>
              <input
                type="number"
                value={limit}
                min={1}
                max={100}
                onChange={(e) => setLimit(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: "rgba(0,0,0,0.25)",
                  color: C.text,
                  outline: "none"
                }}
              />
            </div>

            <div className="btnCol" style={{ gridColumn: "span 3", display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btnPrimary"
                onClick={run}
                disabled={disabledPrimary}
                style={{
                  ...btnStyle({ variant: "primary" }),
                  width: "100%",
                  maxWidth: 260,
                  background: disabledPrimary
                    ? "rgba(255,255,255,0.10)"
                    : `linear-gradient(90deg, ${C.accent2}, ${C.accent1})`,
                  color: disabledPrimary ? C.sub : "#07060E",
                  cursor: disabledPrimary ? "not-allowed" : "pointer",
                  boxShadow: disabledPrimary ? "none" : "0 12px 30px rgba(153,69,255,0.20)"
                }}
              >
                {loading ? "Scanning…" : "Analyze First Wallets"}
              </button>
            </div>
          </div>

          {err && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,77,109,0.40)",
                background: "rgba(255,77,109,0.10)",
                color: "#ffd1dc"
              }}
            >
              <b>Error:</b> {err}
            </div>
          )}
        </div>

        {/* Table */}
        {rows.length > 0 && (
          <div
            style={{
              marginTop: 14,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              overflow: "hidden",
              background: C.card
            }}
          >
            <div
              style={{
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: `1px solid ${C.border}`,
                gap: 10,
                flexWrap: "wrap"
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>First {rows.length} Wallets</div>
                <div style={{ fontSize: 12, color: C.sub }}>The Early Buyers and Their Activity</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => copy(rows.map((r) => r.wallet).join("\n"))} style={btnStyle()} {...hoverHandlers()}>
                  Copy wallets
                </button>
                <button onClick={() => copy(JSON.stringify(data, null, 2))} style={btnStyle()} {...hoverHandlers()}>
                  Copy JSON
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.30)" }}>
                    {[
                      "#",
                      "Address",
                      "SOL",
                      "Status",
                      "Token Bought",
                      "% Supply Bought",
                      "Remaining",
                      "% Supply Remaining",
                      "Signature"
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          fontSize: 12,
                          color: C.sub,
                          borderBottom: `1px solid ${C.border}`,
                          position: "sticky",
                          top: 0
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, idx) => {
                    const statusText = statusDisplay(r.status);

                    return (
                      <tr key={r.wallet + (r.signature || "")} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: C.sub }}>{idx + 1}</td>

                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <code style={{ fontSize: 12 }}>{shortAddr(r.wallet)}</code>
                            <button
                              className="btnSmall"
                              onClick={() => copy(r.wallet)}
                              style={btnStyle({ small: true })}
                              {...hoverHandlers()}
                            >
                              Copy
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{fmt(r.sol_balance, 4)}</td>

                        <td style={{ padding: "10px 12px", fontSize: 12 }}>
                          <span style={statusStyle(r.status)}>{statusText}</span>
                        </td>

                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{fmt(r.token_bought, 6)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{pct(r.pct_supply_bought, 6)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{fmt(r.remaining_tokens, 6)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{pct(r.pct_supply_remaining, 6)}</td>

                        <td style={{ padding: "10px 12px", fontSize: 12 }}>
                          <code>{(r.signature || "").slice(0, 10)}…</code>

                          <a
                            className="btnSmall"
                            href={solscanTxUrl(r.signature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              ...btnStyle({ small: true }),
                              marginLeft: 8,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              textDecoration: "none"
                            }}
                            {...hoverHandlers()}
                            onClick={(e) => {
                              if (!r.signature) e.preventDefault();
                            }}
                            title={r.signature ? "Open on Solscan" : "No signature"}
                          >
                            TXN ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Removed Tag rules footer since tx_count/tag are removed */}
          </div>
        )}
      </div>
    </div>
  );
}
