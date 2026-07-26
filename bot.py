from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InlineQueryResultArticle, InputTextMessageContent
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    CallbackQueryHandler,
    MessageHandler,
    InlineQueryHandler,
    filters,
)
import uuid

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

# رمز عبور دلخواه برای محدود کردن دسترسی ربات
CORRECT_PASSWORD = "Dv032000vD"


async def start_or_game_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """منوی اصلی ربات که با بررسی رمز عبور و پشتیبانی از Deep Link کار می‌کند."""
    user_id = update.effective_user.id

    # بررسی احراز هویت کاربر
    if not context.bot_data.get(f"authenticated_{user_id}", False):
        context.user_data["waiting_for_password"] = True
        await update.message.reply_text(
            "🔒 این ربات محافظت‌شده است.\n\nلطفاً برای شروع و استفاده از ربات، رمز عبور را ارسال کنید:"
        )
        return

    # بررسی اینکه آیا کاربر از طریق دکمه‌ی اینلاین (گروه/چت دوستان) وارد شده است یا خیر
    args = context.args
    if args and args[0] == "create":
        # اگر با پارامتر ایجاد آمده بود، مستقیماً مرحله‌ی ساخت بازی یا انتخاب ابعاد را صدا می‌زنیم
        # (اگر تابع انتخابی دارید می‌توانید به جای آن تابع دلخواه را صدا بزنید)
        await select_grid_size(update, context)
        return

    # منوی پیش‌فرض پی‌وی
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


async def check_password(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """بررسی رمز عبور ارسالی از سوی کاربر"""
    user_id = update.effective_user.id

    if context.user_data.get("waiting_for_password", False):
        password_input = update.message.text

        if password_input == CORRECT_PASSWORD:
            context.bot_data[f"authenticated_{user_id}"] = True
            context.user_data["waiting_for_password"] = False
            await update.message.reply_text(
                "✅ رمز عبور صحیح است!\n\nاکنون می‌توانید از ربات استفاده کنید یا دستور `/start` را بزنید."
            )
        else:
            await update.message.reply_text("❌ رمز عبور اشتباه است. لطفاً دوباره تلاش کنید:")


async def inline_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """مدیریت حالت اینلاین در گروه‌ها و چت دوستان"""
    user_id = update.inline_query.from_user.id

    # بررسی احراز هویت
    if not context.bot_data.get(f"authenticated_{user_id}", False):
        results = [
            InlineQueryResultArticle(
                id=str(uuid.uuid4()),
                title="🔒 ربات قفل است (نیاز به رمز ورود)",
                description="برای استفاده از ربات ابتدا در پی‌وی به ربات رمز را بدهید.",
                input_message_content=InputTextMessageContent(
                    message_text="❌ این ربات محافظت‌شده است. لطفاً ابتدا به پی‌وی ربات بروید و با وارد کردن رمز عبور آن را فعال کنید."
                )
            )
        ]
        await update.inline_query.answer(results, cache_time=1)
        return

    bot_username = "Dot_GameBot" # آیدی ربات شما
    
    # دکمه‌ای که کاربر را برای ساخت بازی به پی‌وی هدایت می‌کند
    reply_markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 ساخت و مدیریت بازی در پی‌وی ربات", url=f"https://t.me/{bot_username}?start=create")]
    ])

    results = [
        InlineQueryResultArticle(
            id=str(uuid.uuid4()),
            title="🎮 شروع بازی DotVerse",
            description="برای ساخت و مدیریت بازی کلیک کنید",
            input_message_content=InputTextMessageContent(
                message_text="🎮 لابی بازی DotVerse\n\nبرای ساخت بازی جدید و انتخاب گزینه‌ها، روی دکمه زیر کلیک کنید تا وارد پی‌وی ربات شوید:"
            ),
            reply_markup=reply_markup
        )
    ]
    await update.inline_query.answer(results, cache_time=1)


def main():
    app = Application.builder().token(BOT_TOKEN).build()

    # دستورات شروع و اجرای بازی
    app.add_handler(CommandHandler("start", start_or_game_menu))
    app.add_handler(CommandHandler("game", start_or_game_menu))

    # هندلر متن برای دریافت رمز عبور در پی‌وی
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, check_password))

    # هندلر حالت اینلاین
    app.add_handler(InlineQueryHandler(inline_query_handler))

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