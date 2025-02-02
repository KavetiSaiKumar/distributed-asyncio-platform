import asyncio
from datetime import datetime
import json
import traceback
import redis.asyncio as redis
from aiohttp import web
from sqlalchemy.orm import Session
from appserver.datamodel.auth_models import User, Post

class AuthHandler:
    def __init__(self, container):
        self.container = container

    async def websocket_handler(self, request):
        ws = web.WebSocketResponse(heartbeat=30, autoping=True)
        
        try:
            await ws.prepare(request)
            user_id = request.query.get('user_id', 'Anonymous')
            
            session_factory = self.container.get_service("db_session")
            session = session_factory()
            
            try:
                user = session.query(User).filter(User.username == user_id).first()
                if not user:
                    await ws.close(code=4001, message=b'User not found')
                    return ws

                print(f'WebSocket connection established. User: {user_id}')
                
                redis_client = redis.Redis(
                    host='localhost',
                    port=6379,
                    db=0,
                    decode_responses=True
                )
                
                pubsub = redis_client.pubsub()
                subscribed_channels = set()

                # Subscribe to user's private channel
                await pubsub.subscribe(f'user_{user_id}')
                
                # If user is moderator, subscribe to moderator channel
                if user.is_moderator:
                    await pubsub.subscribe('moderator_channel')
                    
                async def stream_messages():
                    try:
                        async for message in pubsub.listen():
                            if message['type'] == 'message':
                                await ws.send_str(message['data'])
                    except Exception as e:
                        print(f"Error in stream_messages: {str(e)}")

                async def ws_receive():
                    try:
                        async for msg in ws:
                            if msg.type == web.WSMsgType.TEXT:
                                data = json.loads(msg.data)
                                message_type = data.get('type')
                                
                                if message_type == 'subscribe_request':
                                    channel = data.get('channel')
                                    print(f"Subscription request from {user_id} for channel: {channel}")
                                    
                                    # Send request to moderators
                                    request_message = json.dumps({
                                        'type': 'subscription_request',
                                        'requesting_user': user_id,
                                        'channel': channel,
                                        'timestamp': str(datetime.now())
                                    })
                                    await redis_client.publish('moderator_channel', request_message)
                                    
                                    # Notify user that request is pending
                                    await ws.send_str(json.dumps({
                                        'type': 'system',
                                        'message': f'Subscription request sent for {channel}',
                                        'timestamp': str(datetime.now())
                                    }))

                                elif message_type == 'approve_subscription':
                                    if user.is_moderator:
                                        target_user = data.get('requesting_user')
                                        channel = data.get('channel')
                                        
                                        # Add user to channel subscribers in database
                                        async with session_factory() as session:
                                            target = await session.query(User).filter(
                                                User.username == target_user
                                            ).first()
                                            if target:
                                                # Add channel subscription logic here
                                                pass
                                        
                                        # Send approval to requesting user
                                        approval_message = json.dumps({
                                            'type': 'subscription_approved',
                                            'channel': channel,
                                            'message': f'Your subscription to {channel} was approved',
                                            'timestamp': str(datetime.now())
                                        })
                                        await redis_client.publish(f'user_{target_user}', approval_message)
                                    else:
                                        await ws.send_str(json.dumps({
                                            'type': 'error',
                                            'message': 'Unauthorized: Only moderators can approve subscriptions'
                                        }))

                                elif message_type == 'chat_message':
                                    channel = data.get('channel')
                                    if channel in subscribed_channels:
                                        chat_message = json.dumps({
                                            'type': 'chat_message',
                                            'user': user_id,
                                            'message': data.get('message'),
                                            'channel': channel,
                                            'timestamp': str(datetime.now())
                                        })
                                        await redis_client.publish(channel, chat_message)
                                    else:
                                        await ws.send_str(json.dumps({
                                            'type': 'error',
                                            'message': 'Not subscribed to this channel'
                                        }))

                    except Exception as e:
                        print(f"Error in ws_receive: {str(e)}")
                        traceback.print_exc()

                await asyncio.gather(stream_messages(), ws_receive())

            except Exception as e:
                print(f"WebSocket handler error: {str(e)}")
                traceback.print_exc()
            finally:
                session.close()
            
        except Exception as e:
            print(f"WebSocket handler error: {str(e)}")
            traceback.print_exc()
            if not ws.closed:
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
        data = await request.json()
        title = data.get('title')
        content = data.get('content')
        author_id = data.get('author_id')

        async with request.app['db_session']() as session:
            post = Post(title=title, content=content, author_id=author_id)
            session.add(post)
            session.commit()

        return web.json_response({'id': post.id, 'title': post.title, 'content': post.content, 'author_id': post.author_id})

    async def get_posts_by_user(self, request):
        user_id = request.match_info.get('user_id')

        async with request.app['db_session']() as session:
            posts = session.query(Post).filter(Post.author_id == user_id).all()

        posts_data = [{'id': post.id, 'title': post.title, 'content': post.content} for post in posts]
        return web.json_response(posts_data)
