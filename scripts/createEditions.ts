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
  const RECIPIENT = '0xDb6c1a8aF1883262aaD221A25816468ef693D4A2' // GLASS ADDR
  const TOKEN_URI = 'https://arweave.net/u65DVrZ6dpiE78n38pyAlu4kH58r5Q_fc8VZ_iqI9yc'


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
        25,
        // The price to purchase a token.
        utils.parseEther('0.15'),
        // The amount paid to the referrer (cannot be larger than price)
        utils.parseEther('0.05'),
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