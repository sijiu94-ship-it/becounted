// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BeCounted.sol";

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// @title QuestPass — a multi-day expedition for verified humans.
/// @notice One season, seven stamp days, one finale. Every day of the
///         season a verified human (Agent ID holder, checked through
///         BeCounted) can claim that day's stamp: a small lucky-draw
///         payout from the day's own sub-pool, paid instantly. Stamps
///         accumulate per address. After the stamp phase, addresses
///         holding at least `minStamps` stamps may enter the finale —
///         a raffle whose escrowed prizes are drawn with the same
///         reproducible Fisher–Yates algorithm as OneIDCampaigns:
///         the seed comes from a block whose hash is fixed on-chain
///         after entries close, and anyone can recompute the winners
///         from the entry list and the seed in the FinaleDrawn event.
///
/// @dev Two-key design, same as the rest of BeCounted: the gate answers
///      "is a unique human?" (keyed by address, stateless); THIS
///      contract keeps the season state (stamp counts keyed by
///      participant — effectively by Agent ID, since the ID is
///      non-transferable and lives in exactly one wallet).
///
///      Season shape is fixed at construction and can never change:
///      7 stamp days of 24h each, then a finale entry window, then the
///      draw. All funds are escrowed at construction (stamp pool +
///      finale pool). Every unit is either paid to a stamper or a
///      finale winner, or reclaimable by the creator once the finale
///      prize-claim window (30 days after the entry window closes)
///      has passed. The contract has no owner and no admin functions;
///      the creator's only power is that final reclaim.
///
///      The stamp payout randomness is the same entertainment-grade
///      pseudo-randomness as OneIDCampaigns (previous blockhash,
///      claimant, nonce): fine for small daily amounts, and labelled
///      as such everywhere. No yield is promised anywhere, by design.
contract QuestPass {
    uint256 public constant STAMP_DAYS = 7;
    uint256 public constant DAY = 1 days;
    uint256 public constant PRIZE_CLAIM_WINDOW = 30 days;

    BeCounted public immutable gate;
    address public immutable creator;
    /// @notice Prize token; address(0) = BNB.
    address public immutable token;
    /// @notice Season start (stamp day 0 begins).
    uint64 public immutable startAt;
    /// @notice Stamp slots available per day.
    uint32 public immutable slotsPerDay;
    /// @notice Stamp sub-pool per day; total stamp pool = dayPool * 7.
    uint256 public immutable dayPool;
    uint256 public immutable stampPool;
    /// @notice Stamps required to enter the finale.
    uint32 public immutable minStamps;
    /// @notice Finale winners drawn.
    uint32 public immutable winnerCount;
    uint256 public immutable finalePool;
    uint256 public immutable prizePerWinner;
    /// @notice Finale entry window length (seconds), after stamp phase.
    uint64 public immutable entryWindow;

    mapping(address => uint8) public stampBitmap; // bit d set = stamped day d
    mapping(address => uint32) public stampCount;
    mapping(uint32 => uint256) public dayPaid;
    mapping(uint32 => uint32) public dayClaims;
    uint256 public stampPaidTotal;
    uint256 public finalePaidTotal;

    address[] private _finaleEntries;
    mapping(address => bool) public hasEnteredFinale;
    address[] private _winners;
    mapping(address => bool) public isWinner;
    mapping(address => bool) public prizeClaimed;
    bool public finaleDrawn;
    bool public usedFallbackSeed;
    uint64 public finaleSeedBlock; // 0 until locked
    bool public reclaimed;
    /// @notice Set when the creator's reclaim has run: the season is
    ///         closed for good and late prize claims revert with the
    ///         explicit SeasonClosed instead of an opaque payout
    ///         failure (2026-11-23 security-fix batch).
    bool public finaleReclaimed;

    event Stamped(address indexed who, uint32 day, uint256 amount);
    event FinaleEntered(address indexed who);
    event FinaleSeedLocked(uint64 seedBlock);
    event FinaleDrawn(uint256 seed, bool usedFallbackSeed, uint256 winnerCount);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event Reclaimed(address indexed creator, uint256 amount);

    error NotHuman();
    error AlreadyCounted();
    error NotOpen();
    error NotEnded();
    error AlreadyDrawn();
    error BadParams();
    error WrongValue();
    error NotWinner();
    error NotCreator();
    error NoSlots();
    error TooEarly();
    error NotEligible();
    error TransferFailed();
    /// @notice Escrow transfer landed short (fee-on-transfer token):
    ///         the balance delta must equal the funded amount exactly.
    error InsufficientReceived();
    /// @notice Prize claim after the creator's reclaim closed the season.
    error SeasonClosed();

    uint256 private _nonce;
    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(
        address gate_,
        address token_,
        uint64 startAt_,
        uint32 slotsPerDay_,
        uint256 dayPool_,
        uint32 minStamps_,
        uint32 winnerCount_,
        uint256 finalePool_,
        uint64 entryWindow_
    ) payable {
        if (gate_ == address(0)) revert BadParams();
        if (slotsPerDay_ == 0 || dayPool_ < slotsPerDay_) revert BadParams();
        if (minStamps_ == 0 || minStamps_ > STAMP_DAYS) revert BadParams();
        if (winnerCount_ == 0) revert BadParams();
        if (finalePool_ > 0 && finalePool_ < winnerCount_) revert BadParams();
        if (entryWindow_ == 0) revert BadParams();
        if (uint256(startAt_) + STAMP_DAYS * DAY <= block.timestamp) revert BadParams();
        gate = BeCounted(gate_);
        creator = msg.sender;
        token = token_;
        startAt = startAt_;
        slotsPerDay = slotsPerDay_;
        dayPool = dayPool_;
        stampPool = dayPool_ * STAMP_DAYS;
        minStamps = minStamps_;
        winnerCount = winnerCount_;
        finalePool = finalePool_;
        prizePerWinner = finalePool_ / winnerCount_;
        entryWindow = entryWindow_;
        _fund(token_, stampPool + finalePool_);
    }

    // ------------------------------------------------------------------
    // Funding helpers (mirrors OneIDCampaigns)
    // ------------------------------------------------------------------

    function _fund(address token_, uint256 total) internal {
        if (total == 0) {
            if (msg.value != 0) revert WrongValue();
            return;
        }
        if (token_ == address(0)) {
            if (msg.value != total) revert WrongValue();
        } else {
            if (msg.value != 0) revert WrongValue();
            // Account by what ACTUALLY arrived (see OneIDCampaignsV11):
            // a fee-on-transfer token must not under-collateralise the
            // season escrow, so a short landing reverts construction.
            uint256 before = IERC20Minimal(token_).balanceOf(address(this));
            if (!IERC20Minimal(token_).transferFrom(msg.sender, address(this), total)) revert TransferFailed();
            if (IERC20Minimal(token_).balanceOf(address(this)) - before != total) revert InsufficientReceived();
        }
    }

    function _pay(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            if (!IERC20Minimal(token).transfer(to, amount)) revert TransferFailed();
        }
    }

    // ------------------------------------------------------------------
    // Season clock
    // ------------------------------------------------------------------

    function stampEnd() public view returns (uint64) {
        return startAt + uint64(STAMP_DAYS * DAY);
    }

    function entryEnd() public view returns (uint64) {
        return stampEnd() + entryWindow;
    }

    /// @notice Current stamp day (0..6) while the stamp phase runs.
    function currentDay() public view returns (uint32) {
        if (block.timestamp < startAt) return 0;
        uint256 d = (block.timestamp - startAt) / DAY;
        return d >= STAMP_DAYS ? uint32(STAMP_DAYS) : uint32(d);
    }

    /// @notice 0 = before start, 1 = stamp phase, 2 = finale entry,
    ///         3 = entry closed (seed/draw pending), 4 = drawn.
    function phase() public view returns (uint8) {
        if (finaleDrawn) return 4;
        if (block.timestamp < startAt) return 0;
        if (block.timestamp < stampEnd()) return 1;
        if (block.timestamp < entryEnd()) return 2;
        return 3;
    }

    function eligible(address who) public view returns (bool) {
        return stampCount[who] >= minStamps;
    }

    function hasStampedOn(address who, uint32 day) public view returns (bool) {
        if (day >= STAMP_DAYS) return false;
        return (stampBitmap[who] >> day) & 1 == 1;
    }

    // ------------------------------------------------------------------
    // Stamps
    // ------------------------------------------------------------------

    /// @notice Claim today's stamp: one per human per day, paid
    ///         instantly as a lucky-draw share of today's sub-pool
    ///         (double-mean; the day's last slot takes the day's rest).
    function claimStamp() external nonReentrant {
        if (block.timestamp < startAt || block.timestamp >= stampEnd()) revert NotOpen();
        uint32 day = currentDay();
        // Q1, answered by the primitive:
        if (!gate.isHuman(msg.sender)) revert NotHuman();
        // Q2, answered by this contract's own bookkeeping:
        if (hasStampedOn(msg.sender, day)) revert AlreadyCounted();
        if (dayClaims[day] >= slotsPerDay) revert NoSlots();
        uint256 amount = _randomShare(dayPool - dayPaid[day], slotsPerDay - dayClaims[day]);
        stampBitmap[msg.sender] |= uint8(1 << day);
        stampCount[msg.sender] += 1;
        dayClaims[day] += 1;
        dayPaid[day] += amount;
        stampPaidTotal += amount;
        emit Stamped(msg.sender, day, amount);
        _pay(msg.sender, amount);
    }

    /// @dev WeChat-style double-mean draw, identical to OneIDCampaigns:
    ///      uniform in [1, 2 x remaining average]; the final slot takes
    ///      whatever is left. Entertainment-grade pseudo-randomness.
    function _randomShare(uint256 remaining, uint256 slotsLeft) internal returns (uint256) {
        if (slotsLeft == 1) return remaining;
        uint256 avg = remaining / slotsLeft;
        uint256 cap = avg * 2;
        if (cap > remaining) cap = remaining;
        uint256 r = uint256(
            keccak256(abi.encodePacked(blockhash(block.number - 1), msg.sender, address(this), _nonce++))
        );
        uint256 amount = 1 + (r % cap);
        uint256 reserve = slotsLeft - 1; // 1 unit guaranteed per remaining slot
        if (amount > remaining - reserve) amount = remaining - reserve;
        return amount;
    }

    // ------------------------------------------------------------------
    // Finale
    // ------------------------------------------------------------------

    /// @notice Enter the finale. Requires at least `minStamps` stamps;
    ///         one entry per human.
    function enterFinale() external {
        if (block.timestamp < stampEnd() || block.timestamp >= entryEnd()) revert NotOpen();
        if (!gate.isHuman(msg.sender)) revert NotHuman();
        if (!eligible(msg.sender)) revert NotEligible();
        if (hasEnteredFinale[msg.sender]) revert AlreadyCounted();
        hasEnteredFinale[msg.sender] = true;
        _finaleEntries.push(msg.sender);
        emit FinaleEntered(msg.sender);
    }

    /// @notice Fix the finale seed block on-chain once entries have
    ///         closed: the seed is the hash of the block two blocks
    ///         ahead, unknowable while entries were open. Anyone can
    ///         call this.
    /// @dev Re-lockable (2026-11-23 security-fix batch): if a locked
    ///      seed block's hash has aged out of the 256-block blockhash
    ///      window and the finale has not been drawn yet, calling this
    ///      again refreshes the seed block — the stale lock can never
    ///      be drawn from, so the draw cannot be timed to a known
    ///      hash. While a lock is still valid (seed block pending or
    ///      its hash still readable) a second call reverts, so nobody
    ///      can shop for a better seed either.
    function lockFinaleSeed() external {
        if (block.timestamp < entryEnd()) revert TooEarly();
        if (finaleDrawn) revert AlreadyDrawn();
        if (finaleSeedBlock != 0 && block.number <= uint256(finaleSeedBlock) + 256) revert AlreadyCounted();
        finaleSeedBlock = uint64(block.number + 2);
        emit FinaleSeedLocked(finaleSeedBlock);
    }

    /// @notice Draw the finale winners. Callable by anyone once the
    ///         seed block exists. Partial Fisher–Yates driven by
    ///         keccak256(seed, index) — anyone can recompute the
    ///         winners from the entry list and the seed. If the seed
    ///         block's hash aged out of the 256-block window, the
    ///         previous block's hash is the documented fallback and
    ///         `usedFallbackSeed` is set — the draw can never get stuck.
    ///         (The preferred remedy for an aged-out lock is re-locking
    ///         via `lockFinaleSeed`; the fallback remains as a second
    ///         line of defence so the finale can never deadlock.)
    function drawFinale() external {
        if (finaleDrawn) revert AlreadyDrawn();
        if (finaleSeedBlock == 0 || block.number <= finaleSeedBlock) revert NotEnded();
        bytes32 h = blockhash(finaleSeedBlock);
        bool usedFallback = (h == bytes32(0));
        if (usedFallback) {
            h = blockhash(block.number - 1);
            usedFallbackSeed = true;
        }
        uint256 seed = uint256(h);
        finaleDrawn = true;
        uint256 n = _finaleEntries.length;
        uint256 k = winnerCount;
        if (k > n) k = n;
        uint256[] memory idx = new uint256[](n);
        for (uint256 i = 0; i < n; i++) idx[i] = i;
        for (uint256 i = 0; i < k; i++) {
            uint256 j = i + (uint256(keccak256(abi.encode(seed, i))) % (n - i));
            (idx[i], idx[j]) = (idx[j], idx[i]);
            address w = _finaleEntries[idx[i]];
            _winners.push(w);
            isWinner[w] = true;
        }
        emit FinaleDrawn(seed, usedFallback, k);
    }

    /// @notice Finale winners claim their escrowed prize share.
    /// @dev After the creator's reclaim the season is closed: a late
    ///      claim reverts SeasonClosed (an explicit reason) instead of
    ///      failing inside the payout. The not-drawn check comes
    ///      first, so a season that was never drawn still answers
    ///      NotEnded exactly as before.
    function claimPrize() external nonReentrant {
        if (!finaleDrawn) revert NotEnded();
        if (finaleReclaimed) revert SeasonClosed();
        if (!isWinner[msg.sender]) revert NotWinner();
        if (prizeClaimed[msg.sender]) revert AlreadyCounted();
        prizeClaimed[msg.sender] = true;
        finalePaidTotal += prizePerWinner;
        emit PrizeClaimed(msg.sender, prizePerWinner);
        _pay(msg.sender, prizePerWinner);
    }

    /// @notice The creator reclaims whatever was never paid out —
    ///         unclaimed stamp funds and unclaimed finale prizes —
    ///         once the prize-claim window has passed. This is the
    ///         creator's only power, and it cannot touch funds before
    ///         that time.
    function reclaim() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (reclaimed) revert AlreadyCounted();
        if (block.timestamp <= uint256(entryEnd()) + PRIZE_CLAIM_WINDOW) revert TooEarly();
        uint256 remainder = (stampPool + finalePool) - (stampPaidTotal + finalePaidTotal);
        reclaimed = true;
        finaleReclaimed = true;
        emit Reclaimed(msg.sender, remainder);
        _pay(msg.sender, remainder);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function finaleEntryCount() external view returns (uint256) {
        return _finaleEntries.length;
    }

    function getFinaleEntries() external view returns (address[] memory) {
        return _finaleEntries;
    }

    function getWinners() external view returns (address[] memory) {
        return _winners;
    }
}
