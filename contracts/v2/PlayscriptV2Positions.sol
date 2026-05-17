// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PlayscriptKernel} from "./PlayscriptKernel.sol";
import {IPlayVault} from "./IPlayVault.sol";
import {IPlayscriptV2LockRegistry} from "./IPlayscriptV2LockRegistry.sol";
import {LegBitmask} from "./LegBitmask.sol";

interface IERC20Play {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title PlayscriptV2Positions
/// @notice ERC-1155 script tickets: lock PLAY against the vault, claim winner payouts (`playscript.md` §9, §15).
contract PlayscriptV2Positions {
    using LegBitmask for uint16;

    PlayscriptKernel public immutable kernel;
    IERC20Play public immutable playToken;
    /// @notice Zero = legacy behaviour (PLAY held here).
    address public immutable vault;
    /// @notice Optional lock history for My Scripts (`PlayscriptV2LockRegistry`).
    address public lockRegistry;

    event LockRegistrySet(address indexed lockRegistry);

    uint256 public constant LOCK_FEE_BPS = 50;

    string public constant name = "Playscript V2 Script";
    string public constant symbol = "PSCRIPT2";

    bytes4 private constant _ERC1155_IFACE = 0xd9b67a26;
    bytes4 private constant _ERC165_IFACE = 0x01ffc9a7;

    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => address) public tokenOriginalMinter;

    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);
    event ScriptLocked(
        uint256 indexed matchId,
        uint16 legMask12,
        address indexed user,
        uint256 actualStake,
        uint256 netStake,
        uint256 payoutRate,
        uint256 liability
    );
    event ScriptClaimed(uint256 indexed matchId, uint16 legMask12, address indexed user, uint256 netStakeBurned);

    error Unauthorized();
    error BadMatch();
    error BadMask();
    error BadAmount();
    error BadState();
    error TransferRejected();
    error ZeroAddress();
    error NoRoom();
    error VaultUnset();

    constructor(PlayscriptKernel kernel_, IERC20Play playToken_, address vault_) {
        kernel = kernel_;
        playToken = playToken_;
        vault = vault_;
    }

    /// @notice Kernel owner wires `PlayscriptV2LockRegistry` (one-time per deployment).
    function setLockRegistry(address lockRegistry_) external {
        if (msg.sender != kernel.owner()) revert Unauthorized();
        lockRegistry = lockRegistry_;
        emit LockRegistrySet(lockRegistry_);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == _ERC165_IFACE || interfaceId == _ERC1155_IFACE;
    }

    function uri(uint256) external pure returns (string memory) {
        return "";
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balances[id][account];
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory batch)
    {
        if (accounts.length != ids.length) revert BadAmount();
        batch = new uint256[](accounts.length);
        for (uint256 i; i < accounts.length; ++i) {
            if (accounts[i] == address(0)) revert ZeroAddress();
            batch[i] = _balances[ids[i]][accounts[i]];
        }
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (!(from == msg.sender || _operatorApprovals[from][msg.sender])) revert Unauthorized();
        _update(from, to, id, amount);
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155Received(msg.sender, from, id, amount, data) returns (bytes4 sel) {
                if (sel != IERC1155Receiver.onERC1155Received.selector) revert TransferRejected();
            } catch {
                revert TransferRejected();
            }
        }
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (!(from == msg.sender || _operatorApprovals[from][msg.sender])) revert Unauthorized();
        if (ids.length != amounts.length) revert BadAmount();
        for (uint256 i; i < ids.length; ++i) {
            _update(from, to, ids[i], amounts[i]);
        }
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, amounts, data) returns (bytes4 sel) {
                if (sel != IERC1155Receiver.onERC1155BatchReceived.selector) revert TransferRejected();
            } catch {
                revert TransferRejected();
            }
        }
    }

    function scriptTokenId(uint256 matchId, uint16 legMask12) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(matchId, legMask12)));
    }

    /// @notice Lock PLAY: partial fill by vault/match room, 0.5% fee, mint ERC-1155 balance = net stake.
    function lockScript(uint256 matchId, uint16 legMask12, uint256 playAmount) external {
        if (playAmount == 0) revert BadAmount();
        if (!legMask12.hasExactBits(5)) revert BadMask();
        if (vault == address(0)) revert VaultUnset();

        PlayscriptKernel.Match memory m = kernel.matches(matchId);
        if (!m.exists) revert BadMatch();
        if (m.state != PlayscriptKernel.MatchState.OPEN) revert BadState();

        uint256 score = kernel.difficultyScore(matchId, legMask12);
        uint256 rate = kernel.getPayoutRate(score);
        uint256 requestedLiability = (playAmount * rate) / 10;

        uint256 room = kernel.lockRoom(matchId);
        if (room == 0) revert NoRoom();

        uint256 actualLiability = requestedLiability > room ? room : requestedLiability;
        if (actualLiability == 0) revert NoRoom();

        uint256 actualStake = (actualLiability * 10) / rate;
        if (actualStake == 0) revert BadAmount();

        if (!playToken.transferFrom(msg.sender, address(this), playAmount)) revert BadAmount();
        if (playAmount > actualStake) {
            if (!playToken.transfer(msg.sender, playAmount - actualStake)) revert BadAmount();
        }

        if (!playToken.transfer(vault, actualStake)) revert BadAmount();

        kernel.recordLockLiability(matchId, actualLiability);

        uint256 fee = (actualStake * LOCK_FEE_BPS) / 10_000;
        uint256 netStake = actualStake - fee;

        uint256 id = scriptTokenId(matchId, legMask12);
        _update(address(0), msg.sender, id, netStake);

        if (tokenOriginalMinter[id] == address(0)) {
            tokenOriginalMinter[id] = msg.sender;
        }

        emit ScriptLocked(matchId, legMask12, msg.sender, actualStake, netStake, rate, actualLiability);

        address reg = lockRegistry;
        if (reg != address(0)) {
            IPlayscriptV2LockRegistry(reg).recordLock(msg.sender, matchId, legMask12, actualStake, netStake, rate);
        }
    }

    /// @notice While `OPEN`, burn tokens and return the same PLAY amount from the vault.
    function unwind(uint256 matchId, uint16 legMask12, uint256 amount) external {
        if (amount == 0) revert BadAmount();
        PlayscriptKernel.Match memory m = kernel.matches(matchId);
        if (!m.exists) revert BadMatch();
        if (m.state != PlayscriptKernel.MatchState.OPEN) revert BadState();

        uint256 id = scriptTokenId(matchId, legMask12);
        _update(msg.sender, address(0), id, amount);

        if (vault != address(0)) {
            uint256 rate = kernel.payoutRateForMask(matchId, legMask12);
            uint256 liabRemoved = (amount * rate) / 10;
            if (liabRemoved > 0) {
                kernel.reduceLockLiability(matchId, liabRemoved);
            }
            IPlayVault(vault).releaseStake(msg.sender, amount);
        } else {
            if (!playToken.transfer(msg.sender, amount)) revert BadAmount();
        }
    }

    /// @notice After settlement: burn winning script balance; kernel pays `netStake × payoutRate` from vault.
    function claim(uint256 matchId, uint16 legMask12, uint256 amount) external {
        if (amount == 0) revert BadAmount();
        if (!legMask12.hasExactBits(5)) revert BadMask();
        if (vault == address(0)) revert VaultUnset();

        PlayscriptKernel.Match memory m = kernel.matches(matchId);
        if (!m.exists || !m.settled) revert BadState();
        if (!kernel.isWinningMask(matchId, legMask12)) revert BadState();

        uint256 id = scriptTokenId(matchId, legMask12);
        _update(msg.sender, address(0), id, amount);

        kernel.payClaim(matchId, legMask12, amount, msg.sender);

        emit ScriptClaimed(matchId, legMask12, msg.sender, amount);

        address reg = lockRegistry;
        if (reg != address(0)) {
            IPlayscriptV2LockRegistry(reg).markClaimed(msg.sender, matchId, legMask12);
        }
    }

    function _update(address from, address to, uint256 id, uint256 amount) internal {
        if (from != address(0)) {
            if (_balances[id][from] < amount) revert BadAmount();
            unchecked {
                _balances[id][from] -= amount;
            }
        }
        if (to != address(0)) {
            unchecked {
                _balances[id][to] += amount;
            }
        }
        emit TransferSingle(msg.sender, from, to, id, amount);
    }
}

interface IERC1155Receiver {
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);
}
