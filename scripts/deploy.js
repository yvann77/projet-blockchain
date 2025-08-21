const hre = require("hardhat");

async function main() {
  console.log("🚀 Déploiement du contrat de vote...");
  
  // Déployer le contrat
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy("Élection Présidentielle 2025");
  
  await voting.deployed();
  
  console.log("✅ Contrat déployé à l'adresse:", voting.address);
  
  // Ajouter des candidats
  console.log("📝 Ajout des candidats...");
  await voting.addCandidate("Marine Le Pen");
  await voting.addCandidate("Emmanuel Macron");
  await voting.addCandidate("Jean-Luc Mélenchon");
  await voting.addCandidate("Éric Zemmour");
  
  console.log("✅ Candidats ajoutés avec succès");
  
  // Enregistrer des électeurs (adresses de test Hardhat)
  const [owner, voter1, voter2, voter3, voter4, voter5] = await hre.ethers.getSigners();
  
  console.log("👥 Enregistrement des électeurs...");
  await voting.registerMultipleVoters([
    voter1.address,
    voter2.address,
    voter3.address,
    voter4.address,
    voter5.address
  ]);
  
  console.log("✅ Électeurs enregistrés");
  
  // Sauvegarder les informations importantes
  const deploymentInfo = {
    contractAddress: voting.address,
    owner: owner.address,
    voters: [
      { address: voter1.address, privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
      { address: voter2.address, privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
      { address: voter3.address, privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
      { address: voter4.address, privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
      { address: voter5.address, privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" }
    ],
    network: "localhost",
    chainId: 1337
  };
  
  console.log("\n📋 Informations de déploiement:");
  console.log("Adresse du contrat:", deploymentInfo.contractAddress);
  console.log("Propriétaire:", deploymentInfo.owner);
  console.log("Réseau:", deploymentInfo.network);
  
  // Sauvegarder dans un fichier pour le frontend
  const fs = require('fs');
  fs.writeFileSync(
    './frontend/contract-info.js',
    `const CONTRACT_INFO = ${JSON.stringify(deploymentInfo, null, 2)};`
  );
  
  console.log("✅ Informations sauvegardées dans frontend/contract-info.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
