const SHT4X = require('../SHT4X.js');

const main = async () => {
    const thermostat = await SHT4X.open();
    console.log(await thermostat.serialNumber());
    console.log(await thermostat.measurements());
}

main();