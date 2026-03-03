const fs = require('fs');

module.exports = {
  process(src, filename) {
    const buffer = fs.readFileSync(filename);
    const base64 = buffer.toString('base64');
    return {
      code: `
        const base64 = ${JSON.stringify(base64)};
        const binaryString = typeof atob === 'function' 
            ? atob(base64) 
            : Buffer.from(base64, 'base64').toString('binary');
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        export default bytes;
      `,
    };
  },
};
