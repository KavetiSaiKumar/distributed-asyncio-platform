import React, { useState, useEffect, useRef } from 'react';

function Chat({ username }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [pendingRequests, setPendingRequests] = useState([]);
    const wsRef = useRef(null);

    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:8080/ws?user_id=${username}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'subscription_request':
                    if (data.requesting_user !== username) {
                        setPendingRequests(prev => [...prev, data]);
                    }
                    break;
                case 'subscription_approved':
                    setIsSubscribed(true);
                    setMessages(prev => [...prev, {
                        type: 'system',
                        message: 'You have been approved to join the General channel'
                    }]);
                    break;
                case 'chat_message':
                    setMessages(prev => [...prev, data]);
                    break;
                case 'system':
                    setMessages(prev => [...prev, data]);
                    break;
            }
        };

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [username]);

    const requestAccess = () => {
        wsRef.current.send(JSON.stringify({
            type: 'subscribe_request',
            channel: 'General'
        }));
    };

    const approveRequest = (requestingUser) => {
        wsRef.current.send(JSON.stringify({
            type: 'approve_subscription',
            requesting_user: requestingUser,
            channel: 'General'
        }));
        setPendingRequests(prev => 
            prev.filter(req => req.requesting_user !== requestingUser)
        );
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && isSubscribed) {
            wsRef.current.send(JSON.stringify({
                type: 'chat_message',
                message: newMessage,
                channel: 'General'
            }));
            setNewMessage('');
        }
    };

    return (
        <div className="chat-container">
            <h2>Chat Room</h2>
            {!isSubscribed && (
                <button onClick={requestAccess}>
                    Request Access to General Channel
                </button>
            )}
            
            {username === 'User_mod' && pendingRequests.length > 0 && (
                <div className="pending-requests">
                    <h3>Pending Requests</h3>
                    {pendingRequests.map((request, index) => (
                        <div key={index}>
                            <span>{request.requesting_user} wants to join General</span>
                            <button onClick={() => approveRequest(request.requesting_user)}>
                                Approve
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.type}`}>
                        {msg.type === 'chat_message' ? (
                            <>
                                <strong>{msg.user}:</strong> {msg.message}
                            </>
                        ) : (
                            <em>{msg.message}</em>
                        )}
                    </div>
                ))}
            </div>

            <form onSubmit={sendMessage}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={!isSubscribed}
                />
                <button type="submit" disabled={!isSubscribed}>Send</button>
            </form>
        </div>
    );
}

export default Chat; 