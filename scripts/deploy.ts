import { ethers, waffle } from "hardhat";
import fs from "fs";

const NETWORK_MAP = {
  "1": "mainnet",
  "4": "rinkeby",
  "1337": "hardhat",
  "31337": "hardhat",
};

let isLocal = false;

async function main() {
  const chainId = (await waffle.provider.getNetwork()).chainId;

  console.log(await waffle.provider.getSigner().getAddress())

  console.log({ chainId });
  const networkName = NETWORK_MAP[chainId];

  console.log(`Deploying to ${networkName}`);

  const Editions = await ethers.getContractFactory("ReferralEditions");
  const editions = await Editions.deploy("https://arweave.net/67tSLhzy-ji2Gbfoe6wujBbhkQ3jfFrThUj2Y9d8qao");
  await editions.deployed();

  const info = {
    Contracts: {
      editions: editions.address,
    },
  };

  console.log(info);

  if (!isLocal) {
    fs.writeFileSync(
      `${__dirname}/../networks/${networkName}.json`,
      JSON.stringify(info, null, 2)
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
