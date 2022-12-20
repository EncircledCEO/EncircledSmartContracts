const { expect } = require("chai");
const { network, deployments, ethers, time } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Token Unit Tests", function () {
      beforeEach(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        alice = accounts[1];
        bob = accounts[2];
        charles = accounts[3];
        await deployments.fixture(["all"]);

        tokenContract = await ethers.getContract("Encircled");
        tokenContractUSD = await ethers.getContract("BEP20USDT");
        tokenContractVesting = await ethers.getContract("EncdVesting");
        tokenContractICO = await ethers.getContract("ENCD_ICO");

        tokenContract = await ethers.getContract("Encircled");
        tokenContract.excludeFromFee(tokenContractVesting.address);

        tokenContractICO = tokenContractICO.connect(deployer);
        tokenContractICOAlice = tokenContractICO.connect(alice);
        tokenContractICOBob = tokenContractICO.connect(bob);
        tokenContractICOCharles = tokenContractICO.connect(charles);

        tokenContractUSDT = tokenContractUSD.connect(deployer);
        tokenContractUSDTAlice = tokenContractUSD.connect(alice);
        tokenContractUSDTBob = tokenContractUSD.connect(bob);
        tokenContractVesting.transferOwnership(tokenContractICO.address);
        await tokenContract.transfer(
          tokenContractVesting.address,
          ethers.utils.parseUnits("200000000", 18)
        );
      });
      describe("Crowdsale standard functions", function () {
        describe("Initalization()", function () {
          it("should have correct contract addresses", async function () {
            expect(await tokenContractICO.USDTtoken()).to.equal(
              tokenContractUSD.address
            );
            expect(await tokenContractICO.Encircledtoken()).to.equal(
              tokenContract.address
            );
          });
          it("owner was assigned correctly", async function () {
            expect(await tokenContractICO.owner()).to.equal(deployer.address);
          });
          it("presale should not be active", async function () {
            await expect(tokenContractICO.getPrice()).to.be.revertedWith(
              "Sale not active"
            );
          });
          it("presale stage equals 0 (none)", async function () {
            expect(await tokenContractICO.currentStage()).to.equal(0);
          });
        });
        describe("setStage()", function () {
          it("non-owner can't execute function", async function () {
            await expect(tokenContractICOAlice.setStage(0)).to.be.revertedWith(
              "Ownable: caller is not the owner"
            );
          });
          it("owner can execute function", async function () {
            await expect(tokenContractICO.setStage(1)).not.to.be.reverted;
          });
          it("emits event after stage changes", async function () {
            for (var i = 0; i <= 4; i++) {
              await expect(tokenContractICO.setStage(i))
                .to.emit(tokenContractICO, "StageChanged")
                .withArgs(i);
            }
          });
          it("can't emit event that doesn't exist", async function () {
            await expect(tokenContractICO.setStage(5)).to.be.revertedWith(
              "Stage doesn't exist"
            );
          });
          it("price adapts accordingly", async function () {
            await tokenContractICO.setStage(1);
            expect(await tokenContractICO.getPrice()).to.equal(500);
            await tokenContractICO.setStage(2);
            expect(await tokenContractICO.getPrice()).to.equal(250);
            await tokenContractICO.setStage(3);
            expect(await tokenContractICO.getPrice()).to.equal(125);
          });
        });
        describe("buyToken()", function () {
          beforeEach(async () => {
            await tokenContractUSDTAlice.approve(
              tokenContractICO.address,
              ethers.utils.parseUnits("100", 18)
            );
            await tokenContractUSDT.transfer(
              bob.address,
              ethers.utils.parseUnits("1", 18)
            );
            await tokenContractUSDTBob.approve(
              tokenContractICO.address,
              ethers.utils.parseUnits("1", 18)
            );

            await tokenContractICO.setStage(1);
          });
          it("if value is zero, contract should revert", async function () {
            await expect(tokenContractICO.buyToken(0, 1)).to.be.revertedWith(
              "Amount can't be 0"
            );
          });
          it("reverts if not enough tokens left for sale", async function () {
            await tokenContractUSDT.approve(
              tokenContractICO.address,
              ethers.utils.parseUnits("2000000010000000000", 18)
            );
            await expect(
              tokenContractICO.buyToken(
                ethers.utils.parseUnits("17000000", 18),
                1
              )
            ).to.be.revertedWith(
              "Not enough tokens left for purchase in this stage'"
            );
          });
          it("revert if allowance too small", async function () {
            await expect(
              tokenContractICO.buyToken(10000, 1)
            ).to.be.revertedWith(
              "Check the token allowance, not enough approved!"
            );
          });
          it("revert if sale is not active", async function () {
            await tokenContractICO.setStage(0);
            await expect(
              tokenContractICOAlice.buyToken(100, 1)
            ).to.be.revertedWith("Sale not active");
            await tokenContractICO.setStage(4);
            await expect(
              tokenContractICOAlice.buyToken(100, 1)
            ).to.be.revertedWith("Sale not active");
          });
          it("revert if USDT balance too small", async function () {
            await expect(
              tokenContractICOAlice.buyToken(
                ethers.utils.parseUnits("100", 18),
                1
              )
            ).to.be.revertedWith("BEP20: transfer amount exceeds balance");
          });
          it("call doesn't get reverted if all requirements are fullfilled", async function () {
            await expect(
              tokenContractICOBob.buyToken(50, 1) //costs = 1
            ).to.not.be.reverted;
          });
          it("usdt balance of contract increases", async function () {
            USDTBalance = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            await tokenContractICOBob.buyToken(
              ethers.utils.parseUnits("50", 18),
              1
            ); //costs = 1
            USDTBalance1 = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            expect(USDTBalance1).to.be.equal(
              USDTBalance.add(ethers.utils.parseUnits("1", 18))
            );
          });
          it("updates sold tokens", async function () {
            Tokenforsale = await tokenContractICO.seedtokensforsale();
            await tokenContractICOBob.buyToken(50, 1); //costs = 1
            TokenforsaleA = await tokenContractICO.seedtokensforsale();
            expect(Tokenforsale).to.be.equal(TokenforsaleA.add(50));
          });
          it("deduct correct amount when stage changes stage 2", async function () {
            await tokenContractUSDT.transfer(
              bob.address,
              ethers.utils.parseUnits("2", 18)
            );
            await tokenContractUSDTBob.approve(
              tokenContractICO.address,
              ethers.utils.parseUnits("2", 18)
            );
            await tokenContractICO.setStage(2);
            USDTBalance = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            await tokenContractICOBob.buyToken(
              ethers.utils.parseUnits("50", 18),
              1
            ); //costs = 2
            USDTBalance1 = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            expect(USDTBalance1).to.be.equal(
              USDTBalance.add(ethers.utils.parseUnits("2", 18))
            );
          });
          it("deduct correct amount when stage changes stage 3", async function () {
            await tokenContractUSDT.transfer(
              bob.address,
              ethers.utils.parseUnits("4", 18)
            );
            await tokenContractUSDTBob.approve(
              tokenContractICO.address,
              ethers.utils.parseUnits("4", 18)
            );
            await tokenContractICO.setStage(3);
            USDTBalance = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            await tokenContractICOBob.buyToken(
              ethers.utils.parseUnits("50", 18),
              1
            ); //costs = 4
            USDTBalance1 = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            expect(USDTBalance1).to.be.equal(
              USDTBalance.add(ethers.utils.parseUnits("4", 18))
            );
          });
        });
        describe("Withdraw()", function () {
          beforeEach(async () => {
            await tokenContractICO.setStage(1);
            await tokenContractUSDTAlice.approve(
              tokenContractICO.address,
              ethers.utils.parseUnits("100", 18)
            );
            await tokenContractUSDT.transfer(
              alice.address,
              ethers.utils.parseUnits("100", 18)
            );
            await tokenContractICO.setStage(1);
            await tokenContractICOAlice.buyToken(
              ethers.utils.parseUnits("100", 18),
              1
            ); //costs = 2
          });
          it("token contract has the right balance", async function () {
            USDTBalance1 = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            expect(USDTBalance1).to.be.equal(
              USDTBalance.add(ethers.utils.parseUnits("2", 18))
            );
          });
          it("non-owner can't withdraw", async function () {
            await expect(
              tokenContractICOAlice.withdraw(10, 1)
            ).to.be.revertedWith("Ownable: caller is not the owner");
          });
          it("non-owner can't withdraw", async function () {
            await expect(
              tokenContractICOAlice.withdraw(10, 1)
            ).to.be.revertedWith("Ownable: caller is not the owner");
          });
          it("owner can execute the function withdraw", async function () {
            await expect(tokenContractICO.withdraw(10, 1)).not.to.be.reverted;
          });
          it("function reverted if balance too small", async function () {
            await expect(
              tokenContractICO.withdraw(ethers.utils.parseUnits("3", 18), 1)
            ).to.be.revertedWith("Not enough funds on the contract");
          });
          it("correct balance transfered", async function () {
            let Balance1 = await tokenContractUSDT.balanceOf(deployer.address);
            await tokenContractICO.withdraw(
              ethers.utils.parseUnits("1", 18),
              1
            );
            let Balance2 = await tokenContractUSDT.balanceOf(deployer.address);
            expect(Balance2).to.be.equal(
              Balance1.add(ethers.utils.parseUnits("1", 18))
            );
          });
          it("token contract balance updated correctly", async function () {
            let Balance1 = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            await tokenContractICO.withdraw(
              ethers.utils.parseUnits("1", 18),
              1
            );
            let Balance2 = await tokenContractUSDT.balanceOf(
              tokenContractICO.address
            );
            expect(Balance2).to.be.equal(
              Balance1.sub(ethers.utils.parseUnits("1", 18))
            );
          });
        });
      });
    });

module.exports.tags = ["all", "ico"];
