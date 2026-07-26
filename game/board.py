DEFAULT_SIZE = 8


def create_board(size=DEFAULT_SIZE):
    """
    ساخت برد نقاط
    """

    board = {
        "size": size,
        "lines": [],
        "squares": [],
    }

    return board


def get_points(size):
    """
    ساخت مختصات نقاط
    """

    points = []

    for y in range(size):
        row = []

        for x in range(size):
            row.append(
                {
                    "x": x,
                    "y": y,
                }
            )

        points.append(row)

    return points


def line_exists(board, point1, point2):
    """
    بررسی وجود خط
    """

    for line in board["lines"]:

        if (
            line["p1"] == point1
            and line["p2"] == point2
        ) or (
            line["p1"] == point2
            and line["p2"] == point1
        ):
            return True

    return False


def add_line(board, player_id, point1, point2):
    """
    اضافه کردن خط جدید
    """

    if line_exists(board, point1, point2):
        return False

    board["lines"].append(
        {
            "p1": point1,
            "p2": point2,
            "player": player_id,
        }
    )

    return True


def check_and_add_squares(board, player_id):
    """
    بررسی و ثبت مربع‌های جدیدی که توسط بازیکن فتح شده‌اند.
    """

    size = board["size"]
    new_squares_count = 0

    for r in range(size - 1):
        for c in range(size - 1):
            p_top_left = {"x": c, "y": r}
            p_top_right = {"x": c + 1, "y": r}
            p_bottom_left = {"x": c, "y": r + 1}
            p_bottom_right = {"x": c + 1, "y": r + 1}

            top = line_exists(board, p_top_left, p_top_right)
            bottom = line_exists(board, p_bottom_left, p_bottom_right)
            left = line_exists(board, p_top_left, p_bottom_left)
            right = line_exists(board, p_top_right, p_bottom_right)

            square_already_taken = any(
                sq["x"] == c and sq["y"] == r for sq in board["squares"]
            )

            if not square_already_taken and top and bottom and left and right:
                board["squares"].append(
                    {
                        "x": c,
                        "y": r,
                        "player": player_id,
                    }
                )
                new_squares_count += 1

    return new_squares_count


def get_board_text(board):
    """
    تولید خروجی متنی از وضعیت کلی زمین بازی
    """

    size = board["size"]

    text = f"🌐 زمین بازی DotVerse ({size}×{size})\n\n"

    for y in range(size):

        for x in range(size):

            text += "•"

            if x < size - 1:
                p1 = {"x": x, "y": y}
                p2 = {"x": x + 1, "y": y}
                if line_exists(board, p1, p2):
                    text += "━━"
                else:
                    text += "  "

        text += "\n"

        if y < size - 1:
            for x in range(size):
                p1 = {"x": x, "y": y}
                p2 = {"x": x, "y": y + 1}
                if line_exists(board, p1, p2):
                    text += "┃  "
                else:
                    text += "   "
            text += "\n"

    return text