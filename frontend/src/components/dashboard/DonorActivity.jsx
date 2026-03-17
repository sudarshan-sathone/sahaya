import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { DISASTER_TYPES, DISASTER_COLORS, CAMPAIGN_STATUS, CAMPAIGN_STATUS_COLORS } from "../../constants/index.js";

function truncate(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTs(ts) {
  const n = Number(ts);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString();
}

export default function DonorActivity({ contract, account }) {
  const [txs, setTxs] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!contract || !account) return;
    try {
      setLoading(true);
      const [allTx, allCampaigns] = await Promise.all([
        contract.getAllTransactions(),
        contract.getAllCampaigns()
      ]);
      setTxs(allTx);
      setCampaigns(allCampaigns);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load data. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, account]);

  const myTx = useMemo(() => {
    if (!account) return [];
    return txs.filter(
      (t) => (t.actor || "").toLowerCase() === account.toLowerCase()
    );
  }, [txs, account]);

  const myTxDonationsOnly = useMemo(() => {
    const only = myTx
      .filter((tx) => tx.actionType && tx.actionType.includes("Donation"))
      .concat(
        myTx.filter(
          (tx) => (tx.actionType || "").toLowerCase() === "donation"
        )
      )
      .filter((t) => t && (t.actionType || "").toLowerCase().includes("donation"));

    const seen = new Set();
    return only.filter((t) => {
      const id = Number(t.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [myTx]);

  const byCampaign = useMemo(() => {
    const map = new Map();
    for (const t of myTxDonationsOnly) {
      const cid = Number(t.campaignId);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push(t);
    }
    return map;
  }, [myTxDonationsOnly]);

  const campaignById = useMemo(() => {
    const map = new Map();
    for (const c of campaigns) map.set(Number(c.id), c);
    return map;
  }, [campaigns]);

  const myDonations = useMemo(
    () =>
      myTxDonationsOnly.filter(
        (t) => (t.actionType || "").toLowerCase().includes("donation")
      ),
    [myTxDonationsOnly]
  );

  const summary = useMemo(() => {
    const donated = myDonations.reduce(
      (acc, t) => acc + Number(ethers.formatEther(t.amount)),
      0
    );
    const uniqueCampaigns = new Set(myDonations.map((t) => Number(t.campaignId)));
    return {
      donated,
      campaigns: uniqueCampaigns.size,
      txCount: myTx.length
    };
  }, [myDonations, myTx]);

  if (!account) {
    return (
      <div className="dash-card">
        <div className="dash-card-header">
          <div className="dash-card-title">My Activity</div>
        </div>
        <div style={{ color: "var(--text-muted)" }}>Connect wallet to view your activity.</div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div className="dash-card-title">My Donor Activity</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Wallet: {truncate(account)}
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : (
        <>
          <div className="stats-bar" style={{ marginBottom: 16 }}>
            <div className="stat-card" style={{ padding: 14 }}>
              <div className="stat-label">My Total Donated</div>
              <div className="stat-value">{summary.donated.toFixed(4)} ETH</div>
            </div>
            <div className="stat-card" style={{ padding: 14 }}>
              <div className="stat-label">Campaigns I Donated To</div>
              <div className="stat-value">{summary.campaigns}</div>
            </div>
            <div className="stat-card" style={{ padding: 14 }}>
              <div className="stat-label">Total Transactions</div>
              <div className="stat-value">{summary.txCount}</div>
            </div>
          </div>

          <div className="dash-card" style={{ padding: 18, marginBottom: 16 }}>
            <div className="dash-card-header" style={{ marginBottom: 12 }}>
              <div className="dash-card-title">My Donation History</div>
            </div>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Name</th>
                    <th>Disaster</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myTxDonationsOnly.map((t) => {
                    const cid = Number(t.campaignId);
                    const c = campaignById.get(cid);
                    const disaster = c ? DISASTER_TYPES[Number(c.disasterType)] : "—";
                    const color = DISASTER_COLORS[disaster] || "#888";
                    return (
                      <tr key={Number(t.id)}>
                        <td className="td-primary">#{cid}</td>
                        <td className="td-primary">{c ? c.name : "—"}</td>
                        <td>
                          <span className="badge" style={{ background: `${color}22`, color }}>
                            {disaster}
                          </span>
                        </td>
                        <td>{Number(t.amount) === 0 ? "—" : `${ethers.formatEther(t.amount)} ETH`}</td>
                        <td>{formatTs(t.timestamp)}</td>
                        <td>{t.actionType}</td>
                      </tr>
                    );
                  })}
                  {myTxDonationsOnly.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ color: "var(--text-muted)" }}>
                        No activity yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dash-card" style={{ padding: 18, marginBottom: 16 }}>
            <div className="dash-card-header" style={{ marginBottom: 12 }}>
              <div className="dash-card-title">Impact Tracker</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {Array.from(byCampaign.keys()).map((cid) => {
                const c = campaignById.get(cid);
                const myAmt = (byCampaign.get(cid) || [])
                  .filter((t) => t.actionType === "donation")
                  .reduce((acc, t) => acc + Number(ethers.formatEther(t.amount)), 0);
                const redeemedCount = c ? Number(c.redeemedCount) : 0;
                const disaster = c ? DISASTER_TYPES[Number(c.disasterType)] : "—";
                const color = DISASTER_COLORS[disaster] || "#888";
                return (
                  <div key={cid} className="alert-card alert-card-green">
                    <div style={{ flex: 1 }}>
                      <div className="alert-title">
                        {c ? c.name : `Campaign #${cid}`}{" "}
                        <span className="badge" style={{ background: `${color}22`, color, marginLeft: 8 }}>
                          {disaster}
                        </span>
                      </div>
                      <div className="alert-desc">
                        Your donation: {myAmt.toFixed(4)} ETH.{" "}
                        {redeemedCount > 0
                          ? `Your contribution helped fund ${redeemedCount} beneficiary redemptions.`
                          : "No redemptions yet from this campaign."}
                      </div>
                    </div>
                  </div>
                );
              })}
              {byCampaign.size === 0 && (
                <div style={{ color: "var(--text-muted)" }}>
                  Donate to a campaign to see your impact.
                </div>
              )}
            </div>
          </div>

          <div className="dash-card" style={{ padding: 18 }}>
            <div className="dash-card-header" style={{ marginBottom: 12 }}>
              <div className="dash-card-title">Campaign Status Updates</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {Array.from(byCampaign.keys()).map((cid) => {
                const c = campaignById.get(cid);
                const status = c ? CAMPAIGN_STATUS[Number(c.status)] : "—";
                const statusColor = c ? (CAMPAIGN_STATUS_COLORS[status] || "#888780") : "#888780";
                const myAmt = (byCampaign.get(cid) || [])
                  .filter((t) => t.actionType === "donation")
                  .reduce((acc, t) => acc + Number(ethers.formatEther(t.amount)), 0);
                const redeemedCount = c ? Number(c.redeemedCount) : 0;
                const isFlagged = status === "Flagged" || status === "Closed";
                const lowRedeem = redeemedCount === 0;
                const showAlert = isFlagged && lowRedeem;
                return (
                  <div key={cid} className={showAlert ? "alert-card alert-card-amber" : "alert-card alert-card-green"}>
                    <div style={{ flex: 1 }}>
                      <div className="alert-title">
                        {c ? c.name : `Campaign #${cid}`}{" "}
                        <span className="badge" style={{ background: `${statusColor}22`, color: statusColor, marginLeft: 8 }}>
                          {status}
                        </span>
                      </div>
                      <div className="alert-desc">
                        {showAlert
                          ? `Campaign was flagged/closed. Your contribution of ${myAmt.toFixed(
                              4
                            )} ETH is still held in the contract.`
                          : "Campaign status looks normal."}
                      </div>
                    </div>
                  </div>
                );
              })}
              {byCampaign.size === 0 && (
                <div style={{ color: "var(--text-muted)" }}>
                  No donated campaigns to track yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

