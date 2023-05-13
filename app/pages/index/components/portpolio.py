import pynecone

from app import components
from app.models.history import Portfolio


def PortfolioCard(portfolios: list[Portfolio]) -> pynecone.Component:
    return components.fullfill_card(
        "포트폴리오",
        pynecone.box(
            pynecone.responsive_grid(),
        ),
    )
