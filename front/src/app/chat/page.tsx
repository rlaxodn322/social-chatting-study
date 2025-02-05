/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
const socket = io('http://localhost:3001');
const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/chat') {
      const socket = io('http://localhost:3001');
      socket.on('connect', () => {
        console.log('Socket 연결');
      });
      return () => {
        socket.disconnect();
      };
    }
  }, [pathname]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUsername = sessionStorage.getItem('username');
      setUsername(storedUsername);
      // 사용자 입장 메시지 추가
      if (storedUsername) {
        socket.emit('send_global_message', {
          senderId: 1, // Adjust this as per your app logic
          username: storedUsername,
          content: `${storedUsername}님이 입장`,
        });
      }
    }
    return () => {
      socket.off('receive_global_message'); // cleanup
    };
  }, []); // 의존성 배열을 비워서 마운트 시 한 번만 실행

  useEffect(() => {
    axios
      .get('http://localhost:3001/chat/global')
      .then((res) => {
        setMessages(res.data);
      })
      .catch((err) => {
        console.error('Error fetching global messages:', err);
      });
    // 새로운 메시지 받기
    const messageHandler = (data: any) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    };
    socket
      .off('receive_global_message')
      .on('receive_global_message', messageHandler);
    // 사용자 목록 불러오기
    axios.get('http://localhost:3001/users').then((res) => {
      setUsers(res.data);
    });
    return () => {
      socket.off('receive_global_message', messageHandler);
    };
  }, []); // 의존성 배열을 비워서 마운트 시 한 번만 실행

  const sendExitMessage = () => {
    if (username) {
      socket.emit('send_global_message', {
        senderId: 1,
        username,
        content: `${username}님이 퇴장`,
      });
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => sendExitMessage();

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      sendExitMessage();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const handleSendGlobalMessage = () => {
    if (message && username) {
      const newMessage = {
        senderId: 1,
        username,
        content: message,
      };
      // 메시지 전송
      socket.emit('send_global_message', newMessage);
      // 즉시 로컬 상태 업데이트
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setMessage('');
    }
  };

  const handleLogout = async () => {
    try {
      // Make an API call to logout
      await axios.post('http://localhost:3001/logout');

      // Clear session data
      sessionStorage.removeItem('username');

      // Redirect to the login page
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex justify-between min-h-screen bg-gray-100">
      <div className="w-1/3 p-2 bg-white shadow-md">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-semibold text-blue-600 cursor-pointer">
            Chat
          </h1>
          <Link href="/userschat">
            <h1 className="text-lg text-gray-600">Users</h1>
          </Link>
          <h1
            onClick={handleLogout}
            className="text-lg text-red-600 cursor-pointer"
          >
            Logout
          </h1>
        </div>

        {/* 채팅 영역 */}
        <div>
          <h2>Global Chat</h2>
          <div>
            {messages.map((msg, index) => (
              <p
                key={index}
                style={
                  msg.content.includes('입장')
                    ? { color: 'green' }
                    : msg.content.includes('퇴장')
                    ? { color: 'red' }
                    : {}
                }
              >
                {msg.content.includes('입장') || msg.content.includes('퇴장')
                  ? msg.content
                  : `${msg.username}: ${msg.content}`}
              </p>
            ))}
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="채팅 내용을 입력"
            />
            <button onClick={handleSendGlobalMessage}>Send</button>
          </div>
        </div>
      </div>

      {/* 우측 유저 목록 */}
      <div
        style={{
          marginLeft: '20px',
          width: '200px',
          borderLeft: '1px solid #ddd',
          paddingLeft: '20px',
        }}
      >
        <h2>User List</h2>
        <ul>
          <div>현재</div>
          <div>채팅방 내 유저 목록</div>
          {users.map((user) => (
            <li key={user.id}>{user.username}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Chat;
