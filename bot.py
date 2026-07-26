import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ApplicationBuilder, CallbackQueryHandler, CommandHandler, ContextTypes
from config import TELEGRAM_TOKEN

# تنظیمات لاگینگ
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# حافظه موقت برای مدیریت لابی‌ها و وضعیت‌ها
rooms_data = {}

def get_main_menu(room_id):
    """منوی اصلی لابی بازی"""
    keyboard = [
        [InlineKeyboardButton("🛠 ساخت بازی", callback_data=f"create_game_{room_id}")],
        [InlineKeyboardButton("🎯 پیوستن به بازی", callback_data=f"join_{room_id}")],
        [InlineKeyboardButton("❌ حذف بازیکن", callback_data=f"kick_menu_{room_id}")],
        [
            InlineKeyboardButton("⏳ بدون زمان", callback_data=f"time_none_{room_id}"),
            InlineKeyboardButton("⏱ زمان‌دار", callback_data=f"time_select_{room_id}")
        ],
        [InlineKeyboardButton("🚪 بستن ربات", callback_data=f"close_bot_{room_id}")]
    ]
    return InlineKeyboardMarkup(keyboard)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat_id = update.effective_chat.id
    room_id = f"room_{chat_id}"
    
    if room_id not in rooms_data:
        rooms_data[room_id] = {
            "creator": user.id,
            "creator_name": user.full_name,
            "players": {user.id: user.full_name},
            "timer": "بدون زمان",
            "game_started": False
        }

    welcome_text = (
        f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n"
        f"سازنده لابی: {rooms_data[room_id]['creator_name']}\n"
        f"👥 تعداد بازیکنان: {len(rooms_data[room_id]['players'])} نفر\n"
        f"⏱ حالت زمان: {rooms_data[room_id]['timer']}\n\n"
        f"لطفاً یکی از گزینه‌های زیر را انتخاب کنید:"
    )

    await update.message.reply_text(welcome_text, reply_markup=get_main_menu(room_id), parse_mode="Markdown")

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user = update.effective_user
    room_id = data.split("_")[-1]
    
    if room_id not in rooms_data:
        rooms_data[room_id] = {
            "creator": user.id,
            "creator_name": user.full_name,
            "players": {user.id: user.full_name},
            "timer": "بدون زمان",
            "game_started": False
        }

    room = rooms_data[room_id]

    # ۱. ساخت بازی (یا شروع لابی جدید)
    if data.startswith("create_game_"):
        room["creator"] = user.id
        room["creator_name"] = user.full_name
        if user.id not in room["players"]:
            room["players"][user.id] = user.full_name
        
        await query.edit_message_text(
            f"🛠 **لابی جدید توسط {user.full_name} ساخته شد!**\nاکنون بازیکنان می‌توانند به بازی بپیوندند.",
            reply_markup=get_main_menu(room_id),
            parse_mode="Markdown"
        )

    # ۲. پیوستن به بازی
    elif data.startswith("join_") and not data.startswith("kick_"):
        if user.id not in room["players"]:
            room["players"][user.id] = user.full_name
            
        players_list = "\n".join([f"👤 {name}" for name in room["players"].values()])
        updated_text = (
            f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n"
            f"👥 **لیست بازیکنان حاضر:**\n{players_list}\n\n"
            f"⏱ حالت زمان: {room['timer']}\n"
            f"تعداد کل: {len(room['players'])} نفر"
        )
        try:
            await query.edit_message_text(updated_text, reply_markup=get_main_menu(room_id), parse_mode="Markdown")
        except Exception:
            pass

    # ۳. منوی حذف بازیکن (فقط سازنده اجازه دارد)
    elif data.startswith("kick_menu_"):
        if user.id != room["creator"]:
            await query.answer("⚠️ فقط سازنده بازی می‌تواند بازیکنان را حذف کند!", show_alert=True)
            return
            
        if len(room["players"]) <= 1:
            await query.answer("⚠️ بازیکن دیگری برای حذف وجود ندارد!", show_alert=True)
            return

        kick_keyboard = []
        for p_id, p_name in room["players"].items():
            if p_id != room["creator"]: # سازنده خودش را نمی‌تواند حذف کند
                kick_keyboard.append([InlineKeyboardButton(f"❌ حذف {p_name}", callback_data=f"kick_{p_id}_{room_id}")])
        
        kick_keyboard.append([InlineKeyboardButton("🔙 بازگشت", callback_data=f"back_menu_{room_id}")])
        
        await query.edit_message_text(
            "🗑 **لیست بازیکنان برای حذف:**\nروی نام هر بازیکن که خواستید کلیک کنید تا از بازی خارج شود:",
            reply_markup=InlineKeyboardMarkup(kick_keyboard),
            parse_mode="Markdown"
        )

    elif data.startswith("kick_") and not data.startswith("kick_menu_"):
        parts = data.split("_")
        target_id = int(parts[1])
        
        if user.id == room["creator"] and target_id in room["players"]:
            removed_name = room["players"].pop(target_id)
            await query.answer(f" بازیکن {removed_name} با موفقیت حذف شد.", show_alert=True)
            
        players_list = "\n".join([f"👤 {name}" for name in room["players"].values()])
        updated_text = (
            f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n"
            f"👥 **لیست بازیکنان حاضر:**\n{players_list}\n\n"
            f"⏱ حالت زمان: {room['timer']}"
        )
        await query.edit_message_text(updated_text, reply_markup=get_main_menu(room_id), parse_mode="Markdown")

    # ۴. تنظیم زمان (بدون زمان یا انتخاب زمان‌دار)
    elif data.startswith("time_none_"):
        room["timer"] = "بدون زمان"
        await query.answer("حالت بدون زمان انتخاب شد.", show_alert=True)
        await query.edit_message_text(
            f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n⏱ حالت زمان: بدون زمان\n👥 تعداد بازیکنان: {len(room['players'])} نفر",
            reply_markup=get_main_menu(room_id),
            parse_mode="Markdown"
        )

    elif data.startswith("time_select_"):
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
        await query.edit_message_text("⏱ **لطفاً مدت زمان بازی را انتخاب کنید:**", reply_markup=InlineKeyboardMarkup(time_keyboard), parse_mode="Markdown")

    elif data.startswith("settime_"):
        parts = data.split("_")
        minutes = parts[1]
        room["timer"] = f"{minutes} دقیقه"
        
        await query.answer(f"زمان بازی روی {minutes} دقیقه تنظیم شد.", show_alert=True)
        await query.edit_message_text(
            f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n⏱ حالت زمان: {room['timer']}\n👥 تعداد بازیکنان: {len(room['players'])} نفر",
            reply_markup=get_main_menu(room_id),
            parse_mode="Markdown"
        )

    # ۵. دکمه بازگشت به منوی اصلی
    elif data.startswith("back_menu_"):
        await query.edit_message_text(
            f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n👥 تعداد بازیکنان: {len(room['players'])} نفر\n⏱ حالت زمان: {room['timer']}",
            reply_markup=get_main_menu(room_id),
            parse_mode="Markdown"
        )

    # ۶. بستن ربات (پاک کردن پیام منو)
    elif data.startswith("close_bot_"):
        try:
            await query.message.delete()
        except Exception:
            await query.edit_message_text("❌ منوی ربات بسته شد.")

def main():
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_handler))

    print("🤖 ربات با موفقیت روشن شد و در حال دریافت پیام است...")
    app.run_polling()

if __name__ == "__main__":
    main()