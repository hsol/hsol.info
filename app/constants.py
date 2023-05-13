import pynecone


class GlobalStyle:
    class FontFamily:
        DEFAULT = "'Jeju Gothic', sans-serif"
        NOTO = "'Noto Sans KR', sans-serif;"

    class Palette:
        WHITE = "#FFFFFF"
        BLACK = "#030305"
        GRAY = "#9BA4B5"
        SIGNATURE = "#1ABC9C"
        FONT_COLOR = "#363636"
        BIRCH = "#F2F4EF"
        RONCHI = "#EFB730"
        CLEARDAY = "#CEE3F4"
        VERMILLON = "#C94F44"
        RAISIN = "#261326"
        MANTIS = "#ABBF4E"

    STYLE_SHEETS = [
        "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400&display=swap",
        "https://fonts.googleapis.com/earlyaccess/jejugothic.css",
    ]
    STYLE = {
        "font_family": FontFamily.DEFAULT,
        "color": Palette.FONT_COLOR,
        "box_sizing": "border-box",
        pynecone.Heading: {"font_family": FontFamily.DEFAULT},
    }
