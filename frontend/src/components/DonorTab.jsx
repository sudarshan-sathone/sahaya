import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  DISASTER_TYPES,
  DISASTER_COLORS,
  CAMPAIGN_STATUS,
  CAMPAIGN_STATUS_COLORS
} from "../constants/index.js";

export default function DonorTab({ contract, account }) {
  const [campaigns, setCampaigns] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const loadCampaigns = async () => {
    if (!contract) return;
    try {
      setError(null);
      const all = await contract.getAllCampaigns();
      const active = all.filter((c) => Number(c.status) === 2);
      setCampaigns(active);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load campaigns");
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [contract]);

  const handleDonate = async (id) => {
    if (!contract) return;
    const amt = amounts[id] || "";
    if (!amt) {
      alert("Enter amount in ETH");
      return;
    }
    try {
      setLoadingId(id);
      setError(null);
      const tx = await contract.donate(id, {
        value: ethers.parseEther(amt)
      });
      const receipt = await tx.wait();
      alert(`Donation successful. Tx ${receipt.hash.slice(0, 10)}...`);
      await loadCampaigns();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to donate");
    } finally {
      setLoadingId(null);
    }
  };

  if (!contract) {
    return (
      <section className="card">
        <h2>Donor</h2>
        <div className="alert alert-warning">
          Connect wallet to donate to campaigns.
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Donor</h2>
      {account && (
        <p className="muted-text">
          Donor wallet: {account.slice(0, 6)}...{account.slice(-4)}
        </p>
      )}
      {error && <div className="alert alert-error">{error}</div>}
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
          const expiry = Number(c.expiry);

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
                <div>Beneficiaries: {Number(c.beneficiaryCount)}</div>
                <div>
                  Expires:{" "}
                  {expiry
                    ? new Date(expiry * 1000).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="form-row inline">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount (ETH)"
                  value={amounts[id] || ""}
                  onChange={(e) =>
                    setAmounts({ ...amounts, [id]: e.target.value })
                  }
                />
                <button
                  className="primary-button"
                  disabled={loadingId === id}
                  onClick={() => handleDonate(id)}
                >
                  {loadingId === id ? "Donating..." : "Donate"}
                </button>
              </div>
            </div>
          );
        })}
        {campaigns.length === 0 && (
          <div className="muted-text">No active campaigns available.</div>
        )}
      </div>
    </section>
  );
}

