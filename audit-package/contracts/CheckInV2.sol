// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal read interface for the BeCounted gate primitive.
interface IBeCountedGate {
    function isHuman(address account) external view returns (bool);
}

/// @title CheckInV2 — one check-in per human per day, feeding an activity weight
/// @notice V2 (2026-11-27): identical to CheckIn V1 except the weight
///         window is 14 days instead of 30 (product decision: a two-week
///         rhythm matches the campaign cadence better). This is a FRESH
///         deployment — V1 check-in history does not carry over; V1 stays
///         deployed and readable as the historical record.
/// @notice Agent ID holders check in once per day. The number of check-in
///         days inside the trailing 14-day window is the holder's activity
///         weight (weight = 1 + days), readable on-chain by anyone and
///         independently recomputable from the CheckedIn event log.
///
/// @dev DESIGN.
///      - Gate first: checkIn() asks the BeCounted primitive (keyed by
///        ADDRESS, like every gate question) and reverts for non-holders.
///        One KYC = one Agent ID = one check-in per day; there is no way
///        to farm extra days with extra addresses, because extra
///        addresses do not pass the gate.
///      - Day boundary is Beijing time (CST, UTC+8): the audience's day,
///        matching the rest of the project's daily cadence.
///        dayIndex = (block.timestamp + 8 hours) / 86400.
///      - Weight window: per user we store a 32-bit sliding bitmap
///        anchored at lastDay — bit i means "checked in on day
///        lastDay - i". A check-in shifts the bitmap by the day gap and
///        sets bit 0. weightOf() re-anchors the bitmap at TODAY before
///        counting, so days slide out of the 14-day window as time
///        passes even if the user never checks in again.
///      - totalCheckIns is a separate lifetime counter: it never
///        decreases and is NOT the weight. History (via events) and
///        totals stay visible after days age out of the window.
///      - Ownerless, non-upgradeable, no funds ever enter this contract:
///        there is nothing to withdraw and nobody who could.
///      Campaigns decide for themselves whether to read weightOf();
///      this contract only keeps the public, verifiable record.
contract CheckInV2 {
    /// @notice The BeCounted gate this contract asks. Immutable.
    IBeCountedGate public immutable gate;

    /// @notice Weight counts check-in days inside this trailing window.
    uint256 public constant WINDOW_DAYS = 14;

    /// @dev lastDay anchors `window`: bit i = checked in on lastDay - i.
    ///      lastDay == 0 means "never checked in" (real day indexes are
    ///      far above zero for any plausible block timestamp).
    struct Record {
        uint64 lastDay;
        uint32 window;
        uint256 total;
    }

    mapping(address => Record) private _records;

    event CheckedIn(address indexed user, uint256 dayIndex, uint256 totalCheckIns);

    error NotHuman(address account);
    error AlreadyCheckedIn(address account, uint256 dayIndex);

    constructor(address gate_) {
        require(gate_ != address(0), "gate is zero");
        // Same deployment guard as BeCounted: an EOA "gate" would make
        // every isHuman read decode garbage/revert forever.
        require(gate_.code.length > 0, "gate has no code");
        gate = IBeCountedGate(gate_);
    }

    /// @notice Current day index under the Beijing-time day boundary.
    function todayIndex() public view returns (uint256) {
        return (block.timestamp + 8 hours) / 1 days;
    }

    /// @notice Check in for today. Holders only, once per day.
    function checkIn() external {
        if (!gate.isHuman(msg.sender)) revert NotHuman(msg.sender);
        uint256 today = todayIndex();
        Record storage r = _records[msg.sender];
        if (r.lastDay != 0) {
            uint256 gap = today - uint256(r.lastDay);
            if (gap == 0) revert AlreadyCheckedIn(msg.sender, today);
            // Re-anchor the bitmap at today. Bits pushed past bit 31 are
            // >= 32 days old — outside the stored frame and the weight
            // window alike; uint32 shift truncation is exactly that.
            r.window = gap >= 32 ? uint32(1) : (r.window << gap) | 1;
        } else {
            r.window = 1;
        }
        r.lastDay = uint64(today);
        r.total += 1;
        emit CheckedIn(msg.sender, today, r.total);
    }

    /// @notice Check-in days inside the trailing 14-day window, as of now.
    function windowCountOf(address user) public view returns (uint256) {
        Record storage r = _records[user];
        if (r.lastDay == 0 || r.window == 0) return 0;
        uint256 gap = todayIndex() - uint256(r.lastDay);
        if (gap >= WINDOW_DAYS) return 0;
        // Re-anchor at today: the day stored at bit i is now gap + i
        // days old, so in today's frame the bitmap shifts LEFT by gap;
        // the mask keeps exactly the last WINDOW_DAYS days.
        uint256 shifted = (uint256(r.window) << gap) & ((1 << WINDOW_DAYS) - 1);
        return _popcount(shifted);
    }

    /// @notice Activity weight: 1 + check-in days in the trailing window.
    ///         Everyone starts at 1 — checking in only ever adds.
    function weightOf(address user) external view returns (uint256) {
        return 1 + windowCountOf(user);
    }

    /// @notice Lifetime check-in count (never slides out, never decreases).
    function totalCheckInsOf(address user) external view returns (uint256) {
        return _records[user].total;
    }

    /// @notice Day index of the user's most recent check-in (0 = never).
    function lastCheckInDayOf(address user) external view returns (uint256) {
        return _records[user].lastDay;
    }

    /// @notice Whether the user has already checked in today.
    function hasCheckedInToday(address user) external view returns (bool) {
        Record storage r = _records[user];
        return r.lastDay != 0 && uint256(r.lastDay) == todayIndex();
    }

    /// @notice Raw stored record, for indexers and independent recomputation.
    function recordOf(address user) external view returns (uint64 lastDay, uint32 window, uint256 total) {
        Record storage r = _records[user];
        return (r.lastDay, r.window, r.total);
    }

    /// @dev Popcount over a value already masked to <= 14 bits.
    function _popcount(uint256 x) internal pure returns (uint256 count) {
        while (x != 0) {
            count += x & 1;
            x >>= 1;
        }
    }
}
