import React, { useState } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';

function App() {
    const [user, setUser] = useState(null);

    const handleLogin = (username) => {
        setUser(username);
    };

    return (
        <div className="app">
            {!user ? (
                <Login onLogin={handleLogin} />
            ) : (
                <Chat username={user} />
            )}
        </div>
    );
}

export default App; 