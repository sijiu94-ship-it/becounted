// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IdentityBindingsV3 — on-chain registry of X (Twitter) bindings.
///
/// @notice V3 (2026-11-23, pre-mainnet security-fix batch) = V2 + two
///         hardening changes, everything else unchanged:
///           1. LOW-S SIGNATURES — `_verify` now rejects signatures
///              whose s value lies in the upper half of the curve
///              order (EIP-2 rule). A malleable (v^1, r, n-s) copy of
///              a signature recovers the SAME signer, so V2 accepted
///              it; harmless here (a binding can only ever name the
///              signer's own address), but non-canonical signatures
///              have no place in a registry that stores them as
///              public evidence.
///           2. REGISTRAR ROTATION — the registrar is no longer
///              immutable: the current registrar may hand the role to
///              a new address with `transferRegistrar` (RegistrarTransferred
///              event). The role's powers are unchanged (attested
///              bindings only; signature bindings stay untouchable),
///              but a leaked or retired registrar key no longer means
///              redeploying the registry and every binding with it.
///
/// @notice V2 (2026-11-23) adds a second registration path. V1 required a
///         personal_sign signature from the bound address — a proof an
///         Agentic Wallet cannot produce (it exposes no arbitrary
///         signing; its owner participates through an agent). So the one
///         audience bindings exist for could never register. V2 keeps
///         the signature path untouched and adds registrar attestation:
///         the registrar registers a binding after verifying a public X
///         post, authored by the claimed handle, that names the address.
///         Every binding records its proof type on-chain (0 = wallet
///         signature, 1 = public-post attestation) and displays must
///         label it: attestation is operator-witnessed, weaker than a
///         signature, and revocable by the registrar on complaint; it
///         can never overwrite a signature binding.
///
/// @notice This is the social layer, kept deliberately separate from the
///         BeCounted primitive (which stays stateless and read-only).
///
///         A binding is a *statement*, not a trust score: the canonical
///         text below, signed by a wallet, claims "this X account and
///         this address are the same person". Registering it here makes
///         the claim readable everywhere (campaign cards can show a
///         creator's handle) while the matching public tweet — which
///         carries the same signature — remains the public evidence.
///
///         The registry verifies the signature on-chain at registration
///         time: the recovered signer must be the registrant, and the
///         statement is rebuilt from (handle, registrant) inside the
///         contract, so a signature made for anyone else is useless.
///
///         Canonical statement (v2 — the address is lowercase hex so the
///         contract can rebuild the exact string):
///
///             BeCounted X binding
///             Handle: (at)<handle>
///             Address: <0x + 40 lowercase hex chars>
///             Network: BNB Chain
///
///         Boundaries, same as everywhere in BeCounted: a binding proves
///         sameness, never trustworthiness; there is no lookup by handle
///         (the mapping is keyed by address only); display is opt-in —
///         registering is a voluntary public act by the wallet owner.
contract IdentityBindingsV3 {
    struct Binding {
        string handle; // X handle, lowercase, without "@"
        bytes signature; // EIP-191 personal_sign over the canonical statement (empty for attested bindings)
        uint64 registeredAt;
        uint8 proofType; // 0 = wallet signature, 1 = public-post attestation by the registrar
    }

    /// @notice The only address allowed to register/revoke attested
    ///         bindings. Set at construction to the deployer; the role
    ///         can be handed over with `transferRegistrar` (V3). There
    ///         is no other admin power (signature bindings are
    ///         untouchable by the registrar).
    address public registrar;

    mapping(address => Binding) private _bindings;

    event BindingRegistered(address indexed who, string handle);
    event AttestedBindingRegistered(address indexed who, string handle);
    event AttestedBindingRevoked(address indexed who);
    event BindingRemoved(address indexed who);
    event RegistrarTransferred(address indexed previousRegistrar, address indexed newRegistrar);

    error BadHandle();
    error BadSignature();
    error NotRegistrar();
    error ProofDowngrade();
    error NotAttested();
    error BadRegistrar();

    constructor() {
        registrar = msg.sender;
    }

    /// @notice Hand the registrar role to a new address (V3). Current
    ///         registrar only; the zero address is rejected so the
    ///         role can never be burned by accident. Existing bindings
    ///         (both proof types) are unaffected.
    function transferRegistrar(address newRegistrar) external {
        if (msg.sender != registrar) revert NotRegistrar();
        if (newRegistrar == address(0)) revert BadRegistrar();
        address previous = registrar;
        registrar = newRegistrar;
        emit RegistrarTransferred(previous, newRegistrar);
    }

    /// @notice Register (or replace) the caller's X binding. The
    ///         signature must recover to the caller over the canonical
    ///         statement rebuilt from (handle, caller).
    function registerBinding(string calldata handle, bytes calldata signature) external {
        _validateHandle(handle);
        if (!_verify(msg.sender, handle, signature)) revert BadSignature();
        _bindings[msg.sender] = Binding({handle: handle, signature: signature, registeredAt: uint64(block.timestamp), proofType: 0});
        emit BindingRegistered(msg.sender, handle);
    }

    /// @notice Register a binding for `who` on the strength of a public
    ///         X post (see header). Registrar only. The off-chain
    ///         evidence (the post) is the registrar's responsibility;
    ///         on-chain, the binding is labelled proofType 1 forever.
    function registerByAttestation(address who, string calldata handle) external {
        if (msg.sender != registrar) revert NotRegistrar();
        _validateHandle(handle);
        Binding storage existing = _bindings[who];
        if (bytes(existing.handle).length != 0 && existing.proofType == 0) revert ProofDowngrade();
        _bindings[who] = Binding({handle: handle, signature: "", registeredAt: uint64(block.timestamp), proofType: 1});
        emit AttestedBindingRegistered(who, handle);
    }

    /// @notice Revoke an attested binding (abuse reports, wrong handle).
    ///         Signature bindings cannot be revoked by the registrar.
    function revokeAttestation(address who) external {
        if (msg.sender != registrar) revert NotRegistrar();
        Binding storage b = _bindings[who];
        if (bytes(b.handle).length == 0 || b.proofType != 1) revert NotAttested();
        delete _bindings[who];
        emit AttestedBindingRevoked(who);
    }

    /// @notice 0 = wallet signature, 1 = public-post attestation,
    ///         255 = no binding. Displays must label attested bindings.
    function proofTypeOf(address who) external view returns (uint8) {
        Binding storage b = _bindings[who];
        if (bytes(b.handle).length == 0) return 255;
        return b.proofType;
    }

    /// @notice Remove the caller's binding. Display everywhere reverts
    ///         to the bare address.
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
        if (b.proofType == 1) return true; // attested: stands until revoked or removed
        return _verify(who, b.handle, b.signature);
    }

    /// @notice The canonical statement for (handle, who). Frontends must
    ///         sign exactly this string.
    function statementFor(string calldata handle, address who) external pure returns (string memory) {
        return _statement(handle, who);
    }

    // ----- internals -----

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
        // V3: EIP-2 low-s rule — reject the malleable high-s form
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
