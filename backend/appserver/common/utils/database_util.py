import pandas as pd
import sqlalchemy

class DatabaseUtil:
    __auth_session = None
    __engine = None
    --async_engine_dict = {}
    __Session = None
    __async_session = None
    __session_dict = {}
    __async_session_dict = {}
    __logger = None
    __base = None
    dbconfig = None
    __microservice_list = None
    __archive_wf_session = None

    def __init__(self):
        pass

    @classmethod
    def initialize_database(cls, dbconfig = None):
        cls.__dbconfig = db_config
