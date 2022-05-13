import { MyERC20__factory, Bridge__factory } from "../typechain";
import { task } from "hardhat/config";
import '@nomiclabs/hardhat-ethers'

// bridgeAddress in ETH 0x3038745f3f7df9E8CCcb0aC62bcA7e3F888a02b2 
// bridgeAddress in BSC 0x8CcE2099DFF96B4d81589Bc82a95Cc4318B6f2e1 

// функция swap
task("swap", "Sending tokens to another blockchain")
    .addParam("bridgeAddress")
    .addParam("tokenName")
    .addParam("recipientAddress")
    .addParam("chainId")
    .addParam("value")
    .setAction(async (args, hre) => {
        // подключаемся к контракту
        const BridgeFactory = (await hre.ethers.getContractFactory("Bridge")) as Bridge__factory;
        const bridge = await BridgeFactory.attach(args.bridgeAddress);
        console.log(`Successfully connected to the contract bridge`);

        const tokenAddress = await bridge.tokens(args.tokenName);
        const ERC20Factory = (await hre.ethers.getContractFactory("MyERC20")) as MyERC20__factory;
        const erc20 = await ERC20Factory.attach(tokenAddress);
        console.log(`Successfully connected to the contract token`);

        const [owner, administrator] = await hre.ethers.getSigners();

        // проверяем баланс отправителя токенов до вызова swap
        let balanceBefore = await erc20.balanceOf(owner.address);
        console.log(`Now the balance of the account ${owner.address} is  ${balanceBefore} tokens`);

        // вызываем функцию swap
        console.log(`Call the swap function...`);
        let tx = await bridge.swap(args.tokenName, args.recipientAddress, args.chainId, args.value);
        const receipt = await tx.wait();
        

        // вытаскиваем event
        console.log(`Getting Events...`);
        let events = receipt.events ?? []
        let event = events[1].args ?? ""
        let currentChainId = event[0]
        let tokenName = event[1]
        let tokenRecipient = event[2]
        let chainId = event[3]
        let tokenValue = event[4]
        let counter = event[5]
        
        //console.log(currentChainId, tokenName, tokenRecipient, chainId, tokenValue, counter);

        // Создаём сигнатуру
        console.log(`Create a signature...`);
        let msg = hre.ethers.utils.solidityKeccak256(
            ["uint256", "string", "address", "uint256", "uint256", "uint256"],
            [currentChainId, tokenName, tokenRecipient, chainId, tokenValue, counter])
        let signature = await administrator.signMessage(hre.ethers.utils.arrayify(msg));
        let sig = await hre.ethers.utils.splitSignature(signature);

        // проверяем баланс отправителя токенов после вызова swap
        let balanceAfter = await erc20.balanceOf(owner.address);
        
        console.log(`The swap function is successful`);
        console.log(`The account had ${balanceBefore.sub(balanceAfter)} tokens burned`);
        console.log(`Now the balance of the account ${owner.address} is  ${balanceBefore} tokens`);
        console.log(`${tokenValue} tokens sent to the account ${tokenRecipient} to the network ${chainId}`);
        console.log(`You need the following values to call the redeem() function and get the tokens`);
        console.log(`currentChainId: ${currentChainId}`);
        console.log(`tokenName: ${tokenName}`);
        console.log(`tokenValue: ${tokenValue}`);
        console.log(`counter: ${counter}`);
        console.log(`Signature values:`);
        console.log(`v: ${sig.v}`);
        console.log(`r: ${sig.r}`);
        console.log(`s: ${sig.s}`);
});

// функция redeem
task("redeem", "Getting tokens from another blockchain")
    .addParam("bridgeAddress")
    .addParam("chainId")
    .addParam("tokenName")
    .addParam("value")
    .addParam("counter")
    .addParam("v")
    .addParam("r")
    .addParam("s")
    .setAction(async (args, hre) => {
        // подключаемся к контракту
        const BridgeFactory = (await hre.ethers.getContractFactory("Bridge")) as Bridge__factory;
        const bridge = await BridgeFactory.attach(args.bridgeAddress);
        console.log(`Successfully connected to the contract bridge`);

        const tokenAddress = await bridge.tokens(args.tokenName);
        const ERC20Factory = (await hre.ethers.getContractFactory("MyERC20")) as MyERC20__factory;
        const erc20 = await ERC20Factory.attach(tokenAddress);
        console.log(`Successfully connected to the contract token`);

        const [owner] = await hre.ethers.getSigners();

        // проверяем баланс отправителя токенов до вызова swap
        let balanceBefore = await erc20.balanceOf(owner.address);
        console.log(`Now the balance of the account ${owner.address} is  ${balanceBefore} tokens`);

        // вызываем функцию reddem()
        console.log(`Call the redeem function...`);
        const tx = await bridge.redeem(
            args.chainId, args.tokenName, args.value, args.counter, args.v, args.r, args.s
        );
        await tx.wait();

        // проверяем баланс отправителя токенов после вызова swap
        let balanceAfter = await erc20.balanceOf(owner.address);

        console.log(`The redeem function is successful`);
        console.log(`Account ${owner.address} received ${balanceAfter.sub(balanceBefore)} tokens`);
        console.log(`Now his balance is ${balanceAfter} tokens`);
});
