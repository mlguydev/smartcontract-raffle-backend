const { network, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

async function main () {
	
	console.log("Getting default deployer account...");
	deployer = (await getNamedAccounts()).deployer;
	console.log("Getting raffle contract...");
	raffle = await ethers.getContract("Raffle", deployer);
	console.log("Reading entrance fee from raffle contract...");
	raffleEntraceFee = await raffle.getEntranceFee();

	await new Promise(async (resolve, reject) => {

			raffle.once("RaffleEnter", () => {
				console.log("Raffle enter event detected...");
			});

			raffle.once("RequestedRaffleWinner", () => {
				console.log("VRF request event detected...");
			});

			raffle.once("WinnerPicked", async () => {
				console.log("Winner picked event detected, reading recentWinner from contract...")
				const recentWinner = await raffle.getRecentWinner();
				console.log(`Recent winner was : ${recentWinner}`);
				resolve()
			});

		console.log("Entering raffle...");
		await raffle.enterRaffle({ value: raffleEntraceFee });
		console.log("Listening for events...")

	});

	console.log("Promise resolved.")
}

main () 
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
