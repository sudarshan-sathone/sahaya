import { useEffect, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";

export default function TransactionMonitor({ contract }) {
  const [campaignId, setCampaignId] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadTransactions = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      let txs;
      if (campaignId) {
        txs = await contract.getCampaignTransactions(Number(campaignId));
      } else {
        txs = await contract.getAllTransactions();
      }
      setTransactions(txs);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load data. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [contract]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadTransactions, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, contract, campaignId]);

  const suspiciousFlags = [];

  // precompute helper maps
  const byActor = {};
  const now = Date.now();

  transactions.forEach((t) => {
    const actor = t.actor;
    if (!byActor[actor]) byActor[actor] = [];
    byActor[actor].push(t);
  });

  // 1) same address donating >3 times in one hour
  Object.entries(byActor).forEach(([actor, txs]) => {
    const donations = txs.filter((t) => t.actionType === "donation");
    donations.sort(
      (a, b) => Number(a.timestamp) - Number(b.timestamp)
    );
    for (let i = 0; i < donations.length; i++) {
      const windowTxs = [donations[i]];
      for (let j = i + 1; j < donations.length; j++) {
        const dt =
          Number(donations[j].timestamp) -
          Number(donations[i].timestamp);
        if (dt <= 3600) {
          windowTxs.push(donations[j]);
        }
      }
      if (windowTxs.length > 3) {
        suspiciousFlags.push({
          type: "Frequent donations",
          message: `Address ${actor.slice(
            0,
            6
          )}...${actor.slice(-4)} donated more than 3 times within an hour.`,
          relatedIds: windowTxs.map((t) => Number(t.id))
        });
        break;
      }
    }
  });

  // 2) OTP redeemed within 10 seconds of being issued
  const issued = {};
  transactions.forEach((t) => {
    if (t.actionType === "otp_issued") {
      issued[Number(t.campaignId)] =
        issued[Number(t.campaignId)] || [];
      issued[Number(t.campaignId)].push(t);
    }
  });

  transactions.forEach((t) => {
    if (t.actionType === "otp_redeemed") {
      const cId = Number(t.campaignId);
      const issuedTxs = issued[cId] || [];
      issuedTxs.forEach((iTx) => {
        const dt =
          Number(t.timestamp) - Number(iTx.timestamp);
        if (dt >= 0 && dt <= 10) {
          suspiciousFlags.push({
            type: "Fast OTP redemption",
            message: `OTP redeemed within ${dt} seconds of being issued for campaign ${cId}.`,
            relatedIds: [Number(iTx.id), Number(t.id)]
          });
        }
      });
    }
  });

  // 3) Donation amount exactly equal to total allocation
  // (here we'll just flag donations with large amounts as placeholder heuristic)
  transactions.forEach((t) => {
    if (t.actionType === "donation") {
      const amountEth = Number(ethers.formatEther(t.amount));
      if (amountEth > 0 && amountEth % 1 === 0) {
        suspiciousFlags.push({
          type: "Exact-match donation",
          message: `Donation of exactly ${amountEth} ETH for campaign ${Number(
            t.campaignId
          )}.`,
          relatedIds: [Number(t.id)]
        });
      }
    }
  });

  const totals = transactions.reduce(
    (acc, t) => {
      const eth = Number(ethers.formatEther(t.amount));
      acc.totalEth += eth;
      if (t.actionType === "donation") acc.donated += eth;
      if (t.actionType === "otp_redeemed") acc.redeemed += eth;
      return acc;
    },
    { totalEth: 0, donated: 0, redeemed: 0 }
  );

  return (
    <section className="card">
      <h2>Transaction Monitor</h2>

      <div className="controls-row">
        <div className="form-row">
          <label>Campaign ID (optional)</label>
          <input
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="Leave empty for all"
          />
        </div>
        <button
          className="secondary-button"
          onClick={loadTransactions}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button
          className="secondary-button"
          onClick={() => setAutoRefresh((v) => !v)}
        >
          Auto-refresh: {autoRefresh ? "On" : "Off"}
        </button>
      </div>

      <div className="summary-bar">
        <span>Total Txns: {transactions.length}</span>
        <span>Total ETH: {totals.totalEth.toFixed(4)}</span>
        <span>Donated ETH: {totals.donated.toFixed(4)}</span>
        <span>Redeemed ETH: {totals.redeemed.toFixed(4)}</span>
      </div>

      {suspiciousFlags.map((f, idx) => (
        <div key={idx} className="alert alert-warning small">
          <strong>{f.type}:</strong> {f.message}
        </div>
      ))}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Campaign</th>
              <th>Amount (ETH)</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const actor = t.actor;
              const ts = Number(t.timestamp);
              return (
                <tr key={Number(t.id)}>
                  <td>{Number(t.id)}</td>
                  <td>{t.actionType}</td>
                  <td>
                    {actor
                      ? `${actor.slice(0, 6)}...${actor.slice(-4)}`
                      : "-"}
                  </td>
                  <td>{Number(t.campaignId)}</td>
                  <td>{Number(ethers.formatEther(t.amount)).toFixed(4)}</td>
                  <td>
                    {ts
                      ? new Date(ts * 1000).toLocaleString()
                      : new Date(now).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan="6" className="muted-text">
                  No transactions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

