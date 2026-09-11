// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./IdentityRegistry.sol";

contract AssetPlatform is ERC721, Pausable {
    IdentityRegistry public immutable registry;
    enum Role { NONE, ADMIN, MANAGER, AUDITOR, USER }
    // Permission bits: transfer=1, audit=2, catalogue=4. Mint/allocation/governance stay Admin-only.
    mapping(address => Role) public roles;
    mapping(address => bool) public suspended;
    mapping(uint8 => uint8) public permissions;
    uint256 public adminCount;
    uint256 public nextId = 1;
    struct Asset { bytes32 codeHash; bytes32 contentHash; string uri; bool retired; }
    mapping(uint256 => Asset) public assets;
    mapping(bytes32 => bool) public registeredCodes;
    mapping(uint256 => mapping(address => uint64)) public accessUntil;
    mapping(uint256 => uint64) public accessEpoch;
    event RoleChanged(address indexed identity, uint8 previousRole, uint8 role, address indexed actor);
    event SuspensionChanged(address indexed identity, bool suspended, address indexed actor);
    event PolicyChanged(uint8 indexed role, uint8 permissions, address indexed actor);
    event AssetMinted(uint256 indexed tokenId, bytes32 indexed codeHash, bytes32 contentHash, string uri, address indexed actor);
    event AssetAllocated(uint256 indexed tokenId, address indexed owner, address indexed actor);
    event AssetTransferred(uint256 indexed tokenId, address indexed from, address indexed to, address actor);
    event AccessChanged(uint256 indexed tokenId, address indexed identity, uint64 until, address indexed actor);
    event AssetRetired(uint256 indexed tokenId, address indexed actor);
    event EvidenceAnchored(bytes32 indexed digest, string category, address indexed actor);
    error Denied(); error InvalidState(); error DuplicateAsset(); error ApprovalDisabled(); error LastAdmin();

    constructor(address identityRegistry, address admin) ERC721("LedgerGuard Enterprise Asset", "LGA") {
        registry = IdentityRegistry(identityRegistry); roles[admin] = Role.ADMIN; adminCount = 1;
        permissions[1] = 7; permissions[2] = 5; permissions[3] = 6; permissions[4] = 0;
        emit RoleChanged(admin, 0, 1, admin);
    }
    function actor() public view returns(address id) {
        id = registry.identityForController(msg.sender);
        if (!registry.active(id) || suspended[id]) revert Denied();
    }
    function enabled(address id) public view returns(bool) {
        return registry.active(id) && !suspended[id] && roles[id] != Role.NONE;
    }
    function isAdmin(address id) public view returns(bool) { return enabled(id) && roles[id] == Role.ADMIN; }
    modifier onlyAdmin() { if (!isAdmin(actor())) revert Denied(); _; }
    function can(address id, uint8 bit) public view returns(bool) {
        return enabled(id) && (permissions[uint8(roles[id])] & bit) != 0;
    }
    function setRole(address id, Role role) external onlyAdmin {
        if (!registry.active(id)) revert Denied();
        Role old = roles[id];
        if (old == Role.ADMIN && role != Role.ADMIN) { if (adminCount <= 1) revert LastAdmin(); adminCount--; }
        if (old != Role.ADMIN && role == Role.ADMIN) adminCount++;
        roles[id] = role; emit RoleChanged(id, uint8(old), uint8(role), actor());
    }
    function setSuspended(address id, bool value) external onlyAdmin {
        // Admins must first be demoted; prevents silently disabling governance through this path.
        if (!registry.active(id) || roles[id] == Role.ADMIN) revert InvalidState();
        suspended[id] = value; emit SuspensionChanged(id, value, actor());
    }
    function setPolicy(uint8 role, uint8 bits) external onlyAdmin {
        if (role < 2 || role > 4 || bits > 7) revert InvalidState();
        permissions[role] = bits; emit PolicyChanged(role, bits, actor());
    }
    function setPaused(bool value) external onlyAdmin { if(value) _pause(); else _unpause(); }
    function mint(bytes32 codeHash, bytes32 contentHash, string calldata uri) external onlyAdmin whenNotPaused returns(uint256 id) {
        if (codeHash == bytes32(0) || contentHash == bytes32(0) || bytes(uri).length == 0 || bytes(uri).length > 512) revert InvalidState();
        if (registeredCodes[codeHash]) revert DuplicateAsset(); registeredCodes[codeHash] = true;
        id = nextId++; assets[id] = Asset(codeHash, contentHash, uri, false);
        _mint(address(this), id); emit AssetMinted(id, codeHash, contentHash, uri, actor());
    }
    function allocate(uint256 id, address to) external onlyAdmin whenNotPaused {
        if (ownerOf(id) != address(this) || !enabled(to) || assets[id].retired) revert InvalidState();
        _transfer(address(this), to, id); emit AssetAllocated(id, to, actor());
    }
    function transferFrom(address from, address to, uint256 id) public override whenNotPaused {
        address who = actor();
        if (!can(who, 1) || !enabled(to) || from == address(this) || ownerOf(id) != from || from == to || assets[id].retired) revert Denied();
        // Management permission authorises reassignment; ordinary owners cannot bypass it.
        _transfer(from, to, id); accessEpoch[id]++; emit AssetTransferred(id, from, to, who);
    }
    function approve(address, uint256) public pure override { revert ApprovalDisabled(); }
    function setApprovalForAll(address, bool) public pure override { revert ApprovalDisabled(); }
    mapping(uint256 => mapping(address => uint64)) private grantEpoch;
    function setAccess(uint256 id, address who, uint64 until) external onlyAdmin whenNotPaused {
        if (_ownerOf(id) == address(0) || !enabled(who) || assets[id].retired) revert InvalidState();
        if (until != 0 && until <= block.timestamp) revert InvalidState();
        accessUntil[id][who] = until; grantEpoch[id][who] = accessEpoch[id];
        emit AccessChanged(id, who, until, actor());
    }
    function canRead(uint256 id, address who) public view returns(bool) {
        if (paused() || !enabled(who) || assets[id].retired || _ownerOf(id) == address(0)) return false;
        return isAdmin(who) || _ownerOf(id) == who || (grantEpoch[id][who] == accessEpoch[id] && accessUntil[id][who] > block.timestamp);
    }
    function retire(uint256 id) external onlyAdmin whenNotPaused {
        if (_ownerOf(id) == address(0) || assets[id].retired) revert InvalidState();
        assets[id].retired = true; accessEpoch[id]++; emit AssetRetired(id, actor());
    }
    function anchorEvidence(bytes32 digest, string calldata category) external {
        address who = actor(); if (!can(who, 2) || digest == bytes32(0) || bytes(category).length > 64) revert Denied();
        emit EvidenceAnchored(digest, category, who);
    }
    function tokenURI(uint256 id) public view override returns(string memory) { _requireOwned(id); return assets[id].uri; }
}
