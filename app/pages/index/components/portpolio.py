import pynecone

from app import components


def _card():
    return components.fullfill_card(
        "포트폴리오",
        pynecone.box(),
    )


def PortfolioCard() -> pynecone.Component:
    return _card()
