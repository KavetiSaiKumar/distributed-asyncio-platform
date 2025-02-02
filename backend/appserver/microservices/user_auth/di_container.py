import os
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from functools import lru_cache
from appserver.datamodel.database import Base
from appserver.datamodel.models_discovery import discover_models


# Load environment variables (e.g., from a .env file)
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'password')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'postgres')

# Discover all models
discover_models()

# Create SQLAlchemy engine
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables
Base.metadata.create_all(bind=engine)

class DIContainer:
    def __init__(self):
        print('started di container')
        self._services = {}

    def add_service(self, name, service):
        print('started add service')
        self._services[name] = service
        print(f'added service {name} to di container')
        print(f'services: {self._services}')

    def get_service(self, name):
        print(f'started get service {name}')
        return self._services.get(name)

@lru_cache()
def get_di_container():
    print('started get di container')
    container = DIContainer()
    container.add_service("db_session", SessionLocal)
    return container

def get_session(self):
    session_factory = self.get_service("db_session")
    return session_factory()

