
#!/usr/bin/env python3
import os
import json
import time
from datetime import datetime, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# 1. Environment Configuration Matrix
DATABASE_URL = os.environ.get("DATABASE_URL") 
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "common")

PRIMARY_OUTLOOK_ACCOUNT_ID = os.environ.get("PRIMARY_OUTLOOK_ACCOUNT_ID")

def execute_post_request(url, data, headers):
    """Utility wrapper for synchronous HTTP POST requests via standard library."""
    encoded_data = json.dumps(data).encode("utf-8") if isinstance(data, dict) else data.encode("utf-8")
    req = Request(url, data=encoded_data, headers=headers, method="POST")
    with urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def get_valid_outlook_token(account_id):
    """Resolves and proactively rotates the Microsoft Graph access token directly via Supabase API."""
    print(f"[Python Vault]: Verifying token state for context: {account_id}")
    
    url = f"{SUPABASE_URL}/rest/v1/outlook_accounts?id=eq.{account_id}&select=*"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    
    req = Request(url, headers=headers)
    with urlopen(req) as res:
        records = json.loads(res.read().decode("utf-8"))
        
    if not records:
        raise Exception(f"Account context missing for ID: {account_id}")
    
    account = records[0]
    
    expires_at_str = account["token_expires_at"].replace("Z", "+00:00")
    if "+" in expires_at_str and len(expires_at_str.split("+")[-1]) == 2:
        expires_at_str += ":00"
        
    expires_at = datetime.fromisoformat(expires_at_str)
    buffer_time = datetime.now(expires_at.tzinfo) + timedelta(minutes=5)
    
    if expires_at > buffer_time:
        return account["access_token"]
        
    print("[Python Vault]: Token boundary reached. Initiating Azure Token Platform rotation...")
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    payload = f"client_id={AZURE_CLIENT_ID}&client_secret={AZURE_CLIENT_SECRET}&grant_type=refresh_token&refresh_token={account['refresh_token']}&scope=https://graph.microsoft.com/.default offline_access"
    
    token_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    tokens = execute_post_request(token_url, payload, token_headers)
    
    new_expires_at = (datetime.utcnow() + timedelta(seconds=tokens["expires_in"])).isoformat() + "Z"
    
    update_url = f"{SUPABASE_URL}/rest/v1/outlook_accounts?id=eq.{account_id}"
    update_headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    update_payload = {
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token", account["refresh_token"]),
        "token_expires_at": new_expires_at
    }
    
    req = Request(update_url, data=json.dumps(update_payload).encode("utf-8"), headers=update_headers, method="PATCH")
    with urlopen(req) as res:
        print("[Python Vault]: Token rotation synchronized cleanly in Supabase storage.")
        
    return tokens["access_token"]

def get_leaking_bookings():
    """Queries Supabase for pending logs sitting inside the abandonment corridor."""
    time_max = (datetime.utcnow() - timedelta(minutes=30)).isoformat() + "Z"
    time_min = (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z"
    
    # Optimized for the current schema (paymentStatus = UNPAID)
    url = f"{SUPABASE_URL}/rest/v1/bookings?paymentStatus=eq.UNPAID&created_at=lte.{time_max}&created_at=gte.{time_min}&select=id,interacRef,guestEmail,guestName,createdAt"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    
    req = Request(url, headers=headers)
    with urlopen(req) as res:
        return json.loads(res.read().decode("utf-8"))

def fire_recovery_email(token, target):
    """Dispatches precision recovery payload via direct MS Graph API execution."""
    url = "https://graph.microsoft.com/v1.0/me/sendMail"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Use a static placeholder or dynamic amount fetch if needed
    amount_dollars = "TBD" 
    
    payload = {
        "message": {
            "subject": f"Action Required: Complete your booking [{target['interacRef']}]",
            "body": {
                "contentType": "HTML",
                "content": f"""
                <p>Hi {target['guestName'] or 'there'},</p>
                <p>We noticed your booking isn't finalized yet. To lock in your window, please complete the Interac e-Transfer to our payment gateway.</p>
                <p><strong style="color: #B45309;">Important:</strong> You must include your exact tracking token in the message section: <strong style="font-family: monospace;">{target['interacRef']}</strong></p>
                <p>Once received, our autonomous ledger will instantly confirm your reservation.</p>
                """
            },
            "toRecipients": [{"emailAddress": {"address": target["guestEmail"]}}]
        },
        "saveToSentItems": "true"
    }
    
    execute_post_request(url, payload, headers)

if __name__ == "__main__":
    print(f"[Python Swarm]: Checking perimeter ledger at {datetime.now().isoformat()}...")
    if not all([SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PRIMARY_OUTLOOK_ACCOUNT_ID]):
        print("[Python Swarm Fatal]: Missing operational infrastructure keys in runtime context environment variables.")
        exit(1)
        
    try:
        leaks = get_leaking_bookings()
        if not leaks:
            print("[Python Swarm]: Scan completed smoothly. Perimeter is completely sealed.")
            exit(0)
            
        print(f"[Python Swarm]: Detected {len(leaks)} uncollateralized targets. Spawning credentials handler...")
        access_token = get_valid_outlook_token(PRIMARY_OUTLOOK_ACCOUNT_ID)
        
        for booking in leaks:
            print(f"[Python Swarm Strike]: Launching recovery vector targeting token {booking['interacRef']} -> {booking['guestEmail']}")
            try:
                fire_recovery_email(access_token, booking)
                print(f"[Python Swarm Success]: Dispatched email vector to {booking['guestEmail']}")
            except HTTPError as e:
                print(f"[Python Swarm Worker Error]: Graph communication dropped for {booking['interacRef']}: {e.read().decode('utf-8')}")
            except Exception as w_err:
                print(f"[Python Swarm Worker Error]: Isolation barrier triggered for execution sequence: {w_err}")
                
        print("[Python Swarm]: Scan cycle executed completely.")
    except Exception as e:
        print(f"[Python Swarm Fatal Error]: Scanning runtime exception occurred: {e}")
        exit(1)
