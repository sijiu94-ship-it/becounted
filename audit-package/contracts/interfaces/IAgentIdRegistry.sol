// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal read interface for the Binance Agent ID registry
///         (SPACE ID Agent ID, BNB Chain mainnet:
///         0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F).
/// @dev The official hackathon docs define the holding check as
///      `balanceOf(address) > 0`. The NFT is non-transferable and one
///      KYC can claim only one, so a positive balance is a structural
///      "unique human" signal, not a policy score.
interface IAgentIdRegistry {
    function balanceOf(address owner) external view returns (uint256);
}
