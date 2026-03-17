// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReliefPool {
    enum DisasterType {
        Flood,
        Earthquake,
        Cyclone,
        Drought,
        Fire,
        Pandemic,
        Other
    }

    enum CampaignStatus {
        Pending,
        Verified,
        Active,
        Flagged,
        Closed
    }

    enum NGOStatus {
        Pending,
        Active,
        Suspended
    }

    struct Campaign {
        uint256 id;
        string name;
        DisasterType disasterType;
        CampaignStatus status;
        uint256 targetAmount;
        uint256 raisedAmount;
        uint256 expiry;
        uint256 createdAt;
        uint256 lastActivityAt;
        string documentHash;
        address createdBy;
        uint256 beneficiaryCount;
        uint256 redeemedCount;
        string description;
        string imageURL;
    }

    struct NGO {
        uint256 id;
        address wallet;
        string name;
        string registrationNumber;
        NGOStatus status;
        uint256 registeredAt;
        uint256 totalRegistered;
        uint256 totalApproved;
        uint256 totalRedeemed;
        bool exists;
    }

    struct Beneficiary {
        uint256 id;
        bytes32 aadhaarHash;
        string pincode;
        uint256 campaignId;
        uint256 allocatedAmount;
        bool approved;
        bool claimed;
        address registeredByNGO;
        uint256 registeredAt;
    }

    struct OTPVoucher {
        uint256 otp;
        uint256 beneficiaryId;
        uint256 campaignId;
        uint256 amount;
        bool used;
        uint256 createdAt;
        address redeemedBy;
        uint256 redeemedAt;
    }

    struct Transaction {
        uint256 id;
        address actor;
        string actionType;
        uint256 campaignId;
        uint256 amount;
        uint256 timestamp;
    }

    address public admin;
    address public verifier;
    uint256 public campaignCount;
    uint256 public beneficiaryCount;
    uint256 public ngoCount;
    uint256 public transactionCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Beneficiary[]) public campaignBeneficiaries;
    mapping(uint256 => OTPVoucher) public otpVouchers;
    mapping(address => bool) public isWhitelistedVendor;
    mapping(bytes32 => bool) public aadhaarUsed;
    mapping(address => NGO) public ngoByWallet;
    mapping(uint256 => NGO) public ngoById;
    mapping(uint256 => Transaction[]) public campaignTransactions;

    Campaign[] public allCampaignsArray;
    Transaction[] public allTransactions;

    uint256 public constant INACTIVE_DAYS = 7;
    uint256 public constant FLAG_THRESHOLD = 5;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier, "Only verifier");
        _;
    }

    modifier onlyWhitelistedVendor() {
        require(isWhitelistedVendor[msg.sender], "Not a whitelisted vendor");
        _;
    }

    modifier onlyActiveNGO() {
        require(ngoByWallet[msg.sender].exists, "NGO not registered");
        require(
            ngoByWallet[msg.sender].status == NGOStatus.Active,
            "NGO not active"
        );
        _;
    }

    modifier campaignExists(uint256 id) {
        require(id > 0 && id <= campaignCount, "Campaign does not exist");
        _;
    }

    modifier campaignActive(uint256 id) {
        require(
            campaigns[id].status == CampaignStatus.Active,
            "Campaign not active"
        );
        require(block.timestamp < campaigns[id].expiry, "Campaign expired");
        _;
    }

    event CampaignCreated(
        uint256 indexed id,
        string name,
        DisasterType disasterType,
        address createdBy
    );
    event CampaignVerified(uint256 indexed id, address verifiedBy);
    event CampaignFlagged(uint256 indexed id, string reason);
    event CampaignClosed(uint256 indexed id);
    event DonationReceived(
        address indexed donor,
        uint256 amount,
        uint256 indexed campaignId,
        uint256 timestamp
    );
    event VendorWhitelisted(address indexed vendor);
    event NGORegistered(uint256 indexed id, address wallet, string name);
    event NGOStatusUpdated(address indexed wallet, NGOStatus status);
    event BeneficiaryRegistered(
        uint256 indexed campaignId,
        uint256 beneficiaryIndex,
        address registeredByNGO
    );
    event BeneficiaryApproved(
        uint256 indexed campaignId,
        uint256 beneficiaryIndex,
        uint256 amount
    );
    event OTPIssued(
        uint256 otp,
        uint256 indexed beneficiaryId,
        uint256 indexed campaignId,
        uint256 amount
    );
    event OTPRedeemed(
        uint256 otp,
        address indexed vendor,
        uint256 amount,
        uint256 timestamp
    );
    event FundsWithdrawn(uint256 indexed campaignId, uint256 amount);
    event TransactionLogged(
        uint256 indexed campaignId,
        address actor,
        string actionType,
        uint256 amount
    );

    constructor() {
        admin = msg.sender;
    }

    function setVerifier(address _verifier) external onlyAdmin {
        require(_verifier != address(0), "Invalid address");
        verifier = _verifier;
    }

    function registerNGO(
        address wallet,
        string memory name,
        string memory registrationNumber
    ) external onlyAdmin {
        require(wallet != address(0), "Invalid wallet");
        require(!ngoByWallet[wallet].exists, "NGO already registered");

        ngoCount++;

        NGO memory ngo = NGO({
            id: ngoCount,
            wallet: wallet,
            name: name,
            registrationNumber: registrationNumber,
            status: NGOStatus.Pending,
            registeredAt: block.timestamp,
            totalRegistered: 0,
            totalApproved: 0,
            totalRedeemed: 0,
            exists: true
        });

        ngoByWallet[wallet] = ngo;
        ngoById[ngoCount] = ngo;

        emit NGORegistered(ngoCount, wallet, name);
    }

    function updateNGOStatus(address wallet, NGOStatus status)
        external
        onlyAdmin
    {
        require(ngoByWallet[wallet].exists, "NGO not registered");

        ngoByWallet[wallet].status = status;
        ngoById[ngoByWallet[wallet].id].status = status;

        emit NGOStatusUpdated(wallet, status);
    }

    function createCampaign(
        string memory name,
        DisasterType dtype,
        uint256 targetAmount,
        uint256 expiryDays,
        string memory documentHash,
        string memory description,
        string memory imageURL
    ) external onlyAdmin {
        campaignCount++;

        uint256 expiry = block.timestamp + (expiryDays * 1 days);

        Campaign memory campaign = Campaign({
            id: campaignCount,
            name: name,
            disasterType: dtype,
            status: CampaignStatus.Pending,
            targetAmount: targetAmount,
            raisedAmount: 0,
            expiry: expiry,
            createdAt: block.timestamp,
            lastActivityAt: block.timestamp,
            documentHash: documentHash,
            createdBy: msg.sender,
            beneficiaryCount: 0,
            redeemedCount: 0,
            description: "",
            imageURL: ""
        });

        campaigns[campaignCount] = campaign;
        campaigns[campaignCount].description = description;
        campaigns[campaignCount].imageURL = imageURL;
        allCampaignsArray.push(campaigns[campaignCount]);

        _logTransaction(campaignCount, msg.sender, "campaign_created", 0);

        emit CampaignCreated(campaignCount, name, dtype, msg.sender);
    }

    function verifyCampaign(uint256 campaignId)
        external
        onlyVerifier
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];
        require(
            campaign.status == CampaignStatus.Pending,
            "Campaign not pending"
        );

        campaign.status = CampaignStatus.Active;
        campaign.lastActivityAt = block.timestamp;

        _updateCampaignInArray(campaignId);

        _logTransaction(campaignId, msg.sender, "campaign_verified", 0);

        emit CampaignVerified(campaignId, msg.sender);
    }

    function donate(uint256 campaignId)
        external
        payable
        campaignExists(campaignId)
        campaignActive(campaignId)
    {
        require(msg.value > 0, "Zero donation");

        Campaign storage campaign = campaigns[campaignId];
        campaign.raisedAmount += msg.value;
        campaign.lastActivityAt = block.timestamp;

        _updateCampaignInArray(campaignId);

        _logTransaction(campaignId, msg.sender, "donation", msg.value);

        emit DonationReceived(
            msg.sender,
            msg.value,
            campaignId,
            block.timestamp
        );
    }

    function whitelistVendor(address vendor) external onlyAdmin {
        require(vendor != address(0), "Invalid vendor");

        isWhitelistedVendor[vendor] = true;

        emit VendorWhitelisted(vendor);
    }

    function registerBeneficiary(
        uint256 campaignId,
        bytes32 aadhaarHash,
        string memory pincode
    )
        external
        onlyActiveNGO
        campaignExists(campaignId)
        campaignActive(campaignId)
    {
        require(!aadhaarUsed[aadhaarHash], "Aadhaar already used");

        aadhaarUsed[aadhaarHash] = true;

        beneficiaryCount++;

        Beneficiary memory beneficiary = Beneficiary({
            id: beneficiaryCount,
            aadhaarHash: aadhaarHash,
            pincode: pincode,
            campaignId: campaignId,
            allocatedAmount: 0,
            approved: false,
            claimed: false,
            registeredByNGO: msg.sender,
            registeredAt: block.timestamp
        });

        campaignBeneficiaries[campaignId].push(beneficiary);

        Campaign storage campaign = campaigns[campaignId];
        campaign.beneficiaryCount++;
        campaign.lastActivityAt = block.timestamp;

        _updateCampaignInArray(campaignId);

        NGO storage ngo = ngoByWallet[msg.sender];
        ngo.totalRegistered++;
        ngoById[ngo.id].totalRegistered++;

        _logTransaction(
            campaignId,
            msg.sender,
            "beneficiary_registered",
            0
        );

        emit BeneficiaryRegistered(
            campaignId,
            campaignBeneficiaries[campaignId].length - 1,
            msg.sender
        );
    }

    function approveBeneficiary(
        uint256 campaignId,
        uint256 beneficiaryIndex,
        uint256 amount
    ) external onlyAdmin campaignExists(campaignId) {
        require(
            beneficiaryIndex < campaignBeneficiaries[campaignId].length,
            "Invalid beneficiary index"
        );
        require(amount > 0, "Amount must be > 0");

        Beneficiary storage beneficiary = campaignBeneficiaries[campaignId][
            beneficiaryIndex
        ];

        require(!beneficiary.approved, "Already approved");

        beneficiary.approved = true;
        beneficiary.allocatedAmount = amount;

        NGO storage ngo = ngoByWallet[beneficiary.registeredByNGO];
        if (ngo.exists) {
            ngo.totalApproved++;
            ngoById[ngo.id].totalApproved++;
        }

        _logTransaction(
            campaignId,
            msg.sender,
            "beneficiary_approved",
            amount
        );

        emit BeneficiaryApproved(campaignId, beneficiaryIndex, amount);
    }

    function issueOTP(uint256 campaignId, uint256 beneficiaryIndex)
        external
        onlyAdmin
        campaignExists(campaignId)
    {
        require(
            beneficiaryIndex < campaignBeneficiaries[campaignId].length,
            "Invalid beneficiary index"
        );

        Beneficiary storage beneficiary = campaignBeneficiaries[campaignId][
            beneficiaryIndex
        ];

        require(beneficiary.approved, "Beneficiary not approved");
        require(!beneficiary.claimed, "Already claimed");
        require(beneficiary.allocatedAmount > 0, "No allocated amount");

        uint256 otp = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    beneficiaryIndex,
                    campaignId,
                    msg.sender
                )
            )
        ) % 1000000;

        if (otp == 0) {
            otp = 1;
        }

        require(otpVouchers[otp].otp == 0, "OTP already exists");

        OTPVoucher memory voucher = OTPVoucher({
            otp: otp,
            beneficiaryId: beneficiary.id,
            campaignId: campaignId,
            amount: beneficiary.allocatedAmount,
            used: false,
            createdAt: block.timestamp,
            redeemedBy: address(0),
            redeemedAt: 0
        });

        otpVouchers[otp] = voucher;

        Campaign storage campaign = campaigns[campaignId];
        campaign.lastActivityAt = block.timestamp;

        _updateCampaignInArray(campaignId);

        _logTransaction(campaignId, msg.sender, "otp_issued", voucher.amount);

        emit OTPIssued(otp, beneficiary.id, campaignId, voucher.amount);
    }

    function redeemOTP(uint256 otp) external onlyWhitelistedVendor {
        OTPVoucher storage voucher = otpVouchers[otp];
        require(voucher.otp != 0, "Invalid OTP");
        require(!voucher.used, "OTP already used");

        uint256 campaignId = voucher.campaignId;
        Campaign storage campaign = campaigns[campaignId];

        require(
            campaign.status == CampaignStatus.Active,
            "Campaign not active"
        );

        voucher.used = true;
        voucher.redeemedBy = msg.sender;
        voucher.redeemedAt = block.timestamp;

        // find beneficiary in campaign array by global id
        Beneficiary[] storage list = campaignBeneficiaries[campaignId];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].id == voucher.beneficiaryId) {
                list[i].claimed = true;

                NGO storage ngo = ngoByWallet[list[i].registeredByNGO];
                if (ngo.exists) {
                    ngo.totalRedeemed++;
                    ngoById[ngo.id].totalRedeemed++;
                }

                break;
            }
        }

        campaign.redeemedCount++;
        campaign.lastActivityAt = block.timestamp;

        uint256 amount = voucher.amount;
        require(address(this).balance >= amount, "Insufficient contract balance");

        _updateCampaignInArray(campaignId);

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");

        _logTransaction(campaignId, msg.sender, "otp_redeemed", amount);

        emit OTPRedeemed(otp, msg.sender, amount, block.timestamp);
    }

    function flagInactiveCampaign(uint256 campaignId)
        external
        onlyAdmin
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];
        require(
            campaign.status == CampaignStatus.Active,
            "Campaign not active"
        );
        require(
            block.timestamp >
                campaign.lastActivityAt + (INACTIVE_DAYS * 1 days),
            "Campaign still active"
        );

        campaign.status = CampaignStatus.Flagged;

        _updateCampaignInArray(campaignId);

        emit CampaignFlagged(campaignId, "No activity for 7 days");
    }

    function withdrawExpiredFunds(uint256 campaignId)
        external
        onlyAdmin
        campaignExists(campaignId)
    {
        Campaign storage campaign = campaigns[campaignId];
        require(block.timestamp > campaign.expiry, "Campaign not expired");

        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");

        campaign.status = CampaignStatus.Closed;

        _updateCampaignInArray(campaignId);

        (bool sent, ) = payable(admin).call{value: balance}("");
        require(sent, "Withdraw failed");

        emit FundsWithdrawn(campaignId, balance);
        emit CampaignClosed(campaignId);
    }

    function _logTransaction(
        uint256 campaignId,
        address actor,
        string memory actionType,
        uint256 amount
    ) internal {
        transactionCount++;

        Transaction memory txInfo = Transaction({
            id: transactionCount,
            actor: actor,
            actionType: actionType,
            campaignId: campaignId,
            amount: amount,
            timestamp: block.timestamp
        });

        campaignTransactions[campaignId].push(txInfo);
        allTransactions.push(txInfo);

        emit TransactionLogged(campaignId, actor, actionType, amount);
    }

    function _updateCampaignInArray(uint256 campaignId) internal {
        // keep allCampaignsArray in sync for analytics
        for (uint256 i = 0; i < allCampaignsArray.length; i++) {
            if (allCampaignsArray[i].id == campaignId) {
                allCampaignsArray[i] = campaigns[campaignId];
                break;
            }
        }
    }

    function getCampaign(uint256 id)
        external
        view
        campaignExists(id)
        returns (Campaign memory)
    {
        return campaigns[id];
    }

    function getAllCampaigns() external view returns (Campaign[] memory) {
        return allCampaignsArray;
    }

    function getBeneficiaries(uint256 campaignId)
        external
        view
        returns (Beneficiary[] memory)
    {
        return campaignBeneficiaries[campaignId];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getCampaignTransactions(uint256 campaignId)
        external
        view
        returns (Transaction[] memory)
    {
        return campaignTransactions[campaignId];
    }

    function getAllTransactions()
        external
        view
        returns (Transaction[] memory)
    {
        return allTransactions;
    }

    function getNGO(address wallet) external view returns (NGO memory) {
        return ngoByWallet[wallet];
    }

    function getAllCampaignStats()
        external
        view
        returns (
            uint256 totalCampaigns,
            uint256 activeCampaigns,
            uint256 totalRaised,
            uint256 totalBeneficiaries,
            uint256 totalRedeemed
        )
    {
        totalCampaigns = allCampaignsArray.length;

        for (uint256 i = 0; i < allCampaignsArray.length; i++) {
            Campaign memory c = allCampaignsArray[i];
            totalRaised += c.raisedAmount;
            totalBeneficiaries += c.beneficiaryCount;
            totalRedeemed += c.redeemedCount;

            if (c.status == CampaignStatus.Active) {
                activeCampaigns++;
            }
        }
    }

    function getNGOActivity(address wallet)
        external
        view
        returns (
            uint256 totalRegistered,
            uint256 totalApproved,
            uint256 totalRedeemed,
            NGOStatus status
        )
    {
        NGO memory ngo = ngoByWallet[wallet];
        return (
            ngo.totalRegistered,
            ngo.totalApproved,
            ngo.totalRedeemed,
            ngo.status
        );
    }

    receive() external payable {}
}

