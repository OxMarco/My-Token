const { ethers } = require("hardhat");
const parseArgs = require("minimist");
const TOKEN = require("../artifacts/contracts/MyToken.sol/MyToken.json");
const {
  abi
} = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");

const PARAMETERS = Object.freeze([
  ["key", ["key", "k"]],
  ["network", ["network", "n"]],
  ["token", ["token", "t"]],
  ["maxtx", ["maxtx", "m"]],
  ["maxwallet", ["maxwallet", "w"]],
  ["minswap", ["minswap", "s"]],
]);

async function main() {
  console.log("Set Limits\n\n");

  const argv = parseArgs(process.argv.slice(2), {
    string: ["key", "k", "network", "n", "token", "t", "maxtx", "m", "maxwallet", "w", "minswap", "s"],
  });

  const paramsCheck = PARAMETERS.every((parameterTuple) => {
    const [_name, [long, short]] = parameterTuple;
    return long in argv || short in argv;
  });

  if (!paramsCheck) {
    console.log(`
      Missing mandatory parameters!\n

      Help:\n

        --key         -k : Ethereum wallet private key\n

        --network     -n : Destination network URL\n

        --token       -t : Token address\n

        --maxtx       -m : Max Tx amount\n

        --maxwallet   -w : Max wallet amount\n

        --minswap     -s : Minimum swap amount\n
    `);

    return;
  }

  const parameters = {};

  PARAMETERS.forEach((param) => {
    const [name, [long, short]] = param;
    parameters[name] = argv[long] || argv[short];
  });

  const key = parameters.key;
  const network = parameters.network;
  const token = parameters.token;
  const maxtx = parameters.maxtx;
  const maxwallet = parameters.maxwallet;
  const minswap = parameters.minswap;

  let URL;
  switch(network) {
    case 'mainnet':
      URL = "https://mainnet.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad";
    break;

    case 'rinkeby':
      URL = "https://rinkeby.infura.io/v3/460f40a260564ac4a4f4b3fffb032dad";
    break;
  }

  const provider = new ethers.providers.JsonRpcProvider(URL);
  const signer = new ethers.Wallet(key, provider);

  const Token = new ethers.Contract(
    token,
    TOKEN.abi,
    signer
  );

  console.log("Old txn amount", (await Token._maxTxAmount()).toString());
  if(maxtx == 0) {
    await Token.setMaxTxnAmount(ethers.constants.MaxUint256);
  } else {
    await Token.setMaxTxnAmount(ethers.utils.parseUnits(maxtx, 9));
  }

  console.log("Old max wallet size", (await Token._maxWalletSize()).toString());
  if(maxwallet == 0) {
    await Token.setMaxWalletSize(ethers.constants.MaxUint256);
  } else {
    await Token.setMaxWalletSize(ethers.utils.parseUnits(maxwallet, 9));
  }

  console.log("Old min swap amount", (await Token._swapTokensAtAmount()).toString());
  if(minswap == 0) {
    await Token.setMinSwapTokensThreshold(ethers.constants.MaxUint256);
  } else {
    await Token.setMinSwapTokensThreshold(ethers.utils.parseUnits(minswap, 9));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});
