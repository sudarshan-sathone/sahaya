import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";

function truncate(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTs(ts) {
  const n = Number(ts);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString();
}

function actionBadge(action) {
  const a = action || "unknown";
  if (a === "donation") return { label: "Donation", cls: "badge badge-blue" };
  if (a === "otp_redeemed")
    return { label: "OTP Redeemed", cls: "badge badge-green" };
  if (a === "campaign_created")
    return { label: "Campaign Created", cls: "badge badge-amber" };
  if (a === "beneficiary_registered")
    return { label: "Beneficiary Registered", cls: "badge badge-gray" };
  if (a === "otp_issued") return { label: "OTP Issued", cls: "badge badge-gray" };
  return { label: a, cls: "badge badge-gray" };
}

export default function TransactionMonitor({ contract }) {
  const [transactions, setTransactions] = useState([]);
  const [filterCampaignId, setFilterCampaignId] = useState("");
  const [filterActionType, setFilterActionType] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchTx = async () => {
    if (!contract) return;
    try {
      const txs = filterCampaignId
        ? await contract.getCampaignTransactions(Number(filterCampaignId))
        : await contract.getAllTransactions();
      setTransactions(txs);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error(e);
      toast.error("Failed to load data. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, filterCampaignId]);

  useEffect(() => {
    if (!autoRefresh || !contract) return;
    const id = setInterval(fetchTx, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, contract, filterCampaignId]);

  const filtered = useMemo(() => {
    const a = filterActionType.trim();
    if (!a) return transactions;
    return transactions.filter((t) => t.actionType === a);
  }, [transactions, filterActionType]);

  const suspicious = useMemo(() => {
    const res = [];
    const byActor = new Map();
    const byCampaign = new Map();

    for (const t of transactions) {
      const actor = (t.actor || "").toLowerCase();
      if (!byActor.has(actor)) byActor.set(actor, []);
      byActor.get(actor).push(t);

      const cid = Number(t.campaignId);
      if (!byCampaign.has(cid)) byCampaign.set(cid, []);
      byCampaign.get(cid).push(t);
    }

    // Check 1: wallet appears as both donor (donation) and vendor (otp_redeemed)
    for (const [actor, txs] of byActor.entries()) {
      const hasDonate = txs.some((t) => t.actionType === "donation");
      const hasRedeem = txs.some((t) => t.actionType === "otp_redeemed");
      if (actor && hasDonate && hasRedeem) {
        res.push({
          type: "Wallet overlap",
          message: `Wallet ${truncate(actor)} appears as both donor and vendor — possible self-dealing.`
        });
      }
    }

    // Check 2: OTP redeemed < 60 seconds after issue (best-effort: within same campaign)
    for (const [cid, txs] of byCampaign.entries()) {
      const issued = txs.filter((t) => t.actionType === "otp_issued");
      const redeemed = txs.filter((t) => t.actionType === "otp_redeemed");
      for (const i of issued) {
        for (const r of redeemed) {
          const dt = Number(r.timestamp) - Number(i.timestamp);
          if (dt >= 0 && dt < 60) {
            res.push({
              type: "Fast OTP redemption",
              message: `Campaign ${cid}: OTP redeemed within ${dt}s of issue — possible pre-arranged redemption.`
            });
          }
        }
      }
    }

    // Check 3: repeated rapid donations (>3 in same campaign within 1 hour)
    for (const [cid, txs] of byCampaign.entries()) {
      const donations = txs
        .filter((t) => t.actionType === "donation")
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
      const byDonor = new Map();
      for (const d of donations) {
        const actor = (d.actor || "").toLowerCase();
        if (!byDonor.has(actor)) byDonor.set(actor, []);
        byDonor.get(actor).push(d);
      }
      for (const [actor, ds] of byDonor.entries()) {
        for (let i = 0; i < ds.length; i++) {
          let count = 1;
          for (let j = i + 1; j < ds.length; j++) {
            const dt = Number(ds[j].timestamp) - Number(ds[i].timestamp);
            if (dt <= 3600) count++;
          }
          if (count > 3) {
            res.push({
              type: "Rapid donations",
              message: `Campaign ${cid}: repeated rapid donations from ${truncate(actor)} — unusual pattern.`
            });
            break;
          }
        }
      }
    }

    return res;
  }, [transactions]);

  useEffect(() => {
    setFlags(suspicious);
  }, [suspicious]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        const eth = Number(ethers.formatEther(t.amount));
        if (t.actionType === "donation") acc.donated += eth;
        if (t.actionType === "otp_redeemed") acc.redeemed += eth;
        return acc;
      },
      { donated: 0, redeemed: 0 }
    );
  }, [filtered]);

  // pagination
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterCampaignId, filterActionType]);

  const suspiciousRowIds = useMemo(() => {
    // Best-effort: mark row suspicious if action+actor part of any global suspicious detection
    // (We keep it simple: mark all donations from overlap wallet as suspicious)
    const set = new Set();
    const overlapActors = new Set();
    for (const t of transactions) {
      // compute overlap quickly
      // (this is fine for demo volumes)
      const actor = (t.actor || "").toLowerCase();
      // just reuse checks by scanning lists
      const hasDonate = transactions.some(
        (x) => (x.actor || "").toLowerCase() === actor && x.actionType === "donation"
      );
      const hasRedeem = transactions.some(
        (x) => (x.actor || "").toLowerCase() === actor && x.actionType === "otp_redeemed"
      );
      if (actor && hasDonate && hasRedeem) overlapActors.add(actor);
    }
    transactions.forEach((t) => {
      if (overlapActors.has((t.actor || "").toLowerCase())) {
        set.add(Number(t.id));
      }
    });
    return set;
  }, [transactions]);

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">Transaction Monitor</div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div className="refresh-indicator">
            <span className={`refresh-dot ${autoRefresh ? "active" : ""}`} />
            Auto-refresh
          </div>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Campaign ID
            <input
              style={{ marginLeft: 8 }}
              value={filterCampaignId}
              onChange={(e) => setFilterCampaignId(e.target.value)}
              placeholder="All campaigns"
            />
          </label>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Action
            <select
              style={{ marginLeft: 8 }}
              value={filterActionType}
              onChange={(e) => setFilterActionType(e.target.value)}
            >
              <option value="">All</option>
              <option value="donation">Donation</option>
              <option value="otp_redeemed">OTP Redeemed</option>
              <option value="campaign_created">Campaign Created</option>
              <option value="beneficiary_registered">Beneficiary Registered</option>
              <option value="otp_issued">OTP Issued</option>
            </select>
          </label>
          <button className="btn-sm btn-primary" onClick={fetchTx}>
            Refresh
          </button>
          <button
            className="btn-sm btn-warning"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh ? "Pause" : "Auto"}
          </button>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {lastRefreshed ? `Last: ${lastRefreshed.toLocaleTimeString()}` : ""}
          </div>
        </div>
      </div>

      <div className="dash-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="dash-card-header" style={{ marginBottom: 12 }}>
          <div className="dash-card-title">Suspicious Activity</div>
        </div>
        {flags.length === 0 ? (
          <div className="alert-card alert-card-green" style={{ marginBottom: 0 }}>
            <div>
              <div className="alert-title">No suspicious activity detected</div>
              <div className="alert-desc">Monitoring is clear based on current rules.</div>
            </div>
          </div>
        ) : (
          flags.map((f, i) => (
            <div key={i} className="alert-card alert-card-red">
              <div>
                <div className="alert-title">{f.type}</div>
                <div className="alert-desc">{f.message}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="stat-card" style={{ padding: 14, minWidth: 180 }}>
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value">{filtered.length}</div>
        </div>
        <div className="stat-card" style={{ padding: 14, minWidth: 180 }}>
          <div className="stat-label">Total Donated ETH</div>
          <div className="stat-value">{totals.donated.toFixed(4)}</div>
        </div>
        <div className="stat-card" style={{ padding: 14, minWidth: 180 }}>
          <div className="stat-label">Total Redeemed ETH</div>
          <div className="stat-value">{totals.redeemed.toFixed(4)}</div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : (
        <>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Tx ID</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Campaign</th>
                  <th>Amount</th>
                  <th>Timestamp</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => {
                  const badge = actionBadge(t.actionType);
                  const isSus = suspiciousRowIds.has(Number(t.id));
                  return (
                    <tr
                      key={Number(t.id)}
                      className={isSus ? "tx-suspicious" : "tx-normal"}
                    >
                      <td className="td-primary">{Number(t.id)}</td>
                      <td>
                        <span className={badge.cls}>{badge.label}</span>
                      </td>
                      <td>{truncate(t.actor)}</td>
                      <td>#{Number(t.campaignId)}</td>
                      <td>
                        {Number(t.amount) === 0
                          ? "—"
                          : `${ethers.formatEther(t.amount)} ETH`}
                      </td>
                      <td>{formatTs(t.timestamp)}</td>
                      <td>{isSus ? <span className="badge badge-red">!</span> : "—"}</td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ color: "var(--text-muted)" }}>
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div>
              Page {currentPage} / {totalPages}
            </div>
            <div className="pagination-controls">
              <button
                className="btn-sm btn-warning"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="btn-sm btn-warning"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

