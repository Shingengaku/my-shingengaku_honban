
const fs = require('fs');

async function run() {
    const wasmBuffer = fs.readFileSync('c:/Users/pigua/.gemini/antigravity/scratch/shingengaku-app/main.wasm');
    const { instance } = await WebAssembly.instantiate(wasmBuffer);
    const memory = instance.exports.memory;
    const f64 = new Float64Array(memory.buffer);

    const input = [0, 0, 1, 0, 1, 0, 0, 0, 1];
    const v0 = 1000 / 8;
    const v1 = 1096 / 8;

    // Zero out memory
    f64.fill(0, v0, v0 + 12);
    f64.fill(0, v1, v1 + 12);

    // Load input into v0
    for (let i = 0; i < input.length; i++) {
        f64[v0 + i] = input[i];
    }

    // Call invoke_f4(v0_addr, v1_addr, v0_addr)
    // Actually the wasm uses byte offsets, so 1000 and 1096
    instance.exports.invoke_f4(1000, 1096, 1000);

    // Read result from v0
    const result = [];
    for (let i = 0; i < 12; i++) {
        result.push(f64[v0 + i]);
    }
    console.log(result.join(' '));
}

run();
