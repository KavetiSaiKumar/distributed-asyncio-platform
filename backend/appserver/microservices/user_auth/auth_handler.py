import asyncio
from datetime import datetime
import json
import traceback
import redis.asyncio as redis
from aiohttp import web, WSMsgType
from sqlalchemy.orm import Session
from appserver.datamodel.auth_models import User, Post
import ssl

class AuthHandler:
    def __init__(self, container):
        self.container = container
        # Initialize Redis client
        self.redis_client = redis.Redis(
            host='localhost',
            port=6379,
            db=0,
            decode_responses=True
        )

    async def websocket_handler(self, request):
        # Create a WebSocket response object with heartbeat and autoping to keep the connection alive
        ws = web.WebSocketResponse(heartbeat=30, autoping=True, compress=True)
        await ws.prepare(request)  # Perform the necessary handshake to upgrade the HTTP connection to a WebSocket connection
        user_id = request.query.get('user_id', 'Anonymous')

        # Get a database session from the container
        session_factory = self.container.get_service("db_session")
        session = session_factory()

        try:
            # Try to get the user from the cache
            user = await self.get_user_from_cache(user_id)
            if not user:
                # If the user is not in the cache, fetch from the database
                user = session.query(User).filter(User.username == user_id).first()
                if not user:
                    await ws.close(code=4001, message=b'User not found')
                    return ws
                # Cache the user data
                await self.cache_user(user)

            print(f'WebSocket connection established. User: {user_id}')

            # Initialize Redis Pub/Sub
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(f'user_{user_id}')
            if user.is_moderator:
                await pubsub.subscribe('moderator_channel')

            # Coroutine to stream messages from Redis to WebSocket
            async def stream_messages():
                try:
                    async for message in pubsub.listen():
                        if message['type'] == 'message':
                            await ws.send_str(message['data'])
                except Exception as e:
                    print(f"Error in stream_messages: {str(e)}")

            # Coroutine to handle incoming WebSocket messages
            async def ws_receive():
                try:
                    async for msg in ws:
                        if msg.type == WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            message_type = data.get('type')
                            # Handle different message types
                except Exception as e:
                    print(f"Error in ws_receive: {str(e)}")

            # Run both coroutines concurrently
            await asyncio.gather(stream_messages(), ws_receive())

        except Exception as e:
            print(f"Error in websocket_handler: {str(e)}")
        finally:
            await ws.close()

        return ws

    async def login(self, request):
        print("started login handler")
        data = await request.json()
        username = data.get('username')
        password = data.get('password')  # In production, handle this securely

        session_factory = self.container.get_service("db_session")
        session = session_factory()

        try:
            user = session.query(User).filter_by(username=username).first()
            if user and user.is_active:  # In production, add proper password verification
                print("login successful, user found")
                return web.json_response({
                    'message': 'Login successful',
                    'username': user.username,
                    'is_moderator': user.is_moderator
                })
            else:
                print("login failed, user not found")
                return web.json_response({
                    'message': 'Invalid credentials'
                }, status=401)
        except Exception as e:
            print(traceback.format_exc())
            print("login failed, server error")
            return web.json_response({
                'message': 'Server error'
            }, status=500)
        finally:
            print("closing session")
            session.close()

    async def create_user(self, request):
        data = await request.json()
        username = data.get('username')
        email = data.get('email')

        async with request.app['db_session']() as session:
            # Get the next ID value
            result = session.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM users")
            next_id = result.scalar()
            
            user = User(
                id=next_id,
                username=username,
                email=email
            )
            session.add(user)
            session.commit()

        return web.json_response({'id': user.id, 'username': user.username, 'email': user.email})

    async def create_post(self, request):
        # Parse the request data
        data = await request.json()
        title = data.get('title')
        content = data.get('content')
        author_id = data.get('author_id')

        # Create a new post and save it to the database
        async with request.app['db_session']() as session:
            post = Post(title=title, content=content, author_id=author_id)
            session.add(post)
            session.commit()

        # Return the created post as a JSON response
        return web.json_response({'id': post.id, 'title': post.title, 'content': post.content, 'author_id': post.author_id})

    async def get_posts_by_user(self, request):
        user_id = request.match_info.get('user_id')
        # Try to get the posts from the cache
        cached_posts = await self.redis_client.get(f'posts:{user_id}')
        if cached_posts:
            return web.json_response(json.loads(cached_posts))

        # If the posts are not in the cache, fetch from the database
        async with request.app['db_session']() as session:
            posts = session.query(Post).filter(Post.author_id == user_id).all()

        # Cache the fetched posts
        posts_data = [{'id': post.id, 'title': post.title, 'content': post.content} for post in posts]
        await self.redis_client.set(f'posts:{user_id}', json.dumps(posts_data), ex=3600)  # Cache for 1 hour
        return web.json_response(posts_data)

    async def get_user_from_cache(self, user_id):
        # Try to get the user data from the cache
        user_data = await self.redis_client.get(f'user:{user_id}')
        if user_data:
            return json.loads(user_data)
        return None

    async def cache_user(self, user):
        # Cache the user data with an expiration time of 1 hour
        user_data = {
            'id': user.id,
            'username': user.username,
            'is_moderator': user.is_moderator
        }
        await self.redis_client.set(f'user:{user.username}', json.dumps(user_data), ex=3600)  # Cache for 1 hour
