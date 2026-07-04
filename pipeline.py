import json
import sys
import base64
import datetime
import tempfile
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


def score_images(images: list[bytes], prompt: str) -> list[float] | None:
    """Score variants with HPSv2 (human-preference model). Returns one score
    per image, or None if hpsv2 isn't installed or scoring fails — the
    pipeline degrades gracefully either way. Scores are only comparable
    among images generated from the same prompt."""
    try:
        import hpsv2
    except ImportError:
        print("  hpsv2 not installed; skipping quality scoring (pip install hpsv2).")
        return None
    print(f"  Scoring {len(images)} variant(s) with HPSv2...")
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            paths = []
            for i, image_bytes in enumerate(images):
                path = Path(tmpdir) / f"variant_{i}.png"
                path.write_bytes(image_bytes)
                paths.append(str(path))
            scores = hpsv2.score(paths, prompt, hps_version="v2.1")
    except Exception as exc:
        print(f"  HPSv2 scoring failed ({exc}); continuing without scores.")
        return None
    scores = [float(s) for s in scores]
    for i, s in enumerate(scores, start=1):
        print(f"    Variant {i}: HPS {s:.4f}")
    return scores


def rank_images(images: list[bytes], scores: list[float] | None) -> tuple[list[bytes], list[float] | None]:
    """Order images best-first by HPS score so variant_1 is always the top pick."""
    if not scores:
        return images, scores
    ranked = sorted(zip(images, scores), key=lambda pair: pair[1], reverse=True)
    return [img for img, _ in ranked], [s for _, s in ranked]


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


def upload_images_to_drive(
    service, images: list[bytes], channel: str, date_str: str, scores: list[float] | None = None
) -> str:
    print("  Setting up Google Drive folders...")
    root_id = get_or_create_folder(service, ROOT_FOLDER_NAME)
    channel_id = get_or_create_folder(service, channel.capitalize(), root_id)
    date_id = get_or_create_folder(service, date_str, channel_id)

    print(f"  Uploading {len(images)} image(s) to Drive...")
    for i, image_bytes in enumerate(images, start=1):
        name = f"creative_variant_{i}.png"
        if scores:
            name = f"creative_variant_{i}_HPS-{scores[i - 1]:.4f}.png"
        file_metadata = {
            "name": name,
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


def send_slack_notification(
    ad_data: dict, folder_link: str, image_count: int, scores: list[float] | None = None
):
    print("  Sending Slack notification...")
    if scores:
        score_line = (
            f"*HPSv2 scores (best-first):* "
            + ", ".join(f"#{i} {s:.4f}" for i, s in enumerate(scores, start=1))
            + "\n"
        )
    else:
        score_line = ""
    message = {
        "text": (
            f":art: *New Creatives Ready for Review*\n"
            f"*Product:* {ad_data['product']}\n"
            f"*Channel:* {ad_data['channel'].capitalize()}\n"
            f"*Headline:* {ad_data['headline']}\n"
            f"*Audience:* {ad_data['audience']}\n"
            f"*Style:* {ad_data['creative_style']}\n"
            f"*Variants generated:* {image_count}\n"
            f"{score_line}"
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
    print("[1/4] Generating images...")
    prompt = build_prompt(ad_data)
    images = generate_images(prompt, count=3)

    # 2. Score and rank variants (best-first)
    print("[2/4] Scoring variants with HPSv2...")
    scores = score_images(images, prompt)
    images, scores = rank_images(images, scores)

    # 3. Upload to Google Drive
    print("[3/4] Uploading to Google Drive...")
    drive_service = get_drive_service()
    folder_link = upload_images_to_drive(
        drive_service, images, ad_data["channel"], date_str, scores
    )
    print(f"  Folder link: {folder_link}")

    # 4. Notify Slack
    print("[4/4] Notifying Slack (#creatives-review)...")
    send_slack_notification(ad_data, folder_link, len(images), scores)

    print("\n=== Pipeline complete ===")
    print(f"Drive folder: {folder_link}")
    return folder_link


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pipeline.py '<json_string>'")
        sys.exit(1)
    ad_data = json.loads(sys.argv[1])
    run_pipeline(ad_data)
