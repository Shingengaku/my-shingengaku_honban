
const SECRET = process.env.SESSION_SECRET || 'fallback-secret-key-change-this-in-prod';

// Web Crypto API helpers
function bufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64ToUint8Array(base64: string): Uint8Array {
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function getKey() {
    const encoder = new TextEncoder();
    return await crypto.subtle.importKey(
        'raw',
        encoder.encode(SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

/**
 * ユーザー名の署名付きセッショントークンを生成する (Async)
 */
export async function signSession(username: string): Promise<string> {
    const key = await getKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(username);

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        data
    );

    const dataBase64 = bufferToBase64(data.buffer as ArrayBuffer); // username is string, encoded to Uint8Array
    const signBase64 = bufferToBase64(signature);

    return `${dataBase64}.${signBase64}`;
}

/**
 * セッショントークンを検証し、正しければユーザー名を返す (Async)
 */
export async function verifySession(token: string): Promise<string | null> {
    if (!token || !token.includes('.')) return null;

    const [dataBase64, signatureBase64] = token.split('.');
    if (!dataBase64 || !signatureBase64) return null;

    try {
        const key = await getKey();
        const signature = base64ToUint8Array(signatureBase64);
        const data = base64ToUint8Array(dataBase64);

        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            data
        );

        if (!isValid) return null;

        return new TextDecoder().decode(data);
    } catch {
        return null;
    }
}
