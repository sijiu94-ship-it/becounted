// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockRegistryV2 — TEST ONLY stand-in for the Agent ID registry, with handles
/// @notice MockAgentIdRegistry only models `balanceOf`. The real registry
///         (SPACE ID Agent ID, BNB mainnet) also answers `handleOf` —
///         address -> bare label ("9nosing", no ".ai" suffix) — which
///         OneIDCampaignsV10's condition 5 reads, so trials of that
///         condition need a mock that mirrors both reads:
///           - `issue(to)` (issuer only): grants an ID with NO handle,
///             like the old mock — an address can pass the human gate
///             yet have no name to put on an identity list;
///           - `registerHandle(handle)`: an address claims a unique
///             handle for itself; on the real registry the name IS the
///             ID, so claiming one also marks the address as holding
///             an ID (balanceOf becomes 1).
///         Handle uniqueness is enforced, as on the real registry.
///         TEST ONLY: never used on mainnet.
contract MockRegistryV2 {
    mapping(address => uint256) private _balances;
    mapping(address => string) private _handles;
    mapping(bytes32 => address) private _handleHolder;

    address public immutable issuer;

    constructor() {
        issuer = msg.sender;
    }

    /// @notice Grant a test Agent ID with no handle (issuer only).
    function issue(address to) external {
        require(msg.sender == issuer, "not issuer");
        _balances[to] = 1;
    }

    /// @notice Claim (or change) the caller's own handle. Unique across
    ///         holders; claiming also marks the caller as holding an ID.
    function registerHandle(string calldata handle) external {
        bytes memory h = bytes(handle);
        require(h.length > 0, "empty handle");
        bytes32 lh = keccak256(h);
        address holder = _handleHolder[lh];
        require(holder == address(0) || holder == msg.sender, "handle taken");
        bytes memory old = bytes(_handles[msg.sender]);
        if (old.length > 0) delete _handleHolder[keccak256(old)];
        _handleHolder[lh] = msg.sender;
        _handles[msg.sender] = handle;
        _balances[msg.sender] = 1;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    /// @notice The bare label of the ID `who` holds; "" when none.
    function handleOf(address who) external view returns (string memory) {
        return _handles[who];
    }
}
