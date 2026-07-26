import logging
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ApplicationBuilder, CallbackQueryHandler, CommandHandler, ContextTypes
from config import TELEGRAM_TOKEN

# تنظیمات لاگینگ برای بررسی خطاها
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# حافظه موقت برای نگهداری وضعیت لابی‌ها (بعداً به فایربیس متصل می‌شود)
rooms_data = {}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat_id = update.effective_chat.id
    
    # ساخت شناسه یکتا برای اتاق
    room_id = f"room_{chat_id}"
    
    if room_id not in rooms_data:
        rooms_data[room_id] = {
            "creator": user.id,
            "players": [user.full_name],
            "size": 6,
            "timer": 300,
            "game_started": False
        }

    keyboard = [
        [InlineKeyboardButton("🎯 پایه ام (پیوستن به بازی)", callback_data=f"join_{room_id}")],
        [InlineKeyboardButton("⚙️ تنظیمات ابعاد و زمان", callback_data=f"settings_{room_id}")],
        [InlineKeyboardButton("🚀 شروع بازی", callback_data=f"start_game_{room_id}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    welcome_text = (
        f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n"
        f"سازنده لابی: {user.full_name}\n"
        f"👥 تعداد بازیکنان: {len(rooms_data[room_id]['players'])} نفر\n\n"
        f"لطفاً برای شرکت در بازی روی دکمه «پایه ام» کلیک کنید:"
    )

    await update.message.reply_text(welcome_text, reply_markup=reply_markup, parse_mode="Markdown")

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user = update.effective_user
    
    if data.startswith("join_"):
        room_id = data.split("_", 1)[1]
        if room_id in rooms_data:
            if user.full_name not in rooms_data[room_id]["players"]:
                rooms_data[room_id]["players"].append(user.full_name)
                
            players_list = "\n".join([f"👤 {p}" for p in rooms_data[room_id]["players"]])
            
            keyboard = [
                [InlineKeyboardButton("🎯 پایه ام (پیوستن به بازی)", callback_data=f"join_{room_id}")],
                [InlineKeyboardButton("⚙️ تنظیمات ابعاد و زمان", callback_data=f"settings_{room_id}")],
                [InlineKeyboardButton("🚀 شروع بازی", callback_data=f"start_game_{room_id}")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            updated_text = (
                f"🎮 **بازی نقطه‌چین (DotVerse)**\n\n"
                f"👥 **لیست بازیکنان حاضر:**\n{players_list}\n\n"
                f"تعداد کل: {len(rooms_data[room_id]['players'])} نفر"
            )
            
            try:
                await query.edit_message_text(updated_text, reply_markup=reply_markup, parse_mode="Markdown")
            except Exception:
                pass

    elif data.startswith("start_game_"):
        room_id = data.split("_", 2)[2]
        # آدرس مینی‌اپ شما روی گیت‌هاب پیج بر اساس ریپازیتوری Dot-verse
        mini_app_url = f"https://public-website20.github.io/Dot-verse/?room={room_id}"
        
        keyboard = [
            [InlineKeyboardButton("🎮 ورود به مینی‌اپ و شروع بازی", web_app=WebAppInfo(url=mini_app_url))]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.message.reply_text(
            "🔥 **لابی بازی آماده شد!**\n\nبازیکنان عزیز می‌توانند برای ورود به صفحه بازی و کشیدن خطوط، روی دکمه زیر کلیک کنند:",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

def main():
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_handler))

    print("🤖 ربات با موفقیت روشن شد و در حال دریافت پیام است...")
    app.run_polling()

if __name__ == "__main__":
    main()