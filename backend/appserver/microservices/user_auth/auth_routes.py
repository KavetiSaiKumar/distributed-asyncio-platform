from aiohttp import web
from appserver.microservices.user_auth.auth_handler import AuthHandler

base_route = '/auth/'

def setup_routes(app, container):
    # Create an instance of AuthHandler with the container
    handler = AuthHandler(container)
    
    # Add routes using the handler instance methods
    app.router.add_get('/ws', handler.websocket_handler)
    app.router.add_post(base_route + 'login', handler.login)
    app.router.add_post(base_route + 'users', handler.create_user)
    app.router.add_post(base_route + 'posts', handler.create_post)
    app.router.add_get(base_route + 'users/{user_id}/posts', handler.get_posts_by_user)
