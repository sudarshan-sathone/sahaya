import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  DISASTER_TYPES,
  DISASTER_COLORS,
  CAMPAIGN_STATUS
} from "../../constants/index.js";

function statusBadge(statusIndex) {
  const s = CAMPAIGN_STATUS[statusIndex] || "Unknown";
  if (s === "Active") return { label: s, cls: "badge badge-green" };
  if (s === "Pending") return { label: s, cls: "badge badge-amber" };
  if (s === "Verified") return { label: s, cls: "badge badge-blue" };
  if (s === "Flagged") return { label: s, cls: "badge badge-red" };
  if (s === "Closed") return { label: s, cls: "badge badge-gray" };
  return { label: s, cls: "badge badge-gray" };
}

function progressColor(pct) {
  if (pct > 50) return "progress-fill progress-green";
  if (pct >= 20) return "progress-fill progress-amber";
  return "progress-fill progress-red";
}

function formatTs(ts) {
  const n = Number(ts);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString();
}

export default function CampaignControl({ contract }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const load = async () => {
    if (!contract) return;
    try {
      setError(null);
      setLoading(true);
      const all = await contract.getAllCampaigns();
      setCampaigns(all);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  const nowSec = Math.floor(Date.now() / 1000);

  const pendingCampaigns = useMemo(
    () => campaigns.filter((c) => Number(c.status) === 0),
    [campaigns]
  );

  const withComputed = useMemo(() => {
    return campaigns.map((c) => {
      const id = Number(c.id);
      const disaster = DISASTER_TYPES[Number(c.disasterType)] || "Other";
      const statusIndex = Number(c.status);
      const raisedEth = Number(ethers.formatEther(c.raisedAmount));
      const targetEth = Number(ethers.formatEther(c.targetAmount));
      const pct =
        targetEth > 0 ? Math.min(100, Math.round((raisedEth / targetEth) * 100)) : 0;
      const lastActivity = Number(c.lastActivityAt);
      const daysInactive = lastActivity
        ? Math.floor((nowSec - lastActivity) / (24 * 60 * 60))
        : 0;
      const expiry = Number(c.expiry);
      const canClose = expiry ? nowSec > expiry : false;
      return {
        raw: c,
        id,
        disaster,
        statusIndex,
        raisedEth,
        targetEth,
        pct,
        daysInactive,
        canClose
      };
    });
  }, [campaigns, nowSec]);

  const runAction = async (id, kind, fn) => {
    if (!contract) return;
    try {
      setActionLoading((m) => ({ ...m, [`${kind}-${id}`]: true }));
      setError(null);
      const tx = await fn();
      await tx.wait();
      await load();
    } catch (e) {
      console.error(e);
      setError(e.message || "Action failed");
    } finally {
      setActionLoading((m) => ({ ...m, [`${kind}-${id}`]: false }));
    }
  };

  return (
    <>
      <div className="dash-card">
        <div className="dash-card-header">
          <div className="dash-card-title">Campaign Health Overview</div>
          <button className="dash-card-action" onClick={load}>
            Refresh
          </button>
        </div>

        {loading && (
          <div>
            <div className="skeleton" style={{ height: 14, width: 220 }} />
            <div className="skeleton" style={{ height: 220, marginTop: 12 }} />
          </div>
        )}

        {error && !loading && (
          <div className="alert-card alert-card-amber">
            <div>
              <div className="alert-title">Campaign load issue</div>
              <div className="alert-desc">{error}</div>
            </div>
          </div>
        )}

        {!loading && (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Disaster</th>
                  <th>Status</th>
                  <th>Raised / Target</th>
                  <th>Beneficiaries</th>
                  <th>Last Activity</th>
                  <th>Inactive</th>
                  <th>Document</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {withComputed.map((c) => {
                  const st = statusBadge(c.statusIndex);
                  const disasterColor = DISASTER_COLORS[c.disaster] || "#888";
                  const inactiveBadge =
                    c.daysInactive > 7 ? (
                      <span className="badge badge-red">{c.daysInactive}d inactive</span>
                    ) : (
                      <span className="badge badge-gray">{c.daysInactive}d</span>
                    );

                  const keyVerify = `verify-${c.id}`;
                  const keyFlag = `flag-${c.id}`;
                  const keyClose = `close-${c.id}`;

                  return (
                    <tr key={c.id}>
                      <td>#{c.id}</td>
                      <td className="td-primary">{c.raw.name}</td>
                      <td>
                        <span className="badge" style={{ background: `${disasterColor}22`, color: disasterColor }}>
                          {c.disaster}
                        </span>
                      </td>
                      <td>
                        <span className={st.cls}>{st.label}</span>
                      </td>
                      <td>
                        <div className="td-primary">
                          {c.raisedEth.toFixed(2)} / {c.targetEth.toFixed(2)} ETH
                        </div>
                        <div className="progress-wrap">
                          <div
                            className={progressColor(c.pct)}
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        {Number(c.raw.beneficiaryCount)} registered / {Number(c.raw.redeemedCount)} redeemed
                      </td>
                      <td>
                        <div className="td-primary">{formatTs(c.raw.lastActivityAt)}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          {c.daysInactive}d ago
                        </div>
                      </td>
                      <td>{inactiveBadge}</td>
                      <td>
                        {c.raw.documentHash ? (
                          <a
                            href={c.raw.documentHash}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--blue)", fontSize: 12 }}
                          >
                            View Proof
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>No proof</span>
                        )}
                      </td>
                      <td>
                        {c.statusIndex === 0 && (
                          <button
                            className="btn-sm btn-success"
                            disabled={!!actionLoading[keyVerify]}
                            onClick={() =>
                              runAction(c.id, "verify", () => contract.verifyCampaign(c.id))
                            }
                          >
                            Verify
                          </button>
                        )}{" "}
                        {c.statusIndex === 2 && c.daysInactive > 7 && (
                          <button
                            className="btn-sm btn-warning"
                            disabled={!!actionLoading[keyFlag]}
                            onClick={() =>
                              runAction(c.id, "flag", () =>
                                contract.flagInactiveCampaign(c.id)
                              )
                            }
                          >
                            Flag
                          </button>
                        )}{" "}
                        {(c.statusIndex === 2 || c.statusIndex === 3) && (
                          <button
                            className="btn-sm btn-danger"
                            disabled={!c.canClose || !!actionLoading[keyClose]}
                            onClick={() =>
                              runAction(c.id, "close", () =>
                                contract.withdrawExpiredFunds(c.id)
                              )
                            }
                            title={!c.canClose ? "Only after expiry" : "Close & withdraw"}
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {withComputed.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ color: "var(--text-muted)" }}>
                      No campaigns yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <div className="dash-card-title">Pending Campaigns Requiring Verification</div>
        </div>

        {pendingCampaigns.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            No campaigns awaiting verification
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {pendingCampaigns.map((c) => {
              const id = Number(c.id);
              const disaster = DISASTER_TYPES[Number(c.disasterType)] || "Other";
              const color = DISASTER_COLORS[disaster] || "#888";
              const created = formatTs(c.createdAt);
              return (
                <div
                  key={id}
                  className="dash-card"
                  style={{ marginBottom: 0, padding: 18 }}
                >
                  <div className="dash-card-header" style={{ marginBottom: 12 }}>
                    <div>
                      <div className="td-primary">{c.name}</div>
                      <div style={{ marginTop: 6 }}>
                        <span
                          className="badge"
                          style={{ background: `${color}22`, color }}
                        >
                          {disaster}
                        </span>{" "}
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          Created: {created}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn-sm btn-success"
                      onClick={() =>
                        runAction(id, "verify", () => contract.verifyCampaign(id))
                      }
                      disabled={!!actionLoading[`verify-${id}`]}
                    >
                      Verify Campaign
                    </button>
                  </div>

                  {c.documentHash ? (
                    <a
                      href={c.documentHash}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--blue)", fontSize: 12 }}
                    >
                      Authenticity Document
                    </a>
                  ) : (
                    <div className="alert-card alert-card-amber" style={{ marginTop: 10 }}>
                      <div>
                        <div className="alert-title">No document provided</div>
                        <div className="alert-desc">
                          Verify only after confirming the authenticity document matches
                          a real declared disaster.
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                    Verify only after confirming the authenticity document matches a real
                    declared disaster.
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

