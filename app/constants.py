class GlobalStyle:
    class FontFamily:
        DEFAULT = "'Noto Sans KR', sans-serif;"
        LOGO = "'Jeju Gothic', sans-serif"

    class Palette:
        WHITE = "#FFFFFF"
        CINDER = "#030305"
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
        "font_family": FontFamily.LOGO,
        "color": Palette.CINDER,
        "box_sizing": "border-box",
        "--chakra-fonts-heading": FontFamily.LOGO,
    }
