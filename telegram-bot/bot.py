import asyncio
import os
from typing import Optional
from aiogram import Bot, Dispatcher
from aiogram.filters import Command
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from dotenv import load_dotenv
from database.supabase_client import save_message

load_dotenv()

BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
ADMIN_CHAT_ID: str = os.getenv("ADMIN_CHAT_ID", "")

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN не задан в .env файле")
if not ADMIN_CHAT_ID:
    raise ValueError("ADMIN_CHAT_ID не задан в .env файле")

# ============================================
#  СОЗДАЁМ БОТА
# ============================================

dp = Dispatcher()
bot = Bot(token=BOT_TOKEN)


# ============================================
#  КОМАНДЫ
# ============================================

@dp.message(Command("start"))
async def start_command(message: Message):
    welcome_text = (
        "👋 Привет! Я бот-помощник.\n\n"
        "Ты можешь написать мне своё сообщение, и я передам его разработчику.\n\n"
        "📌 Просто отправь текст — и я сохраню его как заявку."
    )
    await message.answer(welcome_text)


@dp.message(Command("help"))
async def help_command(message: Message):
    help_text = (
        "📖 **Справка**\n\n"
        "🔹 `/start` — начать работу с ботом\n"
        "🔹 `/help` — показать эту справку\n"
        "🔹 `/status` — проверить статус бота\n\n"
        "✉️ Просто отправь любое сообщение — я сохраню его как заявку."
    )
    await message.answer(help_text, parse_mode="Markdown")


@dp.message(Command("status"))
async def status_command(message: Message):
    await message.answer("✅ Бот работает и готов принимать сообщения!")


# ============================================
#  ОБРАБОТКА СООБЩЕНИЙ
# ============================================

@dp.message()
async def handle_message(message: Message):
    if not message.text or message.text.startswith('/'):
        return

    user = message.from_user
    if not user:
        await message.answer("❌ Не удалось определить пользователя.")
        return

    user_id = str(user.id)
    username = user.username or ""
    first_name = user.first_name or ""
    last_name = user.last_name or ""
    text = message.text

    try:
        saved = save_message(
            user_id=user_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            message=text
        )

        if saved:
            await notify_admin(user_id, username, first_name, last_name, text, saved.get('id'))
            await message.answer("✅ Ваше сообщение отправлено! Я свяжусь с вами в ближайшее время.")
        else:
            await message.answer("❌ Произошла ошибка при отправке. Попробуйте позже.")

    except Exception as e:
        print(f"Ошибка: {e}")
        await message.answer("❌ Произошла ошибка. Попробуйте позже.")


# ============================================
#  УВЕДОМЛЕНИЕ АДМИНУ
# ============================================

async def notify_admin(user_id: str, username: str, first_name: str, last_name: str, text: str, message_id: Optional[int]):
    try:
        user_info = f"@{username}" if username else f"{first_name} {last_name}".strip() or user_id
        
        notification = (
            f"📩 **Новая заявка от бота**\n\n"
            f"👤 **Пользователь:** {user_info}\n"
            f"🆔 **User ID:** `{user_id}`\n"
            f"📝 **Сообщение:**\n"
            f"`{text[:500]}`\n\n"
            f"📅 {__import__('datetime').datetime.now().strftime('%d.%m.%Y %H:%M')}"
        )

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="📖 Посмотреть в админке",
                        url="https://we1337834.github.io/admin.html"
                    )
                ]
            ]
        )

        await bot.send_message(
            chat_id=ADMIN_CHAT_ID,
            text=notification,
            parse_mode="Markdown",
            reply_markup=keyboard
        )

    except Exception as e:
        print(f"Ошибка отправки уведомления админу: {e}")


# ============================================
#  ЗАПУСК БОТА
# ============================================

async def main():
    print("🤖 Бот запущен!")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())