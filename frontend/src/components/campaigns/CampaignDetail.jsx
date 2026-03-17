import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import {
  abi,
  contractAddress,
  DISASTER_COLORS,
  DISASTER_TYPES
} from "../../constants/index.js";

function truncateAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
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

function timeAgo(ts) {
  const n = Number(ts);
  if (!n) return "—";
  const diff = Date.now() - n * 1000;
  const m = Math.floor(diff / (60 * 1000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function daysRemaining(expiry) {
  const exp = Number(expiry);
  if (!exp) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = exp - nowSec;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60));
}

export default function CampaignDetail({ campaign, contract, account, onBack }) {
  const [donations, setDonations] = useState([]);
  const [donateAmount, setDonateAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  const normalizeTx = (t) => ({
    id: Number(t?.id?.toString?.() ?? t?.id ?? 0),
    actor: t?.actor ?? "",
    actionType: t?.actionType ?? "",
    campaignId: Number(t?.campaignId?.toString?.() ?? t?.campaignId ?? 0),
    amount: t?.amount ?? 0n,
    timestamp: Number(t?.timestamp?.toString?.() ?? t?.timestamp ?? 0)
  });

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider("http://127.0.0.1:8545"),
    []
  );
  const readContract = useMemo(
    () => new ethers.Contract(contractAddress, abi, readProvider),
    [readProvider]
  );
  const activeContract = contract || readContract;

  const loadDonations = async () => {
    try {
      const txs = await activeContract.getCampaignTransactions(Number(campaign.id));
      const filtered = Array.from(txs || [])
        .map(normalizeTx)
        .filter((t) => (t.actionType || "").toLowerCase().includes("donation"))
        .sort((a, b) => b.timestamp - a.timestamp);
      setDonations(filtered);
    } catch (e) {
      console.error(e);
      toast.error("Could not load donation history");
    }
  };

  useEffect(() => {
    loadDonations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, activeContract]);

  const disaster = DISASTER_TYPES[Number(campaign.disasterType)] || "Other";
  const dColor = DISASTER_COLORS[disaster] || "#888";
  const gradient = `linear-gradient(135deg, ${dColor} 0%, rgba(0,0,0,0.2) 100%)`;

  const raisedEth = Number(ethers.formatEther(campaign.raisedAmount));
  const targetEth = Number(ethers.formatEther(campaign.targetAmount));
  const pct = targetEth > 0 ? Math.max(0, Math.min(100, (raisedEth / targetEth) * 100)) : 0;
  const progressColor =
    pct > 50 ? "var(--green)" : pct >= 20 ? "var(--amber)" : "var(--red)";

  const rem = daysRemaining(campaign.expiry);
  const auth = authBadge(campaign);

  const createdAt = Number(campaign.createdAt);
  const createdAtLabel = createdAt
    ? new Date(createdAt * 1000).toLocaleString()
    : "—";

  const docHash = (campaign.documentHash || "").trim();
  const status = Number(campaign.status);

  const handleDonate = async () => {
    if (!account) {
      toast.error("Connect wallet to donate");
      return;
    }
    if (!donateAmount || isNaN(donateAmount) || Number(donateAmount) <= 0) {
      toast.error("Enter a valid ETH amount");
      return;
    }

    const toastId = toast.loading("Processing donation...");
    try {
      setDonating(true);
      const tx = await contract.donate(Number(campaign.id), {
        value: ethers.parseEther(donateAmount)
      });
      await tx.wait();
      toast.success("Donation confirmed! Thank you for your contribution.", {
        id: toastId
      });
      setDonateAmount("");
      await loadDonations();
    } catch (err) {
      const msg = err?.reason || err?.message || "Transaction failed";
      const trimmed = msg.length > 80 ? msg.slice(0, 80) + "..." : msg;
      toast.error(trimmed, { id: toastId });
    } finally {
      setDonating(false);
    }
  };

  return (
    <div className="detail-page">
      <button className="detail-back" type="button" onClick={onBack}>
        ← All Campaigns
      </button>

      <div className="detail-layout">
        <div>
          {campaign.imageURL && imgOk ? (
            <img
              className="detail-img"
              src={campaign.imageURL}
              alt={campaign.name}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                setImgOk(false);
              }}
            />
          ) : (
            <div className="campaign-img-placeholder" style={{ background: gradient, height: 400, borderRadius: 12, marginBottom: 24 }}>
              {disaster}
            </div>
          )}

          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginTop: 16 }}>
            {campaign.name}
          </div>

          <div className="auth-section" style={{ marginTop: 16 }}>
            <div className="auth-section-title">Campaign Authenticity</div>

            <div className="auth-row">
              <div className="auth-row-label">Verification Status</div>
              <div className="auth-row-value">
                <span className={auth.cls} style={{ fontSize: 12, padding: "6px 12px" }}>
                  {auth.label}
                </span>
                <div style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: 12 }}>
                  {status === 0
                    ? "Awaiting independent verification"
                    : status === 3
                    ? "Flagged — under review"
                    : (docHash ? "Independently reviewed by authorized verifier" : "Active without proof document")}
                </div>
              </div>
            </div>

            <div className="auth-row">
              <div className="auth-row-label">Recorded on blockchain</div>
              <div className="auth-row-value">
                <div className="timestamp-proof">{createdAtLabel}</div>
                <div className="timestamp-sub">Permanent and unalterable blockchain record</div>
              </div>
            </div>

            <div className="auth-row">
              <div className="auth-row-label">Proof document</div>
              <div className="auth-row-value">
                {docHash ? (
                  <>
                    <a className="doc-link" href={docHash} target="_blank" rel="noreferrer">
                      View Official Document →
                    </a>
                    <div className="timestamp-sub">
                      Cross-reference with official disaster declarations
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#EF9F27", fontSize: 13 }}>
                    No document provided — donate with caution
                  </div>
                )}
              </div>
            </div>

            <div className="auth-row">
              <div className="auth-row-label">Verification trail</div>
              <div className="auth-row-value">
                {status === 0
                  ? "Awaiting independent verification"
                  : status === 3
                  ? "Flagged — under review"
                  : "Independently reviewed by authorized verifier"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="auth-section-title">About This Campaign</div>
            <div style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)", fontSize: 14, lineHeight: 1.6 }}>
              {(campaign.description || "").trim() ? (
                campaign.description
              ) : (
                <span style={{ color: "var(--text-muted)" }}>No description provided</span>
              )}
            </div>
          </div>
        </div>

        <div className="donate-panel">
          <div className="donate-raised-big">{raisedEth.toFixed(4)} ETH</div>
          <div className="donate-target">of {targetEth.toFixed(4)} ETH goal</div>

          <div className="progress-wrap" style={{ height: 10, marginBottom: 14 }}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: progressColor }} />
          </div>

          <div className="donate-stats">
            {Number(campaign.beneficiaryCount?.toString?.() || 0)} beneficiaries ·{" "}
            {Number(campaign.redeemedCount?.toString?.() || 0)} redeemed
          </div>

          <div className="donate-expiry" style={{ color: rem === 0 ? "var(--red)" : "var(--text-secondary)" }}>
            {rem === null ? "—" : rem === 0 ? "Expired" : `${rem} days remaining`}
          </div>

          {status === 2 ? (
            <>
              <div className="donate-input-row">
                <input
                  className="donate-input"
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(e.target.value)}
                  placeholder="0.0"
                />
                <button className="donate-btn" disabled={donating} onClick={handleDonate} type="button">
                  {donating ? "Processing..." : "Donate Now"}
                </button>
              </div>
            </>
          ) : status === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Pending verification — not yet open for donations
            </div>
          ) : status === 3 ? (
            <>
              <div style={{ color: "#EF9F27", fontSize: 13, marginBottom: 10 }}>
                ⚠ Flagged for suspicious activity — donate with caution
              </div>
              <div className="donate-input-row">
                <input
                  className="donate-input"
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(e.target.value)}
                  placeholder="0.0"
                />
                <button className="donate-btn" disabled={donating} onClick={handleDonate} type="button">
                  {donating ? "Processing..." : "Donate Now"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Campaign closed</div>
          )}

          <div style={{ marginTop: 18 }}>
            <div className="recent-donations-header">Recent Donations</div>
            {donations.slice(0, 8).length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Be the first to donate
              </div>
            ) : (
              donations.slice(0, 8).map((t) => (
                <div key={t.id} className="donation-row">
                  <div className="donation-wallet">{truncateAddr(t.actor)}</div>
                  <div className="donation-right">
                    <div className="donation-amount">
                      {Number(ethers.formatEther(t.amount)).toFixed(4)} ETH
                    </div>
                    <div className="donation-time">{timeAgo(t.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

