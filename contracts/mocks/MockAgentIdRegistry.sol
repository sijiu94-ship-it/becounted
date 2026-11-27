// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockAgentIdRegistry — TEST ONLY stand-in for the real registry
/// @notice The real Agent ID registry exists only on BNB Chain mainnet.
///         For BNB testnet trials we deploy this mock and issue test IDs
///         to trial wallets. It implements only what BeCounted reads:
///         balanceOf. It is never used on mainnet.
contract MockAgentIdRegistry {
    mapping(address => uint256) private _balances;
    address public immutable issuer;

    constructor() {
        issuer = msg.sender;
    }

    /// @notice Issue a test Agent ID to `to` (issuer only, testnet only).
    function issue(address to) external {
        require(msg.sender == issuer, "not issuer");
        _balances[to] = 1;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }
}
