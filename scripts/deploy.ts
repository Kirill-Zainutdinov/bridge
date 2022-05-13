import { MyERC20, Bridge } from "../typechain";
import { ethers } from "hardhat";

async function main() {

    let erc20 : MyERC20;
    let bridge : Bridge;
    // аргументы для конструкторов контрактов
    const ercName = "KirillZaynutdinovToken";
    const ercSymbol = "KZT";
    const decimals = 3;
    const [owner, administrator] = await ethers.getSigners();
    const value = 10000;

    //console.log(owner.address, q.address);
    // деплоим ERC20
    const ERC20Factory = (await ethers.getContractFactory("MyERC20"));
    erc20 = await ERC20Factory.deploy(ercName, ercSymbol, decimals);
    console.log("Token erc20 deployed to:", erc20.address); 

    // деплоим bridge
    // для эфира
    let chainId = 1
    // для BSC
    //let chainId = 2
    const BridgeFactory = (await ethers.getContractFactory("Bridge"));
    bridge = await BridgeFactory.deploy(chainId);
    console.log("Bridge deployed to:", bridge.address); 

    // добавляем id блокчейна в контракт bridge
    // для эфира
    chainId = 2
    // для BSC
    //chainId = 1
    let tx = await bridge.updateChainById(chainId, true);
    await tx.wait();
    let result = await bridge.chainIds(chainId);
    console.log(`ChainId ${chainId} added to bridge - ${result}`)

    // добавляем токены в bridge
    tx = await bridge.includeToken(erc20.address);
    await tx.wait();
    let tokenAddress = await bridge.tokens(ercName);
    result = (tokenAddress == erc20.address);
    console.log(`Token ${tokenAddress} added to bridge - ${result}`)

    // минтим токены
    
    const balanceBefore = await erc20.balanceOf(owner.address);
    tx  = await erc20.mint(owner.address, value);
    await tx.wait();
    const balanceAfter = await erc20.balanceOf(owner.address);
    console.log(`To address ${owner.address} minted ${balanceAfter.sub(balanceBefore)} tokens`)
    
    // назначаем админа для bridge
    let admin = await bridge.administrator();
    tx = await bridge.grantRole(admin, administrator.address);
    await tx.wait();
    result = await bridge.hasRole(admin, administrator.address);
    console.log(`Account ${administrator.address} appointed admin to bridge - ${result}`)

    // назначаем контракт bridge админом для токена
    admin = await erc20.administrator();
    tx = await erc20.grantRole(admin, bridge.address);
    await tx.wait();
    result = await erc20.hasRole(admin, bridge.address);
    console.log(`Account ${bridge.address} appointed admin to token - ${result}`)

    console.log("The bridge is ready to work!")
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
/*
ETH:
Token erc20 deployed to: 0x677ba7DBd04222c682207332F9D59408217cc87f
Bridge deployed to: 0x3038745f3f7df9E8CCcb0aC62bcA7e3F888a02b2

BSC:
Token erc20 deployed to: 0xD4639d4a97719569C427d4589B8e94f270fbe895
Bridge deployed to: 0x8CcE2099DFF96B4d81589Bc82a95Cc4318B6f2e1
*/

