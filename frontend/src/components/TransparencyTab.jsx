import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  contractAddress,
  abi,
  DISASTER_TYPES,
  DISASTER_COLORS,
  CAMPAIGN_STATUS,
  CAMPAIGN_STATUS_COLORS
} from "../constants/index.js";

export default function TransparencyTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [balance, setBalance] = useState("0");
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const readContract = new ethers.Contract(contractAddress, abi, provider);
      const [all, bal] = await Promise.all([
        readContract.getAllCampaigns(),
        readContract.getContractBalance()
      ]);
      setCampaigns(all);
      setBalance(ethers.formatEther(bal));
      setLastRefreshed(new Date());
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load transparency data");
    }
  };

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="card">
      <h2>Transparency</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="summary-bar">
        <span>Total funds in contract: {balance} ETH</span>
        <span>Total campaigns: {campaigns.length}</span>
        <span>
          Refreshed:{" "}
          {lastRefreshed
            ? lastRefreshed.toLocaleTimeString()
            : "Just now"}
        </span>
      </div>

      <div className="campaign-grid">
        {campaigns.map((c) => {
          const id = Number(c.id);
          const disaster = DISASTER_TYPES[Number(c.disasterType)] || "Unknown";
          const disasterColor = DISASTER_COLORS[disaster] || "#888";
          const status = CAMPAIGN_STATUS[Number(c.status)] || "Unknown";
          const statusColor = CAMPAIGN_STATUS_COLORS[status] || "#888";
          const target = Number(ethers.formatEther(c.targetAmount));
          const raised = Number(ethers.formatEther(c.raisedAmount));
          const pct =
            target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
          const created = Number(c.createdAt);
          const expiry = Number(c.expiry);
          const lastActivity = Number(c.lastActivityAt);
          const now = Math.floor(Date.now() / 1000);
          const daysSince =
            lastActivity > 0
              ? Math.floor((now - lastActivity) / (24 * 60 * 60))
              : 0;

          return (
            <div key={id} className="campaign-card">
              <div className="campaign-header">
                <div>
                  <div className="campaign-name">
                    #{id} {c.name}
                  </div>
                  <div className="badge-row">
                    <span
                      className="pill"
                      style={{ backgroundColor: disasterColor }}
                    >
                      {disaster}
                    </span>
                    <span
                      className="pill"
                      style={{ backgroundColor: statusColor }}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              </div>
              <a
                href={c.documentHash}
                target="_blank"
                rel="noreferrer"
                className="doc-link"
              >
                Authenticity proof
              </a>
              <div className="campaign-meta">
                <div>
                  {raised.toFixed(2)} / {target.toFixed(2)} ETH
                </div>
                <div>
                  Beneficiaries: {Number(c.beneficiaryCount)} | Redeemed:{" "}
                  {Number(c.redeemedCount)}
                </div>
                <div>
                  Created:{" "}
                  {created
                    ? new Date(created * 1000).toLocaleDateString()
                    : "N/A"}
                </div>
                <div>
                  Expiry:{" "}
                  {expiry
                    ? new Date(expiry * 1000).toLocaleDateString()
                    : "N/A"}
                </div>
                <div>Days since last activity: {daysSince}</div>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {campaigns.length === 0 && (
          <div className="muted-text">
            No campaigns deployed yet on this network.
          </div>
        )}
      </div>
    </section>
  );
}

