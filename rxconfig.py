import reflex as rx
import os
from dotenv import load_dotenv


def get_mysql_db_url():
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT")
    username = os.environ.get("DB_USERNAME")
    password = os.environ.get("DB_PASSWORD")
    db_name = os.environ.get("DB_NAME")

    assert all(
        filter(lambda i: i is not None, (username, password, db_name))
    ), "DB 정보를 정확히 입력해주세요."

    return f"mysql+pymysql://{username}:{password}@{host}:{port}/{db_name}"


load_dotenv()
config = rx.Config(
    app_name="app",
    disable_bun=True,
    deploy_url=os.environ.get("DEPLOY_URL") or None,
    db_url=get_mysql_db_url(),
    env=os.environ.get("APP_ENVIRONMENT") or rx.Env.DEV,
    api_url=os.environ.get("BACKEND_URL") or rx.constants.API_URL,
    port=os.environ.get("FRONTEND_PORT") or rx.constants.FRONTEND_PORT,
    backend_port=os.environ.get("BACKEND_PORT") or rx.constants.BACKEND_PORT,
)
