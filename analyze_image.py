#!/usr/bin/env python3
"""
Analyze an image using MiniMax Vision API
"""
import base64
import requests
import json
import sys

# Your API key - use environment variable MINIMAX_API_KEY
import os

# Fail fast if API key is missing
API_KEY = os.environ.get("MINIMAX_API_KEY")
if not API_KEY:
    raise EnvironmentError("MINIMAX_API_KEY environment variable is not set. Aborting.")

# Expected directory for images (prevent path traversal)
ALLOWED_DIR = "/data/.openclaw/media/inbound"

# Image file
IMAGE_PATH = "/data/.openclaw/media/inbound/file_4---7b40a873-1c93-490e-9648-0aba8247d490.jpg"

def validate_path(path):
    """Validate path is within allowed directory and exists."""
    real_path = os.path.realpath(path)
    real_allowed = os.path.realpath(ALLOWED_DIR)
    # Use commonpath to prevent sibling path bypass (e.g., /data/../data/media/evil/)
    if os.path.commonpath([real_path, real_allowed]) != real_allowed:
        raise ValueError(f"Path traversal detected: {path} is not within {ALLOWED_DIR}")
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Image file not found: {path}")
    return True

def encode_image(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def analyze_image(image_path, prompt="Describe this image in detail."):
    # Consent check: require explicit opt-in before sending to third-party
    allow_third_party = os.environ.get("ALLOW_THIRD_PARTY_IMAGE_UPLOAD", "").lower()
    if allow_third_party not in ("1", "true", "yes"):
        raise PermissionError(
            "Image upload to third-party API requires explicit consent. "
            "Set ALLOW_THIRD_PARTY_IMAGE_UPLOAD=1 to enable."
        )
    
    # Validate path before processing
    validate_path(image_path)
    
    # Encode image
    image_base64 = encode_image(image_path)
    
    # MiniMax API endpoint for vision
    url = "https://api.minimax.chat/v1/text/chatcompletion_pro"
    
    # Prepare request
    payload = {
        "model": "MiniMax-M2.5",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }
        ]
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    print("Sending request to MiniMax API...")
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None
    
    result = response.json()
    
    # Extract the response
    if "choices" in result and len(result["choices"]) > 0:
        return result["choices"][0]["message"]["content"]
    else:
        print(f"Unexpected response: {result}")
        return None

if __name__ == "__main__":
    result = analyze_image(IMAGE_PATH, "Describe what's in this image in detail.")
    if result:
        print("\n=== Analysis ===")
        print(result)
