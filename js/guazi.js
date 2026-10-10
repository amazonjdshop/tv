// Minimal Pure JS AES-128-CBC with PKCS7 Padding
// Fully standalone, zero dependencies, < 5KB

(function(global) {
    // S-Box and Inverse S-Box
    const sbox = new Uint8Array([
        0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
        0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
        0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
        0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
        0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
        0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
        0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
        0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
        0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
        0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
        0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
        0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
        0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
        0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
        0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
        0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ]);

    const rsbox = new Uint8Array(256);
    for (let i = 0; i < 256; i++) rsbox[sbox[i]] = i;

    const rcon = new Uint8Array([0x8d, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);

    function keyExpansion(keyBytes) {
        const w = new Uint8Array(176); // 11 * 16 bytes for AES-128
        w.set(keyBytes.subarray(0, 16));
        let i = 16;
        while (i < 176) {
            let temp = [w[i - 4], w[i - 3], w[i - 2], w[i - 1]];
            if (i % 16 === 0) {
                const k0 = temp[0];
                temp[0] = sbox[temp[1]] ^ rcon[i / 16];
                temp[1] = sbox[temp[2]];
                temp[2] = sbox[temp[3]];
                temp[3] = sbox[k0];
            }
            w[i] = w[i - 16] ^ temp[0];
            w[i + 1] = w[i - 15] ^ temp[1];
            w[i + 2] = w[i - 14] ^ temp[2];
            w[i + 3] = w[i - 13] ^ temp[3];
            i += 4;
        }
        return w;
    }

    function addRoundKey(state, w, round) {
        const offset = round * 16;
        for (let i = 0; i < 16; i++) state[i] ^= w[offset + i];
    }

    function subBytes(state) {
        for (let i = 0; i < 16; i++) state[i] = sbox[state[i]];
    }

    function invSubBytes(state) {
        for (let i = 0; i < 16; i++) state[i] = rsbox[state[i]];
    }

    function shiftRows(state) {
        let t = state[1]; state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = t;
        t = state[2]; state[2] = state[10]; state[10] = t;
        t = state[6]; state[6] = state[14]; state[14] = t;
        t = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = t;
    }

    function invShiftRows(state) {
        let t = state[13]; state[13] = state[9]; state[9] = state[5]; state[5] = state[1]; state[1] = t;
        t = state[2]; state[2] = state[10]; state[10] = t;
        t = state[6]; state[6] = state[14]; state[14] = t;
        t = state[3]; state[3] = state[7]; state[7] = state[11]; state[11] = state[15]; state[15] = t;
    }

    function xtime(x) {
        return ((x << 1) ^ (((x >> 7) & 1) * 0x1b)) & 0xff;
    }

    function mixColumns(s) {
        for (let c = 0; c < 4; c++) {
            const i = c * 4;
            const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
            const t = a0 ^ a1 ^ a2 ^ a3;
            const u = a0;
            s[i] ^= t ^ xtime(a0 ^ a1);
            s[i + 1] ^= t ^ xtime(a1 ^ a2);
            s[i + 2] ^= t ^ xtime(a2 ^ a3);
            s[i + 3] ^= t ^ xtime(a3 ^ u);
        }
    }

    function multiply(x, y) {
        return (((y & 1) * x) ^
            ((y >> 1 & 1) * xtime(x)) ^
            ((y >> 2 & 1) * xtime(xtime(x))) ^
            ((y >> 3 & 1) * xtime(xtime(xtime(x)))) ^
            ((y >> 4 & 1) * xtime(xtime(xtime(xtime(x)))))) & 0xff;
    }

    function invMixColumns(s) {
        for (let c = 0; c < 4; c++) {
            const i = c * 4;
            const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
            s[i] = multiply(a0, 0x0e) ^ multiply(a1, 0x0b) ^ multiply(a2, 0x0d) ^ multiply(a3, 0x09);
            s[i + 1] = multiply(a0, 0x09) ^ multiply(a1, 0x0e) ^ multiply(a2, 0x0b) ^ multiply(a3, 0x0d);
            s[i + 2] = multiply(a0, 0x0d) ^ multiply(a1, 0x09) ^ multiply(a2, 0x0e) ^ multiply(a3, 0x0b);
            s[i + 3] = multiply(a0, 0x0b) ^ multiply(a1, 0x0d) ^ multiply(a2, 0x09) ^ multiply(a3, 0x0e);
        }
    }

    function encryptBlock(block, w) {
        const s = new Uint8Array(block);
        addRoundKey(s, w, 0);
        for (let r = 1; r < 10; r++) {
            subBytes(s);
            shiftRows(s);
            mixColumns(s);
            addRoundKey(s, w, r);
        }
        subBytes(s);
        shiftRows(s);
        addRoundKey(s, w, 10);
        return s;
    }

    function decryptBlock(block, w) {
        const s = new Uint8Array(block);
        addRoundKey(s, w, 10);
        for (let r = 9; r > 0; r--) {
            invShiftRows(s);
            invSubBytes(s);
            addRoundKey(s, w, r);
            invMixColumns(s);
        }
        invShiftRows(s);
        invSubBytes(s);
        addRoundKey(s, w, 0);
        return s;
    }

    function strToUtf8Bytes(str) {
        const utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);
            if (charcode < 0x80) utf8.push(charcode);
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
            } else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
            } else {
                i++;
                charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
            }
        }
        return new Uint8Array(utf8);
    }

    function utf8BytesToStr(bytes) {
        let out = '';
        let i = 0;
        while (i < bytes.length) {
            const c = bytes[i++];
            if (c >> 7 === 0) out += String.fromCharCode(c);
            else if (c >> 5 === 0x06) {
                const c2 = bytes[i++];
                out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
            } else if (c >> 4 === 0x0e) {
                const c2 = bytes[i++];
                const c3 = bytes[i++];
                out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
            } else if (c >> 3 === 0x1e) {
                const c2 = bytes[i++];
                const c3 = bytes[i++];
                const c4 = bytes[i++];
                let code = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
                code -= 0x10000;
                out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
            }
        }
        return out;
    }

    function bytesToHex(bytes) {
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            const h = bytes[i].toString(16);
            hex += (h.length === 1 ? '0' : '') + h;
        }
        return hex;
    }

    function hexToBytes(hex) {
        const clean = hex.replace(/[^0-9a-fA-F]/g, '');
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
        }
        return bytes;
    }

    function aesCbcEncrypt(plaintext, keyStr, ivStr) {
        const keyBytes = strToUtf8Bytes(keyStr);
        const ivBytes = strToUtf8Bytes(ivStr);
        const w = keyExpansion(keyBytes);
        const ptBytes = strToUtf8Bytes(plaintext);

        // PKCS#7 padding
        const padLen = 16 - (ptBytes.length % 16);
        const padded = new Uint8Array(ptBytes.length + padLen);
        padded.set(ptBytes);
        padded.fill(padLen, ptBytes.length);

        const out = new Uint8Array(padded.length);
        let prevBlock = ivBytes.slice(0, 16);

        for (let i = 0; i < padded.length; i += 16) {
            const block = new Uint8Array(16);
            for (let j = 0; j < 16; j++) block[j] = padded[i + j] ^ prevBlock[j];
            const enc = encryptBlock(block, w);
            out.set(enc, i);
            prevBlock = enc;
        }

        return bytesToHex(out);
    }

    function aesCbcDecrypt(hexCipher, keyStr, ivStr) {
        const keyBytes = strToUtf8Bytes(keyStr);
        const ivBytes = strToUtf8Bytes(ivStr);
        const w = keyExpansion(keyBytes);
        const ctBytes = hexToBytes(hexCipher);

        if (ctBytes.length % 16 !== 0 || ctBytes.length === 0) return '';

        const decrypted = new Uint8Array(ctBytes.length);
        let prevBlock = ivBytes.slice(0, 16);

        for (let i = 0; i < ctBytes.length; i += 16) {
            const ctBlock = ctBytes.subarray(i, i + 16);
            const decBlock = decryptBlock(ctBlock, w);
            for (let j = 0; j < 16; j++) {
                decrypted[i + j] = decBlock[j] ^ prevBlock[j];
            }
            prevBlock = ctBlock;
        }

        // PKCS#7 unpad
        const padLen = decrypted[decrypted.length - 1];
        if (padLen <= 0 || padLen > 16) return '';
        for (let i = decrypted.length - padLen; i < decrypted.length; i++) {
            if (decrypted[i] !== padLen) return '';
        }

        return utf8BytesToStr(decrypted.subarray(0, decrypted.length - padLen));
    }

    global.miniAES = {
        encrypt: aesCbcEncrypt,
        decrypt: aesCbcDecrypt
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);



/**
 * 瓜子影视 (gz360.tv) QuickJS 点播爬虫
 * 适用于 FongMi (潘多拉影视) / CatVod / TVBox QuickJS 引擎
 */

let host = 'https://gz360.tv';
const apiHosts = [
    'https://haiwaiapi.1fc8ab0.com/Pc',
    'https://hyperf.718fd9f.com/Pc'
];
let apiUrl = apiHosts[0];

const KEY = '181cc88340ae5b2b';
const IV = '4423d1e2773476ce';

const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://gz360.tv',
    'Referer': 'https://gz360.tv/',
    'Content-Type': 'application/json'
};

const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64_encode(str) {
    if (typeof btoa === 'function') {
        try { return btoa(str); } catch (e) {}
    }
    let out = '', i = 0, len = str.length;
    while (i < len) {
        const c1 = str.charCodeAt(i++) & 255;
        if (i === len) {
            out += b64chars.charAt(c1 >> 2) + b64chars.charAt((c1 & 3) << 4) + '==';
            break;
        }
        const c2 = str.charCodeAt(i++) & 255;
        if (i === len) {
            out += b64chars.charAt(c1 >> 2) + b64chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) + b64chars.charAt((c2 & 15) << 2) + '=';
            break;
        }
        const c3 = str.charCodeAt(i++) & 255;
        out += b64chars.charAt(c1 >> 2) + b64chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) + b64chars.charAt(((c2 & 15) << 2) | (c3 >> 6)) + b64chars.charAt(c3 & 63);
    }
    return out;
}

function b64_decode(str) {
    if (typeof atob === 'function') {
        try { return atob(str); } catch (e) {}
    }
    str = (str || '').replace(/[^A-Za-z0-9+/=]/g, '');
    let out = '', i = 0;
    while (i < str.length) {
        const enc1 = b64chars.indexOf(str.charAt(i++));
        const enc2 = b64chars.indexOf(str.charAt(i++));
        const enc3 = b64chars.indexOf(str.charAt(i++));
        const enc4 = b64chars.indexOf(str.charAt(i++));

        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;

        out += String.fromCharCode(chr1);
        if (enc3 !== 64 && enc3 !== -1) out += String.fromCharCode(chr2);
        if (enc4 !== 64 && enc4 !== -1) out += String.fromCharCode(chr3);
    }
    return out;
}

const HEX_MAP = [];
for (let i = 0; i < 256; i++) HEX_MAP[i] = -1;
for (let i = 0; i < 10; i++) HEX_MAP[48 + i] = i;
for (let i = 0; i < 6; i++) {
    HEX_MAP[65 + i] = 10 + i;
    HEX_MAP[97 + i] = 10 + i;
}

function hexToBase64(hex) {
    hex = (hex || '').trim();
    const len = hex.length;
    if (len === 0) return '';
    const parts = [];
    let chunk = '';
    let i = 0;
    while (i < len) {
        const c1 = HEX_MAP[hex.charCodeAt(i++) & 255];
        const c2 = HEX_MAP[hex.charCodeAt(i++) & 255];
        const b1 = (c1 << 4) | c2;
        if (i >= len) {
            chunk += b64chars.charAt(b1 >> 2) + b64chars.charAt((b1 & 3) << 4) + '==';
            break;
        }
        const c3 = HEX_MAP[hex.charCodeAt(i++) & 255];
        const c4 = HEX_MAP[hex.charCodeAt(i++) & 255];
        const b2 = (c3 << 4) | c4;
        if (i >= len) {
            chunk += b64chars.charAt(b1 >> 2) + b64chars.charAt(((b1 & 3) << 4) | (b2 >> 4)) + b64chars.charAt((b2 & 15) << 2) + '=';
            break;
        }
        const c5 = HEX_MAP[hex.charCodeAt(i++) & 255];
        const c6 = HEX_MAP[hex.charCodeAt(i++) & 255];
        const b3 = (c5 << 4) | c6;
        chunk += b64chars.charAt(b1 >> 2) + b64chars.charAt(((b1 & 3) << 4) | (b2 >> 4)) + b64chars.charAt(((b2 & 15) << 2) | (b3 >> 6)) + b64chars.charAt(b3 & 63);
        if (chunk.length > 8192) {
            parts.push(chunk);
            chunk = '';
        }
    }
    if (chunk) parts.push(chunk);
    return parts.join('');
}

function base64ToHex(b64) {
    b64 = (b64 || '').replace(/[^A-Za-z0-9+/]/g, '');
    let hex = '';
    let i = 0;
    while (i < b64.length) {
        const enc1 = b64chars.indexOf(b64.charAt(i++));
        const enc2 = b64chars.indexOf(b64.charAt(i++));
        const enc3 = i < b64.length ? b64chars.indexOf(b64.charAt(i++)) : -1;
        const enc4 = i < b64.length ? b64chars.indexOf(b64.charAt(i++)) : -1;

        const chr1 = (enc1 << 2) | (enc2 >> 4);
        hex += (chr1 < 16 ? '0' : '') + chr1.toString(16);

        if (enc3 >= 0) {
            const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            hex += (chr2 < 16 ? '0' : '') + chr2.toString(16);
        }
        if (enc4 >= 0) {
            const chr3 = ((enc3 & 3) << 6) | enc4;
            hex += (chr3 < 16 ? '0' : '') + chr3.toString(16);
        }
    }
    return hex;
}

function encrypt(obj) {
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (typeof aesX === 'function') {
        try {
            let b64 = aesX('AES/CBC/PKCS5', true, text, false, KEY, IV, true);
            if (!b64) b64 = aesX('AES/CBC/PKCS7', true, text, false, KEY, IV, true);
            if (b64 && typeof b64 === 'string' && b64.trim().length > 0) {
                return base64ToHex(b64.trim());
            }
        } catch (e) {}
    }
    if (typeof globalThis !== 'undefined' && globalThis.miniAES) {
        return globalThis.miniAES.encrypt(text, KEY, IV);
    }
    throw new Error('AES cipher not available');
}

function decrypt(hexStr) {
    if (!hexStr) return '';
    hexStr = String(hexStr).trim();
    if (typeof aesX === 'function') {
        try {
            const b64 = hexToBase64(hexStr);
            let dec = aesX('AES/CBC/PKCS5', false, b64, true, KEY, IV, false);
            if (!dec) dec = aesX('AES/CBC/PKCS7', false, b64, true, KEY, IV, false);
            if (dec && typeof dec === 'string' && dec.length > 0) {
                return dec;
            }
        } catch (e) {}
    }
    if (typeof globalThis !== 'undefined' && globalThis.miniAES) {
        return globalThis.miniAES.decrypt(hexStr, KEY, IV);
    }
    throw new Error('AES cipher not available');
}

async function postApi(path, data = {}) {
    const hex = encrypt(data);
    const bodyStr = JSON.stringify({ params: hex });

    const hosts = [apiUrl];
    for (const h of apiHosts) {
        if (h !== apiUrl) hosts.push(h);
    }

    for (const host of hosts) {
        try {
            const url = `${host}${path}`;
            const res = await req(url, {
                method: 'post',
                postType: 'json',
                data: { params: hex },
                body: bodyStr,
                headers: defaultHeaders,
                timeout: 6000
            });

            if (!res || !res.content) continue;
            let resJson;
            try {
                resJson = JSON.parse(res.content);
            } catch (e) {
                continue;
            }

            let resultData = null;
            if (resJson && resJson.data) {
                if (typeof resJson.data === 'object') {
                    resultData = resJson.data;
                } else if (typeof resJson.data === 'string') {
                    try {
                        const dec = decrypt(resJson.data);
                        if (dec) resultData = JSON.parse(dec);
                    } catch (e) {
                        continue;
                    }
                }
            } else if (resJson && resJson.code === 200) {
                resultData = resJson;
            }

            if (resultData) {
                if (host !== apiUrl) {
                    apiUrl = host;
                }
                return resultData;
            }
        } catch (e) {}
    }
    return {};
}

// ==================== 高性能 30分钟安全内存缓存与防抖并发层 ====================
const CACHE_TTL_DEFAULT = 1800 * 1000; // 默认 30 分钟 (1,800,000 毫秒)，兼顾超快响应与及时的服务器更新
const CACHE_MAX_ENTRIES = 300;         // 最多保留 300 条记录，LRU 淘汰

const memoryCache = new Map();
const pendingRequests = new Map();

function setCacheSafe(key, data, ttl = CACHE_TTL_DEFAULT) {
    if (!key || data === undefined || data === null) return;
    if (memoryCache.has(key)) {
        memoryCache.delete(key);
    } else if (memoryCache.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        if (oldestKey) memoryCache.delete(oldestKey);
    }
    memoryCache.set(key, {
        expire: Date.now() + ttl,
        data: data
    });
}

function getCacheSafe(key) {
    if (!memoryCache.has(key)) return null;
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expire) {
        memoryCache.delete(key);
        return null;
    }
    // 命中缓存：刷新在 Map 迭代器中的位置 (LRU)
    memoryCache.delete(key);
    memoryCache.set(key, entry);
    return entry.data;
}

async function postApiWithCache(path, data = {}, ttl = CACHE_TTL_DEFAULT, isValid = null) {
    const cacheKey = `${path}_${JSON.stringify(data)}`;

    const cached = getCacheSafe(cacheKey);
    if (cached !== null) {
        return cached;
    }

    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey);
    }

    const fetchPromise = (async () => {
        try {
            const res = await postApi(path, data);
            let canCache = false;
            if (typeof isValid === 'function') {
                canCache = Boolean(isValid(res));
            } else if (res && typeof res === 'object') {
                if (Array.isArray(res.list) && res.list.length > 0) canCache = true;
                else if (res.vodInfo && res.vodInfo.vod_name) canCache = true;
                else if (Array.isArray(res.urls) && res.urls.length > 0) canCache = true;
            }

            if (canCache) {
                setCacheSafe(cacheKey, res, ttl);
            }
            return res;
        } finally {
            pendingRequests.delete(cacheKey);
        }
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
}

let categoryCache = null;
let categoryCacheTime = 0;
let categoryCachePromise = null;

function cleanTopicTitle(str) {
    if (!str) return '';
    return str.replace(/（QQ群[：:][^）]+）/g, '')
              .replace(/\(QQ群[：:][^)]+\)/g, '')
              .replace(/QQ群[：:][0-9]+/g, '')
              .trim();
}

async function getCategoryListCached() {
    const now = Date.now();
    if (categoryCache && (now - categoryCacheTime < CACHE_TTL_DEFAULT)) {
        return categoryCache;
    }
    if (categoryCachePromise) {
        return categoryCachePromise;
    }
    categoryCachePromise = (async () => {
        try {
            const res = await postApi('/Index/CategoryList', {});
            if (res && res.list && Array.isArray(res.list) && res.list.length > 0) {
                categoryCache = res.list;
                categoryCacheTime = Date.now();
                return categoryCache;
            }
        } catch (e) {} finally {
            categoryCachePromise = null;
        }
        return categoryCache || [];
    })();
    return categoryCachePromise;
}


async function init(cfg) {
    if (cfg) {
        if (typeof cfg === 'string' && cfg.startsWith('http')) {
            apiUrl = cfg.replace(/\/+$/, '');
        } else if (cfg.ext) {
            if (typeof cfg.ext === 'string' && cfg.ext.startsWith('http')) {
                apiUrl = cfg.ext.replace(/\/+$/, '');
            } else if (cfg.ext.api) {
                apiUrl = cfg.ext.api.replace(/\/+$/, '');
            }
        }
    }

    // 启动多任务并行静默预热：并发拉取全站专题数据与电影第1页数据，不阻塞 init 返回
    Promise.all([
        getCategoryListCached().catch(() => {}),
        postApiWithCache('/Search/GetConditionList', {
            tid: 1,
            page: 1,
            pageSize: 24,
            keywords: ''
        }, CACHE_TTL_DEFAULT, r => r && Array.isArray(r.list) && r.list.length > 0).catch(() => {})
    ]).catch(() => {});
}

async function home(filter) {
    const classes = [
        { type_id: 'topics', type_name: '🔥精选专题' },
        { type_id: '1', type_name: '电影' },
        { type_id: '2', type_name: '连续剧' },
        { type_id: '3', type_name: '综艺' },
        { type_id: '4', type_name: '动漫' },
        { type_id: '64', type_name: '短剧' },
        { type_id: '74', type_name: 'AI漫剧' },
        { type_id: '73', type_name: '电影解说' },
        { type_id: '70', type_name: '电竞解说' },
        { type_id: '71', type_name: '体育解说' },
        { type_id: '72', type_name: '音乐' }
    ];

    const commonAreas = [
        { n: '全部', v: '0' },
        { n: '大陆', v: '大陆' },
        { n: '香港', v: '香港' },
        { n: '台湾', v: '台湾' },
        { n: '欧美', v: '俄罗斯,加拿大,德国,意大利,法国,欧美,美国,英国,西班牙' },
        { n: '日本', v: '日本' },
        { n: '韩国', v: '韩国' },
        { n: '泰国', v: '泰国' },
        { n: '其他', v: '其他,印度,新加坡,马来西亚' }
    ];

    const commonYears = [
        { n: '全部', v: '0' },
        { n: '2026', v: '2026' },
        { n: '2025', v: '2025' },
        { n: '2024', v: '2024' },
        { n: '2023', v: '2023' },
        { n: '2022', v: '2022' },
        { n: '2021', v: '2021' },
        { n: '2020', v: '2020' },
        { n: '2019', v: '2019' },
        { n: '2018', v: '2018' },
        { n: '2017', v: '2017' },
        { n: '2016-2011', v: '2016,2015,2014,2013,2012,2011' },
        { n: '2010-2000', v: '2010,2009,2008,2007,2006,2005,2004,2003,2002,2001,2000' },
        { n: '90年代', v: '1999,1998,1997,1996,1995,1994,1993,1992,1991,1990' },
        { n: '更早', v: '1989,1988,1987,1986,1985,1984,1983,1982,1981,1980' }
    ];

    const commonSorts = [
        { n: '综合排序', v: 'd_id' },
        { n: '最新发布', v: 'd_addtime' },
        { n: '最多播放', v: 'd_hits' },
        { n: '评分最高', v: 'd_score' }
    ];

    const movieClasses = [
        { n: "全部", v: "0" },
        { n: "动作", v: "84" },
        { n: "喜剧", v: "66" },
        { n: "爱情", v: "71" },
        { n: "科幻", v: "3" },
        { n: "恐怖", v: "9" },
        { n: "剧情", v: "82" },
        { n: "战争", v: "87" },
        { n: "悬疑", v: "2" },
        { n: "惊悚", v: "1" },
        { n: "罪案", v: "4" },
        { n: "犯罪", v: "77" },
        { n: "冒险", v: "68" },
        { n: "奇幻", v: "86" },
        { n: "武侠", v: "93" },
        { n: "古装", v: "7" },
        { n: "动画", v: "6" },
        { n: "纪录片", v: "69" },
        { n: "灾难", v: "5" },
        { n: "青春", v: "8" },
        { n: "文艺", v: "10" },
        { n: "生活", v: "11" },
        { n: "历史", v: "12" },
        { n: "励志", v: "13" },
        { n: "情色", v: "67" },
        { n: "音乐", v: "70" },
        { n: "传记", v: "72" },
        { n: "西部", v: "73" },
        { n: "家庭", v: "83" },
        { n: "同性", v: "88" },
        { n: "运动", v: "90" }
    ];

    const tvClasses = [
        { n: "全部", v: "0" },
        { n: "古装", v: "22" },
        { n: "爱情", v: "15" },
        { n: "都市", v: "16" },
        { n: "喜剧", v: "20" },
        { n: "剧情", v: "81" },
        { n: "悬疑", v: "32" },
        { n: "动作", v: "80" },
        { n: "武侠", v: "23" },
        { n: "奇幻", v: "78" },
        { n: "冒险", v: "79" },
        { n: "犯罪", v: "33" },
        { n: "刑侦", v: "24" },
        { n: "战争", v: "25" },
        { n: "历史", v: "21" },
        { n: "家庭", v: "17" },
        { n: "生活", v: "18" },
        { n: "偶像", v: "19" },
        { n: "军旅", v: "27" },
        { n: "谍战", v: "28" },
        { n: "商战", v: "29" },
        { n: "校园", v: "30" },
        { n: "穿越", v: "31" },
        { n: "科幻", v: "34" },
        { n: "惊悚", v: "76" },
        { n: "神话", v: "26" },
        { n: "动画", v: "91" },
        { n: "纪录片", v: "74" },
        { n: "传记", v: "102" },
        { n: "音乐", v: "105" },
        { n: "西部", v: "92" },
        { n: "运动", v: "99" },
        { n: "恐怖", v: "100" },
        { n: "同性", v: "75" }
    ];

    const showClasses = [
        { n: "全部", v: "0" },
        { n: "真人秀", v: "37" },
        { n: "脱口秀", v: "36" },
        { n: "选秀", v: "38" },
        { n: "情感", v: "39" },
        { n: "访谈", v: "40" },
        { n: "时尚", v: "41" },
        { n: "晚会", v: "42" },
        { n: "音乐", v: "45" },
        { n: "游戏", v: "46" },
        { n: "美食", v: "48" },
        { n: "旅游", v: "49" },
        { n: "职场", v: "47" },
        { n: "财经", v: "43" },
        { n: "益智", v: "44" },
        { n: "韩国真人秀", v: "59" }
    ];

    const animeClasses = [
        { n: "全部", v: "0" },
        { n: "热血", v: "51" },
        { n: "冒险", v: "50" },
        { n: "搞笑", v: "52" },
        { n: "爱情", v: "53" },
        { n: "奇幻", v: "60" },
        { n: "动作", v: "94" },
        { n: "科幻", v: "96" },
        { n: "推理", v: "54" },
        { n: "悬疑", v: "97" },
        { n: "校园", v: "61" },
        { n: "青春", v: "65" },
        { n: "竞技", v: "55" },
        { n: "励志", v: "62" },
        { n: "剧情", v: "63" },
        { n: "喜剧", v: "95" },
        { n: "经典", v: "58" },
        { n: "动画", v: "98" }
    ];

    function makeFilter(classList) {
        const res = [];
        if (classList && classList.length > 0) {
            res.push({ key: 'class', name: '类型', value: classList });
        }
        res.push({ key: 'area', name: '地区', value: commonAreas });
        res.push({ key: 'year', name: '年份', value: commonYears });
        res.push({ key: 'sort', name: '排序', value: commonSorts });
        return res;
    }

    const defaultTopicFilters = [
        { n: '全部', v: '0' },
        { n: 'Netflix新片推荐', v: 'Netflix新片推荐' },
        { n: '港台18🈲电影排行榜', v: '港台18🈲电影排行榜' },
        { n: '大尺度限制🚫级影片', v: '大尺度限制🚫级影片' },
        { n: '未删减影视', v: '未删减影视' },
        { n: '禁播影视', v: '禁播影视' },
        { n: '下架影视', v: '下架影视' },
        { n: '长假狂飙高燃爽剧', v: '⛱️长假狂飙！7天炫完全集的高燃爽剧' },
        { n: 'AI剧场 全新上线', v: 'AI剧场 全新上线' },
        { n: '第98届奥斯卡获奖影片', v: '🏆第98届奥斯卡获奖影片🏆' },
        { n: '2026金球奖获奖影片', v: '🔥2026金球奖获奖影片' },
        { n: '第33届金鹰奖获奖影片', v: '第33届金鹰奖获奖影片🏆' },
        { n: '第38届百花奖获奖影片', v: '🏆第38届大众电影百花奖获奖影片' },
        { n: '神级高分纪录片', v: '神级高分纪录片' },
        { n: '2026爆款剧王', v: '热度口碑双爆🔥2026剧王' },
        { n: '2026日漫新番', v: '2026日漫新番' },
        { n: '动漫变真人', v: '动漫变真人：你最pick哪一部' },
        { n: '殿堂级恐怖片系列', v: '殿堂级恐怖片系列（QQ群：1127581238）' },
        { n: '瓜友求片上新', v: '瓜友10/06求片上新' },
        { n: '即将上线', v: '即将上线' },
        { n: '🏮热门推荐🏮', v: '🏮热门推荐🏮' }
    ];

    let topicFilters = [{ n: '全部', v: '0' }];
    if (categoryCache && Array.isArray(categoryCache) && categoryCache.length > 0) {
        for (const sec of categoryCache) {
            if (sec && sec.type) {
                topicFilters.push({
                    n: cleanTopicTitle(sec.type),
                    v: sec.type
                });
            }
        }
    }
    if (topicFilters.length <= 1) {
        topicFilters = defaultTopicFilters;
        // SWR 机制：内存无缓存时先以预设列表秒开，同时在后台异步静默拉取，绝不阻塞 home()
        getCategoryListCached().catch(() => {});
    }

    const filters = {
        'topics': [{ key: 'topic', name: '主题', value: topicFilters }],
        '1': makeFilter(movieClasses),
        '2': makeFilter(tvClasses),
        '3': makeFilter(showClasses),
        '4': makeFilter(animeClasses),
        '64': makeFilter([]),
        '74': makeFilter([]),
        '73': makeFilter([]),
        '70': makeFilter([]),
        '71': makeFilter([]),
        '72': makeFilter([])
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

async function homeVod() {
    try {
        const catList = await getCategoryListCached();
        let videos = [];
        let seen = new Set();
        if (catList && Array.isArray(catList)) {
            for (let section of catList) {
                if (section.list && Array.isArray(section.list)) {
                    for (let item of section.list) {
                        const id = String(item.vod_id || '');
                        if (!id || seen.has(id)) continue;
                        seen.add(id);
                        let remarks = item.vod_continu || '';
                        if (!remarks) {
                            const sc = item.vod_douban_score || item.vod_scroe;
                            if (sc) remarks = sc + '分';
                        }
                        videos.push({
                            vod_id: id,
                            vod_name: (item.vod_name || item.c_name || '').replace(/💥.*/, '').trim(),
                            vod_pic: item.c_pic || item.vod_pic || '',
                            vod_remarks: remarks
                        });
                    }
                }
            }
        }
        return JSON.stringify({ list: videos });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);

        if (tid === 'topics' || String(tid) === 'topics') {
            const catList = await getCategoryListCached();
            const selTopic = extend && extend.topic ? extend.topic : '0';
            let targetVideos = [];

            if (selTopic && selTopic !== '0') {
                const sec = catList.find(s => s.type === selTopic || cleanTopicTitle(s.type) === selTopic || (s.type && s.type.includes(selTopic)));
                let res = null;
                if (sec) {
                    if (sec.show_id) {
                        res = await postApiWithCache('/Category/GetModuleList', {
                            show_id: parseInt(sec.show_id),
                            show_pid: parseInt(sec.show_pid || 1),
                            page: page,
                            pageSize: 24
                        }, CACHE_TTL_DEFAULT, r => r && Array.isArray(r.list) && r.list.length > 0);
                    } else {
                        res = await postApiWithCache('/Category/GetChoiceList', {
                            pid: parseInt(sec.pid || 1),
                            page: page,
                            pageSize: 24
                        }, CACHE_TTL_DEFAULT, r => r && Array.isArray(r.list) && r.list.length > 0);
                    }
                }

                if (res && res.list && Array.isArray(res.list) && res.list.length > 0) {
                    const list = res.list.map(item => {
                        let remarks = item.vod_continu || '';
                        if (!remarks) {
                            const sc = item.vod_douban_score || item.vod_scroe;
                            if (sc) remarks = sc + '分';
                        }
                        if (!remarks && item.vod_year) {
                            remarks = String(item.vod_year);
                        }
                        return {
                            vod_id: String(item.vod_id),
                            vod_name: (item.vod_name || item.c_name || '').replace(/💥.*/, '').trim(),
                            vod_pic: item.vod_pic || item.c_pic || '',
                            vod_remarks: remarks,
                            vod_year: item.vod_year || ''
                        };
                    });

                    const topicPageCount = Math.ceil((res.total || 0) / 24) || page;

                    // 静默预加载下一页（最多预加载到第 15 页）
                    if (page < topicPageCount && page <= 15 && sec) {
                        if (sec.show_id) {
                            Promise.resolve().then(() => {
                                postApiWithCache('/Category/GetModuleList', {
                                    show_id: parseInt(sec.show_id),
                                    show_pid: parseInt(sec.show_pid || 1),
                                    page: page + 1,
                                    pageSize: 24
                                }, CACHE_TTL_DEFAULT, r => r && Array.isArray(r.list) && r.list.length > 0).catch(() => {});
                            }).catch(() => {});
                        } else {
                            Promise.resolve().then(() => {
                                postApiWithCache('/Category/GetChoiceList', {
                                    pid: parseInt(sec.pid || 1),
                                    page: page + 1,
                                    pageSize: 24
                                }, CACHE_TTL_DEFAULT, r => r && Array.isArray(r.list) && r.list.length > 0).catch(() => {});
                            }).catch(() => {});
                        }
                    }

                    return JSON.stringify({
                        page: page,
                        pagecount: topicPageCount,
                        limit: 24,
                        total: res.total || list.length,
                        list: list
                    });
                }

                if (sec && sec.list && Array.isArray(sec.list)) {
                    targetVideos = sec.list;
                }
            } else {
                let seen = new Set();
                for (const s of catList) {
                    if (s.list && Array.isArray(s.list)) {
                        for (const item of s.list) {
                            const id = String(item.vod_id || '');
                            if (!id || seen.has(id)) continue;
                            seen.add(id);
                            targetVideos.push(item);
                        }
                    }
                }
            }

            const pageSize = 24;
            const start = (page - 1) * pageSize;
            const paged = targetVideos.slice(start, start + pageSize);
            const list = paged.map(item => {
                let remarks = item.vod_continu || '';
                if (!remarks) {
                    const sc = item.vod_douban_score || item.vod_scroe;
                    if (sc) remarks = sc + '分';
                }
                if (!remarks && item.vod_year) {
                    remarks = String(item.vod_year);
                }
                return {
                    vod_id: String(item.vod_id),
                    vod_name: (item.vod_name || item.c_name || '').replace(/💥.*/, '').trim(),
                    vod_pic: item.vod_pic || item.c_pic || '',
                    vod_remarks: remarks,
                    vod_year: item.vod_year || ''
                };
            });

            return JSON.stringify({
                page: page,
                pagecount: Math.ceil(targetVideos.length / pageSize) || 1,
                limit: pageSize,
                total: targetVideos.length,
                list: list
            });
        }

        const payload = {
            tid: parseInt(tid || 1),
            page: page,
            pageSize: 24,
            keywords: ''
        };

        if (extend) {
            if (extend.class && extend.class !== '0') payload.class = extend.class;
            if (extend.area && extend.area !== '0') payload.area = extend.area;
            if (extend.year && extend.year !== '0') payload.year = extend.year;
            if (extend.sort) {
                if (extend.sort === 'time' || extend.sort === 'd_addtime') payload.sort = 'd_addtime';
                else if (extend.sort === 'hits' || extend.sort === 'd_hits') payload.sort = 'd_hits';
                else if (extend.sort === 'score' || extend.sort === 'd_score') payload.sort = 'd_score';
                else if (extend.sort === 'd_id') payload.sort = 'd_id';
                else payload.sort = extend.sort;
            }
        }

        const res = await postApiWithCache('/Search/GetConditionList', payload, CACHE_TTL_DEFAULT, r => r && Array.isArray(r.list) && r.list.length > 0);
        const list = (res.list || []).map(item => ({
            vod_id: String(item.vod_id),
            vod_name: item.vod_name || item.c_name || '',
            vod_pic: item.vod_pic || item.c_pic || '',
            vod_remarks: item.new_continue || item.vod_title || item.vod_continu || (item.vod_scroe ? item.vod_scroe + '分' : ''),
            vod_year: item.vod_year || ''
        }));

        const pageCount = Math.ceil((res.total || 0) / 24) || page;

        // 静默预加载下一页（最多预加载到第 15 页）
        if (page < pageCount && page <= 15) {
            const nextPayload = Object.assign({}, payload, { page: page + 1 });
            Promise.resolve().then(() => {
                postApiWithCache('/Search/GetConditionList', nextPayload, CACHE_TTL_DEFAULT, r => r && Array.isArray(r.list) && r.list.length > 0).catch(() => {});
            }).catch(() => {});
        }

        return JSON.stringify({
            page: page,
            pagecount: pageCount,
            limit: 24,
            total: res.total || 0,
            list: list
        });
    } catch (e) {
        return JSON.stringify({
            page: pg || 1,
            pagecount: 0,
            limit: 24,
            total: 0,
            list: []
        });
    }
}

async function detail(id) {
    try {
        const vodId = parseInt(id);
        const [infoRes, playRes] = await Promise.all([
            postApiWithCache(
                '/Resource/GetVodInfo',
                { vod_id: vodId },
                CACHE_TTL_DEFAULT,
                r => r && r.vodInfo && r.vodInfo.vod_name
            ),
            postApiWithCache(
                '/Resource/GetOnePlayList',
                { vod_id: vodId, pageSize: 2000 },
                CACHE_TTL_DEFAULT,
                r => r && Array.isArray(r.urls) && r.urls.length > 0
            )
        ]);

        const info = (infoRes && infoRes.vodInfo) ? infoRes.vodInfo : {};
        const urls = (playRes && playRes.urls && Array.isArray(playRes.urls)) ? playRes.urls : [];

        let epList = [];
        for (let ep of urls) {
            const epName = ep.name || `第${ep.episode || ep.sort || 1}集`;
            const epUrl = ep.url || '';
            if (epUrl) {
                epList.push(`${epName}$${epUrl}`);
            }
        }

        if (epList.length === 0 && info.play_url) {
            epList.push(`${info.default_play_name || '正片'}$${info.play_url}`);
        }

        const vod = [{
            vod_id: String(info.vod_id || id),
            vod_name: info.vod_name || '',
            vod_pic: info.pic || '',
            vod_type_name: (info.videoTag && Array.isArray(info.videoTag)) ? info.videoTag.join(' / ') : '',
            vod_year: (info.vod_year || '').substring(0, 4),
            vod_area: info.vod_area || '',
            vod_remarks: info.vod_continu || (info.vod_scroe ? info.vod_scroe + '分' : ''),
            vod_actor: info.vod_actor || '',
            vod_director: info.vod_director || '',
            vod_content: (info.vod_use_content || '').trim(),
            vod_play_from: '北美超清专线',
            vod_play_url: epList.join('#')
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function search(wd, quick, pg = 1) {
    try {
        const page = parseInt(pg || 1);
        const res = await postApiWithCache(
            '/Search/GetConditionList',
            {
                keywords: wd,
                page: page,
                pageSize: 24
            },
            1800 * 1000,
            r => r && Array.isArray(r.list) && r.list.length > 0
        );
        const list = (res.list || []).map(item => ({
            vod_id: String(item.vod_id),
            vod_name: item.vod_name || '',
            vod_pic: item.vod_pic || '',
            vod_remarks: item.new_continue || item.vod_title || item.vod_continu || (item.vod_scroe ? item.vod_scroe + '分' : ''),
            vod_year: item.vod_year || ''
        }));
        return JSON.stringify({
            page: page,
            pagecount: Math.ceil((res.total || 0) / 24) || page,
            limit: 24,
            total: res.total || 0,
            list: list
        });
    } catch (e) {
        return JSON.stringify({
            page: pg || 1,
            pagecount: 0,
            limit: 24,
            total: 0,
            list: []
        });
    }
}

async function play(flag, id, flags) {
    return JSON.stringify({
        parse: 0,
        url: id,
        header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://gz360.tv',
            'Referer': 'https://gz360.tv/'
        }
    });
}


export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
};
