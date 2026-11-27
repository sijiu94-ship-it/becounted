// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC20 that skims 10% of every transfer / transferFrom to a
///         sink — the fee-on-transfer shape the 2026-11-23 security
///         probes used to demonstrate escrow insolvency against
///         nominal-amount accounting. Test-only: the fixed contracts
///         (OneIDCampaignsV11, QuestPass, GatedClaim) must REJECT this
///         token at funding time via their received-amount check.
///         Never deployed to mainnet.
contract MockFeeERC20 {
    string public name = "Mock Fee USD";
    string public symbol = "mfUSD";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public constant SINK = address(0xdead);

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        uint256 fee = amount / 10;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        balanceOf[SINK] += fee;
        emit Transfer(from, to, amount - fee);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        _move(from, to, amount);
        return true;
    }
}
