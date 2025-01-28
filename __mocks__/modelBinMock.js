const fs = require('fs');
const path = require('path');

const realModelBinPath = path.resolve(__dirname, '../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin')
const rawBin = fs.readFileSync(realModelBinPath);
const base64Bin = rawBin.toString('base64');
const dataUrl = `data:application/octet-stream;base64,${base64Bin}`;

module.exports = dataUrl;
