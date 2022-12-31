const { assert, expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");
console.log(`Network name : ${network.name}`);

const ENABLED = false;

developmentChains.includes(network.name) || !ENABLED
? describe.skip 
: describe("Raffle Staging Tests", function () {

	let raffle, raffleEntranceFee, deployer

	beforeEach(async function() {
		deployer = (await getNamedAccounts()).deployer;
		raffle = await ethers.getContract("Raffle", deployer);
		raffleEntranceFee = await raffle.getEntranceFee();
	});

	describe("Function : fulfillRandomWords", function () {

		it("Works with live ChainLink keepers and ChainLink VRF, we get a random winner", async function () {
			
			const startingTimeStamp = await raffle.getLatestTimeStamp();
			const accounts = await ethers.getSigners();

			await new Promise(async (resolve, reject) => {
				
				raffle.once("WinnerPicked", async () => {

					console.log("WinnerPicked event detected.")

					try {

						const recentWinner = await raffle.getRecentWinner();
						const raffleState = await raffle.getRaffleState();
						const winnerEndingBalance = await accounts[0].getBalance();
						const endingTimeStamp = await raffle.getLatestTimeStamp();
						
						await expect(raffle.getPlayer(0)).to.be.reverted;
						assert.equal(recentWinner.toString(), accounts[0].address);
						assert.equal(raffleState, 0);
						assert.equal(winnerEndingBalance.toString(), 
						winnerStartingBalance.add(raffleEntranceFee).toString());
						assert(endingTimeStamp > startingTimeStamp);

						console.log("Test finished.")
						resolve();

					} catch (error) {
						console.log(error); 
						reject(error);
					}
					
				});

				console.log("Entering raffle")
				// This code will be executed asynchronously while the listener is listening
				const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
				console.log("Waiting 1 x block confirmation");
				await tx.wait(1);
				const winnerStartingBalance = await accounts[0].getBalance();
				console.log("Listening for Automation & VRF to complete")
				// This block of code will not finish until the promise is resolved (or rejected)
			});

			console.log("Testing complete.")
			
		});

	});

});