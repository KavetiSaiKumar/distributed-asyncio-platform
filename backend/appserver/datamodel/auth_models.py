from sqlalchemy import Column, Integer, String, Boolean, Sequence, ForeignKey
from appserver.datamodel.database import Base
from passlib.context import CryptContext
from sqlalchemy.orm import relationship

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, Sequence('user_id_seq'), primary_key=True, autoincrement=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_moderator = Column(Boolean, default=False)
    posts = relationship("Post", back_populates="author")

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.hashed_password)

    def set_password(self, password: str) -> None:
        self.hashed_password = pwd_context.hash(password)

class Post(Base):
    __tablename__ = 'posts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'))
    author = relationship("User", back_populates="posts")