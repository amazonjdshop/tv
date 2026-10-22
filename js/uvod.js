/**
 * 优视频 (uvod.tv) QuickJS 点播爬虫
 * 适用于 FongMi (潘多拉影视) / CatVod / TVBox QuickJS 引擎
 * 采用纯 JS 混合加密 (AES-256-CBC + RSA-1024 + MD5)，零外部依赖，极速秒播
 */

// ==================== 1. 轻量纯 JS MD5 算法 ====================
function md5(string) {
    if (typeof md5X === 'function') {
        try {
            const h = md5X(string);
            if (h && typeof h === 'string' && h.length === 32) return h.toLowerCase();
        } catch (e) {}
    }
    function rotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
        var lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        if (lX4 | lY4) {
            if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(string) {
        var lWordCount;
        var lMessageLength = string.length;
        var lNumberOfWordsTempOne = lMessageLength + 8;
        var lNumberOfWordsTempTwo = (lNumberOfWordsTempOne - (lNumberOfWordsTempOne % 64)) / 64;
        var lNumberOfWords = (lNumberOfWordsTempTwo + 1) * 16;
        var lWordArray = Array(lNumberOfWords - 1);
        var lBytePosition = 0;
        var lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (0x80 << lBytePosition));
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function wordToHex(lValue) {
        var WordToHexValue = "", WordToHexValueTemp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValueTemp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValueTemp.substr(WordToHexValueTemp.length - 2, 2);
        }
        return WordToHexValue;
    }
    var x = Array();
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
        b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
        b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
        d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
        b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
        d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
        b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
        b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
        b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
        b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
        b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
        b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
        b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
        b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
        b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
        d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
        b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
        b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
        b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
        b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// ==================== 2. Base64 与 UTF-8 编解码工具 ====================
const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ToBase64(bytes) {
    let out = '';
    const len = bytes.length;
    let i = 0;
    while (i < len) {
        const c1 = bytes[i++];
        if (i === len) {
            out += b64chars.charAt(c1 >> 2) + b64chars.charAt((c1 & 3) << 4) + '==';
            break;
        }
        const c2 = bytes[i++];
        if (i === len) {
            out += b64chars.charAt(c1 >> 2) + b64chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) + b64chars.charAt((c2 & 15) << 2) + '=';
            break;
        }
        const c3 = bytes[i++];
        out += b64chars.charAt(c1 >> 2) + b64chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) + b64chars.charAt(((c2 & 15) << 2) | (c3 >> 6)) + b64chars.charAt(c3 & 63);
    }
    return out;
}

function base64ToUint8(str) {
    str = (str || '').replace(/[^A-Za-z0-9+/=]/g, '');
    const out = [];
    let i = 0;
    while (i < str.length) {
        const enc1 = b64chars.indexOf(str.charAt(i++));
        const enc2 = b64chars.indexOf(str.charAt(i++));
        const enc3 = b64chars.indexOf(str.charAt(i++));
        const enc4 = b64chars.indexOf(str.charAt(i++));
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        out.push(chr1);
        if (enc3 !== 64 && enc3 !== -1) out.push(chr2);
        if (enc4 !== 64 && enc4 !== -1) out.push(chr3);
    }
    return new Uint8Array(out);
}

function utf8ToBytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6));
            bytes.push(0x80 | (code & 0x3f));
        } else if (code < 0xd800 || code >= 0xe000) {
            bytes.push(0xe0 | (code >> 12));
            bytes.push(0x80 | ((code >> 6) & 0x3f));
            bytes.push(0x80 | (code & 0x3f));
        } else {
            i++;
            code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
            bytes.push(0xf0 | (code >> 18));
            bytes.push(0x80 | ((code >> 12) & 0x3f));
            bytes.push(0x80 | ((code >> 6) & 0x3f));
            bytes.push(0x80 | (code & 0x3f));
        }
    }
    return new Uint8Array(bytes);
}

function bytesToUtf8(bytes) {
    let out = '';
    let i = 0;
    while (i < bytes.length) {
        const b = bytes[i++];
        if (b < 0x80) {
            out += String.fromCharCode(b);
        } else if ((b & 0xe0) === 0xc0) {
            const b2 = bytes[i++];
            out += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
        } else if ((b & 0xf0) === 0xe0) {
            const b2 = bytes[i++];
            const b3 = bytes[i++];
            out += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
        } else if ((b & 0xf8) === 0xf0) {
            const b2 = bytes[i++];
            const b3 = bytes[i++];
            const b4 = bytes[i++];
            let code = ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
            code -= 0x10000;
            out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
        }
    }
    return out;
}

// ==================== 3. 纯 JS RSA-1024 混合密钥加解密 ====================
const RSA_N = BigInt('0x9e0505a8b563a9b2e3e7dcf000f9b72633c6037c43b33f3ee16ffbc8b55e37bc1255d8570cef61dd72fdc371c205b8457d2d0f2f726b9eb6577df1e92c8daf6f4353a5f2b4e78e94e931b7781de75ebd2b8885689d25d300389283137020185710bd078fb3cd2e5d8d898532e4467d880a60d1fdf6f7d8ec166374063af2dcb9');
const RSA_E = 65537n;
const RSA_D = BigInt('0x75adbbc7263e70545ed17f81e4d813030a2f7eccfe05f125bcf18e8aac36dc3edd50bcea2721e6b9ea36fd642c5fe2192ddd6e9fa1107083cea8668d85b6865ca4227eac5a94336ff0c95e02bb394bd3eacd352abb6e06bb77b51595de214183827df48c89fc85e6b085347d69cbfe03becc26a62e6a9637fe74f2d29715e5d9');

function modPow(b, exp, mod) {
    let r = 1n;
    b = b % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) r = (r * b) % mod;
        exp = exp / 2n;
        b = (b * b) % mod;
    }
    return r;
}

function rsaEncrypt(keyStr) {
    const keyBytes = new Uint8Array(keyStr.length);
    for (let i = 0; i < keyStr.length; i++) keyBytes[i] = keyStr.charCodeAt(i);
    const padLen = 128 - 3 - keyBytes.length;
    const padded = new Uint8Array(128);
    padded[0] = 0x00;
    padded[1] = 0x02;
    for (let i = 0; i < padLen; i++) padded[2 + i] = 0x01 + Math.floor(Math.random() * 254);
    padded[2 + padLen] = 0x00;
    padded.set(keyBytes, 3 + padLen);

    let hex = '';
    for (let i = 0; i < 128; i++) {
        const h = padded[i].toString(16);
        hex += (h.length === 1 ? '0' : '') + h;
    }
    const m = BigInt('0x' + hex);
    const c = modPow(m, RSA_E, RSA_N);
    let cHex = c.toString(16);
    while (cHex.length < 256) cHex = '0' + cHex;
    const cBytes = new Uint8Array(128);
    for (let i = 0; i < 128; i++) {
        cBytes[i] = parseInt(cHex.substr(i * 2, 2), 16);
    }
    return uint8ToBase64(cBytes);
}

function rsaDecrypt(base64Cipher) {
    const cipherBytes = base64ToUint8(base64Cipher);
    let hex = '';
    for (let i = 0; i < cipherBytes.length; i++) {
        const h = cipherBytes[i].toString(16);
        hex += (h.length === 1 ? '0' : '') + h;
    }
    const c = BigInt('0x' + hex);
    const m = modPow(c, RSA_D, RSA_N);
    let mHex = m.toString(16);
    while (mHex.length < 256) mHex = '0' + mHex;
    const mBytes = new Uint8Array(128);
    for (let i = 0; i < 128; i++) {
        mBytes[i] = parseInt(mHex.substr(i * 2, 2), 16);
    }
    let zeroIdx = 2;
    while (zeroIdx < mBytes.length && mBytes[zeroIdx] !== 0) zeroIdx++;
    let out = '';
    for (let i = zeroIdx + 1; i < mBytes.length; i++) {
        out += String.fromCharCode(mBytes[i]);
    }
    return out;
}

// ==================== 4. 纯 JS AES-256-CBC 算法 (14轮密钥扩展) ====================
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

function keyExpansion256(keyBytes) {
    const w = new Uint8Array(240);
    w.set(keyBytes.subarray(0, 32));
    let i = 32;
    while (i < 240) {
        let temp = [w[i - 4], w[i - 3], w[i - 2], w[i - 1]];
        if (i % 32 === 0) {
            const k0 = temp[0];
            temp[0] = sbox[temp[1]] ^ rcon[i / 32];
            temp[1] = sbox[temp[2]];
            temp[2] = sbox[temp[3]];
            temp[3] = sbox[k0];
        } else if (i % 32 === 16) {
            temp[0] = sbox[temp[0]];
            temp[1] = sbox[temp[1]];
            temp[2] = sbox[temp[2]];
            temp[3] = sbox[temp[3]];
        }
        w[i] = w[i - 32] ^ temp[0];
        w[i + 1] = w[i - 31] ^ temp[1];
        w[i + 2] = w[i - 30] ^ temp[2];
        w[i + 3] = w[i - 29] ^ temp[3];
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
function encryptBlock256(block, w) {
    const state = new Uint8Array(block);
    addRoundKey(state, w, 0);
    for (let r = 1; r < 14; r++) {
        subBytes(state);
        shiftRows(state);
        mixColumns(state);
        addRoundKey(state, w, r);
    }
    subBytes(state);
    shiftRows(state);
    addRoundKey(state, w, 14);
    return state;
}
function decryptBlock256(block, w) {
    const state = new Uint8Array(block);
    addRoundKey(state, w, 14);
    for (let r = 13; r >= 1; r--) {
        invShiftRows(state);
        invSubBytes(state);
        addRoundKey(state, w, r);
        invMixColumns(state);
    }
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, w, 0);
    return state;
}

const AES_IV_BYTES = utf8ToBytes('abcdefghijklmnop');

function aesEncrypt256(text, keyStr) {
    if (typeof CryptoJS !== 'undefined' && CryptoJS.AES) {
        try {
            return CryptoJS.AES.encrypt(
                CryptoJS.enc.Utf8.parse(text),
                CryptoJS.enc.Utf8.parse(keyStr),
                {
                    iv: CryptoJS.enc.Utf8.parse('abcdefghijklmnop'),
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            ).toString();
        } catch (e) {}
    }

    const keyBytes = utf8ToBytes(keyStr);
    const w = keyExpansion256(keyBytes);
    const ptBytes = utf8ToBytes(text);
    const padLen = 16 - (ptBytes.length % 16);
    const padded = new Uint8Array(ptBytes.length + padLen);
    padded.set(ptBytes);
    padded.fill(padLen, ptBytes.length);

    const out = new Uint8Array(padded.length);
    let prev = AES_IV_BYTES.slice(0, 16);
    for (let i = 0; i < padded.length; i += 16) {
        const blk = new Uint8Array(16);
        for (let j = 0; j < 16; j++) blk[j] = padded[i + j] ^ prev[j];
        const enc = encryptBlock256(blk, w);
        out.set(enc, i);
        prev = enc;
    }
    return uint8ToBase64(out);
}

function aesDecrypt256(base64Text, keyStr) {
    if (typeof CryptoJS !== 'undefined' && CryptoJS.AES) {
        try {
            const dec = CryptoJS.AES.decrypt(
                base64Text,
                CryptoJS.enc.Utf8.parse(keyStr),
                {
                    iv: CryptoJS.enc.Utf8.parse('abcdefghijklmnop'),
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            ).toString(CryptoJS.enc.Utf8);
            if (dec) return dec;
        } catch (e) {}
    }

    const keyBytes = utf8ToBytes(keyStr);
    const w = keyExpansion256(keyBytes);
    const ctBytes = base64ToUint8(base64Text);
    const decrypted = new Uint8Array(ctBytes.length);
    let prev = AES_IV_BYTES.slice(0, 16);
    for (let i = 0; i < ctBytes.length; i += 16) {
        const blk = ctBytes.subarray(i, i + 16);
        const dec = decryptBlock256(blk, w);
        for (let j = 0; j < 16; j++) decrypted[i + j] = dec[j] ^ prev[j];
        prev = blk;
    }
    const decPadLen = decrypted[decrypted.length - 1];
    return bytesToUtf8(decrypted.subarray(0, decrypted.length - decPadLen));
}

// ==================== 5. 高性能内存缓存与接口通信层 ====================
let apiUrl = 'https://api-h5.uvod.tv';

const CACHE_TTL_DEFAULT = 1800 * 1000;
const memoryCache = new Map();
const pendingRequests = new Map();

function getCache(key) {
    if (!memoryCache.has(key)) return null;
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expire) {
        memoryCache.delete(key);
        return null;
    }
    memoryCache.delete(key);
    memoryCache.set(key, entry);
    return entry.data;
}

function setCache(key, data, ttl = CACHE_TTL_DEFAULT) {
    if (!key || data === undefined || data === null) return;
    if (memoryCache.has(key)) memoryCache.delete(key);
    else if (memoryCache.size >= 300) {
        const oldest = memoryCache.keys().next().value;
        if (oldest) memoryCache.delete(oldest);
    }
    memoryCache.set(key, { expire: Date.now() + ttl, data });
}

function randomKey(len = 32) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    let s = '';
    for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
}

async function executeHttp(url, headers, body) {
    if (typeof req === 'function') {
        const res = await req(url, {
            method: 'post',
            headers: headers,
            data: body,
            body: body,
            postType: 'json',
            timeout: 10000
        });
        return res ? res.content : '';
    }

    // Node.js fallback (用于本地自动化校验)
    if (typeof require === 'function') {
        try {
            const https = require('https');
            const u = new URL(url);
            return new Promise((resolve, reject) => {
                const r = https.request({
                    hostname: u.hostname,
                    path: u.pathname + u.search,
                    method: 'POST',
                    headers: headers
                }, res => {
                    let d = '';
                    res.on('data', chunk => d += chunk);
                    res.on('end', () => resolve(d));
                });
                r.on('error', reject);
                r.write(body);
                r.end();
            });
        } catch (e) {}
    }
    return '';
}

async function postApi(path, data = {}) {
    const aesKey = randomKey(32);
    const aesCipher = aesEncrypt256(JSON.stringify(data), aesKey);
    const rsaCipher = rsaEncrypt(aesKey);
    const payload = `${aesCipher}.${rsaCipher}`;

    const keys = Object.keys(data).filter(k => data[k] !== '' && data[k] !== null && data[k] !== undefined && data[k] !== false).sort();
    const queryParts = keys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`);
    const queryStr = queryParts.join('&').toLowerCase();
    const timestamp = Date.now();
    const signature = md5(`-${queryStr}-${timestamp}`);

    const headers = {
        'Content-Type': 'application/json',
        'X-TOKEN': '',
        'X-TIMESTAMP': String(timestamp),
        'X-SIGNATURE': signature,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.uvod.tv',
        'Referer': 'https://www.uvod.tv/'
    };

    const url = `${apiUrl}${path}`;
    const rawRes = await executeHttp(url, headers, payload);
    if (!rawRes) return null;

    const parts = rawRes.split('.');
    if (parts.length !== 2) return null;
    const decKey = rsaDecrypt(parts[1]);
    const plainJson = aesDecrypt256(parts[0], decKey);
    return JSON.parse(plainJson);
}

async function postApiWithCache(path, data = {}, ttl = CACHE_TTL_DEFAULT) {
    const key = `${path}_${JSON.stringify(data)}`;
    const cached = getCache(key);
    if (cached !== null) return cached;
    if (pendingRequests.has(key)) return pendingRequests.get(key);

    const p = (async () => {
        try {
            const res = await postApi(path, data);
            if (res && res.error === 0) setCache(key, res, ttl);
            return res;
        } finally {
            pendingRequests.delete(key);
        }
    })();
    pendingRequests.set(key, p);
    return p;
}

// ==================== 6. CatVod 爬虫标准接口实现 ====================
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
}

async function home(filter) {
    const classes = [
        { type_id: '100', type_name: '电影' },
        { type_id: '101', type_name: '电视剧' },
        { type_id: '102', type_name: '综艺' },
        { type_id: '103', type_name: '动漫' },
        { type_id: '105', type_name: '纪录片' },
        { type_id: '106', type_name: '粤台专区' },
        { type_id: '107', type_name: '少儿' },
        { type_id: '104', type_name: '体育' }
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
        { n: '2016-2010', v: '2016' },
        { n: '更早', v: '2000' }
    ];

    const commonRegions = [
        { n: '全部', v: '0' },
        { n: '大陆', v: '大陆' },
        { n: '香港', v: '香港' },
        { n: '台湾', v: '台湾' },
        { n: '欧美', v: '欧美' },
        { n: '日本', v: '日本' },
        { n: '韩国', v: '韩国' },
        { n: '其他', v: '其他' }
    ];

    const movieSubs = [
        { n: '全部', v: '0' },
        { n: '喜剧', v: '109' },
        { n: '爱情', v: '110' },
        { n: '动作', v: '111' },
        { n: '犯罪', v: '112' },
        { n: '科幻', v: '113' },
        { n: '奇幻', v: '114' },
        { n: '冒险', v: '115' },
        { n: '灾难', v: '116' },
        { n: '惊悚', v: '117' },
        { n: '剧情', v: '118' },
        { n: '战争', v: '119' },
        { n: '经典', v: '120' },
        { n: '悬疑', v: '210' },
        { n: '历史', v: '211' }
    ];

    const tvSubs = [
        { n: '全部', v: '0' },
        { n: '国产剧', v: '123' },
        { n: '欧美剧', v: '124' },
        { n: '港台剧', v: '125' },
        { n: '短剧', v: '207' },
        { n: '新马泰', v: '127' },
        { n: '日韩剧', v: '126' },
        { n: '其它剧', v: '128' }
    ];

    const varietySubs = [
        { n: '全部', v: '0' },
        { n: '搞笑', v: '129' },
        { n: '情感', v: '130' },
        { n: '选秀', v: '131' },
        { n: '访谈', v: '132' },
        { n: '时尚', v: '133' },
        { n: '真人秀', v: '134' },
        { n: '脱口秀', v: '135' },
        { n: '演唱会', v: '136' }
    ];

    const animeSubs = [
        { n: '全部', v: '0' },
        { n: '热血', v: '151' },
        { n: '冒险', v: '137' },
        { n: '科幻', v: '139' },
        { n: '恋爱', v: '140' },
        { n: '校园', v: '141' },
        { n: '魔幻', v: '148' },
        { n: '悬疑', v: '158' },
        { n: '治愈', v: '156' },
        { n: '历史', v: '152' }
    ];

    const docSubs = [
        { n: '全部', v: '0' },
        { n: '文化', v: '168' },
        { n: '科技', v: '169' },
        { n: '历史', v: '170' },
        { n: '军事', v: '171' },
        { n: '人物', v: '172' },
        { n: '解密', v: '173' },
        { n: '自然', v: '174' }
    ];

    const yueSubs = [
        { n: '全部', v: '0' },
        { n: '粤台电影', v: '175' },
        { n: '港台剧集', v: '176' },
        { n: '海外剧集', v: '177' },
        { n: '粤台综艺', v: '178' },
        { n: '粤语动画', v: '179' }
    ];

    const childSubs = [
        { n: '全部', v: '0' },
        { n: '儿歌', v: '187' },
        { n: '故事', v: '188' },
        { n: '学英语', v: '189' },
        { n: '动作', v: '190' },
        { n: '百科', v: '191' },
        { n: '国学', v: '192' },
        { n: '识字', v: '194' },
        { n: '数学', v: '195' },
        { n: '美术', v: '196' },
        { n: '益智', v: '202' },
        { n: '手工', v: '193' },
        { n: '音乐', v: '198' }
    ];

    const sportSubs = [
        { n: '全部', v: '0' },
        { n: '足球', v: '163' },
        { n: '篮球', v: '164' },
        { n: '综合', v: '165' },
        { n: '探索', v: '166' },
        { n: '奥运', v: '167' }
    ];

    const makeFilter = (subs) => {
        const list = [];
        if (subs && subs.length > 1) {
            list.push({ key: 'category_id', name: '类型', value: subs });
        }
        list.push({ key: 'region', name: '地区', value: commonRegions });
        list.push({ key: 'year', name: '年份', value: commonYears });
        return list;
    };

    const filters = {
        '100': makeFilter(movieSubs),
        '101': makeFilter(tvSubs),
        '102': makeFilter(varietySubs),
        '103': makeFilter(animeSubs),
        '105': makeFilter(docSubs),
        '106': makeFilter(yueSubs),
        '107': makeFilter(childSubs),
        '104': makeFilter(sportSubs)
    };

    return JSON.stringify({
        class: classes,
        filters: filters
    });
}

async function homeVod() {
    try {
        const res = await postApiWithCache('/video/list', { parent_category_id: 100, page: 1, page_size: 24 });
        const list = (res?.data?.video_list || []).map(v => ({
            vod_id: String(v.id),
            vod_name: v.title || '',
            vod_pic: v.pic || '',
            vod_remarks: v.remark || v.state || (v.year ? String(v.year) : '')
        }));
        return JSON.stringify({ list: list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const page = parseInt(pg || 1);
        const payload = {
            parent_category_id: parseInt(tid || 100),
            page: page,
            page_size: 24
        };
        if (extend) {
            const rawCat = extend.category_id || extend.class;
            if (rawCat && rawCat !== '0' && rawCat !== '全部' && rawCat !== '全部类别' && rawCat !== '全部分类' && rawCat !== 'all') {
                const parsedCat = parseInt(rawCat);
                if (!isNaN(parsedCat)) payload.category_id = parsedCat;
            }
            if (extend.year && extend.year !== '0' && extend.year !== '全部' && extend.year !== '全部年份' && extend.year !== 'all') {
                const parsedYear = parseInt(extend.year);
                if (!isNaN(parsedYear)) payload.year = parsedYear;
            }
            if (extend.region && extend.region !== '0' && extend.region !== '全部' && extend.region !== '全部地区' && extend.region !== 'all') {
                let reg = extend.region;
                if (reg === '港台') reg = '香港';
                else if (reg === '日韩') reg = '日本';
                payload.region = reg;
            }
        }

        const res = await postApiWithCache('/video/list', payload);
        const list = (res?.data?.video_list || []).map(v => ({
            vod_id: String(v.id),
            vod_name: v.title || '',
            vod_pic: v.pic || '',
            vod_remarks: v.remark || v.state || (v.year ? String(v.year) : '')
        }));

        const total = res?.data?.video_total || list.length;
        const pageCount = Math.ceil(total / 24) || page;

        return JSON.stringify({
            page: page,
            pagecount: pageCount,
            limit: 24,
            total: total,
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
        const infoRes = await postApiWithCache('/video/info', { id: vodId });
        const video = infoRes?.data?.video || {};
        const frags = infoRes?.data?.video_fragment_list || [];

        let epList = [];
        for (let f of frags) {
            const sym = String(f.symbol || '').trim();
            const epName = !sym ? '正片' : (/^\d+$/.test(sym) ? `第${sym}集` : sym);
            epList.push(`${epName}$${vodId}_${f.id}`);
        }

        const vod = [{
            vod_id: String(video.id || id),
            vod_name: video.title || '',
            vod_pic: video.pic || '',
            vod_type_name: video.language || '',
            vod_year: String(video.year || ''),
            vod_area: video.region || '',
            vod_remarks: video.remark || video.state || (video.score ? `${video.score}分` : ''),
            vod_actor: video.starring || '',
            vod_director: video.director || '',
            vod_content: (video.description || '').trim(),
            vod_play_from: '粤语原声专线',
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
        const res = await postApiWithCache('/video/list', {
            keyword: wd,
            page: page,
            page_size: 24
        }, 1800 * 1000);

        const list = (res?.data?.video_list || []).map(v => ({
            vod_id: String(v.id),
            vod_name: v.title || '',
            vod_pic: v.pic || '',
            vod_remarks: v.remark || v.state || (v.year ? String(v.year) : '')
        }));

        const total = res?.data?.video_total || list.length;
        return JSON.stringify({
            page: page,
            pagecount: Math.ceil(total / 24) || page,
            limit: 24,
            total: total,
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
    try {
        const parts = String(id || '').split('_');
        if (parts.length >= 2) {
            const videoId = parseInt(parts[0]);
            const fragId = parseInt(parts[1]);
            const sourceRes = await postApi('/video/source', {
                video_id: videoId,
                video_fragment_id: fragId,
                quality: 4
            });
            const streamUrl = (sourceRes?.data?.video_soruce || sourceRes?.data?.video_source || {})?.url || '';
            if (streamUrl) {
                return JSON.stringify({
                    parse: 0,
                    url: streamUrl,
                    header: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                        'Origin': 'https://www.uvod.tv',
                        'Referer': 'https://www.uvod.tv/'
                    }
                });
            }
        }
    } catch (e) {}

    return JSON.stringify({
        parse: 0,
        url: id
    });
}

// ==================== 7. 导出模块 ====================
var spider = {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
};

if (typeof exports !== 'undefined') {
    exports.default = spider;
    exports.init = init;
    exports.home = home;
    exports.homeVod = homeVod;
    exports.category = category;
    exports.detail = detail;
    exports.play = play;
    exports.search = search;
}

export default spider;
