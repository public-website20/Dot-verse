import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, InlineQueryResultArticle, InputTextMessageContent
from telegram.ext import ApplicationBuilder, CallbackQueryHandler, CommandHandler, ContextTypes, InlineQueryHandler
from config import TELEGRAM_TOKEN

# تنظیمات لاگینگ
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# 🔒 لیست سفید (آیدی عددی افراد مجاز برای استفاده از ربات)
ALLOWED_USERS = [
    7084498711,  # آیدی ابوالفضل
    6630663080,  # آیدی 0903
]

# حافظه موقت برای مدیریت لابی‌ها
rooms_data = {}

def get_full_menu(room):
    """تولید منوی کامل لابی"""
    players_lines = []
    for p_id, p_name in room["players"].items():
        if p_id == room["creator"]:
            players_lines.append(f"سازنده لابی: {p_name}-")
        else:
            players_lines.append(f"{p_name}-")
    
    players_text = "\n".join(players_lines) if players_lines else "هنوز بازیکنی در بازی نیست."
    
    text = (
        f"🎮 **بازی نقطه خط (DotVerse)**\n\n"
        f"⏱ حالت زمان: {room['timer']}\n\n"
        f"👥 **لیست بازیکنان ({len(room['players'])}/20):**\n"
        f"{players_text}"
    )

    room_id = room["room_id"]
    
    # اتصال لینک گیت‌هاب‌پیجِس شما همراه با شناسه لابی
    webapp_url = f"https://public-website20.github.io/Dot-verse/?room={room_id}"

    keyboard = [
        [InlineKeyboardButton("🛠 ساخت بازی", callback_data=f"create_game_{room_id}")],
        [InlineKeyboardButton("🎯 پیوستن به بازی", callback_data=f"join_{room_id}")],
        [InlineKeyboardButton("🚀 ورود به بازی (مینی‌اپ)", url=webapp_url)],
        [InlineKeyboardButton("❌ حذف بازیکن", callback_data=f"kick_menu_{room_id}")],
        [
            InlineKeyboardButton("⏳ بدون زمان", callback_data=f"time_none_{room_id}"),
            InlineKeyboardButton("⏱ زمان‌دار", callback_data=f"time_select_{room_id}")
        ],
        [InlineKeyboardButton("🚪 بستن ربات", callback_data=f"close_bot_{room_id}")]
    ]

    return text, InlineKeyboardMarkup(keyboard)

async def safe_edit_message(query, context, text, reply_markup=None):
    """تابع کمکی ایمن برای ویرایش پیام در حالت‌های چت معمولی و اینلاین"""
    try:
        if query.message:
            await query.edit_message_text(text=text, reply_markup=reply_markup, parse_mode="Markdown")
        elif query.inline_message_id:
            await context.bot.edit_message_text(inline_message_id=query.inline_message_id, text=text, reply_markup=reply_markup, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"خطا در ویرایش امن پیام: {e}")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if user.id not in ALLOWED_USERS:
        await update.message.reply_text("⛔️ شما اجازه استفاده از این ربات را ندارید.")
        return

    chat_id = update.effective_chat.id
    room_id = f"room_{chat_id}_{update.effective_message.message_id}"
    user_display_name = user.full_name if (user.first_name or user.last_name) else (user.username or f"کاربر {user.id}")

    rooms_data[room_id] = {
        "room_id": room_id,
        "creator": user.id,
        "players": {user.id: user_display_name},
        "kicked_history": {},
        "banned_ids": set(),
        "timer": "بدون زمان",
        "game_started": False
    }

    room = rooms_data[room_id]
    text, reply_markup = get_full_menu(room)

    await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")

async def inline_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if user.id not in ALLOWED_USERS:
        return

    inline_query = update.inline_query
    if not inline_query:
        return

    unique_id = inline_query.id
    room_id = f"inline_{user.id}_{unique_id}"
    user_display_name = user.full_name if (user.first_name or user.last_name) else (user.username or f"کاربر {user.id}")
    
    rooms_data[room_id] = {
        "room_id": room_id,
        "creator": user.id,
        "players": {user.id: user_display_name},
        "kicked_history": {},
        "banned_ids": set(),
        "timer": "بدون زمان",
        "game_started": False
    }

    room = rooms_data[room_id]
    text, reply_markup = get_full_menu(room)

    results = [
        InlineQueryResultArticle(
            id=str(unique_id),
            title="🎮 شروع بازی نقطه خط (DotVerse)",
            description="برای شروع بازی و پیوستن دوستان کلیک کنید",
            input_message_content=InputTextMessageContent(
                message_text=text,
                parse_mode="Markdown"
            ),
            reply_markup=reply_markup
        )
    ]
    
    try:
        await inline_query.answer(results, cache_time=0, is_personal=True)
    except Exception as e:
        logger.error(f"خطا در پاسخ به اینلاین: {e}")

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = update.effective_user

    if user.id not in ALLOWED_USERS:
        await query.answer("⛔️ شما اجازه دسترسی به این ربات را ندارید.", show_alert=True)
        return
    
    data = query.data
    
    # پیدا کردن شناسه لابی به صورت دقیق و پویا
    room_id = ""
    for r_id in sorted(rooms_data.keys(), key=len, reverse=True):
        if r_id in data:
            room_id = r_id
            break

    if not room_id or room_id not in rooms_data:
        await query.answer("⚠️ لابی منقضی شده است. لطفاً ربات را دوباره استارت کنید.", show_alert=True)
        return

    room = rooms_data[room_id]
    is_creator = (user.id == room["creator"])

    # 1. پیوستن به بازی
    if data.startswith("join_") and not data.startswith("kick_"):
        user_display_name = user.full_name if (user.first_name or user.last_name) else (user.username or f"کاربر {user.id}")
        
        if user.id in room["banned_ids"]:
            await query.answer("⛔️ شما توسط سازنده از این بازی حذف شده‌اید و نمی‌توانید وارد شوید!", show_alert=True)
            return

        if user.id not in room["players"]:
            if len(room["players"]) >= 20:
                await query.answer("⚠️ ظرفیت بازی تکمیل است (حداکثر 20 نفر).", show_alert=True)
                return
            room["players"][user.id] = user_display_name
            await query.answer("با موفقیت به بازی پیوستید!", show_alert=True)
        else:
            await query.answer("شما از قبل در بازی حضور دارید.", show_alert=True)

        text, reply_markup = get_full_menu(room)
        await safe_edit_message(query, context, text, reply_markup)
        return

    # 2. بستن ربات
    if data.startswith("close_bot_"):
        try:
            if query.message:
                await query.message.delete()
            elif query.inline_message_id:
                await context.bot.edit_message_text(inline_message_id=query.inline_message_id, text="❌ منوی ربات بسته شد.")
        except Exception:
            pass
        return

    # بررسی دسترسی سازنده برای دکمه‌های مدیریتی
    if not is_creator:
        await query.answer("⚠️ این گزینه فقط برای سازنده بازی فعال است!", show_alert=True)
        return

    # 3. ساخت بازی / ریست لابی
    if data.startswith("create_game_"):
        room["creator"] = user.id
        room["players"] = {user.id: user.full_name if (user.first_name or user.last_name) else (user.username or f"کاربر {user.id}")}
        room["kicked_history"] = {}
        room["banned_ids"] = set()
        await query.answer("لابی بازنشانی و ریست شد.", show_alert=True)
        
        text, reply_markup = get_full_menu(room)
        await safe_edit_message(query, context, text, reply_markup)
        return

    # 4. منوی حذف بازیکن
    if data.startswith("kick_menu_"):
        manageable_players = {}
        for p_id, p_name in room["players"].items():
            if p_id != room["creator"]:
                manageable_players[p_id] = p_name
        for p_id, p_name in room["kicked_history"].items():
            if p_id != room["creator"] and p_id not in manageable_players:
                manageable_players[p_id] = p_name

        if not manageable_players:
            back_keyboard = [[InlineKeyboardButton("🔙 بازگشت", callback_data=f"back_menu_{room_id}")]]
            await safe_edit_message(query, context, "⚠️ **بازیکنی برای مدیریت وجود ندارد!**", InlineKeyboardMarkup(back_keyboard))
            await query.answer()
            return

        kick_keyboard = []
        for p_id, p_name in manageable_players.items():
            if p_id in room["banned_ids"]:
                kick_keyboard.append([InlineKeyboardButton(f"✅ آزاد کردن {p_name}", callback_data=f"kick_{p_id}_{room_id}")])
            else:
                kick_keyboard.append([InlineKeyboardButton(f"❌ حذف {p_name}", callback_data=f"kick_{p_id}_{room_id}")])
        
        kick_keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data=f"back_menu_{room_id}")])
        
        await safe_edit_message(query, context, "🗑 **لیست مدیریت بازیکنان:**\nروی نام هر بازیکن برای حذف یا آزادسازی کلیک کنید:", InlineKeyboardMarkup(kick_keyboard))
        await query.answer()
        return

    # 5. عملیات حذف یا آزاد کردن بازیکن خاص
    if data.startswith("kick_") and not data.startswith("kick_menu_"):
        parts = data.split("_")
        target_id = None
        for part in parts:
            if part.isdigit():
                target_id = int(part)
                break
        
        if target_id is not None and target_id != room["creator"]:
            target_name = room["players"].get(target_id) or room["kicked_history"].get(target_id) or f"کاربر {target_id}"

            if target_id in room["banned_ids"]:
                room["banned_ids"].remove(target_id)
                await query.answer(f"بازیکن {target_name} آزاد شد.", show_alert=True)
            else:
                room["banned_ids"].add(target_id)
                room["kicked_history"][target_id] = target_name
                if target_id in room["players"]:
                    del room["players"][target_id]
                await query.answer(f"بازیکن {target_name} از بازی حذف شد.", show_alert=True)
            
            manageable_players = {}
            for p_id, p_name in room["players"].items():
                if p_id != room["creator"]:
                    manageable_players[p_id] = p_name
            for p_id, p_name in room["kicked_history"].items():
                if p_id != room["creator"] and p_id not in manageable_players:
                    manageable_players[p_id] = p_name

            kick_keyboard = []
            for p_id, p_name in manageable_players.items():
                if p_id in room["banned_ids"]:
                    kick_keyboard.append([InlineKeyboardButton(f"✅ آزاد کردن {p_name}", callback_data=f"kick_{p_id}_{room_id}")])
                else:
                    kick_keyboard.append([InlineKeyboardButton(f"❌ حذف {p_name}", callback_data=f"kick_{p_id}_{room_id}")])
            
            kick_keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data=f"back_menu_{room_id}")])
            
            await safe_edit_message(query, context, "🗑 **لیست مدیریت بازیکنان:**\nروی نام هر بازیکن برای حذف یا آزادسازی کلیک کنید:", InlineKeyboardMarkup(kick_keyboard))
        else:
            await query.answer()
        return

    # 6. حالت بدون زمان
    if data.startswith("time_none_"):
        room["timer"] = "بدون زمان"
        await query.answer("حالت بدون زمان انتخاب شد.", show_alert=True)
        text, reply_markup = get_full_menu(room)
        await safe_edit_message(query, context, text, reply_markup)
        return

    # 7. منوی انتخاب زمان‌دار
    if data.startswith("time_select_"):
        time_keyboard = [
            [
                InlineKeyboardButton("2 دقیقه", callback_data=f"settime_2_{room_id}"),
                InlineKeyboardButton("3 دقیقه", callback_data=f"settime_3_{room_id}")
            ],
            [
                InlineKeyboardButton("5 دقیقه", callback_data=f"settime_5_{room_id}"),
                InlineKeyboardButton("7 دقیقه", callback_data=f"settime_7_{room_id}")
            ],
            [InlineKeyboardButton("🔙 بازگشت", callback_data=f"back_menu_{room_id}")]
        ]
        await safe_edit_message(query, context, "⏱ **لطفاً مدت زمان بازی را انتخاب کنید:**", InlineKeyboardMarkup(time_keyboard))
        await query.answer()
        return

    # 8. تنظیم زمان خاص
    if data.startswith("settime_"):
        parts = data.split("_")
        minutes = parts[1]
        room["timer"] = f"{minutes} دقیقه"
        await query.answer(f"زمان بازی روی {minutes} دقیقه تنظیم شد.", show_alert=True)
        text, reply_markup = get_full_menu(room)
        await safe_edit_message(query, context, text, reply_markup)
        return

    # 9. بازگشت به منوی اصلی
    if data.startswith("back_menu_"):
        text, reply_markup = get_full_menu(room)
        await safe_edit_message(query, context, text, reply_markup)
        await query.answer()
        return

def main():
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(InlineQueryHandler(inline_query_handler))
    app.add_handler(CallbackQueryHandler(button_handler))

    print("🤖 ربات نقطه خط با موفقیت روشن شد و در حال دریافت پیام است...")
    app.run_polling()

if __name__ == "__main__":
    main()