#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Huavod (华视影院) VIP Auto-Renewal & Referral Verification Script
Runs in GitHub Actions (dynamic Azure IP) to register a referral account
under linda1030 (uid=78018) via Emailnator temporary Gmail, verifying if
linda1030's VIP membership is extended by 1 day.
"""

import sys
import os
import re
import json
import time
import random
import string
import urllib.request
import urllib.parse
import http.cookiejar

LINDA_UID = '78018'
LINDA_COOKIE = 'user_id=78018; user_name=linda1030; group_id=3; group_name=VIP%E4%BC%9A%E5%91%98; user_check=c8f46bc0a8a0dc5c916c9afe8a3ccce3;'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

# Ensure line buffering
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

def log(*args, **kwargs):
    msg = " ".join(str(a) for a in args)
    sys.stdout.write(msg + '\n')
    sys.stdout.flush()
    summary_path = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary_path:
        try:
            with open(summary_path, 'a', encoding='utf-8') as f:
                f.write(msg + '\n')
        except Exception:
            pass

print = log


def get_public_ip():
    """Fetch external public IP of the runner."""
    services = [
        'https://api.ipify.org',
        'https://icanhazip.com',
        'https://ifconfig.me/ip'
    ]
    for s in services:
        try:
            req = urllib.request.Request(s, headers={'User-Agent': 'curl/7.88.1'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.read().decode('utf-8').strip()
        except Exception:
            continue
    return 'Unknown'


def get_linda_vip_status():
    """Query linda1030's current VIP expiration date and remaining days."""
    url = 'https://huavod.net/index.php/user/index.html'
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': USER_AGENT,
            'Cookie': LINDA_COOKIE
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8')
            for line in html.split('\n'):
                if '会员至' in line:
                    clean = re.sub(r'<[^>]+>', '', line).strip()
                    return clean
    except Exception as e:
        print(f"[!] Error checking VIP status: {e}")
    return 'Unknown'


def generate_temp_gmail(max_tries=10):
    """Generate temporary Gmail dotGmail address via Emailnator with <= 2 dots."""
    url = 'https://www.emailnator.com/api/generate-email'
    for _ in range(max_tries):
        req = urllib.request.Request(
            url,
            data=json.dumps({'ids': [3]}).encode('utf-8'),
            headers={
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://www.emailnator.com',
                'Referer': 'https://www.emailnator.com/'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            email = data.get('email')
            if email and email.split('@')[0].count('.') <= 2:
                return email
    raise RuntimeError(f"Could not generate a valid Gmail with <= 2 dots after {max_tries} tries")


def poll_verification_code(email, max_retries=20, delay=3):
    """Poll Emailnator inbox for verification code from huavod / huaren."""
    url_list = 'https://www.emailnator.com/api/message-list'
    for attempt in range(1, max_retries + 1):
        time.sleep(delay)
        req = urllib.request.Request(
            url_list,
            data=json.dumps({'email': email, 'limit': 10}).encode('utf-8'),
            headers={
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://www.emailnator.com',
                'Referer': f'https://www.emailnator.com/inbox/{email}'
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                messages = data.get('messages', [])
                for msg in messages:
                    sender = msg.get('from', '')
                    subject = msg.get('subject', '')
                    if any(k in sender.lower() or k in subject.lower() for k in ['huaren', 'huavod', '华视', '验证码', '用户注册']):
                        msg_id = msg.get('id')
                        print(f"[*] Found email: '{subject}' from '{sender}' (ID: {msg_id})")
                        # Fetch message content
                        msg_url = f"https://www.emailnator.com/api/message/{urllib.parse.quote(msg_id)}"
                        req_body = urllib.request.Request(
                            msg_url,
                            headers={
                                'User-Agent': USER_AGENT,
                                'Accept': 'application/json',
                                'Origin': 'https://www.emailnator.com',
                                'Referer': 'https://www.emailnator.com/'
                            }
                        )
                        with urllib.request.urlopen(req_body, timeout=10) as b_resp:
                            b_data = json.loads(b_resp.read().decode('utf-8'))
                            content = b_data.get('content', '')
                            code_match = re.search(r'验证码[：:\s]*([0-9]{4,8})', content)
                            if code_match:
                                return code_match.group(1)
        except Exception as e:
            print(f"[!] Inbox poll error (attempt {attempt}): {e}")
        print(f"[*] Polling inbox for {email}... (attempt {attempt}/{max_retries})")
    return None


def register_referral_account(inviter_uid=LINDA_UID):
    """Perform full referral registration on huavod.net."""
    print("=" * 60)
    print("=== Huavod VIP Auto-Renewal & Referral Test ===")
    print("=" * 60)

    # 1. Output Public IP
    public_ip = get_public_ip()
    print(f"[*] Runner Public IP: {public_ip}")

    # 2. Check linda1030 VIP baseline
    vip_before = get_linda_vip_status()
    print(f"[*] linda1030 VIP Before: {vip_before}")

    # 3. Generate temp Gmail
    email = generate_temp_gmail()
    print(f"[*] Generated Email: {email}")

    # 4. Prepare CookieJar and visit referral link
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    ref_url = f"https://huavod.net/index.php/user/reg.html?uid={inviter_uid}"
    print(f"[*] Visiting referral link: {ref_url}")
    req_ref = urllib.request.Request(ref_url, headers={'User-Agent': USER_AGENT})
    opener.open(req_ref, timeout=10)

    cookies = {c.name: c.value for c in cj}
    print(f"[*] Initial session cookies: {cookies}")

    # 5. Send verification code
    print("[*] Requesting verification code...")
    msg_data = urllib.parse.urlencode({
        'ac': 'email',
        'to': email,
        'uid': inviter_uid
    }).encode('utf-8')

    req_msg = urllib.request.Request(
        'https://huavod.net/index.php/user/reg_msg',
        data=msg_data,
        headers={
            'User-Agent': USER_AGENT,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': ref_url,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
    )

    with opener.open(req_msg, timeout=10) as resp_msg:
        res_json = json.loads(resp_msg.read().decode('utf-8'))
        print(f"[*] reg_msg response: {res_json}")
        if res_json.get('code') != 1:
            raise RuntimeError(f"Failed to send verification code: {res_json}")

    # 6. Retrieve verification code
    code = poll_verification_code(email)
    if not code:
        raise RuntimeError("Timed out waiting for verification code email.")
    print(f"[+] Verification code received: {code}")

    # 7. Submit registration
    rand_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    new_username = f"ref_{rand_suffix}"
    new_password = f"RefUser2026_{rand_suffix}!"

    print(f"[*] Submitting registration for new user: {new_username}")
    reg_data = urllib.parse.urlencode({
        'user_name': new_username,
        'user_pwd': new_password,
        'user_pwd2': new_password,
        'ac': 'email',
        'to': email,
        'code': code,
        'uid': inviter_uid,
        'invite_code': ''
    }).encode('utf-8')

    req_reg = urllib.request.Request(
        'https://huavod.net/index.php/user/reg.html',
        data=reg_data,
        headers={
            'User-Agent': USER_AGENT,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': ref_url,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
    )

    with opener.open(req_reg, timeout=10) as resp_reg:
        reg_res = json.loads(resp_reg.read().decode('utf-8'))
        print(f"[*] Registration response: {reg_res}")
        if reg_res.get('code') != 1:
            raise RuntimeError(f"Registration failed: {reg_res}")

    print("[+] Registration successful!")

    # 8. Check linda1030 VIP after registration
    time.sleep(3)
    vip_after = get_linda_vip_status()
    print("=" * 60)
    print(f"[*] linda1030 VIP Before: {vip_before}")
    print(f"[+] linda1030 VIP After : {vip_after}")
    print("=" * 60)

    if vip_before != vip_after and vip_after != 'Unknown':
        print("[SUCCESS] linda1030 VIP membership was successfully EXTENDED!")
    else:
        print("[NOTE] VIP status string: checking if days or timestamp changed.")


if __name__ == '__main__':
    import traceback
    try:
        register_referral_account()
    except Exception as err:
        print(f"[ERROR] Script encountered an error: {err}")
        print(traceback.format_exc())
        sys.exit(1)
