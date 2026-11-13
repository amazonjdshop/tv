/**
 * 华人直播源客户端直连解析脚本 (QuickJS ES Module)
 * 作用：在电视盒本地直连 Deno 鉴权中枢获取 1080p 授权直链，免去本地登录与并发互踢风暴。
 */

function init(ext) {
    // 模块初始化
}

function play(flag, id, flags) {
    try {
        const stream = flag || "CCTV1_MG";
        const pageId = id || "538";

        // 1. 优先调用 Vercel 集中鉴权自愈中枢 (毫秒级响应，零风控，自动续期)
        const primaryApi = "https://uvod-t4.vercel.app/huavod/live?id=" + encodeURIComponent(pageId) + "&stream=" + encodeURIComponent(stream);
        let res = req(primaryApi, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        // 2. 容灾备用：若 Deno 中枢偶发未响应，调用 Cloudflare 边缘 Worker 鉴权路由
        if (!res || !res.content || !res.content.includes("https://")) {
            const backupApi = "https://round-snowflake-2d83.linda11-28-2022.workers.dev/huavod/live?id=" + encodeURIComponent(pageId) + "&stream=" + encodeURIComponent(stream);
            res = req(backupApi, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
        }

        if (res && res.content) {
            let data = null;
            try {
                data = JSON.parse(res.content);
            } catch (e) {}

            if (data && data.url) {
                return JSON.stringify({
                    url: data.url,
                    header: data.header || {
                        "Referer": "https://huavod.com/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                });
            }
        }
    } catch (e) {
        console.error("HuaRen JS play error: " + e);
    }

    // 若解析未果，返回空对象由客户端降级回退至 Worker 播放
    return JSON.stringify({
        url: "",
        header: {}
    });
}

export default {
    init: init,
    play: play
};