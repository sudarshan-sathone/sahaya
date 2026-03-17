import { useEffect, useState } from "react";
import { ethers } from "ethers";

export default function NGOWorkerTab({ contract, account }) {
  const [campaignId, setCampaignId] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [activity, setActivity] = useState(null);

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
    loadActivity();
  }, [contract, account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as NGO wallet first.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(aadhaar));
      const tx = await contract.registerBeneficiary(
        Number(campaignId),
        hash,
        pincode
      );
      const receipt = await tx.wait();
      setMessage(
        `Registered beneficiary. Tx ${receipt.hash.slice(
          0,
          10
        )}... Ask admin for beneficiary index from getBeneficiaries().`
      );
      setAadhaar("");
      setPincode("");
      await loadActivity();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to register beneficiary");
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

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

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

