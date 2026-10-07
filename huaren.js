/**
 * 华人直播源客户端直连解析脚本 (QuickJS ES Module)
 * 托管于 GitHub: https://raw.githubusercontent.com/amazonjdshop/tv/main/huaren.js
 * 
 * 作用：在电视盒本地动态拉取华人网鉴权 Token 并直接连接华人 CDN，实现零 Worker 消耗和无限续期。
 */

let globalToken = "";
let tokenExpireTime = 0;

function init(ext) {
    // 模块初始化
}

function play(flag, id, flags) {
    try {
        const stream = flag || "CCTV1_MG";
        const pageId = id || "538";

        // 1. 检查内存中已缓存的 Token 是否处于 8 分钟有效期内
        if (!globalToken || Date.now() > tokenExpireTime) {
            let res = req(`https://huavod.com/liveplay/${pageId}-1.html`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            // 备用域名重试
            if (!res || !res.content || !res.content.includes("auth=")) {
                res = req(`https://www.huavod.com/liveplay/${pageId}-1.html`, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                });
            }

            if (res && res.content) {
                const match = res.content.match(/auth=([^\x27"&\s;]+)/);
                if (match && match[1]) {
                    globalToken = match[1];
                    // 缓存 8 分钟 (480000 毫秒)，在 10 分钟失效前自动刷新
                    tokenExpireTime = Date.now() + 480000;
                }
            }
        }

        // 2. 组装直连播放地址与专属防盗链 Referer
        if (globalToken) {
            return JSON.stringify({
                url: `https://live.huarenlivewebsite1.top/stream/${stream}.m3u8?auth=${globalToken}`,
                header: {
                    "Referer": "https://huavod.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
        }
    } catch (e) {
        console.error("HuaRen JS play error: " + e);
    }

    // 若解析未果，返回空对象由客户端降级回退
    return JSON.stringify({
        url: "",
        header: {}
    });
}

export default {
    init: init,
    play: play
};
