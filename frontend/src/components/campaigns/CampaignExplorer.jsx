import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import {
  abi,
  contractAddress,
  DISASTER_COLORS,
  DISASTER_TYPES
} from "../../constants/index.js";
import CampaignDetail from "./CampaignDetail.jsx";

const FILTERS = ["All", ...DISASTER_TYPES];

function truncate(s, n = 100) {
  if (!s) return "";
  if (s.length <= n) return s;
  return `${s.slice(0, n)}...`;
}

function progressMeta(raisedEth, targetEth) {
  const pct =
    targetEth > 0 ? Math.max(0, Math.min(100, (raisedEth / targetEth) * 100)) : 0;
  const cls =
    pct > 50 ? "progress-fill" : pct >= 20 ? "progress-fill" : "progress-fill";
  const color = pct > 50 ? "var(--green)" : pct >= 20 ? "var(--amber)" : "var(--red)";
  return { pct, cls, color };
}

function authBadge(c) {
  const status = Number(c.status);
  const hasDoc = !!(c.documentHash || "").trim();
  if (status === 0) return { label: "Unverified", cls: "auth-badge auth-pending" };
  if ((status === 1 || status === 2) && hasDoc)
    return { label: "✓ Verified", cls: "auth-badge auth-verified" };
  if (status === 2 && !hasDoc)
    return { label: "⚠ No Proof", cls: "auth-badge auth-warning" };
  if (status === 3) return { label: "⚠ Flagged", cls: "auth-badge auth-flagged" };
  return { label: "Unverified", cls: "auth-badge auth-pending" };
}

function daysRemaining(expiry) {
  const exp = Number(expiry);
  if (!exp) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = exp - nowSec;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60));
}

export default function CampaignExplorer({ contract, account }) {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(() => new Set());

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider("http://127.0.0.1:8545"),
    []
  );
  const readContract = useMemo(
    () => new ethers.Contract(contractAddress, abi, readProvider),
    [readProvider]
  );
  const activeContract = contract || readContract;

  const load = async () => {
    try {
      setLoading(true);
      const all = await activeContract.getAllCampaigns();
      setCampaigns(all);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContract]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return campaigns
      .filter((c) => {
        if (filterType === "all") return true;
        const dtype = DISASTER_TYPES[Number(c.disasterType)] || "Other";
        return dtype.toLowerCase() === filterType.toLowerCase();
      })
      .filter((c) => {
        if (!q) return true;
        return (c.name || "").toLowerCase().includes(q);
      });
  }, [campaigns, filterType, searchQuery]);

  if (selectedCampaign) {
    return (
      <CampaignDetail
        campaign={selectedCampaign}
        contract={contract}
        account={account}
        onBack={() => setSelectedCampaign(null)}
      />
    );
  }

  return (
    <div className="campaigns-page">
      <div className="campaigns-header">
        <div className="campaigns-title">Disaster Relief Campaigns</div>
        <input
          className="search-input"
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="filter-pills">
        {FILTERS.map((label) => {
          const key = label === "All" ? "all" : label;
          const active = filterType === (label === "All" ? "all" : label);
          const color =
            label === "All" ? "var(--text-secondary)" : DISASTER_COLORS[label] || "#888";
          return (
            <button
              key={key}
              type="button"
              className={`filter-pill ${active ? "active" : ""}`}
              style={{ color }}
              onClick={() => setFilterType(label === "All" ? "all" : label)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="campaign-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-img" />
              <div style={{ padding: 20 }}>
                <div className="skeleton-line" style={{ width: "70%" }} />
                <div className="skeleton-line" style={{ width: "90%" }} />
                <div className="skeleton-line" style={{ width: "55%", marginTop: 14 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No campaigns match your search
        </div>
      ) : (
        <div className="campaign-grid">
          {filtered.map((c) => {
            const id = Number(c.id);
            const disaster = DISASTER_TYPES[Number(c.disasterType)] || "Other";
            const dColor = DISASTER_COLORS[disaster] || "#888";
            const raisedEth = Number(ethers.formatEther(c.raisedAmount));
            const targetEth = Number(ethers.formatEther(c.targetAmount));
            const { pct, color } = progressMeta(raisedEth, targetEth);
            const rem = daysRemaining(c.expiry);
            const auth = authBadge(c);
            const descPreview = truncate((c.description || "").trim(), 100);

            const gradient = `linear-gradient(135deg, ${dColor} 0%, rgba(0,0,0,0.2) 100%)`;
            const showImg = !!c.imageURL && !imgFailed.has(id);

            return (
              <div
                key={id}
                className="campaign-card"
                onClick={() => setSelectedCampaign(c)}
              >
                <div className="campaign-img-wrap">
                  {showImg ? (
                    <img
                      className="campaign-img"
                      src={c.imageURL}
                      alt={c.name}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        setImgFailed((s) => new Set([...s, id]));
                      }}
                    />
                  ) : (
                    <div
                      className="campaign-img-placeholder"
                      style={{ background: gradient }}
                    >
                      {disaster}
                    </div>
                  )}

                  <div className="campaign-img-overlay">
                    <span
                      className="auth-badge"
                      style={{
                        background: `${dColor}22`,
                        color: "white",
                        border: `1px solid ${dColor}55`
                      }}
                    >
                      {disaster}
                    </span>
                    <span className={auth.cls}>{auth.label}</span>
                  </div>
                </div>

                <div className="campaign-body">
                  <div className="campaign-name">{c.name}</div>
                  <div className="campaign-desc">
                    {descPreview || (
                      <span style={{ color: "var(--text-muted)" }}>
                        No description provided
                      </span>
                    )}
                  </div>

                  <div className="campaign-raised-row">
                    <div className="campaign-raised-amount">
                      {raisedEth.toFixed(2)} ETH raised
                    </div>
                    <div className="campaign-raised-target">
                      of {targetEth.toFixed(2)} ETH
                    </div>
                  </div>

                  <div className="progress-wrap">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>

                  <div className="campaign-footer">
                    <div>{Number(c.beneficiaryCount?.toString?.() || 0)} beneficiaries</div>
                    <div>
                      {rem === null ? (
                        "—"
                      ) : rem === 0 ? (
                        <span style={{ color: "var(--red)", fontWeight: 700 }}>
                          Expired
                        </span>
                      ) : (
                        `${rem} days remaining`
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

