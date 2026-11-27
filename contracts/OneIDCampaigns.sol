// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeCounted} from "./BeCounted.sol";

/// @title OneIDCampaigns — reference applications built on BeCounted
/// @notice Two small, real applications that integrate the BeCounted
///         primitive exactly the way a third-party project would:
///           1. RAFFLE — one Agent ID, one ticket; the draw seed block is
///              fixed at creation time and the result is reproducible
///              by anyone from on-chain data.
///           2. VOTE   — one Agent ID, one vote; tallies are public.
///
/// @dev This contract is the "caller" in the two-key design:
///      BeCounted answers "is a unique human?" (keyed by address,
///      stateless). THIS contract keeps the per-campaign dedup state
///      (keyed by the participant, i.e. effectively by Agent ID, since
///      the ID is non-transferable and lives in exactly one wallet).
///
///      MONEY: this contract never receives, holds, or moves funds.
///      Prizes are distributed by campaign creators off-contract; the
///      chain only proves who entered and who won. No yield is promised
///      anywhere, by design.
contract OneIDCampaigns {
    enum Kind {
        Raffle,
        Vote
    }

    struct Campaign {
        address creator;
        Kind kind;
        string title;
        uint64 startAt;
        uint64 endAt;
        // Raffle only
        uint32 winnerCount;
        uint64 seedBlock; // fixed at creation; its blockhash seeds the draw
        bool drawn;
        bool usedFallbackSeed;
        // Vote only
        uint8 optionCount;
        // Shared
        uint256 entryCount;
    }

    BeCounted public immutable gate;

    Campaign[] private _campaigns;

    // campaignId => participant => entered?
    mapping(uint256 => mapping(address => bool)) public hasEntered;
    // campaignId => ordered participant list
    mapping(uint256 => address[]) private _entries;
    // campaignId => participant => chosen option (Vote)
    mapping(uint256 => mapping(address => uint8)) public voteOf;
    // campaignId => option => tally (Vote)
    mapping(uint256 => mapping(uint8 => uint256)) public tally;
    // campaignId => winners (Raffle, after draw)
    mapping(uint256 => address[]) private _winners;

    event CampaignCreated(
        uint256 indexed id,
        address indexed creator,
        Kind kind,
        string title,
        uint64 startAt,
        uint64 endAt
    );
    event Entered(uint256 indexed id, address indexed participant);
    event Voted(uint256 indexed id, address indexed participant, uint8 option);
    event Drawn(uint256 indexed id, uint256 seed, bool usedFallbackSeed, uint256 winnerCount);

    error NotHuman();
    error AlreadyCounted();
    error NotOpen();
    error NotEnded();
    error AlreadyDrawn();
    error BadOption();
    error BadParams();

    constructor(address gate_) {
        require(gate_ != address(0), "gate is zero");
        gate = BeCounted(gate_);
    }

    // ------------------------------------------------------------------
    // Creation
    // ------------------------------------------------------------------

    /// @notice Create a raffle. `seedBlock` must be a future block after
    ///         the campaign ends; its blockhash will seed the draw, so
    ///         nobody — including the creator — can know or steer the
    ///         result at entry time.
    function createRaffle(
        string calldata title,
        uint64 startAt,
        uint64 endAt,
        uint32 winnerCount,
        uint64 seedBlock
    ) external returns (uint256 id) {
        if (endAt <= startAt || winnerCount == 0) revert BadParams();
        if (seedBlock <= block.number) revert BadParams();
        id = _campaigns.length;
        _campaigns.push(
            Campaign({
                creator: msg.sender,
                kind: Kind.Raffle,
                title: title,
                startAt: startAt,
                endAt: endAt,
                winnerCount: winnerCount,
                seedBlock: seedBlock,
                drawn: false,
                usedFallbackSeed: false,
                optionCount: 0,
                entryCount: 0
            })
        );
        emit CampaignCreated(id, msg.sender, Kind.Raffle, title, startAt, endAt);
    }

    /// @notice Create a vote with `optionCount` options (2..16).
    function createVote(
        string calldata title,
        uint64 startAt,
        uint64 endAt,
        uint8 optionCount
    ) external returns (uint256 id) {
        if (endAt <= startAt || optionCount < 2 || optionCount > 16) revert BadParams();
        id = _campaigns.length;
        _campaigns.push(
            Campaign({
                creator: msg.sender,
                kind: Kind.Vote,
                title: title,
                startAt: startAt,
                endAt: endAt,
                winnerCount: 0,
                seedBlock: 0,
                drawn: false,
                usedFallbackSeed: false,
                optionCount: optionCount,
                entryCount: 0
            })
        );
        emit CampaignCreated(id, msg.sender, Kind.Vote, title, startAt, endAt);
    }

    // ------------------------------------------------------------------
    // Participation — the gate + caller-side dedup, in one place
    // ------------------------------------------------------------------

    function _join(uint256 id) internal returns (Campaign storage c) {
        c = _campaigns[id];
        if (block.timestamp < c.startAt || block.timestamp > c.endAt) revert NotOpen();
        // Q1, answered by the primitive:
        if (!gate.isHuman(msg.sender)) revert NotHuman();
        // Q2, answered by this contract's own bookkeeping:
        if (hasEntered[id][msg.sender]) revert AlreadyCounted();
        hasEntered[id][msg.sender] = true;
        _entries[id].push(msg.sender);
        c.entryCount += 1;
    }

    /// @notice Enter a raffle. One Agent ID, one ticket.
    function enterRaffle(uint256 id) external {
        Campaign storage c = _join(id);
        require(c.kind == Kind.Raffle, "not a raffle");
        emit Entered(id, msg.sender);
    }

    /// @notice Cast a vote. One Agent ID, one vote; no changing votes.
    function castVote(uint256 id, uint8 option) external {
        Campaign storage c = _campaigns[id];
        if (option >= c.optionCount) revert BadOption();
        _join(id);
        require(c.kind == Kind.Vote, "not a vote");
        voteOf[id][msg.sender] = option;
        tally[id][option] += 1;
        emit Voted(id, msg.sender, option);
    }

    // ------------------------------------------------------------------
    // Raffle draw — deterministic and reproducible
    // ------------------------------------------------------------------

    /// @notice Draw the raffle after it ends. Callable by anyone.
    /// @dev Winners are picked by a partial Fisher–Yates shuffle driven
    ///      by keccak256(seed, index). Anyone can recompute the same
    ///      winners off-chain from the entry list and the seed.
    ///      If the seed block's hash has aged out of the 256-block
    ///      blockhash window, the previous block's hash is used as a
    ///      documented fallback and `usedFallbackSeed` is set — the
    ///      draw can never get stuck.
    function draw(uint256 id) external {
        Campaign storage c = _campaigns[id];
        require(c.kind == Kind.Raffle, "not a raffle");
        if (block.timestamp <= c.endAt) revert NotEnded();
        if (c.drawn) revert AlreadyDrawn();
        if (block.number <= c.seedBlock) revert NotEnded();

        bytes32 h = blockhash(c.seedBlock);
        bool usedFallback = (h == bytes32(0));
        if (usedFallback) {
            h = blockhash(block.number - 1);
            c.usedFallbackSeed = true;
        }
        uint256 seed = uint256(h);
        c.drawn = true;

        uint256 n = _entries[id].length;
        uint256 k = c.winnerCount;
        if (k > n) k = n;

        // Work on a memory copy of indices for the shuffle.
        uint256[] memory idx = new uint256[](n);
        for (uint256 i = 0; i < n; i++) idx[i] = i;
        for (uint256 i = 0; i < k; i++) {
            uint256 j = i + (uint256(keccak256(abi.encode(seed, i))) % (n - i));
            (idx[i], idx[j]) = (idx[j], idx[i]);
            _winners[id].push(_entries[id][idx[i]]);
        }
        emit Drawn(id, seed, usedFallback, k);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function campaignCount() external view returns (uint256) {
        return _campaigns.length;
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        return _campaigns[id];
    }

    function getEntries(uint256 id) external view returns (address[] memory) {
        return _entries[id];
    }

    function getWinners(uint256 id) external view returns (address[] memory) {
        return _winners[id];
    }
}
