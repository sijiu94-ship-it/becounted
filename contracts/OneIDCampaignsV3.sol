// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BeCounted} from "./BeCounted.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title OneIDCampaignsV3 — reference applications built on BeCounted
/// @notice Three applications that integrate the BeCounted primitive the
///         way a third-party project would:
///           1. RAFFLE — one Agent ID, one ticket. The draw seed block is
///              fixed at creation; results are reproducible by anyone.
///              The creator MAY escrow a prize (BNB or any ERC20) in the
///              contract; winners claim their share on-chain.
///           2. VOTE   — one Agent ID, one vote; tallies are public.
///           3. CLAIM  — one Agent ID, one share. The creator escrows a
///              pool; each verified human claims exactly one share, paid
///              out immediately. Two modes: FIXED (equal shares) or
///              RANDOM ("lucky draw" red-packet style, double-mean
///              algorithm — every draw is between 1 unit and twice the
///              remaining average, the last claimant takes the rest).
///              Randomness is blockhash-based pseudo-randomness, fit
///              for entertainment-size pools, NOT for large sums; it is
///              labelled as such in the UI. The canonical fair-drop /
///              allowlist pattern, minus the sybil farms.
///
/// @dev Two-key design: BeCounted answers "is a unique human?" (keyed by
///      address, stateless). THIS contract keeps the per-campaign dedup
///      state (keyed by participant — effectively by Agent ID, since the
///      ID is non-transferable and lives in exactly one wallet).
///
///      FUNDS: escrow is opt-in per campaign and fully accounted:
///      every wei/token unit deposited is either paid to a winner or
///      claimant, or reclaimable by the creator after the window
///      (unclaimed raffle prizes after 30 days; claim-pool remainders
///      after the campaign ends). The contract holds no other funds and
///      has no owner. No yield is promised anywhere, by design.
contract OneIDCampaignsV3 {
    enum Kind {
        Raffle,
        Vote,
        Claim
    }

    uint256 public constant PRIZE_CLAIM_WINDOW = 30 days;

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
        // Funds (Raffle escrow + Claim pool); prizeToken == address(0) = BNB
        address prizeToken;
        uint256 prizePerWinner; // Raffle: escrowed amount per winner
        uint256 pool; // Claim: total escrowed pool
        uint256 claimAmount; // Claim (fixed mode): pool / maxClaims, fixed at creation
        uint32 maxClaims; // Claim: cap on number of claims
        bool claimRandom; // Claim: true = lucky-draw random shares
        uint256 paidOut; // total already paid out (prizes + claims)
        bool reclaimed; // creator has taken the remainder
    }

    BeCounted public immutable gate;

    Campaign[] private _campaigns;

    mapping(uint256 => mapping(address => bool)) public hasEntered;
    mapping(uint256 => address[]) private _entries;
    mapping(uint256 => mapping(address => uint8)) public voteOf;
    mapping(uint256 => mapping(uint8 => uint256)) public tally;
    mapping(uint256 => address[]) private _winners;
    mapping(uint256 => mapping(address => bool)) public isWinner;
    mapping(uint256 => mapping(address => bool)) public prizeClaimed;

    event CampaignCreated(
        uint256 indexed id,
        address indexed creator,
        Kind kind,
        string title,
        uint64 startAt,
        uint64 endAt
    );
    event Funded(uint256 indexed id, address token, uint256 total);
    event Entered(uint256 indexed id, address indexed participant);
    event Voted(uint256 indexed id, address indexed participant, uint8 option);
    event Drawn(uint256 indexed id, uint256 seed, bool usedFallbackSeed, uint256 winnerCount);
    event Claimed(uint256 indexed id, address indexed participant, uint256 amount);
    event PrizeClaimed(uint256 indexed id, address indexed winner, uint256 amount);
    event Reclaimed(uint256 indexed id, address indexed creator, uint256 amount);

    error NotHuman();
    error AlreadyCounted();
    error NotOpen();
    error NotEnded();
    error AlreadyDrawn();
    error BadOption();
    error BadParams();
    error WrongValue();
    error NotWinner();
    error NotCreator();
    error NoSlots();
    error TooEarly();
    error TransferFailed();

    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address gate_) {
        require(gate_ != address(0), "gate is zero");
        gate = BeCounted(gate_);
    }

    // ------------------------------------------------------------------
    // Funding helpers
    // ------------------------------------------------------------------

    function _fund(address token, uint256 total) internal {
        if (total == 0) {
            if (msg.value != 0) revert WrongValue();
            return;
        }
        if (token == address(0)) {
            if (msg.value != total) revert WrongValue();
        } else {
            if (msg.value != 0) revert WrongValue();
            if (!IERC20(token).transferFrom(msg.sender, address(this), total)) revert TransferFailed();
        }
    }

    function _pay(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
        }
    }

    // ------------------------------------------------------------------
    // Creation
    // ------------------------------------------------------------------

    /// @notice Create a raffle. `seedBlock` must be a future block after
    ///         the campaign ends; its blockhash seeds the draw.
    /// @param prizeToken address(0) for BNB, or an ERC20. If
    ///        `prizePerWinner` > 0 the full escrow (perWinner × winners)
    ///        must be funded in this call (msg.value for BNB, allowance
    ///        for ERC20). Zero means no escrow (unfunded raffle).
    function createRaffle(
        string calldata title,
        uint64 startAt,
        uint64 endAt,
        uint32 winnerCount,
        uint64 seedBlock,
        address prizeToken,
        uint256 prizePerWinner
    ) external payable returns (uint256 id) {
        if (endAt <= startAt || winnerCount == 0) revert BadParams();
        if (seedBlock <= block.number) revert BadParams();
        uint256 total = prizePerWinner * winnerCount;
        _fund(prizeToken, total);
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
                entryCount: 0,
                prizeToken: prizeToken,
                prizePerWinner: prizePerWinner,
                pool: 0,
                claimAmount: 0,
                maxClaims: 0,
                claimRandom: false,
                paidOut: 0,
                reclaimed: false
            })
        );
        emit CampaignCreated(id, msg.sender, Kind.Raffle, title, startAt, endAt);
        if (total > 0) emit Funded(id, prizeToken, total);
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
                entryCount: 0,
                prizeToken: address(0),
                prizePerWinner: 0,
                pool: 0,
                claimAmount: 0,
                maxClaims: 0,
                claimRandom: false,
                paidOut: 0,
                reclaimed: false
            })
        );
        emit CampaignCreated(id, msg.sender, Kind.Vote, title, startAt, endAt);
    }

    /// @notice Create a one-human-one-share claim. The pool is split into
    ///         `maxClaims` equal shares (integer division; any dust stays
    ///         in the creator's reclaimable remainder).
    function createClaim(
        string calldata title,
        uint64 startAt,
        uint64 endAt,
        uint32 maxClaims,
        address token,
        uint256 totalPool,
        bool random
    ) external payable returns (uint256 id) {
        if (endAt <= startAt || maxClaims == 0 || totalPool == 0) revert BadParams();
        // The pool must be able to give every claimant at least 1 unit.
        if (totalPool < maxClaims) revert BadParams();
        uint256 per = random ? 0 : totalPool / maxClaims;
        if (!random && per == 0) revert BadParams();
        _fund(token, totalPool);
        id = _campaigns.length;
        _campaigns.push(
            Campaign({
                creator: msg.sender,
                kind: Kind.Claim,
                title: title,
                startAt: startAt,
                endAt: endAt,
                winnerCount: 0,
                seedBlock: 0,
                drawn: false,
                usedFallbackSeed: false,
                optionCount: 0,
                entryCount: 0,
                prizeToken: token,
                prizePerWinner: 0,
                pool: totalPool,
                claimAmount: per,
                maxClaims: maxClaims,
                claimRandom: random,
                paidOut: 0,
                reclaimed: false
            })
        );
        emit CampaignCreated(id, msg.sender, Kind.Claim, title, startAt, endAt);
        emit Funded(id, token, totalPool);
    }

    // ------------------------------------------------------------------
    // Participation — gate + caller-side dedup
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

    /// @notice Claim one share of a claim campaign. One Agent ID, one
    ///         share, paid out in this same transaction. Fixed mode pays
    ///         the precomputed equal share; random mode draws a
    ///         lucky-draw amount (double-mean, see _randomShare).
    function claim(uint256 id) external nonReentrant {
        Campaign storage c = _campaigns[id];
        require(c.kind == Kind.Claim, "not a claim");
        if (c.entryCount >= c.maxClaims) revert NoSlots();
        _join(id);
        uint256 amount = c.claimRandom
            ? _randomShare(c.pool - c.paidOut, c.maxClaims - (c.entryCount - 1))
            : c.claimAmount;
        c.paidOut += amount;
        emit Claimed(id, msg.sender, amount);
        _pay(c.prizeToken, msg.sender, amount);
    }

    uint256 private _drawNonce;

    /// @dev WeChat-style double-mean draw: the amount is uniform in
    ///      [1, 2 x remaining average], so the pool can never run dry
    ///      early, every remaining claimant is guaranteed at least 1
    ///      unit, and the final claimant takes whatever is left.
    ///      Randomness: keccak256(previous blockhash, claimant, nonce) —
    ///      pseudo-random, entertainment-grade (see contract doc).
    function _randomShare(uint256 remaining, uint256 slotsLeft) internal returns (uint256) {
        if (slotsLeft == 1) return remaining;
        uint256 avg = remaining / slotsLeft;
        uint256 cap = avg * 2;
        if (cap > remaining) cap = remaining;
        uint256 r = uint256(
            keccak256(abi.encodePacked(blockhash(block.number - 1), msg.sender, address(this), _drawNonce++))
        );
        uint256 amount = 1 + (r % cap);
        uint256 reserve = slotsLeft - 1; // 1 unit guaranteed per remaining claimant
        if (amount > remaining - reserve) amount = remaining - reserve;
        return amount;
    }

    // ------------------------------------------------------------------
    // Raffle draw + prize claim + reclaim
    // ------------------------------------------------------------------

    /// @notice Draw the raffle after it ends. Callable by anyone.
    /// @dev Partial Fisher–Yates driven by keccak256(seed, index); anyone
    ///      can recompute the winners from the entry list and the seed.
    ///      If the seed block's hash aged out of the 256-block window,
    ///      the previous block's hash is the documented fallback and
    ///      `usedFallbackSeed` is set — the draw can never get stuck.
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

        uint256[] memory idx = new uint256[](n);
        for (uint256 i = 0; i < n; i++) idx[i] = i;
        for (uint256 i = 0; i < k; i++) {
            uint256 j = i + (uint256(keccak256(abi.encode(seed, i))) % (n - i));
            (idx[i], idx[j]) = (idx[j], idx[i]);
            address w = _entries[id][idx[i]];
            _winners[id].push(w);
            isWinner[id][w] = true;
        }
        emit Drawn(id, seed, usedFallback, k);
    }

    /// @notice Winners claim their escrowed prize share on-chain.
    function claimPrize(uint256 id) external nonReentrant {
        Campaign storage c = _campaigns[id];
        require(c.kind == Kind.Raffle, "not a raffle");
        if (!c.drawn) revert NotEnded();
        if (!isWinner[id][msg.sender]) revert NotWinner();
        if (prizeClaimed[id][msg.sender]) revert AlreadyCounted();
        prizeClaimed[id][msg.sender] = true;
        c.paidOut += c.prizePerWinner;
        emit PrizeClaimed(id, msg.sender, c.prizePerWinner);
        _pay(c.prizeToken, msg.sender, c.prizePerWinner);
    }

    /// @notice Creator reclaims whatever was never paid out:
    ///         Claim pools — the remainder after the campaign ends.
    ///         Raffles — unclaimed prize shares 30 days after the end
    ///         (winners keep the full window to claim first).
    function reclaim(uint256 id) external nonReentrant {
        Campaign storage c = _campaigns[id];
        if (msg.sender != c.creator) revert NotCreator();
        if (c.reclaimed) revert AlreadyCounted();
        uint256 total;
        if (c.kind == Kind.Claim) {
            if (block.timestamp <= c.endAt) revert TooEarly();
            total = c.pool;
        } else if (c.kind == Kind.Raffle) {
            if (block.timestamp <= c.endAt + PRIZE_CLAIM_WINDOW) revert TooEarly();
            total = c.prizePerWinner * c.winnerCount;
        } else {
            revert BadParams();
        }
        uint256 remainder = total - c.paidOut;
        c.reclaimed = true;
        c.paidOut = total;
        emit Reclaimed(id, msg.sender, remainder);
        _pay(c.prizeToken, msg.sender, remainder);
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
