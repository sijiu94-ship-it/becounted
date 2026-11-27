// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test mock for the V18 N6 regression: an ERC20-style gate
///         token whose balanceOf, when armed, attempts a low-level
///         reentrant call into the campaigns contract's enterRaffle.
///         balanceOf always reports a large balance so the gate check
///         itself passes. The campaigns contract calls balanceOf via
///         STATICCALL (view interface), so the mock cannot record the
///         attempt — the test instead asserts the campaigns-side
///         state stayed exact: exactly one entry, no corruption.
contract ReentrantGateToken {
    address public target;
    uint256 public campaignId;
    bool public armed;

    function arm(address target_, uint256 campaignId_) external {
        target = target_;
        campaignId = campaignId_;
        armed = true;
    }

    function balanceOf(address) external returns (uint256) {
        if (armed) {
            bytes32[] memory empty = new bytes32[](0);
            // The reentry attempt: in the static context this nested
            // call can never complete a state change; with V18's
            // nonReentrant it is stopped at the door regardless.
            (bool ok, ) = target.call(
                abi.encodeWithSignature("enterRaffle(uint256,bytes32[],bytes32[])", campaignId, empty, empty)
            );
            ok; // silence unused warning; outcome asserted on campaigns state
        }
        return 1000;
    }
}
