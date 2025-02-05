'use client';
import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const Home = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSignup = async () => {
    try {
      await axios.post('http://localhost:3001/signup', { username, password });
      setMessage('User registered successfully');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setMessage('Error during signup');
    }
  };

  const handleLogin = async () => {
    try {
      await axios.post('http://localhost:3001/login', { username, password });
      sessionStorage.setItem('username', username);
      router.push('/chat');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setMessage('Error during login');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-4">
          Chat Application
        </h1>
        <div className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full p-3 border border-gray-300 rounded-md"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-3 border border-gray-300 rounded-md"
          />
          <div className="space-y-2">
            <button
              onClick={handleSignup}
              className="w-full bg-blue-500 text-white p-3 rounded-md hover:bg-blue-600"
            >
              Signup
            </button>
            <button
              onClick={handleLogin}
              className="w-full bg-green-500 text-white p-3 rounded-md hover:bg-green-600"
            >
              Login
            </button>
          </div>
        </div>
        {message && <p className="mt-4 text-center text-red-500">{message}</p>}
      </div>
    </div>
  );
};

export default Home;
