// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// IdentityProfile — on-chain profile extension for the BeCounted card.
//
// This is the self-asserted display layer, kept deliberately separate
// from both the BeCounted primitive (stateless, read-only) and
// IdentityBindings (signature-verified statements). A profile is a
// one-line bio plus up to five links, registered by the wallet owner
// for their own address only.
//
// A profile proves nothing by itself: anyone can write anything here.
// Its value is purely presentational — it lets a card page show a
// short intro and the owner's chosen links next to the verified facts
// (Agent ID holding, X binding), and display code must keep the two
// visually separate: verified facts are checked, profile content is
// self-asserted.
//
// Boundaries, same as everywhere in BeCounted: the mapping is keyed
// by address only — there is no lookup by bio, link, or name; there
// is no owner, no admin, and no upgrade path; registering, editing,
// and removing a profile are voluntary acts of the wallet owner, and
// every address manages only its own profile.
contract IdentityProfile {
    struct Link {
        string title;
        string url;
    }

    struct Profile {
        string bio;
        Link[] links;
        uint64 updatedAt;
    }

    uint256 public constant MAX_BIO_BYTES = 160;
    uint256 public constant MAX_LINKS = 5;
    uint256 public constant MAX_TITLE_BYTES = 40;
    uint256 public constant MAX_URL_BYTES = 200;

    mapping(address => Profile) private _profiles;

    event ProfileSet(address indexed who, uint8 linkCount);
    event ProfileRemoved(address indexed who);

    error BioTooLong();
    error TooManyLinks();
    error TitleTooLong();
    error BadUrl();

    // Register (or replace) the caller's profile. Validation is
    // byte-length based, so multi-byte characters count by their
    // UTF-8 bytes, not by character count.
    function setProfile(string calldata bio, Link[] calldata links) external {
        if (bytes(bio).length > MAX_BIO_BYTES) revert BioTooLong();
        if (links.length > MAX_LINKS) revert TooManyLinks();
        for (uint256 i = 0; i < links.length; i++) {
            if (bytes(links[i].title).length > MAX_TITLE_BYTES) revert TitleTooLong();
            bytes memory u = bytes(links[i].url);
            if (u.length > MAX_URL_BYTES || !_isHttps(u)) revert BadUrl();
        }
        Profile storage p = _profiles[msg.sender];
        p.bio = bio;
        delete p.links;
        for (uint256 i = 0; i < links.length; i++) {
            p.links.push(links[i]);
        }
        p.updatedAt = uint64(block.timestamp);
        emit ProfileSet(msg.sender, uint8(links.length));
    }

    // Remove the caller's profile. Display everywhere reverts to the
    // bare card (verified facts only).
    function removeProfile() external {
        delete _profiles[msg.sender];
        emit ProfileRemoved(msg.sender);
    }

    // Read an address's profile. An address that never registered (or
    // removed its profile) returns an empty bio, no links, and
    // updatedAt == 0.
    function profileOf(address who) external view returns (string memory bio, Link[] memory links, uint64 updatedAt) {
        Profile storage p = _profiles[who];
        return (p.bio, p.links, p.updatedAt);
    }

    // ----- internals -----

    function _isHttps(bytes memory u) internal pure returns (bool) {
        bytes memory prefix = bytes("https://");
        if (u.length < prefix.length) return false;
        for (uint256 i = 0; i < prefix.length; i++) {
            if (u[i] != prefix[i]) return false;
        }
        return true;
    }
}
