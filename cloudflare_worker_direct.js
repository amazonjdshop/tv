/**
 * Cloudflare Worker - HLS 直连重写脚本
 * 作用：仅重写入口播放列表的相对路径为原站绝对路径，使播放器后续的视频数据请求全部“直连原站”。
 * 极大地节省 Cloudflare 流量与免费额度。
 */

const TARGET_BASE = "https://o11.163189.xyz/stream/tvb/fct/";

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. 获取原站的入口播放列表
      const response = await fetch(TARGET_BASE, {
        headers: {
          'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
        }
      });
      
      if (!response.ok) {
        return new Response(`原站返回错误: ${response.status}`, { status: response.status });
      }

      const text = await response.text();
      
      // 2. 将列表中的二级播放列表相对路径（如 stream_0.php...）重写为原站的绝对路径
      const lines = text.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        // 这一行是非注释、非空行，代表是媒体流链接
        if (trimmed && !trimmed.startsWith('#')) {
          // 利用 URL 类将相对路径转换为基于 TARGET_BASE 的绝对路径
          return new URL(trimmed, TARGET_BASE).toString();
        }
        return line;
      });

      // 3. 返回重写后的 .m3u8 格式列表，后续的子播放列表与视频数据（.jpg 伪装的 TS 切片）将全部直连原站
      return new Response(rewrittenLines.join('\n'), {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*', // 支持跨域，方便 Web 播放器使用
          'Cache-Control': 'no-cache'
        }
      });
    } catch (err) {
      return new Response(`Worker 执行出错: ${err.message}`, { status: 500 });
    }
  }
};
