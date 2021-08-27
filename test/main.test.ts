import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { BigNumber } from "ethers";

import scenarios from "./scenarios.json";

const name = "Glass Editions";
const symbol = "EDITIONS";

const { provider } = waffle;

const deployEditions = async () => {
  const Editions = await ethers.getContractFactory("ReferralEditions");
  const editions = await Editions.deploy("https://contract-uri.xyz");
  return await editions.deployed();
};

describe("Referral Editions", () => {
  describe("editions deployment", () => {
    let minter, purchaser, receiver, fundingRecipient, curator, editionsContract;

    beforeEach(async () => {
      [
        minter,
        purchaser,
        receiver,
        fundingRecipient,
        curator,
      ] = await ethers.getSigners();

      editionsContract = await deployEditions();
    });

    it("deploys editions with basic attributes", async () => {
      expect(await editionsContract.name()).to.eq(name);
      expect(await editionsContract.symbol()).to.eq(symbol);
    });

    it("has a contract URI", async () => {
      const contractURI = await editionsContract.contractURI();
      expect(contractURI).to.eq("https://contract-uri.xyz");
    });


    for (let x = 0; x < scenarios.length; x++) {
      const { quantity, price, commissionPrice, editionId, buyEdition, tokenURI } = scenarios[x];

      describe("create edition", () => {
        describe(`when ${quantity} are sold for ${price}`, async () => {
          let gasUsedForEdition;
          let editionEvent;

          beforeEach(async () => {
            let createEditionTx;

            createEditionTx = await editionsContract.createEdition(
              BigNumber.from(quantity), // quantity
              BigNumber.from(price), // price,
              BigNumber.from(commissionPrice),
              fundingRecipient.address, // fundingRecipient
              tokenURI
            );

            const editionReceipt = await createEditionTx.wait();

            gasUsedForEdition = editionReceipt.gasUsed;

            editionEvent = editionsContract.interface.parseLog(
              editionReceipt.events[0]
            );
          });

          it("creates an event log for the edition being created", async () => {
            const eventData = editionEvent.args;
            expect(eventData.quantity.toString()).to.eq(quantity);
            expect(eventData.price.toString()).to.eq(price);
            expect(eventData.editionId.toString()).to.eq(editionId);
            expect(eventData.fundingRecipient.toString()).to.eq(
              fundingRecipient.address
            );
          });

          it("creates an edition in the editions contract", async () => {
            const firstEdition = await editionsContract.editions(
              BigNumber.from(editionId)
            );

            expect(firstEdition.quantity.toString()).to.eq(quantity);
            expect(firstEdition.price.toString()).to.eq(price);
            expect(firstEdition.fundingRecipient.toString()).to.eq(
              fundingRecipient.address
            );
            expect(firstEdition.numSold.toString()).to.eq("0");
          });

          // it("uses 93421 gas to create edition", async () => {
          //   expect(gasUsedForEdition.toString()).to.eq("93421");
          // });

          describe("check ERC721 functions before minting", () => {
            describe("ownerOf", () => {
              it("reverts", async () => {
                const tx = editionsContract.ownerOf(BigNumber.from(0));

                await expect(tx).to.be.revertedWith(
                  "ERC721: owner query for nonexistent token"
                );
              });

              describe("tokenURI", () => {
                it("reverts", async () => {
                  const tx = editionsContract.tokenURI(BigNumber.from(0));

                  await expect(tx).to.be.revertedWith(
                    "Token has not been sold yet"
                  );
                });
              });
            });

            describe("balanceOf", () => {
              it("returns 0", async () => {
                const result = await editionsContract.balanceOf(
                  purchaser.address
                );
                expect(result.toString()).to.eq("0");
              });
            });
          });

          describe("buyEdition", () => {
            for (let i = 0; i < buyEdition.length; i++) {
              let {
                editionId,
                tokenId,
                numSold,
                balanceOf,
                balanceAfterTransfer,
                reverts,
                revertMessage,
              } = buyEdition[i];

              const revenue = parseInt(price) * parseInt(numSold);

              let tx, receipt, purchaseEvent;

              describe(`purchase #${i + 1}`, () => {
                if (reverts) {
                  it(`reverts with ${revertMessage}`, async () => {
                    for (let l = 0; l < buyEdition[i].revertsOn; l++) {
                      editionsContract
                        .connect(purchaser)
                        .buyEdition(BigNumber.from(editionId), curator.address, {
                          value: BigNumber.from(price),
                        });
                    }

                    const tx = editionsContract
                      .connect(purchaser)
                      .buyEdition(BigNumber.from(editionId), curator.address, {
                        value: BigNumber.from(price),
                      });
                    await expect(tx).to.be.revertedWith(revertMessage);
                  });
                } else {
                  beforeEach(async () => {
                    for (let y = 0; y <= i; y++) {
                      tx = await editionsContract
                        .connect(purchaser)
                        .buyEdition(BigNumber.from(editionId), curator.address, {
                          value: BigNumber.from(price),
                        });
                    }

                    receipt = await tx.wait();
                    purchaseEvent = editionsContract.interface.parseLog(
                      receipt.events[1]
                    );
                  });

                  it("creates an event log for the purchase", async () => {
                    const eventData = purchaseEvent.args;

                    expect(eventData.editionId.toString()).to.eq(editionId);
                    expect(eventData.tokenId.toString()).to.eq(tokenId);
                    expect(eventData.buyer.toString()).to.eq(purchaser.address);
                    expect(eventData.numSold.toString()).to.eq(numSold);
                  });

                  it(`updates the number sold for the editions to ${numSold}`, async () => {
                    const editionData = await editionsContract.editions(
                      BigNumber.from(editionId)
                    );
                    expect(editionData.numSold.toString()).to.eq(numSold);
                  });

                  it("updates the token data in the editions contract", async () => {
                    const owner = await editionsContract.ownerOf(tokenId);
                    expect(owner).to.eq(purchaser.address);
                  });

                  it("increments the balance of the contract", async () => {


                    const recipientBalance = await provider.getBalance(
                      fundingRecipient.address
                    );

                    const curatorBalance = await provider.getBalance(
                      curator.address
                    );

                    console.log(recipientBalance.toString())
                    console.log(curatorBalance.toString())



                    expect(recipientBalance.toString()).to.eq((BigNumber.from(price).sub(BigNumber.from(commissionPrice))).mul(BigNumber.from(numSold)).add(BigNumber.from("10000000000000000000000")));
                    expect(curatorBalance.toString()).to.eq(BigNumber.from(commissionPrice).mul(BigNumber.from(numSold)).add(BigNumber.from("10000000000000000000000")));

                  });

                  describe("check ERC721 functions after minting", () => {
                    describe("ownerOf", () => {
                      it("returns the purchaser", async () => {
                        const owner = await editionsContract.ownerOf(tokenId);
                        expect(owner).to.eq(purchaser.address);
                      });
                    });

                    describe("balanceOf", () => {
                      it("returns 1", async () => {
                        const result = await editionsContract.balanceOf(
                          purchaser.address
                        );
                        expect(result.toString()).to.eq(balanceOf);
                      });
                    });

                    describe("tokenURI", () => {
                      it("returns a valid URI", async () => {
                        const resp = await editionsContract.tokenURI(tokenId);

                        expect(resp).to.eq(tokenURI);
                      });
                    });

                    describe("transferFrom", () => {
                      describe("when not approved", () => {
                        it("reverts", async () => {
                          const tx = editionsContract.transferFrom(
                            purchaser.address,
                            receiver.address,
                            tokenId
                          );

                          await expect(tx).to.be.revertedWith(
                            "ERC721: transfer caller is not owner nor approved"
                          );
                        });
                      });

                      describe("when approved for transfer", () => {
                        beforeEach(async () => {
                          await editionsContract
                            .connect(purchaser)
                            .approve(receiver.address, tokenId);
                        });

                        describe("getApproved", () => {
                          it("returns the receiver address", async () => {
                            const approved = await editionsContract.getApproved(
                              tokenId
                            );
                            expect(approved).to.eq(receiver.address);
                          });
                        });

                        it("transfers the token", async () => {
                          await editionsContract
                            .connect(receiver)
                            .transferFrom(
                              purchaser.address,
                              receiver.address,
                              tokenId
                            );

                          const owner = await editionsContract.ownerOf(tokenId);
                          expect(owner).to.eq(receiver.address);

                          const purchaserBalance = await editionsContract.balanceOf(
                            purchaser.address
                          );
                          expect(purchaserBalance.toString()).to.eq(
                            balanceAfterTransfer
                          );

                          const receiverBalance = await editionsContract.balanceOf(
                            receiver.address
                          );
                          expect(receiverBalance.toString()).to.eq("1");
                        });
                      });
                    });
                  });
                }
              });
            }
          });
        });
      });
    }
  });
});

async function computeAddress(
  name: string,
  symbol: string,
  proxyAddress: any,
  factory: any
) {
  const constructorArgs = ethers.utils.defaultAbiCoder.encode(
    ["string", "string"],
    [name, symbol]
  );
  const salt = ethers.utils.keccak256(constructorArgs);
  const proxyBytecode = (await ethers.getContractFactory("EditionProxy"))
    .bytecode;
  const codeHash = ethers.utils.keccak256(proxyBytecode);
  proxyAddress = await ethers.utils.getCreate2Address(
    factory.address,
    salt,
    codeHash
  );
  return proxyAddress;
}
