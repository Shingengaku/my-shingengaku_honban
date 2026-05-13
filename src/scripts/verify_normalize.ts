
import crypto from 'crypto';

function testNormalize() {
    const p1 = "Password123";
    const p2 = "Ｐａｓｓｗｏｒｄ１２３"; // Full-width

    const h1 = crypto.createHash('sha256').update(p1.trim().normalize('NFKC')).digest('hex');
    const h2 = crypto.createHash('sha256').update(p2.trim().normalize('NFKC')).digest('hex');

    console.log(`P1: ${p1} -> Hash: ${h1}`);
    console.log(`P2: ${p2} -> Hash: ${h2}`);
    console.log(`Match: ${h1 === h2}`);

    const u1 = "admin@example.com";
    const u2 = "ａｄｍｉｎ＠ｅｘａｍｐｌｅ．ｃｏｍ"; // Full-width
    
    const n1 = u1.trim().normalize('NFKC');
    const n2 = u2.trim().normalize('NFKC');
    
    console.log(`U1: ${u1} -> Norm: ${n1}`);
    console.log(`U2: ${u2} -> Norm: ${n2}`);
    console.log(`Match: ${n1 === n2}`);
}

testNormalize();
