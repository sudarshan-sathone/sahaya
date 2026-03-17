import { useEffect, useState } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { NGO_STATUS } from "../constants/index.js";

export default function NGOWorkerTab({ contract, account }) {
  const [campaignId, setCampaignId] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState(null);
  const [ngoProfile, setNgoProfile] = useState(null);

  const loadNgoProfile = async () => {
    if (!contract || !account) {
      setNgoProfile(null);
      return;
    }
    try {
      const ngo = await contract.getNGO(account);
      if (ngo.exists) {
        setNgoProfile({
          exists: true,
          name: ngo.name,
          status: Number(ngo.status)
        });
      } else {
        setNgoProfile({ exists: false });
      }
    } catch (e) {
      console.error(e);
      setNgoProfile(null);
    }
  };

  const loadActivity = async () => {
    if (!contract || !account) return;
    try {
      const stats = await contract.getNGOActivity(account);
      setActivity({
        totalRegistered: Number(stats[0]),
        totalApproved: Number(stats[1]),
        totalRedeemed: Number(stats[2]),
        status: Number(stats[3])
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNgoProfile();
    loadActivity();
  }, [contract, account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contract) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (ngoProfile && ngoProfile.exists === false) {
      toast.error(
        "This wallet is not registered as an NGO. Ask admin to register and activate this wallet in NGO Management."
      );
      return;
    }
    if (ngoProfile && ngoProfile.exists && ngoProfile.status !== 1) {
      toast.error(
        `Your NGO status is ${NGO_STATUS[ngoProfile.status]}. It must be Active to register beneficiaries.`
      );
      return;
    }
    try {
      setLoading(true);
      const toastId = toast.loading("Waiting for confirmation...");
      const hash = ethers.keccak256(ethers.toUtf8Bytes(aadhaar));
      const tx = await contract.registerBeneficiary(
        Number(campaignId),
        hash,
        pincode
      );
      const receipt = await tx.wait();

      const ev = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((p) => p && p.name === "BeneficiaryRegistered");

      const idx = ev ? Number(ev.args.beneficiaryIndex) : null;
      toast.success(`Beneficiary registered at index [${idx ?? "X"}].`, {
        id: toastId
      });
      setAadhaar("");
      setPincode("");
      await loadActivity();
    } catch (e) {
      console.error(e);
      const message = e?.reason || e?.message || "Transaction failed";
      toast.error(
        message.length > 80 ? message.slice(0, 80) + "..." : message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h2>NGO Worker</h2>

      {account && (
        <p className="muted-text">
          Connected NGO wallet: {account.slice(0, 6)}...{account.slice(-4)}
        </p>
      )}

      {ngoProfile && (
        <div className="alert alert-warning small">
          {ngoProfile.exists
            ? `NGO: ${ngoProfile.name || "(unnamed)"} — Status: ${
                NGO_STATUS[ngoProfile.status] || "Unknown"
              }`
            : "This wallet is not registered as an NGO."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-row">
          <label>Campaign ID</label>
          <input
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label>Aadhaar</label>
          <input
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label>Pincode</label>
          <input
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            required
          />
        </div>
        <button className="primary-button" disabled={loading}>
          {loading ? "Submitting..." : "Register Beneficiary"}
        </button>
      </form>

      {activity && (
        <div className="subsection">
          <h3>Your NGO Activity</h3>
          <p>Total Registered: {activity.totalRegistered}</p>
          <p>Total Approved: {activity.totalApproved}</p>
          <p>Total Redeemed: {activity.totalRedeemed}</p>
        </div>
      )}
    </section>
  );
}

