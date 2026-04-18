import json
import sys
import base64
import datetime
import time
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
HIGGSFIELD_KEY_ID = os.getenv("HIGGSFIELD_KEY_ID")
HIGGSFIELD_KEY_SECRET = os.getenv("HIGGSFIELD_KEY_SECRET")

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
ROOT_FOLDER_NAME = "Hideaway Creatives"
IMAGEN_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "imagen-3.0-generate-002:predict"
)
HIGGSFIELD_BASE_URL = "https://platform.higgsfield.ai"
HIGGSFIELD_I2V_ENDPOINT = f"{HIGGSFIELD_BASE_URL}/v1/image2video/dop"
HIGGSFIELD_MODEL = "dop-turbo"
HIGGSFIELD_POLL_INTERVAL_SECONDS = 5
HIGGSFIELD_POLL_TIMEOUT_SECONDS = 600


def build_prompt(ad_data: dict) -> str:
    return (
        f"Create a {ad_data['creative_style']} advertisement image for {ad_data['product']}. "
        f"Headline: '{ad_data['headline']}'. "
        f"Target audience: {ad_data['audience']}. "
        f"Platform: {ad_data['channel']}. "
        "High quality, professional marketing photography style."
    )


def build_video_prompt(ad_data: dict) -> str:
    return (
        f"Subtle cinematic camera movement on a {ad_data['creative_style']} ad for "
        f"{ad_data['product']}. Smooth parallax and gentle zoom. Premium feel."
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


def make_file_public(service, file_id: str):
    service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"},
    ).execute()


def drive_direct_download_url(file_id: str) -> str:
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def upload_bytes_to_drive(service, data: bytes, filename: str, mimetype: str, parent_id: str) -> str:
    file_metadata = {"name": filename, "parents": [parent_id]}
    media = MediaInMemoryUpload(data, mimetype=mimetype)
    created = service.files().create(
        body=file_metadata, media_body=media, fields="id"
    ).execute()
    file_id = created["id"]
    make_file_public(service, file_id)
    return file_id


def setup_drive_folders(service, channel: str, date_str: str) -> str:
    print("  Setting up Google Drive folders...")
    root_id = get_or_create_folder(service, ROOT_FOLDER_NAME)
    channel_id = get_or_create_folder(service, channel.capitalize(), root_id)
    date_id = get_or_create_folder(service, date_str, channel_id)
    return date_id


def upload_images_to_drive(service, images: list[bytes], date_id: str) -> list[dict]:
    print(f"  Uploading {len(images)} image(s) to Drive...")
    uploaded = []
    for i, image_bytes in enumerate(images, start=1):
        filename = f"creative_variant_{i}.png"
        file_id = upload_bytes_to_drive(service, image_bytes, filename, "image/png", date_id)
        uploaded.append({
            "index": i,
            "file_id": file_id,
            "url": drive_direct_download_url(file_id),
        })
        print(f"    Uploaded variant {i}.")
    return uploaded


def higgsfield_auth_header() -> dict:
    if not HIGGSFIELD_KEY_ID or not HIGGSFIELD_KEY_SECRET:
        raise RuntimeError("Higgsfield credentials missing: set HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET.")
    return {"Authorization": f"Key {HIGGSFIELD_KEY_ID}:{HIGGSFIELD_KEY_SECRET}"}


def submit_higgsfield_video(image_url: str, prompt: str) -> dict:
    payload = {
        "input": {
            "model": HIGGSFIELD_MODEL,
            "prompt": prompt,
            "input_images": [{"type": "image_url", "image_url": image_url}],
        }
    }
    headers = {"Content-Type": "application/json", **higgsfield_auth_header()}
    response = requests.post(
        HIGGSFIELD_I2V_ENDPOINT, headers=headers, json=payload, timeout=60
    )
    response.raise_for_status()
    return response.json()


def poll_higgsfield_until_done(request_id: str, status_url: str = None) -> dict:
    url = status_url or f"{HIGGSFIELD_BASE_URL}/requests/{request_id}/status"
    headers = higgsfield_auth_header()
    deadline = time.monotonic() + HIGGSFIELD_POLL_TIMEOUT_SECONDS
    while True:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        status = (data.get("status") or "").lower()
        if status == "completed":
            return data
        if status in {"failed", "nsfw", "cancelled"}:
            raise RuntimeError(f"Higgsfield job {request_id} ended with status '{status}': {data}")
        if time.monotonic() > deadline:
            raise TimeoutError(f"Higgsfield job {request_id} did not complete within {HIGGSFIELD_POLL_TIMEOUT_SECONDS}s.")
        time.sleep(HIGGSFIELD_POLL_INTERVAL_SECONDS)


def extract_video_url(result: dict) -> str:
    video = result.get("video")
    if isinstance(video, dict) and video.get("url"):
        return video["url"]
    results = result.get("results")
    if isinstance(results, list) and results:
        raw = results[0].get("raw") if isinstance(results[0], dict) else None
        if isinstance(raw, dict) and raw.get("url"):
            return raw["url"]
    jobs = result.get("jobs")
    if isinstance(jobs, list) and jobs:
        job_results = jobs[0].get("results") if isinstance(jobs[0], dict) else None
        if isinstance(job_results, dict):
            raw = job_results.get("raw")
            if isinstance(raw, dict) and raw.get("url"):
                return raw["url"]
    raise RuntimeError(f"Could not find video URL in Higgsfield response: {result}")


def generate_videos_for_images(uploaded_images: list[dict], video_prompt: str) -> list[dict]:
    print(f"  Generating {len(uploaded_images)} video(s) via Higgsfield...")
    videos = []
    for item in uploaded_images:
        i = item["index"]
        image_url = item["url"]
        print(f"    [{i}] Submitting image-to-video job...")
        try:
            submission = submit_higgsfield_video(image_url, video_prompt)
            request_id = submission.get("request_id") or submission.get("id")
            status_url = submission.get("status_url")
            status = (submission.get("status") or "").lower()
            if status == "completed":
                result = submission
            else:
                if not request_id and not status_url:
                    raise RuntimeError(f"Higgsfield submission missing request_id: {submission}")
                print(f"    [{i}] Polling job {request_id} until complete...")
                result = poll_higgsfield_until_done(request_id, status_url)
            video_url = extract_video_url(result)
            print(f"    [{i}] Video ready.")
            videos.append({"index": i, "source_image_url": image_url, "video_url": video_url})
        except Exception as e:
            print(f"    [{i}] Video generation failed: {e}")
            videos.append({"index": i, "source_image_url": image_url, "video_url": None, "error": str(e)})
    return videos


def download_and_upload_videos(service, videos: list[dict], date_id: str) -> list[dict]:
    uploaded = []
    for v in videos:
        if not v.get("video_url"):
            uploaded.append(v)
            continue
        i = v["index"]
        print(f"    [{i}] Downloading video and uploading to Drive...")
        try:
            r = requests.get(v["video_url"], timeout=300)
            r.raise_for_status()
            file_id = upload_bytes_to_drive(
                service, r.content, f"creative_variant_{i}.mp4", "video/mp4", date_id
            )
            uploaded.append({**v, "drive_file_id": file_id, "drive_url": drive_direct_download_url(file_id)})
            print(f"    [{i}] Video uploaded to Drive.")
        except Exception as e:
            print(f"    [{i}] Drive upload failed: {e}")
            uploaded.append({**v, "drive_file_id": None, "drive_url": None, "error": str(e)})
    return uploaded


def make_folder_public(service, folder_id: str) -> str:
    service.permissions().create(
        fileId=folder_id,
        body={"type": "anyone", "role": "reader"},
    ).execute()
    return f"https://drive.google.com/drive/folders/{folder_id}"


def send_slack_notification(
    ad_data: dict,
    folder_link: str,
    image_count: int,
    video_count: int,
):
    print("  Sending Slack notification...")
    message = {
        "text": (
            f":art: *New Creatives Ready for Review*\n"
            f"*Product:* {ad_data['product']}\n"
            f"*Channel:* {ad_data['channel'].capitalize()}\n"
            f"*Headline:* {ad_data['headline']}\n"
            f"*Audience:* {ad_data['audience']}\n"
            f"*Style:* {ad_data['creative_style']}\n"
            f"*Image variants:* {image_count}\n"
            f"*Video variants:* {video_count}\n"
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
    print("[1/5] Generating images...")
    prompt = build_prompt(ad_data)
    images = generate_images(prompt, count=3)

    # 2. Upload images to Drive (publicly readable so Higgsfield can fetch them)
    print("[2/5] Uploading images to Google Drive...")
    drive_service = get_drive_service()
    date_id = setup_drive_folders(drive_service, ad_data["channel"], date_str)
    uploaded_images = upload_images_to_drive(drive_service, images, date_id)

    # 3. Generate videos via Higgsfield
    print("[3/5] Generating videos via Higgsfield...")
    video_prompt = build_video_prompt(ad_data)
    videos = generate_videos_for_images(uploaded_images, video_prompt)

    # 4. Download videos and upload to Drive
    print("[4/5] Uploading videos to Google Drive...")
    videos = download_and_upload_videos(drive_service, videos, date_id)

    # 5. Notify Slack
    print("[5/5] Notifying Slack (#creatives-review)...")
    folder_link = make_folder_public(drive_service, date_id)
    successful_videos = sum(1 for v in videos if v.get("drive_url"))
    send_slack_notification(ad_data, folder_link, len(images), successful_videos)

    print("\n=== Pipeline complete ===")
    print(f"Drive folder: {folder_link}")
    print(f"Images: {len(images)}  Videos: {successful_videos}/{len(videos)}")
    return {"folder_link": folder_link, "images": uploaded_images, "videos": videos}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pipeline.py '<json_string>'")
        sys.exit(1)
    ad_data = json.loads(sys.argv[1])
    run_pipeline(ad_data)
