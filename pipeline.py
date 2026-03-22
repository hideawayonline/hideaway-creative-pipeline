import json
import sys
import base64
import datetime
import requests
from pathlib import Path
from dotenv import load_dotenv
import os

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_DRIVE_CREDENTIALS_FILE = os.getenv("GOOGLE_DRIVE_CREDENTIALS_FILE")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
ROOT_FOLDER_NAME = "Hideaway Creatives"
IMAGEN_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "imagen-3.0-generate-002:predict"
)


def build_prompt(ad_data: dict) -> str:
    return (
        f"Create a {ad_data['creative_style']} advertisement image for {ad_data['product']}. "
        f"Headline: '{ad_data['headline']}'. "
        f"Target audience: {ad_data['audience']}. "
        f"Platform: {ad_data['channel']}. "
        "High quality, professional marketing photography style."
    )


def generate_images(prompt: str, count: int = 3) -> list[bytes]:
    print(f"  Generating {count} image variants via Imagen 3...")
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {"sampleCount": count},
    }
    response = requests.post(
        IMAGEN_ENDPOINT,
        params={"key": GEMINI_API_KEY},
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    predictions = response.json().get("predictions", [])
    images = []
    for pred in predictions:
        b64 = pred.get("bytesBase64Encoded") or pred.get("image", {}).get("bytesBase64Encoded")
        if b64:
            images.append(base64.b64decode(b64))
    print(f"  Received {len(images)} image(s).")
    return images


def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        GOOGLE_DRIVE_CREDENTIALS_FILE, scopes=DRIVE_SCOPES
    )
    return build("drive", "v3", credentials=creds)


def get_or_create_folder(service, name: str, parent_id: str = None) -> str:
    query = f"mimeType='application/vnd.google-apps.folder' and name='{name}' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get("files", [])
    if files:
        return files[0]["id"]
    metadata = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        metadata["parents"] = [parent_id]
    folder = service.files().create(body=metadata, fields="id").execute()
    return folder["id"]


def upload_images_to_drive(service, images: list[bytes], channel: str, date_str: str) -> str:
    print("  Setting up Google Drive folders...")
    root_id = get_or_create_folder(service, ROOT_FOLDER_NAME)
    channel_id = get_or_create_folder(service, channel.capitalize(), root_id)
    date_id = get_or_create_folder(service, date_str, channel_id)

    print(f"  Uploading {len(images)} image(s) to Drive...")
    for i, image_bytes in enumerate(images, start=1):
        file_metadata = {
            "name": f"creative_variant_{i}.png",
            "parents": [date_id],
        }
        media = MediaInMemoryUpload(image_bytes, mimetype="image/png")
        service.files().create(body=file_metadata, media_body=media, fields="id").execute()
        print(f"    Uploaded variant {i}.")

    # Make folder readable via link
    service.permissions().create(
        fileId=date_id,
        body={"type": "anyone", "role": "reader"},
    ).execute()

    folder_link = f"https://drive.google.com/drive/folders/{date_id}"
    return folder_link


def send_slack_notification(ad_data: dict, folder_link: str, image_count: int):
    print("  Sending Slack notification...")
    message = {
        "text": (
            f":art: *New Creatives Ready for Review*\n"
            f"*Product:* {ad_data['product']}\n"
            f"*Channel:* {ad_data['channel'].capitalize()}\n"
            f"*Headline:* {ad_data['headline']}\n"
            f"*Audience:* {ad_data['audience']}\n"
            f"*Style:* {ad_data['creative_style']}\n"
            f"*Variants generated:* {image_count}\n"
            f"*Drive folder:* {folder_link}"
        )
    }
    response = requests.post(SLACK_WEBHOOK_URL, json=message, timeout=10)
    response.raise_for_status()
    print("  Slack notification sent.")


def run_pipeline(ad_data: dict):
    print("\n=== Hideaway Creative Pipeline ===")
    print(f"Channel : {ad_data['channel']}")
    print(f"Product : {ad_data['product']}")
    print(f"Headline: {ad_data['headline']}\n")

    date_str = datetime.date.today().isoformat()

    # 1. Generate images
    print("[1/3] Generating images...")
    prompt = build_prompt(ad_data)
    images = generate_images(prompt, count=3)

    # 2. Upload to Google Drive
    print("[2/3] Uploading to Google Drive...")
    drive_service = get_drive_service()
    folder_link = upload_images_to_drive(drive_service, images, ad_data["channel"], date_str)
    print(f"  Folder link: {folder_link}")

    # 3. Notify Slack
    print("[3/3] Notifying Slack (#creatives-review)...")
    send_slack_notification(ad_data, folder_link, len(images))

    print("\n=== Pipeline complete ===")
    print(f"Drive folder: {folder_link}")
    return folder_link


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pipeline.py '<json_string>'")
        sys.exit(1)
    ad_data = json.loads(sys.argv[1])
    run_pipeline(ad_data)
