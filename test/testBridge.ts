import "hardhat-tracer";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MyERC20, Bridge } from "../typechain";
import { hrtime } from "process";

describe("Testing Marketplace",  function () {

    // истансы контрактов
    let erc20Eth : MyERC20;
    let erc20Bsc : MyERC20;
    let erc20Test : MyERC20;
    let bridgeEth : Bridge;
    let bridgeBsc : Bridge;

    // аккаунты
    let owner : SignerWithAddress;
    let administrator : SignerWithAddress;
    let sender : SignerWithAddress;
    let recipient : SignerWithAddress;
    let hacker : SignerWithAddress;

    // прочие полезности
    let sig : any;
    let counter : BigNumber;
    const value = 100000;
    const [chainId1, chainId2, chainId3, chainId4] = [1, 2, 3, 4]

    // аргументы для конструкторов контрактов
    const ercName1 = "KirillZaynutdinovToken";
    const ercName2 = "TestToken";
    const ercSymbol = "KZT";
    const decimals = 3;

    before(async function(){
        [owner, administrator, sender, recipient, hacker] = await ethers.getSigners();

        // деплоим ERC20
        const ERC20Factory = (await ethers.getContractFactory("MyERC20"));
        erc20Eth = await ERC20Factory.deploy(ercName1, ercSymbol, decimals);
        erc20Bsc = await ERC20Factory.deploy(ercName1, ercSymbol, decimals);
        erc20Test = await ERC20Factory.deploy(ercName2, ercSymbol, decimals);

        // деплоим bridge
        const BridgeFactory = (await ethers.getContractFactory("Bridge"));
        bridgeEth = await BridgeFactory.deploy(chainId1);
        bridgeBsc = await BridgeFactory.deploy(chainId2);
    })

    // минтим токены на одном контракте
    // проверяем изменение баланса и реверты
    it("check mint() erc20Eth", async function(){
        
        const balanceBefore = await erc20Eth.balanceOf(sender.address);
        const totalSupplyBefore = await erc20Eth.totalSupply();
    
        let tx  = await erc20Eth.mint(sender.address, value);
        await tx.wait();
    
        const balanceAfter = await erc20Eth.balanceOf(sender.address);
        const totalSupplyAfter = await erc20Eth.totalSupply();
    
        expect(await balanceBefore.add(value)).equal(balanceAfter);
        expect(await totalSupplyBefore.add(value)).equal(totalSupplyAfter);
    
        await expect(
            erc20Eth.connect(sender).mint(sender.address, value)
        ).to.be.revertedWith("You are not owner");

    })

    // выдаём роль administrator для контракта bridge на обоих контрактах токенов
    it("check grantrole() erc20", async function(){
        
        let admin = await erc20Eth.administrator();

        let tx = await erc20Eth.grantRole(admin, bridgeEth.address);
        await tx.wait();
        expect(await erc20Eth.hasRole(admin, bridgeEth.address)).equal(true);

        tx = await erc20Bsc.grantRole(admin, bridgeBsc.address);
        await tx.wait();
        expect(await erc20Bsc.hasRole(admin, bridgeBsc.address)).equal(true);
    })

    // выдаём роль administrator на контракте bridge
    it("check grantrole() bridge", async function(){
        
        let admin = await bridgeEth.administrator();

        let tx = await bridgeEth.grantRole(admin, administrator.address);
        await tx.wait();
        expect(await bridgeEth.hasRole(admin, administrator.address)).equal(true);

        admin = await bridgeBsc.administrator();

        tx = await bridgeBsc.grantRole(admin, administrator.address);
        await tx.wait();
        expect(await bridgeBsc.hasRole(admin, administrator.address)).equal(true);
    })

    // добавляем в каждый мост по одному id блокчейна
    // проверяем реверты
    it("check updateChainById()", async function(){
        
        let tx = await bridgeEth.updateChainById(chainId2, true);
        await tx.wait();
        expect(await bridgeEth.chainIds(chainId2)).equal(true);
        
        tx = await bridgeBsc.updateChainById(chainId1, true);
        await tx.wait();
        expect(await bridgeBsc.chainIds(chainId1)).equal(true);

        tx = await bridgeEth.updateChainById(chainId3, true);
        await tx.wait();
        expect(await bridgeEth.chainIds(chainId3)).equal(true);

        // проверяем, что добавлять/убирать цепочки может только хозяин контракта или аккаунт с ролькю админа
        await expect(
            bridgeEth.connect(hacker).updateChainById(chainId3, false)
        ).to.be.revertedWith("Bridge: You don't have access rights");
    })

    // Добавляем токены
    // в один мост - 1 токен, в другой - 2 токена (чтобы один потом удалить)
    // проверяем реверты
    it("check includeToken()", async function(){
        
        // добавляем токены и проверяем, что они добавлены

        let tx = await bridgeEth.includeToken(erc20Eth.address);
        await tx.wait();
        expect(await bridgeEth.tokens(ercName1)).equal(erc20Eth.address);
        
        tx = await bridgeBsc.includeToken(erc20Bsc.address);
        await tx.wait();
        expect(await bridgeBsc.tokens(ercName1)).equal(erc20Bsc.address);

        tx = await bridgeEth.includeToken(erc20Test.address);
        await tx.wait();
        expect(await bridgeEth.tokens(ercName2)).equal(erc20Test.address);

        // проверяем, что нельзя добавить уже добавленный токен
        await expect(
            bridgeEth.includeToken(erc20Eth.address)
        ).to.be.revertedWith("Token already added");

        // проверяем, что добавить токен может только хозяин контракта или аккаунт с ролькю админа
        await expect(
            bridgeEth.connect(hacker).includeToken(erc20Eth.address)
        ).to.be.revertedWith("Bridge: You don't have access rights");
    })

    // удаляем один токен
    // проверяем реверты
    it("check excludeToken()", async function(){
        
        let tx = await bridgeEth.excludeToken(erc20Test.address);
        await tx.wait();

        // проверим, что токен удалён и нельзя удалять удалённый токен
        await expect(
            bridgeEth.excludeToken(erc20Test.address)
        ).to.be.revertedWith("Token not added");
        // проверяем, что удалить токен может только хозяин контракта или аккаунт с ролькю админа
        await expect(
            bridgeEth.connect(hacker).excludeToken(erc20Eth.address)
        ).to.be.revertedWith("Bridge: You don't have access rights");
    })

    // вызываем swap на контракте bridgeEth
    it("check swap()", async function(){
        
        // проверяем баланс отправителя токенов до вызова swap
        let balanceBefore = await erc20Eth.balanceOf(sender.address);
        let totalSupplyBefore = await erc20Eth.totalSupply();

        let tx = await bridgeEth.connect(sender).swap(ercName1, recipient.address, chainId2, value);
        const receipt = await tx.wait();

        // проверяем баланс отправителя токенов после вызова swap - value токенов должны быть сожжены
        let balanceAfter = await erc20Eth.balanceOf(sender.address);
        let totalSupplyAfter = await erc20Eth.totalSupply();

        expect(await balanceBefore.sub(value)).equal(balanceAfter);
        expect(await totalSupplyBefore.sub(value)).equal(totalSupplyAfter);

        // вытаскиваем event
        let events = receipt.events ?? []
        let event = events[1].args ?? ""
        let currentChainId = event[0]
        let tokenName = event[1]
        let tokenRecipient = event[2]
        let chainId = event[3]
        let tokenValue = event[4]
        counter = event[5]
        
        //console.log(currentChainId, tokenName, tokenRecipient, chainId, tokenValue, counter);

        // Создаём сигнатуру
        let msg = ethers.utils.solidityKeccak256(
            ["uint256", "string", "address", "uint256", "uint256", "uint256"],
            [currentChainId, tokenName, tokenRecipient, chainId, tokenValue, counter])
        let signature = await administrator.signMessage(ethers.utils.arrayify(msg));
        sig = await ethers.utils.splitSignature(signature);

        // проверяем, что нельзя отправить токены в не поддерживаемый блокчейн
        await expect(
            bridgeEth.swap(ercName1, recipient.address, chainId4, value)
        ).to.be.revertedWith("Chain is not supported");

        // проверяем, что нельзя отправить токен, не добавленный в мост
        await expect(
            bridgeEth.swap(ercName2, recipient.address, chainId2, value)
        ).to.be.revertedWith("Token not added");
    })

    // Прошла некоторая бекендовская магия и пользователь в другой сети - условной Bsc
    // получил сигнатуру и теперь хочет получить свои токены
    // вызываем redeem на контракте bridgeBsc
    it("check redeem()", async function(){
        
        // проверяем баланс получателя токенов до вызова redeem
        const balanceBefore = await erc20Bsc.balanceOf(recipient.address);
        const totalSupplyBefore = await erc20Bsc.totalSupply();
        
        const tx = await bridgeBsc.connect(recipient).redeem(
            chainId1, ercName1, value, counter, sig.v, sig.r, sig.s
        );
        await tx.wait();
        
        // проверяем баланс получателя токенов после вызова redeem - value токенов должны быть заминчены
        const balanceAfter = await erc20Bsc.balanceOf(recipient.address);
        const totalSupplyAfter = await erc20Bsc.totalSupply();
        
        expect(await balanceBefore.add(value)).equal(balanceAfter);
        expect(await totalSupplyBefore.add(value)).equal(totalSupplyAfter);

        // проверяем, что нельзя получить токены из не поддерживаемого блокчейна
        await expect(
            bridgeBsc.connect(recipient).redeem(
                chainId4, ercName1, value, counter, sig.v, sig.r, sig.s
            )
        ).to.be.revertedWith("Chain is not supported");

        // проверяем, что нельзя получить токен, не добавленный в мост
        await expect(
            bridgeBsc.connect(recipient).redeem(
                chainId1, ercName2, value, counter, sig.v, sig.r, sig.s
            )
        ).to.be.revertedWith("Token not added");
        
        // проверяем, что нельзя дважды получить токены по одной
        await expect(
            bridgeBsc.connect(recipient).redeem(
                chainId1, ercName1, value, counter, sig.v, sig.r, sig.s
            )
        ).to.be.revertedWith("Translation is already done");

        // проверяем, что нельзя получить токен по неправильной сигнатуре
        // Создаём сигнатуру
        let msg = ethers.utils.solidityKeccak256(
            ["uint256", "string", "address", "uint256", "uint256", "uint256"],
            [chainId1, ercName1, hacker.address, chainId2, value, counter.add(1)])

        let signature = await hacker.signMessage(ethers.utils.arrayify(msg));
        sig = await ethers.utils.splitSignature(signature);

        await expect(
            bridgeBsc.connect(hacker).redeem(
                chainId1, ercName1, value, counter.add(1), sig.v, sig.r, sig.s
            )
        ).to.be.revertedWith("Signature not valid");
    })

});
