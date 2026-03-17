import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  DISASTER_TYPES,
  DISASTER_COLORS,
  CAMPAIGN_STATUS
} from "../constants/index.js";

export default function CampaignManager({ contract }) {
  const [name, setName] = useState("");
  const [disasterType, setDisasterType] = useState(0);
  const [targetEth, setTargetEth] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [documentHash, setDocumentHash] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const loadCampaigns = async () => {
    if (!contract) return;
    try {
      setLoadingCampaigns(true);
      const all = await contract.getAllCampaigns();
      setCampaigns(all);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load campaigns");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [contract]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as admin first.");
      return;
    }
    try {
      setCreating(true);
      setError(null);
      setMessage(null);

      const tx = await contract.createCampaign(
        name,
        Number(disasterType),
        ethers.parseEther(targetEth || "0"),
        Number(expiryDays),
        documentHash
      );
      const receipt = await tx.wait();

      const createdEvent = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((ev) => ev && ev.name === "CampaignCreated");

      const id = createdEvent ? Number(createdEvent.args.id) : null;
      const txHash = receipt.hash;

      setMessage(
        `Campaign created with ID ${id ?? "(unknown)"} - tx ${txHash.slice(
          0,
          10
        )}...`
      );
      setName("");
      setTargetEth("");
      setExpiryDays(30);
      setDocumentHash("");

      await loadCampaigns();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (id) => {
    if (!contract) return;
    try {
      setCreating(true);
      setError(null);
      const tx = await contract.verifyCampaign(id);
      const receipt = await tx.wait();
      setMessage(
        `Campaign ${id} verified. Tx ${receipt.hash.slice(0, 10)}...`
      );
      await loadCampaigns();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to verify campaign");
    } finally {
      setCreating(false);
    }
  };

  const handleWithdrawExpired = async (id) => {
    if (!contract) return;
    try {
      setCreating(true);
      setError(null);
      const tx = await contract.withdrawExpiredFunds(id);
      const receipt = await tx.wait();
      setMessage(
        `Withdrawn expired funds for campaign ${id}. Tx ${receipt.hash.slice(
          0,
          10
        )}...`
      );
      await loadCampaigns();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to withdraw funds");
    } finally {
      setCreating(false);
    }
  };

  const pending = campaigns.filter((c) => Number(c.status) === 0);
  const flagged = campaigns.filter((c) => Number(c.status) === 3);

  return (
    <section className="card">
      <h2>Campaign Management</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <form className="form-grid" onSubmit={handleCreate}>
        <div className="form-row">
          <label>Campaign Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label>Disaster Type</label>
          <select
            value={disasterType}
            onChange={(e) => setDisasterType(Number(e.target.value))}
          >
            {DISASTER_TYPES.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Target Amount (ETH)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={targetEth}
            onChange={(e) => setTargetEth(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label>Expiry Days</label>
          <input
            type="number"
            min="1"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label>Document Hash / URL</label>
          <input
            value={documentHash}
            onChange={(e) => setDocumentHash(e.target.value)}
            required
          />
        </div>
        <button className="primary-button" disabled={creating}>
          {creating ? "Submitting..." : "Create Campaign"}
        </button>
      </form>

      <div className="subsection">
        <h3>Pending Campaigns</h3>
        {loadingCampaigns && (
          <div className="muted-text">Loading campaigns...</div>
        )}
        {pending.map((c) => {
          const id = Number(c.id);
          const disaster = DISASTER_TYPES[Number(c.disasterType)] || "Unknown";
          const color = DISASTER_COLORS[disaster] || "#888";
          return (
            <div key={id} className="campaign-row">
              <div>
                <div className="campaign-name">
                  #{id} {c.name}
                </div>
                <div className="badge-row">
                  <span className="pill" style={{ backgroundColor: color }}>
                    {disaster}
                  </span>
                  <a
                    href={c.documentHash}
                    target="_blank"
                    rel="noreferrer"
                    className="doc-link"
                  >
                    Authenticity proof
                  </a>
                </div>
              </div>
              <button
                className="primary-button"
                disabled={creating}
                onClick={() => handleVerify(id)}
              >
                Verify & Activate
              </button>
            </div>
          );
        })}
        {pending.length === 0 && !loadingCampaigns && (
          <div className="muted-text">No pending campaigns.</div>
        )}
      </div>

      <div className="subsection">
        <h3>Flagged Campaigns</h3>
        {flagged.map((c) => {
          const id = Number(c.id);
          const lastActivity = Number(c.lastActivityAt);
          const expiry = Number(c.expiry);
          const canClose = Date.now() / 1000 > expiry;
          return (
            <div key={id} className="campaign-row">
              <div>
                <div className="campaign-name">
                  #{id} {c.name}
                </div>
                <div className="muted-text small">
                  Last activity:{" "}
                  {lastActivity
                    ? new Date(lastActivity * 1000).toLocaleString()
                    : "N/A"}
                </div>
              </div>
              <button
                className="danger-button"
                disabled={!canClose || creating}
                onClick={() => handleWithdrawExpired(id)}
              >
                {canClose ? "Close & Withdraw" : "Waiting for expiry"}
              </button>
            </div>
          );
        })}
        {flagged.length === 0 && (
          <div className="muted-text">No flagged campaigns.</div>
        )}
      </div>
    </section>
  );
}

