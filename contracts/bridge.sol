// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IMyERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Bridge is AccessControl {

    // счётчик транзакций
    uint256 counter;
    // id блокчейна
    uint256 currentChainId;
    // адрес хозяина контракта
    address owner;
    // роли
    bytes32 public constant bridgeOwner = keccak256("owner");
    bytes32 public constant administrator = keccak256("administrator");
    // словарь с ролями
    mapping(bytes32 => RoleData) public _roles;

    // имя токена => адрес токена
    mapping(string => address) public tokens;
    // id цепочки => поддерживается/не поддерживается
    mapping(uint256 => bool) public chainIds;
    // счётчик была ли совершена транзакция из другого блокчейна по счётчику
    // id блокчейна, где вызвали swap => (счётчик транзакции => true/false)
    mapping(uint256 => mapping(uint256 => bool)) counters;

    event swapInitialized(
        uint256 currentChainId,
        string tokenName,
        address recipient,
        uint256 chainId,
        uint256 value,
        uint256 counter
    );

    modifier onlyOwner(){
        require(msg.sender == owner || hasRole(administrator, msg.sender),
                "Bridge: You don't have access rights");
        _;
    }

    constructor(uint256 _currentChainId){
        _setRoleAdmin(bridgeOwner, bridgeOwner);
        _grantRole(bridgeOwner, msg.sender);
        _setRoleAdmin(administrator, bridgeOwner);
        _grantRole(administrator, msg.sender);
        owner = msg.sender;
        counter = 0;
        currentChainId = _currentChainId;
    }

    // Функция swap(): списывает токены с пользователя и отправляет event ‘swapInitialized’
    function swap(string memory tokenName, address recipient, uint256 chainId, uint256 value) public {
        require(chainIds[chainId] == true, "Chain is not supported");
        require(tokens[tokenName] != address(0), "Token not added");
        IMyERC20(tokens[tokenName]).burn(msg.sender, value);
        emit swapInitialized(currentChainId, tokenName, recipient, chainId, value, ++counter);
    }

    // Функция redeem(): вызывает функцию ecrecover и восстанавливает по хэшированному сообщению и сигнатуре 
    // адрес валидатора, если адрес совпадает с адресом указанным на контракте моста
    // то пользователю отправляются токены
    function redeem
    (
        uint256 chainId,
        string memory tokenName,
        uint256 value,
        uint256 _counter,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) 
        public
    {
        require(chainIds[chainId] == true, "Chain is not supported");
        require(tokens[tokenName] != address(0), "Token not added");
        require(counters[chainId][_counter] != true, "Translation is already done");
        require(checkSign(chainId, tokenName, msg.sender, value, _counter, v, r, s),
                "Signature not valid");
        IMyERC20(tokens[tokenName]).mint(msg.sender, value);
        counters[chainId][_counter] = true;
    }

    function checkSign
    (
        uint256 chainId,
        string memory tokenName,
        address recipient,
        uint256 value,
        uint256 _counter,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) 
        public view returns (bool)
    {
        bytes32 message = keccak256(
            abi.encodePacked(chainId, tokenName, recipient, currentChainId, value, _counter)
        );
        address addr1 = ecrecover(hashMessage(message), v, r, s);
        return hasRole(administrator, addr1);
    }

    function hashMessage(bytes32 message) private pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        return keccak256(abi.encodePacked(prefix, message));
    }

    // Функция updateChainById(): добавить блокчейн или удалить по его chainID
    function updateChainById(uint256 chainId, bool update) public onlyOwner {
        chainIds[chainId] = update;
    }

    // Функция includeToken(): добавить токен для передачи его в другую сеть
    function includeToken(address tokenAddress) public onlyOwner {
        string memory name = IMyERC20(tokenAddress).name();
        require(tokens[name] == address(0), "Token already added");
        tokens[name] = tokenAddress;
    }

    // Функция excludeToken(): исключить токен для передачи
    function excludeToken(address tokenAddress) public onlyOwner {
        string memory name = IMyERC20(tokenAddress).name();
        require(tokens[name] != address(0), "Token not added");
        delete tokens[name];
    }
}