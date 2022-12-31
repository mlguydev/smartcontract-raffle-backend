const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

const ENABLED = false;

!developmentChains.includes(network.name) || !ENABLED
? describe.skip
: describe("Raffle Unit Tests", function () {

	let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
	const chainId = network.config.chainId;

	beforeEach(async function() {
		await deployments.fixture(["all"]);
		deployer = (await getNamedAccounts()).deployer;
		raffle = await ethers.getContract("Raffle", deployer);
		vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
		raffleEntranceFee = await raffle.getEntranceFee();
		interval = await raffle.getInterval();
	});

	describe("Constructor", async function () {

		it("Initialises the raffle correctly", async function () {
			const raffleState = await raffle.getRaffleState();
			const interval = await raffle.getInterval();
			assert.equal(raffleState.toString(), "0");
			assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
		});

	});

	describe("Enter raffle", function () {

		it("Reverts when you don't pay enough", async function () {
			await expect(raffle.enterRaffle()).to.be
			.revertedWith("Raffle__SendMoreToEnterRaffle");
		});

		it("Records players when they enter", async function () {
			await raffle.enterRaffle({ value: raffleEntranceFee });
			const playerFromContract = await raffle.getPlayer(0);
			assert.equal(playerFromContract, deployer);
		});

		it("Emits an event on enter", async function () {
			await expect(raffle.enterRaffle({ value: raffleEntranceFee }))
			.to.emit(raffle, "RaffleEnter");
		});

		it("Doesn't allow entrance when raffle is calculating", async function () {
			await raffle.enterRaffle({ value: raffleEntranceFee });
			await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
			await network.provider.send("evm_mine", []);
			await raffle.performUpkeep([]); // Pretend to be a ChainLink keeper
			await expect(raffle.enterRaffle({ value: raffleEntranceFee }))
			.to.be.revertedWith("Raffle__RaffleNotOpen");
		});

		describe("Function : checkUpkeep", function () {
			
			it("Returns false if people haven't sent any ETH", async function () {
				await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
				await network.provider.send("evm_mine", []);
				const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
				assert(!upkeepNeeded);
			});

			it("Returns false if raffle isn't open", async function () {
				await raffle.enterRaffle({ value: raffleEntranceFee });
				await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
				await network.provider.send("evm_mine", []);
				await raffle.performUpkeep("0x"); // same as passing ] for empyty bytes
				const raffleState = await raffle.getRaffleState();
				const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
				assert.equal(raffleState.toString(), "1");
				assert.equal(upkeepNeeded, false);
			});

			it("Returns false if enough time hasn't passed", async () => {
				await raffle.enterRaffle({ value: raffleEntranceFee });
				await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]);
				await network.provider.request({ method: "evm_mine", params: [] });
				const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
				assert(!upkeepNeeded);
			});

			it("Returns true if enough time has passed, has players, ETH, and is open", async () => {
				await raffle.enterRaffle({ value: raffleEntranceFee });
				await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
				await network.provider.request({ method: "evm_mine", params: [] });
				const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
				assert(upkeepNeeded)
			});

		});

		describe("Function : performUpkeep", function () {
	
			it("Can only run if checkUpkeep is true", async function (){
				await raffle.enterRaffle({ value: raffleEntranceFee });
				await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
				await network.provider.request({ method: "evm_mine", params: [] });
				const tx = await raffle.performUpkeep("0x");
				assert(tx);
			});

			it("Reverts if checkup is false", async function () {
				await expect(raffle.performUpkeep("0x")).to.be.revertedWith
				("Raffle__UpkeepNotNeeded");
			});

			it("Updates the raffle state, emits an event, and calls the VRF coordinator", async function () {
				await raffle.enterRaffle({ value: raffleEntranceFee });
				await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
				await network.provider.request({ method: "evm_mine", params: [] });
				const txResponse = await raffle.performUpkeep([]);
				const txReceipt = await txResponse.wait(1);
				const requestId = txReceipt.events[1].args.requestId;
				const raffleState = await raffle.getRaffleState();
				assert(requestId.toNumber() > 0);
				assert(raffleState.toString() == "1");

			});

		});

		describe("Function : fulfillRandomWords", function () {

			beforeEach(async function () {
				await raffle.enterRaffle({ value: raffleEntranceFee });
				await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
				await network.provider.request({ method: "evm_mine", params: [] });
			});

			it("Can only be called after performUpkeep", async function () {
				await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).
				to.be.revertedWith("nonexistent request");
				await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).
				to.be.revertedWith("nonexistent request");
			});

			it("Picks a winner, resets the lottery, and sends money", async function () {
				
				const additionalEntrants =3;
				const index = 1 // deployer is at 0
				const accounts = await ethers.getSigners();
				
				for(let i = index; i < index + additionalEntrants; i++) {
					const accountConnectedRaffle = raffle.connect(accounts[i]);
					await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
				}
				
				const startingTimeStamp = await raffle.getLatestTimeStamp();

				await new Promise(async (resolve, reject) => {

					raffle.once("WinnerPicked", async () => {

						try {  
							const recentWinner = await raffle.getRecentWinner();
							const raffleState = await raffle.getRaffleState();
							const endingTimeStamp = await raffle.getLatestTimeStamp();
							const numPlayers = await raffle.getNumberOfPlayers();
							const winnerEndingBalance = await accounts[1].getBalance();
							assert.equal(numPlayers.toString(), "0");
							assert.equal(raffleState.toString(), "0");
							assert(endingTimeStamp > startingTimeStamp);
							assert.equal(
								winnerEndingBalance.toString(), 
								winnerStartingBalance.add(
									raffleEntranceFee
									.mul(additionalEntrants)
									.add(raffleEntranceFee)
									.toString()));
						} catch (e) { reject(e); }
						
						resolve();
					});

					const tx = await raffle.performUpkeep([]);
					const txReceipt = await tx.wait(1);
					const winnerStartingBalance = await accounts[1].getBalance();
					await vrfCoordinatorV2Mock.fulfillRandomWords(
					txReceipt.events[1].args.requestId, raffle.address);
					
				});

			});

		});

	});

});
