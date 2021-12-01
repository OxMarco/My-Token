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
  ["marketing", ["marketing", "m"]],
]);

async function main() {
  console.log("Set Marketing Address\n\n");

  const argv = parseArgs(process.argv.slice(2), {
    string: ["key", "k", "network", "n", "token", "t", "marketing", "m"],
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

        --marketing   -m : Marketing address\n
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
  const marketing = parameters.marketing;

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

  await Token.setMarketingAddress(marketing);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
});
