/**
 * Cloudflare Worker for reverse proxying and rewriting HLS stream URLs.
 * Target: https://o11.163189.xyz/stream/tvb/fct/
 */

// Target stream base URL
const TARGET_BASE = "https://o11.163189.xyz/stream/tvb/fct/";

// Set this to true if you want to proxy ALL traffic (including video TS/jpg segments) through Cloudflare.
// Set to false if you only want to rewrite the playlist to end with .m3u8 and let the player download video files directly from the target server (saves worker requests and bandwidth).
const PROXY_ALL_TRAFFIC = true; 

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const filename = pathSegments[pathSegments.length - 1];

    // Check if this is the master playlist request
    const isMasterPlaylist = !filename || filename === 'fct.m3u8' || filename === 'index.m3u8';

    if (isMasterPlaylist) {
      try {
        const response = await fetch(TARGET_BASE, {
          headers: {
            'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
          }
        });
        
        if (!response.ok) {
          return new Response(`Target server returned status: ${response.status}`, { status: response.status });
        }

        let text = await response.text();
        
        if (PROXY_ALL_TRAFFIC) {
          // In Proxy Mode, we don't need to rewrite anything because relative paths
          // will naturally resolve to this Worker's domain, and the Worker will proxy them.
          return new Response(text, {
            headers: {
              'Content-Type': 'application/x-mpegURL',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache'
            }
          });
        } else {
          // In Direct Redirect Mode, we rewrite the relative sub-playlist URLs inside the master playlist
          // to absolute URLs pointing directly to the target server.
          const lines = text.split('\n');
          const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              // Convert relative URL to absolute URL pointing to the original server
              return new URL(trimmed, TARGET_BASE).toString();
            }
            return line;
          });

          return new Response(rewrittenLines.join('\n'), {
            headers: {
              'Content-Type': 'application/x-mpegURL',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache'
            }
          });
        }
      } catch (err) {
        return new Response(`Error fetching playlist: ${err.message}`, { status: 500 });
      }
    }

    // Proxy mode for sub-playlists and TS segments (when PROXY_ALL_TRAFFIC is true)
    if (PROXY_ALL_TRAFFIC) {
      // Map the filename and query parameters to the target URL
      const targetUrl = TARGET_BASE + filename + url.search;
      
      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: {
            'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
          }
        });

        // Copy original headers and add CORS support
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (err) {
        return new Response(`Error proxying segment: ${err.message}`, { status: 500 });
      }
    }

    // If PROXY_ALL_TRAFFIC is false and the player requests something else, redirect them
    const targetUrl = TARGET_BASE + filename + url.search;
    return Response.redirect(targetUrl, 302);
  }
};
