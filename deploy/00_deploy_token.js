// deploy/00_deploy_token.js
module.exports = async ({getNamedAccounts, deployments}) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('MyToken', {
    from: deployer,
    args: [],
    log: true,
  });
};
module.exports.tags = ['MyToken'];
