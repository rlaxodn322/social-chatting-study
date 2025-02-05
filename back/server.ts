import express, { Request, Response } from 'express';
import mysql, { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { Server as SocketIOServer } from 'socket.io';
import session from 'express-session';
import dotenv from 'dotenv';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat Application API',
      version: '1.0.0',
      description: 'API Documentation for the Chat Application',
    },
  },
  apis: ['./server.ts'],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
// MySQL 연결을 위한 전역 변수 선언
let db: mysql.Connection;
app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
const connectDB = async () => {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      port: Number(process.env.DB_PORT) || 3306,
      password: process.env.DB_PASSWORD || '00000000',
      database: process.env.DB_NAME || 'chat_app',
    });
    console.log('MySQL 연결 성공');
  } catch (error) {
    console.error('MySQL 연결 실패:', error);
    process.exit(1); // 연결 실패 시 서버 종료
  }
};
// 데이터베이스 연결 실행
connectDB();
// Express 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 세션 설정
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'chatapp_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // 로컬 개발 환경에서는 false
  })
);
// 기본 라우트
app.get('/', (req: Request, res: Response) => {
  res.send('Chat Application');
});
/**
 * @swagger
 * /users:
 *   get:
 *     summary: 모든 사용자 조회 API
 *     responses:
 *       200:
 *         description: List of users
 */
// 모든 사용자 조회 API
app.get('/users', async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, username,created_at FROM users'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('사용자 목록을 가져오는 데 오류가 발생했습니다');
  }
});
/**
 * @swagger
 * /signup:
 *   post:
 *     summary: 회원가입 API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 */
// 회원가입 API
app.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [
      username,
      hashedPassword,
    ]);
    res.status(201).send('User registered successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error during signup');
  }
});
/**
 * @swagger
 * /login:
 *   post:
 *     summary: 로그인 API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       400:
 *         description: Invalid credentials
 */
// 로그인 API
app.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [
      username,
    ]);
    const users = rows as any[];
    if (users.length === 0) {
      res.status(400).send('User not found');
      return;
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).send('Invalid password');
      return;
    }
    (req.session as any).userId = user.id; // 세션에 사용자 ID 저장
    res.send('Logged in successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error during login');
  }
});
/**
 * @swagger
 * /logout:
 *   post:
 *     summary: 로그아웃 API
 *     description: Logs out the user and destroys the session
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
// 로그아웃 API
app.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error during logout');
    }
    res.send('Logged out successfully');
  });
});
/**
 * @swagger
 * /change-password:
 *   post:
 *     summary: 패스워드 변경 API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 *       500:
 *         description: Server error
 */
//패스워드 변경
app.post(
  '/change-password',
  async (req: Request, res: Response): Promise<void> => {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      res.status(400).send('All fields are required');
      return;
    }
    try {
      // 사용자 정보 조회
      const [rows] = await db.execute<RowDataPacket[]>(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );
      if (rows.length === 0) {
        res.status(400).send('User not found');
        return;
      }
      const user = rows[0];
      // 현재 비밀번호 검증
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        res.status(400).send('Invalid current password');
        return;
      }
      // 새 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      // 비밀번호 업데이트
      await db.execute('UPDATE users SET password = ? WHERE id = ?', [
        hashedPassword,
        userId,
      ]);
      res.send('Password changed successfully');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error changing password');
    }
  }
);
/**
 * @swagger
 * /delete-user:
 *   delete:
 *     summary: 회원 삭제 API
 *     description: 주어진 userId를 가진 사용자를 삭제합니다.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: User ID is required
 *       404:
 *         description: User not found
 *       500:
 *         description: Error deleting user
 */
// 회원 삭제 API
app.delete(
  '/delete-user',
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).send('User ID is required');
      return;
    }

    try {
      // 사용자 존재 여부 확인
      const [rows] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) {
        res.status(404).send('User not found');
        return;
      }

      // 사용자 삭제
      await db.execute('DELETE FROM users WHERE id = ?', [userId]);

      res.send('User deleted successfully');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error deleting user');
    }
  }
);

/**
 * @swagger
 * /chat/global:
 *   get:
 *     summary: 전체 글로벌 채팅 메시지 조회 API
 *     description: Retrieves all messages from the global chat
 *     responses:
 *       200:
 *         description: List of global chat messages
 */
// 전체 글로벌 채팅 메시지 조회 API
app.get('/chat/global', async (req: Request, res: Response) => {
  try {
    const [rows] = await db.execute('SELECT * FROM global_messages');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching global messages');
  }
});
/**
 * @swagger
 * /chat/history/{userId}:
 *   get:
 *     summary: 채팅 기록 조회 API
 *     description: Retrieves all chat history for the given user
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user whose chat history is to be retrieved
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of chat messages for the user
 */
// 채팅 기록 조회 API
app.get('/chat/history/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ?',
      [userId, userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching chat history');
  }
});
/**
 * @swagger
 * /message:
 *   post:
 *     summary: 1:1 메시지 보내기 API (Socket 으로 수정)
 *     description: Sends a message from one user to another
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               senderId:
 *                 type: string
 *               receiverId:
 *                 type: string
 *               content:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 */
// 1:1 메시지 보내기 API
app.post('/message', async (req: Request, res: Response) => {
  const { senderId, receiverId, content, username } = req.body;

  try {
    await db.execute(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
      [senderId, receiverId, content, username]
    );
    res.send('Message sent');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error sending message');
  }
});
// 서버 실행
const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
// Socket.io 설정
const io = new SocketIOServer(server, {
  cors: {
    origin: 'http://localhost:3000', // 프론트엔드 주소 추가
    methods: ['GET', 'POST'],
  },
});
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('send_global_message', async (data) => {
    const { senderId, username, content } = data;
    try {
      // 메시지를 global_messages 테이블에 저장
      await db.execute(
        'INSERT INTO global_messages (sender_id, username, content) VALUES (?, ?, ?)',
        [senderId, username, content]
      );
      // 전체 클라이언트에 메시지 전송
      //io.emit('receive_global_message', { senderId, username, content });
    } catch (err) {
      console.error(err);
    }
  });
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
  socket.on('send_message', async (data) => {
    const { senderId, receiverId, content, username } = data;
    try {
      await db.execute(
        'INSERT INTO messages (sender_id, receiver_id, content, username) VALUES (?, ?, ?, ?)',
        [senderId, receiverId, content, username]
      );
      io.to(receiverId).emit('receive_message', {
        senderId,
        content,
        username,
      });
    } catch (err) {
      console.error(err);
    }
  });
  // 방 생성 (userId로 방을 만들고 연결)
  socket.on('join_room', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

// USE chatapp;

// CREATE TABLE users (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   username VARCHAR(255) NOT NULL,
//   password VARCHAR(255) NOT NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// CREATE TABLE messages (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   sender_id INT NOT NULL,
//   receiver_id INT NOT NULL,
//   content TEXT,
//   username VARCHAR(255) NOT NULL,
//   timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (sender_id) REFERENCES users(id),
//   FOREIGN KEY (receiver_id) REFERENCES users(id)
// );

// CREATE TABLE global_messages (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   username VARCHAR(255) NOT NULL,
//   sender_id INT NOT NULL,
//   content TEXT,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (sender_id) REFERENCES users(id)
// );
