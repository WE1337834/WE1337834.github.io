import os
from typing import Optional, List, Dict, Any, cast
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_KEY", "")

if not url or not key:
    raise ValueError("SUPABASE_URL и SUPABASE_KEY должны быть заданы в .env файле")

supabase: Client = create_client(url, key)


def save_message(
    user_id: str,
    username: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    message: str
) -> Optional[Dict[str, Any]]:
    """Сохраняет сообщение в Supabase"""
    data = {
        "user_id": str(user_id),
        "username": username or "",
        "first_name": first_name or "",
        "last_name": last_name or "",
        "message": message,
        "status": "new"
    }
    try:
        result = supabase.table("bot_messages").insert(data).execute()
        if result.data and len(result.data) > 0:
            return cast(Dict[str, Any], result.data[0])
        return None
    except Exception as e:
        print(f"Ошибка сохранения: {e}")
        return None


def get_messages(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Получает сообщения из Supabase"""
    try:
        query = supabase.table("bot_messages").select("*").order("created_at", desc=True)
        if status:
            query = query.eq("status", status)
        result = query.execute()
        if result.data:
            return cast(List[Dict[str, Any]], result.data)
        return []
    except Exception as e:
        print(f"Ошибка получения: {e}")
        return []


def update_message_status(message_id: int, status: str) -> bool:
    """Обновляет статус сообщения"""
    try:
        supabase.table("bot_messages").update({"status": status}).eq("id", message_id).execute()
        return True
    except Exception as e:
        print(f"Ошибка обновления: {e}")
        return False