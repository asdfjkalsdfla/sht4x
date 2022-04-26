const i2c = require('i2c-bus');
const polycrc = require('polycrc');

const sleep = (duration) => new Promise((resolve) => {
    setTimeout(resolve, duration);
});

const crc8 = new polycrc.crc(8, 0x31, 0xFF, 0x00, false)

const _SHT4X_DEFAULT_ADDR = 0x44; // SHT4X I2C Address
const _SHT4X_READSERIAL = [0x89];  // Read Out of Serial Register
const _SHT4X_SOFTRESET = [0x94];  // Soft Reset

const MODES = {
    NOHEAT_HIGHPRECISION: { command: [0xFD], description: "No heater, high precision", readTime: 10 },
    NOHEAT_MEDPRECISION: { command: [0xF6], description: "No heater, med precision", readTime: 5 },
    NOHEAT_LOWPRECISION: { command: [0xE0], description: "No heater, low precision", readTime: 2 },
    HIGHHEAT_1S: { command: [0x39], description: "High heat, 1 second", readTime: 1110 },
    HIGHHEAT_100MS: { command: [0x32], description: "High heat, 0.1 second", readTime: 110 },
    MEDHEAT_1S: { command: [0x2F], description: "Med heat, 1 second", readTime: 1110 },
    MEDHEAT_100MS: { command: [0x24], description: "Med heat, 0.1 seconds", readTime: 110 },
    LOWHEAT_1S: { command: [0x1E], description: "Low heat, 1 second", readTime: 1110 },
    LOWHEAT_100MS: { command: [0x15], description: "Low heat, 0.1 second", readTime: 110 },
}

class SHT4X {
    #mode;

    constructor(bus, address = _SHT4X_DEFAULT_ADDR) {
        this.bus = bus;
        this.address = address;
        this.#mode = "NOHEAT_HIGHPRECISION";
    }

    static async open(busNumber = 1) {
		try {
			const bus = await i2c.openPromisified(busNumber);
			const sensor = new SHT4X(bus);
			await sensor.init();
			return sensor;
		} catch (err) {
			return err;
		}
	}

    async init() {
        await this.reset();
    }

    async serialNumber() {
        const writeBuffer = Buffer.from(_SHT4X_READSERIAL);
        await this.bus.i2cWrite(this.address, writeBuffer.length, writeBuffer);
        await sleep(10)
        const readBuffer = Buffer.alloc(6);
        await this.bus.i2cRead(this.address, readBuffer.length, readBuffer);
        const ser1 = readBuffer.subarray(0, 2);
        const ser1CRC = readBuffer.subarray(2);
        if(crc8(ser1) !== ser1CRC[0]) throw new Error("Serial CRC Doesn't Match");
        const ser2 = readBuffer.subarray(3, 5)
        const ser2CRC = readBuffer.subarray(5);
        if(crc8(ser2) !== ser2CRC[0]) throw new Error("Serial CRC Doesn't Match");
        const serial = (ser1[0] << 24) | (ser1[1] << 16) | (ser2[0] << 8) | ser2[1];
        return serial;
    }

    async reset() {
        const writeBuffer = Buffer.from(_SHT4X_SOFTRESET);
        await this.bus.i2cWrite(this.address, writeBuffer.length, writeBuffer);
        await sleep(1);
    }

    get mode() {
        return this.#mode;
    }

    set mode(modeSpecified) {
        if (!MODES[modeSpecified])
            return
        this.#mode = modeSpecified;
    }

    async relativeHumidity() {
        return this.measurements().humidity;
    }

    async temperature() {
        return this.measurements().temperature;
    }

    async measurements() {
        const modeData = MODES[this.#mode];
        const writeBuffer = Buffer.from(modeData.command);
        await this.bus.i2cWrite(this.address, writeBuffer.length, writeBuffer);
        await sleep(modeData.readTime);
        const readBuffer = Buffer.alloc(6);
        await this.bus.i2cRead(this.address, readBuffer.length, readBuffer);

        const tempData = readBuffer.subarray(0,2);
        const tempCRC = readBuffer.subarray(2);
        if(crc8(tempData) !== tempCRC[0]) throw new Error("Temp CRC Doesn't Match");

        const humidityData = readBuffer.subarray(3, 5);
        const humidityCRC = readBuffer.subarray(5);
        if(crc8(humidityData) !== humidityCRC[0]) throw new Error("Humidity CRC Doesn't Match");

        // decode data into human values
        // convert bytes into 16 - bit signed integer
        let temperature = tempData.readUInt16BE(0);
        temperature = -49.0 + 315.0 * temperature / 65535.0

        // repeat above steps for humidity data
        let humidity = humidityData.readUInt16BE(0);
        // let humidity = (readBuffer[3] << 8) | readBuffer[4];
        humidity = -6.0 + 125.0 * humidity / 65535.0
        humidity = Math.max(Math.min(humidity, 100), 0)
        

        return {
            humidity,
            temperature
        }
    }
}

module.exports = SHT4X;