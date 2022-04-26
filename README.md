# SHT4X Temapture Sensor

Reads humidity and temperature from the SHT40, SHT41, and SHT45 sensor via I2C.

## Installation
```
npm install sht4x
```

## Example
```js
const SHT4X = require('../SHT4X.js');

const main = async () => {
    const thermostat = await SHT4X.open();
    console.log(await thermostat.serialNumber());
    console.log(await thermostat.measurements());
}

main();
```