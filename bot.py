from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    CallbackQueryHandler,
)

from config import BOT_TOKEN
from game.handlers import (
    create_game,
    join_game,
    start_game,
    cancel_game,
    show_help,
    show_settings,
    show_about,
    select_grid_size,
    set_grid_size,
)


async def start_or_game_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """منوی اصلی ربات که هم با دستور /start و هم /game در گروه یا پی‌وی کار می‌کند."""
    keyboard = [
        [InlineKeyboardButton("🆕 ایجاد بازی", callback_data="create_game")],
        [InlineKeyboardButton("📖 آموزش", callback_data="help")],
        [InlineKeyboardButton("⚙️ تنظیمات", callback_data="settings")],
        [InlineKeyboardButton("ℹ️ درباره بازی", callback_data="about")],
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "🎮 به DotVerse خوش اومدی!\n\n"
        "برای شروع یا مدیریت بازی، لطفاً یکی از گزینه‌های زیر را انتخاب کن:",
        reply_markup=reply_markup,
    )


def main():
    app = Application.builder().token(BOT_TOKEN).build()

    # دستورات شروع و اجرای بازی (هم در پی‌وی و هم در گروه)
    app.add_handler(CommandHandler("start", start_or_game_menu))
    app.add_handler(CommandHandler("game", start_or_game_menu))

    # هندلرهای دکمه‌های شیشه‌ای (Callback Queries)
    app.add_handler(CallbackQueryHandler(create_game, pattern="^create_game$"))
    app.add_handler(CallbackQueryHandler(join_game, pattern="^join_game$"))
    app.add_handler(CallbackQueryHandler(select_grid_size, pattern="^select_grid_size$"))
    app.add_handler(CallbackQueryHandler(set_grid_size, pattern="^set_size_"))
    app.add_handler(CallbackQueryHandler(start_game, pattern="^start_game$"))
    app.add_handler(CallbackQueryHandler(cancel_game, pattern="^cancel_game$"))
    app.add_handler(CallbackQueryHandler(show_help, pattern="^help$"))
    app.add_handler(CallbackQueryHandler(show_settings, pattern="^settings$"))
    app.add_handler(CallbackQueryHandler(show_about, pattern="^about$"))

    print("Bot is running...")

    app.run_polling()


if __name__ == "__main__":
    main()