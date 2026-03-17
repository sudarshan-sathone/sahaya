import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("ReliefPool", function () {
  async function deployFixture() {
    const [admin, ngoWallet, donor, vendor, other] = await ethers.getSigners();

    const ReliefPool = await ethers.getContractFactory("ReliefPool");
    const reliefPool = await ReliefPool.deploy();
    await reliefPool.waitForDeployment();

    return { reliefPool, admin, ngoWallet, donor, vendor, other };
  }

  describe("Deployment", function () {
    it("sets admin correctly", async function () {
      const { reliefPool, admin } = await deployFixture();
      expect(await reliefPool.admin()).to.equal(admin.address);
    });
  });

  describe("NGO Management", function () {
    it("registers NGO correctly", async function () {
      const { reliefPool, ngoWallet } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );

      const ngo = await reliefPool.getNGO(ngoWallet.address);
      expect(ngo.exists).to.equal(true);
      expect(ngo.name).to.equal("Helping Hands");
    });

    it("rejects duplicate NGO registration", async function () {
      const { reliefPool, ngoWallet } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );

      await expect(
        reliefPool.registerNGO(ngoWallet.address, "Other", "REG999")
      ).to.be.revertedWith("NGO already registered");
    });

    it("updates NGO status to Active", async function () {
      const { reliefPool, ngoWallet } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );

      await reliefPool.updateNGOStatus(
        ngoWallet.address,
        1 // NGOStatus.Active
      );

      const ngo = await reliefPool.getNGO(ngoWallet.address);
      expect(ngo.status).to.equal(1);
    });

    it("rejects suspended NGO from registering beneficiary", async function () {
      const { reliefPool, ngoWallet } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );

      await reliefPool.updateNGOStatus(
        ngoWallet.address,
        2 // NGOStatus.Suspended
      );

      await expect(
        reliefPool
          .connect(ngoWallet)
          .registerBeneficiary(1, ethers.keccak256(ethers.toUtf8Bytes("aadhaar1")), "452001")
      ).to.be.revertedWith("NGO not active");
    });
  });

  describe("Campaign Lifecycle", function () {
    async function setupCampaign() {
      const { reliefPool, ngoWallet, donor } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );
      await reliefPool.updateNGOStatus(ngoWallet.address, 1);

      await reliefPool.createCampaign(
        "Flood Relief",
        0, // Flood
        ethers.parseEther("10"),
        30,
        "QmDoc"
      );

      return { reliefPool, ngoWallet, donor };
    }

    it("creates campaign with Pending status", async function () {
      const { reliefPool } = await setupCampaign();
      const campaign = await reliefPool.getCampaign(1);
      expect(campaign.status).to.equal(0); // Pending
      expect(campaign.documentHash).to.equal("QmDoc");
    });

    it("verifies campaign changes status to Active", async function () {
      const { reliefPool } = await setupCampaign();
      await reliefPool.verifyCampaign(1);
      const campaign = await reliefPool.getCampaign(1);
      expect(campaign.status).to.equal(2); // Active
    });

    it("rejects donation to Pending campaign", async function () {
      const { reliefPool, donor } = await setupCampaign();

      await expect(
        reliefPool
          .connect(donor)
          .donate(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Campaign not active");
    });

    it("accepts donation to Active campaign", async function () {
      const { reliefPool, donor } = await setupCampaign();

      await reliefPool.verifyCampaign(1);

      await reliefPool
        .connect(donor)
        .donate(1, { value: ethers.parseEther("1") });

      const campaign = await reliefPool.getCampaign(1);
      expect(campaign.raisedAmount).to.equal(ethers.parseEther("1"));
    });

    it("flags inactive campaign after 7 days", async function () {
      const { reliefPool } = await setupCampaign();

      await reliefPool.verifyCampaign(1);

      // fast forward > 7 days
      const sevenDays = 7 * 24 * 60 * 60;
      await ethers.provider.send("evm_increaseTime", [sevenDays + 1]);
      await ethers.provider.send("evm_mine", []);

      await reliefPool.flagInactiveCampaign(1);
      const campaign = await reliefPool.getCampaign(1);
      expect(campaign.status).to.equal(3); // Flagged
    });
  });

  describe("Campaign Authenticity", function () {
    it("stores documentHash correctly", async function () {
      const { reliefPool } = await deployFixture();

      await reliefPool.createCampaign(
        "Earthquake Relief",
        1,
        ethers.parseEther("5"),
        10,
        "DocHash123"
      );

      const campaign = await reliefPool.getCampaign(1);
      expect(campaign.documentHash).to.equal("DocHash123");
    });

    it("rejects campaign flagging before inactive period", async function () {
      const { reliefPool } = await deployFixture();

      await reliefPool.createCampaign(
        "Earthquake Relief",
        1,
        ethers.parseEther("5"),
        10,
        "DocHash123"
      );
      await reliefPool.verifyCampaign(1);

      await expect(
        reliefPool.flagInactiveCampaign(1)
      ).to.be.revertedWith("Campaign still active");
    });
  });

  describe("Beneficiary and OTP Flow", function () {
    async function setupFullFlow() {
      const { reliefPool, ngoWallet, donor, vendor } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );
      await reliefPool.updateNGOStatus(ngoWallet.address, 1);

      await reliefPool.createCampaign(
        "Flood Relief",
        0,
        ethers.parseEther("10"),
        30,
        "QmDoc"
      );
      await reliefPool.verifyCampaign(1);

      await reliefPool
        .connect(donor)
        .donate(1, { value: ethers.parseEther("5") });

      await reliefPool
        .connect(ngoWallet)
        .registerBeneficiary(
          1,
          ethers.keccak256(ethers.toUtf8Bytes("aadhaar1")),
          "452001"
        );

      await reliefPool.approveBeneficiary(
        1,
        0,
        ethers.parseEther("1")
      );

      await reliefPool.whitelistVendor(vendor.address);

      return { reliefPool, ngoWallet, donor, vendor };
    }

    it("rejects duplicate aadhaar registration", async function () {
      const { reliefPool, ngoWallet } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );
      await reliefPool.updateNGOStatus(ngoWallet.address, 1);

      const hash = ethers.keccak256(ethers.toUtf8Bytes("aadhaar1"));

      await reliefPool
        .connect(ngoWallet)
        .registerBeneficiary(1, hash, "452001");

      await expect(
        reliefPool
          .connect(ngoWallet)
          .registerBeneficiary(1, hash, "452001")
      ).to.be.revertedWith("Aadhaar already used");
    });

    it("completes full flow and vendor receives funds", async function () {
      const { reliefPool, vendor } = await setupFullFlow();

      const beneficiaries = await reliefPool.getBeneficiaries(1);
      expect(beneficiaries.length).to.equal(1);

      const beforeBalance = await ethers.provider.getBalance(vendor.address);

      const tx = await reliefPool.issueOTP(1, 0);
      const receipt = await tx.wait();

      const otpEvent = receipt.logs
        .map((log) => {
          try {
            return reliefPool.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((parsed) => parsed && parsed.name === "OTPIssued")[0];

      const otp = otpEvent.args.otp;
      const amount = otpEvent.args.amount;

      await reliefPool.connect(vendor).redeemOTP(otp);

      const afterBalance = await ethers.provider.getBalance(vendor.address);
      expect(afterBalance).to.be.gt(beforeBalance);

      const ngoActivity = await reliefPool.getNGOActivity(
        beneficiaries[0].registeredByNGO
      );
      expect(ngoActivity.totalRedeemed).to.equal(1n);

      const campaign = await reliefPool.getCampaign(1);
      expect(campaign.redeemedCount).to.equal(1);
      expect(campaign.beneficiaryCount).to.equal(1);
    });
  });

  describe("Transaction Monitoring", function () {
    it("logs transaction on donation", async function () {
      const { reliefPool, donor } = await deployFixture();

      await reliefPool.createCampaign(
        "Flood Relief",
        0,
        ethers.parseEther("10"),
        30,
        "QmDoc"
      );
      await reliefPool.verifyCampaign(1);

      await reliefPool
        .connect(donor)
        .donate(1, { value: ethers.parseEther("1") });

      const txs = await reliefPool.getCampaignTransactions(1);
      const donationTx = txs.find(
        (t) => t.actionType === "donation"
      );
      expect(donationTx).to.not.equal(undefined);
      expect(donationTx.amount).to.equal(ethers.parseEther("1"));
    });

    it("logs transaction on OTP redemption and returns all transactions", async function () {
      const { reliefPool, ngoWallet, donor, vendor } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );
      await reliefPool.updateNGOStatus(ngoWallet.address, 1);

      await reliefPool.createCampaign(
        "Flood Relief",
        0,
        ethers.parseEther("10"),
        30,
        "QmDoc"
      );
      await reliefPool.verifyCampaign(1);

      await reliefPool
        .connect(donor)
        .donate(1, { value: ethers.parseEther("5") });

      await reliefPool
        .connect(ngoWallet)
        .registerBeneficiary(
          1,
          ethers.keccak256(ethers.toUtf8Bytes("aadhaar1")),
          "452001"
        );

      await reliefPool.approveBeneficiary(
        1,
        0,
        ethers.parseEther("1")
      );

      await reliefPool.whitelistVendor(vendor.address);

      const tx = await reliefPool.issueOTP(1, 0);
      const receipt = await tx.wait();
      const otpEvent = receipt.logs
        .map((log) => {
          try {
            return reliefPool.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((parsed) => parsed && parsed.name === "OTPIssued")[0];

      const otp = otpEvent.args.otp;

      await reliefPool.connect(vendor).redeemOTP(otp);

      const campaignTxs = await reliefPool.getCampaignTransactions(1);
      const redemptionTx = campaignTxs.find(
        (t) => t.actionType === "otp_redeemed"
      );
      expect(redemptionTx).to.not.equal(undefined);

      const allTxs = await reliefPool.getAllTransactions();
      expect(allTxs.length).to.be.greaterThan(0);
    });
  });

  describe("Admin Stats", function () {
    it("returns correct getAllCampaignStats values", async function () {
      const { reliefPool, ngoWallet, donor } = await deployFixture();

      await reliefPool.registerNGO(
        ngoWallet.address,
        "Helping Hands",
        "REG123"
      );
      await reliefPool.updateNGOStatus(ngoWallet.address, 1);

      await reliefPool.createCampaign(
        "Flood Relief",
        0,
        ethers.parseEther("10"),
        30,
        "QmDoc"
      );
      await reliefPool.createCampaign(
        "Earthquake Relief",
        1,
        ethers.parseEther("20"),
        60,
        "QmDoc2"
      );

      await reliefPool.verifyCampaign(1);

      await reliefPool
        .connect(donor)
        .donate(1, { value: ethers.parseEther("3") });

      await reliefPool
        .connect(ngoWallet)
        .registerBeneficiary(
          1,
          ethers.keccak256(ethers.toUtf8Bytes("aadhaar1")),
          "452001"
        );

      await reliefPool.approveBeneficiary(
        1,
        0,
        ethers.parseEther("1")
      );

      await reliefPool.whitelistVendor(donor.address);
      const tx = await reliefPool.issueOTP(1, 0);
      const receipt = await tx.wait();
      const otpEvent = receipt.logs
        .map((log) => {
          try {
            return reliefPool.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .filter((parsed) => parsed && parsed.name === "OTPIssued")[0];

      const otp = otpEvent.args.otp;
      await reliefPool.connect(donor).redeemOTP(otp);

      const [
        totalCampaigns,
        activeCampaigns,
        totalRaised,
        totalBeneficiaries,
        totalRedeemed
      ] = await reliefPool.getAllCampaignStats();

      expect(totalCampaigns).to.equal(2);
      expect(activeCampaigns).to.equal(1);
      expect(totalRaised).to.equal(ethers.parseEther("3"));
      expect(totalBeneficiaries).to.equal(1);
      expect(totalRedeemed).to.equal(1);
    });
  });
});

