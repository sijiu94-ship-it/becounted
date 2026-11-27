// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IdentityBindingsV4 — on-chain registry of X (Twitter) bindings.
///
/// @notice V4 (2026-11-26) = V3 with the registrar-attestation path REMOVED
///         and a self-registration path added. Rationale, decided with the
///         operator after the attestation path ran live:
///
///         1. SINGLE SELF-SERVICE CHANNEL — V2/V3 attestation made an
///            Agentic Wallet holder wait for a human registrar to verify
///            their public post and register them. In practice that meant
///            delay, a manual queue, and a disclosed-but-real trust point
///            doing data entry. V4 removes `registerByAttestation`
///            entirely: registration is something a holder does, not
///            something done to them.
///
///         2. SELF-REGISTRATION (proofType 2) — the holder posts the
///            public template post (X handle + Agent ID name + a Proof
///            code derived from their address — never the address
///            itself), hands the post link to their own agent, and the
///            agent verifies it (author, exact template, Proof recomputed
///            from the agent's own wallet address) and calls
///            `registerSelf(handle, tweetId)` from the holder's wallet.
///            On-chain, the address side is proven by construction (only
///            the holder's wallet can call as that address); the account
///            side is a claim anchored to the tweet's status id, stored
///            in `proofRef` — permanently public and falsifiable by
///            anyone, forever. The template is fixed and every variable
///            in it is on-chain or recomputable, so the registration
///            record itself preserves exactly what was claimed; deleting
///            the post afterwards changes nothing about the record.
///
///         3. REGISTRATION COOLDOWN — every successful registration
///            (signature or self) stamps `lastRegisteredAt`; a further
///            registration within COOLDOWN (24 hours) reverts. Removing
///            a binding and being revoked do NOT reset the stamp, so
///            handle-rotation abuse and revoke/rebind harassment are
///            capped at once per day per address. A first registration
///            is never blocked.
///
///         4. THE REGISTRAR'S ONLY REMAINING POWER — revoke a
///            self-registration (`revokeSelfRegistration`). Its
///            legitimate scope is published in advance and narrow: only
///            a provably false binding (the anchored tweet does not
///            exist, or its author is not the registered handle — anyone
///            can check against `proofRef`). Every revocation is an
///            on-chain event, publicly auditable. Revocation deletes
///            only the binding record; it cannot touch the holder's
///            Agent ID, check-ins, or campaign entries, and the holder
///            can re-register with a genuine post (after the cooldown).
///            Signature bindings (proofType 0) remain untouchable by
///            the registrar, as in every previous version.
///
///         Carried over from V3 unchanged: the signature path
///         (EIP-191 personal_sign over the canonical statement, low-s
///         rule), registrar rotation for the revocation role, handle
///         validation, and the statement format.
///
///         Boundaries, same as everywhere in BeCounted: a binding proves
///         sameness, never trustworthiness; there is no lookup by handle
///         (the mapping is keyed by address only); registering is a
///         voluntary public act by the wallet owner — the address/handle
///         pairing becomes permanently public on-chain.
contract IdentityBindingsV4 {
    struct Binding {
        string handle; // X handle, lowercase, without "@"
        bytes signature; // EIP-191 personal_sign over the canonical statement (empty for self-registered bindings)
        uint64 registeredAt;
        uint8 proofType; // 0 = wallet signature, 2 = self-registered (tweet-referenced)
        uint256 proofRef; // X status id of the verification post (proofType 2 only; 0 otherwise)
    }

    /// @notice Minimum delay between two registrations from the same
    ///         address (both paths). Anti-rotation / anti-harassment.
    uint256 public constant COOLDOWN = 24 hours;

    /// @notice The only address allowed to revoke self-registrations.
    ///         Set at construction to the deployer; the role can be
    ///         handed over with `transferRegistrar`. There is no other
    ///         admin power (signature bindings are untouchable, and no
    ///         one can register a binding for someone else).
    address public registrar;

    mapping(address => Binding) private _bindings;

    /// @notice Last successful registration time per address. Set by
    ///         both registration paths; NEVER cleared by removeBinding
    ///         or by revocation — that is what makes the cooldown
    ///         unbypassable.
    mapping(address => uint64) public lastRegisteredAt;

    event BindingRegistered(address indexed who, string handle);
    event SelfBindingRegistered(address indexed who, string handle, uint256 tweetId);
    event SelfBindingRevoked(address indexed who);
    event BindingRemoved(address indexed who);
    event RegistrarTransferred(address indexed previousRegistrar, address indexed newRegistrar);

    error BadHandle();
    error BadSignature();
    error NotRegistrar();
    error ProofDowngrade();
    error BadRegistrar();
    error BadEvidence();
    error CooldownActive();
    error NotSelfRegistered();

    constructor() {
        registrar = msg.sender;
    }

    /// @notice Hand the registrar (revocation) role to a new address.
    ///         Current registrar only; the zero address is rejected so
    ///         the role can never be burned by accident. Existing
    ///         bindings (both proof types) are unaffected.
    function transferRegistrar(address newRegistrar) external {
        if (msg.sender != registrar) revert NotRegistrar();
        if (newRegistrar == address(0)) revert BadRegistrar();
        address previous = registrar;
        registrar = newRegistrar;
        emit RegistrarTransferred(previous, newRegistrar);
    }

    /// @notice Register (or replace) the caller's X binding with a
    ///         wallet signature. The signature must recover to the
    ///         caller over the canonical statement rebuilt from
    ///         (handle, caller). Subject to the registration cooldown.
    function registerBinding(string calldata handle, bytes calldata signature) external {
        _validateHandle(handle);
        if (!_verify(msg.sender, handle, signature)) revert BadSignature();
        _checkCooldown(msg.sender);
        _bindings[msg.sender] = Binding({
            handle: handle,
            signature: signature,
            registeredAt: uint64(block.timestamp),
            proofType: 0,
            proofRef: 0
        });
        lastRegisteredAt[msg.sender] = uint64(block.timestamp);
        emit BindingRegistered(msg.sender, handle);
    }

    /// @notice Register (or replace) the caller's X binding by
    ///         self-registration: the caller anchors the binding to a
    ///         public verification post whose status id is `tweetId`.
    ///         The post itself is verified off-chain by the caller's
    ///         own agent before calling (see header); on-chain, the
    ///         claim is permanently falsifiable against `proofRef`.
    ///         Cannot overwrite a signature binding. Subject to the
    ///         registration cooldown.
    function registerSelf(string calldata handle, uint256 tweetId) external {
        _validateHandle(handle);
        if (tweetId == 0) revert BadEvidence();
        _checkCooldown(msg.sender);
        Binding storage existing = _bindings[msg.sender];
        if (bytes(existing.handle).length != 0 && existing.proofType == 0) revert ProofDowngrade();
        _bindings[msg.sender] = Binding({
            handle: handle,
            signature: "",
            registeredAt: uint64(block.timestamp),
            proofType: 2,
            proofRef: tweetId
        });
        lastRegisteredAt[msg.sender] = uint64(block.timestamp);
        emit SelfBindingRegistered(msg.sender, handle, tweetId);
    }

    /// @notice Revoke a self-registered binding (provably false claim:
    ///         the anchored post does not exist or its author is not
    ///         the registered handle). Registrar only. Signature
    ///         bindings cannot be revoked. The cooldown stamp is left
    ///         untouched, so a revoked abuser cannot immediately
    ///         re-register under another handle.
    function revokeSelfRegistration(address who) external {
        if (msg.sender != registrar) revert NotRegistrar();
        Binding storage b = _bindings[who];
        if (bytes(b.handle).length == 0 || b.proofType != 2) revert NotSelfRegistered();
        delete _bindings[who];
        emit SelfBindingRevoked(who);
    }

    /// @notice 0 = wallet signature, 2 = self-registered,
    ///         255 = no binding. Displays must label the proof type.
    function proofTypeOf(address who) external view returns (uint8) {
        Binding storage b = _bindings[who];
        if (bytes(b.handle).length == 0) return 255;
        return b.proofType;
    }

    /// @notice The X status id anchoring a self-registered binding
    ///         (0 for signature bindings and unbound addresses).
    function proofRefOf(address who) external view returns (uint256) {
        return _bindings[who].proofRef;
    }

    /// @notice Remove the caller's binding. Display everywhere reverts
    ///         to the bare address. Does NOT reset the cooldown stamp.
    function removeBinding() external {
        delete _bindings[msg.sender];
        emit BindingRemoved(msg.sender);
    }

    function bindingOf(address who) external view returns (string memory handle, bytes memory signature, uint64 registeredAt) {
        Binding storage b = _bindings[who];
        return (b.handle, b.signature, b.registeredAt);
    }

    /// @notice Re-verify a stored binding. Display code should require
    ///         this to be true before showing a handle.
    function isBindingValid(address who) external view returns (bool) {
        Binding storage b = _bindings[who];
        if (bytes(b.handle).length == 0) return false;
        if (b.proofType == 2) return true; // self-registered: stands until revoked or removed
        return _verify(who, b.handle, b.signature);
    }

    /// @notice The canonical statement for (handle, who). Frontends must
    ///         sign exactly this string.
    function statementFor(string calldata handle, address who) external pure returns (string memory) {
        return _statement(handle, who);
    }

    // ----- internals -----

    function _checkCooldown(address who) internal view {
        uint64 last = lastRegisteredAt[who];
        if (last != 0 && block.timestamp < uint256(last) + COOLDOWN) revert CooldownActive();
    }

    function _statement(string memory handle, address who) internal pure returns (string memory) {
        return string(
            abi.encodePacked("BeCounted X binding\nHandle: @", handle, "\nAddress: ", _toHexString(who), "\nNetwork: BNB Chain")
        );
    }

    function _verify(address who, string memory handle, bytes memory signature) internal pure returns (bool) {
        if (signature.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return false;
        // EIP-2 low-s rule — reject the malleable high-s form
        // (n / 2 = 0x7FFF...20A0 for secp256k1). The flipped copy of a
        // valid signature recovers the same signer, so this is pure
        // canonicalisation, but a registry that stores signatures as
        // evidence should only ever store the canonical one.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return false;
        string memory stmt = _statement(handle, who);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", _uintToString(bytes(stmt).length), stmt));
        return ecrecover(digest, v, r, s) == who;
    }

    function _validateHandle(string calldata handle) internal pure {
        bytes memory h = bytes(handle);
        if (h.length == 0 || h.length > 15) revert BadHandle();
        for (uint256 i = 0; i < h.length; i++) {
            bytes1 ch = h[i];
            bool ok = (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || ch == "_";
            if (!ok) revert BadHandle();
        }
    }

    function _toHexString(address a) internal pure returns (string memory) {
        bytes memory out = new bytes(42);
        out[0] = "0";
        out[1] = "x";
        bytes memory hexChars = "0123456789abcdef";
        uint160 v = uint160(a);
        for (uint256 i = 41; i > 1; i--) {
            out[i] = hexChars[v & 0xf];
            v >>= 4;
        }
        return string(out);
    }

    function _uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 digits;
        uint256 t = v;
        while (t > 0) {
            digits++;
            t /= 10;
        }
        bytes memory out = new bytes(digits);
        while (v > 0) {
            out[--digits] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(out);
    }
}
