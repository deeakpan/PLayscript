// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Minimal ERC20 surface used by the vault.
interface IERC20Play {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title PlayVault
/// @notice Global PLAY LP vault: internal shares track LP ownership; `totalOutstandingLiability` reserves
///         capacity for open scripts; `freeFloat` is balance minus liability minus a 2% hard floor.
///         `ledger` = `PlayscriptKernel` (add/clear liability, pay). `positions` = `PlayscriptV2Positions`
///         (pull stakes to vault, `releaseStake` on unwind). See `playscript.md` §6–9, §13–14.
contract PlayVault {
    IERC20Play public immutable PLAY;

    address public owner;
    /// @notice Authorised match ledger — `PlayscriptKernel` after `setLedger`.
    address public ledger;
    /// @notice Script locker — `PlayscriptV2Positions` after `setPositions`.
    address public positions;

    uint256 public totalOutstandingLiability;
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    uint256 public constant HARD_FLOOR_BPS = 200;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event LedgerUpdated(address indexed previousLedger, address indexed newLedger);
    event PositionsUpdated(address indexed previousPositions, address indexed newPositions);
    event Deposited(address indexed user, uint256 amount, uint256 mintedShares);
    event Withdrawn(address indexed user, uint256 payout, uint256 burnedShares);
    event LiabilityAdded(uint256 amount, uint256 newTotal);
    event LiabilityCleared(uint256 amount, uint256 newTotal);
    event Paid(address indexed to, uint256 amount);

    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientShares();
    error TransferFailed();
    error NothingWithdrawable();
    error BurnTooLarge();
    error LiabilityTooHigh();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyLedger() {
        if (msg.sender != ledger) revert Unauthorized();
        _;
    }

    modifier onlyPositions() {
        if (msg.sender != positions) revert Unauthorized();
        _;
    }

    constructor(IERC20Play play_, address initialOwner) {
        if (address(play_) == address(0) || initialOwner == address(0)) revert ZeroAddress();
        PLAY = play_;
        owner = initialOwner;
        ledger = initialOwner;
        positions = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
        emit LedgerUpdated(address(0), initialOwner);
        emit PositionsUpdated(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setLedger(address newLedger) external onlyOwner {
        if (newLedger == address(0)) revert ZeroAddress();
        emit LedgerUpdated(ledger, newLedger);
        ledger = newLedger;
    }

    function setPositions(address newPositions) external onlyOwner {
        if (newPositions == address(0)) revert ZeroAddress();
        emit PositionsUpdated(positions, newPositions);
        positions = newPositions;
    }

    /// @notice Return locked PLAY to a user during `OPEN` unwind (`playscript.md` refund path).
    function releaseStake(address to, uint256 amount) external onlyPositions {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!PLAY.transfer(to, amount)) revert TransferFailed();
    }

    /// @notice PLAY balance minus `totalOutstandingLiability` minus 2% hard floor (bps).
    function freeFloat() public view returns (uint256) {
        uint256 bal = PLAY.balanceOf(address(this));
        unchecked {
            uint256 floor = (bal * HARD_FLOOR_BPS) / 10_000;
            uint256 reserved = totalOutstandingLiability + floor;
            if (bal <= reserved) return 0;
            return bal - reserved;
        }
    }

    /// @notice LP: deposit PLAY; mint vault shares (first deposit 1:1).
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 vaultBalBefore = PLAY.balanceOf(address(this));
        if (!PLAY.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 minted = (totalShares == 0 || vaultBalBefore == 0)
            ? amount
            : (amount * totalShares) / vaultBalBefore;
        if (minted == 0) revert ZeroAmount();

        totalShares += minted;
        sharesOf[msg.sender] += minted;
        emit Deposited(msg.sender, amount, minted);
    }

    /// @notice LP: burn shares; payout capped by `freeFloat()` (design doc partial withdraw).
    function withdraw(uint256 shareAmount) external {
        if (shareAmount == 0) revert ZeroAmount();
        if (shareAmount > sharesOf[msg.sender]) revert InsufficientShares();

        uint256 vaultBal = PLAY.balanceOf(address(this));
        if (vaultBal == 0 || totalShares == 0) revert NothingWithdrawable();

        uint256 userEntitlement = (shareAmount * vaultBal) / totalShares;
        uint256 avail = freeFloat();
        uint256 actualPayout = userEntitlement > avail ? avail : userEntitlement;
        if (actualPayout == 0) revert NothingWithdrawable();

        uint256 actualLpBurn;
        if (actualPayout == userEntitlement) {
            actualLpBurn = shareAmount;
        } else {
            actualLpBurn = (actualPayout * totalShares) / vaultBal;
        }
        if (actualLpBurn == 0 || actualLpBurn > sharesOf[msg.sender]) revert BurnTooLarge();

        sharesOf[msg.sender] -= actualLpBurn;
        totalShares -= actualLpBurn;

        if (!PLAY.transfer(msg.sender, actualPayout)) revert TransferFailed();
        emit Withdrawn(msg.sender, actualPayout, actualLpBurn);
    }

    /// @notice Pay winners (or refunds); only `ledger` (`PlayscriptKernel` or future claim router).
    function pay(address to, uint256 amount) external onlyLedger {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!PLAY.transfer(to, amount)) revert TransferFailed();
        emit Paid(to, amount);
    }

    function addLiability(uint256 amount) external onlyLedger {
        if (amount == 0) revert ZeroAmount();
        totalOutstandingLiability += amount;
        emit LiabilityAdded(amount, totalOutstandingLiability);
    }

    function clearLiability(uint256 amount) external onlyLedger {
        if (amount == 0) revert ZeroAmount();
        if (amount > totalOutstandingLiability) revert LiabilityTooHigh();
        unchecked {
            totalOutstandingLiability -= amount;
        }
        emit LiabilityCleared(amount, totalOutstandingLiability);
    }
}
