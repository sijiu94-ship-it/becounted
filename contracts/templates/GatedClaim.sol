// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeCounted} from "../BeCounted.sol";

// Minimal ERC20 surface this template needs. Declared locally so the
// file stays self-contained: copy this one file and it compiles.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

// ----------------------------------------------------------------------
// GatedClaim — a minimal Agent-ID-gated airdrop / allowlist claim.
//
// TEMPLATE: one deployed instance is one drop. A creator escrows a
// pool (BNB or any ERC20), the pool is split into maxClaims equal
// shares, and each address backed by a unique human (an Agent ID
// holder) can claim exactly one share, first come first served.
// When the window ends, the creator takes back whatever is left
// (unclaimed shares plus the integer-division dust).
//
// This file is deliberately small. It exists to show the whole
// integration surface of the BeCounted primitive in one read:
//
//   THE TWO-KEY PRINCIPLE, as two lines of code in claim():
//     Key 1 — "is this a unique human?" is asked of the PRIMITIVE,
//             by address, on every call:  gate.isHuman(msg.sender)
//             BeCounted is stateless; nothing about the claimant is
//             stored there, and this contract trusts it for nothing
//             else.
//     Key 2 — "has this human already been counted in THIS drop?"
//             is the CALLER's own bookkeeping: the `claimed` mapping
//             below. Dedup state lives here, never in the primitive.
//             (Dedup by holding address is dedup by Agent ID: the ID
//             is non-transferable and lives in exactly one wallet.)
//
// WHAT THIS CONTRACT DELIBERATELY DOES NOT HAVE:
//   - No owner and no admin powers. The creator is only the wallet
//     that funded the drop; its single privilege is reclaiming the
//     leftover AFTER the deadline, disclosed here and in the README.
//     It cannot pause, cannot change the rules, cannot touch shares
//     that were already claimed, cannot reclaim early.
//   - No name-to-wallet lookup, no scoring, no judgement of anyone.
//     The gate answers one yes/no question and nothing more.
//   - No randomness. Shares are equal by construction.
//
// Deploy parameters, funding flow and adaptation notes: README.md
// in this folder.
// ----------------------------------------------------------------------
contract GatedClaim {
    // The gate this drop asks Key 1 of. Immutable: the rules of a
    // drop can never be repointed at a different gate after deploy.
    BeCounted public immutable gate;

    // The wallet that created and funded this drop. Only used for
    // the post-deadline reclaim; it has no other power (see header).
    address public immutable creator;

    // Prize token. address(0) means native BNB.
    address public immutable token;

    // Total escrowed pool, and the equal share each claimant gets.
    // share = totalPool / maxClaims, computed once at construction
    // (integer division; the dust stays in the reclaimable rest).
    uint256 public immutable totalPool;
    uint256 public immutable share;
    uint32 public immutable maxClaims;

    // Claim window, unix seconds. Claims are open while
    // startAt <= block.timestamp <= endAt.
    uint64 public immutable startAt;
    uint64 public immutable endAt;

    // Key 2 state: this drop's own dedup bookkeeping.
    mapping(address => bool) public claimed;
    uint32 public claimedCount;
    uint256 public paidOut;

    bool public funded;
    bool public reclaimed;

    event Funded(address token, uint256 totalPool);
    event Claimed(address indexed participant, uint256 amount);
    event Reclaimed(address indexed creator, uint256 amount);

    error NotHuman();
    error AlreadyClaimed();
    error NotOpen();
    error NoSlots();
    error NotFunded();
    error NotCreator();
    error TooEarly();
    error AlreadyReclaimed();
    error AlreadyFunded();
    error BadParams();
    error TransferFailed();
    error InsufficientReceived();

    // Hand-rolled reentrancy lock, same pattern as OneIDCampaigns:
    // claim() pays out in the same transaction it marks the claim,
    // so state is updated before any external call AND the lock
    // makes a reentrant second claim impossible even against a
    // malicious token or a BNB-receiving contract claimant.
    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    // token_ = address(0) for a BNB pool, or the ERC20 address.
    // totalPool_ must be at least maxClaims_ so every share is at
    // least 1 unit; a 0-unit share would let bots burn slots for
    // free and is rejected here instead of at claim time.
    constructor(
        address gate_,
        address token_,
        uint256 totalPool_,
        uint32 maxClaims_,
        uint64 startAt_,
        uint64 endAt_
    ) {
        if (gate_ == address(0)) revert BadParams();
        if (maxClaims_ == 0 || totalPool_ < maxClaims_) revert BadParams();
        if (endAt_ <= startAt_) revert BadParams();
        gate = BeCounted(gate_);
        creator = msg.sender;
        token = token_;
        totalPool = totalPool_;
        share = totalPool_ / maxClaims_;
        maxClaims = maxClaims_;
        startAt = startAt_;
        endAt = endAt_;
    }

    // Escrow the pool. Creator only, exactly once. Kept separate
    // from the constructor on purpose: for an ERC20 pool the creator
    // must approve THIS contract first, and its address only exists
    // after deployment. For a BNB pool, send exactly totalPool.
    function fund() external payable nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (funded) revert AlreadyFunded();
        funded = true;
        if (token == address(0)) {
            if (msg.value != totalPool) revert BadParams();
        } else {
            if (msg.value != 0) revert BadParams();
            // Account by what ACTUALLY arrived: a fee-on-transfer
            // token landing short would leave the drop owing shares
            // it cannot pay, so a short landing reverts the funding
            // (and `funded` rolls back with the rest of the call).
            uint256 before = IERC20(token).balanceOf(address(this));
            if (!IERC20(token).transferFrom(msg.sender, address(this), totalPool)) revert TransferFailed();
            if (IERC20(token).balanceOf(address(this)) - before != totalPool) revert InsufficientReceived();
        }
        emit Funded(token, totalPool);
    }

    // Claim one share. One Agent ID, one share, paid in this same
    // transaction. First come first served until the shares run out
    // or the window closes, whichever comes first.
    function claim() external nonReentrant {
        if (!funded) revert NotFunded();
        if (block.timestamp < startAt || block.timestamp > endAt) revert NotOpen();
        if (claimedCount >= maxClaims) revert NoSlots();

        // Key 1 — ask the primitive, by address, every time.
        if (!gate.isHuman(msg.sender)) revert NotHuman();
        // Key 2 — ask this contract's own bookkeeping.
        if (claimed[msg.sender]) revert AlreadyClaimed();

        // Effects before interaction: mark first, pay second.
        claimed[msg.sender] = true;
        claimedCount += 1;
        paidOut += share;
        emit Claimed(msg.sender, share);
        _pay(msg.sender, share);
    }

    // After the deadline the creator takes back what was never
    // claimed (leftover shares plus division dust). This is the
    // creator's only privilege, and it cannot fire early: shares
    // that are still claimable stay claimable until endAt.
    function reclaim() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (block.timestamp <= endAt) revert TooEarly();
        if (reclaimed) revert AlreadyReclaimed();
        reclaimed = true;
        uint256 remainder = totalPool - paidOut;
        paidOut = totalPool;
        emit Reclaimed(msg.sender, remainder);
        if (remainder > 0) _pay(msg.sender, remainder);
    }

    // Shares nobody has claimed yet.
    function remainingShares() external view returns (uint32) {
        return maxClaims - claimedCount;
    }

    // Pool not yet paid out (still claimable, or reclaimable after
    // the deadline if the drop was funded).
    function remainingPool() external view returns (uint256) {
        return totalPool - paidOut;
    }

    function _pay(address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
        }
    }
}
