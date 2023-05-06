import pynecone

from app import components


def _card():
    return components.fullfill_card(
        "보유기술",
        pynecone.box(),
    )


def StackCard() -> pynecone.Component:
    return _card()
