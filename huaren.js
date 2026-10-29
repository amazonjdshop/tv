/**
 * 华人直播源客户端直连解析脚本 (QuickJS ES Module)
 * 托管于 GitHub: https://raw.githubusercontent.com/amazonjdshop/tv/main/huaren.js
 * 
 * 作用：在电视盒本地动态拉取华人网鉴权 Token 并直接连接华人 CDN，实现零 Worker 消耗和无限续期。
 */

let globalToken = "";
let tokenExpireTime = 0;
const VIP_COOKIE = "user_id=78018; user_name=linda1030; group_id=3; group_name=VIP%E4%BC%9A%E5%91%98; user_check=c8f46bc0a8a0dc5c916c9afe8a3ccce3;";

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
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Cookie": VIP_COOKIE,
                    "Referer": "https://huavod.com/"
                }
            });

            // 备用域名重试
            if (!res || !res.content || !res.content.includes("auth=")) {
                res = req(`https://www.huavod.com/liveplay/${pageId}-1.html`, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Cookie": VIP_COOKIE,
                        "Referer": "https://www.huavod.com/"
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

            // 容灾兜底：若 Cookie 过期或未匹配到 Token，尝试自动登录刷新
            if (!globalToken) {
                try {
                    req("https://huavod.com/index.php/user/login.html", {
                        method: "POST",
                        data: "user_name=linda1030&user_pwd=Qwer1234",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "X-Requested-With": "XMLHttpRequest",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Referer": "https://huavod.com/index.php/user/login.html"
                        }
                    });
                    let retryRes = req(`https://huavod.com/liveplay/${pageId}-1.html`, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Cookie": VIP_COOKIE,
                            "Referer": "https://huavod.com/"
                        }
                    });
                    if (retryRes && retryRes.content) {
                        const m2 = retryRes.content.match(/auth=([^\x27"&\s;]+)/);
                        if (m2 && m2[1]) {
                            globalToken = m2[1];
                            tokenExpireTime = Date.now() + 480000;
                        }
                    }
                } catch (e2) {}
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
