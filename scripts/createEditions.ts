import { utils } from 'ethers';
import { ethers, waffle } from "hardhat";
import fs from "fs";


const NETWORK_MAP = {
  "1": "mainnet",
  "4": "rinkeby",
  "1337": "hardhat",
  "31337": "hardhat",
};

async function main() {
  const RECIPIENT = '0x5f66Ce3fc08Ca73a715B4d00616DBb558975d927' // DELLY ADDR
  const TOKEN_URI = 'ar://jlPqgRN64nqsqX04uI0z5alJIKudGIGwEPalDsLfG6c'


  const chainId = (await waffle.provider.getNetwork()).chainId;
  console.log({ chainId });
  const networkName = NETWORK_MAP[chainId];

  let rawdata = fs.readFileSync(`${__dirname}/../networks/${networkName}.json`);
  let network = JSON.parse(rawdata.toString());
  const editionAddress = network.Contracts.editions
  
  const EditionsFactory = await ethers.getContractFactory("ReferralEditions");
    const editions = EditionsFactory.attach(editionAddress);
    await editions.createEdition(
        // The number of tokens that can be minted and sold.
        27,
        // The price to purchase a token.
        utils.parseEther('0.027'),
        // The amount paid to the referrer (cannot be larger than price)
        utils.parseEther('0.007'),
        // The account that should receive the revenue.
        RECIPIENT,
        TOKEN_URI,
    )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });