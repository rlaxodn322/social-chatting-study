/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUsername = sessionStorage.getItem('username');
      setUsername(storedUsername);
    }

    // 사용자 목록 불러오기
    axios.get('http://localhost:3001/users').then((res) => {
      setUsers(res.data);
    });
  }, []);

  useEffect(() => {
    if (pathname === '/userschat') {
      const socket = io('http://localhost:3001');

      // 새로운 메시지 받기
      socket.on('receive_message', (data) => {
        setMessages((prevMessages) => [...prevMessages, data]);
      });

      return () => {
        socket.off('receive_message');
        socket.disconnect();
      };
    }
  }, [pathname]);

  useEffect(() => {
    if (selectedUser) {
      // 1:1 채팅 기록 불러오기
      axios
        .get(`http://localhost:3001/chat/history/${selectedUser}`)
        .then((res) => {
          setMessages(res.data);
        })
        .catch((err) => console.error(err));
    }
  }, [selectedUser]);

  const handleSendMessage = () => {
    if (selectedUser && message && username) {
      const senderId = 1; // 임시로 1번 사용자 ID 사용, 실제로는 로그인한 사용자의 ID를 사용
      const socket = io('http://localhost:3001');

      // 메시지 전송
      socket.emit('send_message', {
        senderId,
        receiverId: selectedUser,
        username,
        content: message,
      });

      // 클라이언트에서 메시지 추가
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender_id: senderId,
          receiver_id: selectedUser,
          content: message,
          username,
        },
      ]);

      setMessage('');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:3001/logout');
      sessionStorage.removeItem('username');
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="w-1/3 p-2 bg-white shadow-md">
        <div className="flex justify-between mb-4">
          <Link href="/chat">
            <h1 className="text-lg font-semibold text-blue-600 cursor-pointer">
              Chat
            </h1>
          </Link>
          <h1 className="text-2xl text-gray-600">Users</h1>
          <h1
            onClick={handleLogout}
            className="text-lg text-red-600 cursor-pointer"
          >
            Logout
          </h1>
        </div>

        <ul className="space-y-4">
          {users.map((user) => (
            <li key={user.id} className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-gray-700">{user.username}</span>
                <span className="text-sm text-gray-500">
                  가입일자: {user.created_at}
                </span>
              </div>
              <button
                className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600"
                onClick={() => setSelectedUser(user.id)}
              >
                DM
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* 채팅 섹션 */}
      {selectedUser && (
        <div className="flex-1 p-6 bg-white shadow-md ml-6">
          <h2 className="text-2xl font-semibold mb-4">
            Chat with User {selectedUser}
          </h2>
          <div className="overflow-y-auto max-h-[400px] mb-4 p-4 border border-gray-200 rounded-lg">
            {messages.map((msg, index) => (
              <p
                key={index}
                className={`mb-2 ${
                  msg.sender_id === 1 ? 'text-blue-500' : 'text-gray-700'
                }`}
              >
                {msg.sender_id === 1
                  ? `${msg.username}`
                  : `User ${msg.sender_id}`}{' '}
                : {msg.content}
              </p>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message"
              className="flex-1 p-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
