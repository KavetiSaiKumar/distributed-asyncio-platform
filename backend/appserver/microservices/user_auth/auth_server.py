import os
from aiohttp import web
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
import asyncio
import redis.asyncio as redis
from appserver.microservices.user_auth import auth_routes
from appserver.microservices.user_auth.di_container import get_di_container
# import sys
# sys.path.append('C:/DEV/webapp/backend/appserver')
# C:\DEV\webapp\backend\appserver

# Load environment variables (e.g., from a .env file)
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'password')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'postgres')

# Create SQLAlchemy engine
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# Redis client
# redis_client = redis.Redis(host='localhost', port=6379, db=0)

# Create a base class for our models
Base = declarative_base()
Base.metadata.create_all(bind=engine)  # Create all tables



async def init_app():
    app = web.Application()
    container = get_di_container()
    # Here you can add routes and middlewares
    auth_routes.setup_routes(app, container)
    return app

def main():
    app = asyncio.run(init_app())
    web.run_app(app, host='0.0.0.0', port=8000)

if __name__ == '__main__':
    main()
