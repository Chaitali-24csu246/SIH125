// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Prototype did:sih registry. Identity address remains stable across key rotation.
/// Organisational suspension is separate from self-sovereign identity control.
contract IdentityRegistry {
    struct Identity { address controller; address guardian; bool active; uint64 version; }
    struct Recovery { address controller; uint64 readyAt; }
    mapping(address => Identity) public identities;
    mapping(address => address) public identityForController;
    mapping(address => Recovery) public recoveries;
    address[] public members;
    address public governance;
    address private immutable bootstrap;
    uint64 public constant RECOVERY_DELAY = 1 days;
    event IdentityRegistered(address indexed identity, address indexed controller, address guardian);
    event ControllerChanged(address indexed identity, address indexed previous, address indexed controller, uint64 version);
    event RecoveryRequested(address indexed identity, address controller, uint64 readyAt);
    event RecoveryCancelled(address indexed identity);
    event GuardianChanged(address indexed identity, address guardian);
    event IdentityDeactivated(address indexed identity);
    error Denied(); error InvalidIdentity(); error ControllerInUse(); error TooEarly();

    constructor(address admin) { bootstrap = admin; _register(admin, address(0)); }
    function setGovernance(address target) external {
        if (msg.sender != bootstrap || governance != address(0) || target.code.length == 0) revert Denied();
        governance = target;
    }
    function register(address guardian) external { _register(msg.sender, guardian); }
    function _register(address who, address guardian) internal {
        if (who == address(0) || identities[who].controller != address(0) || identityForController[who] != address(0) || guardian == who) revert InvalidIdentity();
        identities[who] = Identity(who, guardian, true, 1);
        identityForController[who] = who; members.push(who);
        emit IdentityRegistered(who, who, guardian);
    }
    function count() external view returns(uint256) { return members.length; }
    function active(address identity) external view returns(bool) { return identities[identity].active; }
    function controllerOf(address identity) external view returns(address) { return identities[identity].controller; }
    function versionOf(address identity) external view returns(uint64) { return identities[identity].version; }
    function actor() public view returns(address identity) {
        identity = identityForController[msg.sender];
        if (!identities[identity].active) revert Denied();
    }
    function setGuardian(address guardian) external {
        address id = actor(); if (guardian == msg.sender) revert InvalidIdentity();
        identities[id].guardian = guardian; delete recoveries[id]; emit GuardianChanged(id, guardian);
    }
    function rotate(address nextController) external { _rotate(actor(), nextController); }
    function _rotate(address id, address nextController) internal {
        if (nextController == address(0) || identityForController[nextController] != address(0) || identities[nextController].controller != address(0)) revert ControllerInUse();
        address old = identities[id].controller;
        delete identityForController[old]; identityForController[nextController] = id;
        identities[id].controller = nextController; identities[id].version++;
        delete recoveries[id]; emit ControllerChanged(id, old, nextController, identities[id].version);
    }
    function requestRecovery(address id, address nextController) external {
        if (!identities[id].active || msg.sender != identities[id].guardian || nextController == address(0)) revert Denied();
        uint64 ready = uint64(block.timestamp) + RECOVERY_DELAY;
        recoveries[id] = Recovery(nextController, ready); emit RecoveryRequested(id, nextController, ready);
    }
    function cancelRecovery() external { address id = actor(); delete recoveries[id]; emit RecoveryCancelled(id); }
    function completeRecovery(address id) external {
        Recovery memory r = recoveries[id];
        if (msg.sender != identities[id].guardian || !identities[id].active || r.readyAt == 0) revert Denied();
        if (block.timestamp < r.readyAt) revert TooEarly(); _rotate(id, r.controller);
    }
    function deactivate() external {
        address id = actor();
        if (governance == address(0)) revert Denied();
        (bool ok, bytes memory result) = governance.staticcall(abi.encodeWithSignature("isAdmin(address)", id));
        if (!ok || abi.decode(result, (bool))) revert Denied();
        identities[id].active = false; identities[id].version++;
        delete recoveries[id]; emit IdentityDeactivated(id);
    }
}
