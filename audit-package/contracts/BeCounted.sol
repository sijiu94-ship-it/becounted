// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentIdRegistry} from "./interfaces/IAgentIdRegistry.sol";

/// @title BeCounted — a stateless "unique human" gate primitive for Agent ID
/// @notice Any contract or off-chain agent can ask one question:
///         "is there a unique, KYC-anchored human behind this address?"
///         and get an answer it does not need to trust us for — the proof
///         is the Agent ID registry itself, readable by anyone.
///
/// @dev DESIGN — the two-key principle.
///      Sybil resistance is two different questions, and they need two
///      different keys:
///        Q1 "Is this address backed by a unique human?"
///           → keyed by ADDRESS, asked on every call. This contract.
///        Q2 "Has this human already been counted in my campaign?"
///           → keyed by AGENT ID, asked once per campaign. That state is
///             the CALLER's own bookkeeping and deliberately does NOT
///             live here. (Because the Agent ID is non-transferable and
///             bound to a single wallet, per-campaign dedup by the
///             holding address is equivalent to dedup by the ID.)
///      Keeping this primitive stateless is what lets it be:
///        - read-only (view), - ownerless, - non-upgradeable,
///        - deployed once and never touched again.
///
///      BOUNDARIES (deliberate, and aligned with the hackathon rules):
///        - No reverse lookup: we answer address → human?, never
///          name → wallet. This is a gate, not a surveillance tool.
///        - No character judgement: a valid ID means "same unique
///          person", never "trustworthy person".
///        - No sybil hunting: we do not cluster or score addresses.
///          The second address simply does not pass the gate.
contract BeCounted {
    /// @notice The Agent ID registry this gate reads. Immutable.
    IAgentIdRegistry public immutable registry;

    error NotHuman(address account);

    constructor(address registry_) {
        require(registry_ != address(0), "registry is zero");
        // An EOA "registry" would make every balanceOf read decode
        // garbage/revert forever; fail at deployment instead
        // (2026-11-23 security-fix batch).
        require(registry_.code.length > 0, "registry has no code");
        registry = IAgentIdRegistry(registry_);
    }

    /// @notice Q1: is this address backed by a unique human (holds an Agent ID)?
    /// @param account The address to check.
    /// @return True if the address holds at least one Agent ID.
    function isHuman(address account) public view returns (bool) {
        return registry.balanceOf(account) > 0;
    }

    /// @notice Same as isHuman, named for integrators who think in Agent ID terms.
    function hasAgentId(address account) external view returns (bool) {
        return isHuman(account);
    }

    /// @notice Gate helper for integrators: reverts unless the caller
    ///         (or a given account) is backed by a unique human.
    function requireHuman(address account) external view {
        if (!isHuman(account)) revert NotHuman(account);
    }
}
