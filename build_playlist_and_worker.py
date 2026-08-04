import re
import json
import hashlib
import os

merged_path = "/Users/jundelin/.gemini/antigravity/brain/3c8d7468-8e1f-4e38-8b28-5c4bea8b8bf4/scratch/merged_channels.txt"
worker_path = "/Users/jundelin/Dev/HMTV_Channels/cloudflare_worker_unified.js"
playlist_path = "/Users/jundelin/Dev/HMTV_Channels/playlist.txt"
valid_path = "/Users/jundelin/Dev/HMTV_Channels/valid_channels.txt"
playlist_pure_path = "/Users/jundelin/Dev/HMTV_Channels/playlist_pure.txt"

category_order = [
    "央视频道",
    "卫视频道",
    "教育频道",
    "体育频道",
    "港澳台",
    # 大于 5 个频道的大省保留独立分组
    "黑龙江频道",
    "浙江频道",
    "吉林频道",
    "广东频道",
    "江苏频道",
    "内蒙古频道",
    "福建频道",
    "甘肃频道",
    "四川频道",
    # 5 个及以下频道的小省及其他地方台合并
    "其他地方台",
    "国际频道",
    "影视经典",
    "其他频道",
    "最新电影"
]

def clean_category(cat, name):
    cat = cat.strip()
    name = name.strip()
    name_lower = name.lower()
    
    # 1. CCTV/pay-TV channels
    is_cctv = "cctv" in name_lower or "央视" in name or "风云" in name or "怀旧" in name or "兵器" in name or "世界地理" in name or "--服务器" in name_lower
    
    # 2. TVB/HK/Macau/Taiwan
    is_tvb_etc = any(x in name_lower for x in ["tvb", "翡翠", "明珠", "无线", "hoy", "viu", "now", "rthk", "千禧", "星河", "中天", "tvbs", "寰宇", "台视", "中视", "华视", "东森", "三立", "民视", "台湾", "客家", "凤凰", "wcetv", "astro"])
    
    # 3. Sports
    is_sports_name = any(x in name_lower for x in ["足球", "台球", "体育", "sport", "sports", "combat", "kickboxing", "billiards", "fight", "ufc", "nhl", "mlb", "nba", "espn", "dazn", "fite", "fanduel", "glory", "billiard", "lacrosse", "extreme", "bek", "bke", "swere", "skynewsweather", "weather", "eurosport"])
    is_sports_cat = "体育" in cat or "sports" in cat.lower() or cat == "体育频道"
    
    if is_sports_name or (is_sports_cat and not (is_tvb_etc or is_cctv)):
        if not ("cctv-5" in name_lower or "cctv5" in name_lower):
            return "体育频道"

    if is_cctv:
        return "央视频道"

    if is_tvb_etc or cat in ["澳门频道", "港台", "港台频道", "港澳台"]:
        return "港澳台"

    # 4. Standard category cleanups for fallbacks before provincial mapping
    if cat == "浙江":
        cat = "浙江频道"
    elif cat == "贵州&四川":
        cat = "四川频道"
    elif cat == "山东&西安":
        cat = "陕西频道"
    elif cat == "吉林&内蒙古":
        cat = "吉林频道"
    elif cat == "黑龙江&甘肃":
        cat = "黑龙江频道"
    elif cat == "福建&广东&广西":
        cat = "广东频道"
    elif cat == "地方卫视":
        cat = "卫视频道"

    # 5. Satellite check (must not map to provincial groups)
    if "卫视" in name or cat == "卫视频道":
        return "卫视频道"

    # 6. Map regional groups
    regional_categories = {
        "浙江频道", "江苏频道", "江西频道", "广东频道", "广西频道", 
        "福建频道", "河北频道", "湖北频道", "吉林频道", "内蒙古频道", 
        "黑龙江频道", "甘肃频道", "山东频道", "陕西频道", "四川频道", 
        "青海频道", "新疆频道", "上海频道", "更多地方频道", "地方频道"
    }
    
    if cat in regional_categories:
        # 5个及以下的小省及其他地方频道合并到 "其他地方台"
        small_provinces = {
            "河北频道", "山东频道", "广西频道", "陕西频道", 
            "湖北频道", "江西频道", "青海频道", "新疆频道",
            "上海频道", "更多地方频道", "地方频道"
        }
        if cat in small_provinces:
            return "其他地方台"
        return cat

    # 7. International / English
    if cat in ["English合集", "电影频道 (英文)", "电视剧频道 (英文)", "动漫卡通频道 (英文)", "记录频道", "户外旅行频道 (英文)", "新闻频道 (英文)", "北美频道", "国际频道"]:
        return "国际频道"

    # 8. Pay TV Movies / Classic Movies
    if cat in ["电影经典", "影视经典"]:
        return "影视经典"

    # 9. Latest Movies
    if cat == "最新电影":
        return "最新电影"

    # 10. Fallback mappings
    if cat in ["CCTV央视频道", "更多央视频道", "央视频道"]:
        return "央视频道"
        
    if cat == "新唐人系列":
        return "其他频道"

    return cat

def get_category_index(cat):
    try:
        return category_order.index(cat)
    except ValueError:
        return len(category_order)

def cctv_sort_key(name):
    match = re.search(r'cctv[-]?(\d+)(\+)?', name.lower())
    if match:
        num = int(match.group(1))
        has_plus = 1 if match.group(2) else 0
        return (0, num, has_plus, name)
    return (1, 0, 0, name)

def main():
    channels = []
    with open(merged_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or "|" not in line:
                continue
            parts = line.split("|")
            if len(parts) < 3:
                continue
            category = parts[0].strip()
            name = parts[1].strip()
            url = parts[2].strip()
            
            # Normalize CCTV names (CCTV-1 to CCTV-17, including CCTV-5+ and CCTV-16)
            name_lower = name.lower()
            # Strip emojis / non-alphanumeric prefixes to match CCTV names correctly
            clean_name = re.sub(r'^[^\w\s\-]+', '', name_lower).strip()
            cctv_match = re.search(r'(cctv[-]?\d+)', clean_name)
            if cctv_match:
                cctv_base = cctv_match.group(1).upper()
                # Ensure standard format (e.g. CCTV-5 instead of CCTV5)
                if not cctv_base.startswith("CCTV-"):
                    cctv_base = "CCTV-" + cctv_base[4:]
                
                if "cctv-5+" in name_lower or "cctv5+" in name_lower or ("cctv5" in name_lower and "+" in name):
                    name = "CCTV-5+体育赛事"
                elif cctv_base == "CCTV-5":
                    name = "CCTV-5体育"
                elif cctv_base == "CCTV-16":
                    name = "CCTV-16奥林匹克"
                else:
                    name = cctv_base
            else:
                # Strip common duplicate suffixes like _1, _2, (1), (2), 线路1, 线路2 at the end of non-CCTV channels
                # So they can be grouped as multiple lines under the same name in the player
                name = re.sub(r'[\s_]+(?:线路|\()?\d+\)?$', '', name).strip()
                name = re.sub(r'_\d+$', '', name).strip()
                name_lower = name.lower()
            
            cleaned_cat = clean_category(category, name)
            
            channels.append({
                "category": cleaned_cat,
                "name": name,
                "url": url
            })
            
            # Check if this channel should also be duplicated into the Education list
            is_edu = (any(x in name_lower for x in ["教育", "科教", "课堂", "cetv", "cctv-9", "cctv-10", "cctv9", "cctv10", "纪录", "记录", "cgtn外语纪录", "教体", "戏曲", "梨园", "曲艺", "文物宝库"])
                      or any(x in category.lower() for x in ["教育", "科教", "课堂", "cetv", "纪录", "记录", "教体", "戏曲", "梨园", "曲艺", "文物宝库"]))
            if is_edu and not ("性教育" in name_lower):
                channels.append({
                    "category": "教育频道",
                    "name": name,
                    "url": url
                })
            
    # Assign unique keys for duplicate names in original file order (using Chinese names in paths)
    used_names = {}
    for c in channels:
        name = c["name"]
        if name not in used_names:
            used_names[name] = 0
            key = name
        else:
            used_names[name] += 1
            key = f"{name}_{used_names[name]}"
        c["key"] = key

    def get_key_suffix_num(key):
        if "_" in key:
            parts = key.rsplit("_", 1)
            if parts[-1].isdigit():
                return int(parts[-1])
        return 0

    # Sort channels: 
    # 1. By category order in category_order
    # 2. Within category:
    #    - If CCTV, numerically by CCTV number
    #    - If Sports, NBA channels first, then others
    #    - Otherwise, alphabetically by name, and then by url to be stable
    def sort_key(c):
        cat_idx = get_category_index(c["category"])
        is_cctv_cat = "cctv" in c["category"].lower() or "央视" in c["category"]
        suffix_num = get_key_suffix_num(c["key"])
        if is_cctv_cat:
            return (cat_idx, cctv_sort_key(c["name"]), suffix_num, c["url"])
        else:
            is_ascii = bool(c["name"] and c["name"][0].isascii())
            is_nba = -1 if (c["category"] == "体育频道" and "nba" in c["name"].lower()) else 0
            return (cat_idx, is_nba, is_ascii, (c["name"].lower(), c["name"]), suffix_num, c["url"])
            
    channels.sort(key=sort_key)
    channels_with_keys = channels
    print(f"Assigned unique keys for {len(channels_with_keys)} channels.")
    
    # 1. Write to valid_channels.txt
    with open(valid_path, "w", encoding="utf-8") as f:
        for c in channels_with_keys:
            f.write(f"{c['name']}, {c['url']}\n")
    print(f"Updated {valid_path}")
            
    # Load YueChan URLs to bypass Cloudflare
    yuechan_urls_file = "/Users/jundelin/.gemini/antigravity/brain/3c8d7468-8e1f-4e38-8b28-5c4bea8b8bf4/scratch/yuechan_urls.txt"
    yuechan_urls = set()
    if os.path.exists(yuechan_urls_file):
        with open(yuechan_urls_file, "r", encoding="utf-8") as f:
            for line in f:
                u = line.strip().lower()
                if u:
                    yuechan_urls.add(u)

    # 2. Write to playlist.txt (All-inclusive playlist)
    domain = "round-snowflake-2d83.linda11-28-2022.workers.dev"
    playlist_lines = []
    current_cat = None
    for c in channels_with_keys:
        if c["category"] != current_cat:
            current_cat = c["category"]
            playlist_lines.append(f"{current_cat},#genre#")
            
        url_lower = c["url"].lower()
        # Direct links for YouTube or YueChan
        if "youtube.com" in url_lower or "youtu.be" in url_lower or url_lower in yuechan_urls:
            playlist_lines.append(f"{c['name']},{c['url']}")
        else:
            playlist_lines.append(f"{c['name']},https://{domain}/live/{c['key']}/index.m3u8")
        
    with open(playlist_path, "w", encoding="utf-8") as f:
        f.write("\n".join(playlist_lines) + "\n")
    print(f"Updated {playlist_path}")
    
    # 2.1 Write to playlist_pure.txt (Pure playlist: No YouTube, No YueChan)
    playlist_pure_lines = []
    current_cat_pure = None
    for c in channels_with_keys:
        url_lower = c["url"].lower()
        if "youtube.com" in url_lower or "youtu.be" in url_lower or url_lower in yuechan_urls:
            continue
        if c["category"] != current_cat_pure:
            current_cat_pure = c["category"]
            playlist_pure_lines.append(f"{current_cat_pure},#genre#")
        playlist_pure_lines.append(f"{c['name']},https://{domain}/live/{c['key']}/index.m3u8")
        
    with open(playlist_pure_path, "w", encoding="utf-8") as f:
        f.write("\n".join(playlist_pure_lines) + "\n")
    print(f"Updated {playlist_pure_path}")
    
    # 3. Write to cloudflare_worker_unified.js
    # Build CHANNEL_MAP javascript object string
    map_lines = []
    for c in channels_with_keys:
        url_lower = c["url"].lower()
        # Skip YouTube and YueChan in the Worker CHANNEL_MAP
        if "youtube.com" in url_lower or "youtu.be" in url_lower or url_lower in yuechan_urls:
            continue
        escaped_key = json.dumps(c["key"], ensure_ascii=False)
        escaped_url = json.dumps(c["url"], ensure_ascii=False)
        map_lines.append(f"  {escaped_key}: {escaped_url},")
        
    map_str = "\n".join(map_lines)
    
    worker_template = f"""/**
 * Cloudflare Worker - 多频道统一 HLS 重写/代理服务 (全直连重定向版)
 * 
 * 访问格式：
 *   https://[你的Worker域名]/live/[频道名称]/index.m3u8
 *   例如：https://tvb-proxy.username.workers.dev/live/翡翠台/index.m3u8
 */

// {len(channels_with_keys)}个有效电视频道映射表
const CHANNEL_MAP = {{
{map_str}
}};

export default {{
  async fetch(request, env, ctx) {{
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').map(segment => decodeURIComponent(segment));
    
    // 期望的路由路径结构是：/live/[频道名称]/index.m3u8
    if (pathSegments.length < 4 || pathSegments[1] !== 'live') {{
      return new Response('欢迎使用统一电视直播代理服务。使用格式：/live/[频道名称]/index.m3u8', {{
        status: 200,
        headers: {{ 'Content-Type': 'text/plain; charset=utf-8' }}
      }});
    }}

    const channelName = pathSegments[2];
    const requestedFile = pathSegments.slice(3).join('/');

    // 1. 从映射表中查找该频道真实的 URL
    const channelUrl = CHANNEL_MAP[channelName];
    if (!channelUrl) {{
      return new Response(`未找到频道: ${{channelName}}`, {{ status: 404 }});
    }}

    // 2. 计算当前请求在原站对应的完整真实 URL
    let targetUrl = "";
    const queryUrl = url.searchParams.get('_url');
    const queryHost = url.searchParams.get('_host');
    
    if (queryUrl) {{
      targetUrl = queryUrl;
    }} else if (queryHost) {{
      targetUrl = new URL(requestedFile, queryHost).toString();
    }} else {{
      targetUrl = getTargetUrl(channelUrl, requestedFile, url.search);
    }}

    // 3. 只在请求主播放列表（即点击播放的瞬间）打印一次日志记录
    if (requestedFile === 'index.m3u8' || requestedFile === '') {{
      const clientIP = request.headers.get('CF-Connecting-IP') || '未知IP';
      console.log(`[播放日志] 客户端IP: ${{clientIP}} 正在启动播放频道: ${{channelName}}`);
    }}

    // 4. 【核心直连优化】：
    // 为了防止电视盒子（如 Android TV / Apple TV）因安全策略拦截 HTTPS 到 HTTP 的跨协议跳转（Mixed Content）
    // 或者因防火墙屏蔽非标准端口，对这些不安全或非标准端口的视频源采用【代理反代模式】；
    // 对于常规的标准端口 HTTPS 视频源，采用最节省资源的【302 重定向模式】。
    try {{
      const targetUrlObj = new URL(targetUrl);
      const isHttp = targetUrlObj.protocol === "http:";
      const hasNonStandardPort = targetUrlObj.port && targetUrlObj.port !== "" && targetUrlObj.port !== "80" && targetUrlObj.port !== "443";
      
      if (isHttp || hasNonStandardPort) {{
        let currentUrl = targetUrl;
        let targetResponse = null;
        let redirectCount = 0;
        
        while (redirectCount < 5) {{
          const ipMatch = currentUrl.match(/\\/\\/([0-9]{{1,3}}\\.[0-9]{{1,3}}\\.[0-9]{{1,3}}\\.[0-9]{{1,3}})(:\\d+)?/);
          if (ipMatch) {{
            const ip = ipMatch[1];
            currentUrl = currentUrl.replace(ip, ip + ".nip.io");
          }}
          
          targetResponse = await fetch(currentUrl, {{
            headers: {{
              'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
              'Accept': '*/*'
            }},
            method: request.method,
            redirect: 'manual'
          }});
          
          if ([301, 302, 303, 307, 308].includes(targetResponse.status)) {{
            const redirectUrl = targetResponse.headers.get('location');
            if (redirectUrl) {{
              currentUrl = new URL(redirectUrl, currentUrl).toString();
              redirectCount++;
              continue;
            }}
          }}
          break;
        }}
        
        // 动态改写 M3U8 播放列表内容，将相对 TS 切片路径转换为走代理的绝对路径
        let bodyText = await targetResponse.text();
        if (bodyText.includes("#EXTM3U")) {{
          const finalBaseUrl = getBaseUrl(currentUrl);
          const lines = bodyText.split('\\n');
          const rewrittenLines = lines.map(line => {{
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {{
              if (trimmed.startsWith('http')) {{
                return `https://${{url.host}}/live/${{encodeURIComponent(channelName)}}/ts_segment?_url=${{encodeURIComponent(trimmed)}}`;
              }} else {{
                return `https://${{url.host}}/live/${{encodeURIComponent(channelName)}}/${{trimmed}}?_host=${{encodeURIComponent(finalBaseUrl)}}`;
              }}
            }}
            return line;
          }});
          bodyText = rewrittenLines.join('\\n');
          
          const responseHeaders = new Headers(targetResponse.headers);
          responseHeaders.set("Access-Control-Allow-Origin", "*");
          responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
          
          return new Response(bodyText, {{
            status: targetResponse.status,
            statusText: targetResponse.statusText,
            headers: responseHeaders
          }});
        }}
        
        const responseHeaders = new Headers(targetResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        
        return new Response(targetResponse.body, {{
          status: targetResponse.status,
          statusText: targetResponse.statusText,
          headers: responseHeaders
        }});
      }}
    }} catch (err) {{
      // 容错处理：如果 URL 解析出错，走常规 302
    }}

    return Response.redirect(targetUrl, 302);
  }}
}};

// 辅助函数：根据原站的 URL 结构计算其基础目录路径
function getBaseUrl(url) {{
  if (url.endsWith('/')) {{
    return url;
  }}
  const lastSlash = url.lastIndexOf('/');
  return url.substring(0, lastSlash + 1);
}}

// 辅助函数：计算请求在原站对应的完整真实 URL
function getTargetUrl(channelUrl, requestedFile, searchParams) {{
  if (!requestedFile || requestedFile === 'index.m3u8') {{
    return channelUrl;
  }}
  const base = getBaseUrl(channelUrl);
  return base + requestedFile + searchParams;
}}
"""
    
    with open(worker_path, "w", encoding="utf-8") as f:
        f.write(worker_template)
    print(f"Updated {worker_path}")

if __name__ == "__main__":
    main()
