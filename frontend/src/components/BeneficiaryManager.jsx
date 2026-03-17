import { useEffect, useState } from "react";
import { ethers } from "ethers";

export default function BeneficiaryManager({ contract, account }) {
  const [demoMode, setDemoMode] = useState(true);
  const [ngoPrivateKey, setNgoPrivateKey] = useState("");
  const [vendorPrivateKey, setVendorPrivateKey] = useState("");
  const [demoNgoAddress, setDemoNgoAddress] = useState(null);
  const [demoVendorAddress, setDemoVendorAddress] = useState(null);
  const [demoOtp, setDemoOtp] = useState("");

  const [regCampaignId, setRegCampaignId] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pincode, setPincode] = useState("");
  const [approveCampaignId, setApproveCampaignId] = useState("");
  const [beneficiaryIndex, setBeneficiaryIndex] = useState("");
  const [allocationEth, setAllocationEth] = useState("");
  const [otpCampaignId, setOtpCampaignId] = useState("");
  const [otpBeneficiaryIndex, setOtpBeneficiaryIndex] = useState("");
  const [issuedOtp, setIssuedOtp] = useState(null);
  const [vendorAddress, setVendorAddress] = useState("");
  const [beneficiariesCampaignId, setBeneficiariesCampaignId] =
    useState("");
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [connectedNgo, setConnectedNgo] = useState(null);

  const getLocalRpcProvider = () => {
    return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  };

  const refreshDemoAddresses = async () => {
    try {
      const ngoAddr = ngoPrivateKey
        ? new ethers.Wallet(ngoPrivateKey).address
        : null;
      const vendorAddr = vendorPrivateKey
        ? new ethers.Wallet(vendorPrivateKey).address
        : null;
      setDemoNgoAddress(ngoAddr);
      setDemoVendorAddress(vendorAddr);
    } catch {
      setDemoNgoAddress(null);
      setDemoVendorAddress(null);
    }
  };

  useEffect(() => {
    refreshDemoAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ngoPrivateKey, vendorPrivateKey]);

  const loadConnectedNgo = async () => {
    if (!contract || !account) {
      setConnectedNgo(null);
      return;
    }
    try {
      const ngo = await contract.getNGO(account);
      if (ngo.exists) {
        setConnectedNgo({
          exists: true,
          status: Number(ngo.status),
          name: ngo.name,
          wallet: ngo.wallet
        });
      } else {
        setConnectedNgo({ exists: false });
      }
    } catch (e) {
      console.error(e);
      setConnectedNgo(null);
    }
  };

  useEffect(() => {
    loadConnectedNgo();
  }, [contract, account]);

  const registerBeneficiaryDemo = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as admin first (MetaMask).");
      return;
    }
    if (!ngoPrivateKey) {
      setError("Paste NGO private key for Demo Mode.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const provider = getLocalRpcProvider();
      const ngoWallet = new ethers.Wallet(ngoPrivateKey, provider);
      const ngoContract = contract.connect(ngoWallet);

      const hash = ethers.keccak256(ethers.toUtf8Bytes(aadhaar));
      const tx = await ngoContract.registerBeneficiary(
        Number(regCampaignId),
        hash,
        pincode
      );
      const receipt = await tx.wait();

      setMessage(
        `Beneficiary registered (Demo Mode, NGO signer). Tx ${receipt.hash.slice(
          0,
          10
        )}...`
      );
      setAadhaar("");
      setPincode("");
    } catch (e) {
      console.error(e);
      setError(
        e.message ||
          "Failed to register beneficiary (Demo Mode). Make sure NGO is Activated by admin."
      );
    } finally {
      setLoading(false);
    }
  };

  const redeemOtpDemo = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as admin first (MetaMask).");
      return;
    }
    if (!vendorPrivateKey) {
      setError("Paste vendor private key for Demo Mode.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const provider = getLocalRpcProvider();
      const vendorWallet = new ethers.Wallet(vendorPrivateKey, provider);
      const vendorContract = contract.connect(vendorWallet);

      const tx = await vendorContract.redeemOTP(Number(demoOtp));
      const receipt = await tx.wait();
      setMessage(
        `OTP redeemed (Demo Mode, vendor signer). Tx ${receipt.hash.slice(
          0,
          10
        )}...`
      );
      setDemoOtp("");
    } catch (e) {
      console.error(e);
      setError(
        e.message ||
          "Failed to redeem OTP (Demo Mode). Make sure vendor is whitelisted."
      );
    } finally {
      setLoading(false);
    }
  };

  const registerBeneficiary = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as NGO wallet first.");
      return;
    }
    if (connectedNgo && connectedNgo.exists && connectedNgo.status !== 1) {
      setError(
        "This wallet is an NGO but not Active. Ask admin to Activate it first."
      );
      return;
    }
    if (connectedNgo && connectedNgo.exists === false) {
      setError(
        "This wallet is not registered as an NGO. Switch to the NGO wallet you registered, or register it in NGO Management."
      );
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const hash = ethers.keccak256(ethers.toUtf8Bytes(aadhaar));
      const tx = await contract.registerBeneficiary(
        Number(regCampaignId),
        hash,
        pincode
      );
      const receipt = await tx.wait();
      const txHash = receipt.hash;
      setMessage(
        `Beneficiary registered. Tx ${txHash.slice(
          0,
          10
        )}... Note the index from getBeneficiaries().`
      );
      setAadhaar("");
      setPincode("");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to register beneficiary");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as admin first.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const tx = await contract.approveBeneficiary(
        Number(approveCampaignId),
        Number(beneficiaryIndex),
        ethers.parseEther(allocationEth || "0")
      );
      const receipt = await tx.wait();
      setMessage(
        `Beneficiary approved. Tx ${receipt.hash.slice(0, 10)}...`
      );
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to approve beneficiary");
    } finally {
      setLoading(false);
    }
  };

  const issueOtp = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as admin first.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      setIssuedOtp(null);
      const tx = await contract.issueOTP(
        Number(otpCampaignId),
        Number(otpBeneficiaryIndex)
      );
      const receipt = await tx.wait();

      const otpEvent = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((ev) => ev && ev.name === "OTPIssued");

      if (otpEvent) {
        const otp = Number(otpEvent.args.otp);
        setIssuedOtp(otp);
        setMessage(
          `OTP issued: ${otp}. Tx ${receipt.hash.slice(0, 10)}...`
        );
      } else {
        setMessage(
          `OTP issued. Tx ${receipt.hash.slice(
            0,
            10
          )}... (could not parse event)`
        );
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to issue OTP");
    } finally {
      setLoading(false);
    }
  };

  const whitelistVendor = async (e) => {
    e.preventDefault();
    if (!contract) {
      setError("Connect as admin first.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const tx = await contract.whitelistVendor(vendorAddress);
      const receipt = await tx.wait();
      setMessage(
        `Vendor whitelisted. Tx ${receipt.hash.slice(0, 10)}...`
      );
      setVendorAddress("");
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to whitelist vendor");
    } finally {
      setLoading(false);
    }
  };

  const loadBeneficiaries = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      setError(null);
      const list = await contract.getBeneficiaries(
        Number(beneficiariesCampaignId)
      );
      setBeneficiaries(list);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load beneficiaries");
    } finally {
      setLoading(false);
    }
  };

  const copyOtp = () => {
    if (issuedOtp) {
      navigator.clipboard.writeText(String(issuedOtp));
    }
  };

  return (
    <section className="card">
      <h2>Beneficiary and OTP Management</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="card-header">
        <div className="muted-text">
          Keep it simple: stay on Admin wallet, use Demo Mode for NGO/Vendor.
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setDemoMode((v) => !v)}
        >
          Demo Mode: {demoMode ? "On" : "Off"}
        </button>
      </div>

      {demoMode ? (
        <div className="alert alert-warning small">
          <strong>Demo Mode</strong> uses Hardhat local private keys to sign NGO
          and Vendor transactions without switching MetaMask accounts. Use only
          on localhost.
        </div>
      ) : (
        account && (
          <div className="alert alert-warning small">
            Connected wallet: {account.slice(0, 6)}...{account.slice(-4)}.{" "}
            {connectedNgo
              ? connectedNgo.exists
                ? `NGO status: ${
                    connectedNgo.status === 0
                      ? "Pending"
                      : connectedNgo.status === 1
                      ? "Active"
                      : "Suspended"
                  }.`
                : "Not registered as NGO."
              : "Checking NGO status..."}
          </div>
        )
      )}

      <div className="subsection-grid">
        <form
          onSubmit={demoMode ? registerBeneficiaryDemo : registerBeneficiary}
          className="form-grid"
        >
          <h3>
            Register Beneficiary {demoMode ? "(Admin-run Demo Mode)" : "(NGO)"}
          </h3>
          <div className="form-row">
            <label>Campaign ID</label>
            <input
              value={regCampaignId}
              onChange={(e) => setRegCampaignId(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>Aadhaar (text)</label>
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
          {demoMode && (
            <>
              <div className="form-row">
                <label>NGO Private Key (Hardhat)</label>
                <input
                  value={ngoPrivateKey}
                  onChange={(e) => setNgoPrivateKey(e.target.value.trim())}
                  placeholder="0x..."
                />
                {demoNgoAddress && (
                  <div className="muted-text small">
                    NGO Address: {demoNgoAddress.slice(0, 6)}...
                    {demoNgoAddress.slice(-4)}
                  </div>
                )}
              </div>
            </>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Submitting..." : "Register Beneficiary"}
          </button>
        </form>

        <form onSubmit={approve} className="form-grid">
          <h3>Approve Beneficiary (Admin)</h3>
          <div className="form-row">
            <label>Campaign ID</label>
            <input
              value={approveCampaignId}
              onChange={(e) => setApproveCampaignId(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>Beneficiary Index</label>
            <input
              value={beneficiaryIndex}
              onChange={(e) => setBeneficiaryIndex(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>Allocation (ETH)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={allocationEth}
              onChange={(e) => setAllocationEth(e.target.value)}
              required
            />
          </div>
          <button className="primary-button" disabled={loading}>
            {loading ? "Approving..." : "Approve Beneficiary"}
          </button>
        </form>
      </div>

      <div className="subsection-grid">
        <form onSubmit={issueOtp} className="form-grid">
          <h3>Issue OTP (Admin)</h3>
          <div className="form-row">
            <label>Campaign ID</label>
            <input
              value={otpCampaignId}
              onChange={(e) => setOtpCampaignId(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>Beneficiary Index</label>
            <input
              value={otpBeneficiaryIndex}
              onChange={(e) => setOtpBeneficiaryIndex(e.target.value)}
              required
            />
          </div>
          <button className="primary-button" disabled={loading}>
            {loading ? "Issuing..." : "Issue OTP"}
          </button>
          {issuedOtp && (
            <div className="otp-display">
              <div className="otp-label">OTP for victim:</div>
              <div className="otp-value">{issuedOtp}</div>
              <button
                type="button"
                className="secondary-button"
                onClick={copyOtp}
              >
                Copy OTP
              </button>
              <p className="muted-text">
                Print this number and give to victim.
              </p>
            </div>
          )}
        </form>

        <form onSubmit={whitelistVendor} className="form-grid">
          <h3>Whitelist Vendor (Admin)</h3>
          <div className="form-row">
            <label>Vendor Wallet Address</label>
            <input
              value={vendorAddress}
              onChange={(e) => setVendorAddress(e.target.value)}
              placeholder="0x..."
              required
            />
          </div>
          <button className="primary-button" disabled={loading}>
            {loading ? "Whitelisting..." : "Whitelist Vendor"}
          </button>
          <p className="muted-text small">
            Use the vendor’s connected MetaMask address. Vendors can only redeem
            OTPs after being whitelisted.
          </p>
        </form>

        {demoMode && (
          <form onSubmit={redeemOtpDemo} className="form-grid">
            <h3>Redeem OTP (Admin-run Demo Mode)</h3>
            <div className="form-row">
              <label>OTP</label>
              <input
                value={demoOtp}
                onChange={(e) => setDemoOtp(e.target.value)}
                placeholder="6-digit OTP"
                required
              />
            </div>
            <div className="form-row">
              <label>Vendor Private Key (Hardhat)</label>
              <input
                value={vendorPrivateKey}
                onChange={(e) => setVendorPrivateKey(e.target.value.trim())}
                placeholder="0x..."
              />
              {demoVendorAddress && (
                <div className="muted-text small">
                  Vendor Address: {demoVendorAddress.slice(0, 6)}...
                  {demoVendorAddress.slice(-4)}
                </div>
              )}
            </div>
            <button className="primary-button" disabled={loading}>
              {loading ? "Redeeming..." : "Redeem OTP"}
            </button>
          </form>
        )}

        <div className="form-grid">
          <h3>View Beneficiaries</h3>
          <div className="form-row">
            <label>Campaign ID</label>
            <input
              value={beneficiariesCampaignId}
              onChange={(e) => setBeneficiariesCampaignId(e.target.value)}
            />
          </div>
          <button
            className="secondary-button"
            onClick={loadBeneficiaries}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load Beneficiaries"}
          </button>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Index</th>
                  <th>Pincode</th>
                  <th>Approved</th>
                  <th>Claimed</th>
                  <th>Allocated (ETH)</th>
                  <th>Registered By NGO</th>
                </tr>
              </thead>
              <tbody>
                {beneficiaries.map((b, idx) => (
                  <tr key={idx}>
                    <td>{idx}</td>
                    <td>{b.pincode}</td>
                    <td>{b.approved ? "Yes" : "No"}</td>
                    <td>{b.claimed ? "Yes" : "No"}</td>
                    <td>{ethers.formatEther(b.allocatedAmount)}</td>
                    <td>
                      {b.registeredByNGO
                        ? `${b.registeredByNGO.slice(
                            0,
                            6
                          )}...${b.registeredByNGO.slice(-4)}`
                        : "-"}
                    </td>
                  </tr>
                ))}
                {beneficiaries.length === 0 && (
                  <tr>
                    <td colSpan="6" className="muted-text">
                      No beneficiaries loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

